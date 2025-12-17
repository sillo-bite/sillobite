import { Home, User, DollarSign } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface DeliveryBottomNavigationProps {
  currentTab: "home" | "profile" | "earnings";
  onNavigate: (tab: "home" | "profile" | "earnings") => void;
}

export default function DeliveryBottomNavigation({ 
  currentTab, 
  onNavigate 
}: DeliveryBottomNavigationProps) {
  const { resolvedTheme } = useTheme();

  const navigationItems = [
    { id: "home" as const, label: "Home", icon: Home },
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "earnings" as const, label: "Earnings", icon: DollarSign },
  ];

  // Calculate the position and width of the sliding indicator
  const activeIndex = navigationItems.findIndex(item => item.id === currentTab);
  const indicatorStyle = {
    transform: `translateX(${activeIndex * 100}%)`,
    width: `${100 / navigationItems.length}%`,
  };

  return (
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
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-300 ease-out"
          style={indicatorStyle}
        />
      </div>

      {/* Navigation items */}
      <div className="flex items-center justify-around px-2 pb-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-2 px-1 transition-colors duration-200 ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label={item.label}
            >
              <Icon 
                className={`w-6 h-6 mb-1 transition-transform duration-200 ${
                  isActive ? 'scale-110' : 'scale-100'
                }`}
              />
              <span className={`text-xs font-medium transition-all duration-200 ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
















