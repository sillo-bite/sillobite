import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface CategorySkeletonLoaderProps {
  count?: number;
}

export function CategorySkeletonLoader({ count = 5 }: CategorySkeletonLoaderProps) {
  const { resolvedTheme } = useTheme();

  return (
    <>
      {Array.from({ length: count }).map((_, index) => {
        const isFirst = index === 0;
        const isLast = index === count - 1;
        return (
          <div
            key={index}
            className={`cursor-pointer hover:scale-105 transition-transform flex-shrink-0 w-[100px] flex flex-col items-center justify-center ${
              isFirst ? 'pl-4' : ''} ${isLast ? 'pr-4' : ''}`}
          >
            {/* Icon skeleton */}
            <div className="flex items-center justify-center mx-auto mb-2">
              <div className={`w-12 h-12 rounded-full animate-pulse ${
                resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'
              }`} />
            </div>
            
            {/* Text skeleton */}
            <div className={`h-3 rounded-md animate-pulse ${
              resolvedTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'
            }`} style={{ width: `${Math.random() * 20 + 60}%` }} />
          </div>
        );
      })}
    </>
  );
}

interface CategoryLoadingIndicatorProps {
  isFetching: boolean;
  hasNextPage: boolean;
  totalLoaded: number;
  totalAvailable: number;
}

export function CategoryLoadingIndicator({ 
  isFetching, 
  hasNextPage, 
  totalLoaded, 
  totalAvailable 
}: CategoryLoadingIndicatorProps) {
  const { resolvedTheme } = useTheme();

  if (!hasNextPage) {
    return (
      <div className={`text-xs text-center py-2 ${
        resolvedTheme === 'dark' ? 'text-gray-500' : 'text-gray-500'
      }`}>
        <div className="flex items-center justify-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            resolvedTheme === 'dark' ? 'bg-green-500' : 'bg-green-400'
          }`} />
          <span>All categories loaded</span>
        </div>
      </div>
    );
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center space-x-2 py-2">
        {/* Loading dots */}
        <div className="flex space-x-1">
          <div className={`w-2 h-2 rounded-full animate-bounce ${
            resolvedTheme === 'dark' ? 'bg-[#B37ED7]' : 'bg-[#724491]'
          }`} style={{ animationDelay: '0ms' }} />
          <div className={`w-2 h-2 rounded-full animate-bounce ${
            resolvedTheme === 'dark' ? 'bg-[#B37ED7]' : 'bg-[#724491]'
          }`} style={{ animationDelay: '150ms' }} />
          <div className={`w-2 h-2 rounded-full animate-bounce ${
            resolvedTheme === 'dark' ? 'bg-[#B37ED7]' : 'bg-[#724491]'
          }`} style={{ animationDelay: '300ms' }} />
        </div>
        <span className={`text-xs font-medium animate-pulse ${
          resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-600'
        }`}>
          Loading more...
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center space-x-1 py-2">
      <div className={`w-1 h-1 rounded-full ${
        resolvedTheme === 'dark' ? 'bg-gray-500' : 'bg-gray-400'
      }`} />
      <div className={`w-1 h-1 rounded-full ${
        resolvedTheme === 'dark' ? 'bg-gray-500' : 'bg-gray-400'
      }`} />
      <div className={`w-1 h-1 rounded-full ${
        resolvedTheme === 'dark' ? 'bg-gray-500' : 'bg-gray-400'
      }`} />
    </div>
  );
}
