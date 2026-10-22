import { randomBytes, randomUUID } from 'crypto';

/** Dashed trace id for a new push; stored in the root row's uuid column (engineering.signal_pushes). */
export const newTraceId = (): string => randomUUID();

/**
 * W3C traceparent "00-<32 hex trace-id>-<16 hex span-id>-01" for one send of a trace. Each
 * retry gets its own span id under the same trace, so the router's delivery rows
 * (engineering.router_logs) for every attempt join back to one root.
 */
export const traceparentFor = (traceId: string): string =>
    `00-${traceId.replace(/-/g, '')}-${randomBytes(8).toString('hex')}-01`;
