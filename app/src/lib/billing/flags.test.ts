import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { signupClosedResponse, signupOpen } from "./flags";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SIGNUP_ENABLED;
});

describe("sign-up gate", () => {
  it("is closed by default and answers 503", async () => {
    assert.equal(signupOpen(), false);
    const res = signupClosedResponse();
    assert.equal(res?.status, 503);
    assert.equal(((await res?.json()) as { ok: boolean }).ok, false);
  });

  it("opens only when the flag is exactly 1", () => {
    process.env.NEXT_PUBLIC_SIGNUP_ENABLED = "true";
    assert.equal(signupOpen(), false);
    process.env.NEXT_PUBLIC_SIGNUP_ENABLED = "1";
    assert.equal(signupOpen(), true);
    assert.equal(signupClosedResponse(), null);
  });
});
