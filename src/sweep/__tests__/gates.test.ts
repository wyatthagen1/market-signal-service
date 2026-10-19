import { SINGLE_EVENT_PROP, SPORTS_CONTEST } from '../candidates';
import { checkFreshness, checkSelectorParams, ScraperLog } from '../gates';

const START = new Date('2026-10-14T00:00:00Z');
const log = (status: string, completed: string): ScraperLog => ({ status, started_at: completed, completed_at: completed });

describe('freshness gate', () => {
    it('passes on a success that completed at or after today 00:00Z, and reports the lag', () => {
        const f = checkFreshness([log('success', '2026-10-13T23:05:00Z'), log('success', '2026-10-14T00:03:20Z')], START);
        expect(f).toMatchObject({ ok: true, lagMs: 200_000 });
        expect(checkFreshness([log('success', '2026-10-14T00:00:00Z')], START).ok).toBe(true);
    });

    it("fails on yesterday's success only", () => {
        const f = checkFreshness([log('success', '2026-10-13T23:59:59Z')], START);
        expect(f.ok).toBe(false);
        expect(f.detail).toMatch(/latest: success at 2026-10-13T23:59:59Z/);
    });

    it('a partial or failed run today does not count', () => {
        expect(checkFreshness([log('partial', '2026-10-14T00:02:00Z'), log('failed', '2026-10-14T00:01:00Z')], START).ok).toBe(false);
        expect(checkFreshness([], START)).toMatchObject({ ok: false, detail: 'no policy_markets_scraper log rows' });
    });
});

describe('selector params check', () => {
    const pilot = {
        min_legs: 5, max_cheap_c: 15, min_close_d: 3, max_event_close_d: 56, min_vol24h: 10,
        sports_contest_re: SPORTS_CONTEST.source, sports_single_event_prop_re: SINGLE_EVENT_PROP.source,
    };

    it('the pilot params are looser than the rule at a 56-day window, regexes equal', () => {
        const warn = jest.fn();
        expect(checkSelectorParams(pilot, 56, warn)).toEqual([]);
        expect(warn).not.toHaveBeenCalled();
    });

    it('a regex that differs from ours is a violation', () => {
        expect(checkSelectorParams({ ...pilot, sports_contest_re: 'GAME|MATCH' }, 56, jest.fn())[0]).toMatch(/sports_contest_re differs/);
        expect(checkSelectorParams({ ...pilot, sports_single_event_prop_re: `${SINGLE_EVENT_PROP.source} ` }, 56, jest.fn())).toHaveLength(1);
    });

    it('an absent regex only warns', () => {
        const { sports_contest_re: _a, sports_single_event_prop_re: _b, ...old } = pilot;
        const warn = jest.fn();
        expect(checkSelectorParams(old, 56, warn)).toEqual([]);
        expect(warn).toHaveBeenCalledTimes(2);
        expect(warn.mock.calls[0][0]).toMatch(/sports_contest_re is absent/);
    });

    it('rejects a universe tighter than the rule', () => {
        expect(checkSelectorParams({ ...pilot, max_cheap_c: 8 }, 56, jest.fn())).toEqual(['selector_params.max_cheap_c = 8, need >= 10']);
        expect(checkSelectorParams({ ...pilot, max_event_close_d: 28 }, 56)[0]).toMatch(/max_event_close_d = 28, need >= 56/);
        expect(checkSelectorParams({ ...pilot, min_close_d: 5, min_legs: 6 }, 56)).toHaveLength(2);
        expect(checkSelectorParams({ ...pilot, max_cheap_c: '15' }, 56)).toHaveLength(1);
        expect(checkSelectorParams(null, 56, jest.fn())).toEqual(['no market_filters row with selector = field_universe']);
    });
});
