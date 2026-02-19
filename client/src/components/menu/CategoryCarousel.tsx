import React from "react";
import { useLocation } from "wouter";
import CategoryIcon from "@/components/ui/CategoryIcon";
import { CategorySkeletonLoader, CategoryLoadingIndicator } from "@/components/menu/CategorySkeletonLoader";
import type { Category } from "@shared/schema";

interface CategoryCarouselProps {
  categories: Category[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  totalCategories: number;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  createCategoryUrl: (categoryName: string) => string;
}

const CategoryCarousel = React.memo(function CategoryCarousel({
  categories,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  totalCategories,
  onScroll,
  createCategoryUrl
}: CategoryCarouselProps) {
  const [location, setLocation] = useLocation();

  const getCategoryTextClassName = () => {
    const baseClasses = "text-[10px] font-semibold leading-tight truncate";
    return `${baseClasses} text-foreground`;
  };

  const handleCategoryClick = (categoryName: string) => {
    // Check if we're on /app page - if so, use custom event to navigate within AppPage
    if (location === '/app') {
      // Dispatch event to AppPage to switch to menu view with this category
      window.dispatchEvent(new CustomEvent('appNavigateToMenu', {
        detail: { category: categoryName }
      }));
    } else {
      // If not on /app, use normal navigation
      setLocation(`/menu/${createCategoryUrl(categoryName)}`);
    }
  };

  return (
    <div className="mb-2">
      <div className="relative">
        {/* Native horizontal scrolling container with premium styling */}
        <div
          className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'smooth'
          }}
          onScroll={onScroll}
        >
          {/* Show skeleton loader while initial loading */}
          {isLoading && categories.length === 0 ? (
            <CategorySkeletonLoader count={5} />
          ) : (
            <>
              {/* Render loaded categories with premium styling */}
              {Array.isArray(categories) ? categories.map((category, index) => {
                const isFirst = index === 0;
                const isLast = index === categories.length - 1;
                const categoryNameLower = (category.name || "").toLowerCase().trim();
                const categoryId = String(category.id || (category as any)._id || "").toLowerCase();

                // Detection for the 'Menu' (all) category - check name, ID, or if it's the very first one with ID 'all'
                const isMenu = categoryNameLower === 'all' ||
                  categoryNameLower === 'menu' ||
                  categoryId === 'all';

                return (
                  <div
                    key={category.id || (category as any)._id || `category-${index}`}
                    className={`cursor-pointer transition-all duration-300 flex-shrink-0 ${isMenu ? 'w-[90px]' : 'w-[72px]'} flex flex-col items-center justify-center touch-manipulation hover:scale-105 active:scale-95 ${isFirst ? 'pl-4' : ''} ${isLast ? 'pr-4' : ''}`}
                    onClick={() => handleCategoryClick(category.name)}
                    style={{
                      animationDelay: `${index * 50}ms`,
                    }}
                  >
                    <div className="flex items-center justify-center mx-auto h-16 animate-stagger-fade" style={{ animationDelay: `${index * 50}ms` }}>
                      <CategoryIcon category={category} size="md" isMenu={isMenu} />
                    </div>
                    <p className={`${getCategoryTextClassName()} px-1 mt-2`} title={isMenu ? 'Menu' : category.name} style={{
                      wordBreak: 'break-word',
                      hyphens: 'auto',
                      WebkitHyphens: 'auto',
                      msHyphens: 'auto'
                    }}>
                      {isMenu ? 'Menu' : category.name}
                    </p>
                  </div>
                );
              }) : []}

              {/* Show loading indicator for next page */}
              {isFetchingNextPage && (
                <div className="flex-shrink-0 w-[72px] flex flex-col items-center justify-center pr-4">
                  <CategoryLoadingIndicator
                    isFetching={isFetchingNextPage}
                    hasNextPage={hasNextPage}
                    totalLoaded={categories.length}
                    totalAvailable={totalCategories}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default CategoryCarousel;
