import { Navbar } from "./Navbar";
import { HeroSection } from "./HeroSection";
import { PlatformOverview } from "./PlatformOverview";
import { HowItWorksSection } from "./HowItWorksSection";
import { FeaturesSection } from "./FeaturesSection";
import { TestimonialsSection } from "./TestimonialsSection";
import { Footer } from "./Footer";
import { Toaster } from "@/components/ui/toaster";
import Wave1 from "./svg/wave1";
import { Button } from "@/components/ui/button";
import { FloatingOpen } from "./FloatingOpen";
import { useEffect } from "react";
const PartnerLandingPage = () => {
  // One-time migration: seed CanteenEntity collection from SystemSettings
  useEffect(() => {
    fetch('/api/system-settings/migrate-canteens-to-collection', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.migrated > 0) {
          console.log(`✅ Canteen migration: ${data.migrated} new, ${data.totalInCollection} total`);
        }
      })
      .catch(() => { /* silent — migration is best-effort */ });
  }, []);
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-[#9847D1] w-full h-full">
        <br />
        <br />
      </div>
      <Wave1 color="#9847D1" style={{ backgroundColor: "#fffbf7" }} />
      <Navbar />

      <main>
        <FloatingOpen />
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
