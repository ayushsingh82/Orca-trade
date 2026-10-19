import { LegalPage } from "@/components/site/legal";

export const metadata = { title: "Risk disclosure" };

export default function RiskPage() {
  return (
    <LegalPage title="Risk disclosure" updated="October 2026">
      <section>
        <h2>Not financial advice</h2>
        <p>Orca provides software and market information. It does not give investment, legal or tax advice, and nothing it shows is a recommendation to buy or sell.</p>
      </section>
      <section>
        <h2>You can lose money</h2>
        <p>Crypto assets are volatile. Prices can move sharply and fall to zero. Past results, including paper trading results, do not predict future results.</p>
      </section>
      <section>
        <h2>Signals are a ranking, not a prediction</h2>
        <p>Conviction scores rank assets against each other. They are not probabilities. Our own backtest found no statistically significant edge, so treat every signal as one input among many.</p>
      </section>
      <section>
        <h2>Automation risks</h2>
        <ul>
          <li>An agent can trade on stale, incomplete or wrong data, or on a bug.</li>
          <li>Orders can fill at worse prices than quoted because of slippage and fast-moving markets.</li>
          <li>Software, network and provider outages can stop an agent from acting when you expect it to.</li>
          <li>Transactions on a blockchain are final. A mistaken trade cannot be reversed.</li>
        </ul>
      </section>
      <section>
        <h2>How we limit the damage</h2>
        <p>Agents start in paper mode. Live trading is off unless it is switched on, every trade passes fixed risk limits you set, and an agent only holds what you fund it with. These reduce risk; they do not remove it. Start with small amounts.</p>
      </section>
    </LegalPage>
  );
}
