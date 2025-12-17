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
    title: "PWA-First, No App Friction",
    description:
      "Users access Sillobyte instantly via web — no app store downloads, updates, or storage issues.",
  },
  {
    icon: Building,
    title: "Institution-First Architecture",
    description:
      "Built specifically for multi-location deployments across colleges & universities, hospital cafeterias, and corporate/company offices.",
  },
  {
    icon: Link2,
    title: "Ordering ↔ POS Integration",
    description:
      "Tight bi-directional sync between student orders and counter POS for real-time accuracy.",
  },
  {
    icon: WifiOff,
    title: "Offline-Friendly Workflows",
    description:
      "Multi-counter operations continue smoothly even with intermittent connectivity.",
  },
  {
    icon: LayoutGrid,
    title: "Content Control",
    description:
      "Manage quick picks, trending items, promotional banners, and featured dishes easily.",
  },
  {
    icon: Trophy,
    title: "Optional Visibility Module",
    description:
      "Bidding and positioning features for partner canteens inside an institution to boost menu item visibility.",
  },
];

export const WhySillobyteSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="why-sillobyte" className="section-padding bg-card">
      <div ref={ref} className="max-w-7xl mx-auto container-padding">
        {/* Header */}
        <div
          className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-500 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            Why <span className="text-primary font-bold">Sillobyte</span> is Different
          </h2>
          <p className="text-lg text-muted-foreground">
            Purpose-built for institutional cafeterias & canteens — not generic restaurant software.
          </p>
        </div>

        {/* Highlights Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {highlights.map((highlight, index) => (
            <div
              key={highlight.title}
              className={`group flex gap-4 bg-background rounded-xl p-6 border border-border card-hover transition-all duration-500 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: `${150 + index * 75}ms` }}
            >
              <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0 group-hover:bg-secondary/20 transition-colors">
                <highlight.icon className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold text-foreground mb-1">
                  {highlight.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
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

