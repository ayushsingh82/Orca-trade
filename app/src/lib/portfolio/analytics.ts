/** One filled paper trade. `units` is signed: positive for buys, negative for sells. */
export type FillRow = { at: number; asset: string; units: number; price: number };

export type PositionStat = {
  asset: string;
  units: number;
  /** Average cost per unit of what is still held. */
  avgCost: number;
  costBasis: number;
  value: number;
  unrealizedUsd: number;
  unrealizedPct: number;
};

export type PortfolioStats = {
  cashUsd: number;
  equityUsd: number;
  pnlUsd: number;
  pnlPct: number;
  realizedUsd: number;
  unrealizedUsd: number;
  trades: number;
  /** Sells that closed (part of) a position. */
  closedTrades: number;
  wins: number;
  winRate: number | null;
  positions: PositionStat[];
  /** Equity at the start, after each fill, and now. Oldest first. */
  curve: number[];
};

/**
 * Rebuilds a paper book from its fills using average cost. Marked to `prices` (USD per unit) for the live view;
 * the equity curve marks each asset at the last price it traded at, so it only uses prices we really saw.
 */
export function analyzeFills(startUsd: number, fills: FillRow[], prices: Record<string, number>): PortfolioStats {
  const ordered = [...fills].sort((a, b) => a.at - b.at);
  let cash = startUsd;
  let realized = 0;
  let closed = 0;
  let wins = 0;
  const held: Record<string, { units: number; cost: number }> = {};
  const lastSeen: Record<string, number> = {};
  const curve = [startUsd];

  for (const f of ordered) {
    const p = (held[f.asset] ??= { units: 0, cost: 0 });
    lastSeen[f.asset] = f.price;
    cash -= f.units * f.price;
    if (f.units > 0) {
      p.units += f.units;
      p.cost += f.units * f.price;
    } else if (f.units < 0 && p.units > 0) {
      const sold = Math.min(-f.units, p.units);
      const avg = p.cost / p.units;
      const pnl = (f.price - avg) * sold;
      realized += pnl;
      closed++;
      if (pnl > 0) wins++;
      p.units -= sold;
      p.cost -= avg * sold;
      if (p.units < 1e-12) {
        p.units = 0;
        p.cost = 0;
      }
    }
    curve.push(cash + Object.entries(held).reduce((s, [a, h]) => s + h.units * (lastSeen[a] ?? 0), 0));
  }

  const positions: PositionStat[] = Object.entries(held)
    .filter(([, h]) => h.units > 1e-12)
    .map(([asset, h]) => {
      const mark = prices[asset] ?? lastSeen[asset] ?? 0;
      const value = h.units * mark;
      return { asset, units: h.units, avgCost: h.cost / h.units, costBasis: h.cost, value, unrealizedUsd: value - h.cost, unrealizedPct: h.cost > 0 ? ((value - h.cost) / h.cost) * 100 : 0 };
    })
    .sort((a, b) => b.value - a.value);

  const holdings = positions.reduce((s, p) => s + p.value, 0);
  const equity = cash + holdings;
  curve.push(equity);
  return {
    cashUsd: cash,
    equityUsd: equity,
    pnlUsd: equity - startUsd,
    pnlPct: startUsd > 0 ? ((equity - startUsd) / startUsd) * 100 : 0,
    realizedUsd: realized,
    unrealizedUsd: positions.reduce((s, p) => s + p.unrealizedUsd, 0),
    trades: ordered.length,
    closedTrades: closed,
    wins,
    winRate: closed > 0 ? (wins / closed) * 100 : null,
    positions,
    curve,
  };
}

export type Slice = { label: string; value: number };

/** Allocation percentages, largest first. Zero and negative slices are dropped. */
export function allocation(slices: Slice[]): { label: string; value: number; pct: number }[] {
  const pos = slices.filter((s) => s.value > 0.005);
  const total = pos.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return [];
  return pos.map((s) => ({ ...s, pct: (s.value / total) * 100 })).sort((a, b) => b.value - a.value);
}
