/** Step 1 of scripts/usdc-e2e.ts: writes a payer token account holding 1,000 USDC for the local validator to load. */
import { mkdirSync, writeFileSync } from "node:fs";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";

const DIR = "/tmp/orca-usdc-e2e";
const MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const payer = Keypair.generate();
const treasury = Keypair.generate();
const ata = getAssociatedTokenAddressSync(MINT, payer.publicKey);
const data = Buffer.alloc(165); // SPL token account layout
MINT.toBuffer().copy(data, 0);
payer.publicKey.toBuffer().copy(data, 32);
data.writeBigUInt64LE(BigInt(1_000_000_000), 64);
data[108] = 1; // initialized
mkdirSync(DIR, { recursive: true });
writeFileSync(
  `${DIR}/payer-ata.json`,
  JSON.stringify({
    pubkey: ata.toBase58(),
    account: { lamports: 2039280, data: [data.toString("base64"), "base64"], owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", executable: false, rentEpoch: 0, space: 165 },
  }),
);
writeFileSync(`${DIR}/keys.json`, JSON.stringify({ payer: Array.from(payer.secretKey), treasury: treasury.publicKey.toBase58(), payerAta: ata.toBase58() }));
console.log(`payerAta=${ata.toBase58()}\ntreasury=${treasury.publicKey.toBase58()}`);
