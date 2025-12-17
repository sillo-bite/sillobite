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
    title: "PWA Ordering (No App Store)",
    description:
      "Progressive Web App works on any student, staff, or employee device. No app store, instant access via browser — installable, offline-capable, no downloads required.",
  },
  {
    icon: Monitor,
    title: "POS Billing & Multi-Counter System",
    description:
      "Real-time order sync to POS screens. Manage store, kitchen, and payment counters with dedicated interfaces and role-based access.",
  },
  {
    icon: ChefHat,
    title: "Menu & Inventory Management",
    description:
      "Manage menu items, pricing, real-time stock tracking, availability, quick picks, and trending dishes with automatic stock deduction.",
  },
  {
    icon: CreditCard,
    title: "Multiple Payment Options",
    description:
      "UPI, Card, Wallet, and Cash payments with integrated payment gateway and offline payment counter support.",
  },
  {
    icon: QrCode,
    title: "Barcode/QR Pickup & Verification",
    description:
      "Unique barcode for each order with counter scanning for pickup verification. Optional QR-based table ordering.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics & Reports",
    description:
      "Track revenue, order counts, top-selling items, peak hours, and order patterns with per-canteen and per-institution views, real-time dashboard updates, and exportable reports.",
  },
  {
    icon: Wallet,
    title: "Payment Management & Settlements",
    description:
      "Track all payment methods (UPI, Card, Cash, Wallet), monitor pending settlements, view payment history, and manage refunds with full transparency.",
  },
  {
    icon: Bell,
    title: "Real-Time Notifications & Offers",
    description:
      "WebSocket-powered real-time order updates, push notifications for students, and promotional offer management with targeted announcements.",
  },
];

export const FeaturesSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="features" className="section-padding bg-card">
      <div ref={ref} className="max-w-7xl mx-auto container-padding">
        {/* Header */}
        <div
          className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-500 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything You Need to{" "}
            <span className="text-red-600">Run Your Canteen</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            A complete suite of tools for institutional cafeterias & canteens in colleges & universities, hospital cafeterias, and corporate/company campuses.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`group bg-background rounded-xl p-6 border border-border card-hover transition-all duration-500 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: `${150 + index * 50}ms` }}
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-heading text-lg font-bold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

