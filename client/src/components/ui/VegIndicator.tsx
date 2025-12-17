import { cn } from "@/lib/utils";

interface VegIndicatorProps {
  isVegetarian: boolean;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export function VegIndicator({ 
  isVegetarian, 
  size = "sm", 
  showText = false, 
  className 
}: VegIndicatorProps) {
  const sizeClasses = {
    sm: "w-3 h-3 text-[8px]",
    md: "w-4 h-4 text-xs", 
    lg: "w-5 h-5 text-sm"
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div 
        className={cn(
          "rounded-sm border-2 flex items-center justify-center font-bold",
          sizeClasses[size],
          isVegetarian 
            ? "bg-green-50 border-green-600 text-green-600" 
            : "bg-red-50 border-red-600 text-red-600"
        )}
      >
        <div 
          className={cn(
            "rounded-full",
            size === "sm" ? "w-1.5 h-1.5" : size === "md" ? "w-2 h-2" : "w-2.5 h-2.5",
            isVegetarian ? "bg-green-600" : "bg-red-600"
          )}
        />
      </div>
      {showText && (
        <span 
          className={cn(
            "font-medium",
            textSizeClasses[size],
            isVegetarian ? "text-green-600" : "text-red-600"
          )}
        >
          {isVegetarian ? "Veg" : "Non-Veg"}
        </span>
      )}
    </div>
  );
}