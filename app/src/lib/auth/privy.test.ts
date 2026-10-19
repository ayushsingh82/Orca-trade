import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickIdentity } from "./privy";

describe("pickIdentity", () => {
  it("reads the verified email and the embedded Solana wallet", () => {
    const id = pickIdentity({
      id: "did:privy:abc",
      linkedAccounts: [
        { type: "email", address: "Ayush@Example.com" },
        { type: "wallet", address: "0xabc", chainType: "ethereum", walletClientType: "privy" },
        { type: "wallet", address: "SoLembedded111111111111111111111111111111111", chainType: "solana", walletClientType: "privy" },
      ],
    });
    assert.deepEqual(id, { privyId: "did:privy:abc", email: "ayush@example.com", wallet: "SoLembedded111111111111111111111111111111111" });
  });
  it("prefers the embedded wallet over an external one", () => {
    const id = pickIdentity({
      id: "d",
      linkedAccounts: [
        { type: "wallet", address: "external", chainType: "solana", walletClientType: "phantom" },
        { type: "wallet", address: "embedded", chainType: "solana", walletClientType: "privy" },
      ],
    });
    assert.equal(id.wallet, "embedded");
  });
  it("falls back to an external Solana wallet when there is no embedded one", () => {
    assert.equal(pickIdentity({ id: "d", linkedAccounts: [{ type: "wallet", address: "ext", chainType: "solana", walletClientType: "phantom" }] }).wallet, "ext");
  });
  it("returns nulls for a user with nothing linked", () => {
    assert.deepEqual(pickIdentity({ id: "d", linkedAccounts: [] }), { privyId: "d", email: null, wallet: null });
  });
});
