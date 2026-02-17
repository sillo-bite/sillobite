import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "./svg/logo";
import { usePWA } from "@/contexts/PWAContext";
const navLinks = [
  { label: "Product", href: "#product" },
  { label: "Solutions", href: "#solutions" },
  { label: "Resources", href: "#resources" },
  { label: "Pricing", href: "#pricing" },
  { label: "Contact", href: "#contact" },
];

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { installPWA, isInstalled } = usePWA();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 90);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? "bg-white/70 backdrop-blur-md shadow-sm py-3" : "bg-transparent py-5"
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 justify-between">
          {/* Logo */}
          <div
            className="flex items-center cursor-pointer gap-2 select-none"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            {/* Left cloud */}
            <svg
              viewBox="0 0 2000 2000"
              className="w-[clamp(28px,3.2vw,50px)] h-[clamp(28px,3.2vw,50px)] shrink-0"
              fill={!isScrolled ? "#fffbf7" : "#9847D1"}
            >
              <path d="M661.835 205.633C669.145 207.066 879.439 341.81 893.676 350.798L1625.08 812.471C1617.77 847.498 1610.81 879.006 1605.16 914.591C1587.18 1027.68 1583.12 1142.55 1593.09 1256.63C1596.6 1297.18 1602.31 1331.06 1607.54 1370.76C1581.96 1383.18 1549.61 1401.95 1524.34 1415.69L1363.74 1502.97L951.763 1726.89L610.174 1912.34C585.425 1884.58 555.862 1859.16 533.13 1829.63C516.642 1808.22 511.239 1787.7 510.46 1761.18C508.377 1690.31 560.19 1658.09 607.324 1615.56C623.974 1600.85 639.351 1584.46 653.73 1567.55C725.714 1481.89 736.268 1355.63 682.852 1258.16C649.681 1197.63 599.527 1163.58 558.397 1110.57C541.632 1088.96 538.179 1068.8 536.937 1042.61C534.091 982.606 575.156 947.552 616.838 912.323C638.56 893.46 661.649 871.844 680.229 849.238C711.081 812.328 731.37 767.758 738.945 720.253C754.665 622.422 723.178 538.66 655.568 468.595C613.888 425.403 553.156 379.546 564.109 312.495C570.823 271.391 629.877 228.222 661.835 205.633Z" />
            </svg>

            {/* Center cloud pill */}
            <div
              className={`
      -mx-[clamp(6px,0.8vw,12px)]
      inline-flex items-center gap-[clamp(6px,1vw,12px)]
      px-[clamp(12px,2vw,22px)]
      py-[clamp(6px,0.9vw,10px)]
      rounded-[40%_60%_55%_45%/55%_60%_40%]
      shadow-md backdrop-blur-sm
      font-semibold whitespace-nowrap
      text-[clamp(14px,1.6vw,22px)]
      ${!isScrolled
                  ? "bg-[#fffbf7] text-[#9847D1]"
                  : "bg-[#9847D1] text-[#fffbf7]"}
    `}
            >
              <Logo
                color={!isScrolled ? "#9847D1" : "#fffbf7"}
                ClassName="w-[clamp(25px,2vw,35px)] h-[clamp(25px,2vw,35px)]"
              />
              <span className="leading-none">SilloBite</span>
            </div>

            {/* Right cloud */}
            <svg
              viewBox="0 0 2000 2000"
              className="w-[clamp(28px,3.2vw,50px)] h-[clamp(28px,3.2vw,50px)] shrink-0"
              fill={!isScrolled ? "#fffbf7" : "#9847D1"}
              style={{ transform: "scaleX(-1)" }}
            >
              <path d="M661.835 205.633C669.145 207.066 879.439 341.81 893.676 350.798L1625.08 812.471C1617.77 847.498 1610.81 879.006 1605.16 914.591C1587.18 1027.68 1583.12 1142.55 1593.09 1256.63C1596.6 1297.18 1602.31 1331.06 1607.54 1370.76C1581.96 1383.18 1549.61 1401.95 1524.34 1415.69L1363.74 1502.97L951.763 1726.89L610.174 1912.34C585.425 1884.58 555.862 1859.16 533.13 1829.63C516.642 1808.22 511.239 1787.7 510.46 1761.18C508.377 1690.31 560.19 1658.09 607.324 1615.56C623.974 1600.85 639.351 1584.46 653.73 1567.55C725.714 1481.89 736.268 1355.63 682.852 1258.16C649.681 1197.63 599.527 1163.58 558.397 1110.57C541.632 1088.96 538.179 1068.8 536.937 1042.61C534.091 982.606 575.156 947.552 616.838 912.323C638.56 893.46 661.649 871.844 680.229 849.238C711.081 812.328 731.37 767.758 738.945 720.253C754.665 622.422 723.178 538.66 655.568 468.595C613.888 425.403 553.156 379.546 564.109 312.495C570.823 271.391 629.877 228.222 661.835 205.633Z" />
            </svg>
          </div>



          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`text-sm font-medium  hover:text-[#9847D1] transition-colors ${isScrolled ? 'text-gray-600' : 'text-[#fffbf7]'}`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Button
              variant="ghost"
              className={`text-[#9847D1]  font-medium rounded-full px-6 ${isScrolled ? 'text-gray-600 hover:text-[#fffbf7] hover:bg-[#9847D1]' : 'text-[#fffbf7] hover:bg-[#fffbf7] hover:text-[#9847D1]'}`}
              onClick={() => window.location.href = "/splashscreen?pwa=true"}
            >
              Open App
            </Button>
            {!isInstalled && (
              <Button
                variant="ghost"
                className={`font-medium px-6 shadow-md hover:shadow-lg rounded-full transition-all ${isScrolled ? 'text-gray-600 hover:text-[#fffbf7] hover:bg-[#9847D1] bg-[#9847D1] text-[#fffbf7]' : 'text-[#9847D1] bg-[#fffbf7] hover:bg-[#9fffbf7] hover:text-[#9847D1]'}`}
                onClick={() => installPWA()}
              >
                Install App
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-3">
            <button

              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`absolute top-4 right-4 md:hidden  p-2 ${isScrolled ? 'text-gray-600 hover:text-gray-900' : 'text-[#fffbf7] hover:text-[#9847D1]'}`}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`md:hidden border-b border-gray-100 overflow-hidden ${isScrolled ? 'bg-white-70 text-gray-600 hover:text-[#fffbf7] hover:bg-[#9847D1]' : 'bg-[#9847D1] text-[#fffbf7] hover:bg-[#fffbf7] hover:text-[#9847D1]'}`}
          >
            <div className="px-4 pt-2 pb-6 space-y-2 flex flex-col items-center">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="block px-3 py-2 text-base font-medium rounded-md"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-4 flex flex-row gap-3">
                <Button
                  variant="outline"
                  className={`w-full border-[#9847D1] rounded-full text-[#9847D1]`}
                  onClick={() => window.open("/splashscreen?pwa=true", "_blank")}
                >
                  Open App
                </Button>
                <Button
                  className="w-full bg-[#fffbf7] text-[#9847D1] rounded-full"
                  onClick={() => window.open("/demo", "_blank")}
                >
                  Install App
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
