import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { Keypair } from "@solana/web3.js";

function key() {
  const secret = process.env.AGENT_KEY_SECRET;
  if (!secret || secret.length < 32) throw new Error("AGENT_KEY_SECRET must be set (>= 32 chars)");
  return scryptSync(secret, "orca-agent-signer", 32);
}

/** Creates a fresh agent signer. The secret key is encrypted at rest (AES-256-GCM). */
export function createAgentSigner() {
  const kp = Keypair.generate();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(kp.secretKey)), cipher.final()]);
  const enc = [iv, cipher.getAuthTag(), ct].map((b) => b.toString("hex")).join(":");
  return { publicKey: kp.publicKey.toBase58(), secretEnc: enc };
}

export function loadAgentKeypair(secretEnc: string): Keypair {
  const [iv, tag, ct] = secretEnc.split(":").map((h) => Buffer.from(h, "hex"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Keypair.fromSecretKey(Buffer.concat([decipher.update(ct), decipher.final()]));
}
