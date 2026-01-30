import { Smartphone, MonitorPlay, ChefHat, PiggyBank, ArrowDown } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const steps = [
  {
    icon: Smartphone,
    step: "01",
    title: "Customers Initiate Orders",
    description: "Students, staff members, and employees access the SilloBite platform through any web-enabled device, explore comprehensive menu offerings, and submit orders directly from their personal devices.",
  },
  {
    icon: MonitorPlay,
    step: "02",
    title: "Real-Time POS Integration",
    description: "Orders instantly appear on canteen point-of-sale displays and counter interfaces through WebSocket technology, enabling immediate acknowledgment and processing by service staff.",
  },
  {
    icon: ChefHat,
    step: "03",
    title: "Preparation & Status Updates",
    description: "Kitchen and counter personnel prepare ordered items, update preparation status in real-time, and customers receive live notifications when their orders are ready for collection.",
  },
  {
    icon: PiggyBank,
    step: "04",
    title: "Automated Payment Reconciliation",
    description: "All payment methods including UPI, card transactions, cash, and digital wallets are automatically tracked and reconciled, with comprehensive financial reporting available for each dining location.",
  },
];

export const HowItWorksSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="how-it-works" className="section-padding bg-gradient-to-b from-background to-card/50">
      <div ref={ref} className="max-w-6xl mx-auto container-padding">
        {/* Premium Header */}
        <div
          className={`text-center max-w-3xl mx-auto mb-20 transition-all duration-700 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
        >
          <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground mb-6 leading-tight">
            Simple Process,{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
              Powerful Results
            </span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed font-light">
            A streamlined workflow from order placement to fulfillment, engineered for operational excellence and customer satisfaction.
          </p>
        </div>

        {/* Elegant Vertical Timeline */}
        <div className="relative">
          {/* Vertical Connector Line - Desktop */}
          <div
            className={`hidden lg:block absolute left-12 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/20 via-primary to-secondary/20 transition-all duration-1000 ${isVisible ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
              }`}
            style={{
              transformOrigin: "top",
              transitionDelay: "300ms"
            }}
          />

          {/* Steps */}
          <div className="space-y-12 lg:space-y-16">
            {steps.map((step, index) => {
              const isEven = index % 2 === 0;

              return (
                <div
                  key={step.step}
                  className={`relative transition-all duration-700 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                    }`}
                  style={{ transitionDelay: `${200 + index * 150}ms` }}
                >
                  <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-12">
                    {/* Left Side - Even Steps */}
                    <div className={`lg:w-1/2 ${isEven ? "lg:pr-12" : "lg:order-2 lg:pl-12"}`}>
                      <div className="bg-gradient-to-br from-card via-card to-card/95 rounded-3xl p-8 md:p-10 border border-border/50 shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] h-full">
                        {/* Step Badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 mb-6">
                          <span className="text-primary font-bold text-sm">STEP {step.step}</span>
                        </div>

                        {/* Icon */}
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/10 flex items-center justify-center mb-6 border border-primary/20 shadow-lg">
                          <step.icon className="w-10 h-10 text-primary" />
                        </div>

                        <h3 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-4">
                          {step.title}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed text-base">
                          {step.description}
                        </p>
                      </div>
                    </div>

                    {/* Center - Timeline Node */}
                    <div className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 lg:left-12 lg:translate-x-0 z-10">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary via-primary/90 to-secondary flex items-center justify-center border-4 border-background shadow-2xl">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-background to-card flex items-center justify-center">
                          <step.icon className="w-8 h-8 text-primary" />
                        </div>
                      </div>
                    </div>

                    {/* Right Side - Odd Steps */}
                    <div className={`lg:w-1/2 ${isEven ? "lg:order-2 lg:pl-12" : "lg:pr-12"}`}>
                      {/* Empty space for alternating layout */}
                    </div>
                  </div>

                  {/* Mobile Arrow Connector */}
                  {index < steps.length - 1 && (
                    <div className="lg:hidden flex justify-center my-8">
                      <div className="w-0.5 h-12 bg-gradient-to-b from-primary/40 via-primary to-primary/40 rounded-full" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
