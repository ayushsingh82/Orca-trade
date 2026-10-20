import { PageHeader } from "@/components/page-header";
import { WalletActions } from "@/components/wallet-actions";
import { getUser } from "@/lib/auth/session";
import { readWalletBalances } from "@/lib/exec/wallet";
import { BetaLink } from "@/components/beta-link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wallet" };

export default async function WalletPage() {
  const user = await getUser();
  if (!user) {
    return (
      <>
        <PageHeader title="Wallet" description="Sign in to see your wallet." />
        <BetaLink className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
          Sign in
        </BetaLink>
      </>
    );
  }
  if (!user.wallet) {
    return (
      <>
        <PageHeader title="Wallet" description="You do not have a wallet yet." />
        <p className="max-w-lg text-sm text-muted-foreground">
          Sign out and sign in with email or Google to get a Solana wallet created for you, or sign in with a wallet you already own.
        </p>
      </>
    );
  }
  let balances: { sol: number; usdc: number } | null = null;
  try {
    balances = await readWalletBalances(user.wallet);
  } catch {
    balances = null;
  }
  return (
    <>
      <PageHeader title="Wallet" description="Your Solana wallet. Fund it, then use it to fund your agents." />
      <section className="max-w-2xl rounded-xl border bg-card p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Deposit address (Solana)</p>
        <p className="mt-2 break-all font-mono text-sm">{user.wallet}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-muted p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">USDC</p>
            <p className="mt-1 font-display text-2xl font-semibold">{balances ? balances.usdc.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}</p>
          </div>
          <div className="rounded-lg border bg-muted p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">SOL</p>
            <p className="mt-1 font-display text-2xl font-semibold">{balances ? balances.sol.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"}</p>
          </div>
        </div>
        {!balances && <p className="mt-3 text-xs text-amber-400">Could not read balances right now.</p>}
        <WalletActions address={user.wallet} />
        <p className="mt-5 text-xs text-muted-foreground">
          Only send Solana-network USDC or SOL to this address. Sending other tokens or using another network can lose the funds. Keep a little SOL for network fees.
        </p>
      </section>
    </>
  );
}
