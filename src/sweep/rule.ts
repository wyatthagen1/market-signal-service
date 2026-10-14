import { RULE } from './config';
import type { LegFeatures, Side } from './features';

export type RuleExclusion = 'no_prints' | 'not_cheap' | 'thin';

export interface RuleDecision {
    /** The side we buy: the opposite of the cheap side. Null when there is no cheap side. */
    quoteSide: Side | null;
    /** Own-side bid, whole cents: 100 − (p0 + 20), floored. Null unless p0 ≤ 10¢. */
    quotePriceC: number | null;
    /** Null when the leg qualifies. */
    excluded: RuleExclusion | null;
}

/**
 * The 100 − (p0 + offset) bid on the side opposite the cheap one, floored so the implied
 * offer on the cheap side is never below p0 + offset. A YES longshot at p0 → NO bid; a NO
 * longshot (YES ≥ 90¢, p0 = 100 − YES) → YES bid at the same formula. Integer hundredths
 * keep sub-cent p0 exact.
 */
export function quotePrice(p0C: number): number {
    return Math.floor((10_000 - Math.round(p0C * 100) - RULE.offsetC * 100) / 100);
}

/**
 * Rule v1.1's tape conditions (PRD §1): cheap side's p0 ≤ 10¢ and ≥ 3 prints/day over the
 * prior 7 days. The close conditions are the candidate predicate's. A cheap leg keeps its
 * price even when excluded, so the paper arm can score it.
 */
export function applyRule(f: LegFeatures): RuleDecision {
    if (f.cheapSide === null || f.p0C === null) return { quoteSide: null, quotePriceC: null, excluded: 'no_prints' };
    if (f.p0C > RULE.maxCheapC) return { quoteSide: null, quotePriceC: null, excluded: 'not_cheap' };
    const quoteSide: Side = f.cheapSide === 'yes' ? 'no' : 'yes';
    const quotePriceC = quotePrice(f.p0C);
    if (f.tradesPerDay7d < RULE.minTradesPerDay) return { quoteSide, quotePriceC, excluded: 'thin' };
    return { quoteSide, quotePriceC, excluded: null };
}
