import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseWaitlist } from "./waitlist";

describe("parseWaitlist", () => {
  it("normalises a valid email and defaults to Pro", () => {
    assert.deepEqual(parseWaitlist({ email: "  Ayush@Example.COM " }), { email: "ayush@example.com", plan: "pro" });
  });
  it("accepts Teams and ignores unknown plans", () => {
    assert.equal((parseWaitlist({ email: "a@b.co", plan: "teams" }) as { plan: string }).plan, "teams");
    assert.equal((parseWaitlist({ email: "a@b.co", plan: "enterprise" }) as { plan: string }).plan, "pro");
  });
  it("rejects bad emails", () => {
    for (const email of ["", "nope", "a@b", "a b@c.com", "@c.com", 5, null, undefined, "x".repeat(250) + "@a.com"]) {
      assert.equal(typeof parseWaitlist({ email }), "string", String(email));
    }
  });
  it("rejects a missing body", () => {
    assert.equal(typeof parseWaitlist(undefined), "string");
  });
});
