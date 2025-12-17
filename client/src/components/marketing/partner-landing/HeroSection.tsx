import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Users, TrendingUp, Globe, ArrowUpRight } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

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
      {/* Premium background decoration with gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-primary/10 via-primary/5 to-transparent blur-3xl" />
        <div className="absolute top-1/2 -left-32 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-secondary/15 via-secondary/8 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-primary/8 to-secondary/8 blur-3xl" />
      </div>

      <div ref={ref} className="max-w-7xl mx-auto container-padding w-full relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          {/* Left: Premium Content */}
          <div className="space-y-10 lg:space-y-12">
            <h1
              className={`font-heading text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] text-foreground transition-all duration-700 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "100ms" }}
            >
              Revolutionize{" "}
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
                  Institutional Food Service
                </span>
                <span className="absolute -bottom-2 left-0 right-0 h-3 bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 blur-xl rounded-full" />
              </span>
            </h1>

            <p
              className={`text-xl md:text-2xl text-muted-foreground max-w-2xl leading-relaxed font-light transition-all duration-700 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "200ms" }}
            >
              Sillobyte delivers an all-inclusive digital ecosystem for institutional dining operations. Seamlessly connecting educational institutions, healthcare facilities, and corporate campuses with cutting-edge ordering, payment processing, and operational management—all accessible instantly through any web browser.
            </p>

            <div
              className={`flex flex-col sm:flex-row gap-4 transition-all duration-700 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "300ms" }}
            >
              <Button 
                variant="hero" 
                size="xl" 
                onClick={scrollToContact}
                className="group relative overflow-hidden bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-xl hover:shadow-2xl transition-all duration-300 w-full sm:w-auto"
              >
                <span className="relative z-10 flex items-center justify-center gap-2 text-sm sm:text-base px-2">
                  <span className="hidden lg:inline">Schedule Your Personalized Consultation</span>
                  <span className="hidden sm:inline lg:hidden">Schedule Consultation</span>
                  <span className="sm:hidden">Get Started</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform flex-shrink-0" />
                </span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              </Button>
              <Button 
                variant="hero-outline" 
                size="xl" 
                onClick={scrollToContact}
                className="border-2 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300 w-full sm:w-auto"
              >
                <span className="text-sm sm:text-base">Contact Us</span>
              </Button>
            </div>

            <div
              className={`flex flex-wrap items-center gap-8 pt-6 transition-all duration-700 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "400ms" }}
            >
              <div className="flex items-center gap-3 text-base text-muted-foreground">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-secondary/30 to-secondary/10 flex items-center justify-center border border-secondary/30 shadow-sm">
                  <span className="text-secondary text-sm font-bold">✓</span>
                </div>
                <span className="font-medium">Zero Hardware Investment</span>
              </div>
              <div className="flex items-center gap-3 text-base text-muted-foreground">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-secondary/30 to-secondary/10 flex items-center justify-center border border-secondary/30 shadow-sm">
                  <span className="text-secondary text-sm font-bold">✓</span>
                </div>
                <span className="font-medium">Rapid Deployment in 24 Hours</span>
              </div>
            </div>
          </div>

          {/* Right: Abstract Data Flow Visualization */}
          <div
            className={`relative transition-all duration-1000 ease-out ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-12"
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            {/* Main Container */}
            <div className="relative w-full h-[500px] md:h-[600px]">
              {/* Central Hub Circle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-primary via-primary/90 to-secondary shadow-2xl border-4 border-background flex items-center justify-center z-20 animate-pulse-slow">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-background to-card/50 flex items-center justify-center">
                  <Zap className="w-12 h-12 md:w-16 md:h-16 text-primary" />
                </div>
              </div>

              {/* Orbiting Feature Cards */}
              {[
                { icon: Users, label: "Multi-User", angle: 0, delay: 0, color: "primary" },
                { icon: TrendingUp, label: "Analytics", angle: 72, delay: 200, color: "secondary" },
                { icon: Globe, label: "Web-Based", angle: 144, delay: 400, color: "primary" },
                { icon: Zap, label: "Real-Time", angle: 216, delay: 600, color: "secondary" },
                { icon: ArrowUpRight, label: "Scalable", angle: 288, delay: 800, color: "primary" },
              ].map((feature, index) => {
                const radius = 140;
                const angleRad = (feature.angle * Math.PI) / 180;
                const x = Math.cos(angleRad) * radius;
                const y = Math.sin(angleRad) * radius;

                return (
                  <div
                    key={index}
                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ease-out ${
                      isVisible ? "opacity-100 scale-100" : "opacity-0 scale-0"
                    }`}
                    style={{
                      transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                      transitionDelay: `${feature.delay}ms`,
                    }}
                  >
                    {/* Connection Line */}
                    <div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent origin-top"
                      style={{
                        height: `${radius}px`,
                        transform: `translate(calc(-50% + ${x / 2}px), calc(-50% + ${y / 2}px)) rotate(${feature.angle}deg)`,
                        transformOrigin: "top center",
                      }}
                    />

                    {/* Feature Card */}
                    <div 
                      className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-card via-card to-card/95 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 flex flex-col items-center justify-center backdrop-blur-sm ${
                        feature.color === "primary" ? "border-2 border-primary/30" : "border-2 border-secondary/30"
                      }`}
                    >
                      <feature.icon 
                        className={`w-8 h-8 md:w-10 md:h-10 mb-1 ${
                          feature.color === "primary" ? "text-primary" : "text-secondary"
                        }`} 
                      />
                      <span className="text-[10px] md:text-xs font-semibold text-foreground text-center px-1">
                        {feature.label}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Floating Stats Bubbles */}
              {[
                { value: "24H", label: "Setup", top: "10%", left: "20%", delay: 1000 },
                { value: "100%", label: "Web", top: "15%", right: "15%", delay: 1200 },
                { value: "∞", label: "Scale", bottom: "20%", left: "10%", delay: 1400 },
                { value: "0", label: "Hardware", bottom: "15%", right: "20%", delay: 1600 },
              ].map((stat, index) => (
                <div
                  key={index}
                  className={`absolute bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/10 rounded-2xl p-4 md:p-5 border border-primary/20 shadow-lg backdrop-blur-sm transition-all duration-700 ease-out ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                  style={{
                    top: stat.top,
                    left: stat.left,
                    right: stat.right,
                    bottom: stat.bottom,
                    transitionDelay: `${stat.delay}ms`,
                  }}
                >
                  <div className="text-2xl md:text-3xl font-heading font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    {stat.value}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">{stat.label}</div>
                </div>
              ))}

              {/* Animated Background Rings */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 md:w-80 md:h-80 rounded-full border border-primary/10 animate-spin-slow" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 md:w-96 md:h-96 rounded-full border border-secondary/10 animate-spin-slow" style={{ animationDirection: "reverse", animationDuration: "20s" }} />
            </div>

            {/* Decorative floating elements */}
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-gradient-to-br from-secondary/20 to-primary/20 rounded-full blur-2xl animate-pulse-slow opacity-60" />
            <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full blur-2xl animate-pulse-slow opacity-60" style={{ animationDelay: "1s" }} />
          </div>
        </div>
      </div>
    </section>
  );
};
