import { ReactNode } from "react";
import { ownerSpacing } from "./design-tokens";

interface OwnerPageLayoutProps {
  children: ReactNode;
  className?: string;
}

/**
 * OwnerPageLayout
 * 
 * Provides consistent page structure for all Owner Dashboard pages.
 * Handles:
 * - Page padding and max-width
 * - Main scrollable area below the top bar
 * - Full-height flex column layout
 */
export default function OwnerPageLayout({ children, className = "" }: OwnerPageLayoutProps) {
  return (
    <div className={`h-full flex flex-col min-h-0 ${className}`}>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}






