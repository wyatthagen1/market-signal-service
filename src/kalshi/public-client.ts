import { createPrivateKey, createSign, constants, KeyObject } from 'crypto';
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

const CUTOFF_PATH = '/trade-api/v2/historical/cutoff';

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
    /** Signs every request when set; pacing is unchanged either way. */
    auth?: KalshiReadAuth | null;
}

/** A dedicated read-only key for this service; never the trader's. */
export interface KalshiReadAuth {
    keyId: string;
    privateKey: KeyObject;
}

/**
 * KALSHI_READ_API_KEY_ID plus KALSHI_READ_PRIVATE_KEY_PEM (literal `\n` allowed) or
 * KALSHI_READ_PRIVATE_KEY_BASE64. Null unless both halves are set. Throws on an unparsable
 * key, so a bad secret fails at startup rather than on every request.
 */
export function loadReadAuthFromEnv(env: NodeJS.ProcessEnv): KalshiReadAuth | null {
    const keyId = env.KALSHI_READ_API_KEY_ID?.trim();
    const pem = env.KALSHI_READ_PRIVATE_KEY_PEM
        ? env.KALSHI_READ_PRIVATE_KEY_PEM.replace(/\\n/g, '\n')
        : env.KALSHI_READ_PRIVATE_KEY_BASE64
            ? Buffer.from(env.KALSHI_READ_PRIVATE_KEY_BASE64, 'base64').toString('utf-8')
            : null;
    if (!keyId || !pem) return null;
    return { keyId, privateKey: createPrivateKey(pem) };
}

/**
 * Kalshi's request signature: RSA-PSS SHA-256 (salt = digest length) over
 * `timestamp + method + path`, base64. `path` is the URL path including `/trade-api/v2`,
 * without the query string. Ported from the trading platform's auth-request-utils.
 */
export function kalshiAuthHeaders(auth: KalshiReadAuth, method: string, path: string, nowMs = Date.now()): Record<string, string> {
    const timestamp = String(nowMs);
    const sign = createSign('RSA-SHA256');
    sign.update(timestamp + method + path);
    sign.end();
    const signature = sign.sign({ key: auth.privateKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: constants.RSA_PSS_SALTLEN_DIGEST });
    return {
        'KALSHI-ACCESS-KEY': auth.keyId,
        'KALSHI-ACCESS-SIGNATURE': signature.toString('base64'),
        'KALSHI-ACCESS-TIMESTAMP': timestamp,
    };
}

/** A non-429 4xx: auth or request misconfiguration, never retried. */
export class KalshiClientError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
    }
}

/** 429 / 5xx / network errors persisted through every attempt. */
export class KalshiRetriesExhaustedError extends Error {}

/** Paced client for Kalshi's public trade tape; signed when given `auth`. */
export class KalshiPublicClient {
    private readonly baseUrl: string;
    private readonly pacer: Pacer;
    private readonly fetchImpl: typeof fetch;
    private readonly maxAttempts: number;
    private readonly backoffMs: number;
    private readonly auth: KalshiReadAuth | null;

    constructor(opts: KalshiPublicClientOptions = {}) {
        this.baseUrl = (opts.baseUrl ?? KALSHI_PUBLIC_BASE_URL).replace(/\/$/, '');
        this.pacer = opts.pacer ?? kalshiPublicPacer;
        this.fetchImpl = opts.fetchImpl ?? ((...args) => fetch(...args));
        this.maxAttempts = opts.maxAttempts ?? 5;
        this.backoffMs = opts.backoffMs ?? 1_000;
        this.auth = opts.auth ?? null;
    }

    get signed(): boolean {
        return this.auth !== null;
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

    /** The boundary below which trades exist only on `historical` (`trades_created_ts`). */
    async getHistoricalTradesCutoff(): Promise<Date> {
        const body = (await this.getJson(`${this.baseUrl}${CUTOFF_PATH}`)) as { trades_created_ts?: unknown };
        const cutoff = typeof body?.trades_created_ts === 'string' ? new Date(body.trades_created_ts) : null;
        if (!cutoff || Number.isNaN(cutoff.getTime())) throw new Error(`historical cutoff: unexpected body ${JSON.stringify(body).slice(0, 200)}`);
        return cutoff;
    }

    /**
     * GETs JSON, retrying 429/5xx/network errors with exponential backoff (Retry-After
     * honoured); throws KalshiRetriesExhaustedError once attempts run out. Any other status
     * throws KalshiClientError at once.
     */
    private async getJson(url: string): Promise<unknown> {
        let lastError = '';
        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            await this.pacer.wait();
            let retryAfterMs: number | undefined;
            const headers: Record<string, string> = { Accept: 'application/json' };
            if (this.auth) Object.assign(headers, kalshiAuthHeaders(this.auth, 'GET', new URL(url).pathname));
            try {
                const res = await this.fetchImpl(url, {
                    headers,
                    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
                });
                if (res.ok) return await res.json();
                const body = await res.text();
                if (res.status !== 429 && res.status < 500) {
                    throw new KalshiClientError(res.status, `Kalshi GET ${url} failed (${res.status}): ${body.slice(0, 500)}`);
                }
                lastError = `${res.status}: ${body.slice(0, 200)}`;
                const retryAfter = Number(res.headers.get('retry-after'));
                if (Number.isFinite(retryAfter) && retryAfter > 0) retryAfterMs = retryAfter * 1000;
            } catch (err) {
                if (err instanceof KalshiClientError) throw err;
                lastError = String(err);
            }
            if (attempt < this.maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, retryAfterMs ?? this.backoffMs * 2 ** (attempt - 1)));
            }
        }
        throw new KalshiRetriesExhaustedError(`Kalshi GET ${url} failed after ${this.maxAttempts} attempts (${lastError})`);
    }
}
