import liveFixture from '../__fixtures__/markets-trades.live.json';
import { Pacer } from '../pacer';
import { createVerify, constants, generateKeyPairSync } from 'crypto';
import { KalshiClientError, KalshiPublicClient, KalshiRetriesExhaustedError, loadReadAuthFromEnv } from '../public-client';

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
        for (const status of [400, 401, 403]) {
            const fetchImpl = jest.fn().mockImplementation(async () => json({ error: 'nope' }, status));
            const err = await client(fetchImpl).fetchTrades({}).catch((e) => e);
            expect(err).toBeInstanceOf(KalshiClientError);
            expect(err.status).toBe(status);
            expect(fetchImpl).toHaveBeenCalledTimes(1);
        }
    });

    it('gives up after maxAttempts', async () => {
        const fetchImpl = jest.fn().mockImplementation(async () => json({}, 503));

        const err = await client(fetchImpl).fetchTrades({}).catch((e) => e);
        expect(err).toBeInstanceOf(KalshiRetriesExhaustedError);
        expect(err.message).toMatch(/after 5 attempts/);
        expect(fetchImpl).toHaveBeenCalledTimes(5);
    });

    it('waits Retry-After seconds when given, else backs off exponentially', async () => {
        const real = global.setTimeout;
        const waits: number[] = [];
        const spy = jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
            waits.push(ms ?? 0);
            return real(fn, 0);
        }) as typeof setTimeout);
        try {
            const fetchImpl = jest.fn()
                .mockResolvedValueOnce(json({}, 429, { 'retry-after': '3' }))
                .mockResolvedValueOnce(json({}, 429))
                .mockResolvedValueOnce(json({}, 502))
                .mockResolvedValueOnce(json({ trades: [], cursor: '' }));
            const c = new KalshiPublicClient({ fetchImpl: fetchImpl as unknown as typeof fetch, pacer: new Pacer(0), backoffMs: 1000 });
            await c.fetchTrades({});
        } finally {
            spy.mockRestore();
        }
        expect(waits.filter((ms) => ms >= 1000)).toEqual([3000, 2000, 4000]);
    });
});

describe('signed requests', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    it('stays unsigned unless both the key id and a key are set', () => {
        expect(loadReadAuthFromEnv({})).toBeNull();
        expect(loadReadAuthFromEnv({ KALSHI_READ_API_KEY_ID: 'k' })).toBeNull();
        expect(loadReadAuthFromEnv({ KALSHI_READ_PRIVATE_KEY_PEM: pem })).toBeNull();
        expect(loadReadAuthFromEnv({ KALSHI_READ_API_KEY_ID: 'k', KALSHI_READ_PRIVATE_KEY_PEM: pem.replace(/\n/g, '\\n') })).not.toBeNull();
        expect(loadReadAuthFromEnv({ KALSHI_READ_API_KEY_ID: 'k', KALSHI_READ_PRIVATE_KEY_BASE64: Buffer.from(pem).toString('base64') })).not.toBeNull();
        expect(() => loadReadAuthFromEnv({ KALSHI_READ_API_KEY_ID: 'k', KALSHI_READ_PRIVATE_KEY_PEM: 'garbage' })).toThrow();
    });

    it('signs timestamp + GET + the /trade-api/v2 path without the query, RSA-PSS SHA-256', async () => {
        const fetchImpl = jest.fn().mockResolvedValue(json({ trades: [], cursor: '' }));
        const c = new KalshiPublicClient({
            fetchImpl: fetchImpl as unknown as typeof fetch, pacer: new Pacer(0),
            auth: loadReadAuthFromEnv({ KALSHI_READ_API_KEY_ID: 'read-key', KALSHI_READ_PRIVATE_KEY_PEM: pem }),
        });
        expect(c.signed).toBe(true);

        await c.fetchTrades({ ticker: 'KXTEST-1', minTs: 100 });

        const headers = fetchImpl.mock.calls[0][1].headers as Record<string, string>;
        expect(headers['KALSHI-ACCESS-KEY']).toBe('read-key');
        const verify = createVerify('RSA-SHA256');
        verify.update(`${headers['KALSHI-ACCESS-TIMESTAMP']}GET/trade-api/v2/markets/trades`);
        expect(verify.verify(
            { key: publicKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: constants.RSA_PSS_SALTLEN_DIGEST },
            headers['KALSHI-ACCESS-SIGNATURE'], 'base64',
        )).toBe(true);
    });

    it('sends no auth headers without a key', async () => {
        const fetchImpl = jest.fn().mockResolvedValue(json({ trades: [], cursor: '' }));
        const c = client(fetchImpl);
        expect(c.signed).toBe(false);
        await c.fetchTrades({});
        expect(Object.keys(fetchImpl.mock.calls[0][1].headers)).toEqual(['Accept']);
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
