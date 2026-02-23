import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTriggerBasedUpdates } from "@/hooks/useTriggerBasedUpdates";
import { useTheme } from "@/contexts/ThemeContext";
import type { MediaBanner as MediaBannerType } from "@shared/schema";

// Cache configuration
const CACHE_CONFIG = {
  BANNER_CACHE_KEY: 'media_banners_cache',
  CACHE_DURATION: 1000 * 60 * 30, // 30 minutes
  IMAGE_CACHE_DURATION: 1000 * 60 * 60 * 24, // 24 hours
  STALE_TIME: 1000 * 60 * 15, // 15 minutes
};

// Cache utilities
const CacheUtils = {
  // Get cached banner data
  getCachedBanners: (): { data: MediaBannerType[], timestamp: number } | null => {
    try {
      const cached = localStorage.getItem(CACHE_CONFIG.BANNER_CACHE_KEY);
      if (!cached) return null;

      const parsedCache = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is still valid
      if (now - parsedCache.timestamp > CACHE_CONFIG.CACHE_DURATION) {
        localStorage.removeItem(CACHE_CONFIG.BANNER_CACHE_KEY);
        return null;
      }

      return parsedCache;
    } catch (error) {
      console.warn('Failed to get cached banners:', error);
      return null;
    }
  },

  // Cache banner data
  cacheBanners: (banners: MediaBannerType[]) => {
    try {
      const cacheData = {
        data: banners,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_CONFIG.BANNER_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache banners:', error);
    }
  },

  // Preload images
  preloadImages: (banners: MediaBannerType[]) => {
    banners.forEach((banner) => {
      if (banner.type !== 'video') {
        const img = new Image();
        img.src = banner.cloudinaryUrl || `/api/media-banners/${banner.fileId}/file`;
        // Store in memory for immediate access
        img.onload = () => {
          console.log(`Preloaded banner image: ${banner.id}`);
        };
      }
    });
  },

  // Clear expired cache
  clearExpiredCache: () => {
    const cached = CacheUtils.getCachedBanners();
    if (!cached) {
      localStorage.removeItem(CACHE_CONFIG.BANNER_CACHE_KEY);
    }
  }
};

export default function MediaBanner() {
  const [currentIndex, setCurrentIndex] = useState(0); // Start at 0 (first image in cyclic queue)
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState<Record<string, boolean>>({});
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragVelocity, setDragVelocity] = useState(0);
  const [lastDragTime, setLastDragTime] = useState(0);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [slideWidth, setSlideWidth] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const slidesRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();

  // Clear expired cache on component mount
  useEffect(() => {
    CacheUtils.clearExpiredCache();
  }, []);

  // Enhanced fetch with caching
  const { data, isLoading } = useQuery<MediaBannerType[]>({
    queryKey: ['/api/media-banners'],
    queryFn: async () => {
      // First, try to get from cache
      const cachedData = CacheUtils.getCachedBanners();
      if (cachedData) {
        console.log('Using cached banner data');
        setIsUsingCache(true);
        // Preload images for cached data
        CacheUtils.preloadImages(cachedData.data);
        return cachedData.data;
      }

      // If no cache, fetch from server
      console.log('Fetching fresh banner data from server');
      setIsUsingCache(false);

      const response = await fetch('/api/media-banners', {
        headers: {
          'Cache-Control': 'max-age=1800', // 30 minutes browser cache
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch media banners');
      }

      const data = await response.json();

      // Cache the fresh data
      CacheUtils.cacheBanners(data);

      // Preload images
      CacheUtils.preloadImages(data);

      return data;
    },
    staleTime: CACHE_CONFIG.STALE_TIME, // 15 minutes
    gcTime: CACHE_CONFIG.CACHE_DURATION, // 30 minutes (React Query v5)
    refetchOnMount: false, // Don't refetch on mount, use cache
    refetchOnWindowFocus: false, // Don't refetch on focus
    refetchInterval: false, // No polling - use WebSocket for real-time updates
  });

  // Ensure type safety for banners array
  const banners: MediaBannerType[] = data || [];

  // Check if there's only one banner for static behavior
  const isSingleBanner = banners.length === 1;

  // Trigger-based updates instead of SSE
  const { triggerBannerRefresh } = useTriggerBasedUpdates();

  // Handle image loading
  const handleImageLoad = (bannerId: string, index: number) => {
    console.log(`MediaBanner: Image ${index + 1} loaded successfully:`, bannerId);
    setImagesLoaded(prev => ({ ...prev, [bannerId]: true }));
  };

  const handleImageError = (bannerId: string, index: number) => {
    console.error(`MediaBanner: Image ${index + 1} failed to load:`, bannerId);
    setImagesLoaded(prev => ({ ...prev, [bannerId]: false }));
  };

  // Touch/mouse event handlers for swipe gestures
  // Calculate slide width when images load
  const updateSlideWidth = () => {
    if (containerRef.current) {
      const width = containerRef.current.getBoundingClientRect().width;
      console.log('updateSlideWidth called, container width:', width);
      setSlideWidth(width);
    } else {
      console.log('updateSlideWidth called but containerRef is null');
    }
  };

  // Handle transition end for cyclic queue
  const handleTransitionEnd = () => {
    console.log('Cyclic queue: Transition ended at index:', currentIndex);

    if (!isTransitioning) return;

    // Simple - just reset transitioning state, no jumps needed in cyclic queue
    setIsTransitioning(false);
    console.log('Cyclic queue: Ready for next transition');
  };



  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (isTransitioning || isSingleBanner || isDragging) return; // Prevent multiple simultaneous drags

    e.preventDefault(); // Prevent default touch behavior
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startXRef.current = clientX;
    setIsDragging(true);
    setDragOffset(0); // Reset drag offset

    // Clear auto-slide when user starts interacting
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    console.log('Touch start at:', clientX, 'currentIndex:', currentIndex);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging || isSingleBanner) return; // Allow during transition for responsive feel
    e.preventDefault();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const diff = clientX - startXRef.current;
    const currentTime = Date.now();

    // Calculate velocity for momentum
    if (lastDragTime > 0) {
      const timeDiff = currentTime - lastDragTime;
      const velocity = (diff - dragOffset) / timeDiff;
      setDragVelocity(velocity);
    }
    setLastDragTime(currentTime);

    // Limit drag distance to prevent over-scrolling
    const maxDrag = slideWidth * 0.4; // Increased for more natural feel
    const limitedDiff = Math.max(-maxDrag, Math.min(maxDrag, diff));

    setDragOffset(limitedDiff);
  };

  const handleTouchEnd = () => {
    if (!isDragging || isSingleBanner) return; // Disable for single banner

    console.log('Touch end - dragOffset:', dragOffset, 'velocity:', dragVelocity, 'currentIndex:', currentIndex);

    const threshold = 40; // Reduced threshold for more responsive swipes
    const velocityThreshold = 0.3; // Velocity threshold for momentum-based swipes

    // Prevent multiple rapid swipes
    if (isTransitioning) {
      console.log('Already transitioning, ignoring touch end');
      setIsDragging(false);
      setDragOffset(0);
      setDragVelocity(0);
      setLastDragTime(0);
      return;
    }

    // Check for momentum-based swipe or distance-based swipe
    const shouldSwipe = Math.abs(dragOffset) > threshold || Math.abs(dragVelocity) > velocityThreshold;

    if (shouldSwipe) {
      console.log('Swipe detected! Direction:', dragOffset > 0 ? 'right (prev)' : 'left (next)');

      // Use cyclic queue logic
      if (dragOffset > 0) {
        // Swipe right - go to previous in cyclic queue
        console.log('Swiping right - going to previous');
        moveToPrev();
      } else {
        // Swipe left - go to next in cyclic queue
        console.log('Swiping left - going to next');
        moveToNext();
      }

      // Reset drag states
      setIsDragging(false);
      setDragOffset(0);
      setDragVelocity(0);
      setLastDragTime(0);
    } else {
      console.log('Swipe too short, staying on current slide');
      // Reset states
      setIsDragging(false);
      setDragOffset(0);
      setDragVelocity(0);
      setLastDragTime(0);
    }
  };

  // Cyclic queue functions
  const moveToNext = () => {
    if (isTransitioning || isDragging) return;

    const nextIndex = (currentIndex + 1) % banners.length;
    console.log('Cyclic queue: Moving from', currentIndex, 'to', nextIndex);

    setIsTransitioning(true);
    setCurrentIndex(nextIndex);
  };

  const moveToPrev = () => {
    if (isTransitioning || isDragging) return;

    const prevIndex = currentIndex === 0 ? banners.length - 1 : currentIndex - 1;
    console.log('Cyclic queue: Moving from', currentIndex, 'to', prevIndex);

    setIsTransitioning(true);
    setCurrentIndex(prevIndex);
  };

  // Move to specific slide (used for indicators)
  const moveToSlide = (index: number) => {
    if (isTransitioning || isDragging) return;

    console.log('moveToSlide: Moving to index', index);
    setIsTransitioning(true);
    setCurrentIndex(index);
  };

  // Auto-slide with cyclic queue
  useEffect(() => {
    if (banners.length <= 1 || isDragging) return;

    intervalRef.current = setInterval(() => {
      if (!isTransitioning && !isDragging) {
        console.log('Auto-slide: cyclic queue advancing from', currentIndex);
        moveToNext();
      }
    }, 3000); // Auto-slide every 3 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [banners.length, currentIndex, isTransitioning, isDragging]);

  // Update slide width on resize
  useEffect(() => {
    updateSlideWidth();

    const handleResize = () => updateSlideWidth();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update slide width when images load
  useEffect(() => {
    updateSlideWidth();
  }, [imagesLoaded]);

  // Reset when banners change
  useEffect(() => {
    setCurrentIndex(isSingleBanner ? 0 : 1); // For single banner, start at 0; for multiple, start at 1 (first real image)
    setIsTransitioning(false);
    setImagesLoaded({});
    setDragOffset(0);
    setIsDragging(false);
  }, [banners.length, isSingleBanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Show loading state instead of null
  if (isLoading) {
    return (
      <div className="w-full py-6" data-testid="media-banner-container">
        <div className="relative w-full h-64 overflow-hidden mx-auto max-w-sm">
          <div className={`flex items-center justify-center h-full rounded-2xl ${resolvedTheme === 'dark' ? 'bg-transparent' : 'bg-gray-100'
            }`}>
            <div className="w-10 h-10 border-3 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  // Don't render if no banners
  if (banners.length === 0) {
    return null;
  }

  // Use banners array directly with cyclic queue - no clones needed
  const extendedBanners = banners;
  const totalSlides = banners.length;

  // Use container width as fallback when slideWidth is not calculated yet
  const effectiveSlideWidth = slideWidth || (containerRef.current?.getBoundingClientRect().width || 320);

  // Debug logging
  console.log('Render - slideWidth:', slideWidth, 'effectiveSlideWidth:', effectiveSlideWidth, 'currentIndex:', currentIndex);

  return (
    <div className="w-full" data-testid="media-banner-container">
      {/* Full width carousel */}
      <div className="relative w-full aspect-[2/1] overflow-hidden">
        <div
          ref={containerRef}
          className={`relative w-full h-full transition-all duration-300 ${isSingleBanner ? '' : 'cursor-grab active:cursor-grabbing hover:scale-[1.02]'}`}
          onTouchStart={isSingleBanner ? undefined : handleTouchStart}
          onTouchMove={isSingleBanner ? undefined : handleTouchMove}
          onTouchEnd={isSingleBanner ? undefined : handleTouchEnd}
          onMouseDown={isSingleBanner ? undefined : handleTouchStart}
          onMouseMove={isSingleBanner ? undefined : handleTouchMove}
          onMouseUp={isSingleBanner ? undefined : handleTouchEnd}
          onMouseLeave={isSingleBanner ? undefined : handleTouchEnd}
        >
          {/* Card slides container */}
          <div
            ref={slidesRef}
            className="flex h-full"
            style={{
              transform: isSingleBanner
                ? 'translate3d(0px, 0, 0)'
                : `translate3d(-${currentIndex * effectiveSlideWidth}px, 0, 0)${isDragging ? ` translateX(${dragOffset}px)` : ''
                }`,
              transformOrigin: 'center center',
              transition: isDragging || isSingleBanner ? 'none' : 'transform 1000ms cubic-bezier(0.19, 1, 0.22, 1)', // Ultra-smooth easing
              willChange: isSingleBanner ? 'auto' : 'transform',
              backfaceVisibility: 'hidden',
              perspective: '1000px',
              width: isSingleBanner ? '100%' : `${totalSlides * effectiveSlideWidth}px`
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {extendedBanners.map((banner, index) => {
              // Create unique keys for cloned elements
              let uniqueKey;
              if (index === 0) {
                uniqueKey = `clone-last-${banner.id}`;
              } else if (index === totalSlides - 1) {
                uniqueKey = `clone-first-${banner.id}`;
              } else {
                uniqueKey = `real-${banner.id}`;
              }

              return (
                <div
                  key={uniqueKey}
                  className="h-full flex-shrink-0 flex items-center justify-center"
                  style={{ width: isSingleBanner ? '100%' : `${effectiveSlideWidth}px` }}
                  data-testid={`banner-card-${index}`}
                >
                  {/* Image card with full size */}
                  <div className="overflow-hidden shadow-lg w-full h-full transition-opacity duration-300 ease-in-out">
                    {/* Card Content */}
                    {banner.type === 'video' ? (
                      <video
                        className="w-full h-full object-cover transition-opacity duration-500 ease-in-out"
                        style={{
                          width: '100%',
                          height: '100%',
                          opacity: imagesLoaded[banner.id] ? 1 : 0
                        }}
                        autoPlay
                        muted
                        loop
                        playsInline
                        data-testid={`video-${banner.id}`}
                        onLoadedData={() => {
                          handleImageLoad(banner.id, index);
                          updateSlideWidth();
                        }}
                        onError={() => handleImageError(banner.id, index)}
                      >
                        <source
                          src={banner.cloudinaryUrl || `/api/media-banners/${banner.fileId}/file`}
                          type={banner.mimeType}
                        />
                      </video>
                    ) : (
                      <img
                        src={banner.cloudinaryUrl || `/api/media-banners/${banner.fileId}/file`}
                        alt={banner.originalName}
                        className="w-full h-full object-cover transition-opacity duration-500 ease-in-out"
                        style={{
                          width: '100%',
                          height: '100%',
                          opacity: imagesLoaded[banner.id] ? 1 : 0
                        }}
                        data-testid={`image-${banner.id}`}
                        onLoad={() => {
                          handleImageLoad(banner.id, index);
                          updateSlideWidth();
                        }}
                        onError={() => handleImageError(banner.id, index)}
                      />
                    )}


                    {/* Error State */}
                    {imagesLoaded[banner.id] === false && (
                      <div className={`absolute inset-0 flex items-center justify-center ${resolvedTheme === 'dark'
                          ? 'bg-transparent text-gray-400'
                          : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-500'
                        }`}>
                        <div className="text-center">
                          <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center ${resolvedTheme === 'dark' ? 'bg-card' : 'bg-gray-300'
                            }`}>
                            <svg className={`w-6 h-6 fill="none" stroke="currentColor" viewBox="0 0 24 24" ${resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                              }`}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <span className="text-sm font-medium">Content unavailable</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Card Indicators */}
          {banners.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
              {banners.map((_, index) => {
                // Calculate real current index (subtract 1 for the cloned element at start)
                const isActive = index === currentIndex;

                return (
                  <button
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all duration-500 ease-out ${isActive
                        ? 'bg-white scale-125 shadow-lg'
                        : 'bg-white/60 hover:bg-white/80'
                      }`}
                    onClick={() => {
                      if (!isTransitioning && !isDragging) {
                        moveToSlide(index + 1); // Add 1 for the cloned element at start
                      }
                    }}
                    data-testid={`banner-indicator-${index}`}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}