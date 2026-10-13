import { z } from 'zod';

const Side = z.enum(['yes', 'no']);

/**
 * One trade as Kalshi returns it on `/markets/trades` and `/historical/trades` (identical shapes).
 * Integer count/price fields were removed 2026-03-12; only the `_fp` / `_dollars` strings exist.
 * Unknown keys are stripped, so additive API changes don't break parsing.
 */
export const RawTradeSchema = z
    .object({
        trade_id: z.string().min(1),
        ticker: z.string().min(1),
        count_fp: z.string(),
        yes_price_dollars: z.string(),
        no_price_dollars: z.string().optional(),
        // taker_side is deprecated in favour of taker_outcome_side; accept either.
        taker_side: Side.optional(),
        taker_outcome_side: Side.optional(),
        taker_book_side: z.enum(['bid', 'ask']).optional(),
        created_time: z.string(),
        is_block_trade: z.boolean().optional(),
    })
    .refine((t) => t.taker_outcome_side ?? t.taker_side, { message: 'trade has neither taker_outcome_side nor taker_side' });

export type RawTrade = z.infer<typeof RawTradeSchema>;

export const TradesPageSchema = z.object({
    trades: z.array(RawTradeSchema),
    cursor: z.string().nullish(),
});

export interface Trade {
    tradeId: string;
    ticker: string;
    createdAt: Date;
    /** YES price in cents, sub-cent precision kept (e.g. 1.5). */
    yesPriceCents: number;
    /** Contracts × 100; counts are fractional on the wire (e.g. "0.07"). */
    countHundredths: number;
    takerSide: 'yes' | 'no';
    isBlockTrade: boolean;
}

function parseDecimal(value: string, field: string): number {
    const n = Number(value);
    if (value.trim() === '' || !Number.isFinite(n)) throw new Error(`invalid ${field}: ${JSON.stringify(value)}`);
    return n;
}

/** Converts a parsed wire trade to the internal shape. Throws on non-numeric strings or a bad timestamp. */
export function normalizeTrade(raw: RawTrade): Trade {
    const createdAt = new Date(raw.created_time);
    if (Number.isNaN(createdAt.getTime())) throw new Error(`invalid created_time: ${raw.created_time}`);
    return {
        tradeId: raw.trade_id,
        ticker: raw.ticker,
        createdAt,
        yesPriceCents: Math.round(parseDecimal(raw.yes_price_dollars, 'yes_price_dollars') * 10_000) / 100,
        countHundredths: Math.round(parseDecimal(raw.count_fp, 'count_fp') * 100),
        takerSide: (raw.taker_outcome_side ?? raw.taker_side)!,
        isBlockTrade: raw.is_block_trade ?? false,
    };
}

/** Parses one response page. Throws (ZodError or Error) if any trade is malformed rather than dropping it. */
export function parseTradesPage(json: unknown): { trades: Trade[]; cursor: string | null } {
    const page = TradesPageSchema.parse(json);
    return { trades: page.trades.map(normalizeTrade), cursor: page.cursor || null };
}
