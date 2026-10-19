import { LegalPage } from "@/components/site/legal";

export const metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="October 2026">
      <section>
        <h2>The service</h2>
        <p>Orca is software that shows market intelligence and runs trading agents on rules you set. You decide whether an agent only observes, asks for your approval, or acts on its own.</p>
      </section>
      <section>
        <h2>Your responsibilities</h2>
        <ul>
          <li>You are responsible for every agent you create, its limits, and the funds you give it.</li>
          <li>You must be old enough and legally allowed to trade crypto where you live.</li>
          <li>You keep your account credentials and wallets secure.</li>
        </ul>
      </section>
      <section>
        <h2>No advice, no guarantees</h2>
        <p>Orca does not give financial advice and does not guarantee any result, uptime or data accuracy. See the <a className="text-accent" href="/risk">risk disclosure</a>.</p>
      </section>
      <section>
        <h2>Payments</h2>
        <p>Paid plans are billed by subscription through our payment providers, or paid in USDC for a fixed period. Orca takes no share of your trading profits and charges no performance fee. You can cancel at any time; cancelling stops future charges but does not refund time already paid unless the law requires it.</p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <p>Do not abuse the service, scrape it at scale, attempt to access other users&apos; data, or use it for anything illegal, including market manipulation.</p>
      </section>
      <section>
        <h2>Liability</h2>
        <p>To the extent the law allows, Orca is provided as is, and we are not liable for trading losses or for losses caused by outages, third-party data or blockchain events.</p>
      </section>
    </LegalPage>
  );
}
