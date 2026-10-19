import { createHash } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { BasketDbRow } from './basket';
import type { CandidateLeg } from './candidates';
import { BUDGET_FRACTION, EXPIRY_STAGGER_HOURS, VALID_FOR_HOURS } from './config';
import type { LegFeatures, Side } from './features';
import type { RuleDecision } from './rule';

export type AdmitExclusion = 'tape_failed' | 'opposite_position' | 'no_cheap_dup' | 'rationed';

const seededU = (key: string): number => createHash('sha256').update(key).digest().readUIntBE(0, 6) / 2 ** 48;

/**
 * Deterministic uniform in [0, 1) from sha256(`${basketDate}|${ticker}`): the top 48 bits
 * over 2^48, exact in a double. Reproducible in Python with hashlib.
 */
export const rationU = (basketDate: string, ticker: string): number => seededU(`${basketDate}|${ticker}`);

/** As rationU over `expiry|${basketDate}|${ticker}`, so the two draws are independent. */
export const expiryU = (basketDate: string, ticker: string): number => seededU(`expiry|${basketDate}|${ticker}`);

/** basket_date 00:00Z + 26 h + expiryU × 2 h, floored to the second (Kalshi's expiration_time unit). */
export function validUntil(basketDate: string, ticker: string): string {
    const floorS = Date.parse(`${basketDate}T00:00:00Z`) / 1000 + VALID_FOR_HOURS * 3600;
    return new Date((floorS + Math.floor(expiryU(basketDate, ticker) * EXPIRY_STAGGER_HOURS * 3600)) * 1000).toISOString();
}

export interface AdmitLeg {
    leg: CandidateLeg;
    features: LegFeatures;
    rule: RuleDecision;
}

export interface AdmitInput {
    basketDate: string;
    legs: AdmitLeg[];
    /** Signed net position per ticker, hundredths (+ YES, − NO); absent = flat. */
    positions: Map<string, number>;
    /** Sleeve ledger cash, cents; null skips the budget check (dry run without a sleeve). */
    cashC: number | null;
    /** Contracts per market. */
    s: number;
    /** Tickers whose tape pull failed today; always excluded. */
    tapeFailed?: ReadonlySet<string>;
}

export interface AdmitResult {
    rows: BasketDbRow[];
    /** floor(0.95 × cash), cents; null without cash. */
    budgetC: number | null;
    /** Σ quote_price_c × unfilled contracts over admitted rows, cents. */
    usedC: number;
    /** Same sum before any rationing. */
    demandC: number;
    rationed: number;
    /** Admitted rows with an unfilled target, i.e. that will rest an order. */
    resting: number;
}

const heldOn = (side: Side, netPosC: number): number => (side === 'yes' ? Math.max(0, netPosC) : Math.max(0, -netPosC));
const opposite = (side: Side): Side => (side === 'yes' ? 'no' : 'yes');

/**
 * Budget admission (PRD 1.5, §3.4–3.5). Writes one row per candidate:
 *   - a ticker in tapeFailed → tape_failed, whatever its stored tape says;
 *   - rule exclusions pass through;
 *   - a leg holding a position on the side opposite quote_side → opposite_position (Kalshi
 *     nets YES/NO, so the bid would sell it);
 *   - per mutually exclusive event, at most one NO-cheap leg: a leg already held keeps its
 *     place, else the lowest ration_u; the rest → no_cheap_dup;
 *   - count_c = S × 100 is the target; the unfilled part (count_c − held on quote_side)
 *     reserves quote_price_c each, and a fully held leg is admitted but reserves nothing;
 *   - if Σ reserved > 0.95 × cash, legs are dropped in descending ration_u until it fits
 *     (rationed). Never by price, edge or any other leg property.
 */
