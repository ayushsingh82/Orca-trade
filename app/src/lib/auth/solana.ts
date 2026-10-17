import bs58 from "bs58";
import nacl from "tweetnacl";

/** The exact text the wallet signs. Binds the signature to this app, a nonce and an expiry. */
export function signInMessage(args: { domain: string; wallet: string; nonce: string }) {
  return [
    `${args.domain} wants you to sign in with your Solana account:`,
    args.wallet,
    "",
    "Sign in to Orca. This does not trigger a transaction or cost anything.",
    "",
    `Nonce: ${args.nonce}`,
  ].join("\n");
}

/** Verifies an ed25519 signature over `message` against a base58 Solana public key. */
export function verifyWalletSignature(args: { wallet: string; message: string; signature: string }) {
  try {
    const publicKey = bs58.decode(args.wallet);
    const signature = bs58.decode(args.signature);
    if (publicKey.length !== 32 || signature.length !== 64) return false;
    return nacl.sign.detached.verify(new TextEncoder().encode(args.message), signature, publicKey);
  } catch {
    return false;
  }
}
