import { ReactNode } from "react";
import { ownerTypography } from "./design-tokens";

interface OwnerPageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * OwnerPageHeader
 * 
 * Standard page header for Owner Dashboard pages.
 * Includes:
 * - Title and optional subtitle
 * - Right-side actions (buttons, filters, etc.)
 * - Consistent spacing and typography
 */
export default function OwnerPageHeader({ 
  title, 
  subtitle, 
  actions,
  className = "" 
}: OwnerPageHeaderProps) {
  return (
    <div className={`flex-shrink-0 p-4 pb-3 border-b border-border ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 
            className="text-lg sm:text-xl text-foreground mb-1"
            style={{
              fontSize: ownerTypography.pageTitle.fontSize,
              lineHeight: ownerTypography.pageTitle.lineHeight,
              fontWeight: ownerTypography.pageTitle.fontWeight,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}






