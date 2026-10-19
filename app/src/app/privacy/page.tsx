import { LegalPage } from "@/components/site/legal";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="October 2026">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Account details: your email (hashed password) or your wallet address.</li>
          <li>Your agents, their settings, and the decision records they produce.</li>
          <li>Usage counts that enforce plan limits, and your Telegram chat id if you add it for alerts.</li>
          <li>Payment status from our payment providers. We never see your card number.</li>
        </ul>
      </section>
      <section>
        <h2>Keys</h2>
        <p>We never receive your own wallet&apos;s private key. Each live agent has its own signer, encrypted at rest, that only holds what you send it.</p>
      </section>
      <section>
        <h2>How we use it</h2>
        <p>To run the service, enforce limits, send the alerts you ask for, and keep it secure. We do not sell personal data.</p>
      </section>
      <section>
        <h2>Sharing</h2>
        <p>A decision record is private unless you choose to share it,. Service providers such as hosting, database and payments process data on our behalf.</p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>You can unlist an agent, stop sharing a record, remove your Telegram id, or ask us to delete your account and its data.</p>
      </section>
    </LegalPage>
  );
}
