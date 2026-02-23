import { useState, useMemo, useEffect, useCallback } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";

interface MediaBanner {
  id: string;
  name: string;
  type: 'image' | 'video';
  cloudinaryUrl?: string;
  fileId?: string;
  originalName: string;
  mimeType?: string;
  displayMode?: 'fit' | 'fill';
}

interface HomeMediaBannerProps {
  banners: MediaBanner[];
  isLoading?: boolean;
}

export default function HomeMediaBanner({ banners, isLoading }: HomeMediaBannerProps) {
  const [imagesLoaded, setImagesLoaded] = useState<Record<string, boolean>>({});
  const [api, setApi] = useState<CarouselApi>();
  const { resolvedTheme } = useTheme();

  // Auto-slide every 3 seconds when there are multiple banners
  useEffect(() => {
    if (!api || banners.length <= 1) return;

    const interval = setInterval(() => {
      api.scrollNext();
    }, 3000);

    return () => clearInterval(interval);
  }, [api, banners.length]);

  // Filter out banners with invalid data
  const validBanners = useMemo(() =>
    banners.filter(banner =>
      banner.id &&
      (banner.cloudinaryUrl || banner.fileId) &&
      banner.originalName
    ), [banners]
  );

  // Handle image loading
  const handleImageLoad = (bannerId: string) => {
    setImagesLoaded(prev => ({ ...prev, [bannerId]: true }));
  };

  const handleImageError = (bannerId: string) => {
    setImagesLoaded(prev => ({ ...prev, [bannerId]: false }));
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full px-4">
        <div className="relative w-full h-48 overflow-hidden rounded-2xl">
          <div className={`flex items-center justify-center h-full ${resolvedTheme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100'
            }`}>
            <div className="w-10 h-10 border-3 border-gray-300 border-t-[#724491] rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  // Don't render if no banners or if banners have invalid data
  if (banners.length === 0 || validBanners.length === 0) {
    return null;
  }

  return (
    <div className="w-full px-4" data-testid="home-media-banner-container">
      <Carousel
        opts={{
          align: "center",
          loop: true,
          dragFree: false,
        }}
        setApi={setApi}
        className="w-full"
      >
        <CarouselContent className="-ml-4">
          {validBanners.map((banner) => (
            <CarouselItem key={banner.id} className="pl-4 basis-full">
              <div className={`overflow-hidden rounded-3xl transition-all duration-300 ${resolvedTheme === 'dark'
                ? 'shadow-[0_8px_30px_rgba(0,0,0,0.4)] ring-1 ring-white/5'
                : 'shadow-[0_8px_30px_rgba(0,0,0,0.1)] ring-1 ring-black/5'
                }`}>
                <div
                  className="relative"
                  style={{
                    aspectRatio: '16/9',
                  }}
                >
                  {/* Premium gradient overlay for depth */}
                  <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-t from-black/40 via-black/10 to-transparent rounded-3xl" />
                  <div className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-r from-black/10 via-transparent to-black/10 rounded-3xl" />

                  {banner.type === 'video' ? (
                    <video
                      className={`w-full h-full transition-all duration-700 ${banner.displayMode === 'fit' ? 'object-contain' : 'object-cover'
                        }`}
                      style={{
                        opacity: imagesLoaded[banner.id] ? 1 : 0,
                        transform: imagesLoaded[banner.id] ? 'scale(1)' : 'scale(1.05)',
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
                      className={`w-full h-full transition-all duration-700 ${banner.displayMode === 'fit' ? 'object-contain' : 'object-cover'
                        }`}
                      style={{
                        opacity: imagesLoaded[banner.id] ? 1 : 0,
                        transform: imagesLoaded[banner.id] ? 'scale(1)' : 'scale(1.05)',
                      }}
                      onLoad={() => handleImageLoad(banner.id)}
                      onError={() => handleImageError(banner.id)}
                    />
                  )}

                  {/* Premium loading placeholder with shimmer */}
                  {!imagesLoaded[banner.id] && imagesLoaded[banner.id] !== false && (
                    <div className={`absolute inset-0 flex items-center justify-center ${resolvedTheme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100/50'
                      }`}>
                      <div className="relative">
                        <div className="w-10 h-10 border-3 border-transparent border-t-primary rounded-full animate-spin"></div>
                        <div className="absolute inset-0 w-10 h-10 border-3 border-transparent border-b-primary/30 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                      </div>
                    </div>
                  )}

                  {/* Error State - Premium design */}
                  {imagesLoaded[banner.id] === false && (
                    <div className={`absolute inset-0 flex items-center justify-center ${resolvedTheme === 'dark' ? 'bg-gray-900/90' : 'bg-gray-50/90'
                      }`}>
                      <div className="text-center">
                        <div className={`w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center ${resolvedTheme === 'dark' ? 'bg-gray-800/80' : 'bg-gray-200/80'
                          }`}>
                          <svg className="w-7 h-7 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Content unavailable</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
}
