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
import CurrentOrderBottomSheet from '@/components/orders/CurrentOrderBottomSheet';
import FloatingCart from '@/components/cart/FloatingCart';
import { usePaginatedActiveOrders } from '@/hooks/usePaginatedActiveOrders';


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
    const userCustomerId = user?.id ? Number(user.id) : undefined;
    const { orders: activeOrders, refetch: refetchActiveOrders } = usePaginatedActiveOrders(1, 100, undefined, userCustomerId, !!userCustomerId);
    const hasActiveOrders = Array.isArray(activeOrders) && activeOrders.length > 0;
    const [searchQuery, setSearchQuery] = useState('');
    const [showLocationSelector, setShowLocationSelector] = useState(false);
    const [isSearchSticky, setIsSearchSticky] = useState(false);
    const [isCategorySticky, setIsCategorySticky] = useState(false);
    const [isScrollingDown, setIsScrollingDown] = useState(false);
    const lastScrollY = useRef(0);
    const trg = useRef<HTMLDivElement>(null);
    const trg2 = useRef<HTMLDivElement>(null);
    const trg1 = useRef<HTMLDivElement>(null);

    const categories = [
        'All', 'Breakfast', 'Lunch', 'Dinner', 'Snacks',
        'Beverages', 'Desserts', 'Fast Food', 'Healthy', 'Vegetarian', 'Non-Veg'
    ];

    const { data: activeBanners, isLoading: isBannersLoading } = useQuery({
        queryKey: ['/api/media-banners'],
        queryFn: async () => {
            const res = await fetch('/api/media-banners');
            if (!res.ok) throw new Error('Failed to fetch banners');
            return res.json();
        },
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
    });

    const filteredCanteens = useMemo(() => {
        const filtered = availableCanteens.filter(canteen =>
            canteen.isActive && canteen.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return filtered.sort((a, b) => {
            const priorityA = a.priority ?? 0;
            const priorityB = b.priority ?? 0;
            if (priorityA !== priorityB) return priorityA - priorityB;
            return (a.name || '').localeCompare(b.name || '');
        });
    }, [availableCanteens, searchQuery]);

    const handleCanteenClick = (canteen: any) => {
        setSelectedCanteen(canteen);
        onCanteenSelect(canteen.id);
    };

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

    useEffect(() => {
        const obs = new IntersectionObserver(([e]) => {
            setIsSearchSticky(!e.isIntersecting);
        }, { root: null, threshold: 0, rootMargin: "-13px 0px 0px 0px" });
        if (trg2.current) obs.observe(trg2.current);
        return () => obs.disconnect();
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            const currentY = window.scrollY;
            setIsScrollingDown(currentY > lastScrollY.current && currentY > 50);
            lastScrollY.current = currentY;
            if (window.innerHeight + currentY >= document.body.offsetHeight - 500 && hasNextPage && !isFetchingNextPage && !searchQuery) {
                fetchNextPage();
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [hasNextPage, isFetchingNextPage, searchQuery, fetchNextPage]);

    const getLocationDisplay = () => {
        if (selectedLocationName) return selectedLocationName;
        if (user?.collegeName) return user.collegeName;
        if (user?.organizationName) return user.organizationName;
        return "All Locations";
    };

    return (
        <>
            <div className={`min-h-screen ${resolvedTheme === 'dark' ? 'bg-background' : 'bg-gray-50'}`}>

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="backdrop-blur-md pt-12 px-4 md:px-6">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex items-center justify-between mb-6 gap-3">
                            {/* Location button */}
                            <div className="flex-1 min-w-0">
                                <button
                                    onClick={() => setShowLocationSelector(true)}
                                    className="group flex items-center w-full md:w-auto p-1 rounded-2xl transition-all duration-200"
                                >
                                    <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                        <div className={`p-2 md:p-2.5 rounded-xl transition-all duration-200 shrink-0 ${resolvedTheme === 'dark'
                                            ? 'bg-primary/10 text-primary group-hover:bg-primary/20'
                                            : 'bg-primary/10 text-primary group-hover:bg-primary/20'}`}>
                                            <MapPin className="w-4 h-4 md:w-5 md:h-5" />
                                        </div>
                                        <div className="text-left flex-1 min-w-0">
                                            <div className="text-[10px] md:text-xs text-muted-foreground mb-0.5 whitespace-nowrap">Current Location</div>
                                            <div className="text-base md:text-lg font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent truncate w-full pr-1">
                                                {getLocationDisplay()}
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 md:w-5 md:h-5 ml-1 md:ml-2 shrink-0 transition-transform duration-200 group-hover:translate-y-0.5 ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                                </button>
                            </div>

                            {/* Cart + Profile */}
                            <div className="flex items-center shrink-0 gap-2 md:gap-3">
                                {getTotalItems() > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => window.dispatchEvent(new CustomEvent('appNavigateToCart', {}))}
                                        className="h-11 w-11 md:h-14 md:w-14 p-0 relative overflow-hidden flex items-center justify-center bg-transparent"
                                        aria-label="View Cart"
                                    >
                                        <div className="relative z-10 flex items-center justify-center w-full h-full">
                                            <ShoppingCart className="w-[22px] h-[22px] md:w-7 md:h-7 text-primary" />
                                            <span className="absolute top-0 right-0.5 flex h-4 w-4 md:h-5 md:w-5 items-center justify-center rounded-full bg-[#e13a3a] text-[10px] md:text-xs font-bold text-white shadow-sm ring-2 ring-background">
                                                {getTotalItems()}
                                            </span>
                                        </div>
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => window.dispatchEvent(new CustomEvent('appNavigateToProfile', {}))}
                                    className="rounded-full h-11 w-11 md:h-14 md:w-14 p-0 relative overflow-hidden group shadow-premium hover-scale-subtle"
                                    aria-label="View Profile"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent group-hover:from-primary/30 group-hover:via-primary/20 transition-all duration-300" />
                                    <UserCircle2 className="w-7 h-7 md:w-9 md:h-9 relative z-10 text-primary" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sentinel for search sticky */}
                <div ref={trg2} className="h-px" />

                {/* ── Search bar (sticky-capable) ─────────────────────────── */}
                <div
                    className={`${resolvedTheme === 'dark' ? 'bg-background' : 'bg-background'}`}
                    id="search-bar"
                    style={{
                        position: isSearchSticky ? 'fixed' : 'relative',
                        top: isSearchSticky ? 0 : 'auto',
                        left: 0,
                        right: 0,
                        zIndex: isSearchSticky ? 60 : 1,
                        paddingTop: isSearchSticky ? '12px' : '0',
                        paddingBottom: '16px',
                        backdropFilter: isSearchSticky ? 'blur(20px) saturate(180%)' : 'none',
                        WebkitBackdropFilter: isSearchSticky ? 'blur(20px) saturate(180%)' : 'none',
                        boxShadow: isSearchSticky && !isCategorySticky ? '0 4px 20px rgba(0,0,0,0.08)' : 'none',
                        transition: 'background 0.2s ease-out, backdrop-filter 0.2s ease-out, box-shadow 0.2s ease-out',
                    }}
                >
                    {/* Centered wrapper — matches header max-width */}
                    <div className="max-w-4xl mx-auto px-4 md:px-6">
                        <div className="flex items-center gap-3">
                            {/* Back button when category is selected */}
                            {selectedCategory && (
                                <button
                                    onClick={() => setSelectedCategory(null)}
                                    className={`flex-shrink-0 p-3 rounded-xl transition-all duration-200 ${resolvedTheme === 'dark'
                                        ? 'bg-secondary/50 text-gray-300 hover:bg-secondary border border-white/10'
                                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-sm'}`}
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                            )}

                            {/* Search input */}
                            <div className="relative flex-1">
                                <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                                <input
                                    type="text"
                                    placeholder="Search available canteens..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className={`w-full rounded-2xl py-3.5 pl-12 pr-4 text-sm transition-all duration-200 outline-none ${resolvedTheme === 'dark'
                                        ? 'bg-secondary/50 border border-white/10 focus:border-primary/50 text-white placeholder:text-gray-500'
                                        : 'bg-white border border-gray-200 focus:border-primary/50 text-gray-900 placeholder:text-gray-400 shadow-sm'}`}
                                />
                            </div>

                            {/* Sticky profile avatar */}
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
                                    onClick={() => window.dispatchEvent(new CustomEvent('appNavigateToProfile', {}))}
                                    className={`rounded-full h-12 w-12 p-0 relative overflow-hidden group flex-shrink-0 transition-all duration-200 ${resolvedTheme === 'dark'
                                        ? 'bg-white/10 hover:bg-white/15 border border-white/10'
                                        : 'bg-primary/10 hover:bg-primary/15 border border-primary/20'}`}
                                    aria-label="View Profile"
                                    tabIndex={isSearchSticky ? 0 : -1}
                                >
                                    <UserCircle2 className={`w-7 h-7 ${resolvedTheme === 'dark' ? 'text-primary-light' : 'text-primary'}`} />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Promo banner ────────────────────────────────────────── */}
                {!selectedCategory && (
                    <div className={`max-w-4xl mx-auto px-4 md:px-6 ${isSearchSticky ? 'mt-[72px]' : 'mt-6'} mb-4`}>
                        <HomeMediaBanner banners={activeBanners || []} isLoading={isBannersLoading} />
                    </div>
                )}

                {/* ── Category section label ──────────────────────────────── */}
                {!selectedCategory && (
                    <div className="max-w-4xl mx-auto px-4 md:px-6 mb-2">
                        <h2 className="text-lg font-semibold">Categories</h2>
                    </div>
                )}

                {/* Sentinels for category sticky */}
                {selectedCategory && <div ref={trg1} className="h-px" />}
                {!selectedCategory && <div ref={trg} className="h-px" />}

                {/* ── Category pills (sticky-capable) ─────────────────────── */}
                <div className={`mb-4 ${selectedCategory ? 'pt-4' : ''}`}>
                    <div
                        className={`${resolvedTheme === 'dark' ? 'bg-background' : 'bg-background'}`}
                        id="category-section"
                        style={{
                            position: isCategorySticky ? 'fixed' : 'relative',
                            top: isCategorySticky ? 68 : 'auto',
                            left: 0,
                            right: 0,
                            zIndex: isCategorySticky ? 50 : 1,
                            paddingTop: '12px',
                            paddingBottom: '16px',
                            backdropFilter: isCategorySticky ? 'blur(20px) saturate(180%)' : 'none',
                            WebkitBackdropFilter: isCategorySticky ? 'blur(20px) saturate(180%)' : 'none',
                            borderBottom: isCategorySticky
                                ? resolvedTheme === 'dark'
                                    ? '1px solid rgba(255,255,255,0.08)'
                                    : '1px solid rgba(0,0,0,0.06)'
                                : 'none',
                            boxShadow: isCategorySticky ? '0 4px 20px rgba(0,0,0,0.08)' : 'none',
                            transition: 'background 0.5s ease-out, backdrop-filter 0.5s ease-out, box-shadow 0.5s ease-out',
                        }}
                    >
                        {/* Pills scroll inside the centered column */}
                        <div className="max-w-4xl mx-auto px-4 md:px-6">
                            <div className="flex gap-3 overflow-x-auto scrollbar-hide">
                                {categories.map((category) => (
                                    <button
                                        key={category}
                                        onClick={() => setSelectedCategory(category === 'All' ? null : category)}
                                        className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all duration-200 ${(category === 'All' && !selectedCategory) || selectedCategory === category
                                            ? 'bg-primary text-white shadow-lg'
                                            : resolvedTheme === 'dark'
                                                ? 'bg-secondary/50 text-gray-300 hover:bg-secondary border border-white/10'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'}`}
                                    >
                                        {category}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Section heading ─────────────────────────────────────── */}
                <div className={`max-w-4xl mx-auto px-4 md:px-6 flex items-center justify-between mb-4 ${isCategorySticky
                    ? isSearchSticky && selectedCategory ? 'mt-40' : 'mt-24'
                    : ''}`}>
                    <h1 className="text-2xl font-bold">Available Canteens</h1>
                </div>

                {/* ── Canteen grid ─────────────────────────────────────────── */}
                <div className="max-w-4xl mx-auto px-4 md:px-6 pb-32">

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
                                <div key={i} className={`h-24 rounded-2xl animate-pulse ${resolvedTheme === 'dark' ? 'bg-gray-800' : 'bg-white'}`} />
                            ))}
                        </div>

                    ) : filteredCanteens.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                            {filteredCanteens.map((canteen) => (
                                <div
                                    key={canteen.id}
                                    onClick={() => handleCanteenClick(canteen)}
                                    className={`group relative overflow-hidden rounded-3xl cursor-pointer transition-all duration-300 hover:shadow-2xl active:scale-[0.98] ${resolvedTheme === 'dark'
                                        ? 'bg-gradient-to-b from-gray-800/90 to-gray-900/90 border border-white/5'
                                        : 'bg-white border border-gray-100 shadow-md'}`}
                                >
                                    {/* Card image */}
                                    <div className="relative w-full aspect-[16/9] overflow-hidden">
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
                                        <div className={`${canteen.imageUrl ? 'hidden' : 'flex'} w-full h-full items-center justify-center ${resolvedTheme === 'dark' ? 'bg-purple-900/40' : 'bg-purple-100'}`}>
                                            <Store className={`w-20 h-20 ${resolvedTheme === 'dark' ? 'text-purple-400' : 'text-purple-500'} opacity-60`} />
                                        </div>

                                        {/* Trending badge */}
                                        <div className="absolute top-3 left-3">
                                            <div className="bg-primary text-white px-3 py-1.5 rounded-full shadow-lg">
                                                {canteen.trendingItems && canteen.trendingItems.length > 0 ? (
                                                    canteen.trendingItems.slice(0, 1).map((item, index) => (
                                                        <span key={index} className="text-xs font-bold">{item.name} at ₹{item.price}</span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs font-bold">New</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bookmark */}
                                        <div className="absolute top-3 right-3">
                                            <div className={`p-2.5 rounded-full ${resolvedTheme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
                                                <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card body */}
                                    <div className="p-4">
                                        <h3 className={`font-bold text-lg mb-3 truncate ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                            {canteen.name}
                                        </h3>
                                        <div className="flex items-center justify-between gap-4">
                                            {/* Category tags */}
                                            <div className="flex items-center gap-2 text-sm overflow-hidden">
                                                {canteen.categories && canteen.categories.length > 0 ? (
                                                    canteen.categories.slice(0, 3).map((category: string, idx: number) => (
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
                                                        <span className={resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Burger</span>
                                                        <span className={resolvedTheme === 'dark' ? 'text-gray-600' : 'text-gray-400'}>•</span>
                                                        <span className={resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Pizza</span>
                                                        <span className={resolvedTheme === 'dark' ? 'text-gray-600' : 'text-gray-400'}>•</span>
                                                        <span className={resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Fast Food</span>
                                                    </>
                                                )}
                                            </div>
                                            {/* Star rating */}
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className="text-yellow-400 text-lg">★</span>
                                                <span className={`text-sm font-bold ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>4.9</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                    <div
                                        className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                        style={{
                                            boxShadow: resolvedTheme === 'dark'
                                                ? '0 0 30px rgba(139,92,246,0.3)'
                                                : '0 0 30px rgba(139,92,246,0.2)'
                                        }}
                                    />
                                </div>
                            ))}

                            {isFetchingNextPage && (
                                <div className="col-span-full py-4 text-center">
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
                            <Button variant="outline" className="mt-6 rounded-full" onClick={() => window.location.reload()}>
                                Refresh Page
                            </Button>
                            <div className="mt-8 pt-8 border-t border-dashed border-gray-200 dark:border-gray-800">
                                <p className="text-sm text-muted-foreground mb-4">Wrong location?</p>
                                <Button variant="ghost" onClick={() => setShowLocationSelector(true)}>
                                    Change Location
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Location Selector Modal */}
                {showLocationSelector && (
                    <LocationSelector onClose={() => setShowLocationSelector(false)} />
                )}
            </div>

            <FloatingCart
                skipCanteenCheck={true}
                showOnlyWhenLiveOrderHidden={true}
                isLiveOrderHidden={!hasActiveOrders || isScrollingDown}
            />

            <CurrentOrderBottomSheet
                activeOrders={Array.isArray(activeOrders) ? activeOrders : []}
                refetchOrders={refetchActiveOrders}
                forceHidden={isScrollingDown}
            />
        </>
    );
}
