import parity from '../__fixtures__/bellman-parity.json';
import { normalizeTrade, RawTradeSchema } from '../../kalshi/trades';
import { computeFeatures, Print, sortPrints } from '../features';
import { applyRule } from '../rule';

type Case = (typeof parity.cases)[number];

function printsOf(c: Case): Print[] {
    const cols = parity.trade_columns;
    return c.trades.map((values) => {
        const raw = Object.fromEntries(cols.map((k, i) => [k, values[i]]));
        const t = normalizeTrade(RawTradeSchema.parse({ ...raw, ticker: c.ticker }));
        return { tradeId: t.tradeId, createdAt: t.createdAt, yesPriceCents: t.yesPriceCents, countHundredths: t.countHundredths, takerSide: t.takerSide };
    });
}

const dayStart = (d: string) => new Date(`${d}T00:00:00Z`);

describe('features: parity with bellman research (strategy/offer_days.csv.gz)', () => {
    it('has 20 recorded tickers covering both cheap sides and rebound legs', () => {
        expect(parity.cases).toHaveLength(20);
        expect(new Set(parity.cases.map((c) => c.side))).toEqual(new Set(['yes', 'no']));
        expect(parity.cases.some((c) => (c.expected.week_high ?? 0) >= 30)).toBe(true);
        expect(parity.cases.some((c) => c.expected.sweep_days_14d > 0)).toBe(true);
    });

    it.each(parity.cases.map((c) => [c.ticker, c] as const))('%s', (_ticker, c) => {
        const f = computeFeatures(printsOf(c), dayStart(c.basket_date));
        expect(f.cheapSide).toBe(c.side);
        expect(f.tradesPerDay7d).toBeCloseTo(c.expected.tpd, 9);
        expect(f.weekHighC).toBeCloseTo(c.expected.week_high!, 4);
        expect(f.sweepDays14d).toBe(c.expected.sweep_days_14d);
        if (!c.expected.p0_tie) {
            expect(f.p0C).toBeCloseTo(c.expected.p0!, 4);
            expect(applyRule(f).excluded).toBeNull();
        }
    });

    it('two recorded cases are same-microsecond ties where only the tie-break differs', () => {
        const ties = parity.cases.filter((c) => c.expected.p0_tie);
        expect(ties.map((c) => c.ticker).sort()).toEqual(['KXLOVEISBLINDENGAGEMENT-26-JEN', 'KXTRUMPPARDON-25MAY01-DJT']);
        const p0 = Object.fromEntries(ties.map((c) => [c.ticker, computeFeatures(printsOf(c), dayStart(c.basket_date)).p0C]));
        // Research took the tie's last row in API response order (8¢ and 10¢), which the stored
        // tape doesn't keep. Taker-YES walks 5→6→7→8→8¢ and 10→11¢; the producer takes the
        // walk's end, so the second leg reads 11¢ and is not cheap that day.
        expect(p0).toEqual({ 'KXLOVEISBLINDENGAGEMENT-26-JEN': 8, 'KXTRUMPPARDON-25MAY01-DJT': 11 });
    });
});

const T0 = Date.parse('2026-10-14T00:00:00Z');
const H = 3_600_000;
let seq = 0;
const p = (msBefore: number, yes: number, takerSide: 'yes' | 'no' = 'yes', count = 100): Print => ({
    tradeId: `t${String(seq++).padStart(4, '0')}`,
    createdAt: new Date(T0 - msBefore),
    yesPriceCents: yes,
    countHundredths: count,
    takerSide,
});

describe('computeFeatures', () => {
    const start = new Date(T0);

    it('p0 is the last print strictly before 00:00Z; later prints are ignored', () => {
        const f = computeFeatures([p(2 * H, 6), p(H, 4), p(-H, 1), p(0, 2)], start);
        expect(f.p0C).toBe(4);
        expect(f.cheapSide).toBe('yes');
    });

    it('a YES ≥ 90¢ leg is NO-cheap and every feature is in NO terms', () => {
        const f = computeFeatures([p(30 * H, 70), p(2 * H, 96), p(H, 95)], start);
        expect(f.cheapSide).toBe('no');
        expect(f.p0C).toBe(5);
        expect(f.weekHighC).toBe(30);
    });

    it('trades/day counts prints in [start − 7 d, start) / 7', () => {
        const inside = Array.from({ length: 21 }, (_, i) => p(i * 7 * H + 1, 5));
        const edge = p(7 * 24 * H, 5);
        const outside = p(7 * 24 * H + 1, 5);
        expect(computeFeatures([...inside, edge, outside], start).tradesPerDay7d).toBe(22 / 7);
    });

    it('a sweep day needs a cheap-side taker buy ≥ 15¢ above that UTC day VWAP', () => {
        const day1 = [p(10 * H, 4, 'yes', 1000), p(9 * H, 20, 'yes', 10)];   // VWAP ≈ 4.16 → 20 ≥ 19.16
        const day3 = [p(60 * H, 4, 'yes', 1000), p(59 * H, 18, 'yes', 10)];   // 18 < 19.1
        const day5 = [p(100 * H, 4, 'yes', 1000), p(99 * H, 30, 'no', 10)];   // a NO taker sold YES up: not a cheap-side buy
        const old = [p(15 * 24 * H, 4, 'yes', 1000), p(15 * 24 * H - 1, 40, 'yes', 10)];
        expect(computeFeatures([...day1, ...day3, ...day5, ...old], start).sweepDays14d).toBe(1);
    });

    it('for a NO-cheap leg a sweep is a NO taker buying up in NO terms', () => {
        const prints = [p(10 * H, 96, 'no', 1000), p(9 * H, 75, 'no', 10)];  // NO 4¢ then NO 25¢
        expect(computeFeatures(prints, start).sweepDays14d).toBe(1);
    });

    it('same-timestamp prints sort by the price the taker paid', () => {
        const at = new Date(T0 - H);
        const walk = [10, 8, 9].map((yes, i) => ({ tradeId: `w${i}`, createdAt: at, yesPriceCents: yes, countHundredths: 100, takerSide: 'yes' as const }));
        expect(sortPrints(walk).map((x) => x.yesPriceCents)).toEqual([8, 9, 10]);
        const noWalk = walk.map((x) => ({ ...x, takerSide: 'no' as const }));
        expect(sortPrints(noWalk).map((x) => x.yesPriceCents)).toEqual([10, 9, 8]);
    });

    it('no prints before the day start: no cheap side', () => {
        expect(computeFeatures([p(-H, 3)], start)).toEqual({ cheapSide: null, p0C: null, tradesPerDay7d: 0, weekHighC: null, sweepDays14d: 0 });
    });
});
