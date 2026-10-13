/**
 * Classifier parity CLI (PRD — Sweep Catcher Maker Pilot, 0.5). Runs the producer's pure
 * candidate predicate, features and rule v1.1 over a snapshot written by bellman
 * research/event_driven/check_basket_parity.py, with no database or network.
 *
 *   npx tsx scripts/parity-from-snapshot.ts <snapshot.json.gz> <out.json> [--predicate-only]
 *
 * Snapshot: { anchors: {name, at}[], window_days, markets: Kalshi /markets rows, events:
 * {event_ticker, series_ticker, mutually_exclusive}[], series: {ticker, title, category,
 * fee_type}[], trades?: {ticker: raw /markets/trades rows} }. Every snapshot market is a
 * candidate ticker, standing in for the sync_status = 1 subscriptions.
 *
 * Out, per anchor: --predicate-only → candidate tickers; otherwise every candidate with its
 * features and rule decision, plus the predicate exclusion of every other ticker.
 */
import { readFileSync, writeFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { normalizeTrade, RawTradeSchema } from '../src/kalshi/trades';
import {
    applyFieldPredicate, EventRowSchema, MarketRow, MarketRowSchema, SeriesRowSchema,
} from '../src/sweep/candidates';
import { computeFeatures } from '../src/sweep/features';
import { applyRule } from '../src/sweep/rule';
import { rowToPrint, tradeToRow } from '../src/sweep/tape';

interface Snapshot {
    anchors: { name: string; at: string }[];
    window_days: number;
    markets: Record<string, unknown>[];
    events: Record<string, unknown>[];
    series: Record<string, unknown>[];
    trades?: Record<string, unknown[]>;
}

const cents = (dollars: unknown): number | null =>
    dollars === undefined || dollars === null || dollars === '' ? null : Math.round(Number(dollars) * 10_000) / 100;

/** A /markets row as the scraper stores it in kalshi_state.markets (prices in cents, absent → null). */
export function toMarketRow(m: Record<string, unknown>): MarketRow {
    return MarketRowSchema.parse({
        ticker: m.ticker,
        event_ticker: m.event_ticker,
        status: m.status,
        close_time: m.close_time,
        strike_type: m.strike_type ?? null,
        mve_collection_ticker: m.mve_collection_ticker ?? null,
        yes_bid: cents(m.yes_bid_dollars),
        yes_ask: cents(m.yes_ask_dollars),
    });
}

function main(): void {
    const [input, output, ...flags] = process.argv.slice(2);
    if (!input || !output) throw new Error('usage: parity-from-snapshot <snapshot.json.gz> <out.json> [--predicate-only]');
    const predicateOnly = flags.includes('--predicate-only');
    const raw = readFileSync(input);
    const snap = JSON.parse((input.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8')) as Snapshot;

    const markets = snap.markets.map(toMarketRow);
    const eventLegs = new Map<string, MarketRow[]>();
    for (const m of markets) {
        const list = eventLegs.get(m.event_ticker) ?? [];
        list.push(m);
        eventLegs.set(m.event_ticker, list);
    }
    const events = new Map(snap.events.map((e) => EventRowSchema.parse(e)).map((e) => [e.event_ticker, e]));
    const series = new Map(snap.series
        .map((s) => SeriesRowSchema.parse({ ...s, title: s.title ?? '', category: s.category ?? '' }))
        .map((s) => [s.ticker, s]));
    const tickers = markets.map((m) => m.ticker).sort();
    const marketMap = new Map(markets.map((m) => [m.ticker, m]));

    const prints = new Map(Object.entries(snap.trades ?? {}).map(([ticker, rows]) =>
        [ticker, rows.map((r) => rowToPrint(tradeToRow(normalizeTrade(RawTradeSchema.parse(r)))))]));

    const out: Record<string, unknown> = { window_days: snap.window_days, anchors: {} };
    for (const anchor of snap.anchors) {
        const at = new Date(anchor.at);
        const { legs, excluded } = applyFieldPredicate({
            tickers, markets: marketMap, eventLegs, events, series, dayStart: at, windowDays: snap.window_days,
        });
        if (predicateOnly) {
            (out.anchors as Record<string, unknown>)[anchor.name] = { at: anchor.at, candidates: legs.map((l) => l.ticker) };
            continue;
        }
        const missing = legs.filter((l) => !prints.has(l.ticker)).length;
        if (missing) console.warn(`[parity] ${anchor.name}: ${missing} candidates have no tape in the snapshot; treated as no prints`);
        (out.anchors as Record<string, unknown>)[anchor.name] = {
            at: anchor.at,
            legs: legs.map((leg) => {
                const features = computeFeatures(prints.get(leg.ticker) ?? [], at);
                return { ...leg, features, rule: applyRule(features) };
            }),
            excluded: Object.fromEntries(excluded),
        };
    }
    writeFileSync(output, JSON.stringify(out));
}

if (require.main === module) main();
