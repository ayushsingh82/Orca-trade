/** One-click starter agents. They start in paper + observe mode, so they report live setups and never trade. */
export type Starter = { name: string; strategy: "momentum" | "narrative_rotation" | "rsi_reversion"; blurb: string; data: string };

export const STARTERS: Starter[] = [
  { name: "Momentum Scout", strategy: "momentum", blurb: "Follows the strongest 7d and 14d trend confirmed by news.", data: "Live prices, trend and news" },
  { name: "News Rotator", strategy: "narrative_rotation", blurb: "Only acts on moves backed by fresh headlines.", data: "Live headlines and sector breadth" },
  { name: "RSI Dip Watcher", strategy: "rsi_reversion", blurb: "Flags oversold dips inside a healthy trend, and overbought exits.", data: "Live RSI on 1h, 4h, 24h and 7d" },
];

export const STARTER_POLICY = { mode: "observe", maxTradeUsd: 25, maxDailyUsd: 100, minConviction: 60 } as const;
