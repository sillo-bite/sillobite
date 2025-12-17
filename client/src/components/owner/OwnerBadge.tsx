import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OwnerBadgeProps {
  variant?: "info" | "success" | "warning" | "danger" | "default";
  children: ReactNode;
  className?: string;
}

/**
 * OwnerBadge
 * 
 * Unified badge component for status indicators in Owner Dashboard.
 * 
 * Variants:
 * - info: Blue/primary styling
 * - success: Green styling
 * - warning: Yellow/orange styling
 * - danger: Red styling
 * - default: Neutral styling
 */
export default function OwnerBadge({
  variant = "default",
  children,
  className,
}: OwnerBadgeProps) {
  const variantStyles = {
    info: "bg-primary/20 text-primary border-primary/40 dark:bg-primary/30 dark:text-primary dark:border-primary/50",
    success: "bg-success/20 text-success border-success/40 dark:bg-success/30 dark:text-success dark:border-success/50",
    warning: "bg-warning/20 text-warning border-warning/40 dark:bg-warning/30 dark:text-warning dark:border-warning/50",
    danger: "bg-destructive/20 text-destructive border-destructive/40 dark:bg-destructive/30 dark:text-destructive dark:border-destructive/50",
    default: "bg-muted text-muted-foreground border-border",
  };

  return (
    <Badge
      variant="outline"
      className={cn(variantStyles[variant], className)}
    >
      {children}
    </Badge>
  );
}






