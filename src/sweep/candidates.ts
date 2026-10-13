import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { chunk, IN_CHUNK, PAGE_SIZE, PageResult, selectAll } from '../db/paged';
import { DAY_MS, RULE } from './config';

// Ported verbatim from bellman research/event_driven/common.py.
export const SPORTS_CONTEST = /GAME|MATCH|FIGHT|BOUT|SPREAD|TOTAL/;
export const SINGLE_EVENT_PROP = new RegExp(
    'FIRSTTD|ANYTD|1HFT|WINMARGIN|UFCMOV|UFCVIC|MOV-|NASCARRACE|F1RACE|RACEPODIUM|KXF1|' +
        'PGATOUR|LPGATOUR|DPWORLDTOUR|ATP|WTA|MATCH|GAME|TOTAL|SPREAD|PLAYERPROP|SCORE|' +
        'CHESSTOURNAMENT|TITLEDTUES|NBASTARTERS|BALLONDOR',
);
/** common.archetype: any other strike type is a numeric ladder; a null strike is a field leg. */
export function isFieldStrike(strikeType: string | null): boolean {
    return strikeType === null || strikeType === 'custom' || strikeType === 'structured';
}

const nullableNumber = z.coerce.number().nullable();

export const MarketRowSchema = z.object({
    ticker: z.string(),
    event_ticker: z.string(),
    status: z.string(),
    close_time: z.string(),
    strike_type: z.string().nullable(),
    mve_collection_ticker: z.string().nullable(),
    yes_bid: nullableNumber,
    yes_ask: nullableNumber,
});
export type MarketRow = z.infer<typeof MarketRowSchema>;
const MARKET_COLUMNS = 'ticker, event_ticker, status, close_time, strike_type, mve_collection_ticker, yes_bid, yes_ask';

export const EventRowSchema = z.object({
    event_ticker: z.string(),
    series_ticker: z.string(),
    mutually_exclusive: z.boolean().nullable(),
});
export type EventRow = z.infer<typeof EventRowSchema>;

export const SeriesRowSchema = z.object({
    ticker: z.string(),
    title: z.string(),
    category: z.string(),
    fee_type: z.string().nullable(),
});
export type SeriesRow = z.infer<typeof SeriesRowSchema>;

export interface CandidateLeg {
    ticker: string;
    eventTicker: string;
    seriesTicker: string;
    category: string;
    feeType: string | null;
    mutuallyExclusive: boolean;
    closeAt: Date;
    /** Max close_time over the event's legs. */
    eventCloseAt: Date;
    legsInEvent: number;
    bookYesBid: number | null;
    bookYesAsk: number | null;
}

export type PredicateExclusion =
    | 'not_in_kalshi_state'
    | 'no_event'
    | 'no_series'
    | 'inactive'
    | 'mve'
    | 'numeric_ladder'
    | 'mentions'
    | 'contest'
    | 'single_event_prop'
    | 'few_legs'
    | 'leg_close'
    | 'event_close';

export interface PredicateInput {
    tickers: string[];
    markets: Map<string, MarketRow>;
    /** Every market of each event, any status. */
    eventLegs: Map<string, MarketRow[]>;
    events: Map<string, EventRow>;
    series: Map<string, SeriesRow>;
    dayStart: Date;
    windowDays: number;
}

export interface PredicateResult {
    legs: CandidateLeg[];
    excluded: Map<string, PredicateExclusion>;
}

/** A leg that counts toward the event's field size: the coarse builder's leg test, as of the day start. */
function isLiveFieldLeg(m: MarketRow, dayStart: number): boolean {
    return m.status === 'active' && m.mve_collection_ticker === null && isFieldStrike(m.strike_type)
        && Date.parse(m.close_time) > dayStart;
}

/**
 * The fine field predicate over subscribed legs (PRD 1.2): a non-numeric-ladder leg of a
 * ≥5-leg event outside Mentions, not a Sports contest or single-event prop (bellman
 * common.py), whose own close is ≥3 d and whose event close (max leg close) ≤ windowDays
 * after the basket day's 00:00Z. Every ticker gets either a leg or one exclusion reason.
 */
