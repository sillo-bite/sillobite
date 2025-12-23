import { useLocation } from "wouter";
import { Home, ShoppingCart, User, Utensils, Heart, ArrowUp } from "lucide-react";
import { usePWANavigation } from "@/hooks/usePWANavigation";
import { useCart } from "@/contexts/CartContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useState, useEffect, useCallback } from "react";

interface BottomNavigationProps {
  currentPage: "home" | "menu" | "cart" | "profile" | "favorites";
  onNavigate?: (view: "home" | "menu" | "cart" | "profile" | "favorites") => void;
}

export default function BottomNavigation({ currentPage, onNavigate }: BottomNavigationProps) {
  const [, setLocation] = useLocation();
  const { navigateTo } = usePWANavigation();
  const { getTotalItems } = useCart();
  const { resolvedTheme } = useTheme();
  
  // Scroll to top functionality
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  
  const scrollToTop = useCallback(() => {
    window.scrollTo({ 
      top: 0, 
      behavior: 'smooth' 
    });
  }, []);
  
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const scrollThreshold = windowHeight * 3; // Show button after scrolling 3 screen heights
      setShowScrollToTop(scrollTop > scrollThreshold);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navigationItems = [
    { id: "home", label: "Home", icon: Home, route: "/app" },
    { id: "menu", label: "Menu", icon: Utensils, route: "/app" },
    { id: "favorites", label: "Favorites", icon: Heart, route: "/app" },
    { id: "cart", label: "Cart", icon: ShoppingCart, route: "/app" },
    { id: "profile", label: "Profile", icon: User, route: "/app" }
  ];

  // Calculate the position and width of the sliding indicator
  const activeIndex = navigationItems.findIndex(item => item.id === currentPage);
  const indicatorStyle = {
    transform: `translateX(${activeIndex * 100}%)`,
    width: `${100 / navigationItems.length}%`,
  };

  return (
    <>
      {/* Scroll to Top Button - positioned above search bar */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-[calc(9rem+env(safe-area-inset-bottom)+0.5rem)] left-1/2 transform -translate-x-1/2 w-12 h-12 rounded-full bg-[#724491] hover:bg-[#562A6E] text-white shadow-lg z-[10000] flex items-center justify-center transition-all duration-500 ease-in-out ${
          showScrollToTop 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-75 translate-y-2 pointer-events-none'
        }`}
        aria-label="Scroll to top of page"
      >
        <ArrowUp className="w-5 h-5" />
      </button>
      
      <div 
        className={`fixed left-0 right-0 w-full z-[9999] ${
          resolvedTheme === 'dark'
            ? 'bg-background border-t border-border'
            : 'bg-white border-t border-gray-200'
        }`}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingTop: '6px',
          height: 'auto',
          minHeight: '64px',
          transform: 'translateZ(0)',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden'
        }}
      >
        {/* Sliding indicator background */}
        <div className="relative h-0.5 mb-1">
          {/* Sliding pill indicator */}
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#724491] to-[#B37ED7] rounded-full transition-all duration-300 ease-out"
            style={indicatorStyle}
          />
        </div>
        
        <div className="flex relative items-center justify-center" style={{ height: '58px', paddingBottom: '4px' }}>
          {navigationItems.map((item) => {
            const isActive = currentPage === item.id;
            const cartItemCount = item.id === "cart" ? getTotalItems() : 0;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (onNavigate) {
                    onNavigate(item.id as "home" | "menu" | "cart" | "profile" | "favorites");
                  } else {
                    navigateTo(item.route);
                  }
                }}
                className={`flex-1 flex flex-col items-center justify-center h-full px-0 transition-all duration-200 relative ${
                  isActive 
                    ? "text-[#724491]" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label={item.label}
                title={item.label}
              >
                <div className="relative flex flex-col items-center justify-center w-full h-full gap-0.5">
                  <div className="relative">
                    <item.icon className={`w-5 h-5 transition-all duration-200 ${isActive ? "scale-110" : "scale-100"}`} />
                    {cartItemCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-[#724491] text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-medium border-2 border-background">
                        {cartItemCount > 99 ? "99+" : cartItemCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium transition-all duration-200 leading-tight ${isActive ? "opacity-100" : "opacity-70"}`}>
                    {item.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}