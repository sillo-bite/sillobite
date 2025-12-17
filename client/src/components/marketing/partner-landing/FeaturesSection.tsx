import {
  Smartphone,
  Monitor,
  ChefHat,
  CreditCard,
  QrCode,
  BarChart3,
  Wallet,
  Bell,
} from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const features = [
  {
    icon: Smartphone,
    title: "Progressive Web Application Platform",
    description:
      "Fully functional web-based application accessible on any device without app store dependencies. Instant access, offline functionality, and home screen installation capabilities—all without requiring downloads or updates.",
    size: "large",
  },
  {
    icon: Monitor,
    title: "Integrated POS & Multi-Counter Management",
    description:
      "Live order synchronization to point-of-sale displays and counter interfaces. Comprehensive management for store operations, kitchen workflows, and payment processing with role-specific access controls.",
    size: "medium",
  },
  {
    icon: ChefHat,
    title: "Dynamic Menu & Inventory Control",
    description:
      "Complete menu management with real-time pricing, stock level tracking, availability controls, featured selections, trending item identification, and automated inventory deduction.",
    size: "medium",
  },
  {
    icon: CreditCard,
    title: "Comprehensive Payment Ecosystem",
    description:
      "Support for UPI, card payments, digital wallets, and cash transactions with integrated payment gateway processing and dedicated offline payment counter functionality.",
    size: "small",
  },
  {
    icon: QrCode,
    title: "Barcode & QR Verification System",
    description:
      "Unique barcode generation for each order with counter scanning capabilities for pickup verification. Optional QR code-based table ordering for enhanced convenience.",
    size: "small",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics & Reporting",
    description:
      "Real-time insights into revenue performance, order volumes, best-selling items, peak operational hours, and customer behavior patterns. Per-location and institution-wide views with live dashboard updates and exportable comprehensive reports.",
    size: "large",
  },
  {
    icon: Wallet,
    title: "Financial Management & Settlement Tracking",
    description:
      "Complete payment method tracking including UPI, card, cash, and wallet transactions. Monitor pending settlements, access comprehensive payment history, and manage refunds with full financial transparency.",
    size: "medium",
  },
  {
    icon: Bell,
    title: "Real-Time Notifications & Promotional Management",
    description:
      "WebSocket-powered instant order status updates, push notification capabilities for customers, and comprehensive promotional campaign management with targeted announcement features.",
    size: "small",
  },
];

export const FeaturesSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="features" className="section-padding bg-card">
      <div ref={ref} className="max-w-7xl mx-auto container-padding">
        {/* Premium Header */}
        <div
          className={`text-center max-w-3xl mx-auto mb-20 transition-all duration-700 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground mb-6 leading-tight">
            Complete{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
              Solution Suite
            </span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed font-light">
            A comprehensive toolkit designed specifically for institutional dining operations across academic, healthcare, and corporate environments.
          </p>
        </div>

        {/* Masonry-Style Asymmetric Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 auto-rows-fr">
          {features.map((feature, index) => {
            const colSpan = feature.size === "large" ? "lg:col-span-2" : "";
            const rowSpan = feature.size === "large" ? "lg:row-span-2" : "";
            
            return (
              <div
                key={feature.title}
                className={`group relative bg-gradient-to-br from-background via-background to-card/50 rounded-3xl p-8 border border-border/50 shadow-lg hover:shadow-2xl transition-all duration-500 ease-out hover:scale-[1.02] hover:border-primary/30 backdrop-blur-sm ${colSpan} ${rowSpan} ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: `${150 + index * 75}ms` }}
              >
                {/* Glassmorphism overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-secondary/0 group-hover:from-primary/5 group-hover:via-primary/3 group-hover:to-secondary/5 rounded-3xl transition-all duration-500 pointer-events-none" />
                
                <div className="relative z-10 h-full flex flex-col">
                  {/* Premium Icon */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-primary/20 shadow-lg">
                    <feature.icon className="w-8 h-8 text-primary group-hover:text-secondary transition-colors duration-300" />
                  </div>
                  
                  <h3 className="font-heading text-xl font-bold text-foreground mb-4 group-hover:text-primary transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed text-[15px] flex-grow">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
