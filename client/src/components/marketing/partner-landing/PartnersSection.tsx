import { Building2, Plus } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

interface PartnerCardProps {
  name: string;
  subtitle: string;
  logoPlaceholder: string;
  logoUrl?: string;
  accentColor: "primary" | "secondary";
  delay: number;
  isVisible: boolean;
}

const PartnerCard = ({ name, subtitle, logoPlaceholder, logoUrl, accentColor, delay, isVisible }: PartnerCardProps) => {
  const bgColor = accentColor === "primary" ? "bg-primary/10" : "bg-secondary/10";
  const textColor = accentColor === "primary" ? "text-primary" : "text-secondary";

  return (
    <div
      className={`bg-card rounded-2xl p-8 md:p-10 border border-border card-hover w-full md:w-[320px] md:h-[280px] flex flex-col text-center transition-all duration-500 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Logo area - ready for real logo image */}
      <div className={`w-24 h-24 mx-auto mb-5 rounded-2xl ${bgColor} flex items-center justify-center overflow-hidden flex-shrink-0`}>
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="w-full h-full object-contain p-2" />
        ) : (
          <span className={`font-heading font-bold text-2xl ${textColor}`}>
            {logoPlaceholder}
          </span>
        )}
      </div>
      <h3 className="font-heading text-lg font-bold text-foreground mb-1 flex-shrink-0">
        {name}
      </h3>
      <p className="text-sm text-muted-foreground flex-grow">
        {subtitle}
      </p>
    </div>
  );
};

const ComingSoonCard = ({ delay, isVisible }: { delay: number; isVisible: boolean }) => (
  <div
    className={`bg-muted/30 rounded-2xl p-8 md:p-10 border border-dashed border-border w-full md:w-[320px] md:h-[280px] flex flex-col text-center transition-all duration-500 ease-out ${
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    }`}
    style={{ transitionDelay: `${delay}ms` }}
  >
    <div className="w-24 h-24 mx-auto mb-5 rounded-2xl bg-muted/50 flex items-center justify-center flex-shrink-0">
      <Plus className="w-10 h-10 text-muted-foreground/50" />
    </div>
    <h3 className="font-heading text-lg font-semibold text-muted-foreground mb-1 flex-shrink-0">
      Your Institution Here
    </h3>
    <p className="text-sm text-muted-foreground/70 flex-grow">
      Partner with Sillobyte for your campus or company cafeteria.
    </p>
  </div>
);

export const PartnersSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="partners" className="section-padding">
      <div ref={ref} className="max-w-7xl mx-auto container-padding">
        {/* Header */}
        <div
          className={`text-center max-w-2xl mx-auto mb-12 transition-all duration-500 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            Trusted by <span className="text-red-600">Leading Institutions</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Built in collaboration with institutional cafeterias & canteens across colleges & universities,{" "}
            hospital cafeterias, and corporate/company campuses.
          </p>
        </div>

        {/* Partner Logos */}
        <div className="flex flex-col md:flex-row items-stretch justify-center gap-6 md:gap-8">
          <PartnerCard
            name="Kalaignar Karunanidhi Institute of Technology"
            subtitle="University Partner"
            logoPlaceholder="KIT"
            accentColor="primary"
            delay={150}
            isVisible={isVisible}
          />

          <PartnerCard
            name="Gowri Hospital"
            subtitle="Healthcare Cafeteria Partner"
            logoPlaceholder="GH"
            accentColor="primary"
            delay={250}
            isVisible={isVisible}
          />

          <ComingSoonCard delay={350} isVisible={isVisible} />
        </div>

        {/* Trust badge */}
        <div
          className={`mt-12 text-center transition-all duration-500 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "450ms" }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 text-sm text-muted-foreground">
            <Building2 className="w-4 h-4 text-primary" />
            More institutions joining soon
          </div>
        </div>
      </div>
    </section>
  );
};

