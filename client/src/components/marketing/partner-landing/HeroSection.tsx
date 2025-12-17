import { Button } from "@/components/ui/button";
import { ArrowRight, Monitor, Smartphone } from "lucide-react";
import { useScrollAnimation, getAnimationClasses } from "@/hooks/useScrollAnimation";

export const HeroSection = () => {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.2 });

  const scrollToContact = () => {
    const element = document.querySelector("#contact");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="hero" className="relative min-h-screen flex items-center pt-20 md:pt-24 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-1/2 -left-20 w-72 h-72 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div ref={ref} className="max-w-7xl mx-auto container-padding w-full relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Content */}
          <div className="space-y-8">
            <div
              {...getAnimationClasses(isVisible, 0)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium transition-all duration-500 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse-soft" />
              PWA-First Platform for Institutional Cafeterias & Canteens
            </div>

            <h1
              className={`font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-foreground transition-all duration-500 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "100ms" }}
            >
              Modern Ordering & POS for{" "}
              <span className="text-red-600">Institutional Cafeterias & Canteens</span>
            </h1>

            <p
              className={`text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed transition-all duration-500 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "200ms" }}
            >
              Sillobyte is a complete ordering, billing, and operations platform built for institutional cafeterias & canteens — including colleges & universities, hospital cafeterias, and corporate/company cafeterias. Fully digital and app-free.
            </p>

            <div
              className={`flex flex-col sm:flex-row gap-4 transition-all duration-500 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "300ms" }}
            >
              <Button variant="hero" size="xl" onClick={scrollToContact}>
                Book a Demo
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button variant="hero-outline" size="xl" onClick={scrollToContact}>
                Talk to our team
              </Button>
            </div>

            <div
              className={`flex items-center gap-6 pt-4 transition-all duration-500 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "400ms" }}
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-5 h-5 rounded-full bg-secondary/20 flex items-center justify-center">
                  <span className="text-secondary text-xs">✓</span>
                </div>
                No hardware required
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-5 h-5 rounded-full bg-secondary/20 flex items-center justify-center">
                  <span className="text-secondary text-xs">✓</span>
                </div>
                Setup in 24 hours
              </div>
            </div>
          </div>

          {/* Right: Dashboard Mockup */}
          <div
            className={`relative transition-all duration-700 ease-out ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            {/* Dashboard mockup */}
            <div className="relative bg-card rounded-2xl shadow-elevated border border-border p-4 md:p-6">
              {/* Top bar */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
                  <div className="w-3 h-3 rounded-full bg-secondary/60" />
                </div>
                <div className="flex-1 h-6 bg-muted rounded-md mx-4" />
              </div>

              {/* Dashboard content */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-primary" />
                  <span className="font-heading font-semibold text-foreground">Owner Dashboard</span>
                </div>
                
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/50 rounded-xl p-3 md:p-4">
                    <div className="text-2xl md:text-3xl font-heading font-bold text-foreground">247</div>
                    <div className="text-xs text-muted-foreground">Today's Orders</div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 md:p-4">
                    <div className="text-2xl md:text-3xl font-heading font-bold text-primary">₹18.5K</div>
                    <div className="text-xs text-muted-foreground">Revenue</div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3 md:p-4">
                    <div className="text-2xl md:text-3xl font-heading font-bold text-primary">12</div>
                    <div className="text-xs text-muted-foreground">Live Orders</div>
                  </div>
                </div>

                {/* Chart placeholder */}
                <div className="h-24 md:h-32 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl flex items-end px-4 pb-4 gap-1">
                  {[40, 65, 45, 80, 55, 90, 70, 85].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-primary/40 rounded-t"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Phone mockup - floating */}
            <div className="absolute -bottom-8 -left-8 md:-bottom-12 md:-left-12 w-36 md:w-48 bg-card rounded-3xl shadow-elevated border border-border p-3 animate-float">
              <div className="flex items-center gap-2 mb-3">
                <Smartphone className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-foreground">Student PWA</span>
              </div>
              <div className="space-y-2">
                <div className="h-8 bg-primary/10 rounded-lg flex items-center px-2">
                  <span className="text-xs text-primary font-medium">🍔 Burger Combo</span>
                </div>
                <div className="h-8 bg-muted/50 rounded-lg flex items-center px-2">
                  <span className="text-xs text-muted-foreground">☕ Coffee</span>
                </div>
                <div className="h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center">
                  <span className="text-xs font-medium">Order Now</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

