import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { HelpCircle } from "lucide-react";

const faqs = [
  {
    question: "Is specialized hardware required to implement SilloBite?",
    answer:
      "No specialized hardware is necessary. SilloBite operates on any device equipped with a modern web browser—including tablets, smartphones, laptops, or existing point-of-sale terminals. For kitchen display systems, any Android tablet or monitor with browser capabilities functions perfectly.",
  },
  {
    question: "Does SilloBite support both digital and cash payment methods?",
    answer:
      "Absolutely. SilloBite provides comprehensive support for UPI (PhonePe, Google Pay), Card payments (Credit/Debit), Digital Wallets, and Cash transactions. Digital payments are processed through integrated payment gateway infrastructure, while cash transactions are managed at payment counters with complete tracking and unified financial reporting.",
  },
  {
    question: "What is the typical implementation timeline?",
    answer:
      "Most institutions are fully operational within 24-48 hours. Our team handles menu configuration, counter setup, and staff training. Complex multi-location deployments may require 3-5 days for complete implementation.",
  },
  {
    question: "Can SilloBite manage operations across multiple service counters?",
    answer:
      "Yes, SilloBite is architected for multi-counter operational workflows from the ground up. Each counter—including billing, kitchen, and pickup stations—can operate with dedicated displays and role-specific access controls.",
  },
  {
    question: "Is SilloBite exclusively available as a Progressive Web Application?",
    answer:
      "Yes, SilloBite is designed as a Progressive Web Application by default. This architecture enables instant access without app store downloads, automatic updates, and offline functionality. Users simply visit the platform URL and can add it to their device home screen for a native app-like experience.",
  },
  {
    question: "Does SilloBite support multiple institutions or locations?",
    answer:
      "Yes. SilloBite is built with multi-institution architecture as a core design principle. A single platform can manage multiple colleges, hospital campuses, or corporate offices, each with independent canteens, menus, user bases, and configuration settings. Ideal for institutional networks or multi-location operations.",
  },
];

export const FAQSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  // Split FAQs into two columns
  const leftColumn = faqs.slice(0, Math.ceil(faqs.length / 2));
  const rightColumn = faqs.slice(Math.ceil(faqs.length / 2));

  return (
    <section id="faq" className="section-padding bg-gradient-to-b from-background to-card/30">
      <div ref={ref} className="max-w-6xl mx-auto container-padding">
        {/* Premium Header */}
        <div
          className={`text-center mb-16 transition-all duration-700 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
            <HelpCircle className="w-4 h-4" />
            <span>Common Questions</span>
          </div>
          <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground mb-6 leading-tight">
            Frequently Asked{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
              Questions
            </span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed font-light">
            Common inquiries from institutional administrators and dining facility operators.
          </p>
        </div>

        {/* Two-Column FAQ Layout */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {/* Left Column */}
          <div className="space-y-4">
            <Accordion type="single" collapsible className="space-y-4">
              {leftColumn.map((faq, index) => (
                <div
                  key={index}
                  className={`transition-all duration-700 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    }`}
                  style={{ transitionDelay: `${150 + index * 100}ms` }}
                >
                  <AccordionItem
                    value={`item-${index}`}
                    className="bg-gradient-to-br from-card via-card to-card/95 rounded-2xl border border-border/50 px-6 data-[state=open]:shadow-xl data-[state=open]:border-primary/30 transition-all duration-300"
                  >
                    <AccordionTrigger className="text-left font-heading font-semibold text-foreground hover:no-underline py-5 text-base">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-5 leading-relaxed text-sm">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                </div>
              ))}
            </Accordion>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <Accordion type="single" collapsible className="space-y-4">
              {rightColumn.map((faq, index) => (
                <div
                  key={index + leftColumn.length}
                  className={`transition-all duration-700 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    }`}
                  style={{ transitionDelay: `${200 + (index + leftColumn.length) * 100}ms` }}
                >
                  <AccordionItem
                    value={`item-${index + leftColumn.length}`}
                    className="bg-gradient-to-br from-card via-card to-card/95 rounded-2xl border border-border/50 px-6 data-[state=open]:shadow-xl data-[state=open]:border-primary/30 transition-all duration-300"
                  >
                    <AccordionTrigger className="text-left font-heading font-semibold text-foreground hover:no-underline py-5 text-base">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-5 leading-relaxed text-sm">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                </div>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
};
