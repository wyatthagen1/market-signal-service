/**
 * Signal delivery to the trading fleet, via the signal router. The router fans one
 * envelope out to every healthy sleeve, so a producer addresses the fleet rather than
 * a URL list; a sleeve that has not loaded the store answers a benign 2xx.
 */

import { recordRoot, recordRootError, type TraceInput } from '../db/signal-pushes';
import { newTraceId, traceparentFor } from '../utils/traceparent';

/** Store keys this repo publishes; must match the trading platform's StoreKey. */
export type StoreType = 'sweep_basket';

const PUSH_TIMEOUT_MS = 10_000;
const DEFAULT_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2_000;

/**
 * Publish one store's rows through the signal router (`POST {SIGNAL_ROUTER_URL}/signals`).
 *
 * Retries non-2xx and network failures up to `attempts` times, then throws, so a run-once
 * cron exits non-zero. Throws immediately if the router env vars are unset. No-op on empty rows.
 *
 * Every push is traced (vault PRD "Signal Delivery Tracing"): a root row in
 * engineering.signal_pushes written beside the first attempt, and a traceparent header per
 * attempt (one trace, a span per retry). The root's error is set only when every attempt failed.
 */
export async function postSignal(
    storeType: StoreType,
    rows: unknown[],
    trace: { producer: string; inputs: TraceInput[]; builtAt?: Date },
    { attempts = DEFAULT_ATTEMPTS, retryDelayMs = RETRY_DELAY_MS }: { attempts?: number; retryDelayMs?: number } = {},
): Promise<void> {
    if (rows.length === 0) return;
    const baseUrl = (process.env.SIGNAL_ROUTER_URL ?? '').trim().replace(/\/$/, '');
    const apiKey = process.env.SIGNAL_ROUTER_API_KEY;
    if (!baseUrl || !apiKey) {
        throw new Error(`SIGNAL_ROUTER_URL / SIGNAL_ROUTER_API_KEY not set — cannot push ${storeType} signals`);
    }

    const traceId = newTraceId();
    const sentAt = new Date().toISOString();
    const rootWrite = recordRoot({
        trace_id: traceId,
        producer: trace.producer,
        msg_type: 'signal',
        store_type: storeType,
        row_count: rows.length,
        built_at: (trace.builtAt ?? new Date(sentAt)).toISOString(),
        sent_at: sentAt,
        inputs: trace.inputs,
        payload: rows,
    });

    const url = `${baseUrl}/signals`;
    let lastError = '';
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, traceparent: traceparentFor(traceId) },
                body: JSON.stringify({ type: 'signal', storeType, data: rows }),
                // A router that accepts the connection but never responds would otherwise hang
                // the cron run past its next tick with restartPolicyType="never".
                signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
            });
            // The router answers 500 with a per-sleeve breakdown on a partial fan-out; surface it verbatim.
            const body = await res.text();
            if (res.ok) {
                console.log(`signal router: pushed ${rows.length} ${storeType} rows (trace ${traceId}) — ${body}`);
                await rootWrite;
                return;
            }
            lastError = `${res.status} — ${body}`;
        } catch (err) {
            lastError = `network error or timeout — ${err}`;
        }
        console.warn(`signal router: ${storeType} push attempt ${attempt}/${attempts} failed (${lastError})`);
        if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
    }
    await rootWrite;
    await recordRootError(traceId, lastError);
    throw new Error(`signal router: ${storeType} push failed after ${attempts} attempts (${lastError})`);
}
