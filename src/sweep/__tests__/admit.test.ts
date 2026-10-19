import { admit, AdmitLeg, expiryU, rationU, validUntil } from '../admit';
import { SweepBasketRowSchema, toStoreRow } from '../basket';
import { CandidateLeg } from '../candidates';
import { LegFeatures, Side } from '../features';
import { applyRule } from '../rule';

const DATE = '2026-10-14';

function leg(ticker: string, opts: { event?: string; cheap?: Side; p0?: number; me?: boolean } = {}): AdmitLeg {
    const cheapSide = opts.cheap ?? 'yes';
    const leg: CandidateLeg = {
        ticker, eventTicker: opts.event ?? `EV-${ticker}`, seriesTicker: 'KXSER', category: 'Sports', feeType: null,
        mutuallyExclusive: opts.me ?? true, closeAt: new Date('2026-10-30T00:00:00Z'), eventCloseAt: new Date('2026-11-01T00:00:00Z'),
        legsInEvent: 6, bookYesBid: null, bookYesAsk: null,
    };
    const features: LegFeatures = { cheapSide, p0C: opts.p0 ?? 4, tradesPerDay7d: 10, weekHighC: 8, sweepDays14d: 1 };
    return { leg, features, rule: applyRule(features) };
}

const legs = (n: number, p0 = (i: number) => 1 + (i % 10)) => Array.from({ length: n }, (_, i) => leg(`KXT-${i}`, { p0: p0(i) }));
const reserved = (rows: ReturnType<typeof admit>['rows']) => rows.filter((r) => r.admitted).reduce((s, r) => s + r.quote_price_c!, 0);

