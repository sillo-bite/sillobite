import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useCanteenContext } from '@/contexts/CanteenContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronDown, MapPin, Search, X } from 'lucide-react';
import { CanteenSkeletonLoader, LoadingIndicator, EmptyState } from './CanteenSkeletonLoader';
import { useDropdownAnimation, useStaggeredAnimation, useReducedMotion } from '@/utils/dropdownAnimations';

const CanteenSelector = React.memo(function CanteenSelector() {
  const { 
    selectedCanteen, 
    setSelectedCanteen, 
    availableCanteens, 
    isLoading, 
    userCollege, 
    isFiltered,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    totalCanteens
  } = useCanteenContext();
  const { resolvedTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Refs for infinite scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Filter and sort canteens based on search query (memoized)
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
  
  // Animation hooks (after filteredCanteens is defined)
  const { shouldRender: shouldRenderDropdown, animationClass: dropdownAnimationClass } = useDropdownAnimation(isOpen, 0);
  const { shouldRender: shouldRenderSearch, animationClass: searchAnimationClass } = useDropdownAnimation(isSearchOpen, 100);
  
  // Simplified staggered animation - just use index-based delays
  const shouldAnimateItems = isOpen && !isSearchOpen;

  // Infinite scroll callback
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || !hasNextPage || isFetchingNextPage) {
      return;
    }

    // Don't trigger infinite scroll when searching
    if (searchQuery.trim()) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100; // 100px threshold

    if (isNearBottom) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, searchQuery, fetchNextPage]);

  // Prevent scroll propagation when at boundaries using native event listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    const backdrop = backdropRef.current;
    if (!container || !isOpen) {
      return;
    }

    // Save scroll position and lock body with CSS
    const savedScrollY = window.scrollY;
    const savedScrollTop = document.documentElement.scrollTop;
    
    // Lock body scroll using CSS (most effective method)
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    
    // Lock both body and html to prevent all scrolling
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.width = '100%';
    document.documentElement.style.overflow = 'hidden';

    // Add CSS to prevent scroll chaining on container
    container.style.overscrollBehavior = 'contain';
    container.style.overscrollBehaviorY = 'contain';

    // Prevent scrolling on backdrop using non-passive listeners
    const handleBackdropWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    // Track touch start position to detect taps vs scrolls
    let touchStartY = 0;
    let touchStartX = 0;

    const handleBackdropTouchMove = (e: TouchEvent) => {
      // Only prevent if there's actual movement (scrolling)
      if (e.touches.length > 0) {
        const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
        const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
        // If moved more than 5px, it's a scroll - prevent it
        if (deltaY > 5 || deltaX > 5) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      }
    };

    const handleBackdropTouchStart = (e: TouchEvent) => {
      // Store touch start position but don't prevent default
      // This allows tap/click to work while still tracking for scroll detection
      if (e.touches.length > 0) {
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
      }
    };

    // Attach non-passive listeners directly to backdrop element
    if (backdrop) {
      backdrop.addEventListener('wheel', handleBackdropWheel, { passive: false });
      backdrop.addEventListener('touchmove', handleBackdropTouchMove, { passive: false });
      backdrop.addEventListener('touchstart', handleBackdropTouchStart, { passive: true });
    }

    // Simple approach: Prevent ALL wheel events on document/body EXCEPT from scroll container
    const handleDocumentWheel = (e: WheelEvent) => {
      const target = e.target as Node;
      
      // Skip if event is from backdrop (already handled)
      if (backdrop && backdrop.contains(target)) {
        return;
      }
      
      // ONLY allow scrolling if event is from the scroll container
      if (container.contains(target)) {
        // Check boundaries for container
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isScrollable = scrollHeight > clientHeight;
        
        if (!isScrollable) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        const tolerance = 1;
        const isAtTop = scrollTop <= tolerance;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - tolerance;
        const scrollingUp = e.deltaY < 0;
        const scrollingDown = e.deltaY > 0;

        // If at boundary and trying to scroll further, prevent it
        if ((scrollingUp && isAtTop) || (scrollingDown && isAtBottom)) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Otherwise, allow scroll but stop propagation to prevent page scroll
        e.stopPropagation();
      } else {
        // Event is NOT from scroll container - PREVENT IT COMPLETELY
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    // Track touch start for backdrop to detect taps vs scrolls
    let documentTouchStartY = 0;
    let documentTouchStartX = 0;

    // Prevent ALL scroll events on document (except from container)
    const handleDocumentScroll = (e: Event) => {
      const target = e.target as Node;
      
      // Only allow scroll events from the container
      if (!container.contains(target)) {
        e.preventDefault();
        e.stopPropagation();
        // Restore scroll position
        window.scrollTo(0, savedScrollY);
        document.documentElement.scrollTop = savedScrollTop;
      }
    };

    // Prevent touchmove on everything except container
    const handleDocumentTouchMove = (e: TouchEvent) => {
      const target = e.target as Node;
      
      // If touching the backdrop, only prevent if there's actual movement (scrolling)
      if (backdrop && backdrop.contains(target)) {
        if (e.touches.length > 0) {
          const deltaY = Math.abs(e.touches[0].clientY - documentTouchStartY);
          const deltaX = Math.abs(e.touches[0].clientX - documentTouchStartX);
          // If moved more than 5px, it's a scroll - prevent it
          if (deltaY > 5 || deltaX > 5) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
        return;
      }
      
      // Only allow touch scrolling within container
      if (!container.contains(target)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    const handleDocumentTouchStart = (e: TouchEvent) => {
      const target = e.target as Node;
      
      // If touching the backdrop, track position but don't prevent default
      // This allows tap/click to work while still tracking for scroll detection
      if (backdrop && backdrop.contains(target)) {
        if (e.touches.length > 0) {
          documentTouchStartY = e.touches[0].clientY;
          documentTouchStartX = e.touches[0].clientX;
        }
        // Don't prevent default - allow tap to trigger click
      }
    };

    // Add listeners with highest priority (capture phase, early)
    document.addEventListener('wheel', handleDocumentWheel, { passive: false, capture: true });
    window.addEventListener('scroll', handleDocumentScroll, { passive: false, capture: true });
    document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false, capture: true });
    document.addEventListener('touchstart', handleDocumentTouchStart, { passive: false, capture: true });

    return () => {
      // Remove backdrop listeners
      if (backdrop) {
        backdrop.removeEventListener('wheel', handleBackdropWheel);
        backdrop.removeEventListener('touchmove', handleBackdropTouchMove);
        backdrop.removeEventListener('touchstart', handleBackdropTouchStart);
      }

      // Restore body styles
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.width = originalBodyWidth;
      document.documentElement.style.overflow = originalHtmlOverflow;
      
      // Restore scroll position
      window.scrollTo(0, savedScrollY);
      
      // Remove CSS from container
      container.style.overscrollBehavior = '';
      container.style.overscrollBehaviorY = '';
      
      // Remove event listeners
      document.removeEventListener('wheel', handleDocumentWheel, { capture: true });
      window.removeEventListener('scroll', handleDocumentScroll, { capture: true });
      document.removeEventListener('touchmove', handleDocumentTouchMove, { capture: true });
      document.removeEventListener('touchstart', handleDocumentTouchStart, { capture: true });
    };
  }, [isOpen]);

  // Intersection Observer for loading indicator
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage && !searchQuery) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    return () => {
      if (loadingRef.current) {
        observer.unobserve(loadingRef.current);
      }
    };
  }, [hasNextPage, isFetchingNextPage, searchQuery, fetchNextPage]);

  const handleSearchToggle = () => {
    setIsSearchOpen(!isSearchOpen);
    if (isSearchOpen) {
      setSearchQuery('');
    }
  };

  const handleCloseSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const handleDropdownClose = () => {
    setIsOpen(false);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  // Reset search when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  }, [isOpen]);

  // Calculate dropdown position when opening and on scroll/resize
  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 8, // 8px spacing (mt-2 = 0.5rem = 8px)
          left: rect.left + window.scrollX
        });
      }
    };

    // Calculate initial position
    updatePosition();

    // Update on scroll/resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 text-foreground px-4 py-2">
        <MapPin className="w-5 h-5" />
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-20"></div>
          <div className="h-3 bg-muted rounded w-16 mt-1"></div>
        </div>
      </div>
    );
  }

  if (!selectedCanteen) {
    return (
      <div className="flex items-center space-x-2 text-foreground px-4 py-2">
        <MapPin className="w-5 h-5" />
        <div>
          <div className="text-sm font-medium">No Canteen</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Selected Canteen Display */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 text-foreground hover:bg-muted rounded-lg px-4 py-2 transition-all duration-200"
      >
        <MapPin className="w-5 h-5 text-primary" />
        <div className="text-left min-w-0 flex-1">
          <div className="text-sm font-medium truncate max-w-40">{selectedCanteen.name}</div>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown - Rendered via Portal to escape header container */}
      {shouldRenderDropdown && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop */}
          <div 
            ref={backdropRef}
            className="fixed inset-0 z-[110] transition-opacity duration-200 opacity-100"
            onClick={handleDropdownClose}
            style={{ 
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              touchAction: 'none',
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch'
            }}
          />
          
          {/* Dropdown Content - Fixed positioning to overlay header */}
          <div className={`fixed w-72 rounded-xl shadow-xl border z-[110] max-h-80 dropdown-container ${
            resolvedTheme === 'dark' 
              ? 'bg-black border-gray-800 shadow-2xl' 
              : 'bg-white border-gray-100'
          } ${prefersReducedMotion ? '' : dropdownAnimationClass}`}
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            transformOrigin: 'top left'
          }}>
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-sm font-semibold flex items-center gap-2 ${
                  resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  <MapPin className="w-4 h-4 text-red-500" />
                  Select Canteen
                </h3>
                <button
                  onClick={handleSearchToggle}
                  className={`transition-colors duration-200 p-1 ${
                    resolvedTheme === 'dark' 
                      ? 'text-gray-400 hover:text-gray-200' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>

              {/* Search Bar - Animated */}
              <div className={`overflow-hidden transition-all duration-300 ease-out mb-3 ${
                isSearchOpen ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0'
              } ${prefersReducedMotion ? '' : searchAnimationClass}`}
              style={{
                transformOrigin: 'top center',
                willChange: 'max-height, opacity, transform'
              }}>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Search canteens..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`flex-1 border rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                      resolvedTheme === 'dark'
                        ? 'bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-400'
                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400'
                    }`}
                    autoFocus={isSearchOpen}
                  />
                  <button
                    onClick={handleCloseSearch}
                    className={`transition-colors duration-200 p-1 ${
                      resolvedTheme === 'dark' 
                        ? 'text-gray-400 hover:text-gray-200' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Scrollable canteens list */}
              <div 
                ref={scrollContainerRef}
                className="space-y-3 max-h-60 overflow-y-auto pr-2 canteen-selector-scrollbar"
                onScroll={handleScroll}
              >
                {filteredCanteens.map((canteen, index) => (
                  <div
                    key={canteen.id}
                    className={`dropdown-item transition-all duration-200 hover:scale-[1.02] ${
                      prefersReducedMotion ? '' : 
                      shouldAnimateItems ? 'animate-dropdown-stagger' : ''
                    }`}
                    style={{
                      animationDelay: prefersReducedMotion ? '0ms' : `${index * 30}ms`,
                      willChange: 'transform, opacity'
                    }}
                  >
                    <CanteenCard
                      canteen={canteen}
                      isSelected={selectedCanteen.id === canteen.id}
                      onSelect={() => {
                        setSelectedCanteen(canteen);
                        handleDropdownClose();
                      }}
                      theme={resolvedTheme}
                    />
                  </div>
                ))}
                
                {/* Skeleton loading for initial load */}
                {isLoading && filteredCanteens.length === 0 && (
                  <CanteenSkeletonLoader theme={resolvedTheme} count={3} />
                )}
                
                {/* Beautiful loading indicator for infinite scroll */}
                {hasNextPage && !searchQuery && (
                  <div ref={loadingRef}>
                    <LoadingIndicator
                      theme={resolvedTheme}
                      isFetching={isFetchingNextPage}
                      hasNextPage={hasNextPage}
                      totalLoaded={availableCanteens.length}
                      totalAvailable={totalCanteens}
                    />
                  </div>
                )}
                
                {/* Show completion state when all canteens are loaded */}
                {!hasNextPage && !searchQuery && totalCanteens > 0 && (
                  <LoadingIndicator
                    theme={resolvedTheme}
                    isFetching={false}
                    hasNextPage={false}
                    totalLoaded={availableCanteens.length}
                    totalAvailable={totalCanteens}
                  />
                )}
              </div>
              
              {filteredCanteens.length === 0 && !isLoading && (
                <EmptyState
                  theme={resolvedTheme}
                  searchQuery={searchQuery}
                  isFiltered={isFiltered}
                  userCollege={userCollege}
                />
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
});

// CanteenCard component
interface CanteenCardProps {
  canteen: any;
  isSelected: boolean;
  onSelect: () => void;
  theme: string;
}

function CanteenCard({ canteen, isSelected, onSelect, theme }: CanteenCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`group p-3 rounded-lg border cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-[1.02] ${
        isSelected
          ? theme === 'dark'
            ? 'border-red-500 bg-red-900/30 shadow-md ring-2 ring-red-500/20'
            : 'border-red-500 bg-red-50 shadow-md ring-2 ring-red-500/20'
          : theme === 'dark'
            ? 'border-gray-700 hover:border-red-400 hover:bg-red-900/20 hover:ring-1 hover:ring-red-400/20'
            : 'border-gray-200 hover:border-red-300 hover:bg-red-50/30 hover:ring-1 hover:ring-red-300/20'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium text-sm truncate transition-colors duration-200 ${
            isSelected 
              ? theme === 'dark' ? 'text-red-100' : 'text-red-900'
              : theme === 'dark' ? 'text-gray-100 group-hover:text-red-100' : 'text-gray-900 group-hover:text-red-900'
          }`}>
            {canteen.name}
          </h4>
          {canteen.location && (
            <p className={`text-xs mt-1 truncate transition-colors duration-200 ${
              isSelected 
                ? theme === 'dark' ? 'text-red-200/80' : 'text-red-700'
                : theme === 'dark' ? 'text-gray-400 group-hover:text-red-200/80' : 'text-gray-500 group-hover:text-red-700'
            }`}>
              📍 {canteen.location}
            </p>
          )}
        </div>
        {isSelected && (
          <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 ml-2 animate-pulse"></div>
        )}
      </div>
    </div>
  );
}

export { CanteenSelector };

