import { LegFeatures } from '../features';
import { applyRule, quotePrice } from '../rule';

const f = (over: Partial<LegFeatures>): LegFeatures => ({
    cheapSide: 'yes', p0C: 4, tradesPerDay7d: 5, weekHighC: 6, sweepDays14d: 0, ...over,
});

describe('rule v1.1 sign conventions', () => {
    it('YES longshot at p0: buy NO at 100 − (p0 + 20)', () => {
        expect(applyRule(f({ cheapSide: 'yes', p0C: 4 }))).toEqual({ quoteSide: 'no', quotePriceC: 76, excluded: null });
    });

    it('NO longshot (YES 95¢ → p0 5¢ in NO terms): buy YES at 100 − (5 + 20) = YES print − 20', () => {
        expect(applyRule(f({ cheapSide: 'no', p0C: 5 }))).toEqual({ quoteSide: 'yes', quotePriceC: 75, excluded: null });
    });

    it('floors sub-cent prices, so the implied cheap-side offer is never below p0 + 20', () => {
        expect(quotePrice(4.5)).toBe(75);
        expect(quotePrice(0.1)).toBe(79);
        expect(quotePrice(4.01)).toBe(75);
        expect(quotePrice(4)).toBe(76);
        for (const p0 of [0.1, 0.99, 1, 2.33, 4.5, 9.99, 10]) expect(100 - quotePrice(p0)).toBeGreaterThanOrEqual(p0 + 20);
    });

    it('p0 = 10¢ qualifies; above does not', () => {
        expect(applyRule(f({ p0C: 10 })).quotePriceC).toBe(70);
        expect(applyRule(f({ p0C: 10.01 }))).toEqual({ quoteSide: null, quotePriceC: null, excluded: 'not_cheap' });
    });

    it('fewer than 3 prints/day over 7 days is thin, but keeps its price for the paper arm', () => {
        expect(applyRule(f({ tradesPerDay7d: 20 / 7 }))).toEqual({ quoteSide: 'no', quotePriceC: 76, excluded: 'thin' });
        expect(applyRule(f({ tradesPerDay7d: 3 })).excluded).toBeNull();
    });

    it('no print before the day start', () => {
        expect(applyRule(f({ cheapSide: null, p0C: null })).excluded).toBe('no_prints');
    });
});
