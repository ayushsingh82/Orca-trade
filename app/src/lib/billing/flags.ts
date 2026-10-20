import { NextResponse } from "next/server";

/**
 * Paid plans are closed until BILLING_ENABLED=1. While closed, the site shows Pro and Teams as upcoming, takes
 * waitlist sign-ups, and every checkout route refuses. Webhooks stay on so an existing subscriber is never missed.
 */
export const billingOpen = () => process.env.BILLING_ENABLED === "1";

/** A 503 for checkout routes while paid plans are closed, or null when they are open. */
export function billingClosedResponse(): NextResponse | null {
  if (billingOpen()) return null;
  return NextResponse.json({ ok: false, error: "Paid plans open with the beta. Join the waitlist to be first." }, { status: 503 });
}

/**
 * Sign-in and sign-up are closed until NEXT_PUBLIC_SIGNUP_ENABLED=1 (the same flag the UI reads). While closed, every
 * route that starts a session refuses. Logout and /me stay open.
 */
export const signupOpen = () => process.env.NEXT_PUBLIC_SIGNUP_ENABLED === "1";

/** A 503 for session-starting auth routes while beta access is closed, or null when they are open. */
export function signupClosedResponse(): NextResponse | null {
  if (signupOpen()) return null;
  return NextResponse.json({ ok: false, error: "Beta access coming soon. Sign-in is closed for now." }, { status: 503 });
}