describe('admit', () => {
    it('rationU is sha256-seeded and matches the Python reference', () => {
        expect(rationU('2026-10-14', 'KXTEST-A')).toBe(0.8544915356908369);
        expect(rationU('2026-10-14', 'KXNBATEAM-26-LBJ')).toBe(0.29909843531227764);
    });

    it('a funded sleeve admits the full basket, every row parses as a store row', () => {
        const input = legs(40);
        const r = admit({ basketDate: DATE, legs: input, positions: new Map(), cashC: 100_000, s: 1 });
        expect(r.rationed).toBe(0);
        expect(r.rows.every((x) => x.admitted && x.excluded === null)).toBe(true);
        expect(r.usedC).toBe(reserved(r.rows));
        expect(r.usedC).toBeLessThanOrEqual(r.budgetC!);
        expect(r.resting).toBe(40);
        for (const row of r.rows) {
            expect(row).toMatchObject({ count_c: 100, sleeve_cash_c: 100_000, valid_until: validUntil(DATE, row.ticker), held_c: 0 });
            expect(SweepBasketRowSchema.safeParse(toStoreRow(row)).success).toBe(true);
        }
    });

    it('over budget: drops in descending ration_u until Σ fits, reproducibly, never by price', () => {
        const input = legs(100);
        const cashC = 3000;
        const a = admit({ basketDate: DATE, legs: input, positions: new Map(), cashC, s: 1 });
        const b = admit({ basketDate: DATE, legs: [...input].reverse(), positions: new Map(), cashC, s: 1 });
        const dropped = (r: typeof a) => r.rows.filter((x) => x.excluded === 'rationed').map((x) => x.ticker).sort();
        expect(a.rationed).toBeGreaterThan(0);
        expect(dropped(a)).toEqual(dropped(b));
        expect(a.usedC).toBeLessThanOrEqual(Math.floor(0.95 * cashC));
        const kept = a.rows.filter((x) => x.admitted);
        const minDroppedU = Math.min(...a.rows.filter((x) => x.excluded === 'rationed').map((x) => x.ration_u!));
        expect(kept.every((x) => x.ration_u! < minDroppedU)).toBe(true);

        // Repricing every leg changes how many are dropped, never the order they go in.
        const repriced = admit({ basketDate: DATE, legs: legs(100, (i) => 10 - (i % 10)), positions: new Map(), cashC, s: 1 });
        const order = (r: typeof a) => r.rows.filter((x) => x.excluded === 'rationed').sort((x, y) => y.ration_u! - x.ration_u!).map((x) => x.ticker);
        const [short, long] = [order(a), order(repriced)].sort((x, y) => x.length - y.length);
        expect(long.slice(0, short.length)).toEqual(short);
    });

    it('thinning is uniform across legs: drop frequency is flat in price and in ticker', () => {
        const input = legs(200);
        const drops = new Map<string, number>();
        const days = 400;
        for (let d = 0; d < days; d++) {
            const date = new Date(Date.UTC(2026, 0, 1) + d * 86_400_000).toISOString().slice(0, 10);
            const r = admit({ basketDate: date, legs: input, positions: new Map(), cashC: 8000, s: 1 });
            for (const x of r.rows) if (x.excluded === 'rationed') drops.set(x.ticker, (drops.get(x.ticker) ?? 0) + 1);
        }
        const rate = (pred: (i: number) => boolean) => {
            const ids = input.map((_, i) => i).filter(pred);
            return ids.reduce((s, i) => s + (drops.get(`KXT-${i}`) ?? 0), 0) / (ids.length * days);
        };
        const cheapest = rate((i) => i % 10 === 9);   // p0 10¢ → lowest bid
        const dearest = rate((i) => i % 10 === 0);    // p0 1¢ → highest bid
        expect(Math.abs(cheapest - dearest)).toBeLessThan(0.05);
        expect(Math.abs(rate((i) => i < 100) - rate((i) => i >= 100))).toBeLessThan(0.05);
    });

    it('excludes a leg holding the opposite side, both directions', () => {
        const yesCheap = leg('A', { cheap: 'yes' });  // quotes NO
        const noCheap = leg('B', { cheap: 'no', p0: 6 });  // quotes YES
        const r = admit({ basketDate: DATE, legs: [yesCheap, noCheap], positions: new Map([['A', 100], ['B', -50]]), cashC: 100_000, s: 1 });
        expect(r.rows.map((x) => [x.ticker, x.excluded, x.held_c])).toEqual([['A', 'opposite_position', 100], ['B', 'opposite_position', -50]]);
        expect(r.resting).toBe(0);
    });

    it('count_c stays the S target; held on the quote side reduces only the reserve', () => {
        const r = admit({
            basketDate: DATE,
            legs: [leg('A', { p0: 4 }), leg('B', { p0: 4 }), leg('C', { p0: 4 })],
            positions: new Map([['A', -100], ['B', -40]]),
            cashC: 100_000, s: 1,
        });
        expect(r.rows.map((x) => [x.ticker, x.admitted, x.count_c])).toEqual([['A', true, 100], ['B', true, 100], ['C', true, 100]]);
        expect(r.usedC).toBeCloseTo(76 * 0.6 + 76, 9);
        expect(r.resting).toBe(2);
    });

    it('at most one NO-cheap leg per mutually exclusive event, by seeded draw; a held one keeps its place', () => {
        const ev = (t: string) => leg(t, { event: 'EV1', cheap: 'no', p0: 5 });
        const input = [ev('N1'), ev('N2'), ev('N3'), leg('Y1', { event: 'EV1' }), leg('Y2', { event: 'EV1' })];
        const r = admit({ basketDate: DATE, legs: input, positions: new Map(), cashC: 100_000, s: 1 });
        const kept = r.rows.filter((x) => x.cheap_side === 'no' && x.admitted).map((x) => x.ticker);
        const winner = ['N1', 'N2', 'N3'].reduce((m, t) => (rationU(DATE, t) < rationU(DATE, m) ? t : m));
        expect(kept).toEqual([winner]);
        expect(r.rows.filter((x) => x.excluded === 'no_cheap_dup')).toHaveLength(2);
        expect(r.rows.filter((x) => x.cheap_side === 'yes').every((x) => x.admitted)).toBe(true);

        const loser = ['N1', 'N2', 'N3'].find((t) => t !== winner)!;
        const held = admit({ basketDate: DATE, legs: input, positions: new Map([[loser, 100]]), cashC: 100_000, s: 1 });
        expect(held.rows.filter((x) => x.cheap_side === 'no' && x.admitted).map((x) => x.ticker)).toEqual([loser]);
    });

    it('several NO-cheap legs are fine in a non-mutually-exclusive event', () => {
        const input = ['N1', 'N2'].map((t) => leg(t, { event: 'EV2', cheap: 'no', p0: 5, me: false }));
        const r = admit({ basketDate: DATE, legs: input, positions: new Map(), cashC: 100_000, s: 1 });
        expect(r.rows.every((x) => x.admitted)).toBe(true);
    });

    it('rule exclusions pass through; unknown cash skips the budget', () => {
        const thin = leg('T');
        thin.features.tradesPerDay7d = 1;
        thin.rule = applyRule(thin.features);
        const r = admit({ basketDate: DATE, legs: [thin, ...legs(5)], positions: new Map(), cashC: null, s: 1 });
        expect(r.rows[0]).toMatchObject({ admitted: false, excluded: 'thin', quote_price_c: 76 });
        expect(r.budgetC).toBeNull();
        expect(r.rows.filter((x) => x.admitted)).toHaveLength(5);
    });

    it('a tape_failed ticker is excluded whatever its stored tape says, and reserves nothing', () => {
        const input = legs(5);
        const r = admit({ basketDate: DATE, legs: input, positions: new Map(), cashC: 100_000, s: 1, tapeFailed: new Set(['KXT-2']) });
        expect(r.rows.find((x) => x.ticker === 'KXT-2')).toMatchObject({ admitted: false, excluded: 'tape_failed' });
        expect(r.rows.filter((x) => x.admitted)).toHaveLength(4);
        expect(r.resting).toBe(4);
        expect(r.usedC).toBe(reserved(r.rows));
    });
});

