import liveFixture from '../__fixtures__/markets-trades.live.json';
import { Pacer } from '../pacer';
import { KalshiPublicClient } from '../public-client';

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function client(fetchImpl: jest.Mock): KalshiPublicClient {
    return new KalshiPublicClient({ fetchImpl: fetchImpl as unknown as typeof fetch, pacer: new Pacer(0), backoffMs: 0 });
}

describe('KalshiPublicClient', () => {
    it('builds the live trades query and follows the cursor to the end', async () => {
        const [a, b] = [liveFixture.trades.slice(0, 2), liveFixture.trades.slice(2, 3)];
        const fetchImpl = jest.fn().mockResolvedValueOnce(json({ trades: a, cursor: 'next' })).mockResolvedValueOnce(json({ trades: b, cursor: '' }));

        const trades = await client(fetchImpl).fetchTrades({ ticker: 'KXTEST-1', minTs: 100, maxTs: 200 });

        expect(trades.map((t) => t.tradeId)).toEqual([...a, ...b].map((t) => t.trade_id));
        const first = new URL(fetchImpl.mock.calls[0][0]);
        expect(first.origin + first.pathname).toBe('https://api.elections.kalshi.com/trade-api/v2/markets/trades');
        expect(Object.fromEntries(first.searchParams)).toEqual({ limit: '1000', ticker: 'KXTEST-1', min_ts: '100', max_ts: '200' });
        expect(new URL(fetchImpl.mock.calls[1][0]).searchParams.get('cursor')).toBe('next');
    });

    it('routes source=historical to /historical/trades', async () => {
        const fetchImpl = jest.fn().mockResolvedValueOnce(json({ trades: [], cursor: '' }));

        await client(fetchImpl).fetchTrades({ source: 'historical' });

        expect(new URL(fetchImpl.mock.calls[0][0]).pathname).toBe('/trade-api/v2/historical/trades');
    });

    it('retries 429 and 5xx, then succeeds', async () => {
        const fetchImpl = jest
            .fn()
            .mockResolvedValueOnce(json({ error: 'rate limited' }, 429, { 'retry-after': '0' }))
            .mockResolvedValueOnce(json({ error: 'bad gateway' }, 502))
            .mockResolvedValueOnce(json({ trades: [], cursor: '' }));

        await expect(client(fetchImpl).fetchTrades({})).resolves.toEqual([]);
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    it('does not retry other 4xx', async () => {
        const fetchImpl = jest.fn().mockImplementation(async () => json({ error: 'bad request' }, 400));

        await expect(client(fetchImpl).fetchTrades({})).rejects.toThrow(/\(400\)/);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('gives up after maxAttempts', async () => {
        const fetchImpl = jest.fn().mockImplementation(async () => json({}, 503));

        await expect(client(fetchImpl).fetchTrades({})).rejects.toThrow(/after 5 attempts/);
        expect(fetchImpl).toHaveBeenCalledTimes(5);
    });
});

describe('Pacer', () => {
    it('spaces consecutive waits by the interval', async () => {
        const pacer = new Pacer(50);
        const start = Date.now();
        await Promise.all([pacer.wait(), pacer.wait(), pacer.wait()]);
        expect(Date.now() - start).toBeGreaterThanOrEqual(95);
    });
});
