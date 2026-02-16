import { Navbar } from "./Navbar";
import { HeroSection } from "./HeroSection";
import { PlatformOverview } from "./PlatformOverview";
import { HowItWorksSection } from "./HowItWorksSection";
import { FeaturesSection } from "./FeaturesSection";
import { TestimonialsSection } from "./TestimonialsSection";
import { Footer } from "./Footer";
import { Toaster } from "@/components/ui/toaster";
import Wave1 from "./svg/wave1";

const PartnerLandingPage = () => {
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-[#9847D1] w-full h-full">
        <br />
        <br />
      </div>
      <Wave1 color="#9847D1" style={{ backgroundColor: "#fffbf7" }} />
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
