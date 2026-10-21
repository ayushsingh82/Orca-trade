/**
 * Smoke test against a running server: `npm run smoke` (BASE_URL defaults to http://localhost:3000).
 * Checks that public pages render, token search works, and sign-in is refused while the beta gate is closed.
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const gateClosed = process.env.NEXT_PUBLIC_SIGNUP_ENABLED !== "1";
let failed = 0;

async function check(name: string, fn: () => Promise<string | null>) {
  try {
    const problem = await fn();
    console.log(`${problem ? "FAIL" : "ok  "} ${name}${problem ? `: ${problem}` : ""}`);
    if (problem) failed++;
  } catch (e) {
    console.log(`FAIL ${name}: ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}

const page = (path: string, mustContain?: string) =>
  check(`GET ${path}`, async () => {
    const res = await fetch(BASE + path, { signal: AbortSignal.timeout(90_000) });
    if (res.status !== 200) return `status ${res.status}`;
    const html = await res.text();
    return mustContain && !html.includes(mustContain) ? `missing "${mustContain}"` : null;
  });

async function main() {
  await page("/", "Orca");
  await page("/login", gateClosed ? "Beta access coming soon" : undefined);
  for (const p of ["/markets", "/research", "/flow", "/dashboard", "/sentiment", "/bots", "/news", "/sectors", "/indices"]) await page(p);
  await page("/flow?symbol=SOL", "SOL");
  await check("GET /api/tokens/search?q=sol", async () => {
    const j = (await (await fetch(`${BASE}/api/tokens/search?q=sol`)).json()) as { ok: boolean; results?: unknown[] };
    return j.ok && (j.results?.length ?? 0) > 0 ? null : "no results";
  });
  for (const r of ["login", "signup", "nonce", "wallet", "privy"]) {
    await check(`POST /api/auth/${r} is ${gateClosed ? "refused (503)" : "reachable"}`, async () => {
      const res = await fetch(`${BASE}/api/auth/${r}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      return gateClosed ? (res.status === 503 ? null : `status ${res.status}`) : res.status === 503 ? "still gated" : null;
    });
  }
  console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
  process.exit(failed ? 1 : 0);
}
void main();
