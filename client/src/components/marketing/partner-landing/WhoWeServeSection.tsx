import { GraduationCap, Building2, Utensils } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const segments = [
  {
    icon: GraduationCap,
    title: "Colleges & Universities",
    description:
      "Digitize campus canteens with queue-free ordering. Students order via PWA and track status in real time. Staff stay focused on cooking instead of crowd control.",
  },
  {
    icon: Building2,
    title: "Hospitals & Healthcare Cafeterias",
    description:
      "Serve staff, patients, and visitors efficiently. Organized billing, live orders on screens, and flexible cashless options.",
  },
  {
    icon: Utensils,
    title: "Institutional & Corporate Cafeterias",
    description:
      "Streamline high-volume office and company cafeterias. Multi-counter workflows, analytics, and transparent payout tracking.",
  },
];

export const WhoWeServeSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="who-we-serve" className="section-padding">
      <div ref={ref} className="max-w-7xl mx-auto container-padding">
        {/* Header */}
        <div
          className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-500 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            Built for Every Type of <span className="text-red-600">Institutional Canteen</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Sillobyte serves cafeterias and canteens across colleges & universities, hospital cafeterias, and corporate/company campuses.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {segments.map((segment, index) => (
            <div
              key={segment.title}
              className={`bg-card rounded-2xl p-8 border border-border card-hover transition-all duration-500 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: `${150 + index * 100}ms` }}
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <segment.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-heading text-xl font-bold text-foreground mb-3">
                {segment.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {segment.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

