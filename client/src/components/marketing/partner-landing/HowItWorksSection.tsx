import { CloudDownload, Store, Smartphone, BarChart3, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    icon: CloudDownload,
    step: "1. Deploy Platform",
    description: "Install app & dashboard for your institution.",
  },
  {
    icon: Store,
    step: "2. Onboard Vendors",
    description: "Set up menus, payments, and logistics.",
  },
  {
    icon: Smartphone,
    step: "3. Users Order",
    description: "Students & employees order contact-free.",
  },
  {
    icon: BarChart3,
    step: "4. Manage & Grow",
    description: "Track performance, optimize dining operations.",
  },
];

export const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-24 bg-white relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-gray-800"
          >
            How It Works for Campuses & Companies
          </motion.h2>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative max-w-6xl mx-auto gap-8 md:gap-4">
          {/* Connector Line (Desktop) */}
          <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gray-200 -z-10 transform translate-y-1/2" />

          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
              className="flex flex-col items-center text-center flex-1 relative bg-white md:bg-transparent p-4 md:p-0 rounded-xl"
            >
              <div className="w-24 h-24 bg-white border-2 border-gray-100 rounded-2xl flex items-center justify-center mb-6 shadow-lg z-10 relative">
                {/* Icon Color varies or stays consistent? Design shows colored icons. */}
                {index === 0 && <step.icon className="w-10 h-10 text-blue-500" />}
                {index === 1 && <step.icon className="w-10 h-10 text-orange-500" />}
                {index === 2 && <step.icon className="w-10 h-10 text-purple-500" />}
                {index === 3 && <step.icon className="w-10 h-10 text-green-500" />}

                {/* Small badge? No, simple icons. */}
              </div>

              <h3 className="font-bold text-lg text-gray-800 mb-2">{step.step}</h3>
              <p className="text-gray-500 text-sm max-w-[200px]">
                {step.description}
              </p>

              {/* Mobile Arrows (below each step except last) */}
              {index < steps.length - 1 && (
                <div className="md:hidden mt-4 text-gray-300">
                  <ArrowRight className="w-6 h-6 rotate-90" />
                </div>
              )}

              {/* Desktop Arrows (between steps) - handled by absolute positioning or flex gap? 
                   The line handles the connection, arrows might be redundant visually if lines are clear.
                   Design has arrows between icons. 
               */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 -right-1/2 transform translate-x-1/2 translate-y-1/2 text-gray-300 z-0">
                  <ArrowRight className="w-6 h-6" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
