import { recordRoot, recordRootError } from '../signal-pushes';

const insert = jest.fn();
const eq = jest.fn();
const from = jest.fn(() => ({ insert, update: jest.fn(() => ({ eq })) }));

jest.mock('../client', () => ({ getSupabase: jest.fn(() => ({ schema: () => ({ from }) })) }));

const ROOT = {
    trace_id: '0f8fad5b-d9cb-469f-a165-70867728950e', producer: 'sweep-basket', msg_type: 'signal' as const,
    store_type: 'sweep_basket', row_count: 1, built_at: '2026-10-22T09:00:00.000Z', sent_at: '2026-10-22T09:00:01.000Z',
    inputs: [], payload: [{}],
};

describe('signal_pushes roots never throw', () => {
    beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
    afterEach(() => jest.restoreAllMocks());

    it('inserts the root into engineering.signal_pushes', async () => {
        insert.mockResolvedValueOnce({ error: null });
        await recordRoot(ROOT);
        expect(from).toHaveBeenCalledWith('signal_pushes');
        expect(insert).toHaveBeenCalledWith(ROOT);
    });

    it('swallows a rejected insert, an invalid root, and a failed error update', async () => {
        insert.mockRejectedValueOnce(new Error('network'));
        await expect(recordRoot(ROOT)).resolves.toBeUndefined();
        await expect(recordRoot({ ...ROOT, trace_id: 'not-a-uuid' })).resolves.toBeUndefined();
        eq.mockResolvedValueOnce({ error: { message: 'denied' } });
        await expect(recordRootError(ROOT.trace_id, 'x'.repeat(600))).resolves.toBeUndefined();
        expect(console.warn).toHaveBeenCalledTimes(3);
    });
});
