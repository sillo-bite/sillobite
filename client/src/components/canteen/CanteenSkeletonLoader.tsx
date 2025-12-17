import React from 'react';

interface CanteenSkeletonLoaderProps {
  theme: string;
  count?: number;
}

export function CanteenSkeletonLoader({ theme, count = 1 }: CanteenSkeletonLoaderProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`p-3 rounded-lg border relative overflow-hidden ${
            theme === 'dark' 
              ? 'border-gray-700 bg-gray-800/50' 
              : 'border-gray-200 bg-gray-50'
          }`}
        >
          {/* Shimmer effect */}
          <div className={`absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] ${
            theme === 'dark' 
              ? 'bg-gradient-to-r from-transparent via-gray-700/50 to-transparent' 
              : 'bg-gradient-to-r from-transparent via-gray-200/50 to-transparent'
          }`} />
          
          <div className="flex items-center justify-between relative">
            <div className="flex-1 min-w-0">
              {/* Canteen name skeleton */}
              <div className={`h-4 rounded-md mb-2 animate-pulse ${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'
              }`} style={{ width: `${Math.random() * 40 + 60}%` }} />
              
              {/* Location skeleton */}
              <div className={`h-3 rounded-md animate-pulse ${
                theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
              }`} style={{ width: `${Math.random() * 30 + 40}%` }} />
            </div>
            
            {/* Status indicator skeleton */}
            <div className={`w-2 h-2 rounded-full ml-2 animate-pulse ${
              theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
            }`} />
          </div>
        </div>
      ))}
    </>
  );
}

interface LoadingIndicatorProps {
  theme: string;
  isFetching: boolean;
  hasNextPage: boolean;
  totalLoaded: number;
  totalAvailable: number;
}

export function LoadingIndicator({ 
  theme, 
  isFetching, 
  hasNextPage, 
  totalLoaded, 
  totalAvailable 
}: LoadingIndicatorProps) {
  if (!hasNextPage) {
    return (
      <div className={`text-xs text-center py-3 border-t ${
        theme === 'dark' ? 'text-gray-500 border-gray-700' : 'text-gray-500 border-gray-200'
      }`}>
        <div className="flex items-center justify-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            theme === 'dark' ? 'bg-green-500' : 'bg-green-400'
          }`} />
          <span>All canteens loaded</span>
        </div>
      </div>
    );
  }

  if (isFetching) {
    return (
      <div className="py-4">
        <div className="flex items-center justify-center space-x-3">
          {/* Beautiful animated loading dots */}
          <div className="flex space-x-1">
            <div className={`w-2 h-2 rounded-full animate-bounce ${
              theme === 'dark' ? 'bg-red-500' : 'bg-red-400'
            }`} style={{ animationDelay: '0ms' }} />
            <div className={`w-2 h-2 rounded-full animate-bounce ${
              theme === 'dark' ? 'bg-red-500' : 'bg-red-400'
            }`} style={{ animationDelay: '150ms' }} />
            <div className={`w-2 h-2 rounded-full animate-bounce ${
              theme === 'dark' ? 'bg-red-500' : 'bg-red-400'
            }`} style={{ animationDelay: '300ms' }} />
          </div>
          <span className={`text-sm font-medium animate-pulse ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Loading more canteens...
          </span>
        </div>
        
        {/* Beautiful progress bar with gradient */}
        <div className={`mt-3 w-full h-2 rounded-full overflow-hidden ${
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
        }`}>
          <div 
            className="h-full bg-gradient-to-r from-red-500 via-red-400 to-red-500 rounded-full animate-pulse relative"
            style={{ width: `${(totalLoaded / totalAvailable) * 100}%` }}
          >
            {/* Shimmer effect on progress bar */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]" />
          </div>
        </div>
        
        {/* Progress text with animation */}
        <div className={`text-xs text-center mt-2 transition-all duration-300 ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>
          <span className="font-medium">{totalLoaded}</span> of <span className="font-medium">{totalAvailable}</span> canteens loaded
        </div>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="flex items-center justify-center space-x-2">
        <div className={`w-1 h-1 rounded-full ${
          theme === 'dark' ? 'bg-gray-500' : 'bg-gray-400'
        }`} />
        <div className={`w-1 h-1 rounded-full ${
          theme === 'dark' ? 'bg-gray-500' : 'bg-gray-400'
        }`} />
        <div className={`w-1 h-1 rounded-full ${
          theme === 'dark' ? 'bg-gray-500' : 'bg-gray-400'
        }`} />
      </div>
      <div className={`text-xs text-center mt-2 ${
        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
      }`}>
        Scroll down to load more
      </div>
    </div>
  );
}

interface EmptyStateProps {
  theme: string;
  searchQuery: string;
  isFiltered: boolean;
  userCollege?: string;
}

export function EmptyState({ theme, searchQuery, isFiltered, userCollege }: EmptyStateProps) {
  return (
    <div className={`text-center py-8 ${
      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
    }`}>
      <div className="mb-4">
        {/* Animated empty state icon */}
        <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
          theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
        }`}>
          <div className={`w-8 h-8 rounded-full ${
            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'
          } animate-pulse`} />
        </div>
      </div>
      
      {searchQuery ? (
        <div>
          <p className={`text-sm font-medium mb-1 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            No canteens found
          </p>
          <p className={`text-xs ${
            theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
          }`}>
            Try a different search term
          </p>
        </div>
      ) : isFiltered ? (
        <div>
          <p className={`text-sm font-medium mb-1 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            No canteens available
          </p>
          <p className={`text-xs ${
            theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
          }`}>
            College: {userCollege}
          </p>
        </div>
      ) : (
        <p className={`text-sm ${
          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
        }`}>
          No active canteens available
        </p>
      )}
    </div>
  );
}
