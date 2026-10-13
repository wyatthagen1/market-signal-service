import { z } from 'zod';

const timestamp = z.string().refine((s) => Number.isFinite(Date.parse(s)), 'not a timestamp');

/**
 * The sweep_basket store row: the producer↔trader contract. Mirrors the trading platform's
 * SweepBasketRowSchema (src/database/sweep-maker/sweep-basket.ts) field for field; every
 * pushed row must parse there. `count_c` is the target position on quote_side (S × 100);
 * the quoter subtracts what is already held.
 */
export const SweepBasketRowSchema = z.object({
    ticker: z.string(),
    event_ticker: z.string(),
    basket_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    cheap_side: z.enum(['yes', 'no']),
    quote_side: z.enum(['yes', 'no']),
    quote_price_c: z.number().int().min(1).max(99),
    count_c: z.number().int().positive(),
    valid_until: timestamp,
});
export type SweepBasketRow = z.infer<typeof SweepBasketRowSchema>;

/** One sweep_maker.basket row (§5 of the PRD). */
export const BasketDbRowSchema = z.object({
    basket_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ticker: z.string(),
    event_ticker: z.string(),
    series_ticker: z.string(),
    category: z.string(),
    fee_type: z.string().nullable(),
    cheap_side: z.enum(['yes', 'no']),
    p0_c: z.number().nullable(),
    quote_side: z.enum(['yes', 'no']).nullable(),
    quote_price_c: z.number().int().nullable(),
    count_c: z.number().int().nullable(),
    trades_per_day_7d: z.number().nullable(),
    week_high_c: z.number().nullable(),
    sweep_days_14d: z.number().int().nullable(),
    leg_close_at: timestamp,
    event_close_at: timestamp,
    book_yes_bid: z.number().int().nullable(),
    book_yes_ask: z.number().int().nullable(),
    held_c: z.number().int(),
    sleeve_cash_c: z.number().int().nullable(),
    admitted: z.boolean(),
    excluded: z.string().nullable(),
    ration_u: z.number().nullable(),
    valid_until: timestamp,
});
export type BasketDbRow = z.infer<typeof BasketDbRowSchema>;

/** The store row for an admitted basket row. Throws if it would not parse on the trader. */
export function toStoreRow(row: BasketDbRow): SweepBasketRow {
    return SweepBasketRowSchema.parse({
        ticker: row.ticker,
        event_ticker: row.event_ticker,
        basket_date: row.basket_date,
        cheap_side: row.cheap_side,
        quote_side: row.quote_side,
        quote_price_c: row.quote_price_c,
        count_c: row.count_c,
        valid_until: row.valid_until,
    });
}
