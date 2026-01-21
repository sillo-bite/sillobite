import { useState, useEffect } from 'react';

/**
 * Calculate how many category items can fit in the viewport width
 * 
 * Category item widths:
 * - Menu (first item): 115px
 * - Regular categories: 90px
 * - Gap between items: 12px (gap-3)
 * - Padding: 16px left (first item) + 16px right (last item) = 32px total
 */
export function useDynamicCategoryPageSize(extraBuffer: number = 2): {
    initialPageSize: number;
    subsequentPageSize: number;
} {
    const [initialPageSize, setInitialPageSize] = useState(5); // Default fallback

    useEffect(() => {
        const calculateFittingCategories = () => {
            const screenWidth = window.innerWidth;

            // Constants for category layout
            const MENU_ITEM_WIDTH = 115; // First "Menu" category
            const REGULAR_ITEM_WIDTH = 90; // Regular category items
            const GAP = 12; // gap-3 = 12px
            const HORIZONTAL_PADDING = 32; // 16px left + 16px right

            // Available width for categories
            const availableWidth = screenWidth - HORIZONTAL_PADDING;

            // First item takes MENU_ITEM_WIDTH + GAP
            let usedWidth = MENU_ITEM_WIDTH + GAP;
            let count = 1; // Start with 1 for the Menu item

            // Calculate how many regular categories can fit
            while (usedWidth + REGULAR_ITEM_WIDTH <= availableWidth) {
                usedWidth += REGULAR_ITEM_WIDTH + GAP;
                count++;
            }

            // Add extra buffer items to preload (user requested +2)
            const pageSize = Math.max(count + extraBuffer, 5); // Minimum 5 items

            setInitialPageSize(pageSize);
        };

        // Calculate on mount
        calculateFittingCategories();

        // Recalculate on resize
        window.addEventListener('resize', calculateFittingCategories);
        return () => window.removeEventListener('resize', calculateFittingCategories);
    }, [extraBuffer]);

    return {
        initialPageSize,
        subsequentPageSize: 5 // Always load 5 more on scroll
    };
}
