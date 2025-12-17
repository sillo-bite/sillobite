import { ButtonHTMLAttributes, ReactNode, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface OwnerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "icon";
  size?: "default" | "sm" | "icon";
  isLoading?: boolean;
  children?: ReactNode;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
}

/**
 * OwnerButton
 * 
 * Unified button component for Owner Dashboard with distinct visual styling.
 * All buttons across Owner Dashboard pages must use this component.
 * 
 * Variants:
 * - primary: Solid primary background with white text
 * - secondary: Neutral surface background with subtle border
 * - danger: Solid danger-red background for destructive actions
 * - ghost: Transparent background with hover effect
 * - icon: Square icon button
 */
const OwnerButton = forwardRef<HTMLButtonElement, OwnerButtonProps>(
  function OwnerButton(
    {
      variant = "primary",
      size = "default",
      isLoading = false,
      children,
      icon,
      iconPosition = "left",
      className,
      disabled,
      ...props
    },
    ref
  ) {
    const isIconOnly = variant === "icon" || (!children && icon);

    // Base styles for all variants
    const baseStyles = [
      "inline-flex items-center justify-center",
      "min-h-[38px]",
      "rounded-lg",
      "text-sm font-medium",
      "transition-all duration-200",
      "focus:outline-none focus:ring-2 focus:ring-offset-2",
      "disabled:opacity-60 disabled:cursor-not-allowed",
      "active:scale-[0.98]",
    ];

    // Variant-specific styles
    const variantStyles = {
      primary: [
        "bg-primary text-primary-foreground",
        "hover:bg-primary/90",
        "focus:ring-primary",
        "shadow-sm hover:shadow-md",
      ],
      secondary: [
        "bg-card text-foreground",
        "border border-border",
        "hover:bg-accent hover:text-accent-foreground hover:border-accent",
        "focus:ring-primary/50",
        "shadow-sm",
      ],
      danger: [
        "bg-destructive text-destructive-foreground",
        "hover:bg-destructive/90",
        "focus:ring-destructive",
        "shadow-sm hover:shadow-md",
      ],
      ghost: [
        "bg-transparent text-foreground",
        "hover:bg-accent hover:text-accent-foreground",
        "focus:ring-primary/50",
      ],
      icon: [
        "bg-transparent text-foreground",
        "hover:bg-accent hover:text-accent-foreground",
        "focus:ring-primary/50",
      ],
    };

    // Size-specific styles
    const sizeStyles = {
      default: isIconOnly ? "h-9 w-9 p-0" : "px-4 py-2",
      sm: isIconOnly ? "h-8 w-8 p-0" : "px-3 py-1.5 text-xs min-h-[32px]",
      icon: "h-9 w-9 p-0",
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            {icon && iconPosition === "left" && (
              <span className={cn(children && "mr-2")}>{icon}</span>
            )}
            {children}
            {icon && iconPosition === "right" && (
              <span className={cn(children && "ml-2")}>{icon}</span>
            )}
          </>
        )}
      </button>
    );
  }
);

export default OwnerButton;

