import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

let client: SupabaseClient | undefined;
let readOnly = false;

/**
 * Makes every later client refuse non-GET/HEAD requests (dry runs against prod). Must run
 * before the first `getSupabase()`; PostgREST selects are GETs, so reads are unaffected.
 */
export function useReadOnlySupabase(): void {
    if (client && !readOnly) throw new Error("useReadOnlySupabase() after a writable client was created");
    readOnly = true;
}

export function readOnlyFetch(inner: typeof fetch = fetch): typeof fetch {
    return (input, init) => {
        const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
        if (method !== "GET" && method !== "HEAD") {
            return Promise.reject(new Error(`read-only Supabase client refused ${method} ${String(input)}`));
        }
        return inner(input, init);
    };
}

/** Service-role Supabase client, created on first use. Throws if the env vars are missing. */
export function getSupabase(): SupabaseClient {
    if (client) return client;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
    }
    client = createClient(url, key, readOnly ? { global: { fetch: readOnlyFetch() } } : undefined);
    return client;
}
