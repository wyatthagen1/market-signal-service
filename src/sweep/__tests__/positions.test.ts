import { foldByTicker, foldFillsToPosition, LedgerFill } from '../positions';

let id = 0;
const fill = (side: 'yes' | 'no', action: 'buy' | 'sell', countC: number, price: number, over: Partial<LedgerFill> = {}): LedgerFill => ({
    id: ++id, policy_id: 1, market_ticker: 'KXT-A', side, action, count: null, count_hundredths: countC,
    price_cents: price, fee_cents: 0, fee_centicents: 0, event_ts: new Date(1_700_000_000_000 + id), ...over,
});

describe('foldFillsToPosition (port of the platform fold)', () => {
    it('buy YES is +, buy NO is −; sell NO folds like buy YES', () => {
        expect(foldFillsToPosition([fill('yes', 'buy', 100, 30)])?.netPosC).toBe(100);
        expect(foldFillsToPosition([fill('no', 'buy', 100, 76)])?.netPosC).toBe(-100);
        expect(foldFillsToPosition([fill('no', 'buy', 100, 76), fill('no', 'sell', 40, 80)])?.netPosC).toBe(-60);
    });

    it('nets YES against NO into one signed position, flat → undefined', () => {
        expect(foldFillsToPosition([fill('no', 'buy', 100, 76), fill('yes', 'buy', 100, 25)])).toBeUndefined();
        const crossed = foldFillsToPosition([fill('no', 'buy', 100, 76), fill('yes', 'buy', 150, 25)]);
        expect(crossed).toEqual({ netPosC: 50, positionCostC: 25 * 50, feesPaidC: 0 });
    });

    it('reduces cost at the running unit cost and falls back to legacy count/fee columns', () => {
        const pos = foldFillsToPosition([
            fill('no', 'buy', 0, 70, { count_hundredths: null, count: 2, fee_centicents: null, fee_cents: 1 }),
            fill('yes', 'buy', 50, 40),
        ]);
        expect(pos).toEqual({ netPosC: -150, positionCostC: 70 * 150, feesPaidC: 100 });
    });

    it('folds per ticker', () => {
        const m = foldByTicker([fill('no', 'buy', 100, 76), fill('yes', 'buy', 100, 4, { market_ticker: 'KXT-B' })]);
        expect([...m]).toEqual([['KXT-A', -100], ['KXT-B', 100]]);
    });
});
