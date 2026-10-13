"""Parity fixture for market-signal-service's sweep features (PRD — Sweep Catcher, 1.8).

Picks 20 offer-days from strategy/offer_days.csv.gz (the research output), trims each leg's raw
tape to [day - 15d, day + 1d), recomputes p0 / trades-per-day / week high with the exact index
math of strategy_doc.simulate (float32 packing, stable time sort, searchsorted), asserts they
match the research row, and adds sweep days over the prior 14 days per strategy doc 5.9.

Sweep days have no committed research code; the definition here is the doc's text: a UTC day
counts if any cheap-side taker buy printed >= 15c above that day's count-weighted VWAP
(cheap-side terms, all prints that day).

Writes fixture.json (tape + expected) for M's jest suite.

A copy for provenance: run it from bellman/out/research/event_driven/sweep_parity/ (it reads the
research outputs relative to that folder), then copy fixture.json to bellman-parity.json here."""
from __future__ import annotations

import csv
import gzip
import json
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

OUT = Path(__file__).resolve().parents[1]
DAY = 86400
KEEP = ("trade_id", "created_time", "yes_price_dollars", "count_fp", "taker_side", "is_block_trade")


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()


def pack(rows):
    t = np.array([ts(r["created_time"]) for r in rows], np.float64)
    yes = np.array([float(r["yes_price_dollars"]) * 100 for r in rows], np.float32)
    cnt = np.array([float(r["count_fp"]) for r in rows], np.float32)
    tky = np.array([r["taker_side"] == "yes" for r in rows], bool)
    order = np.lexsort((t,))
    return t[order], yes[order].astype(float), cnt[order].astype(float), tky[order]


def features(rows, side, day):
    t, yes, cnt, tky = pack(rows)
    start = datetime.fromisoformat(day).replace(tzinfo=timezone.utc).timestamp()
    qp = yes if side == "yes" else 100 - yes
    buys = tky if side == "yes" else ~tky
    k = np.searchsorted(t, start) - 1
    k7 = np.searchsorted(t, start - 7 * DAY)
    out = {"p0": float(qp[k]) if k >= 0 else None, "tpd": (k + 1 - k7) / 7,
           "week_high": float(qp[k7:k + 1].max()) if k + 1 > k7 else None}
    # Tie at the last pre-start timestamp with differing prices: p0 depends on intra-tie order.
    out["p0_tie"] = bool(k >= 1 and t[k - 1] == t[k] and qp[k - 1] != qp[k])
    sweeps = 0
    for j in range(1, 15):
        lo, hi = start - j * DAY, start - (j - 1) * DAY
        sel = (t >= lo) & (t < hi)
        if not sel.any():
            continue
        vwap = (qp[sel] * cnt[sel]).sum() / cnt[sel].sum()
        if (buys[sel] & (qp[sel] >= vwap + 15)).any():
            sweeps += 1
    out["sweep_days_14d"] = sweeps
    return out


def main():
    rows = list(csv.DictReader(gzip.open(OUT / "strategy" / "offer_days.csv.gz", "rt")))
    strata = {}
    for r in rows:
        key = (r["side"], float(r["week_high"]) >= 30, float(r["tpd"]) < 16)
        strata.setdefault(key, []).append(r)
    rng = random.Random(20261014)
    picks, seen = [], set()
    per = {k: (4 if k[0] == "yes" and not k[1] else 2) for k in strata}
    for key in sorted(strata):
        pool = [r for r in strata[key] if float(r["tpd"]) <= 40]
        rng.shuffle(pool)
        n = 0
        for r in pool:
            if n >= per[key] or r["ticker"] in seen:
                continue
            f = OUT / "tape" / r["event"] / f"{r['ticker']}.jsonl.gz"
            if not f.exists():
                continue
            seen.add(r["ticker"])
            picks.append((r, f))
            n += 1
    cases = []
    for r, f in picks:
        tape = [json.loads(line) for line in gzip.open(f, "rt")]
        start = datetime.fromisoformat(r["day"]).replace(tzinfo=timezone.utc).timestamp()
        trimmed = [{k: x.get(k) for k in KEEP} for x in tape
                   if start - 15 * DAY <= ts(x["created_time"]) < start + DAY]
        full = features(tape, r["side"], r["day"])
        cut = features(trimmed, r["side"], r["day"])
        assert full == cut, (r["ticker"], full, cut)
        assert abs(full["p0"] - float(r["p0"])) < 1e-6, (r["ticker"], full["p0"], r["p0"])
        assert abs(round(full["tpd"], 2) - float(r["tpd"])) < 1e-9, (r["ticker"], full["tpd"], r["tpd"])
        assert abs(full["week_high"] - float(r["week_high"])) < 1e-6, (r["ticker"], full["week_high"], r["week_high"])
        cases.append({"ticker": r["ticker"], "event": r["event"], "category": r["category"], "side": r["side"],
                      "basket_date": r["day"], "expected": full,
                      "trades": [[x[k] for k in KEEP] for x in trimmed]})
    dest = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name("fixture.json")
    dest.write_text(json.dumps({"source": "bellman research/event_driven strategy/offer_days.csv.gz + tape/",
                                "generated_by": "out/research/event_driven/sweep_parity/make_fixture.py",
                                "trade_columns": list(KEEP),
                                "cases": cases}, separators=(",", ":")))
    print(f"{len(cases)} cases, {sum(len(c['trades']) for c in cases)} prints, "
          f"{sum(c['expected']['p0_tie'] for c in cases)} p0 ties, "
          f"sweep-day counts {[c['expected']['sweep_days_14d'] for c in cases]} -> {dest}")


if __name__ == "__main__":
    main()
