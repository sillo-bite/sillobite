import { Button } from "@/components/ui/button";
import { ArrowLeft, LucideIcon } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { updateStatusBarColor } from "@/utils/statusBar";

interface PageHeaderProps {
  title: string;
  icon?: LucideIcon;
  onBack?: () => void;
  backTo?: string;
  className?: string;
  showBackButton?: boolean;
}

/**
 * Reusable page header component with back navigation
 * Handles common back navigation patterns across the app
 */
export default function PageHeader({
  title,
  icon: Icon,
  onBack,
  backTo,
  className = "",
  showBackButton = true
}: PageHeaderProps) {
  const [, setLocation] = useLocation();
  const headerRef = useRef<HTMLDivElement>(null);

  // Update status bar to match header color
  useEffect(() => {
    if (headerRef.current) {
      // Extract background color from className or use default red-600
      const bgClass = className.match(/bg-\w+-\d+/)?.[0] || 'bg-red-600';
      updateStatusBarColor('#724491'); // Default to purple primary color
    }
  }, [className]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      setLocation(backTo);
    } else {
      // Default: navigate to /app and dispatch back event
      setLocation("/app");
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('appNavigateBack', {}));
      }, 0);
    }
  };

  return (
    <div ref={headerRef} className={`bg-red-600 text-white px-4 pt-12 pb-6 sticky top-0 z-10 rounded-b-2xl ${className}`}>
      <div className="flex items-center space-x-4">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-red-700"
            onClick={handleBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div className="flex items-center space-x-2 flex-1">
          {Icon && <Icon className="w-5 h-5 text-white" />}
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
      </div>
    </div>
  );
}

