import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { chunk, IN_CHUNK, selectAll } from '../db/paged';
import { KalshiRetriesExhaustedError, type TradesQuery } from '../kalshi/public-client';
import type { Trade } from '../kalshi/trades';
import { DAY_MS, RULE } from './config';
import type { Print } from './features';

/** A sweep_maker.trades row. */
export const TradeRowSchema = z.object({
    trade_id: z.string(),
    market_ticker: z.string(),
    created_at: z.string(),
    yes_price_cents: z.coerce.number(),
    count_hundredths: z.number().int(),
    taker_side: z.enum(['yes', 'no']),
    is_block_trade: z.boolean(),
});
export type TradeRow = z.infer<typeof TradeRowSchema>;

export const tradeToRow = (t: Trade): TradeRow => ({
    trade_id: t.tradeId,
    market_ticker: t.ticker,
    created_at: t.createdAt.toISOString(),
    yes_price_cents: t.yesPriceCents,
    count_hundredths: t.countHundredths,
    taker_side: t.takerSide,
    is_block_trade: t.isBlockTrade,
});

export const rowToPrint = (r: TradeRow): Print => ({
    tradeId: r.trade_id,
    createdAt: new Date(r.created_at),
    yesPriceCents: r.yes_price_cents,
    countHundredths: r.count_hundredths,
    takerSide: r.taker_side,
});

export interface TapeStore {
    /** Stored rows per ticker with created_at ≥ `from`. */
    readSince(tickers: string[], from: Date): Promise<Map<string, TradeRow[]>>;
    /** Idempotent on trade_id. */
    insert(rows: TradeRow[]): Promise<void>;
}

export interface TradesSourceLike {
    fetchTrades(query: TradesQuery): Promise<Trade[]>;
    getHistoricalTradesCutoff(): Promise<Date>;
}

const INSERT_BATCH = 1000;

export class SupabaseTapeStore implements TapeStore {
    constructor(private readonly client: SupabaseClient) {}

    async readSince(tickers: string[], from: Date): Promise<Map<string, TradeRow[]>> {
        const out = new Map<string, TradeRow[]>();
        for (const part of chunk([...new Set(tickers)].sort(), IN_CHUNK)) {
            const rows = await selectAll<unknown>('sweep_maker.trades', (lo, hi) =>
                this.client.schema('sweep_maker').from('trades')
                    .select('trade_id, market_ticker, created_at, yes_price_cents, count_hundredths, taker_side, is_block_trade')
                    .in('market_ticker', part)
                    .gte('created_at', from.toISOString())
                    .order('market_ticker').order('created_at').order('trade_id')
                    .range(lo, hi));
            for (const raw of rows) {
                const r = TradeRowSchema.parse(raw);
                const list = out.get(r.market_ticker) ?? [];
                list.push(r);
                out.set(r.market_ticker, list);
            }
        }
        return out;
    }

    async insert(rows: TradeRow[]): Promise<void> {
        // service_role holds INSERT but not UPDATE on trades: ON CONFLICT DO NOTHING only.
        for (const part of chunk(rows, INSERT_BATCH)) {
            const { error } = await this.client.schema('sweep_maker').from('trades')
                .upsert(part, { onConflict: 'trade_id', ignoreDuplicates: true });
            if (error) throw new Error(`sweep_maker.trades insert: ${error.code ?? ''} ${error.message}`);
        }
    }
}

export interface TapeResult {
    /** Every known print per ticker since the backfill start (stored ∪ fetched). */
    prints: Map<string, Print[]>;
    /** Fetched rows not already stored; what the caller persists. */
    newRows: TradeRow[];
    /** Tickers with nothing stored in the window (14-day backfill). */
    backfilled: number;
    historicalFetches: number;
    /** Tickers whose pull exhausted its retries; their prints are the stored ones only. */
    failed: string[];
    elapsedMs: number;
}

/** The run aborts when more than this share of candidate tickers end tape_failed. */
export const MAX_TAPE_FAILED_FRACTION = 0.1;

export const tapeFailureExceeded = (failed: number, total: number): boolean =>
    total > 0 && failed / total > MAX_TAPE_FAILED_FRACTION;

/** Runs `fn` over `items`; the first rejection stops every worker from taking another item. */
async function pool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
    let next = 0;
    let stopped = false;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (!stopped && next < items.length) {
            try {
                await fn(items[next++]);
            } catch (err) {
                stopped = true;
                throw err;
            }
        }
    });
    await Promise.all(workers);
}

/**
 * Brings each ticker's tape up to now (PRD 1.3). A ticker with nothing stored since
 * `dayStart − 14 d` is backfilled from there; otherwise the pull starts at its newest stored
 * print (inclusive, so the boundary second is re-read and deduped on trade_id). A window
 * reaching below Kalshi's historical cutoff also reads /historical/trades up to the cutoff,
 * because the live endpoint returns nothing for older trades. Requests go through the
 * source's shared pacer; `concurrency` only overlaps their latency.
 *
 * A ticker whose pull exhausts its retries (429 / 5xx / network) is recorded in `failed`,
 * keeps only its stored prints, and contributes no new rows. Any other error (a non-429 4xx
 * is auth or config) rejects the whole pull.
 */
export async function pullTape({
    tickers, dayStart, store, source, concurrency = 4, log = console.log,
}: {
    tickers: string[];
    dayStart: Date;
    store: Pick<TapeStore, 'readSince'>;
    source: TradesSourceLike;
    concurrency?: number;
    log?: (msg: string) => void;
}): Promise<TapeResult> {
    const t0 = Date.now();
    const windowStart = new Date(dayStart.getTime() - RULE.tapeBackfillDays * DAY_MS);
    const stored = await store.readSince(tickers, windowStart);
    const cutoff = await source.getHistoricalTradesCutoff();
    const prints = new Map<string, Print[]>();
    const newRows: TradeRow[] = [];
    const failed: string[] = [];
    let backfilled = 0, historicalFetches = 0, done = 0;

    await pool(tickers, concurrency, async (ticker) => {
        const have = stored.get(ticker) ?? [];
        const ids = new Set(have.map((r) => r.trade_id));
        if (have.length === 0) backfilled++;
        const watermark = have.reduce((m, r) => Math.max(m, Date.parse(r.created_at)), windowStart.getTime());
        const minTs = Math.floor(watermark / 1000);
        const fetched: Trade[] = [];
        try {
            if (watermark < cutoff.getTime()) {
                historicalFetches++;
                fetched.push(...await source.fetchTrades({ ticker, minTs, maxTs: Math.ceil(cutoff.getTime() / 1000), source: 'historical' }));
            }
            fetched.push(...await source.fetchTrades({ ticker, minTs, source: 'live' }));
        } catch (err) {
            if (!(err instanceof KalshiRetriesExhaustedError)) throw err;
            failed.push(ticker);
            prints.set(ticker, have.map(rowToPrint));
            log(`tape: ${ticker} failed: ${err.message}`);
            return;
        }
        const fresh: TradeRow[] = [];
        for (const t of fetched) {
            if (ids.has(t.tradeId)) continue;
            ids.add(t.tradeId);
            fresh.push(tradeToRow(t));
        }
        newRows.push(...fresh);
        prints.set(ticker, [...have, ...fresh].map(rowToPrint));
        if (++done % 100 === 0) log(`tape: ${done}/${tickers.length} tickers, ${newRows.length} new prints`);
    });

    return { prints, newRows, backfilled, historicalFetches, failed, elapsedMs: Date.now() - t0 };
}
