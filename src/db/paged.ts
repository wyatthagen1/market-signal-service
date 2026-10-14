import { PostgrestError } from "@supabase/supabase-js";

/** Remote PostgREST returns at most 1,000 rows per response, whatever the request asks. */
export const PAGE_SIZE = 1000;
/** Tickers per `.in()` filter: long lists overflow the URL (policy-sync-url-length-crash). */
export const IN_CHUNK = 200;

export type PageResult = PromiseLike<{ data: unknown[] | null; error: PostgrestError | null }>;

/**
 * Reads every page of a query. `page(from, to)` must build a fresh, totally ordered query
 * and apply `.range(from, to)`; an unordered query can skip or repeat rows across pages.
 */
export async function selectAll<T>(label: string, page: (from: number, to: number) => PageResult): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await page(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(`${label}: ${error.code ?? ""} ${error.message}`);
        const rows = (data ?? []) as T[];
        out.push(...rows);
        if (rows.length === 0) break;
    }
    return out;
}

export function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}
