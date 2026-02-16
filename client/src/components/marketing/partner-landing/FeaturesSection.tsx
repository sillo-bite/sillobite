import { QrCode, Box, Banknote, BarChart3, Leaf, PenTool } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: QrCode,
    title: "Contactless Ordering",
    description: "Scan QR codes to view menus and order without queues."
  },
  {
    icon: Box,
    title: "Inventory Tracking",
    description: "Real-time stock updates to prevent overselling."
  },
  {
    icon: Banknote,
    title: "Vendor Payouts",
    description: "Automated settlements for multi-vendor cafeterias."
  },
  {
    icon: BarChart3,
    title: "Analytics & Reporting",
    description: "Data-driven insights to optimize food court performance."
  },
  {
    icon: Leaf,
    title: "Dietary & Allergen Filter",
    description: "Help users find safe food options easily."
  },
  {
    icon: PenTool,
    title: "Custom Branding",
    description: "Whitelabel solution to match your institution's identity."
  },
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="relative py-32 bg-[#9847D1] overflow-hidden">
      {/* Top Wave (White to Orange transition) */}
      <div className="absolute top-0 left-0 w-full leading-none z-10 rotate-180">
        <svg className="block w-full h-24 md:h-32 lg:h-48" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="#ffffff" fillOpacity="1" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,261.3C960,256,1056,224,1152,197.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
      </div>

      <div className="container mx-auto px-4 relative z-20">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-5xl font-bold text-center text-white mb-16"
        >
          Core Features
        </motion.h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 flex items-start gap-4 hover:bg-white/20 transition-all text-white"
            >
              <div className="bg-white text-[#9847D1] p-3 rounded-xl shadow-lg shrink-0">
                <feature.icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-white/80 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom Wave (Orange to White transition) */}
      <div className="absolute bottom-0 left-0 w-full leading-none z-10">
        <svg className="block w-full h-24 md:h-32 lg:h-48" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="#ffffff" fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,186.7C384,213,480,235,576,213.3C672,192,768,128,864,128C960,128,1056,192,1152,208C1248,224,1344,192,1392,176L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
      </div>
    </section>
  );
};
