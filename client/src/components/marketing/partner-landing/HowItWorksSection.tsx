import { Smartphone, MonitorPlay, ChefHat, PiggyBank } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const steps = [
  {
    icon: Smartphone,
    step: "01",
    title: "Users Place Orders",
    description: "Students, staff, or employees open the Sillobyte PWA, browse the canteen menu, and place orders from their own devices.",
  },
  {
    icon: MonitorPlay,
    step: "02",
    title: "Orders Hit POS Live",
    description: "Orders hit the canteen's POS and counter screens instantly via WebSocket for immediate processing.",
  },
  {
    icon: ChefHat,
    step: "03",
    title: "Kitchen Prepares & Updates",
    description: "Kitchen or counter staff prepare items, update status, and students or staff receive live updates when food is ready.",
  },
  {
    icon: PiggyBank,
    step: "04",
    title: "Payments Auto-Tracked",
    description: "UPI, card, cash, and wallet payments are auto-tracked and reconciled, with full payout history for each canteen.",
  },
];

export const HowItWorksSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="how-it-works" className="section-padding">
      <div ref={ref} className="max-w-7xl mx-auto container-padding">
        {/* Header */}
        <div
          className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-500 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            How <span className="text-primary font-bold">Sillobyte</span> Works
          </h2>
          <p className="text-lg text-muted-foreground">
            A seamless flow from order to delivery, designed for speed and efficiency.
          </p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Connection line - desktop */}
          <div
            className={`hidden lg:block absolute top-24 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20 transition-all duration-700 ${
              isVisible ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
            }`}
            style={{ transitionDelay: "300ms" }}
          />

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className={`relative transition-all duration-500 ease-out ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: `${200 + index * 100}ms` }}
              >
                {/* Step card */}
                <div className="bg-card rounded-2xl p-6 border border-border card-hover h-full">
                  {/* Step number badge */}
                  <div className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-red-600 text-xs font-bold text-white">
                    Step {step.step}
                  </div>

                  {/* Icon */}
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mt-4 mb-5">
                    <step.icon className="w-7 h-7 text-primary" />
                  </div>

                  <h3 className="font-heading text-lg font-bold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Arrow connector - mobile/tablet */}
                {index < steps.length - 1 && (
                  <div className="lg:hidden flex justify-center my-4">
                    <div className="w-0.5 h-8 bg-primary/30" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

