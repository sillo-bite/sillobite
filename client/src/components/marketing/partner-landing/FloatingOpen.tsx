import { Button } from "@/components/ui/button";
import { Smartphone, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

export const FloatingOpen = () => {
    const [isVisible, setIsVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // Show when scrolling down (bringing in), Hide when scrolling up (going under)
            // Show always when near top
            if (currentScrollY < 20) {
                setIsVisible(true);
            } else if (currentScrollY < lastScrollY) {
                // Scrolling UP -> Show
                setIsVisible(true);
            } else {
                // Scrolling DOWN -> Hide
                setIsVisible(false);
            }

            setLastScrollY(currentScrollY);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, [lastScrollY]);

    return (
        <div
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 md:hidden w-full px-4 flex justify-center pointer-events-none transition-transform duration-500 ease-in-out ${isVisible ? 'translate-y-0' : 'translate-y-[200%]'}`}
        >
            {/* Added animate-float-natural for the "hovering" style animation */}
            <div className="pointer-events-auto animate-float-natural">
                {/* Gradient Border Wrapper */}
                <div className="p-[1.5px] rounded-full bg-gradient-to-r from-[#9847D1] via-[#dcaafc] to-[#9847D1] shadow-premium-purple">
                    <Button
                        className={`
                            rounded-full h-14 pl-4 pr-6 
                            bg-white/95 backdrop-blur-xl 
                            border-0
                            text-[#9847D1] 
                            hover:bg-white hover:scale-[1.02] active:scale-95
                            transition-all duration-300 ease-out
                            group flex items-center gap-3
                            relative overflow-hidden
                        `}
                        onClick={() => window.open("/splashscreen?pwa=true", "_self")}
                    >
                        {/* Subtle shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-premium-shimmer" />

                        {/* Premium Icon Container */}
                        <div className="bg-gradient-to-br from-[#9847D1] to-[#7C3AED] p-2.5 rounded-full shadow-inner text-white group-hover:rotate-12 transition-transform duration-300">
                            <Smartphone className="w-5 h-5 fill-current" />
                        </div>

                        <div className="flex flex-col items-start gap-0.5 mr-1">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-[#9847D1]/70 leading-none">Get the App</span>
                            <span className="text-sm font-bold bg-gradient-to-br from-[#9847D1] to-[#5b2a7e] bg-clip-text text-transparent leading-none">
                                Open SilloBite
                            </span>
                        </div>

                        <div className="w-6 h-6 rounded-full bg-[#9847D1]/10 flex items-center justify-center group-hover:bg-[#9847D1] group-hover:text-white transition-all duration-300">
                            <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                    </Button>
                </div>
            </div>
        </div>
    )
}