import { applyFieldPredicate, EventRow, isFieldStrike, MarketRow, PredicateInput, SeriesRow, SINGLE_EVENT_PROP } from '../candidates';

const DAY = 86_400_000;
const START = new Date('2026-10-14T00:00:00Z');
const at = (days: number) => new Date(START.getTime() + days * DAY).toISOString();

const market = (ticker: string, event: string, over: Partial<MarketRow> = {}): MarketRow => ({
    ticker, event_ticker: event, status: 'active', close_time: at(20), strike_type: 'custom',
    mve_collection_ticker: null, yes_bid: 3, yes_ask: 5, ...over,
});

function world(opts: {
    category?: string; seriesTicker?: string; seriesTitle?: string; event?: string;
    legs?: Partial<MarketRow>[]; target?: Partial<MarketRow>; windowDays?: number;
}): PredicateInput {
    const event = opts.event ?? 'KXNBATEAM-26LBJ';
    const seriesTicker = opts.seriesTicker ?? 'KXNBATEAM';
    const target = market(`${event}-A`, event, opts.target);
    const siblings = (opts.legs ?? [{}, {}, {}, {}]).map((o, i) => market(`${event}-S${i}`, event, o));
    const events: EventRow[] = [{ event_ticker: event, series_ticker: seriesTicker, mutually_exclusive: true }];
    const series: SeriesRow[] = [{ ticker: seriesTicker, title: opts.seriesTitle ?? 'Next team', category: opts.category ?? 'Sports', fee_type: 'quadratic' }];
    return {
        tickers: [target.ticker],
        markets: new Map([target, ...siblings].map((m) => [m.ticker, m])),
        eventLegs: new Map([[event, [target, ...siblings]]]),
        events: new Map(events.map((e) => [e.event_ticker, e])),
        series: new Map(series.map((s) => [s.ticker, s])),
        dayStart: START,
        windowDays: opts.windowDays ?? 56,
    };
}

const verdict = (input: PredicateInput) => {
    const r = applyFieldPredicate(input);
    return r.legs.length ? 'pass' : r.excluded.get(input.tickers[0]);
};

describe('fine field predicate', () => {
    it('a 5-leg custom-strike next-team event closing in 20 d passes, with the event close and leg count', () => {
        const input = world({ legs: [{}, {}, {}, { close_time: at(40) }] });
        const { legs } = applyFieldPredicate(input);
        expect(legs).toHaveLength(1);
        expect(legs[0]).toMatchObject({ legsInEvent: 5, mutuallyExclusive: true, category: 'Sports', feeType: 'quadratic', seriesTicker: 'KXNBATEAM' });
        expect(legs[0].eventCloseAt.toISOString()).toBe(at(40));
    });

    it('a null strike is a field leg (common.archetype); structured too; anything else is a numeric ladder', () => {
        expect(isFieldStrike(null)).toBe(true);
        expect(isFieldStrike('structured')).toBe(true);
        expect(verdict(world({ target: { strike_type: null }, legs: [{ strike_type: null }, {}, {}, {}] }))).toBe('pass');
        for (const s of ['greater', 'less', 'between', 'greater_or_equal', 'functional']) {
            expect(verdict(world({ target: { strike_type: s } }))).toBe('numeric_ladder');
        }
    });

    it('needs ≥ 5 live field legs: closed, MVE or ladder siblings do not count', () => {
        expect(verdict(world({ legs: [{}, {}, {}] }))).toBe('few_legs');
        expect(verdict(world({ legs: [{}, {}, {}, { status: 'finalized' }] }))).toBe('few_legs');
        expect(verdict(world({ legs: [{}, {}, {}, { mve_collection_ticker: 'X' }] }))).toBe('few_legs');
        expect(verdict(world({ legs: [{}, {}, {}, { strike_type: 'greater' }] }))).toBe('few_legs');
    });

    it('SINGLE_EVENT_PROP excludes Sports events only, matched on the event ticker', () => {
        expect(verdict(world({ event: 'KXNFLFIRSTTD-26OCT19KCLV' }))).toBe('single_event_prop');
        expect(verdict(world({ event: 'KXPGATOUR-26RSMC' }))).toBe('single_event_prop');
        expect(verdict(world({ event: 'KXMRBEASTGAMES-26', category: 'Entertainment' }))).toBe('pass');
        expect(SINGLE_EVENT_PROP.test('KXPRIMARYMOV-26')).toBe(true);
        expect(verdict(world({ event: 'KXPRIMARYMOV-26', category: 'Elections' }))).toBe('pass');
    });

    it('Sports contests (series ticker or title) and Mentions are not fields', () => {
        expect(verdict(world({ seriesTicker: 'KXNBAGAME' }))).toBe('contest');
        expect(verdict(world({ seriesTitle: 'Boxing bout winner' }))).toBe('contest');
        expect(verdict(world({ seriesTitle: 'Game of the year', category: 'Entertainment' }))).toBe('pass');
        expect(verdict(world({ category: 'Mentions' }))).toBe('mentions');
    });

    it('leg close ≥ 3 d after the day start, inclusive', () => {
        expect(verdict(world({ target: { close_time: at(3) } }))).toBe('pass');
        expect(verdict(world({ target: { close_time: new Date(START.getTime() + 3 * DAY - 1).toISOString() } }))).toBe('leg_close');
    });

    it('event close = max leg close ≤ windowDays, inclusive; a later sibling drags the event out', () => {
        expect(verdict(world({ legs: [{}, {}, {}, { close_time: at(56) }] }))).toBe('pass');
        expect(verdict(world({ legs: [{}, {}, {}, { close_time: at(57) }] }))).toBe('event_close');
        expect(verdict(world({ legs: [{}, {}, {}, { close_time: at(57) }], windowDays: 28 }))).toBe('event_close');
        expect(verdict(world({ legs: [{}, {}, {}, {}, { close_time: at(57), status: 'closed' }] }))).toBe('event_close');
    });

    it('every ticker gets a leg or exactly one reason', () => {
        const input = world({});
        input.tickers = [...input.tickers, 'MISSING-1'];
        const r = applyFieldPredicate(input);
        expect(r.legs.length + r.excluded.size).toBe(2);
        expect(r.excluded.get('MISSING-1')).toBe('not_in_kalshi_state');
        expect(verdict(world({ target: { status: 'closed' } }))).toBe('inactive');
        expect(verdict(world({ target: { mve_collection_ticker: 'KXMVE' } }))).toBe('mve');
    });
});
