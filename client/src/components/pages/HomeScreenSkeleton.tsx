import { useTheme } from "@/contexts/ThemeContext";

export default function HomeScreenSkeleton() {
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
    <div 
      className={`min-h-screen overflow-x-hidden overflow-y-auto scrollbar-hide ${
        'bg-background'
      }`} 
      style={{ 
        touchAction: 'pan-y', 
        maxWidth: '100vw',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      {/* Header Skeleton */}
      <div className="bg-[#724491] rounded-b-2xl shadow-xl overflow-hidden">
        <div className="px-4 pt-12 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {/* Canteen selector placeholder */}
              <div className={`w-32 h-8 rounded-lg ${getSkeletonClassName()}`} />
            </div>
            <div className="flex items-center space-x-3">
              {/* Streak and XP placeholder */}
              <div className={`w-24 h-8 rounded-full ${getSkeletonClassName()}`} />
              {/* Profile icon placeholder */}
              <div className={`w-10 h-10 rounded-full ${getSkeletonClassName()}`} />
            </div>
          </div>
        </div>
      </div>

      {/* Media Banner Skeleton */}
      <div className="mt-4">
        <div className="px-4">
          <div className={`w-full h-48 rounded-2xl ${getSkeletonClassName()}`} />
        </div>
      </div>

      {/* Categories Carousel Skeleton */}
      <div className="mt-4">
        <div 
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
          style={{ 
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x'
          }}
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="flex-shrink-0 w-[100px] flex flex-col items-center justify-center"
            >
              {/* Circular icon placeholder */}
              <div className={`w-16 h-16 rounded-full ${getSkeletonClassName()} mb-2`} />
              {/* Text placeholder */}
              <div className={`h-3 w-16 rounded ${getSkeletonClassName()}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-4 mt-4">
        {/* Trending Items Section Skeleton */}
        <div className="animate-fade-in">
          {/* Section title skeleton */}
          <div className="flex justify-between items-center mb-2">
            <div className={`h-6 w-32 rounded ${getSkeletonClassName()}`} />
          </div>
          
          {/* Trending items cards skeleton - Grid Layout */}
          <div className="grid grid-cols-2 gap-4 pb-2">
            {Array.from({ length: 4 }).map((_, index) => (
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
                      <div className={`h-5 w-24 rounded mb-3 ${getSkeletonClassName()}`} />
                      
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

        {/* Quick Picks Section Skeleton */}
        <div className="animate-slide-up">
          {/* Section title skeleton */}
          <div className="mb-2">
            <div className={`h-6 w-24 rounded ${getSkeletonClassName()}`} />
          </div>
          
          {/* Quick picks cards skeleton - Grid Layout */}
          <div className="grid grid-cols-2 gap-4 pb-[60px]">
            {Array.from({ length: 4 }).map((_, index) => (
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
                      <div className={`h-5 w-24 rounded mb-3 ${getSkeletonClassName()}`} />
                      
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
      </div>
      
      {/* Bottom spacing for bottom sheet - matches HomeScreen */}
      <div className="pb-[calc(7.75rem+env(safe-area-inset-bottom))]"></div>
    </div>
  );
}
