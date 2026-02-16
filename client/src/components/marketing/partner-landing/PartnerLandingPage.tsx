import { Navbar } from "./Navbar";
import { HeroSection } from "./HeroSection";
import { PlatformOverview } from "./PlatformOverview";
import { HowItWorksSection } from "./HowItWorksSection";
import { FeaturesSection } from "./FeaturesSection";
import { TestimonialsSection } from "./TestimonialsSection";
import { Footer } from "./Footer";
import { Toaster } from "@/components/ui/toaster";

const PartnerLandingPage = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <HeroSection />
        <PlatformOverview />
        <HowItWorksSection />
        <FeaturesSection />
        <TestimonialsSection />
      </main>
      <Footer />
      <Toaster />
    </div>
  );
};

export default PartnerLandingPage;
