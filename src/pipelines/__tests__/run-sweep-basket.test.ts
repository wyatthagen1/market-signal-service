import { parseArgs, pushBasket, PUSH_CHUNK } from '../run-sweep-basket';
import { SweepBasketRow } from '../../sweep/basket';

jest.mock('../../db/signal-pushes', () => ({
    recordRoot: jest.fn(async () => {}),
    recordRootError: jest.fn(async () => {}),
}));

const TRACE = { builtAt: new Date('2026-10-14T09:00:00Z'), inputs: [{ source: 'kalshi_tape', ref: '2026-10-14', received_at: '2026-10-14T08:59:00.000Z' }] };

const rows = (n: number): SweepBasketRow[] => Array.from({ length: n }, (_, i) => ({
    ticker: `KXT-${i}`, event_ticker: 'EV', basket_date: '2026-10-14', cheap_side: 'yes', quote_side: 'no',
    quote_price_c: 76, count_c: 100, valid_until: '2026-10-15T02:00:00.000Z',
}));

describe('pushBasket', () => {
    const env = process.env;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        process.env = { ...env, SIGNAL_ROUTER_URL: 'https://router.test', SIGNAL_ROUTER_API_KEY: 'k' };
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        process.env = env;
        jest.restoreAllMocks();
    });

    it('chunks the push and sends the sweep_basket envelope', async () => {
        fetchMock.mockImplementation(async () => new Response('{"delivered":1}', { status: 200 }));
        await pushBasket(rows(PUSH_CHUNK + 1), TRACE);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const bodies = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body));
        expect(bodies.map((b) => [b.type, b.storeType, b.data.length])).toEqual([['signal', 'sweep_basket', PUSH_CHUNK], ['signal', 'sweep_basket', 1]]);
        const traceIds = fetchMock.mock.calls.map((c) => c[1].headers.traceparent.split('-')[1]);
        expect(new Set(traceIds).size).toBe(2);
    });

    it('retries a failed chunk, then throws so the run exits 1', async () => {
        const post = jest.fn()
            .mockRejectedValueOnce(new Error('signal router: sweep_basket push failed after 3 attempts'));
        await expect(pushBasket(rows(3), TRACE, post)).rejects.toThrow(/after 3 attempts/);

        fetchMock
            .mockResolvedValueOnce(new Response('down', { status: 503 }))
            .mockResolvedValueOnce(new Response('{"delivered":1}', { status: 200 }));
        const { postSignal } = await import('../../router/post-signal');
        await pushBasket(rows(2), TRACE, (store, data, trace) => postSignal(store, data, trace, { retryDelayMs: 0 }));
        expect(fetchMock).toHaveBeenCalledTimes(2);

        fetchMock.mockReset().mockResolvedValue(new Response('down', { status: 503 }));
        await expect(pushBasket(rows(2), TRACE, (store, data, trace) => postSignal(store, data, trace, { retryDelayMs: 0 }))).rejects.toThrow(/failed after 3 attempts/);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
});

describe('parseArgs', () => {
    it('defaults to a live run over policy_markets', () => {
        expect(parseArgs([])).toEqual({ dryRun: false, candidatesFrom: 'policy_markets' });
    });

    it('allows the kalshi_state source only in a dry run', () => {
        expect(parseArgs(['--dry-run', '--candidates-from=kalshi_state'])).toEqual({ dryRun: true, candidatesFrom: 'kalshi_state' });
        expect(() => parseArgs(['--candidates-from=kalshi_state'])).toThrow(/dry-run only/);
        expect(() => parseArgs(['--bogus'])).toThrow(/unknown argument/);
    });
});