export function applyFieldPredicate(input: PredicateInput): PredicateResult {
    const { markets, eventLegs, events, series, windowDays } = input;
    const dayStart = input.dayStart.getTime();
    const legs: CandidateLeg[] = [];
    const excluded = new Map<string, PredicateExclusion>();

    for (const ticker of input.tickers) {
        const reason = ((): PredicateExclusion | CandidateLeg => {
            const m = markets.get(ticker);
            if (!m) return 'not_in_kalshi_state';
            const e = events.get(m.event_ticker);
            if (!e) return 'no_event';
            const s = series.get(e.series_ticker);
            if (!s) return 'no_series';
            if (m.status !== 'active') return 'inactive';
            if (m.mve_collection_ticker !== null) return 'mve';
            if (!isFieldStrike(m.strike_type)) return 'numeric_ladder';
            if (s.category === 'Mentions') return 'mentions';
            if (s.category === 'Sports' && SPORTS_CONTEST.test(`${s.ticker} ${s.title}`.toUpperCase())) return 'contest';
            if (s.category === 'Sports' && SINGLE_EVENT_PROP.test(m.event_ticker)) return 'single_event_prop';
            const siblings = eventLegs.get(m.event_ticker) ?? [m];
            const live = siblings.filter((x) => isLiveFieldLeg(x, dayStart)).length;
            if (live < RULE.minLegs) return 'few_legs';
            const closeAt = Date.parse(m.close_time);
            if (closeAt - dayStart < RULE.minLegCloseDays * DAY_MS) return 'leg_close';
            const eventCloseAt = Math.max(closeAt, ...siblings.map((x) => Date.parse(x.close_time)));
            if (eventCloseAt - dayStart > windowDays * DAY_MS) return 'event_close';
            return {
                ticker,
                eventTicker: m.event_ticker,
                seriesTicker: e.series_ticker,
                category: s.category,
                feeType: s.fee_type,
                mutuallyExclusive: e.mutually_exclusive === true,
                closeAt: new Date(closeAt),
                eventCloseAt: new Date(eventCloseAt),
                legsInEvent: live,
                bookYesBid: m.yes_bid,
                bookYesAsk: m.yes_ask,
            };
        })();
        if (typeof reason === 'string') excluded.set(ticker, reason);
        else legs.push(reason);
    }
    return { legs, excluded };
}

export interface Subscriptions {
    /** Active subscriptions, synced or not. */
    active: number;
    /** Active and loaded by the container (sync_status = 1); the candidate set. */
    tickers: string[];
}

/** Sleeve S's active policy_markets rows, paged; candidates are those with sync_status = 1. */
export async function loadSubscriptions(client: SupabaseClient, policyIds: number[]): Promise<Subscriptions> {
    const rows = await selectAll<{ id: number; market_ticker: string; sync_status: number | null }>(
        'policy_markets',
        (from, to) => client.schema('kalshi_state').from('policy_markets')
            .select('id, market_ticker, sync_status')
            .in('policy_id', policyIds)
            .eq('is_active', true)
            .order('id')
            .range(from, to),
    );
    const tickers = [...new Set(rows.filter((r) => r.sync_status === 1).map((r) => r.market_ticker))].sort();
    return { active: rows.length, tickers };
}

async function selectIn<T>(
    client: SupabaseClient,
    label: string,
    schema: z.ZodType<T>,
    keys: string[],
    query: (client: SupabaseClient, keys: string[], from: number, to: number) => PageResult,
): Promise<T[]> {
    const out: T[] = [];
    for (const part of chunk([...new Set(keys)].sort(), IN_CHUNK)) {
        const rows = await selectAll<unknown>(label, (from, to) => query(client, part, from, to));
        out.push(...rows.map((r) => schema.parse(r)));
    }
    return out;
}

export async function loadMarkets(client: SupabaseClient, tickers: string[]): Promise<MarketRow[]> {
    return selectIn(client, 'markets by ticker', MarketRowSchema, tickers, (c, keys, from, to) =>
        c.schema('kalshi_state').from('markets').select(MARKET_COLUMNS).in('ticker', keys).order('ticker').range(from, to));
}

export async function loadEventLegs(client: SupabaseClient, eventTickers: string[]): Promise<MarketRow[]> {
    return selectIn(client, 'markets by event', MarketRowSchema, eventTickers, (c, keys, from, to) =>
        c.schema('kalshi_state').from('markets').select(MARKET_COLUMNS).in('event_ticker', keys).order('ticker').range(from, to));
}

export async function loadEvents(client: SupabaseClient, eventTickers: string[]): Promise<EventRow[]> {
    return selectIn(client, 'events', EventRowSchema, eventTickers, (c, keys, from, to) =>
        c.schema('kalshi_state').from('events').select('event_ticker, series_ticker, mutually_exclusive')
            .in('event_ticker', keys).order('event_ticker').range(from, to));
}

export async function loadSeries(client: SupabaseClient, seriesTickers: string[]): Promise<SeriesRow[]> {
    return selectIn(client, 'series', SeriesRowSchema, seriesTickers, (c, keys, from, to) =>
        c.schema('kalshi_state').from('series').select('ticker, title, category, fee_type')
            .in('ticker', keys).order('ticker').range(from, to));
}

