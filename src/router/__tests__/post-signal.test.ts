import { postSignal } from '../post-signal';

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
    });

    afterEach(() => {
        process.env = { ...ENV };
        jest.restoreAllMocks();
    });

    it('posts the signal envelope to {SIGNAL_ROUTER_URL}/signals with the api key', async () => {
        fetchMock.mockResolvedValueOnce(response(200));
        const rows = [{ ticker: 'KXTEST-1', quote_price_c: 30 }];

        await postSignal('sweep_basket', rows);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://router.example/signals');
        expect(init.method).toBe('POST');
        expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'x-api-key': 'test-key' });
        expect(JSON.parse(init.body)).toEqual({ type: 'signal', storeType: 'sweep_basket', data: rows });
    });

    it('retries a failed push and succeeds', async () => {
        fetchMock.mockResolvedValueOnce(response(500, 'sleeve 13: down')).mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce(response(200));

        await postSignal('sweep_basket', [{}], { retryDelayMs: 0 });

        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('throws after exhausting attempts', async () => {
        fetchMock.mockImplementation(async () => response(500, 'sleeve 13: down'));

        await expect(postSignal('sweep_basket', [{}], { retryDelayMs: 0 })).rejects.toThrow(/after 3 attempts \(500 — sleeve 13: down\)/);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('throws without calling fetch when router config is missing', async () => {
        delete process.env.SIGNAL_ROUTER_API_KEY;

        await expect(postSignal('sweep_basket', [{}])).rejects.toThrow(/SIGNAL_ROUTER_API_KEY not set/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('is a no-op for empty rows', async () => {
        await postSignal('sweep_basket', []);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
