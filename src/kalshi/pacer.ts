/** Serialises callers to at most one request per `minIntervalMs`. */
export class Pacer {
    private next = 0;

    constructor(private readonly minIntervalMs: number) {}

    async wait(): Promise<void> {
        const now = Date.now();
        const slot = Math.max(now, this.next);
        this.next = slot + this.minIntervalMs;
        if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));
    }
}

/** Process-wide pacer for Kalshi public GETs: ≤3 req/s with margin. */
export const kalshiPublicPacer = new Pacer(350);
