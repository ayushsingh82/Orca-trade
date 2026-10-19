/** Step 1 of scripts/withdraw-e2e.ts: writes an agent wallet holding 100 USDC and 0.5 wBTC for the local validator to load. */
import { mkdirSync, writeFileSync } from "node:fs";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";

const DIR = "/tmp/orca-withdraw-e2e";
const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const WBTC = new PublicKey("3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh");
const agent = Keypair.generate();
const owner = Keypair.generate();

function tokenAccount(mint: PublicKey, amount: bigint) {
  const ata = getAssociatedTokenAddressSync(mint, agent.publicKey);
  const data = Buffer.alloc(165); // SPL token account layout
  mint.toBuffer().copy(data, 0);
  agent.publicKey.toBuffer().copy(data, 32);
  data.writeBigUInt64LE(amount, 64);
  data[108] = 1; // initialized
  return {
    pubkey: ata.toBase58(),
    account: { lamports: 2039280, data: [data.toString("base64"), "base64"], owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", executable: false, rentEpoch: 0, space: 165 },
  };
}

mkdirSync(DIR, { recursive: true });
const usdcAcc = tokenAccount(USDC, BigInt(100_000_000)); // 100 USDC (6 decimals)
const btcAcc = tokenAccount(WBTC, BigInt(50_000_000)); // 0.5 wBTC (8 decimals)
writeFileSync(`${DIR}/usdc-ata.json`, JSON.stringify(usdcAcc));
writeFileSync(`${DIR}/btc-ata.json`, JSON.stringify(btcAcc));
writeFileSync(`${DIR}/keys.json`, JSON.stringify({ agent: Array.from(agent.secretKey), owner: Array.from(owner.secretKey) }));
console.log(`USDC_ATA=${usdcAcc.pubkey}\nBTC_ATA=${btcAcc.pubkey}`);
