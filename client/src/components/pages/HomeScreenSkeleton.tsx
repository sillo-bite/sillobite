import { useTheme } from "@/contexts/ThemeContext";

export default function HomeScreenSkeleton() {
  const { resolvedTheme } = useTheme();

  const getSkeletonClassName = () => {
    return resolvedTheme === 'dark'
      ? 'bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 animate-premium-shimmer'
      : 'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-premium-shimmer';
  };

  const getCardClassName = () => {
    const baseClasses = "rounded-3xl shadow-premium border-0 overflow-hidden";
    const themeClasses = resolvedTheme === 'dark'
      ? 'bg-gradient-to-br from-gray-800/90 to-gray-900/90'
      : 'bg-white';

    return `${baseClasses} ${themeClasses}`;
  };

  return (
    <div
      className={`min-h-screen overflow-x-hidden overflow-y-auto scrollbar-hide ${'bg-background'
        }`}
      style={{
        touchAction: 'pan-y',
        maxWidth: '100vw',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      {/* Header Skeleton - Premium */}
      <div className="bg-background">
        <div className="px-4 pt-12 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {/* Canteen selector placeholder */}
              <div className={`w-36 h-10 rounded-xl ${getSkeletonClassName()}`} />
            </div>
            <div className="flex items-center space-x-3">
              {/* Profile icon placeholder */}
              <div className={`w-14 h-14 rounded-full ${getSkeletonClassName()}`} />
            </div>
          </div>
        </div>

        {/* Search bar skeleton */}
        <div className="px-4 pb-6">
          <div className={`w-full h-12 rounded-2xl ${getSkeletonClassName()}`} />
        </div>
      </div>

      {/* Categories Carousel Skeleton */}
      <div className="mt-2">
        <div
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-4 px-4"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'auto'
          }}
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="flex-shrink-0 w-[90px] flex flex-col items-center justify-center animate-stagger-fade"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Circular icon placeholder */}
              <div className={`w-16 h-16 rounded-2xl ${getSkeletonClassName()} mb-2`} />
              {/* Text placeholder */}
              <div className={`h-3 w-14 rounded-full ${getSkeletonClassName()}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Media Banner Skeleton */}
      <div className="mt-4 px-4">
        <div className={`w-full aspect-[16/9] rounded-3xl ${getSkeletonClassName()}`} />
      </div>

      <div className="px-4 space-y-8 mt-8">
        {/* Trending Items Section Skeleton */}
        <div className="animate-slide-up-fade" style={{ animationDelay: '200ms' }}>
          {/* Section header skeleton */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl ${getSkeletonClassName()}`} />
            <div>
              <div className={`h-5 w-32 rounded-full mb-1 ${getSkeletonClassName()}`} />
              <div className={`h-3 w-24 rounded-full ${getSkeletonClassName()}`} />
            </div>
          </div>

          {/* Trending items cards skeleton - Grid Layout */}
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={`${getCardClassName()} animate-card-entrance`}
                style={{ animationDelay: `${300 + index * 80}ms` }}
              >
                <div className="p-0">
                  {/* Image placeholder */}
                  <div className={`w-full aspect-[4/3] ${getSkeletonClassName()}`} />

                  {/* Content */}
                  <div className="px-4 py-3">
                    <div className={`h-4 w-3/4 rounded-full mb-2 ${getSkeletonClassName()}`} />
                    <div className="flex items-center justify-between">
                      <div className={`h-5 w-16 rounded-full ${getSkeletonClassName()}`} />
                      <div className={`w-10 h-10 rounded-full ${getSkeletonClassName()}`} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Picks Section Skeleton */}
        <div className="animate-slide-up-fade" style={{ animationDelay: '400ms' }}>
          {/* Section header skeleton */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl ${getSkeletonClassName()}`} />
            <div>
              <div className={`h-5 w-28 rounded-full mb-1 ${getSkeletonClassName()}`} />
              <div className={`h-3 w-20 rounded-full ${getSkeletonClassName()}`} />
            </div>
          </div>

          {/* Quick picks cards skeleton - Grid Layout */}
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={`${getCardClassName()} animate-card-entrance`}
                style={{ animationDelay: `${500 + index * 80}ms` }}
              >
                <div className="p-0">
                  {/* Image placeholder */}
                  <div className={`w-full aspect-[4/3] ${getSkeletonClassName()}`} />

                  {/* Content */}
                  <div className="px-4 py-3">
                    <div className={`h-4 w-3/4 rounded-full mb-2 ${getSkeletonClassName()}`} />
                    <div className="flex items-center justify-between">
                      <div className={`h-5 w-16 rounded-full ${getSkeletonClassName()}`} />
                      <div className={`w-10 h-10 rounded-full ${getSkeletonClassName()}`} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom spacing for bottom sheet */}
      <div className="pb-[calc(10rem+env(safe-area-inset-bottom))]"></div>
    </div>
  );
}
