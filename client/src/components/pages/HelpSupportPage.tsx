import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Phone, Mail, HelpCircle } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function HelpSupportPage() {
  const [, setLocation] = useLocation();
  const { resolvedTheme } = useTheme();

  const faqItems = [
    {
      question: "How do I place an order?",
      answer: "Browse our menu by category, add items to your cart, and proceed to checkout. You can pay online using various payment methods or choose to pay at the counter when collecting your order."
    },
    {
      question: "How do I collect my order?",
      answer: "After placing your order, you'll receive an order number and QR code. Visit the designated counter at the canteen and show your order details to collect your food. Orders are typically ready within 10-15 minutes."
    },
    {
      question: "Can I track my order status?",
      answer: "Yes! You can track your order status in real-time through the 'My Orders' section. You'll see updates when your order is being prepared, ready for collection, or completed."
    },
    {
      question: "What payment methods are accepted?",
      answer: "We accept online payments through UPI, cards, and digital wallets. You can also choose to pay in cash when collecting your order at the counter."
    },
    {
      question: "Can I cancel my order?",
      answer: "You can cancel your order within 2 minutes of placing it through the app. After that, please contact our support team or visit the counter for assistance."
    },
    {
      question: "How do I add items to favorites?",
      answer: "Simply tap the heart icon on any menu item to add it to your favorites. You can access your favorite items quickly from the 'Favorites' tab in the bottom navigation."
    },
    {
      question: "What if I have dietary restrictions?",
      answer: "We offer vegetarian and non-vegetarian options clearly marked with icons. If you have specific dietary requirements, please mention them in the order notes or contact our support team."
    },
    {
      question: "How do I provide feedback?",
      answer: "You can rate and review your orders after completion. Go to 'My Orders' → Select your order → Rate & Review. Your feedback helps us improve our service."
    }
  ];

  return (
    <div className={`min-h-screen ${
      'bg-background'
    }`}>
      {/* Header */}
      <div className="bg-red-600 text-white px-4 pt-12 pb-6 sticky top-0 z-10 rounded-b-2xl">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/20 transition-all duration-200 rounded-full" 
            onClick={() => {
              // Check if we came from Profile
              const fromProfile = sessionStorage.getItem('navigationFrom') === 'profile';
              
              if (fromProfile) {
                // Navigate back to Profile view
                setLocation("/app");
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('appNavigateToProfile', {}));
                }, 0);
              } else {
                // Use history-based back navigation
                setLocation("/app");
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('appNavigateBack', {}));
                }, 0);
              }
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Help & Support</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Contact Options */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Get in Touch</h2>
          <div className="grid grid-cols-1 gap-4">
            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => window.open('tel:+918220963071', '_self')}
            >
              <CardContent className="p-4 flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <Phone className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-medium">Call Us</h3>
                  <p className="text-sm text-muted-foreground">+91 8220963071</p>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => window.open('mailto:sillobyte.production@gmail.com?subject=Support Request', '_self')}
            >
              <CardContent className="p-4 flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-medium">Email Us</h3>
                  <p className="text-sm text-muted-foreground">sillobyte.production@gmail.com</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <HelpCircle className="w-5 h-5" />
            <span>Frequently Asked Questions</span>
          </h2>
          <div className="space-y-4">
            {faqItems.map((item, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <h3 className="font-medium mb-2">{item.question}</h3>
                  <p className="text-sm text-muted-foreground">{item.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}