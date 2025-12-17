import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Who We Serve", href: "#who-we-serve" },
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Why Sillobyte", href: "#why-sillobyte" },
  { label: "Partners", href: "#partners" },
  { label: "FAQ", href: "#faq" },
];

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-500 pt-4 px-4 md:pt-6 md:px-6">
      <div className="max-w-7xl mx-auto">
        <div
          className={`rounded-2xl transition-all duration-500 relative ${
            isScrolled
              ? "bg-card/90 backdrop-blur-xl shadow-2xl border border-border/50"
              : "bg-card/60 backdrop-blur-md shadow-xl border border-border/30"
          }`}
        >
          <div className="container-padding">
            <div className="flex items-center justify-between h-14 sm:h-16 md:h-20">
          {/* Premium Logo */}
          <a
            href="#"
            className="flex items-center group"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <img 
              src="/logo.png" 
              alt="SilloBite Logo" 
              className="h-10 sm:h-12 md:h-16 lg:h-20 xl:h-24 w-auto object-contain transition-transform duration-300 group-hover:scale-105 max-w-[120px] sm:max-w-[150px] md:max-w-none"
            />
          </a>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-2">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollToSection(link.href)}
                className="px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-all duration-300 rounded-lg hover:bg-primary/5 hover:border-primary/20 border border-transparent"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => window.open("/splashscreen", "_blank", "noopener,noreferrer")}
              className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Open App
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 text-foreground hover:bg-primary/5 rounded-lg transition-colors duration-300"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 mt-2 bg-card/95 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl animate-fade-in mx-4 md:mx-6">
            <div className="p-6 space-y-2">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => scrollToSection(link.href)}
                  className="block w-full text-left px-5 py-3 text-base font-semibold text-muted-foreground hover:text-foreground hover:bg-primary/5 rounded-lg transition-all duration-300 border border-transparent hover:border-primary/20"
                >
                  {link.label}
                </button>
              ))}
              <div className="pt-4 border-t border-border mt-4">
                <Button
                  variant="default"
                  className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg"
                  onClick={() => window.open("/splashscreen", "_blank", "noopener,noreferrer")}
                >
                  Open App
                </Button>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </nav>
  );
};
