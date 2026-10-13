import { kalshiPublicPacer, Pacer } from './pacer';
import { parseTradesPage, Trade } from './trades';

export const KALSHI_PUBLIC_BASE_URL = 'https://api.elections.kalshi.com';

/**
 * `live` keeps roughly the last two months; older trades are only on `historical`
 * (as of 2026-10-13 its newest trade was 2026-08-13). Callers pick the source by date.
 */
export type TradesSource = 'live' | 'historical';

const TRADES_PATH: Record<TradesSource, string> = {
    live: '/trade-api/v2/markets/trades',
    historical: '/trade-api/v2/historical/trades',
};

const PAGE_LIMIT = 1000;
const REQUEST_TIMEOUT_MS = 20_000;

export interface TradesQuery {
    ticker?: string;
    /** Unix seconds, inclusive. */
    minTs?: number;
    /** Unix seconds, inclusive. */
    maxTs?: number;
    source?: TradesSource;
}

export interface KalshiPublicClientOptions {
    baseUrl?: string;
    pacer?: Pacer;
    fetchImpl?: typeof fetch;
    maxAttempts?: number;
    backoffMs?: number;
}

/** Unauthenticated, paced client for Kalshi's public trade tape. */
export class KalshiPublicClient {
    private readonly baseUrl: string;
    private readonly pacer: Pacer;
    private readonly fetchImpl: typeof fetch;
    private readonly maxAttempts: number;
    private readonly backoffMs: number;

    constructor(opts: KalshiPublicClientOptions = {}) {
        this.baseUrl = (opts.baseUrl ?? KALSHI_PUBLIC_BASE_URL).replace(/\/$/, '');
        this.pacer = opts.pacer ?? kalshiPublicPacer;
        this.fetchImpl = opts.fetchImpl ?? ((...args) => fetch(...args));
        this.maxAttempts = opts.maxAttempts ?? 5;
        this.backoffMs = opts.backoffMs ?? 1_000;
    }

    /** Fetches one page of trades, newest first. A null cursor means no further pages. */
    async getTradesPage(query: TradesQuery, cursor?: string): Promise<{ trades: Trade[]; cursor: string | null }> {
        const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
        if (query.ticker) params.set('ticker', query.ticker);
        if (query.minTs !== undefined) params.set('min_ts', String(query.minTs));
        if (query.maxTs !== undefined) params.set('max_ts', String(query.maxTs));
        if (cursor) params.set('cursor', cursor);
        const url = `${this.baseUrl}${TRADES_PATH[query.source ?? 'live']}?${params}`;
        return parseTradesPage(await this.getJson(url));
    }

    /** Fetches every page for the query. */
    async fetchTrades(query: TradesQuery): Promise<Trade[]> {
        const all: Trade[] = [];
        let cursor: string | null = null;
        do {
            const page: { trades: Trade[]; cursor: string | null } = await this.getTradesPage(query, cursor ?? undefined);
            all.push(...page.trades);
            cursor = page.trades.length > 0 ? page.cursor : null;
        } while (cursor);
        return all;
    }

    /** GETs JSON, retrying 429/5xx/network errors with exponential backoff (Retry-After honoured). Other statuses throw. */
    private async getJson(url: string): Promise<unknown> {
        let lastError = '';
        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            await this.pacer.wait();
            let retryAfterMs: number | undefined;
            try {
                const res = await this.fetchImpl(url, {
                    headers: { Accept: 'application/json' },
                    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                });
                if (res.ok) return await res.json();
                const body = await res.text();
                if (res.status !== 429 && res.status < 500) {
                    throw new NonRetryableError(`Kalshi GET ${url} failed (${res.status}): ${body.slice(0, 500)}`);
                }
                lastError = `${res.status}: ${body.slice(0, 200)}`;
                const retryAfter = Number(res.headers.get('retry-after'));
                if (Number.isFinite(retryAfter) && retryAfter > 0) retryAfterMs = retryAfter * 1000;
            } catch (err) {
                if (err instanceof NonRetryableError) throw err;
                lastError = String(err);
            }
            if (attempt < this.maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, retryAfterMs ?? this.backoffMs * 2 ** (attempt - 1)));
            }
        }
        throw new Error(`Kalshi GET ${url} failed after ${this.maxAttempts} attempts (${lastError})`);
    }
}

class NonRetryableError extends Error {}
