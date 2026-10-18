import { Footer } from "@/components/site/footer";
import { Hero } from "@/components/site/hero";
import { Navbar } from "@/components/site/navbar";
import { Cta, Faq, Features, Pipeline, Pricing, Safety } from "@/components/site/sections";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Pipeline />
        <Features />
        <Safety />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
