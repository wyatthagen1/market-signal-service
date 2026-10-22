import { z } from 'zod';
import { getSupabase } from './client';

/** One origin reference. received_at is our clock (when we fetched the input); the upstream
 *  "posted" time is looked up through ref. */
export const TraceInputSchema = z.object({
    source: z.string(),
    ref: z.string().nullable(),
    received_at: z.string().nullable(),
});
export type TraceInput = z.infer<typeof TraceInputSchema>;

/** Trace root (engineering.signal_pushes, platform migration 20261022120000): one row per
 *  push. Spans are the router's engineering.router_logs rows. */
export const SignalPushSchema = z.object({
    trace_id: z.guid(),
    producer: z.string(),
    msg_type: z.literal('signal'),
    store_type: z.string(),
    row_count: z.number().int(),
    built_at: z.string(),
    sent_at: z.string(),
    inputs: z.array(TraceInputSchema),
    payload: z.unknown(),
});
export type SignalPush = z.infer<typeof SignalPushSchema>;

const table = () => getSupabase().schema('engineering').from('signal_pushes');

/** Never throws: tracing must not fail the push it describes. */
export async function recordRoot(root: SignalPush): Promise<void> {
    try {
        const { error } = await table().insert(SignalPushSchema.parse(root));
        if (error) console.warn(`[signal-pushes] root write failed: ${error.message}`);
    } catch (err) {
        console.warn(`[signal-pushes] root write threw: ${err}`);
    }
}

/** Best-effort send error on the root, once every attempt failed; per-sleeve outcomes live on the spans. */
export async function recordRootError(traceId: string, message: string): Promise<void> {
    try {
        const { error } = await table().update({ error: message.slice(0, 500) }).eq('trace_id', traceId);
        if (error) console.warn(`[signal-pushes] error write failed: ${error.message}`);
    } catch (err) {
        console.warn(`[signal-pushes] error write threw: ${err}`);
    }
}
