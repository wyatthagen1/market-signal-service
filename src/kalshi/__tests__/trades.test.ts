import liveFixture from '../__fixtures__/markets-trades.live.json';
import historicalFixture from '../__fixtures__/historical-trades.live.json';
import { normalizeTrade, parseTradesPage, RawTradeSchema } from '../trades';

describe('parseTradesPage on real public responses (captured 2026-10-13)', () => {
    it('parses every trade on the /markets/trades page', () => {
        const page = parseTradesPage(liveFixture);

        expect(page.trades).toHaveLength(liveFixture.trades.length);
        expect(page.cursor).toBe(liveFixture.cursor);
        expect(page.trades[0]).toEqual({
            tradeId: '0725ed22-1bc1-9f24-f7da-6746def1066b',
            ticker: 'KXMLBGAME-26OCT132000CLETB-TB',
            createdAt: new Date('2026-10-13T20:01:42.723333Z'),
            yesPriceCents: 56,
            countHundredths: 9600,
            takerSide: 'yes',
            isBlockTrade: false,
        });
    });

    it('parses the /historical/trades page, which shares the live shape', () => {
        const page = parseTradesPage(historicalFixture);

        expect(page.trades).toHaveLength(historicalFixture.trades.length);
        expect(page.trades[0]).toMatchObject({
            tradeId: 'fa8d8c05-cb71-731f-2a16-6f1e55eae0a5',
            yesPriceCents: 65,
            countHundredths: 7,
        });
    });

    it('pins the live wire keys', () => {
        const keys = new Set(liveFixture.trades.flatMap((t) => Object.keys(t)));
        expect([...keys].sort()).toEqual([
            'count_fp',
            'created_time',
            'is_block_trade',
            'no_price_dollars',
            'taker_book_side',
            'taker_outcome_side',
            'taker_side',
            'ticker',
            'trade_id',
            'yes_price_dollars',
        ]);
    });

    it('tolerates an unknown extra key', () => {
        const withExtra = { ...liveFixture, trades: liveFixture.trades.map((t) => ({ ...t, some_future_field: 42 })) };
        expect(parseTradesPage(withExtra).trades).toHaveLength(liveFixture.trades.length);
    });

    it('rejects the page when a trade is malformed instead of dropping it', () => {
        const { count_fp: _, ...missingCount } = liveFixture.trades[0];
        expect(() => parseTradesPage({ trades: [missingCount], cursor: '' })).toThrow();
    });

    it('treats an empty cursor as the last page', () => {
        expect(parseTradesPage({ trades: [], cursor: '' }).cursor).toBeNull();
    });
});

describe('normalizeTrade', () => {
    const base = RawTradeSchema.parse({
        trade_id: 't1',
        ticker: 'KXTEST-1',
        count_fp: '12.34',
        yes_price_dollars: '0.0150',
        created_time: '2026-10-13T00:00:00Z',
        taker_side: 'no',
    });

    it('keeps sub-cent prices and fractional counts', () => {
        expect(normalizeTrade(base)).toMatchObject({ yesPriceCents: 1.5, countHundredths: 1234, takerSide: 'no', isBlockTrade: false });
    });

    it('prefers taker_outcome_side over the deprecated taker_side', () => {
        expect(normalizeTrade({ ...base, taker_outcome_side: 'yes' }).takerSide).toBe('yes');
    });

    it('requires one of taker_outcome_side / taker_side', () => {
        const { taker_side: _, ...noSide } = base;
        expect(() => RawTradeSchema.parse(noSide)).toThrow();
    });

    it('throws on a non-numeric price', () => {
        expect(() => normalizeTrade({ ...base, yes_price_dollars: 'abc' })).toThrow(/yes_price_dollars/);
    });
});
