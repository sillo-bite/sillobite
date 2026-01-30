import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { Mail, Phone, MapPin } from "lucide-react";

export const Footer = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <footer ref={ref} className="bg-gradient-to-b from-card to-background border-t border-border/50 py-16">
      <div className="max-w-7xl mx-auto container-padding">
        <div
          className={`grid md:grid-cols-4 gap-12 mb-12 transition-all duration-700 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
        >
          {/* Brand Section */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <img
                src="/logo.png"
                alt="SilloBite Logo"
                className="h-20 w-auto object-contain"
              />
              <div>
                <span className="font-heading font-bold text-xl text-primary">
                  SilloBite
                </span>
                <p className="text-xs text-muted-foreground font-medium">
                  Institutional Dining Platform
                </p>
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed text-sm max-w-md mb-6">
              Transforming institutional dining operations with cutting-edge technology. Empowering colleges, hospitals, and corporate campuses with seamless ordering and management solutions.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Mail className="w-4 h-4 text-primary" />
                <span>contact@sillobite.com</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Phone className="w-4 h-4 text-primary" />
                <span>+91 XXX XXX XXXX</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-heading font-bold text-foreground mb-4">Quick Links</h3>
            <ul className="space-y-3">
              <li>
                <a href="#who-we-serve" className="text-sm text-muted-foreground hover:text-primary transition-colors duration-300">
                  Who We Serve
                </a>
              </li>
              <li>
                <a href="#features" className="text-sm text-muted-foreground hover:text-primary transition-colors duration-300">
                  Features
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-primary transition-colors duration-300">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#partners" className="text-sm text-muted-foreground hover:text-primary transition-colors duration-300">
                  Partners
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Support */}
          <div>
            <h3 className="font-heading font-bold text-foreground mb-4">Legal & Support</h3>
            <ul className="space-y-3">
              <li>
                <a href="#contact" className="text-sm text-muted-foreground hover:text-primary transition-colors duration-300">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="/privacy-policy" className="text-sm text-muted-foreground hover:text-primary transition-colors duration-300">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms-conditions" className="text-sm text-muted-foreground hover:text-primary transition-colors duration-300">
                  Terms & Conditions
                </a>
              </li>
              <li>
                <a href="#faq" className="text-sm text-muted-foreground hover:text-primary transition-colors duration-300">
                  FAQ
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          className={`pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-700 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          style={{ transitionDelay: "100ms" }}
        >
          <p className="text-sm text-muted-foreground text-center md:text-left">
            © {new Date().getFullYear()} SilloBite. All rights reserved. Progressive Web Application platform for institutional dining.
          </p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span className="hidden sm:inline">Built with</span>
            <span className="text-primary font-semibold">SilloBite Platform</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
