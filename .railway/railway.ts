import { defineRailway, github, preserve, project, service } from "railway/iac";

// Scoped to the declared service so omit-equals-delete can't reach anything else in the
// project. Config-as-Code tomls are deprecated (cutoff 2026-12-01), so this repo has none.
export const partial = "sweep-basket";

export default defineRailway(() => {
    const sweepBasket = service("sweep-basket", {
        source: github("wyatthagen1/market-signal-service", { branch: "main" }),
        build: "npm install && npm run build",
        start: "node dist/pipelines/run-sweep-basket.js",
        deploy: {
            // 00:30Z: after the 23:45Z field-universe refresh and the 00:00Z markets scrape.
            cronSchedule: "30 0 * * *",
            restartPolicyType: "NEVER",
        },
        env: {
            SUPABASE_URL: preserve(),
            SUPABASE_SERVICE_ROLE_KEY: preserve(),
            SIGNAL_ROUTER_URL: preserve(),
            SIGNAL_ROUTER_API_KEY: preserve(),
            // Sleeve S doesn't exist yet; set SWEEP_SLEEVE_ID (or SWEEP_POLICY_ID) once it does.
            SWEEP_SLEEVE_ID: preserve(),
            SWEEP_WINDOW_DAYS: "56",
            SWEEP_S: "1",
        },
    });

    return project("market-signal-service", { resources: [sweepBasket] });
});
