import { recordRoot, recordRootError } from '../../db/signal-pushes';
import { postSignal } from '../post-signal';

jest.mock('../../db/signal-pushes', () => ({
    recordRoot: jest.fn(async () => {}),
    recordRootError: jest.fn(async () => {}),
}));

const TRACE = { producer: 'sweep-basket', inputs: [{ source: 'kalshi_tape', ref: '2026-10-22', received_at: '2026-10-22T09:00:00.000Z' }] };
const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-01$/;

const ENV = { ...process.env };

function response(status: number, body = 'ok'): Response {
    return new Response(body, { status });
}

describe('postSignal', () => {
    let fetchMock: jest.Mock;

    beforeEach(() => {
        process.env.SIGNAL_ROUTER_URL = 'https://router.example/ ';
        process.env.SIGNAL_ROUTER_API_KEY = 'test-key';
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.mocked(recordRoot).mockClear();
        jest.mocked(recordRootError).mockClear();
    });

    afterEach(() => {
        process.env = { ...ENV };
        jest.restoreAllMocks();
    });

    it('posts the signal envelope to {SIGNAL_ROUTER_URL}/signals with the api key', async () => {
        fetchMock.mockResolvedValueOnce(response(200));
        const rows = [{ ticker: 'KXTEST-1', quote_price_c: 30 }];

        await postSignal('sweep_basket', rows, TRACE);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://router.example/signals');
        expect(init.method).toBe('POST');
        expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'x-api-key': 'test-key', traceparent: expect.stringMatching(TRACEPARENT) });
        expect(JSON.parse(init.body)).toEqual({ type: 'signal', storeType: 'sweep_basket', data: rows });
    });

    it('retries a failed push and succeeds', async () => {
        fetchMock.mockResolvedValueOnce(response(500, 'sleeve 13: down')).mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce(response(200));

        await postSignal('sweep_basket', [{}], TRACE, { retryDelayMs: 0 });

        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('throws after exhausting attempts', async () => {
        fetchMock.mockImplementation(async () => response(500, 'sleeve 13: down'));

        await expect(postSignal('sweep_basket', [{}], TRACE, { retryDelayMs: 0 })).rejects.toThrow(/after 3 attempts \(500 — sleeve 13: down\)/);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('throws without calling fetch when router config is missing', async () => {
        delete process.env.SIGNAL_ROUTER_API_KEY;

        await expect(postSignal('sweep_basket', [{}], TRACE)).rejects.toThrow(/SIGNAL_ROUTER_API_KEY not set/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('is a no-op for empty rows', async () => {
        await postSignal('sweep_basket', [], TRACE);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    describe('trace root', () => {
        const traceparents = () => fetchMock.mock.calls.map(([, init]) => init.headers.traceparent as string);

        it('writes one root whose id is the header trace id', async () => {
            fetchMock.mockResolvedValueOnce(response(200));
            const rows = [{ ticker: 'KXTEST-1' }];

            await postSignal('sweep_basket', rows, { ...TRACE, builtAt: new Date('2026-10-22T09:01:00Z') });

            expect(recordRoot).toHaveBeenCalledTimes(1);
            const root = jest.mocked(recordRoot).mock.calls[0][0];
            expect(root).toMatchObject({
                producer: 'sweep-basket', msg_type: 'signal', store_type: 'sweep_basket', row_count: 1,
                built_at: '2026-10-22T09:01:00.000Z', inputs: TRACE.inputs, payload: rows,
            });
            expect(TRACEPARENT.exec(traceparents()[0])![1]).toBe(root.trace_id.replace(/-/g, ''));
            expect(recordRootError).not.toHaveBeenCalled();
        });

        it('keeps one trace across retries with a new span per attempt, and no error once one succeeds', async () => {
            fetchMock.mockResolvedValueOnce(response(500, 'down')).mockResolvedValueOnce(response(200));

            await postSignal('sweep_basket', [{}], TRACE, { retryDelayMs: 0 });

            const [first, second] = traceparents().map((tp) => TRACEPARENT.exec(tp)!);
            expect(second[1]).toBe(first[1]);
            expect(second[2]).not.toBe(first[2]);
            expect(recordRoot).toHaveBeenCalledTimes(1);
            expect(recordRootError).not.toHaveBeenCalled();
        });

        it('records the last error after the root lands, once every attempt failed', async () => {
            const order: string[] = [];
            jest.mocked(recordRoot).mockImplementationOnce(async () => { await new Promise((r) => setTimeout(r, 5)); order.push('root'); });
            jest.mocked(recordRootError).mockImplementationOnce(async () => { order.push('error'); });
            fetchMock.mockImplementation(async () => response(503, 'no healthy sleeve'));

            await expect(postSignal('sweep_basket', [{}], TRACE, { retryDelayMs: 0 })).rejects.toThrow(/after 3 attempts/);

            const traceId = jest.mocked(recordRoot).mock.calls[0][0].trace_id;
            expect(recordRootError).toHaveBeenCalledWith(traceId, '503 — no healthy sleeve');
            expect(order).toEqual(['root', 'error']);
        });

        it('writes no root when there is nothing to push or no router config', async () => {
            await postSignal('sweep_basket', [], TRACE);
            delete process.env.SIGNAL_ROUTER_URL;
            await expect(postSignal('sweep_basket', [{}], TRACE)).rejects.toThrow(/not set/);
            expect(recordRoot).not.toHaveBeenCalled();
        });
    });
});