export function admit(input: AdmitInput): AdmitResult {
    const { basketDate, positions, cashC, s, tapeFailed } = input;
    const targetC = s * 100;

    type Work = { a: AdmitLeg; held: number; u: number; excluded: string | null; unfilledC: number };
    const work: Work[] = input.legs.map((a) => {
        const held = positions.get(a.leg.ticker) ?? 0;
        let excluded: string | null = tapeFailed?.has(a.leg.ticker) ? 'tape_failed' : a.rule.excluded;
        const side = a.rule.quoteSide;
        if (!excluded && side && heldOn(opposite(side), held) > 0) excluded = 'opposite_position';
        const unfilledC = side ? Math.max(0, targetC - heldOn(side, held)) : 0;
        return { a, held, u: rationU(basketDate, a.leg.ticker), excluded, unfilledC };
    });

    const noCheapByEvent = new Map<string, Work[]>();
    for (const w of work) {
        if (w.excluded || w.a.features.cheapSide !== 'no' || !w.a.leg.mutuallyExclusive) continue;
        const list = noCheapByEvent.get(w.a.leg.eventTicker) ?? [];
        list.push(w);
        noCheapByEvent.set(w.a.leg.eventTicker, list);
    }
    for (const list of noCheapByEvent.values()) {
        if (list.length < 2) continue;
        const held = list.filter((w) => w.unfilledC < targetC);
        const keep = new Set(held.length ? held : [list.reduce((m, w) => (w.u < m.u ? w : m))]);
        for (const w of list) if (!keep.has(w)) w.excluded = 'no_cheap_dup';
    }

    const reserve = (w: Work): number => (w.a.rule.quotePriceC ?? 0) * w.unfilledC / 100;
    const admitted = work.filter((w) => !w.excluded);
    const demandC = admitted.reduce((sum, w) => sum + reserve(w), 0);
    const budgetC = cashC === null ? null : Math.floor(BUDGET_FRACTION * cashC);
    let usedC = demandC;
    let rationed = 0;
    if (budgetC !== null && usedC > budgetC) {
        const droppable = admitted.filter((w) => w.unfilledC > 0).sort((x, y) => y.u - x.u);
        for (const w of droppable) {
            if (usedC <= budgetC) break;
            w.excluded = 'rationed';
            usedC -= reserve(w);
            rationed++;
        }
    }

    const rows = work.map((w): BasketDbRow => {
        const { leg, features: f, rule } = w.a;
        return {
            basket_date: basketDate,
            ticker: leg.ticker,
            event_ticker: leg.eventTicker,
            series_ticker: leg.seriesTicker,
            category: leg.category,
            fee_type: leg.feeType,
            cheap_side: f.cheapSide ?? fallbackCheapSide(leg),
            p0_c: f.p0C,
            quote_side: rule.quoteSide,
            quote_price_c: rule.quotePriceC,
            count_c: rule.quoteSide ? targetC : null,
            trades_per_day_7d: f.tradesPerDay7d,
            week_high_c: f.weekHighC,
            sweep_days_14d: f.sweepDays14d,
            leg_close_at: leg.closeAt.toISOString(),
            event_close_at: leg.eventCloseAt.toISOString(),
            book_yes_bid: leg.bookYesBid,
            book_yes_ask: leg.bookYesAsk,
            held_c: w.held,
            sleeve_cash_c: cashC,
            admitted: !w.excluded,
            excluded: w.excluded,
            ration_u: w.u,
            valid_until: validUntil(basketDate, leg.ticker),
        };
    });
    const resting = work.filter((w) => !w.excluded && w.unfilledC > 0).length;
    return { rows, budgetC, usedC, demandC, rationed, resting };
}

/** cheap_side is NOT NULL; a leg with no print takes it from the stored touch, else YES. */
function fallbackCheapSide(leg: CandidateLeg): Side {
    if (leg.bookYesBid !== null && leg.bookYesAsk !== null && leg.bookYesAsk > 0) {
        return (leg.bookYesBid + leg.bookYesAsk) / 2 > 50 ? 'no' : 'yes';
    }
    return 'yes';
}

/** The UTC midnight starting `basketDate`. */
export function dayStartOf(basketDate: string): Date {
    return new Date(Date.parse(`${basketDate}T00:00:00Z`));
}

export const utcDate = (d: Date): string => d.toISOString().slice(0, 10);

const SleeveStateSchema = z.object({
    sleeve_id: z.number().int(),
    status: z.string(),
    balance_centicents: z.coerce.number(),
});

/** Sleeve ledger cash in whole cents (accounting.sleeve_state.balance_centicents / 100, floored). */
export async function loadSleeveCash(client: SupabaseClient, sleeveId: number): Promise<{ cashC: number; status: string }> {
    const { data, error } = await client.schema('accounting').from('sleeve_state')
        .select('sleeve_id, status, balance_centicents').eq('sleeve_id', sleeveId);
    if (error) throw new Error(`sleeve_state: ${error.message}`);
    const rows = z.array(SleeveStateSchema).parse(data ?? []);
    if (rows.length !== 1) throw new Error(`sleeve_state: expected one row for sleeve ${sleeveId}, got ${rows.length}`);
    return { cashC: Math.floor(rows[0].balance_centicents / 100), status: rows[0].status };
}
