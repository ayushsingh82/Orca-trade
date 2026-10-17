// LLM layer for Ask Orca + the market brief. Ported from MarketMind (lib/llm.ts).
// Uses any OpenAI-compatible endpoint from env. On any error or when unset,
// marketmind.ts falls back to the deterministic templated analysis. The LLM only
// ever explains and proposes; it never executes (see Orca's Risk Engine).

import type { AskResponse } from "./types";

// Any OpenAI-compatible endpoint, configured via env (AI_* are accepted aliases).
// Unset -> the caller falls back to the deterministic templated analysis.
const OAI_BASE_URL = process.env.OPENAI_BASE_URL ?? process.env.AI_BASE_URL ?? "";
const OAI_MODEL = process.env.OPENAI_MODEL ?? process.env.AI_MODEL ?? "gpt-4o-mini";
const OAI_API_KEY = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY ?? "local";

// Provider order: Anthropic Claude if ANTHROPIC_API_KEY is set, else the OpenAI-compatible endpoint.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";
const anthropicEnabled = () => ANTHROPIC_API_KEY !== "";
const modelName = () => (anthropicEnabled() ? ANTHROPIC_MODEL : OAI_MODEL);

export function hasLlmKey(): boolean {
  return anthropicEnabled() || OAI_BASE_URL !== "";
}

export function llmProviderLabel(): string {
  return `${anthropicEnabled() ? "Anthropic" : "OpenAI-compatible"} · ${modelName()}`;
}

const SYSTEM_PROMPT = `You are Orca's intelligence engine, a crypto market analyst.

Your job: explain WHY markets are moving, grounded ONLY in the structured data provided to you in the user turn. You never place trades and never give financial advice framed as a recommendation — you produce analysis a desk analyst would write, with explicit citations to the source data.

Rules:
- Ground every claim in the provided NEWS / SECTORS / MACRO / MARKET data. Do not invent prices, funding rates, flows, or events that are not in the context.
- If the data is thin or absent for the question, say so plainly and lower your confidence — do not fabricate.
- "citations" must reference real items from the provided news list (use their id + title + source).
- "contradictions" should surface genuine cross-source disagreement visible in the data (e.g. bullish headlines vs. negative sector breadth), not generic caveats.
- "confidence" is a float 0..1 reflecting how well the data supports the thesis.
- Keep prose tight and concrete. No hedging filler.

Respond with ONLY a JSON object, no prose around it, matching exactly this TypeScript shape:
{
  "thesis": string,                                   // 1-3 sentences, the core explanation
  "causes": string[],                                 // 2-4 concrete drivers, each grounded
  "evidence": { "label": string, "value": string, "source": string }[],  // 2-4 items pulled from the data
  "impact": string,                                   // what it means going forward, conditional
  "contradictions": string[],                         // 0-3 cross-source disagreements; [] if none
  "confidence": number,                               // 0..1
  "suggestions": string[],                            // 2-3 process notes (NOT orders)
  "citations": { "id": string, "title": string, "source": string }[]  // from the news list
}`;

export type LlmContext = {
  query: string;
  news: { id: string; title: string; source: string; sentiment?: string; conviction?: number; symbols?: string[]; publishedAt?: number }[];
  sectors: { sector: string; change24h: number; marketCap?: number }[];
  macro: { title: string; scheduledAt?: number; importance?: string }[];
  market: { symbol: string; price: number; change24h: number }[];
  etfFlows?: { symbol: string; date: string; totalNetInflow: number }[];
};

export type LlmResult = {
  analysis: AskResponse;
  source: string;
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };
};

function buildGroundingBlock(ctx: LlmContext): string {
  return [
    "GROUNDING DATA (use only this):",
    "",
    "## NEWS",
    JSON.stringify(ctx.news, null, 0),
    "",
    "## SECTORS (24h)",
    JSON.stringify(ctx.sectors, null, 0),
    "",
    "## MACRO CALENDAR",
    JSON.stringify(ctx.macro, null, 0),
    "",
    "## MARKET SNAPSHOT",
    JSON.stringify(ctx.market, null, 0),
    ...(ctx.etfFlows && ctx.etfFlows.length
      ? ["", "## ETF FLOWS (net, USD; negative = outflow)", JSON.stringify(ctx.etfFlows, null, 0)]
      : []),
  ].join("\n");
}

type ChatMessage = { role: string; content: string };
type ChatResult = { text: string; usage: { prompt_tokens?: number; completion_tokens?: number } };

