import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";

interface MediaBanner {
  id: string;
  name: string;
  type: 'image' | 'video';
  cloudinaryUrl?: string;
  fileId?: string;
  originalName: string;
  mimeType?: string;
}

interface HomeMediaBannerProps {
  banners: MediaBanner[];
  isLoading?: boolean;
}

export default function HomeMediaBanner({ banners, isLoading }: HomeMediaBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState<Record<string, boolean>>({});
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  // Filter out banners with invalid data
  const validBanners = banners.filter(banner => 
    banner.id && 
    (banner.cloudinaryUrl || banner.fileId) && 
    banner.originalName
  );

  // Check if there's only one banner for static behavior
  const isSingleBanner = validBanners.length === 1;

  // Handle image loading
  const handleImageLoad = (bannerId: string) => {
    setImagesLoaded(prev => ({ ...prev, [bannerId]: true }));
  };

  const handleImageError = (bannerId: string) => {
    setImagesLoaded(prev => ({ ...prev, [bannerId]: false }));
  };

  // Handle transition end
  const handleTransitionEnd = () => {
    if (!isTransitioning) return;
    setIsTransitioning(false);
  };

  // Touch/mouse event handlers for swipe gestures
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (isTransitioning || isSingleBanner || isDragging) return;
    
    // Stop event propagation to prevent page scrolling
    e.stopPropagation();
    e.preventDefault();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setStartX(clientX);
    setIsDragging(true);
    setDragOffset(0);
    
    // Clear auto-slide when user starts interacting
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging || isSingleBanner) return;
    
    // Stop event propagation to prevent page scrolling
    e.stopPropagation();
    e.preventDefault();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const containerWidth = containerRef.current?.getBoundingClientRect().width || 320;
    const maxDrag = containerWidth * 0.4;
    
    // Calculate difference from start position
    const diff = clientX - startX;
    const limitedDiff = Math.max(-maxDrag, Math.min(maxDrag, diff));
    
    setDragOffset(limitedDiff);
  };

  const handleTouchEnd = (e?: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging || isSingleBanner) return;
    
    // Stop event propagation
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    const threshold = 40;
    const shouldSwipe = Math.abs(dragOffset) > threshold;
    
    if (shouldSwipe) {
      if (dragOffset > 0) {
        moveToPrev();
      } else {
        moveToNext();
      }
    }
    
    setIsDragging(false);
    setDragOffset(0);
    setStartX(0);
  };

  // Navigation functions
  const moveToNext = useCallback(() => {
    if (isTransitioning || isDragging) return;
    const nextIndex = (currentIndex + 1) % validBanners.length;
    setIsTransitioning(true);
    setCurrentIndex(nextIndex);
  }, [isTransitioning, isDragging, currentIndex, validBanners.length]);
  
  const moveToPrev = useCallback(() => {
    if (isTransitioning || isDragging) return;
    const prevIndex = currentIndex === 0 ? validBanners.length - 1 : currentIndex - 1;
    setIsTransitioning(true);
    setCurrentIndex(prevIndex);
  }, [isTransitioning, isDragging, currentIndex, validBanners.length]);

  // Auto-slide
  useEffect(() => {
    if (validBanners.length <= 1 || isDragging) return;

    intervalRef.current = setInterval(() => {
      if (!isTransitioning && !isDragging) {
        moveToNext();
      }
    }, 6000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [validBanners.length, isTransitioning, isDragging, moveToNext]);

  // Reset when banners change
  useEffect(() => {
    setCurrentIndex(0);
    setIsTransitioning(false);
    setImagesLoaded({});
    setDragOffset(0);
    setIsDragging(false);
    setStartX(0);
  }, [validBanners.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full py-6">
        <div className="relative w-full h-64 overflow-hidden">
          <div className={`flex items-center justify-center h-full rounded-2xl ${
            resolvedTheme === 'dark' ? 'bg-transparent' : 'bg-gray-100'
          }`}>
            <div className="w-10 h-10 border-3 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  // Get responsive container width with fallback (memoized for performance)
  const containerWidth = useMemo(() => {
    if (containerRef.current) {
      return containerRef.current.getBoundingClientRect().width;
    }
    if (typeof window !== 'undefined') {
      return Math.min(window.innerWidth - 32, 400);
    }
    return 320; // Default fallback
  }, [validBanners.length]); // Recalculate when banners change

  // Don't render if no banners or if banners have invalid data
  if (banners.length === 0 || validBanners.length === 0) {
    return null;
  }

  return (
    <div className="w-full" data-testid="home-media-banner-container">
      <div className="relative w-full aspect-[2/1] overflow-hidden">
        <div 
          ref={containerRef}
          className={`relative w-full h-full transition-all duration-300 ${isSingleBanner ? '' : 'cursor-grab active:cursor-grabbing hover:scale-[1.02]'}`}
          style={{ touchAction: isSingleBanner ? 'auto' : 'pan-x' }}
          onTouchStart={isSingleBanner ? undefined : handleTouchStart}
          onTouchMove={isSingleBanner ? undefined : handleTouchMove}
          onTouchEnd={isSingleBanner ? undefined : handleTouchEnd}
          onMouseDown={isSingleBanner ? undefined : handleTouchStart}
          onMouseMove={isSingleBanner ? undefined : handleTouchMove}
          onMouseUp={isSingleBanner ? undefined : handleTouchEnd}
          onMouseLeave={isSingleBanner ? undefined : handleTouchEnd}
        >
          <div 
            className="flex h-full"
            style={{
              transform: isSingleBanner 
                ? 'translate3d(0px, 0, 0)' 
                : `translate3d(-${currentIndex * containerWidth}px, 0, 0)${
                    isDragging ? ` translateX(${dragOffset}px)` : ''
                  }`,
              transition: isDragging || isSingleBanner ? 'none' : 'transform 1000ms cubic-bezier(0.19, 1, 0.22, 1)',
              width: isSingleBanner ? '100%' : `${validBanners.length * containerWidth}px`
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {validBanners.map((banner, index) => (
              <div
                key={banner.id}
                className="h-full flex-shrink-0 flex items-center justify-center"
                style={{ width: isSingleBanner ? '100%' : `${containerWidth}px` }}
              >
                <div className="overflow-hidden shadow-lg w-full h-full transition-opacity duration-300 ease-in-out">
                  {banner.type === 'video' ? (
                    <video
                      className="w-full h-full object-cover transition-opacity duration-500 ease-in-out"
                      style={{
                        opacity: imagesLoaded[banner.id] ? 1 : 0
                      }}
                      autoPlay
                      muted
                      loop
                      playsInline
                      onLoadedData={() => handleImageLoad(banner.id)}
                      onError={() => handleImageError(banner.id)}
                    >
                      <source 
                        src={banner.cloudinaryUrl || (banner.fileId ? `/api/media-banners/${banner.fileId}/file` : '')}
                        type={banner.mimeType}
                      />
                    </video>
                  ) : (
                    <img
                      src={banner.cloudinaryUrl || (banner.fileId ? `/api/media-banners/${banner.fileId}/file` : '')}
                      alt={banner.originalName}
                      className="w-full h-full object-cover transition-opacity duration-500 ease-in-out"
                      style={{
                        opacity: imagesLoaded[banner.id] ? 1 : 0
                      }}
                      onLoad={() => handleImageLoad(banner.id)}
                      onError={() => handleImageError(banner.id)}
                    />
                  )}
                  
                  {/* Error State */}
                  {imagesLoaded[banner.id] === false && (
                    <div className={`absolute inset-0 flex items-center justify-center ${
                      resolvedTheme === 'dark' 
                        ? 'bg-gray-800/80 text-gray-300' 
                        : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600'
                    }`}>
                      <div className="text-center">
                        <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center ${
                          resolvedTheme === 'dark' ? 'bg-card' : 'bg-gray-300'
                        }`}>
                          <svg className={`w-6 h-6 fill="none" stroke="currentColor" viewBox="0 0 24 24" ${
                            resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
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
            ))}
          </div>
          
          {/* Indicators */}
          {validBanners.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
              {validBanners.map((_, index) => {
                const isActive = index === currentIndex;
                return (
                  <button
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all duration-500 ease-out ${
                      isActive
                        ? 'bg-white scale-125 shadow-lg' 
                        : 'bg-white/60 hover:bg-white/80'
                    }`}
                    onClick={() => {
                      if (!isTransitioning && !isDragging) {
                        setIsTransitioning(true);
                        setCurrentIndex(index);
                      }
                    }}
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
