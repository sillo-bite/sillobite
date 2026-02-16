import { Smartphone, Monitor, Store } from "lucide-react";
import { motion } from "framer-motion";

export const PlatformOverview = () => {
    const features = [
        {
            icon: Smartphone,
            title: "Food Ordering App",
            description: "Seamless mobile experience for students & employees to browse menus, order ahead, and pay contact-free."
        },
        {
            icon: Monitor,
            title: "Admin Control Panel",
            description: "Centralized dashboard to manage menus, inventory, track sales, and generate detailed reports."
        },
        {
            icon: Store,
            title: "Multi-Vendor Management",
            description: "Effortlessly onboard and oversee diverse vendors, manage payouts, and ensure quality across all options."
        }
    ];

    return (
        <section className="relative bg-[#FFB17A] pt-10 pb-32">
            {/* Top Wave Divider (Inverted to mesh with Hero) is handled by Hero's bottom wave overlapping or simple background match */}

            <div className="container mx-auto px-4 text-center text-white relative z-10">
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-3xl md:text-5xl font-bold mb-16"
                >
                    The SilloBite Platform
                </motion.h2>

                <div className="grid md:grid-cols-3 gap-12 max-w-6xl mx-auto">
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: index * 0.2 }}
                            className="flex flex-col items-center group"
                        >
                            <div className="w-24 h-24 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm group-hover:bg-white/20 transition-all border border-white/10">
                                <feature.icon className="w-12 h-12 text-[#FFD700]" /> {/* Illustrative Color */}
                            </div>
                            <h3 className="text-xl font-bold mb-4">{feature.title}</h3>
                            <p className="text-white/80 leading-relaxed max-w-sm">
                                {feature.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Bottom Wave Divider (Transition to White) */}
            <div className="absolute bottom-0 left-0 w-full leading-none z-20 translate-y-1">
                <svg className="block w-full h-24 md:h-32 lg:h-40" viewBox="0 0 1440 320" preserveAspectRatio="none">
                    <path fill="#ffffff" fillOpacity="1" d="M0,224L48,234.7C96,245,192,267,288,250.7C384,235,480,181,576,165.3C672,149,768,171,864,197.3C960,224,1056,256,1152,245.3C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
                </svg>
            </div>
        </section>
    );
};
