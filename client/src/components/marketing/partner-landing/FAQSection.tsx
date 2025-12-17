import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const faqs = [
  {
    question: "Do I need special hardware to use Sillobyte?",
    answer:
      "No special hardware is required. Sillobyte runs on any device with a modern browser — tablets, phones, laptops, or existing POS terminals. For kitchen displays, any Android tablet or monitor with a browser works perfectly.",
  },
  {
    question: "Can Sillobyte handle both online and cash payments?",
    answer:
      "Yes! Sillobyte supports UPI (PhonePe, Google Pay), Card (Credit/Debit), Wallet, and Cash payments. Online payments are processed via integrated gateway, while cash payments are handled at the payment counter with full tracking and unified reporting.",
  },
  {
    question: "How long does onboarding typically take?",
    answer:
      "Most institutions are up and running within 24-48 hours. We handle menu setup, counter configuration, and staff training. Complex multi-location setups may take 3-5 days.",
  },
  {
    question: "Does Sillobyte work with multiple counters?",
    answer:
      "Absolutely. Sillobyte is designed for multi-counter workflows from the ground up. Each counter (billing, kitchen, pickup) can have its own screen and role-based access.",
  },
  {
    question: "Is Sillobyte available only as a PWA?",
    answer:
      "Yes, Sillobyte is a Progressive Web App by design. This means instant access without app store downloads, automatic updates, and works offline. Students simply visit the URL and can add it to their home screen like a native app.",
  },
  {
    question: "Can Sillobyte support multiple institutions or locations?",
    answer:
      "Yes! Sillobyte is built with multi-institution architecture from the ground up. One platform can manage multiple colleges, hospital campuses, or corporate offices, each with their own canteens, menus, users, and settings. Perfect for institutional networks or multi-location operations.",
  },
];

export const FAQSection = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="faq" className="section-padding">
      <div ref={ref} className="max-w-3xl mx-auto container-padding">
        {/* Header */}
        <div
          className={`text-center mb-12 transition-all duration-500 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
            Frequently Asked <span className="text-red-600">Questions</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Common questions from canteen owners and institutional administrators.
          </p>
        </div>

        {/* FAQ Accordion */}
        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`transition-all duration-500 ease-out ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: `${150 + index * 75}ms` }}
            >
              <AccordionItem
                value={`item-${index}`}
                className="bg-card rounded-xl border border-border px-6 data-[state=open]:shadow-soft transition-shadow"
              >
                <AccordionTrigger className="text-left font-heading font-semibold text-foreground hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            </div>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

