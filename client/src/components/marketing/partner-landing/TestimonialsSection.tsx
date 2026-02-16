import { motion } from "framer-motion";

const testimonials = [
    {
        name: "Sarah Jenkins",
        role: "Director of Campus Services, State University",
        image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=128&q=80",
        quote: "Since adopting SilloBite, our campus dining efficiency has improved significantly, and vendor satisfaction is at an all-time high."
    },
    {
        name: "Michael Chen",
        role: "Facilities Manager, TechCorp Solutions",
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=crop&w=128&q=80",
        quote: "The admin controls are incredibly powerful. We can now manage multiple office locations and diverse vendors with ease."
    }
];

export const TestimonialsSection = () => {
    return (
        <section className="py-24 bg-white">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-3xl md:text-5xl font-bold text-gray-900 mb-4"
                    >
                        Trusted by Facility Managers
                    </motion.h2>
                </div>

                <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                    {testimonials.map((testimonial, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.2 }}
                            className="bg-[#FFF5F0] rounded-2xl p-8 flex gap-6 items-start"
                        >
                            <img
                                src={testimonial.image}
                                alt={testimonial.name}
                                className="w-16 h-16 rounded-full object-cover shrink-0 border-2 border-white shadow-md"
                            />
                            <div>
                                <p className="text-gray-700 italic mb-4 leading-relaxed">
                                    "{testimonial.quote}"
                                </p>
                                <div>
                                    <h4 className="font-bold text-gray-900">{testimonial.name}</h4>
                                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};
