import { GraduationCap, Building2, Utensils, Sparkles } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const segments = [
  {
    icon: GraduationCap,
    title: "Academic Institutions & Universities",
    description:
      "Transform campus dining experiences with digital-first ordering solutions. Students access menus instantly through web browsers, place orders seamlessly, and monitor preparation status in real-time. Kitchen staff focus on culinary excellence while eliminating queue management challenges.",
    featured: true,
  },
  {
    icon: Building2,
    title: "Healthcare & Medical Facilities",
    description:
      "Optimize cafeteria operations for medical staff, patients, and visitors. Streamlined billing processes, live order displays, and flexible payment options create an efficient dining environment within healthcare settings.",
    featured: false,
  },
  {
    icon: Utensils,
    title: "Corporate & Enterprise Campuses",
    description:
      "Enhance workplace dining efficiency for high-volume corporate environments. Multi-counter operational workflows, comprehensive analytics, and transparent financial tracking support seamless enterprise cafeteria management.",
    featured: false,
  },
];

export const WhoWeServeSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  const featuredSegment = segments.find(s => s.featured);
  const otherSegments = segments.filter(s => !s.featured);

  return (
    <section id="who-we-serve" className="section-padding bg-card">
      <div ref={ref} className="max-w-7xl mx-auto container-padding">
        {/* Premium Header */}
        <div
          className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-700 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/10 text-secondary text-sm font-semibold mb-6">
            <Sparkles className="w-4 h-4" />
            <span>Perfect For Every Institution</span>
          </div>
          <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground mb-6 leading-tight">
            Built for Every Type of{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
              Institutional Canteen
            </span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed font-light">
            Sillobyte empowers dining operations across academic campuses, healthcare facilities, and corporate environments with tailored solutions for each unique institutional context.
          </p>
        </div>

        {/* Asymmetric Layout: Large Featured Card + Side Cards */}
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Featured Large Card */}
          {featuredSegment && (
            <div
              className={`lg:col-span-7 bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/10 rounded-3xl p-10 md:p-12 border border-primary/20 shadow-2xl hover:shadow-3xl transition-all duration-700 ease-out hover:scale-[1.01] ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "150ms" }}
            >
              <div className="flex items-start gap-6 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border-2 border-primary/30 shadow-lg flex-shrink-0">
                  <featuredSegment.icon className="w-10 h-10 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold mb-3">
                    <span>Featured</span>
                  </div>
                  <h3 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
                    {featuredSegment.title}
                  </h3>
                </div>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed font-light">
                {featuredSegment.description}
              </p>
            </div>
          )}

          {/* Side Cards */}
          <div className="lg:col-span-5 space-y-6">
            {otherSegments.map((segment, index) => (
              <div
                key={segment.title}
                className={`bg-gradient-to-br from-card via-card to-card/95 rounded-2xl p-8 border border-border/50 shadow-lg hover:shadow-xl transition-all duration-500 ease-out hover:scale-[1.02] hover:border-primary/30 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: `${250 + index * 100}ms` }}
              >
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/10 flex items-center justify-center mb-5 border border-secondary/20 shadow-sm">
                  <segment.icon className="w-8 h-8 text-secondary" />
                </div>
                <h3 className="font-heading text-xl font-bold text-foreground mb-3">
                  {segment.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed text-[15px]">
                  {segment.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
