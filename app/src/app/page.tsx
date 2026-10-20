import { Footer } from "@/components/site/footer";
import { Hero } from "@/components/site/hero";
import { LiveNow } from "@/components/site/live-now";
import { Navbar } from "@/components/site/navbar";
import { Agents, Cta, Faq, Journey, Money, Pricing, Research, Safety, Stats } from "@/components/site/sections";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <LiveNow />
        <Journey />
        <Research />
        <Agents />
        <Money />
        <Safety />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