describe('valid_until stagger', () => {
    const floor = Date.parse('2026-10-15T02:00:00Z');
    const tickers = Array.from({ length: 2000 }, (_, i) => `KXT-${i}`);

    it('expiryU is sha256-seeded on its own salt and matches the Python reference', () => {
        expect(expiryU('2026-10-14', 'KXTEST-A')).toBe(0.5968244419441113);
        expect(expiryU('2026-10-14', 'KXNBATEAM-26-LBJ')).toBe(0.7282345517000941);
        expect(expiryU(DATE, 'KXTEST-A')).not.toBe(rationU(DATE, 'KXTEST-A'));
    });

    it('lands in [basket_date + 26 h, + 28 h) on whole seconds, never below the floor', () => {
        const ms = tickers.map((t) => Date.parse(validUntil(DATE, t)));
        expect(Math.min(...ms)).toBeGreaterThanOrEqual(floor);
        expect(Math.max(...ms)).toBeLessThan(floor + 2 * 3_600_000);
        expect(ms.every((x) => x % 1000 === 0)).toBe(true);
        expect(validUntil(DATE, 'KXTEST-A')).toBe(new Date(floor + Math.floor(0.5968244419441113 * 7200) * 1000).toISOString());
    });

    it('is reproducible, spread across the window, and independent of ration_u', () => {
        expect(tickers.map((t) => validUntil(DATE, t))).toEqual(tickers.map((t) => validUntil(DATE, t)));
        const quarters = [0, 0, 0, 0];
        for (const t of tickers) quarters[Math.floor(expiryU(DATE, t) * 4)]++;
        for (const q of quarters) expect(q).toBeGreaterThan(400);
        const n = tickers.length;
        const [x, y] = [tickers.map((t) => rationU(DATE, t)), tickers.map((t) => expiryU(DATE, t))];
        const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / n;
        const [mx, my] = [mean(x), mean(y)];
        const cov = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0) / n;
        expect(Math.abs(cov / (1 / 12))).toBeLessThan(0.1);
    });
});
