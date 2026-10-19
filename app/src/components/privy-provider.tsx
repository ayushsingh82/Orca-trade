"use client";

import type { ReactNode } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";

/** Set at build time. Without it Privy is off and the app falls back to email and wallet sign-in. */
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function PrivyAuthProvider({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) return <>{children}</>;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: { theme: "dark", accentColor: "#9085fb", logo: "/logo.svg", walletChainType: "solana-only" },
        loginMethods: ["email", "google"],
        // Every new user gets their own Solana wallet at sign-up, which they can fund and use with their agents.
        embeddedWallets: { solana: { createOnLogin: "users-without-wallets" } },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

const useRealLogout = () => usePrivy().logout;
const useNoLogout = () => async () => {};
/** Signs out of Privy too, otherwise the login page would sign the user straight back in. A no-op when Privy is off. */
export const usePrivyLogout: () => () => Promise<void> = PRIVY_APP_ID ? useRealLogout : useNoLogout;
