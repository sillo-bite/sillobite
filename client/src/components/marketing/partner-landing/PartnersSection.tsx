import { Building2, Plus, Quote, CheckCircle2 } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

interface PartnerCardProps {
  name: string;
  subtitle: string;
  logoPlaceholder: string;
  logoUrl?: string;
  accentColor: "primary" | "secondary";
  delay: number;
  isVisible: boolean;
  testimonial?: string;
}

const PartnerCard = ({ name, subtitle, logoPlaceholder, logoUrl, accentColor, delay, isVisible, testimonial }: PartnerCardProps) => {
  const bgColor = accentColor === "primary" ? "bg-gradient-to-br from-primary/10 via-primary/5 to-primary/10" : "bg-gradient-to-br from-secondary/10 via-secondary/5 to-secondary/10";
  const textColor = accentColor === "primary" ? "text-primary" : "text-secondary";
  const borderColor = accentColor === "primary" ? "border-primary/20" : "border-secondary/20";

  return (
    <div
      className={`bg-gradient-to-br from-card via-card to-card/95 rounded-3xl p-10 border border-border/50 shadow-xl hover:shadow-2xl transition-all duration-700 ease-out hover:scale-[1.02] hover:border-primary/30 w-full ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Logo Section */}
      <div className={`w-28 h-28 mx-auto mb-6 rounded-2xl ${bgColor} flex items-center justify-center overflow-hidden flex-shrink-0 border-2 ${borderColor} shadow-lg`}>
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="w-full h-full object-contain p-3" />
        ) : (
          <span className={`font-heading font-bold text-3xl ${textColor}`}>
            {logoPlaceholder}
          </span>
        )}
      </div>

      {/* Partner Info */}
      <div className="text-center mb-6">
        <h3 className="font-heading text-xl font-bold text-foreground mb-2">
          {name}
        </h3>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 text-sm text-muted-foreground font-medium">
          <CheckCircle2 className="w-4 h-4 text-secondary" />
          <span>{subtitle}</span>
        </div>
      </div>

      {/* Testimonial */}
      {testimonial && (
        <div className="relative bg-gradient-to-br from-muted/30 to-muted/20 rounded-2xl p-6 border border-border/30">
          <Quote className="w-6 h-6 text-primary/30 absolute top-4 left-4" />
          <p className="text-muted-foreground leading-relaxed text-sm italic pl-6">
            "{testimonial}"
          </p>
        </div>
      )}
    </div>
  );
};

const ComingSoonCard = ({ delay, isVisible }: { delay: number; isVisible: boolean }) => (
  <div
    className={`bg-gradient-to-br from-muted/20 via-muted/10 to-muted/20 rounded-3xl p-10 border-2 border-dashed border-border/50 w-full transition-all duration-700 ease-out hover:border-primary/30 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    style={{ transitionDelay: `${delay}ms` }}
  >
    <div className="w-28 h-28 mx-auto mb-6 rounded-2xl bg-muted/30 flex items-center justify-center flex-shrink-0 border-2 border-dashed border-border/50">
      <Plus className="w-12 h-12 text-muted-foreground/50" />
    </div>
    <div className="text-center">
      <h3 className="font-heading text-xl font-semibold text-muted-foreground mb-2">
        Your Institution Here
      </h3>
      <p className="text-sm text-muted-foreground/70 leading-relaxed">
        Partner with SilloBite to transform your campus or corporate cafeteria operations.
      </p>
    </div>
  </div>
);

export const PartnersSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="partners" className="section-padding bg-card">
      <div ref={ref} className="max-w-7xl mx-auto container-padding">
        {/* Premium Header */}
        <div
          className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-700 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/10 text-secondary text-sm font-semibold mb-6">
            <Building2 className="w-4 h-4" />
            <span>Trusted By Leading Organizations</span>
          </div>
          <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground mb-6 leading-tight">
            Trusted by{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
              Leading Institutions
            </span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed font-light">
            Developed in collaboration with institutional dining operations across academic campuses, healthcare facilities, and corporate environments.
          </p>
        </div>

        {/* Elegant Partner Showcase */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
          <PartnerCard
            name="Kalaignar Karunanidhi Institute of Technology"
            subtitle="University Partner"
            logoPlaceholder="KIT"
            accentColor="primary"
            delay={150}
            isVisible={isVisible}
            testimonial="SilloBite has revolutionized our campus dining experience. Students love the seamless ordering, and our kitchen staff can focus on what they do best."
          />

          <PartnerCard
            name="Gowri Hospital"
            subtitle="Healthcare Cafeteria Partner"
            logoPlaceholder="GH"
            accentColor="primary"
            delay={250}
            isVisible={isVisible}
            testimonial="The platform has streamlined our cafeteria operations significantly. Real-time order tracking and efficient payment processing have improved our service quality."
          />

          <ComingSoonCard delay={350} isVisible={isVisible} />
        </div>

        {/* Trust Badge */}
        <div
          className={`mt-16 text-center transition-all duration-700 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          style={{ transitionDelay: "450ms" }}
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-muted/50 via-muted/30 to-muted/50 backdrop-blur-sm border border-border/50 shadow-lg">
            <Building2 className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground font-semibold">
              More institutions joining our network
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
