import { Navbar } from "./Navbar";
import { HeroSection } from "./HeroSection";
import { WhoWeServeSection } from "./WhoWeServeSection";
import { FeaturesSection } from "./FeaturesSection";
import { HowItWorksSection } from "./HowItWorksSection";
import { WhySillobyteSection } from "./WhySillobyteSection";
import { PartnersSection } from "./PartnersSection";
import { AnalyticsSection } from "./AnalyticsSection";
import { FAQSection } from "./FAQSection";
import { ContactSection } from "./ContactSection";
import { Footer } from "./Footer";
import { Toaster } from "@/components/ui/toaster";

const PartnerLandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />
        <WhoWeServeSection />
        <FeaturesSection />
        <HowItWorksSection />
        <WhySillobyteSection />
        <PartnersSection />
        <AnalyticsSection />
        <FAQSection />
        <ContactSection />
      </main>
      <Footer />
      <Toaster />
    </div>
  );
};

export default PartnerLandingPage;