async function postJson<T>(url: string, headers: Record<string, string>, body: unknown, label: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`${label} ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return (await res.json()) as T;
}

// Anthropic Messages API: the system prompt is a top-level field, not a message.
async function chatAnthropic(messages: ChatMessage[], maxTokens: number): Promise<ChatResult> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const json = await postJson<{
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  }>(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    {
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      temperature: 0.4,
      system,
      messages: messages.filter((m) => m.role !== "system"),
    },
    "Anthropic",
  );
  const text = (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  return { text, usage: { prompt_tokens: json.usage?.input_tokens, completion_tokens: json.usage?.output_tokens } };
}

async function chatOpenAI(messages: ChatMessage[], maxTokens: number): Promise<ChatResult> {
  const json = await postJson<{
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  }>(
    `${OAI_BASE_URL}/chat/completions`,
    { Authorization: `Bearer ${OAI_API_KEY}` },
    { model: OAI_MODEL, temperature: 0.4, max_tokens: maxTokens, messages },
    "LLM",
  );
  return { text: json.choices?.[0]?.message?.content ?? "", usage: json.usage ?? {} };
}

const chat = (messages: ChatMessage[], maxTokens: number) =>
  anthropicEnabled() ? chatAnthropic(messages, maxTokens) : chatOpenAI(messages, maxTokens);

export async function runMarketMindLLM(ctx: LlmContext): Promise<LlmResult> {
  const grounding = buildGroundingBlock(ctx);
  const { text, usage } = await chat(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `${grounding}\n\nQUESTION: ${ctx.query}\n\nReturn the JSON object now.` },
    ],
    1600,
  );
  const parsed = parseJsonObject(text);
  const analysis = coerceAnalysis(parsed, ctx);
  return {
    analysis,
    source: `${modelName()} (grounded)`,
    usage: {
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    },
  };
}

// Short plain-text tape brief grounded in the same context (dashboard header).
const BRIEF_SYSTEM = `You are Orca's crypto desk analyst. Ground every claim ONLY in the data provided. Never give trade recommendations. Write plain text, no headers, no bullet characters.`;

export async function generateBrief(ctx: LlmContext): Promise<{ text: string; live: boolean; source: string }> {
  const grounding = buildGroundingBlock(ctx);
  const user = `${grounding}\n\nWrite a 2-3 sentence market tape brief: what is driving crypto right now, the single clearest cross-source signal or disagreement in the data, and one thing to watch next.`;
  try {
    const { text } = await chat(
      [
        { role: "system", content: BRIEF_SYSTEM },
        { role: "user", content: user },
      ],
      220,
    );
    const trimmed = text.trim();
    if (!trimmed) return { text: "", live: false, source: "" };
    return { text: trimmed, live: true, source: `${modelName()} (brief)` };
  } catch {
    return { text: "", live: false, source: "" };
  }
}

// Extract the first balanced JSON object from the model text.
function parseJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM did not return a JSON object");
  }
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

// Defensively coerce the model output into a valid AskResponse, backfilling
// citations/sources from the grounding context so the UI never breaks.
function coerceAnalysis(raw: Record<string, unknown>, ctx: LlmContext): AskResponse {
  const asStrArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  const evidence = Array.isArray(raw.evidence)
    ? (raw.evidence as Record<string, unknown>[]).map((e) => ({
        label: String(e.label ?? "EVIDENCE"),
        value: String(e.value ?? ""),
        source: String(e.source ?? "SoSoValue"),
      }))
    : [];
  const citations = Array.isArray(raw.citations)
    ? (raw.citations as Record<string, unknown>[]).map((c) => ({
        id: String(c.id ?? ""),
        title: String(c.title ?? ""),
        source: String(c.source ?? "SoSoValue"),
      }))
    : ctx.news.slice(0, 3).map((n) => ({ id: n.id, title: n.title, source: n.source }));

  let confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.6;
  if (confidence > 1) confidence = confidence / 100;
  confidence = Math.max(0.05, Math.min(0.98, confidence));

  return {
    thesis: String(raw.thesis ?? "Insufficient grounded data to form a confident thesis."),
    causes: asStrArr(raw.causes),
    evidence: evidence.length ? evidence : ctx.news.slice(0, 3).map((n) => ({ label: (n.sentiment ?? "news").toUpperCase(), value: n.title, source: n.source })),
    impact: String(raw.impact ?? ""),
    contradictions: asStrArr(raw.contradictions),
    confidence,
    suggestions: asStrArr(raw.suggestions),
    sources: {
      newsCount: ctx.news.length,
      marketPoints: ctx.market.length,
      macroEvents: ctx.macro.length,
    },
    citations,
  };
}
