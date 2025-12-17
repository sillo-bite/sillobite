import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { OwnerCard, OwnerButton, OwnerBadge } from "@/components/owner";
import { formatCurrency } from "@/utils/posCalculations";
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
}: MenuGridProps) {
  return (
    <OwnerCard
      title="Menu Items"
      description="Select items to add to cart"
      headerActions={
        <OwnerBadge variant="default" className="text-xs">
          {menuItems.length} items
        </OwnerBadge>
      }
      className="lg:col-span-2 flex flex-col overflow-hidden h-full"
      contentClassName="flex-1 flex flex-col overflow-hidden p-4 min-h-0"
    >
      {/* Search and Filters */}
      <div className="space-y-3 mb-4 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 app-scrollbar">
          <OwnerButton
            variant={selectedCategory === "all" ? "primary" : "secondary"}
            size="sm"
            onClick={() => onCategoryChange("all")}
          >
            All
          </OwnerButton>
          {categories.map(cat => (
            <OwnerButton
              key={cat.id}
              variant={selectedCategory === cat.id ? "primary" : "secondary"}
              size="sm"
              onClick={() => onCategoryChange(cat.id)}
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => onItemClick(item)}
                className="group relative bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-all duration-200 hover:border-primary/50"
              >
                {item.imageUrl && (
                  <div className="w-full h-32 bg-muted overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                )}
                <div className="p-3">
                  <h3 className="font-medium text-sm mb-2 line-clamp-1 text-left">{item.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-primary">{formatCurrency(item.price)}</span>
                    <OwnerBadge 
                      variant={item.stock > 5 ? "default" : "warning"} 
                      className="text-xs"
                    >
                      {item.stock} left
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
