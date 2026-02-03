import React, { useState, useEffect, useMemo } from 'react';
import { useCanteenContext } from '@/contexts/CanteenContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthSync } from '@/hooks/useDataSync';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Search, ArrowRight, Store, ChevronRight } from 'lucide-react';
import { LoadingIndicator, EmptyState } from '@/components/canteen/CanteenSkeletonLoader';
import LocationSelector from "@/components/profile/LocationSelector";

interface CanteenSelectorPageProps {
    onCanteenSelect: () => void;
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
    const [searchQuery, setSearchQuery] = useState('');
    const [showLocationSelector, setShowLocationSelector] = useState(false);

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
        onCanteenSelect();
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
        if (user?.collegeName) return user.collegeName;
        if (user?.organizationName) return user.organizationName;
        return "All Locations";
    };

    return (
        <div className={`min-h-screen ${resolvedTheme === 'dark' ? 'bg-background' : 'bg-gray-50'}`}>
            {/* Header Section */}
            <div className={`sticky top-0 z-10 ${resolvedTheme === 'dark' ? 'bg-background/95 border-b border-white/10' : 'bg-white/95 border-b border-gray-100'} backdrop-blur-md pb-4 pt-12 px-6 shadow-sm`}>
                <div className="max-w-md mx-auto">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent mb-1">
                        Choose Canteen
                    </h1>
                    <div className="flex items-center text-sm text-muted-foreground mb-6">
                        <MapPin className="w-4 h-4 mr-1 text-primary" />
                        <span className="font-medium truncate max-w-[250px]">{getLocationDisplay()}</span>
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

            {/* Content Section */}
            <div className="px-5 py-6 max-w-md mx-auto pb-24">
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
                                className={`group relative overflow-hidden rounded-2xl p-5 cursor-pointer transition-all duration-300 border hover:shadow-lg active:scale-[0.98] ${resolvedTheme === 'dark'
                                    ? 'bg-card border-white/5 hover:border-primary/30'
                                    : 'bg-white border-gray-100 hover:border-primary/30 shadow-sm'
                                    }`}
                            >
                                <div className="flex items-center space-x-4">
                                    <div className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden shadow-sm border ${resolvedTheme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-gray-50'} relative`}>
                                        {canteen.imageUrl ? (
                                            <img
                                                src={canteen.imageUrl}
                                                alt={canteen.name}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                                onError={(e) => {
                                                    // Fallback to icon on error
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                }}
                                            />
                                        ) : null}

                                        {/* Fallback Icon - Shown if no image or image fails */}
                                        <div className={`${canteen.imageUrl ? 'hidden' : 'flex'} w-full h-full items-center justify-center ${resolvedTheme === 'dark' ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'}`}>
                                            <Store className="w-8 h-8 opacity-75" />
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className={`font-semibold text-lg truncate ${resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                            {canteen.name}
                                        </h3>
                                        {canteen.location && (
                                            <p className={`text-sm mt-1 flex items-center ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                                <MapPin className="w-3.5 h-3.5 mr-1.5 opacity-70 flex-shrink-0" />
                                                <span className="truncate">{canteen.location}</span>
                                            </p>
                                        )}
                                    </div>

                                    <ChevronRight className={`w-5 h-5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform group-hover:translate-x-1 ${resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`} />
                                </div>

                                {/* Decorative background gradient */}
                                < div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
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
        </div >
    );
}
