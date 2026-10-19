import { readOnlyFetch } from '../../db/client';
import { KalshiClientError, KalshiRetriesExhaustedError, type TradesQuery } from '../../kalshi/public-client';
import type { Trade } from '../../kalshi/trades';
import { pullTape, tapeFailureExceeded, TradeRow, TradesSourceLike } from '../tape';

const START = new Date('2026-10-14T00:00:00Z');
const DAY = 86_400_000;

const trade = (id: string, ticker: string, at: number): Trade => ({
    tradeId: id, ticker, createdAt: new Date(at), yesPriceCents: 4, countHundredths: 100, takerSide: 'yes', isBlockTrade: false,
});
const row = (t: Trade): TradeRow => ({
    trade_id: t.tradeId, market_ticker: t.ticker, created_at: t.createdAt.toISOString(), yes_price_cents: 4,
    count_hundredths: 100, taker_side: 'yes', is_block_trade: false,
});

function source(byTicker: Record<string, Trade[]>, cutoff: Date): TradesSourceLike & { calls: TradesQuery[] } {
    const calls: TradesQuery[] = [];
    return {
        calls,
        getHistoricalTradesCutoff: async () => cutoff,
        fetchTrades: async (q) => {
            calls.push(q);
            const lo = (q.minTs ?? 0) * 1000;
            const hi = q.maxTs !== undefined ? q.maxTs * 1000 : Infinity;
            const live = q.source !== 'historical';
            return (byTicker[q.ticker!] ?? []).filter((t) => {
                const ms = t.createdAt.getTime();
                return ms >= lo && ms <= hi && (live ? ms >= cutoff.getTime() : ms < cutoff.getTime());
            });
        },
    };
}

describe('pullTape', () => {
    const silent = () => {};

    it('backfills 14 days on first sight and resumes from the newest stored print, deduping the boundary', async () => {
        const a1 = trade('a1', 'A', START.getTime() - 20 * DAY);
        const a2 = trade('a2', 'A', START.getTime() - 10 * DAY);
        const a3 = trade('a3', 'A', START.getTime() - DAY);
        const b1 = trade('b1', 'B', START.getTime() - 2 * DAY + 500);
        const b2 = trade('b2', 'B', START.getTime() - 2 * DAY + 900);
        const b3 = trade('b3', 'B', START.getTime() - 3_600_000);
        const src = source({ A: [a1, a2, a3], B: [b1, b2, b3] }, new Date(START.getTime() - 60 * DAY));
        const store = { readSince: async () => new Map([['B', [row(b1), row(b2)]]]) };

        const r = await pullTape({ tickers: ['A', 'B'], dayStart: START, store, source: src, log: silent });

        expect(r.backfilled).toBe(1);
        expect(r.historicalFetches).toBe(0);
        expect(src.calls).toEqual([
            { ticker: 'A', minTs: (START.getTime() - 14 * DAY) / 1000, source: 'live' },
            { ticker: 'B', minTs: Math.floor(b2.createdAt.getTime() / 1000), source: 'live' },
        ]);
        expect(r.newRows.map((x) => x.trade_id).sort()).toEqual(['a2', 'a3', 'b3']);
        expect(r.prints.get('B')!.map((p) => p.tradeId)).toEqual(['b1', 'b2', 'b3']);
    });

    it('reads /historical/trades only when the window reaches below the cutoff', async () => {
        const cutoff = new Date(START.getTime() - 5 * DAY);
        const old = trade('o1', 'A', START.getTime() - 8 * DAY);
        const recent = trade('r1', 'A', START.getTime() - DAY);
        const src = source({ A: [old, recent], B: [] }, cutoff);
        const store = { readSince: async () => new Map([['B', [row(trade('b0', 'B', START.getTime() - DAY))]]]) };

        const r = await pullTape({ tickers: ['A', 'B'], dayStart: START, store, source: src, log: silent });

        expect(r.historicalFetches).toBe(1);
        expect(src.calls.filter((c) => c.source === 'historical')).toEqual([
            { ticker: 'A', minTs: (START.getTime() - 14 * DAY) / 1000, maxTs: cutoff.getTime() / 1000, source: 'historical' },
        ]);
        expect(r.prints.get('A')!.map((p) => p.tradeId).sort()).toEqual(['o1', 'r1']);
    });

    it('a ticker whose pull exhausts its retries fails alone, keeping only its stored prints', async () => {
        const a1 = trade('a1', 'A', START.getTime() - DAY);
        const c1 = trade('c1', 'C', START.getTime() - DAY);
        const b0 = trade('b0', 'B', START.getTime() - 2 * DAY);
        const src = source({ A: [a1], C: [c1] }, new Date(START.getTime() - 60 * DAY));
        const inner = src.fetchTrades;
        src.fetchTrades = async (q) => {
            if (q.ticker === 'B') throw new KalshiRetriesExhaustedError('429 after 5 attempts');
            return inner(q);
        };
        const store = { readSince: async () => new Map([['B', [row(b0)]]]) };

        const r = await pullTape({ tickers: ['A', 'B', 'C'], dayStart: START, store, source: src, concurrency: 1, log: silent });

        expect(r.failed).toEqual(['B']);
        expect(r.newRows.map((x) => x.trade_id).sort()).toEqual(['a1', 'c1']);
        expect(r.prints.get('B')!.map((p) => p.tradeId)).toEqual(['b0']);
    });

    it('a historical-path failure fails the ticker too', async () => {
        const src = source({ A: [] }, new Date(START.getTime() - 5 * DAY));
        src.fetchTrades = async (q) => {
            if (q.source === 'historical') throw new KalshiRetriesExhaustedError('503');
            return [];
        };
        const r = await pullTape({ tickers: ['A'], dayStart: START, store: { readSince: async () => new Map() }, source: src, log: silent });
        expect(r.failed).toEqual(['A']);
    });

    it('a 4xx or any other error rejects the pull and stops taking tickers', async () => {
        const src = source({}, new Date(START.getTime() - 60 * DAY));
        const seen: string[] = [];
        src.fetchTrades = async (q) => {
            seen.push(q.ticker!);
            if (q.ticker === 'B') throw new KalshiClientError(401, 'unauthorized');
            return [];
        };
        const tickers = ['A', 'B', 'C', 'D', 'E'];
        await expect(pullTape({ tickers, dayStart: START, store: { readSince: async () => new Map() }, source: src, concurrency: 1, log: silent }))
            .rejects.toThrow(KalshiClientError);
        expect(seen).toEqual(['A', 'B']);
    });

    it('the abort threshold is strictly more than 10% of candidates', () => {
        expect(tapeFailureExceeded(10, 100)).toBe(false);
        expect(tapeFailureExceeded(11, 100)).toBe(true);
        expect(tapeFailureExceeded(0, 0)).toBe(false);
    });
});

describe('read-only Supabase fetch (dry run)', () => {
    it('passes GETs and refuses writes before they reach the network', async () => {
        const inner = jest.fn().mockResolvedValue(new Response('[]'));
        const f = readOnlyFetch(inner as unknown as typeof fetch);
        await f('https://x.supabase.co/rest/v1/trades?select=*');
        await expect(f('https://x.supabase.co/rest/v1/trades', { method: 'POST', body: '[]' })).rejects.toThrow(/refused POST/);
        await expect(f('https://x.supabase.co/rest/v1/basket', { method: 'PATCH' })).rejects.toThrow(/refused PATCH/);
        expect(inner).toHaveBeenCalledTimes(1);
    });
});
