import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ownerRadius, ownerShadows } from "./design-tokens";

interface OwnerCardProps {
  children: ReactNode;
  title?: ReactNode;
  description?: string;
  headerActions?: ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  variant?: "default" | "elevated" | "outlined";
  hover?: boolean;
}

/**
 * OwnerCard
 * 
 * Standard card component for Owner Dashboard.
 * Provides consistent:
 * - Border radius
 * - Padding
 * - Shadows
 * - Optional header with title/description
 */
export default function OwnerCard({
  children,
  title,
  description,
  headerActions,
  className = "",
  contentClassName = "",
  headerClassName = "",
  variant = "default",
  hover = false,
}: OwnerCardProps) {
  const variantStyles = {
    default: "bg-card border-border",
    elevated: "bg-card border-border shadow-md",
    outlined: "bg-card border-2 border-border",
  };

  const hoverStyles = hover
    ? "transition-shadow duration-200 hover:shadow-md"
    : "";

  return (
    <Card
      className={`${variantStyles[variant]} ${hoverStyles} ${className}`}
      style={{
        borderRadius: ownerRadius.card,
        boxShadow: variant === "elevated" ? ownerShadows.card : undefined,
      }}
    >
      {(title || description || headerActions) && (
        <CardHeader className={`flex-shrink-0 p-3 pb-2 border-b border-border ${headerClassName}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              {title && (
                <CardTitle className="text-sm font-medium text-foreground">
                  {title}
                </CardTitle>
              )}
              {description && (
                <CardDescription className="text-xs text-muted-foreground mt-1">
                  {description}
                </CardDescription>
              )}
            </div>
            {headerActions && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {headerActions}
              </div>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className={`flex-1 min-h-0 ${contentClassName}`}>
        {children}
      </CardContent>
    </Card>
  );
}

