import { useTheme } from "@/contexts/ThemeContext";
import { Skeleton } from "@/components/ui/skeleton";

export default function MenuListingPageSkeleton() {
  const { resolvedTheme } = useTheme();

  const getSkeletonClassName = () => {
    return resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200';
  };

  const getCardClassName = () => {
    const baseClasses = "rounded-xl shadow-lg border-0 overflow-hidden animate-pulse";
    const themeClasses = resolvedTheme === 'dark' 
      ? 'bg-black border-gray-800' 
      : 'bg-white border-gray-200';
    
    return `${baseClasses} ${themeClasses}`;
  };

  return (
    <>
      <div 
        className={`min-h-screen overflow-y-auto scrollbar-hide ${
          resolvedTheme === 'dark' ? 'bg-[#1a1a1a]' : 'bg-background'
        }`}
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* Header Container Skeleton */}
        <div className="bg-red-600 rounded-b-2xl shadow-xl overflow-hidden">
          <div className="px-4 pt-12 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Back button skeleton */}
                <Skeleton className="w-10 h-10 rounded-full bg-white/20" />
                {/* Title skeleton */}
                <Skeleton className="h-6 w-32 rounded bg-white/20" />
              </div>
              <div className="flex items-center space-x-2">
                {/* Veg toggle skeleton */}
                <Skeleton className="w-12 h-6 rounded-full bg-white/20" />
                <Skeleton className="h-4 w-16 rounded bg-white/20" />
              </div>
            </div>
          </div>
        </div>

        {/* Categories Skeleton - Horizontal Scrollable */}
        <div>
          <div 
            className="flex space-x-4 overflow-x-auto scrollbar-hide pb-4 px-4 py-4"
            style={{ 
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch', 
              touchAction: 'pan-x' 
            }}
          >
            {/* All button skeleton */}
            <Skeleton className={`flex-shrink-0 h-9 w-16 rounded-full ${getSkeletonClassName()}`} />
            {/* Category buttons skeleton */}
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton 
                key={index} 
                className={`flex-shrink-0 h-9 w-24 rounded-full ${getSkeletonClassName()}`} 
              />
            ))}
          </div>
        </div>

        {/* Menu Items Skeleton */}
        <div className="p-4 space-y-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className={getCardClassName()}>
              <div className="p-0">
                {/* Top Section - Image with rounded corners */}
                <div className="w-full relative aspect-[21/9] overflow-hidden">
                  <div className={`absolute inset-0 overflow-hidden rounded-t-2xl ${getSkeletonClassName()}`}>
                    <div className={`w-full h-full ${getSkeletonClassName()} flex items-center justify-center`}>
                      <span className="text-5xl opacity-50">🍽️</span>
                    </div>
                  </div>
                </div>
                
                {/* Bottom Section - Content */}
                <div className={`${resolvedTheme === 'dark' ? 'bg-black' : 'bg-white'} relative`} style={{ 
                  marginTop: '-12px', 
                  borderRadius: '0 0 0.75rem 0.75rem',
                  borderTopLeftRadius: '0',
                  borderTopRightRadius: '0.5rem'
                }}>
                  <div className="px-3 pt-3 pb-3">
                    {/* Item name placeholder */}
                    <div className={`h-5 w-32 rounded mb-3 ${getSkeletonClassName()}`} />
                    
                    {/* Price and Add button */}
                    <div className="flex items-center justify-between">
                      <div className={`h-5 w-16 rounded ${getSkeletonClassName()}`} />
                      <div className={`w-10 h-10 rounded-full ${getSkeletonClassName()}`} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Bottom spacing for navigation and search bar */}
      <div className="pb-[calc(10rem+env(safe-area-inset-bottom))]"></div>
      
      {/* Fixed Search Bar Skeleton above Bottom Navigation */}
      <div className="fixed bottom-[calc(4.375rem+env(safe-area-inset-bottom))] left-0 right-0 w-full z-[9998]">
        <div className={`px-4 py-4 shadow-lg ${
          resolvedTheme === 'dark' 
            ? 'bg-[#1a1a1a] border-t border-gray-800' 
            : 'bg-white border-t border-gray-200'
        }`}>
          <Skeleton className={`h-12 w-full rounded-lg ${getSkeletonClassName()}`} />
        </div>
      </div>
    </>
  );
}

