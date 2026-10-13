# market-signal-service

Non-weather signal producers for the trading platform. Each producer is a run-once
Railway cron that reads Kalshi public data and the platform database, writes its own
tables, and pushes a store to the trading fleet through the signal router.

## Layout

- `src/kalshi/` — unauthenticated, paced (≤3 req/s) client for Kalshi's public trade tape
  (`/markets/trades` and `/historical/trades`), parsing the fixed-point `count_fp` /
  `*_dollars` fields.
- `src/router/` — `postSignal`, which pushes a store to every sleeve through the signal router.
- `src/db/` — Supabase service-role client and `SupabaseWrapper` (paged reads, batched upserts).
  Remote PostgREST caps a response at 1,000 rows, so whole-table reads go through `batchFetch`.
- `src/sweep/`, `src/pipelines/` — the Sweep Catcher basket producer (`run-sweep-basket.ts`).
- `.railway/railway.ts` — Railway IaC; each pipeline is a run-once cron service.

## Environment

| Variable | Used by |
|---|---|
| `SUPABASE_URL` | `src/db/client.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/db/client.ts` |
| `SIGNAL_ROUTER_URL` | `src/router/post-signal.ts` (POSTs to `$SIGNAL_ROUTER_URL/signals`) |
| `SIGNAL_ROUTER_API_KEY` | `src/router/post-signal.ts` (`x-api-key` header) |

The Kalshi client needs no credentials.

## Database types

`src/types/database/_generated/database.types.ts` is generated; never edit it by hand.
The initial copy was taken from the trading platform's generated file. Regenerate with
`npm run gen-types` (schemas: public, trading, kalshi_state, accounting, sweep_maker).
`sweep_maker` types appear once its migrations are applied; until then the script
warns that the schema is absent.
