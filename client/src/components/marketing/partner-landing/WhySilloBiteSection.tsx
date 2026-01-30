import {
  Globe,
  Building,
  Link2,
  WifiOff,
  LayoutGrid,
  Trophy,
} from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const highlights = [
  {
    icon: Globe,
    title: "Instant Web Access, Zero Friction",
    description:
      "SilloBite operates entirely through modern web browsers—eliminating app store barriers, update complexities, and device storage constraints for seamless user adoption.",
  },
  {
    icon: Building,
    title: "Enterprise-Grade Multi-Location Architecture",
    description:
      "Engineered specifically for distributed institutional networks across academic campuses, medical facilities, and corporate environments with centralized management capabilities.",
  },
  {
    icon: Link2,
    title: "Seamless Order-to-POS Synchronization",
    description:
      "Bidirectional real-time integration between customer ordering interfaces and point-of-sale systems ensures instant order processing and accurate inventory management.",
  },
  {
    icon: WifiOff,
    title: "Resilient Offline Operations",
    description:
      "Advanced offline capabilities enable uninterrupted service across multiple service counters, even during network interruptions or connectivity challenges.",
  },
  {
    icon: LayoutGrid,
    title: "Comprehensive Content Management",
    description:
      "Intuitive controls for featured selections, trending items, promotional campaigns, and strategic menu positioning to maximize engagement and revenue.",
  },
  {
    icon: Trophy,
    title: "Advanced Visibility Enhancement",
    description:
      "Optional competitive positioning module allows institutional partners to strategically enhance menu item prominence through intelligent bidding and placement optimization.",
  },
];

export const WhySilloBiteSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="why-sillobite" className="section-padding bg-gradient-to-b from-background via-background to-card/30">
      <div ref={ref} className="max-w-7xl mx-auto container-padding">
        {/* Premium Header */}
        <div
          className={`text-center max-w-3xl mx-auto mb-20 transition-all duration-700 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
            <Trophy className="w-4 h-4" />
            <span>The SilloBite Advantage</span>
          </div>
          <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground mb-6 leading-tight">
            What Makes Us{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
              Different
            </span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed font-light">
            Purpose-built exclusively for institutional dining operations—not adapted from generic restaurant management solutions.
          </p>
        </div>

        {/* Elegant 3-Column Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {highlights.map((highlight, index) => (
            <div
              key={highlight.title}
              className={`group relative bg-gradient-to-br from-card via-card to-card/95 rounded-2xl p-8 border border-border/50 shadow-lg hover:shadow-2xl transition-all duration-500 ease-out hover:scale-[1.02] hover:border-primary/30 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              style={{ transitionDelay: `${150 + index * 100}ms` }}
            >
              {/* Decorative gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-secondary/0 group-hover:from-primary/5 group-hover:via-primary/3 group-hover:to-secondary/5 rounded-2xl transition-all duration-500 pointer-events-none" />

              <div className="relative z-10">
                {/* Premium Icon Container */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary/20 via-secondary/10 to-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-secondary/20 shadow-sm">
                  <highlight.icon className="w-8 h-8 text-secondary group-hover:text-primary transition-colors duration-300" />
                </div>

                <h3 className="font-heading text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors duration-300">
                  {highlight.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed text-[15px]">
                  {highlight.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
