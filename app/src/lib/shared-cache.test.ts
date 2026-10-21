import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { sharedCacheEnabled, sharedGet, sharedSet } from "./shared-cache";

const realFetch = globalThis.fetch;
let calls: { body: unknown[] }[] = [];

beforeEach(() => {
  calls = [];
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "t";
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe("shared cache", () => {
  it("is a no-op without credentials", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    let hit = false;
    globalThis.fetch = (async () => ((hit = true), new Response("{}"))) as typeof fetch;
    assert.equal(sharedCacheEnabled(), false);
    assert.equal(await sharedGet("k"), null);
    await sharedSet("k", 1, 60);
    assert.equal(hit, false);
  });

  it("round-trips a value through the REST API", async () => {
    let stored: string | null = null;
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as string[];
      calls.push({ body });
      if (body[0] === "SET") stored = body[2];
      return new Response(JSON.stringify({ result: body[0] === "GET" ? stored : "OK" }));
    }) as typeof fetch;
    await sharedSet("path", { a: 1 }, 1800, 1000);
    assert.deepEqual(calls[0].body.slice(0, 2), ["SET", "orca:path"]);
    assert.deepEqual(calls[0].body.slice(3), ["EX", 1800]);
    assert.deepEqual(await sharedGet("path"), { at: 1000, data: { a: 1 } });
  });

  it("swallows upstream failures", async () => {
    globalThis.fetch = (async () => new Response("no", { status: 500 })) as typeof fetch;
    assert.equal(await sharedGet("k"), null);
    await sharedSet("k", 1, 60); // must not throw
  });
});
