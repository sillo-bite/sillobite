import { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ownerHeights, ownerSpacing } from "./design-tokens";

interface OwnerTabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

interface OwnerTabListProps {
  children: ReactNode;
  className?: string;
}

interface OwnerTabProps {
  value: string;
  children: ReactNode;
  icon?: ReactNode;
  badge?: number;
  className?: string;
}

interface OwnerTabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

/**
 * OwnerTabs
 * 
 * Unified tabs component for Owner Dashboard.
 * Ensures consistent height, spacing, and styling across all tabbed interfaces.
 */
export function OwnerTabs({ value, onValueChange, children, className = "" }: OwnerTabsProps) {
  return (
    <Tabs 
      value={value} 
      onValueChange={onValueChange} 
      className={`flex-1 flex flex-col min-h-0 ${className}`}
    >
      {children}
    </Tabs>
  );
}

export function OwnerTabList({ children, className = "" }: OwnerTabListProps) {
  return (
    <TabsList 
      className={`inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground mb-4 flex-shrink-0 ${className}`}
    >
      {children}
    </TabsList>
  );
}

export function OwnerTab({ value, children, icon, badge, className = "" }: OwnerTabProps) {
  return (
    <TabsTrigger 
      value={value}
      className={`flex items-center gap-2 ${className}`}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      <span>{children}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 px-1.5 py-0.5 text-xs bg-muted rounded-full">
          {badge}
        </span>
      )}
    </TabsTrigger>
  );
}

export function OwnerTabPanel({ value, children, className = "" }: OwnerTabPanelProps) {
  return (
    <TabsContent 
      value={value} 
      className={`flex-1 flex flex-col min-h-0 mt-0 ${className}`}
    >
      {children}
    </TabsContent>
  );
}

