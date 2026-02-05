import React, { useState, useEffect, useMemo } from 'react';
import { useCanteenContext } from '@/contexts/CanteenContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthSync } from '@/hooks/useDataSync';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Search, ArrowRight, Store, ChevronRight, ChevronDown, ShoppingCart, UserCircle2, Filter } from 'lucide-react';
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
            <div className="px-4 flex items-center justify-between">
                <h1 className="text-2xl font-bold">Available Canteens</h1>
                <Filter className="mx-4">
                    <button className="text-primary px-4 py-2 rounded-2xl">Filter</button>
                </Filter>
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
                    <div className="grid grid-cols-1 gap-4">
                        {filteredCanteens.map((canteen) => (
                            <div
                                key={canteen.id}
                                onClick={() => handleCanteenClick(canteen)}
                                className={`group relative overflow-hidden rounded-3xl cursor-pointer transition-all duration-300 hover:shadow-2xl active:scale-[0.98] ${resolvedTheme === 'dark'
                                    ? 'bg-gradient-to-b from-gray-800/90 to-gray-900/90 border border-white/5'
                                    : 'bg-white border border-gray-100 shadow-md'
                                    }`}
                            >
                                {/* Top: Large Image */}
                                <div className="relative w-full h-40 overflow-hidden rounded-b-3xl">
                                    {canteen.imageUrl ? (
                                        <img
                                            src={canteen.imageUrl}
                                            alt={canteen.name}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            loading="lazy"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                            }}
                                        />
                                    ) : null}

                                    {/* Fallback Icon */}
                                    <div className={`${canteen.imageUrl ? 'hidden' : 'flex'} w-full h-full items-center justify-center ${resolvedTheme === 'dark' ? 'bg-purple-900/40' : 'bg-purple-100'}`}>
                                        <Store className={`w-20 h-20 ${resolvedTheme === 'dark' ? 'text-purple-400' : 'text-purple-500'} opacity-60`} />
                                    </div>

                                    {/* Free Delivery Badge - Top Left */}
                                    <div className="absolute top-3 left-3">
                                        <div className="bg-primary text-white px-3 py-1.5 rounded-full shadow-lg">
                                            {canteen.trendingItems && canteen.trendingItems?.length > 0 ? (
                                                canteen.trendingItems?.slice(0, 1).map((item, index) => <span key={index} className="text-xs font-bold">{item.name} at ₹{item.price}</span>)
                                            ) : (
                                                <span className="text-xs font-bold">New</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bookmark Icon - Top Right */}
                                    <div className="absolute top-3 right-3">
                                        <div className={`p-2.5 rounded-full ${resolvedTheme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
                                            <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom: Content */}
                                <div className="p-4">
                                    {/* Canteen Name */}
                                    <h3 className={`font-bold text-lg mb-3 truncate ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                        {canteen.name}
                                    </h3>

                                    {/* Rating and Delivery Time */}
                                    <div className="flex items-center justify-between gap-4 mb-3">





                                        {/* Category Tags */}
                                        <div className="flex items-center gap-2 text-sm">
                                            {canteen.categories && canteen.categories?.length > 0 ? (
                                                canteen.categories?.slice(0, 3).map((category: string, idx: number) => (
                                                    <React.Fragment key={idx}>
                                                        <span className={`truncate max-w-24 ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                                            {category}
                                                        </span>
                                                        {idx < Math.min(canteen.categories?.length || 0, 3) - 1 && (
                                                            <span className={`${resolvedTheme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>•</span>
                                                        )}
                                                    </React.Fragment>
                                                ))
                                            ) : (
                                                <>
                                                    <span className={`${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Burger</span>
                                                    <span className={`${resolvedTheme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>•</span>
                                                    <span className={`${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Pizza</span>
                                                    <span className={`${resolvedTheme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>•</span>
                                                    <span className={`${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Fast Food</span>
                                                </>
                                            )}
                                        </div>
                                        {/* Star Rating */}
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-yellow-400 text-lg">★</span>
                                            <span className={`text-sm font-bold ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>4.9</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Enhanced Hover Effects */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                                {/* Subtle Border Glow on Hover */}
                                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                    style={{
                                        boxShadow: resolvedTheme === 'dark'
                                            ? '0 0 30px rgba(var(--primary-rgb, 139, 92, 246), 0.3)'
                                            : '0 0 30px rgba(var(--primary-rgb, 139, 92, 246), 0.2)'
                                    }}
                                />
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
