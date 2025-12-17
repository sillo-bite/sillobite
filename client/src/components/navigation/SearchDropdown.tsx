import React from "react";
import { Search } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useDropdownAnimation, useStaggeredAnimation, useReducedMotion } from "@/utils/dropdownAnimations";

interface SearchDropdownProps {
  showDropdown: boolean;
  searchHistory: string[];
  suggestions: string[];
  onSearch: (query: string) => void;
  onClearHistory: () => void;
  onRemoveFromHistory: (query: string) => void;
}

const SearchDropdown = React.memo(function SearchDropdown({
  showDropdown,
  searchHistory,
  suggestions,
  onSearch,
  onClearHistory,
  onRemoveFromHistory
}: SearchDropdownProps) {
  const { resolvedTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const { shouldRender, animationClass } = useDropdownAnimation(showDropdown);
  const totalItems = searchHistory.length + suggestions.length;
  const visibleItems = useStaggeredAnimation(totalItems, showDropdown);
  
  // Calculate proper animation indices for search history items
  const getHistoryItemIndex = (index: number) => suggestions.length + index;

  if (!shouldRender || (searchHistory.length === 0 && suggestions.length === 0)) {
    return null;
  }

  const getDropdownClassName = () => {
    const baseClasses = "absolute bottom-full left-0 right-0 mb-2 rounded-xl border z-40 max-h-60 overflow-y-auto";
    const themeClasses = resolvedTheme === 'dark' 
      ? 'bg-black border-gray-800 shadow-2xl' 
      : 'bg-white border-gray-200 shadow-lg';
    
    return `${baseClasses} ${themeClasses}`;
  };

  const getSectionTitleClassName = () => {
    const baseClasses = "text-sm font-medium mb-2";
    const themeClasses = resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-800';
    return `${baseClasses} ${themeClasses}`;
  };

  const getSuggestionItemClassName = () => {
    const baseClasses = "flex items-center space-x-2 p-2 rounded-lg cursor-pointer";
    const themeClasses = resolvedTheme === 'dark' 
      ? 'hover:bg-gray-800' 
      : 'hover:bg-gray-100';
    
    return `${baseClasses} ${themeClasses}`;
  };

  const getSuggestionTextClassName = () => {
    const baseClasses = "text-sm";
    const themeClasses = resolvedTheme === 'dark' ? 'text-gray-200' : 'text-gray-700';
    return `${baseClasses} ${themeClasses}`;
  };

  const getHistoryItemClassName = () => {
    const baseClasses = "flex items-center justify-between p-2 rounded-lg cursor-pointer group";
    const themeClasses = resolvedTheme === 'dark' 
      ? 'hover:bg-gray-800' 
      : 'hover:bg-gray-100';
    
    return `${baseClasses} ${themeClasses}`;
  };

  const getHistoryTextClassName = () => {
    const baseClasses = "text-sm";
    const themeClasses = resolvedTheme === 'dark' ? 'text-gray-200' : 'text-gray-700';
    return `${baseClasses} ${themeClasses}`;
  };

  const getClearButtonClassName = () => {
    const baseClasses = "text-xs";
    const themeClasses = resolvedTheme === 'dark' 
      ? 'text-gray-400 hover:text-gray-200' 
      : 'text-gray-500 hover:text-gray-700';
    
    return `${baseClasses} ${themeClasses}`;
  };

  const getRemoveButtonClassName = () => {
    return "opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity";
  };

  return (
    <div className={`${getDropdownClassName()} dropdown-container ${prefersReducedMotion ? '' : animationClass}`}>
      <div className="p-2">
        {/* Search Suggestions */}
        {suggestions.length > 0 && (
          <div className="mb-3">
            <h3 className={getSectionTitleClassName()}>Suggestions</h3>
            <div className="space-y-1">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`${getSuggestionItemClassName()} dropdown-item ${
                    prefersReducedMotion ? '' : 
                    visibleItems.includes(index) ? 'animate-dropdown-stagger' : 'opacity-0'
                  }`}
                  onClick={() => onSearch(suggestion)}
                  style={{
                    animationDelay: prefersReducedMotion ? '0ms' : `${index * 50}ms`
                  }}
                >
                  <Search className="w-4 h-4 text-blue-400" />
                  <span className={getSuggestionTextClassName()}>{suggestion}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Search History */}
        {searchHistory.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className={getSectionTitleClassName()}>Recent Searches</h3>
              <button
                onClick={onClearHistory}
                className={getClearButtonClassName()}
              >
                Clear
              </button>
            </div>
            <div className="space-y-1">
              {searchHistory.map((query, index) => (
                <div
                  key={index}
                  className={`${getHistoryItemClassName()} dropdown-item ${
                    prefersReducedMotion ? '' : 
                    visibleItems.includes(getHistoryItemIndex(index)) ? 'animate-dropdown-stagger' : 'opacity-0'
                  }`}
                  onClick={() => onSearch(query)}
                  style={{
                    animationDelay: prefersReducedMotion ? '0ms' : `${getHistoryItemIndex(index) * 50}ms`
                  }}
                >
                  <div className="flex items-center space-x-2">
                    <Search className="w-4 h-4 text-gray-400" />
                    <span className={getHistoryTextClassName()}>{query}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFromHistory(query);
                    }}
                    className={getRemoveButtonClassName()}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default SearchDropdown;
