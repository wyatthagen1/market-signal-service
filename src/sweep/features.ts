import { DAY_MS, RULE } from './config';

export type Side = 'yes' | 'no';

/** One print of the public tape, as stored in sweep_maker.trades. */
export interface Print {
    tradeId: string;
    createdAt: Date;
    /** YES price, cents, sub-cent kept. */
    yesPriceCents: number;
    countHundredths: number;
    takerSide: Side;
}

export interface LegFeatures {
    /** Side whose last pre-day print is ≤ 50¢; null with no print before the day start. */
    cheapSide: Side | null;
    /** Last print before 00:00Z of the basket day, cheap-side cents. */
    p0C: number | null;
    /** Prints in [start − 7 d, start) / 7. */
    tradesPerDay7d: number;
    /** Max cheap-side print in [start − 7 d, start); null with none. */
    weekHighC: number | null;
    /** UTC days in the prior 14 with a cheap-side taker buy ≥ 15¢ above that day's VWAP. */
    sweepDays14d: number;
}

const takerPaid = (p: Print): number => (p.takerSide === 'yes' ? p.yesPriceCents : 100 - p.yesPriceCents);

/**
 * Chronological order. Prints of one taker order walking the book share a timestamp; within
 * such a tie the walk runs up in the price the taker paid, so the walk's end sorts last and
 * becomes p0. (Research broke ties by API response order, which the stored tape doesn't keep.)
 */
export function sortPrints(prints: Print[]): Print[] {
    return [...prints].sort((a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime()
        || takerPaid(a) - takerPaid(b)
        || (a.tradeId < b.tradeId ? -1 : a.tradeId > b.tradeId ? 1 : 0));
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

/**
 * Quote-time features of one leg for the UTC day starting at `dayStart`, from its prints
 * (any order; only prints before `dayStart` are read). Mirrors bellman strategy_doc.simulate:
 * p0 = the last print before the day start, trades/day = prints in the prior 7 days / 7, week
 * high = their max, all in cheap-side terms (NO price = 100 − YES). Sweep days follow
 * strategy doc §5.9, with the VWAP count-weighted over every print of the UTC day.
 */
export function computeFeatures(prints: Print[], dayStart: Date): LegFeatures {
    const start = dayStart.getTime();
    const before = sortPrints(prints.filter((p) => p.createdAt.getTime() < start));
    const last = before[before.length - 1];
    const weekStart = start - 7 * DAY_MS;
    const week = before.filter((p) => p.createdAt.getTime() >= weekStart);
    const tradesPerDay7d = week.length / 7;
    if (!last) return { cheapSide: null, p0C: null, tradesPerDay7d, weekHighC: null, sweepDays14d: 0 };

    const cheapSide: Side = last.yesPriceCents <= 50 ? 'yes' : 'no';
    const q = (p: Print): number => (cheapSide === 'yes' ? p.yesPriceCents : round2(100 - p.yesPriceCents));

    let sweepDays14d = 0;
    for (let j = 1; j <= RULE.sweepLookbackDays; j++) {
        const lo = start - j * DAY_MS;
        const hi = lo + DAY_MS;
        const day = before.filter((p) => p.createdAt.getTime() >= lo && p.createdAt.getTime() < hi);
        if (day.length === 0) continue;
        const contracts = day.reduce((s, p) => s + p.countHundredths, 0);
        if (contracts <= 0) continue;
        const vwap = day.reduce((s, p) => s + q(p) * p.countHundredths, 0) / contracts;
        if (day.some((p) => p.takerSide === cheapSide && q(p) >= vwap + RULE.sweepAboveVwapC)) sweepDays14d++;
    }

    return {
        cheapSide,
        p0C: q(last),
        tradesPerDay7d,
        weekHighC: week.length ? week.reduce((m, p) => Math.max(m, q(p)), -Infinity) : null,
        sweepDays14d,
    };
}
