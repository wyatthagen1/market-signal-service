/**
 * Sweep Catcher rule v1.1 (PRD — Sweep Catcher Maker Pilot §1) and producer config.
 * The rule constants are pre-registered; only the window and size are configurable.
 */
export const RULE = {
    /** Cheap side's last print at the UTC day start, inclusive. */
    maxCheapC: 10,
    /** We offer the cheap side at p0 + offset. */
    offsetC: 20,
    /** Trailing 7-day prints per day, inclusive. */
    minTradesPerDay: 3,
    minLegCloseDays: 3,
    minLegs: 5,
    /** A taker buy this far above its UTC day's VWAP marks a sweep day. */
    sweepAboveVwapC: 15,
    sweepLookbackDays: 14,
    tapeBackfillDays: 14,
} as const;

/** Σ resting notional of the admitted basket may use at most this share of sleeve cash. */
export const BUDGET_FRACTION = 0.95;
/**
 * valid_until = basket_date 00:00Z + VALID_FOR_HOURS + a per-ticker offset in
 * [0, EXPIRY_STAGGER_HOURS). The floor must outlast the next basket's arrival.
 */
export const VALID_FOR_HOURS = 26;
/** Spreads the trader's near-expiry cancel-replaces instead of bursting them at one instant. */
export const EXPIRY_STAGGER_HOURS = 2;

export const DAY_MS = 86_400_000;

export interface SweepConfig {
    /** Policies whose subscriptions are the candidate set; from SWEEP_POLICY_ID or SWEEP_SLEEVE_ID. */
    policyIds: number[] | null;
    sleeveId: number | null;
    windowDays: number;
    /** Contracts per market. */
    s: number;
}

function positiveInt(name: string, raw: string | undefined, fallback?: number): number {
    if (raw === undefined || raw.trim() === '') {
        if (fallback === undefined) throw new Error(`${name} is required`);
        return fallback;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} must be a positive integer, got ${JSON.stringify(raw)}`);
    return n;
}

/**
 * Reads SWEEP_POLICY_ID (comma-separated ids) or SWEEP_SLEEVE_ID, SWEEP_WINDOW_DAYS (56) and
 * SWEEP_S (1). Neither id is allowed only when `allowNoSleeve` (dry runs over kalshi_state).
 */
export function loadSweepConfig(env: NodeJS.ProcessEnv, { allowNoSleeve = false } = {}): SweepConfig {
    const rawPolicies = env.SWEEP_POLICY_ID?.trim();
    const policyIds = rawPolicies
        ? rawPolicies.split(',').map((p) => positiveInt('SWEEP_POLICY_ID', p.trim()))
        : null;
    const sleeveId = env.SWEEP_SLEEVE_ID?.trim() ? positiveInt('SWEEP_SLEEVE_ID', env.SWEEP_SLEEVE_ID) : null;
    if (!policyIds && sleeveId === null && !allowNoSleeve) {
        throw new Error('set SWEEP_POLICY_ID or SWEEP_SLEEVE_ID');
    }
    return {
        policyIds,
        sleeveId,
        windowDays: positiveInt('SWEEP_WINDOW_DAYS', env.SWEEP_WINDOW_DAYS, 56),
        s: positiveInt('SWEEP_S', env.SWEEP_S, 1),
    };
}
