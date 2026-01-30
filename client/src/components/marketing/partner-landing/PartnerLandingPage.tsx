import { Navbar } from "./Navbar";
import { HeroSection } from "./HeroSection";
import { WhySilloBiteSection } from "./WhySilloBiteSection";
import { WhoWeServeSection } from "./WhoWeServeSection";
import { HowItWorksSection } from "./HowItWorksSection";
import { FeaturesSection } from "./FeaturesSection";
import { AnalyticsSection } from "./AnalyticsSection";
import { PartnersSection } from "./PartnersSection";
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
        <WhySilloBiteSection />
        <WhoWeServeSection />
        <HowItWorksSection />
        <FeaturesSection />
        <AnalyticsSection />
        <PartnersSection />
        <FAQSection />
        <ContactSection />
      </main>
      <Footer />
      <Toaster />
    </div>
  );
};

export default PartnerLandingPage;
