import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase, useReadOnlySupabase } from '../db/client';
import { chunk, selectAll } from '../db/paged';
import { KalshiPublicClient, loadReadAuthFromEnv } from '../kalshi/public-client';
import { postSignal } from '../router/post-signal';
import { admit, AdmitLeg, dayStartOf, loadSleeveCash, utcDate } from '../sweep/admit';
import { BasketDbRow, SweepBasketRow, toStoreRow } from '../sweep/basket';
import { buildCandidates, loadSubscriptions, sampleKalshiStateTickers } from '../sweep/candidates';
import { loadSweepConfig, SweepConfig } from '../sweep/config';
import { computeFeatures } from '../sweep/features';
import { checkFreshness, checkSelectorParams, loadScraperLogs, loadSelectorParams, resolvePolicies } from '../sweep/gates';
import { loadPositions } from '../sweep/positions';
import { applyRule } from '../sweep/rule';
import { MAX_TAPE_FAILED_FRACTION, pullTape, SupabaseTapeStore, tapeFailureExceeded, TapeStore, TradeRow } from '../sweep/tape';

/** Rows per router push; the router's body limit is 10 MB, the trader accumulates same-date pushes. */
export const PUSH_CHUNK = 500;
const DRY_RUN_SAMPLE_LEGS = 300;
/** Pacer gap (ms) used for the run-time estimate; the shared Kalshi pacer allows ≤3 req/s. */
const PACER_GAP_MS = 350;
const TAPE_BUDGET_MS = 15 * 60_000;
/** PRD §3.4: subscriptions are cumulative until finalization; alarm above this. */
const SUBSCRIPTION_ALARM = 2500;

export interface RunOptions {
    dryRun: boolean;
    candidatesFrom: 'policy_markets' | 'kalshi_state';
}

export function parseArgs(argv: string[]): RunOptions {
    const opts: RunOptions = { dryRun: false, candidatesFrom: 'policy_markets' };
    for (const arg of argv) {
        if (arg === '--dry-run') opts.dryRun = true;
        else if (arg.startsWith('--candidates-from=')) {
            const v = arg.slice('--candidates-from='.length);
            if (v !== 'policy_markets' && v !== 'kalshi_state') throw new Error(`unknown --candidates-from ${v}`);
            opts.candidatesFrom = v;
        } else throw new Error(`unknown argument ${arg}`);
    }
    if (opts.candidatesFrom === 'kalshi_state' && !opts.dryRun) throw new Error('--candidates-from=kalshi_state is dry-run only');
    return opts;
}

/** Pushes admitted rows in chunks; each chunk gets postSignal's retries, and any failure throws. */
export async function pushBasket(rows: SweepBasketRow[], post: typeof postSignal = postSignal): Promise<void> {
    for (const part of chunk(rows, PUSH_CHUNK)) await post('sweep_basket', part);
}

/**
 * Writes the day's rows (upsert on basket_date, ticker). A same-day re-run that drops a
 * ticker marks its earlier row superseded rather than leaving it admitted for boot hydration.
 */
async function writeBasket(client: SupabaseClient, basketDate: string, rows: BasketDbRow[]): Promise<void> {
    const existing = await selectAll<{ ticker: string }>('basket read', (from, to) =>
        client.schema('sweep_maker').from('basket').select('ticker')
            .eq('basket_date', basketDate).eq('admitted', true).order('ticker').range(from, to));
    const keep = new Set(rows.map((r) => r.ticker));
    const stale = existing.map((r) => r.ticker).filter((t) => !keep.has(t));
    for (const part of chunk(stale, 200)) {
        const res = await client.schema('sweep_maker').from('basket')
            .update({ admitted: false, excluded: 'superseded' }).eq('basket_date', basketDate).in('ticker', part);
        if (res.error) throw new Error(`basket supersede: ${res.error.message}`);
    }
    for (const part of chunk(rows, 1000)) {
        const res = await client.schema('sweep_maker').from('basket')
            .upsert(part.map((r) => ({ ...r, built_at: new Date().toISOString() })), { onConflict: 'basket_date,ticker' });
        if (res.error) throw new Error(`basket upsert: ${res.error.message}`);
    }
}

const count = <T extends string | null>(values: T[]): string =>
    Object.entries(values.reduce<Record<string, number>>((m, v) => ((m[v ?? 'admitted'] = (m[v ?? 'admitted'] ?? 0) + 1), m), {}))
        .sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join(' ') || 'none';

