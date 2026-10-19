import { eq } from "drizzle-orm";
import { PrivyClient } from "@privy-io/server-auth";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { resolveReferrer } from "./referral";

export const privyConfigured = () => Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);

export type PrivyIdentity = { privyId: string; email: string | null; wallet: string | null };

type LinkedAccount = { type: string; address?: string; chainType?: string; walletClientType?: string };

/**
 * Pure: picks the email and the Solana wallet from a Privy user's linked accounts. An embedded Orca wallet
 * (walletClientType "privy") wins over an external wallet the user also linked.
 */
export function pickIdentity(user: { id: string; linkedAccounts: LinkedAccount[] }): PrivyIdentity {
  const email = user.linkedAccounts.find((a) => a.type === "email" && a.address)?.address?.toLowerCase() ?? null;
  const solana = user.linkedAccounts.filter((a) => a.type === "wallet" && a.chainType === "solana" && a.address);
  const wallet = (solana.find((a) => a.walletClientType === "privy") ?? solana[0])?.address ?? null;
  return { privyId: user.id, email, wallet };
}

let client: PrivyClient | null = null;

/** Verifies a Privy access token and reads the user's verified email and Solana wallet from Privy. */
export async function verifyPrivyToken(token: string): Promise<PrivyIdentity> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const secret = process.env.PRIVY_APP_SECRET;
  if (!appId || !secret) throw new Error("Privy is not configured");
  client ??= new PrivyClient(appId, secret);
  const claims = await client.verifyAuthToken(token); // throws on a bad, expired or foreign-app token
  const user = await client.getUser(claims.userId);
  return pickIdentity(user as unknown as { id: string; linkedAccounts: LinkedAccount[] });
}

/**
 * Finds or creates the Orca user for a Privy identity, in this order: Privy id, wallet, email. An existing
 * password or wallet account is linked rather than duplicated. A wallet or email already owned by a different
 * Orca user is never reassigned.
 */
export async function upsertPrivyUser(identity: PrivyIdentity, ref?: string): Promise<User> {
  const byId = await db().select().from(users).where(eq(users.privyId, identity.privyId)).limit(1);
  let user = byId[0];
  if (!user && identity.wallet) user = (await db().select().from(users).where(eq(users.wallet, identity.wallet)).limit(1))[0];
  if (!user && identity.email) user = (await db().select().from(users).where(eq(users.email, identity.email)).limit(1))[0];

  if (!user) {
    const [created] = await db()
      .insert(users)
      .values({ privyId: identity.privyId, email: identity.email, wallet: identity.wallet, referredBy: await resolveReferrer(ref) })
      .returning();
    return created;
  }

  // Fill in what is missing, but never take a wallet or email that belongs to someone else.
  const patch: Partial<typeof users.$inferInsert> = {};
  if (!user.privyId) patch.privyId = identity.privyId;
  if (!user.wallet && identity.wallet) {
    const taken = await db().select({ id: users.id }).from(users).where(eq(users.wallet, identity.wallet)).limit(1);
    if (!taken.length) patch.wallet = identity.wallet;
  }
  if (!user.email && identity.email) {
    const taken = await db().select({ id: users.id }).from(users).where(eq(users.email, identity.email)).limit(1);
    if (!taken.length) patch.email = identity.email;
  }
  if (Object.keys(patch).length === 0) return user;
  const [updated] = await db().update(users).set(patch).where(eq(users.id, user.id)).returning();
  return updated;
}
