import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { chunk, IN_CHUNK, selectAll } from '../db/paged';

const HUNDREDTHS_PER_CONTRACT = 100;
const CENTICENTS_PER_CENT = 100;

/** The trading.order_ledger fill columns the fold reads. */
export const LedgerFillSchema = z.object({
    id: z.number().int(),
    policy_id: z.number().int(),
    market_ticker: z.string(),
    side: z.enum(['yes', 'no']),
    action: z.enum(['buy', 'sell', 'amend']),
    count: z.number().int().nullable(),
    count_hundredths: z.number().int().nullable(),
    price_cents: z.number().int(),
    fee_cents: z.number().int(),
    fee_centicents: z.number().int().nullable(),
    event_ts: z.coerce.date().nullable(),
});
export type LedgerFill = z.infer<typeof LedgerFillSchema>;
const FILL_COLUMNS = 'id, policy_id, market_ticker, side, action, count, count_hundredths, price_cents, fee_cents, fee_centicents, event_ts';

export interface FoldedPosition {
    /** Signed hundredths: + YES, − NO. */
    netPosC: number;
    /** Own-side cost basis of the residual position, cents × hundredths. */
    positionCostC: number;
    feesPaidC: number;
}

const fillCountC = (f: LedgerFill): number => f.count_hundredths ?? (f.count ?? 0) * HUNDREDTHS_PER_CONTRACT;
const fillFeeC = (f: LedgerFill): number => f.fee_centicents ?? f.fee_cents * CENTICENTS_PER_CENT;

/**
 * Port of the trading platform's foldFillsToPosition (src/database/trading/order-ledger.ts):
 * one signed net position, because Kalshi nets YES and NO. Each fill is a signed delta
 * (+ for buy YES / sell NO, − for buy NO / sell YES); side and action come from our ledger,
 * never the venue's labels. Fills must be chronological. Undefined when flat or empty.
 */
export function foldFillsToPosition(fills: LedgerFill[]): FoldedPosition | undefined {
    if (fills.length === 0) return undefined;
    let netPosC = 0, positionCostC = 0, feesPaidC = 0;
    for (const fill of fills) {
        feesPaidC += fillFeeC(fill);
        const delta = (fill.side === 'yes' ? 1 : -1) * (fill.action === 'buy' ? 1 : -1) * fillCountC(fill);
        const newNet = netPosC + delta;
        const price = fill.price_cents;
        if (netPosC === 0 || Math.sign(delta) === Math.sign(netPosC)) {
            positionCostC += price * Math.abs(delta);
        } else if (Math.abs(delta) <= Math.abs(netPosC)) {
            const unit = positionCostC / Math.abs(netPosC);
            positionCostC = Math.round(positionCostC - unit * Math.abs(delta));
        } else {
            positionCostC = price * Math.abs(newNet);
        }
        netPosC = newNet;
    }
    if (netPosC === 0) return undefined;
    return { netPosC, positionCostC, feesPaidC };
}

/** Folds each ticker's fills (chronological input) into its signed net position; flat tickers are omitted. */
export function foldByTicker(fills: LedgerFill[]): Map<string, number> {
    const byTicker = new Map<string, LedgerFill[]>();
    for (const f of fills) {
        const list = byTicker.get(f.market_ticker) ?? [];
        list.push(f);
        byTicker.set(f.market_ticker, list);
    }
    const out = new Map<string, number>();
    for (const [ticker, list] of byTicker) {
        const pos = foldFillsToPosition(list);
        if (pos) out.set(ticker, pos.netPosC);
    }
    return out;
}

/** Net positions of the sleeve's policies on these tickers, from trading.order_ledger fills (paged, chunked). */
export async function loadPositions(client: SupabaseClient, policyIds: number[], tickers: string[]): Promise<Map<string, number>> {
    if (policyIds.length === 0 || tickers.length === 0) return new Map();
    const fills: LedgerFill[] = [];
    for (const part of chunk([...new Set(tickers)].sort(), IN_CHUNK)) {
        const rows = await selectAll<unknown>('order_ledger fills', (from, to) =>
            client.schema('trading').from('order_ledger').select(FILL_COLUMNS)
                .in('policy_id', policyIds)
                .in('market_ticker', part)
                .eq('event_type', 'fill')
                .order('event_ts', { ascending: true })
                .order('id', { ascending: true })
                .range(from, to));
        fills.push(...rows.map((r) => LedgerFillSchema.parse(r)));
    }
    // Chunks are disjoint by ticker, so per-ticker order is already chronological.
    return foldByTicker(fills);
}
