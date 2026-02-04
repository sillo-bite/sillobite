import React, { useState, useEffect, useMemo } from 'react';
import { useCanteenContext } from '@/contexts/CanteenContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthSync } from '@/hooks/useDataSync';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Search, ArrowRight, Store, ChevronRight, ChevronDown, ShoppingCart, UserCircle2 } from 'lucide-react';
import { LoadingIndicator, EmptyState } from '@/components/canteen/CanteenSkeletonLoader';
import LocationSelector from "@/components/profile/LocationSelector";
import HomeMediaBanner from "./HomeMediaBanner";
import { useQuery } from '@tanstack/react-query';
import { useLocation } from '@/contexts/LocationContext';
import { useCart } from '@/contexts/CartContext';

interface CanteenSelectorPageProps {
    onCanteenSelect: (canteenId?: string) => void;
}

export default function CanteenSelectorPage({ onCanteenSelect }: CanteenSelectorPageProps) {
    const {
        availableCanteens,
        setSelectedCanteen,
        isLoading,
        userCollege,
        isFiltered,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
        totalCanteens
    } = useCanteenContext();
    const { resolvedTheme } = useTheme();
    const { user } = useAuthSync();
    const { selectedLocationName } = useLocation();
    const { getTotalItems } = useCart();
    const [searchQuery, setSearchQuery] = useState('');
    const [showLocationSelector, setShowLocationSelector] = useState(false);

    // Fetch Global/Promotional Banners
    const { data: activeBanners, isLoading: isBannersLoading } = useQuery({
        queryKey: ['/api/media-banners'],
        queryFn: async () => {
            const res = await fetch('/api/media-banners');
            if (!res.ok) throw new Error('Failed to fetch banners');
            return res.json();
        },
        staleTime: 1000 * 60 * 5, // 5 minutes cache
        refetchOnWindowFocus: false,
    });

    // Filter and sort canteens based on search query
    const filteredCanteens = useMemo(() => {
        const filtered = availableCanteens.filter(canteen =>
            canteen.isActive && canteen.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        // Sort by priority (lower number = higher priority), then by name
        return filtered.sort((a, b) => {
            const priorityA = a.priority ?? 0;
            const priorityB = b.priority ?? 0;
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            return (a.name || '').localeCompare(b.name || '');
        });
    }, [availableCanteens, searchQuery]);

    const handleCanteenClick = (canteen: any) => {
        setSelectedCanteen(canteen);
        onCanteenSelect(canteen.id);
    };

    // Infinite scroll implementation
    useEffect(() => {
        const handleScroll = () => {
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && hasNextPage && !isFetchingNextPage && !searchQuery) {
                fetchNextPage();
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [hasNextPage, isFetchingNextPage, searchQuery, fetchNextPage]);

    // Handle location context display
    const getLocationDisplay = () => {
        // First priority: LocationContext selectedLocationName
        if (selectedLocationName) return selectedLocationName;
        // Fallback to user data
        if (user?.collegeName) return user.collegeName;
        if (user?.organizationName) return user.organizationName;
        return "All Locations";
    };

    return (
        <div className={`min-h-screen ${resolvedTheme === 'dark' ? 'bg-background' : 'bg-gray-50'}`}>
            {/* Header Section */}
            <div className={`sticky top-0 z-10 ${resolvedTheme === 'dark' ? 'bg-background/95' : 'bg-white/95'} backdrop-blur-md pb-4 pt-12 px-6`}>
                <div className="max-w-4xl mx-auto">
                    {/* Header with Navigation */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex-1">
                            {/* Location Selector Button */}
                            <button
                                onClick={() => setShowLocationSelector(true)}
                                className={`group flex items-center w-auto p-1 rounded-2xl transition-all duration-200`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl transition-all duration-200 ${resolvedTheme === 'dark'
                                        ? 'bg-primary/10 text-primary group-hover:bg-primary/20'
                                        : 'bg-primary/10 text-primary group-hover:bg-primary/20'
                                        }`}>
                                        <MapPin className="w-5 h-5" />
                                    </div>
                                    <div className="text-left flex-1 min-w-0">
                                        <div className="text-xs text-muted-foreground mb-0.5">Current Location</div>
                                        <div className="text-lg font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent truncate max-w-[200px]">
                                            {getLocationDisplay()}
                                        </div>
                                    </div>
                                </div>
                                <ChevronDown className={`w-5 h-5 ml-2 transition-transform duration-200 group-hover:translate-y-0.5 ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                    }`} />
                            </button>
                        </div>

                        {/* Profile Navigation */}
                        <div className="flex items-center mx-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    window.dispatchEvent(new CustomEvent('appNavigateToProfile', {}));
                                }}
                                className="rounded-full h-14 w-14 p-0 relative overflow-hidden group shadow-premium hover-scale-subtle"
                                aria-label="View Profile"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent group-hover:from-primary/30 group-hover:via-primary/20 transition-all duration-300"></div>
                                <UserCircle2 className="w-9 h-9 relative z-10 text-primary" />
                            </Button>
                        </div>
                    </div>


                    <div className="relative">
                        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            placeholder="Search available canteens..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-full rounded-2xl py-3.5 pl-12 pr-4 text-sm transition-all duration-200 outline-none ${resolvedTheme === 'dark'
                                ? 'bg-secondary/50 border border-white/10 focus:border-primary/50 text-white placeholder:text-gray-500'
                                : 'bg-white border border-gray-200 focus:border-primary/50 text-gray-900 placeholder:text-gray-400 shadow-sm'
                                }`}
                        />
                    </div>
                </div>
            </div>
            {/* Global Promo Banners */}
            <div className="mb-4 mt-4">
                <HomeMediaBanner banners={activeBanners || []} isLoading={isBannersLoading} />
            </div>
            {/* Content Section */}
            <div className="px-4 py-6 max-w-4xl mx-auto pb-24">

                {(() => {
                    if (process.env.NODE_ENV === 'development') {
                        console.log('DEBUG: CanteenSelectorPage User:', user);
                        console.log('DEBUG: selectedLocationId:', user?.selectedLocationId);
                        console.log('DEBUG: Condition !user?.selectedLocationId:', !user?.selectedLocationId);
                    }
                    return null;
                })()}
                {(() => {
                    if (process.env.NODE_ENV === 'development') {
                        console.log('DEBUG: CanteenSelectorPage User:', user);
                        console.log('DEBUG: selectedLocationId:', user?.selectedLocationId);
                        console.log('DEBUG: availableCanteens:', availableCanteens.length, availableCanteens);
                        console.log('DEBUG: filteredCanteens:', filteredCanteens.length, filteredCanteens);
                        console.log('DEBUG: isLoading:', isLoading);
                    }
                    return null;
                })()}
                {/* STRICT MODE: Show Location Selector if no location is selected */}
                {!user?.selectedLocationId ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className={`p-6 rounded-2xl mb-6 text-center ${resolvedTheme === 'dark' ? 'bg-secondary/30' : 'bg-blue-50'}`}>
                            <MapPin className={`w-12 h-12 mx-auto mb-3 ${resolvedTheme === 'dark' ? 'text-primary' : 'text-blue-500'}`} />
                            <h2 className="text-xl font-bold mb-2">Select Location</h2>
                            <p className="text-muted-foreground text-sm">
                                Please select your college or organization to see available canteens.
                            </p>
                        </div>
                        <LocationSelector onClose={() => setShowLocationSelector(false)} />
                    </div>
                ) : isLoading && filteredCanteens.length === 0 ? (
                    <div className="space-y-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className={`h-24 rounded-2xl animate-pulse ${resolvedTheme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}></div>
                        ))}
                    </div>
                ) : filteredCanteens.length > 0 ? (
                    <div className="space-y-4">
                        {filteredCanteens.map((canteen) => (
                            <div
                                key={canteen.id}
                                onClick={() => handleCanteenClick(canteen)}
                                className={`group relative overflow-hidden rounded-3xl cursor-pointer transition-all duration-300 border hover:shadow-xl active:scale-[0.98] ${resolvedTheme === 'dark'
                                    ? 'bg-card border-white/5 hover:border-primary/30'
                                    : 'bg-white border-gray-100 hover:border-primary/30 shadow-sm'
                                    }`}
                            >
                                <div className="flex items-stretch">
                                    {/* Left: Large Image */}
                                    <div className="relative w-40 h-40 flex-shrink-0">
                                        {canteen.imageUrl ? (
                                            <img
                                                src={canteen.imageUrl}
                                                alt={canteen.name}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                }}
                                            />
                                        ) : null}

                                        {/* Fallback Icon */}
                                        <div className={`${canteen.imageUrl ? 'hidden' : 'flex'} w-full h-full items-center justify-center ${resolvedTheme === 'dark' ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'}`}>
                                            <Store className="w-16 h-16 opacity-75" />
                                        </div>

                                        {/* Promotional Badge Overlay (if applicable) */}
                                        {canteen.hasPromotion && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                                                <div className="text-white">
                                                    <div className="text-[10px] font-medium uppercase tracking-wide opacity-90">Special Offer</div>
                                                    <div className="text-sm font-bold">10% OFF</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: Details */}
                                    <div className="flex-1 p-4 flex flex-col justify-center min-w-0">
                                        {/* Canteen Name */}
                                        <h3 className={`font-bold text-lg mb-1 truncate ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                            {canteen.name}
                                        </h3>

                                        {/* Rating (if available) */}
                                        {canteen.rating && (
                                            <div className="flex items-center gap-1 mb-2">
                                                <div className="flex items-center gap-1 bg-green-600 text-white px-2 py-0.5 rounded-md text-xs font-semibold">
                                                    <span>★</span>
                                                    <span>{canteen.rating}</span>
                                                </div>
                                                {canteen.reviewCount && (
                                                    <span className="text-xs text-muted-foreground">({canteen.reviewCount})</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Categories/Tags */}
                                        {canteen.categories && canteen.categories.length > 0 && (
                                            <p className="text-sm text-muted-foreground mb-2 truncate">
                                                {canteen.categories.join(', ')}
                                            </p>
                                        )}

                                        {/* Trending Menu Items Preview */}
                                        {canteen.trendingItems && canteen.trendingItems.length > 0 && (
                                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                                {canteen.trendingItems.slice(0, 4).join(' • ')}
                                            </p>
                                        )}

                                        {/* Location */}
                                        {canteen.location && (
                                            <p className={`text-sm flex items-center ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                                <MapPin className="w-3.5 h-3.5 mr-1.5 opacity-70 flex-shrink-0" />
                                                <span className="truncate">{canteen.location}</span>
                                                {canteen.distance && (
                                                    <span className="ml-1">• {canteen.distance}</span>
                                                )}
                                            </p>
                                        )}
                                    </div>

                                    {/* Arrow Icon */}
                                    <div className="flex items-center pr-4">
                                        <ChevronRight className={`w-5 h-5 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300 ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`} />
                                    </div>
                                </div>

                                {/* Hover gradient effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                            </div>
                        ))}

                        {isFetchingNextPage && (
                            <div className="py-4 text-center">
                                <LoadingIndicator
                                    theme={resolvedTheme}
                                    isFetching={true}
                                    hasNextPage={true}
                                    totalLoaded={availableCanteens.length}
                                    totalAvailable={totalCanteens}
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="mt-12 text-center">
                        <EmptyState
                            theme={resolvedTheme}
                            searchQuery={searchQuery}
                            isFiltered={isFiltered}
                            userCollege={userCollege}
                        />
                        <Button
                            variant="outline"
                            className="mt-6 rounded-full"
                            onClick={() => window.location.reload()}
                        >
                            Refresh Page
                        </Button>
                        <div className="mt-8 pt-8 border-t border-dashed border-gray-200 dark:border-gray-800">
                            <p className="text-sm text-muted-foreground mb-4">Wrong location?</p>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    // Manually clear location to show selector again
                                    localStorage.removeItem('selectedLocation');
                                    window.location.reload();
                                }}
                            >
                                Change Location
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Location Selector Modal */}
            {showLocationSelector && (
                <LocationSelector
                    isOpen={showLocationSelector}
                    onClose={() => setShowLocationSelector(false)}
                />
            )}
        </div >
    );
}
