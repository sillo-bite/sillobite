import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { 
  UtensilsCrossed, 
  ShoppingBag, 
  Clock, 
  MapPin, 
  Heart, 
  Star,
  ArrowRight,
  ChefHat
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { updateStatusBarColor } from "@/utils/statusBar";

interface Feature {
  id: string;
  icon: React.ReactNode;
  name: string;
  color: string;
}

const features: Feature[] = [
  {
    id: "menu",
    icon: <UtensilsCrossed className="w-6 h-6" />,
    name: "Menu",
    color: "text-green-500"
  },
  {
    id: "cart",
    icon: <ShoppingBag className="w-6 h-6" />,
    name: "Cart",
    color: "text-primary"
  },
  {
    id: "tracking",
    icon: <Clock className="w-6 h-6" />,
    name: "Tracking",
    color: "text-orange-500"
  },
  {
    id: "locations",
    icon: <MapPin className="w-6 h-6" />,
    name: "Locations",
    color: "text-blue-500"
  },
  {
    id: "favorites",
    icon: <Heart className="w-6 h-6" />,
    name: "Favorites",
    color: "text-pink-500"
  },
  {
    id: "reviews",
    icon: <Star className="w-6 h-6" />,
    name: "Reviews",
    color: "text-yellow-500"
  }
];

const iconVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: (i: number) => ({
    scale: 1,
    opacity: 1,
    transition: {
      delay: i * 0.1,
      type: "spring",
      stiffness: 200,
      damping: 15
    }
  }),
  hover: {
    scale: 1.15,
    rotate: 5,
    transition: { duration: 0.2 }
  }
};

const centerIconVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 15,
      delay: 0.5
    }
  },
};

export default function OnboardingScreen() {
  const [, setLocation] = useLocation();
  const { resolvedTheme } = useTheme();
  const [primaryColor, setPrimaryColor] = useState('4 68% 52%');

  // Get primary color from CSS variables
  useEffect(() => {
    const updatePrimaryColor = () => {
      if (typeof window !== 'undefined') {
        const root = document.documentElement;
        const computed = getComputedStyle(root);
        const color = computed.getPropertyValue('--primary').trim() || '4 68% 52%';
        setPrimaryColor(color);
      }
    };
    
    updatePrimaryColor();
    
    const observer = new MutationObserver(updatePrimaryColor);
    if (typeof window !== 'undefined') {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
    
    return () => observer.disconnect();
  }, []);

  // Update status bar to match background color
  useEffect(() => {
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    const bgColor = computed.getPropertyValue('--background').trim();
    if (bgColor) {
      // Convert HSL to RGB/hex
      const tempDiv = document.createElement('div');
      tempDiv.style.backgroundColor = `hsl(${bgColor})`;
      document.body.appendChild(tempDiv);
      const computedColor = window.getComputedStyle(tempDiv).backgroundColor;
      document.body.removeChild(tempDiv);
      updateStatusBarColor(computedColor);
    } else {
      // Fallback to light/dark based on theme
      const isDark = resolvedTheme === 'dark';
      updateStatusBarColor(isDark ? '#0E0E0E' : '#F7F7F7');
    }
  }, [resolvedTheme]);

  const handleGetStarted = () => {
    // Mark onboarding as completed (persists across sessions)
    localStorage.setItem('onboarding_completed', 'true');
    // Set flag to indicate we're coming from onboarding
    sessionStorage.setItem('fromOnboarding', 'true');
    setLocation("/login");
  };

  // Calculate positions for icons in a circle
  const iconPositions = features.map((_, index) => {
    const angle = (index * 2 * Math.PI) / features.length;
    const radius = 80; // Distance from center in pixels (reduced)
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      angle: angle * (180 / Math.PI) // Convert to degrees
    };
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-background">
      {/* Animated Gradient Background */}
      <motion.div
        className="absolute inset-0 opacity-15"
        style={{
          background: `radial-gradient(circle at 50% 50%, hsl(${primaryColor} / 0.15) 0%, transparent 70%)`
        }}
        animate={{
          background: [
            `radial-gradient(circle at 20% 50%, hsl(${primaryColor} / 0.1) 0%, transparent 70%)`,
            `radial-gradient(circle at 80% 50%, hsl(${primaryColor} / 0.15) 0%, transparent 70%)`,
            `radial-gradient(circle at 50% 80%, hsl(${primaryColor} / 0.1) 0%, transparent 70%)`,
            `radial-gradient(circle at 20% 50%, hsl(${primaryColor} / 0.1) 0%, transparent 70%)`
          ]
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md space-y-8 flex flex-col items-center">
        
        {/* Feature Icons Circle - Center Section */}
        <div className="relative w-56 h-56 flex items-center justify-center">
          {/* Center Logo/Icon */}
          <motion.div
            className="absolute z-10 w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/70 shadow-lg flex items-center justify-center"
            variants={centerIconVariants}
            initial="hidden"
            animate="visible"
          >
            <ChefHat className="w-10 h-10 text-primary-foreground" />
          </motion.div>

          {/* Surrounding Feature Icons */}
          {features.map((feature, index) => {
            const pos = iconPositions[index];
            return (
              <motion.div
                key={feature.id}
                className="absolute w-14 h-14 rounded-xl bg-card border-2 border-border shadow-xl flex items-center justify-center backdrop-blur-sm"
                style={{
                  left: `calc(50% + ${pos.x}px - 28px)`,
                  top: `calc(50% + ${pos.y}px - 28px)`,
                }}
                variants={iconVariants}
                initial="hidden"
                animate="visible"
                custom={index}
                whileHover="hover"
                whileTap={{ scale: 0.95 }}
              >
                <div className={feature.color}>
                  {feature.icon}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Text Content */}
        <motion.div
          className="text-center space-y-3 px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Your Dining Experience<br />in One Place
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-xs mx-auto">
            Browse menus, track orders, and manage your favorites—all in one app.
          </p>
        </motion.div>

        {/* Get Started Button */}
        <motion.div
          className="w-full max-w-xs mt-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
        >
          <Button
            onClick={handleGetStarted}
            className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold text-sm rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center space-x-2 group"
          >
            <span>Get Started</span>
            <motion.div
              animate={{ x: [0, 4, 0] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <ArrowRight className="w-4 h-4" />
            </motion.div>
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