/** Joins the subscribed tickers to kalshi_state and applies the fine predicate. */
export async function buildCandidates(
    client: SupabaseClient,
    tickers: string[],
    dayStart: Date,
    windowDays: number,
): Promise<PredicateResult> {
    const markets = await loadMarkets(client, tickers);
    const eventTickers = [...new Set(markets.map((m) => m.event_ticker))];
    const [legRows, events] = await Promise.all([loadEventLegs(client, eventTickers), loadEvents(client, eventTickers)]);
    const series = await loadSeries(client, [...new Set(events.map((e) => e.series_ticker))]);

    const eventLegs = new Map<string, MarketRow[]>();
    for (const m of legRows) {
        const list = eventLegs.get(m.event_ticker) ?? [];
        list.push(m);
        eventLegs.set(m.event_ticker, list);
    }
    return applyFieldPredicate({
        tickers,
        markets: new Map(markets.map((m) => [m.ticker, m])),
        eventLegs,
        events: new Map(events.map((e) => [e.event_ticker, e])),
        series: new Map(series.map((s) => [s.ticker, s])),
        dayStart,
        windowDays,
    });
}

/** Categories sampled by the dry-run kalshi_state source; the coarse selector excludes the rest. */
const SAMPLE_CATEGORIES = ['Sports', 'Entertainment', 'Politics', 'Economics', 'Science and Technology', 'Elections',
    'Companies', 'World', 'Financials', 'Health', 'Social'];
const SAMPLE_EVENT_MAX_AGE_DAYS = 180;
const SAMPLE_SERIES_CHUNK = 50;

/**
 * Dry-run-only candidate source for when sleeve S has no subscriptions: a capped sample of
 * active, non-MVE, field-strike legs closing in [3 d, windowDays] of the day start, reached
 * series(category, Sports contests skipped) → the newest 1,000 events (created ≤180 d ago) per
 * 50 series → markets(event_ticker), all on indexes. The markets table is too bloated for a status/close scan inside the role
 * timeout. Not the coarse universe: no touch or volume filter (prices aren't stored yet).
 */
export async function sampleKalshiStateTickers(
    client: SupabaseClient,
    { maxLegs, dayStart, windowDays }: { maxLegs: number; dayStart: Date; windowDays: number },
): Promise<string[]> {
    const perCategory = Math.ceil(maxLegs / SAMPLE_CATEGORIES.length);
    const minClose = dayStart.getTime() + RULE.minLegCloseDays * DAY_MS;
    const maxClose = dayStart.getTime() + windowDays * DAY_MS;
    const createdAfter = new Date(dayStart.getTime() - SAMPLE_EVENT_MAX_AGE_DAYS * DAY_MS).toISOString();
    const out: string[] = [];

    for (const category of SAMPLE_CATEGORIES) {
        const series = (await selectAll<{ ticker: string; title: string }>('series by category', (from, to) =>
            client.schema('kalshi_state').from('series').select('ticker, title').eq('category', category).order('ticker').range(from, to)))
            .filter((s) => !(category === 'Sports' && SPORTS_CONTEST.test(`${s.ticker} ${s.title}`.toUpperCase())));
        let taken = 0;
        for (const seriesPart of chunk(series.map((s) => s.ticker), SAMPLE_SERIES_CHUNK)) {
            if (taken >= perCategory) break;
            // One page, newest first: game-heavy series hold tens of thousands of events.
            const { data, error } = await client.schema('kalshi_state').from('events').select('event_ticker')
                .in('series_ticker', seriesPart).gte('created_at', createdAfter)
                .order('created_at', { ascending: false }).limit(PAGE_SIZE);
            if (error) throw new Error(`events by series: ${error.code ?? ''} ${error.message}`);
            const events = (data ?? []) as { event_ticker: string }[];
            for (const eventPart of chunk(events.map((e) => e.event_ticker), IN_CHUNK)) {
                if (taken >= perCategory) break;
                const legs = (await selectAll<unknown>('markets by event', (from, to) =>
                    client.schema('kalshi_state').from('markets').select(MARKET_COLUMNS)
                        .in('event_ticker', eventPart).eq('status', 'active')
                        .order('ticker').range(from, to))).map((r) => MarketRowSchema.parse(r));
                for (const m of legs) {
                    const close = Date.parse(m.close_time);
                    if (m.mve_collection_ticker !== null || !isFieldStrike(m.strike_type) || close < minClose || close > maxClose) continue;
                    out.push(m.ticker);
                    if (++taken >= perCategory) break;
                }
            }
        }
    }
    return out.sort();
}
