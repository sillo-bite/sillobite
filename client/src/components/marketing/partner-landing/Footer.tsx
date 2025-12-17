import { useScrollAnimation } from "@/hooks/useScrollAnimation";

export const Footer = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <footer ref={ref} className="bg-background border-t border-border py-12">
      <div className="max-w-7xl mx-auto container-padding">
        <div
          className={`flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-500 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center">
              <span className="text-white font-bold">D</span>
            </div>
            <div>
              <span className="font-heading font-bold text-lg text-primary">Sillobyte</span>
              <p className="text-xs text-muted-foreground">
                Institutional Cafeterias & Canteens Platform
              </p>
            </div>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm">
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              About
            </a>
            <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              Terms
            </a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </a>
          </div>
        </div>

        <div
          className={`mt-8 pt-8 border-t border-border text-center transition-all duration-500 ease-out ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
          style={{ transitionDelay: "100ms" }}
        >
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Sillobyte. All rights reserved. PWA-first ordering for institutions.
          </p>
        </div>
      </div>
    </footer>
  );
};

