import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OwnerCard, OwnerButton, OwnerBadge } from "@/components/owner";
import { formatCurrency } from "@/utils/posCalculations";
import { usePrinterStatus } from "@/hooks/usePrinterStatus";
import type { ReactNode } from "react";
import type { MenuItem, Category } from "@shared/schema";

interface MenuGridProps {
  menuItems: MenuItem[];
  categories: Category[];
  searchQuery: string;
  selectedCategory: string;
  isLoading: boolean;
  onSearchChange: (query: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onItemClick: (item: MenuItem) => void;
  headerExtras?: ReactNode;
}

export function MenuGrid({
  menuItems,
  categories,
  searchQuery,
  selectedCategory,
  isLoading,
  onSearchChange,
  onCategoryChange,
  onItemClick,
  headerExtras,
}: MenuGridProps) {
  const { isConnected: isPrinterConnected, isLoading: isPrinterLoading, error: printerError } = usePrinterStatus();
  const printerTitle = isPrinterLoading
    ? "Checking printer..."
    : isPrinterConnected
      ? "Local printer: connected"
      : `Local printer: not connected${printerError ? ` (${printerError})` : ""}`;
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchHeaderRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isSearchExpanded) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const clickedHeader = searchHeaderRef.current?.contains(target) ?? false;
      const clickedInput = searchInputRef.current?.contains(target) ?? false;
      if (!clickedHeader && !clickedInput) {
        setIsSearchExpanded(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isSearchExpanded]);

  return (
    <OwnerCard
      title="Menu Items"
      description="Select items to add to cart"
      headerActions={
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isPrinterLoading ? "bg-muted-foreground animate-pulse" : isPrinterConnected ? "bg-success" : "bg-destructive"
            }`}
            title={printerTitle}
          />
          <OwnerBadge variant="default" className="text-xs">
            {menuItems.length} items
          </OwnerBadge>
          <div ref={searchHeaderRef}>
            <OwnerButton
              variant="icon"
              size="sm"
              icon={<Search className="w-4 h-4" />}
              onClick={() => setIsSearchExpanded((v) => !v)}
              aria-label={isSearchExpanded ? "Collapse search" : "Expand search"}
              title="Search"
            />
          </div>
          {headerExtras}
        </div>
      }
      className="lg:col-span-2 flex flex-col overflow-hidden h-full"
      contentClassName="flex-1 flex flex-col overflow-hidden p-3 sm:p-4 min-h-0"
    >
      {/* Search and Filters */}
      <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4 flex-shrink-0">
        {isSearchExpanded && (
          <div ref={searchInputRef} className="flex items-center">
            <Input
              autoFocus
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 sm:h-10 text-sm w-full"
            />
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto pb-2 app-scrollbar -mx-1 px-1">
          <OwnerButton
            variant={selectedCategory === "all" ? "primary" : "secondary"}
            size="sm"
            onClick={() => onCategoryChange("all")}
            className="whitespace-nowrap"
          >
            All
          </OwnerButton>
          {categories.map(cat => (
            <OwnerButton
              key={cat.id}
              variant={selectedCategory === cat.id ? "primary" : "secondary"}
              size="sm"
              onClick={() => onCategoryChange(cat.id)}
              className="whitespace-nowrap"
            >
              {cat.name}
            </OwnerButton>
          ))}
        </div>
      </div>

      {/* Menu Items Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto app-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading menu items...</p>
            </div>
          </div>
        ) : menuItems.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-muted-foreground">No items found</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => onItemClick(item)}
                className="group relative bg-card border border-border rounded-lg overflow-hidden hover:shadow-md active:scale-95 transition-all duration-200 hover:border-primary/50 touch-manipulation"
              >
                {item.imageUrl && (
                  <div className="w-full h-24 sm:h-32 bg-muted overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                )}
                <div className="p-2 sm:p-3">
                  <h3 className="font-medium text-xs sm:text-sm mb-1 sm:mb-2 line-clamp-1 text-left">{item.name}</h3>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-primary text-sm sm:text-base">{formatCurrency(item.price)}</span>
                    <OwnerBadge 
                      variant={item.stock > 5 ? "default" : "warning"} 
                      className="text-[10px] sm:text-xs px-1.5 py-0.5"
                    >
                      {item.stock}
                    </OwnerBadge>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </OwnerCard>
  );
}
