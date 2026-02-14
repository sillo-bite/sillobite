import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useCanteenContext } from '@/contexts/CanteenContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthSync } from '@/hooks/useDataSync';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Search, ArrowRight, ArrowLeft, Store, ChevronRight, ChevronDown, ShoppingCart, UserCircle2, Filter } from 'lucide-react';
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
        totalCanteens,
        selectedCategory,
        setSelectedCategory
    } = useCanteenContext();
    const { resolvedTheme } = useTheme();
    const { user } = useAuthSync();
    const { selectedLocationName } = useLocation();
    const { getTotalItems } = useCart();
    const [searchQuery, setSearchQuery] = useState('');
    const [showLocationSelector, setShowLocationSelector] = useState(false);
    const [isSearchSticky, setIsSearchSticky] = useState(false);
    const [isCategorySticky, setIsCategorySticky] = useState(false);
    const trg = useRef<HTMLDivElement>(null);
    const trg2 = useRef<HTMLDivElement>(null);
    const trg1 = useRef<HTMLDivElement>(null);
    // Hardcoded categories for filtering
    const categories = [
        'All',
        'Breakfast',
        'Lunch',
        'Dinner',
        'Snacks',
        'Beverages',
        'Desserts',
        'Fast Food',
        'Healthy',
        'Vegetarian',
        'Non-Veg'
    ];

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
    //sticky scroll category section
    useEffect(() => {
        const el = selectedCategory ? trg1.current : trg.current;
        if (!el) return;

        const obs = new IntersectionObserver(([e]) => {
            setIsCategorySticky(!e.isIntersecting);
        }, {
            root: null,
            threshold: 0,
            rootMargin: selectedCategory ? "-70px 0px 0px 0px" : "-78px 0px 0px 0px"
        });

        obs.observe(el);
        return () => obs.disconnect();
    }, [selectedCategory]);

    //sticky scroll search section
    useEffect(() => {
        const obs = new IntersectionObserver(
            ([e]) => {
                setIsSearchSticky(!e.isIntersecting);
            },
            {
                root: null,
                threshold: 0,
                rootMargin: "-13px 0px 0px 0px"
            }
        );
        if (trg2.current) obs.observe(trg2.current);
        return () => obs.disconnect();
    }, []);
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
            <div className={`backdrop-blur-md pt-12 px-6`}>
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
                </div>
            </div>
            <div ref={trg2} className="h-2px" />
            <div
                className={`${resolvedTheme === 'dark' ? 'bg-background' : 'bg-background'}`}
                id="search-bar"
                style={{
                    position: isSearchSticky ? 'fixed' : 'relative',
                    top: isSearchSticky ? 0 : 'auto',
                    left: 0,
                    right: 0,
                    zIndex: isSearchSticky ? 50 : 1,
                    paddingTop: isSearchSticky ? '12px' : '0',
                    marginLeft: isSearchSticky ? 'auto' : '0',
                    marginRight: isSearchSticky ? '0px' : '0',
                    paddingBottom: '16px',
                    // Background only when sticky
                    // background: isSearchSticky
                    //     ? (resolvedTheme === 'dark'
                    //         ? 'hsla(0, 41%, 7%, 0.95)'
                    //         : 'rgba(255, 255, 255, 0.98)')
                    //     : 'transparent',
                    backdropFilter: isSearchSticky ? 'blur(20px) saturate(180%)' : 'none',
                    WebkitBackdropFilter: isSearchSticky ? 'blur(20px) saturate(180%)' : 'none',
                    // borderBottom: isSearchSticky
                    //     ? (resolvedTheme === 'dark'
                    //         ? '1px solid rgba(255, 255, 255, 0.08)'
                    //         : '1px solid rgba(0, 0, 0, 0.06)')
                    //     : 'none',
                    boxShadow: isSearchSticky && !isCategorySticky
                        ? '0 4px 20px rgba(0, 0, 0, 0.08)'
                        : 'none',
                    transition: isSearchSticky && isCategorySticky ? 'background 0.5s ease-out, backdrop-filter 0.5s ease-out, box-shadow 0.5s ease-out' : 'background 0.2s ease-out, backdrop-filter 0.2s ease-out, box-shadow 0.2s ease-out',
                }}
            >
                <div className={`flex items-center gap-3 backdrop-blur-md max-w-4xl ${isSearchSticky ? 'px-6' : 'mx-auto px-6'
                    }`}>
                    <div className="flex items-center gap-3 flex-1">
                        {/* Back Button */}
                        {selectedCategory && (
                            <button
                                onClick={() => setSelectedCategory(null)}
                                className={`flex-shrink-0 p-3 rounded-xl transition-all duration-200 ${resolvedTheme === 'dark'
                                    ? 'bg-secondary/50 text-gray-300 hover:bg-secondary border border-white/10'
                                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-sm'
                                    }`}
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}

                        {/* Search Bar */}
                        <div className={`relative transition-all duration-300 ${isSearchSticky ? 'flex-1' : 'flex-[1.5]'
                            }`}>
                            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                }`} />
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

                    {/* Profile button stays the same */}
                    <div
                        style={{
                            opacity: isSearchSticky ? 1 : 0,
                            transform: `translateX(${isSearchSticky ? 0 : 20}px) scale(${isSearchSticky ? 1 : 0.8})`,
                            width: isSearchSticky ? '48px' : '0px',
                            minWidth: isSearchSticky ? '48px' : '0px',
                            overflow: 'hidden',
                            transition: 'opacity 0.4s ease-out, transform 0.4s ease-out, width 0.4s ease-out',
                        }}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('appNavigateToProfile', {}));
                            }}
                            className={`rounded-full h-12 w-12 p-0 relative overflow-hidden group flex-shrink-0 transition-all duration-200 ${resolvedTheme === 'dark'
                                ? 'bg-white/10 hover:bg-white/15 border border-white/10'
                                : 'bg-primary/10 hover:bg-primary/15 border border-primary/20'
                                }`}
                            aria-label="View Profile"
                            tabIndex={isSearchSticky ? 0 : -1}
                        >
                            <UserCircle2 className={`w-7 h-7 ${resolvedTheme === 'dark' ? 'text-primary-light' : 'text-primary'
                                }`} />
                        </Button>
                    </div>
                </div>
            </div>
            {/* Global Promo Banners - Hidden when category is selected */}
            {
                !selectedCategory && (
                    <div className={`mb-4 ${isSearchSticky ? 'mt-[120px]' : 'mt-8'}`} >
                        <HomeMediaBanner banners={activeBanners || []} isLoading={isBannersLoading} />
                    </div>
                )
            }

            {/* Category Filter Section */}

            <div className="px-4">
                {!selectedCategory && (
                    <h2 className="text-lg font-semibold mb-3">Categories</h2>
                )}
            </div>
            {selectedCategory && <div ref={trg1} className="h-2px" />}
            {!selectedCategory && <div ref={trg} className="h-2px" />}
            {/* <div ref={trg} className="h-2px" /> */}
            <div className={`mb-4 ${selectedCategory ? 'pt-4' : ''}`}>
                <div
                    className={`${resolvedTheme === 'dark' ? 'bg-background' : 'bg-background'}`}
                    id="category-section"
                    style={{
                        position: isCategorySticky ? 'fixed' : 'relative',
                        top: isCategorySticky ? 78 : 'auto',
                        left: 0,
                        right: 0,
                        zIndex: isCategorySticky ? 50 : 1,
                        paddingTop: isCategorySticky ? '12px' : '12px',
                        paddingBottom: '16px',
                        //Background only when sticky
                        // background: isCategorySticky
                        //     ? (resolvedTheme === 'dark'
                        //         ? 'rgba(15, 10, 24, 0.95)'
                        //         : 'rgba(255, 255, 255, 0.98)')
                        //     : 'transparent',
                        backdropFilter: isCategorySticky ? 'blur(20px) saturate(180%)' : 'none',
                        WebkitBackdropFilter: isCategorySticky ? 'blur(20px) saturate(180%)' : 'none',
                        borderBottom: isCategorySticky
                            ? (resolvedTheme === 'dark'
                                ? '1px solid rgba(255, 255, 255, 0.08)'
                                : '1px solid rgba(0, 0, 0, 0.06)')
                            : 'none',
                        // boxShadow: isCategorySticky
                        //     ? '0 4px 20px rgba(0, 0, 0, 0.08)'
                        //     : 'none',
                        transition: 'background 0.5s ease-out, backdrop-filter 0.5s ease-out, box-shadow 0.5s ease-out',
                    }}
                >
                    <div className={`pl-4 pr-4 flex gap-3 overflow-x-auto scrollbar-hide`}>
                        {categories.map((category) => (

                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category === 'All' ? null : category)}
                                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all duration-200 ${(category === 'All' && !selectedCategory) || selectedCategory === category
                                    ? 'bg-primary text-white shadow-lg'
                                    : resolvedTheme === 'dark'
                                        ? 'bg-secondary/50 text-gray-300 hover:bg-secondary border border-white/10'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                                    }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </div>

            </div>

            <div className={`px-4 flex items-center justify-between ${isCategorySticky ? isSearchSticky && selectedCategory ? 'mt-40' : 'mt-24' : ''}`}>
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
                                onClick={() => setShowLocationSelector(true)}
                            >
                                Change Location
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Location Selector Modal */}
            {
                showLocationSelector && (
                    <LocationSelector
                        onClose={() => setShowLocationSelector(false)}
                    />
                )
            }
        </div >
    );
}