export async function runSweepBasket(opts: RunOptions, cfg: SweepConfig, now = new Date()): Promise<void> {
    const log = (msg: string) => console.log(`[sweep-basket] ${msg}`);
    const warnOrThrow = (msg: string) => {
        if (!opts.dryRun) throw new Error(msg);
        console.warn(`[sweep-basket] DRY RUN, would exit 1: ${msg}`);
    };
    if (opts.dryRun) useReadOnlySupabase();
    const client = getSupabase();
    const basketDate = utcDate(now);
    const dayStart = dayStartOf(basketDate);
    log(`basket ${basketDate}${opts.dryRun ? ' (dry run)' : ''}: window ${cfg.windowDays} d, S = ${cfg.s}, candidates from ${opts.candidatesFrom}`);
    const kalshi = new KalshiPublicClient({ auth: loadReadAuthFromEnv(process.env) });
    log(`kalshi: requests ${kalshi.signed ? `signed with KALSHI_READ_API_KEY_ID ${process.env.KALSHI_READ_API_KEY_ID!.trim().slice(0, 8)}…` : 'unsigned'}`);

    try {
        const problems = checkSelectorParams(await loadSelectorParams(client), cfg.windowDays, (m) => console.warn(`[sweep-basket] WARNING ${m}`));
        if (problems.length) warnOrThrow(`field_universe selector is not looser than the rule: ${problems.join('; ')}`);
    } catch (err) {
        warnOrThrow(`selector check failed: ${err instanceof Error ? err.message : err}`);
    }

    const fresh = checkFreshness(await loadScraperLogs(client, dayStart), dayStart);
    log(`freshness: ${fresh.detail}`);
    if (!fresh.ok && opts.candidatesFrom === 'policy_markets') warnOrThrow(`stale subscriptions: ${fresh.detail}`);

    let policyIds: number[] = [];
    let sleeveId: number | null = null;
    if (cfg.policyIds || cfg.sleeveId !== null) ({ policyIds, sleeveId } = await resolvePolicies(client, cfg));

    let subscribed: number;
    let tickers: string[];
    if (opts.candidatesFrom === 'kalshi_state') {
        tickers = await sampleKalshiStateTickers(client, { maxLegs: DRY_RUN_SAMPLE_LEGS, dayStart, windowDays: cfg.windowDays });
        subscribed = tickers.length;
        log(`kalshi_state sample: ${tickers.length} active field-strike legs closing in [3, ${cfg.windowDays}] d`);
    } else {
        const subs = await loadSubscriptions(client, policyIds);
        subscribed = subs.active;
        tickers = subs.tickers;
        log(`subscriptions: ${subs.active} active, ${subs.tickers.length} synced (policies ${policyIds}, sleeve ${sleeveId})`);
        if (subs.active > SUBSCRIPTION_ALARM) console.error(`[sweep-basket] ALARM ${subs.active} active subscriptions > ${SUBSCRIPTION_ALARM}`);
    }

    const { legs, excluded: predicateExcluded } = await buildCandidates(client, tickers, dayStart, cfg.windowDays);
    log(`candidates: ${legs.length} of ${tickers.length}; predicate exclusions ${count([...predicateExcluded.values()])}`);

    const estMs = legs.length * PACER_GAP_MS;
    log(`tape: ~${legs.length}+ requests ≈ ${Math.round(estMs / 1000)} s at ${PACER_GAP_MS} ms/request`);
    if (estMs > TAPE_BUDGET_MS) console.warn(`[sweep-basket] WARNING tape pull estimate ${Math.round(estMs / 60_000)} min exceeds 15 min`);

    let store: TapeStore = new SupabaseTapeStore(client);
    if (opts.dryRun) {
        const real = store;
        store = {
            readSince: async (t, from) => {
                try {
                    return await real.readSince(t, from);
                } catch (err) {
                    console.warn(`[sweep-basket] DRY RUN: stored tape unreadable (${err instanceof Error ? err.message : err}); backfilling every ticker`);
                    return new Map();
                }
            },
            insert: async () => { throw new Error('dry run never writes the tape'); },
        };
    }
    const tape = await pullTape({ tickers: legs.map((l) => l.ticker), dayStart, store, source: kalshi, log });
    log(`tape: ${tape.newRows.length} new prints, ${tape.backfilled} backfilled, ${tape.historicalFetches} historical reads, ` +
        `${tape.failed.length} failed, ${Math.round(tape.elapsedMs / 1000)} s`);
    if (tape.failed.length) log(`tape failed: ${tape.failed.slice(0, 20).join(' ')}${tape.failed.length > 20 ? ' …' : ''}`);
    if (opts.dryRun) {
        const path = join(tmpdir(), `sweep-tape-${basketDate}-${process.pid}.jsonl`);
        writeFileSync(path, tape.newRows.map((r: TradeRow) => JSON.stringify(r)).join('\n'));
        log(`DRY RUN: tape not written; ${tape.newRows.length} rows saved to ${path}`);
    } else {
        try {
            await store.insert(tape.newRows);
        } catch (err) {
            // Features use the in-memory tape, and the next run re-pulls from the stored watermark.
            console.error(`[sweep-basket] ERROR tape insert failed, continuing: ${err instanceof Error ? err.message : err}`);
        }
    }

    if (tapeFailureExceeded(tape.failed.length, legs.length)) {
        warnOrThrow(`tape failed for ${tape.failed.length} of ${legs.length} tickers (> ${MAX_TAPE_FAILED_FRACTION * 100}%)`);
    }

    const admitLegs: AdmitLeg[] = legs.map((leg) => {
        const features = computeFeatures(tape.prints.get(leg.ticker) ?? [], dayStart);
        return { leg, features, rule: applyRule(features) };
    });

    let cashC: number | null = null;
    if (sleeveId !== null) {
        const cash = await loadSleeveCash(client, sleeveId);
        cashC = cash.cashC;
        log(`sleeve ${sleeveId} (${cash.status}): cash ${(cashC / 100).toFixed(2)} USD`);
    } else {
        log('no sleeve configured: budget check skipped');
    }
    const positions = await loadPositions(client, policyIds, legs.map((l) => l.ticker));
    const result = admit({ basketDate, legs: admitLegs, positions, cashC, s: cfg.s, tapeFailed: new Set(tape.failed) });
    if (result.rationed > 0) {
        console.error(`[sweep-basket] ALARM rationed ${result.rationed} legs: demand ${(result.demandC / 100).toFixed(2)} USD > budget ${((result.budgetC ?? 0) / 100).toFixed(2)} USD (0.95 × cash). Fund the sleeve or lower S.`);
    }

    const admitted = result.rows.filter((r) => r.admitted);
    const storeRows = admitted.map(toStoreRow);
    log(`exclusions: ${count(result.rows.map((r) => r.excluded))}`);
    log(`by side: cheap yes ${admitted.filter((r) => r.cheap_side === 'yes').length}, cheap no ${admitted.filter((r) => r.cheap_side === 'no').length}; events ${new Set(admitted.map((r) => r.event_ticker)).size}`);

    if (opts.dryRun) {
        for (const r of admitted.slice(0, 50)) {
            log(`  admit ${r.ticker} cheap=${r.cheap_side} p0=${r.p0_c} → buy ${r.quote_side} @${r.quote_price_c} ` +
                `tpd=${r.trades_per_day_7d?.toFixed(2)} wkhi=${r.week_high_c} sweeps=${r.sweep_days_14d} close=${r.leg_close_at.slice(0, 10)}`);
        }
    } else {
        await writeBasket(client, basketDate, result.rows);
        await pushBasket(storeRows);
    }

    const budget = result.budgetC === null ? 'n/a' : `${(result.budgetC / 100).toFixed(2)} USD`;
    log(`SUMMARY ${basketDate}${opts.dryRun ? ' DRY RUN (nothing written or pushed)' : ''}: subscribed ${subscribed}, ` +
        `candidates ${legs.length}, admitted ${admitted.length} (${result.resting} resting), rationed ${result.rationed}, tape_failed=${tape.failed.length}, ` +
        `budget used ${(result.usedC / 100).toFixed(2)} of ${budget}`);
}

async function main(): Promise<void> {
    const opts = parseArgs(process.argv.slice(2));
    const cfg = loadSweepConfig(process.env, { allowNoSleeve: opts.candidatesFrom === 'kalshi_state' });
    await runSweepBasket(opts, cfg);
}

if (require.main === module) {
    main().then(
        () => process.exit(0),
        (err) => {
            console.error(`[sweep-basket] FAILED: ${err instanceof Error ? err.stack ?? err.message : err}`);
            process.exit(1);
        },
    );
}
