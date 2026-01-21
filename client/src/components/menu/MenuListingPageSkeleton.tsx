import { useTheme } from "@/contexts/ThemeContext";

export default function MenuListingPageSkeleton() {
  const { resolvedTheme } = useTheme();

  const getSkeletonClassName = () => {
    return resolvedTheme === 'dark'
      ? 'bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 animate-premium-shimmer'
      : 'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-premium-shimmer';
  };

  const getCardClassName = () => {
    const baseClasses = "rounded-3xl shadow-2xl border-0 overflow-hidden";
    const themeClasses = resolvedTheme === 'dark'
      ? 'bg-[#251F35] border border-white/5'
      : 'bg-white border border-gray-100';

    return `${baseClasses} ${themeClasses}`;
  };

  return (
    <div
      className={`min-h-screen overflow-y-auto scrollbar-hide bg-background`}
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      {/* Fixed Header Container Skeleton - Premium Glassmorphism */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 ${resolvedTheme === 'dark' ? 'bg-background/80' : 'bg-background/90'
          }`}
        style={{
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: resolvedTheme === 'dark'
            ? '1px solid rgba(255, 255, 255, 0.06)'
            : '1px solid rgba(0, 0, 0, 0.04)',
        }}
      >
        <div className="pt-12">
          {/* Top section skeleton */}
          <div className="px-4 pb-3">
            <div className="flex items-center gap-3">
              {/* Back button skeleton */}
              <div className={`w-10 h-10 rounded-xl ${getSkeletonClassName()}`} />

              {/* Search bar skeleton */}
              <div className={`flex-1 h-11 rounded-2xl shadow-xl ${getSkeletonClassName()}`} />

              {/* Veg toggle premium pill skeleton */}
              <div className={`w-24 h-10 rounded-2xl shadow-xl ${getSkeletonClassName()}`} />
            </div>
          </div>

          {/* Categories Skeleton - Premium Horizontal Scrollable */}
          <div
            className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-4 px-4"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x'
            }}
          >
            {/* All button skeleton */}
            <div
              className={`flex-shrink-0 h-10 w-16 rounded-2xl animate-stagger-fade shadow-lg ${getSkeletonClassName()}`}
              style={{ animationDelay: '0ms' }}
            />
            {/* Category buttons skeleton */}
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className={`flex-shrink-0 h-10 w-28 rounded-2xl animate-stagger-fade shadow-lg ${getSkeletonClassName()}`}
                style={{ animationDelay: `${(index + 1) * 50}ms` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-[200px]"></div>

      {/* Menu Items Skeleton - Premium Grid */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 justify-items-center">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className={`relative w-full max-w-[400px] mb-3 animate-card-entrance`}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className={getCardClassName()}>
                <div className="p-0">
                  {/* Image placeholder */}
                  <div className="relative h-[140px] overflow-hidden rounded-t-3xl">
                    <div className={`w-full h-full ${getSkeletonClassName()}`} />

                    {/* Heart button skeleton */}
                    <div className={`absolute top-3 right-3 w-9 h-9 rounded-full ${resolvedTheme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-200/80'
                      }`} />
                  </div>

                  {/* Content Section */}
                  <div className="px-4 pt-3.5 pb-3">
                    {/* Name and rating row */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className={`h-5 w-32 rounded-lg ${getSkeletonClassName()}`} />
                      <div className="flex items-center gap-1.5">
                        <div className={`w-5 h-5 rounded-md ${getSkeletonClassName()}`} />
                        <div className={`h-4 w-10 rounded ${getSkeletonClassName()}`} />
                      </div>
                    </div>

                    {/* Divider */}
                    <div className={`h-px my-2.5 ${resolvedTheme === 'dark' ? 'bg-gray-700/40' : 'bg-gray-200/60'
                      }`} />

                    {/* Info row */}
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-lg ${getSkeletonClassName()}`} />
                      <div className={`h-3 w-16 rounded ${getSkeletonClassName()}`} />
                    </div>
                  </div>

                  {/* Add button skeleton */}
                  <div
                    className={`absolute bottom-0 right-0 w-11 h-11 ${resolvedTheme === 'dark'
                      ? 'bg-primary/30'
                      : 'bg-primary/20'
                      }`}
                    style={{
                      borderTopLeftRadius: '50%',
                      borderBottomRightRadius: '24px'
                    }}
                  />
                </div>
              </div>

              {/* Time pill skeleton */}
              <div className="absolute bottom-[90px] right-[-0px] z-20">
                <div
                  className={`rounded-l-full w-36 h-4 ${resolvedTheme === 'dark'
                    ? 'bg-[#251F35] border border-white/5'
                    : 'bg-white border border-gray-100'
                    }`}
                >
                  <div className={`w-full h-full rounded-l-full ${getSkeletonClassName()}`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="pb-[calc(6rem+env(safe-area-inset-bottom))]"></div>
    </div>
  );
}
