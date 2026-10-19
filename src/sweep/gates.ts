import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { SINGLE_EVENT_PROP, SPORTS_CONTEST } from './candidates';
import { RULE } from './config';

export const SCRAPER_PROCESS = 'policy_markets_scraper';

const ScraperLogSchema = z.object({
    status: z.string(),
    started_at: z.string(),
    completed_at: z.string(),
});
export type ScraperLog = z.infer<typeof ScraperLogSchema>;

export interface Freshness {
    ok: boolean;
    /** completed_at − day start of the run that passed, ms. */
    lagMs: number | null;
    detail: string;
}

/**
 * The basket may only read today's subscriptions: some policy_markets_scraper run logged
 * `success` and completed at or after today's 00:00Z (the selector run). `partial` and
 * `failed` don't count. `logs` are that process's recent rows, any order.
 */
export function checkFreshness(logs: ScraperLog[], dayStart: Date): Freshness {
    const after = logs
        .filter((l) => Date.parse(l.completed_at) >= dayStart.getTime())
        .sort((a, b) => Date.parse(a.completed_at) - Date.parse(b.completed_at));
    const pass = after.find((l) => l.status === 'success');
    if (pass) {
        const lagMs = Date.parse(pass.completed_at) - dayStart.getTime();
        return { ok: true, lagMs, detail: `${SCRAPER_PROCESS} success at ${pass.completed_at} (+${Math.round(lagMs / 1000)} s after 00:00Z)` };
    }
    const latest = [...logs].sort((a, b) => Date.parse(b.completed_at) - Date.parse(a.completed_at))[0];
    return {
        ok: false,
        lagMs: null,
        detail: latest
            ? `no ${SCRAPER_PROCESS} success since ${dayStart.toISOString()}; latest: ${latest.status} at ${latest.completed_at}`
            : `no ${SCRAPER_PROCESS} log rows`,
    };
}

export async function loadScraperLogs(client: SupabaseClient, since: Date): Promise<ScraperLog[]> {
    const { data, error } = await client.schema('kalshi_state').from('scraper_logs')
        .select('status, started_at, completed_at')
        .eq('process', SCRAPER_PROCESS)
        .gte('started_at', new Date(since.getTime() - 3_600_000).toISOString())
        .order('started_at', { ascending: false })
        .limit(50);
    if (error) throw new Error(`scraper_logs: ${error.message}`);
    return z.array(ScraperLogSchema).parse(data ?? []);
}

/** selector_params keys the trader's selector compiles; each must equal our regex's `.source` byte for byte. */
export const SELECTOR_REGEXES: Record<string, RegExp> = {
    sports_contest_re: SPORTS_CONTEST,
    sports_single_event_prop_re: SINGLE_EVENT_PROP,
};

/**
 * The coarse universe must be a superset of the rule, or legs the rule would quote are never
 * subscribed, and its sports regexes must be ours. Returns the violations; empty means
 * looser-or-equal on every comparable key. A missing regex key only `warn`s.
 */
export function checkSelectorParams(
    params: Record<string, unknown> | null,
    windowDays: number,
    warn: (msg: string) => void = console.warn,
): string[] {
    if (!params) return ['no market_filters row with selector = field_universe'];
    const num = (k: string): number | null => (typeof params[k] === 'number' ? (params[k] as number) : null);
    const problems: string[] = [];
    const need = (k: string, ok: (v: number) => boolean, want: string) => {
        const v = num(k);
        if (v === null || !ok(v)) problems.push(`selector_params.${k} = ${JSON.stringify(params[k])}, need ${want}`);
    };
    need('max_cheap_c', (v) => v >= RULE.maxCheapC, `>= ${RULE.maxCheapC}`);
    need('max_event_close_d', (v) => v >= windowDays, `>= ${windowDays} (SWEEP_WINDOW_DAYS)`);
    need('min_close_d', (v) => v <= RULE.minLegCloseDays, `<= ${RULE.minLegCloseDays}`);
    need('min_legs', (v) => v <= RULE.minLegs, `<= ${RULE.minLegs}`);
    for (const [k, re] of Object.entries(SELECTOR_REGEXES)) {
        // TODO make strict once the migration is live
        if (params[k] === undefined || params[k] === null) warn(`selector_params.${k} is absent; regex parity unchecked`);
        else if (params[k] !== re.source) problems.push(`selector_params.${k} differs from the producer's regex ${JSON.stringify(re.source)}`);
    }
    return problems;
}

export async function loadSelectorParams(client: SupabaseClient): Promise<Record<string, unknown> | null> {
    const { data, error } = await client.schema('trading').from('market_filters')
        .select('id, selector, selector_params')
        .eq('selector', 'field_universe');
    if (error) throw new Error(`market_filters selector: ${error.message}`);
    const rows = (data ?? []) as { selector_params: Record<string, unknown> | null }[];
    return rows[0]?.selector_params ?? null;
}

const PolicySchema = z.object({ id: z.number().int(), sleeve_id: z.number().int().nullable(), is_active: z.boolean() });

/** Resolves the configured policy ids or sleeve to (policy ids, the one sleeve they share). */
export async function resolvePolicies(
    client: SupabaseClient,
    { policyIds, sleeveId }: { policyIds: number[] | null; sleeveId: number | null },
): Promise<{ policyIds: number[]; sleeveId: number }> {
    const q = client.schema('trading').from('policies').select('id, sleeve_id, is_active');
    const { data, error } = policyIds ? await q.in('id', policyIds) : await q.eq('sleeve_id', sleeveId!);
    if (error) throw new Error(`policies: ${error.message}`);
    const rows = z.array(PolicySchema).parse(data ?? []);
    if (rows.length === 0) throw new Error(`no policies for ${policyIds ? `ids ${policyIds}` : `sleeve ${sleeveId}`}`);
    if (policyIds && rows.length !== new Set(policyIds).size) {
        throw new Error(`policies: found ${rows.map((r) => r.id)} of ${policyIds}`);
    }
    const sleeves = [...new Set(rows.map((r) => r.sleeve_id))];
    if (sleeves.length !== 1 || sleeves[0] === null || (sleeveId !== null && sleeves[0] !== sleeveId)) {
        throw new Error(`policies ${rows.map((r) => r.id)} span sleeves ${sleeves}; expected exactly one${sleeveId ? ` (${sleeveId})` : ''}`);
    }
    return { policyIds: rows.map((r) => r.id).sort((a, b) => a - b), sleeveId: sleeves[0] };
}
