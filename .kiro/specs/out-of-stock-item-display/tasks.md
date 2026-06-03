# Implementation Plan: Out-of-Stock Item Display

## Overview

This implementation enhances the menu browsing experience by displaying out-of-stock items with visual indicators. The solution modifies the existing `MenuListingPage` component to show items with `stock === 0`, applies visual styling (opacity reduction and banner overlay), and disables cart addition for unavailable items. The backend API already supports returning out-of-stock items via the `availableOnly` query parameter, so minimal backend changes are needed.

## Tasks

- [ ] 1. Verify backend API capability for out-of-stock items
  - Test the existing `/api/menu` endpoint with `availableOnly=false` parameter
  - Verify that items with `stock === 0` are returned in the response
  - Confirm that all returned items include the `stock` field
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ]* 1.1 Write property test for API inclusion behavior
  - **Property 1: API Returns Out-of-Stock Items When Requested**
  - **Validates: Requirements 1.1, 5.2**

- [ ]* 1.2 Write property test for API exclusion behavior
  - **Property 2: API Excludes Out-of-Stock Items By Default**
  - **Validates: Requirements 5.3**

- [ ]* 1.3 Write property test for stock field presence
  - **Property 3: API Response Includes Stock Field**
  - **Validates: Requirements 5.4**

- [ ] 2. Modify MenuListingPage to request out-of-stock items
  - Update the API call in `MenuListingPage.tsx` to include `availableOnly: 'false'` parameter
  - Ensure the existing menu fetching logic incorporates this parameter
  - Verify that items with `stock === 0` are now included in the component state
  - _Requirements: 1.1, 1.2_

- [ ]* 2.1 Write property test for rendering completeness
  - **Property 4: Out-of-Stock Items Displayed in Menu Grid**
  - **Validates: Requirements 1.2**

- [ ] 3. Create helper function for out-of-stock detection
  - Add `isOutOfStock` helper function that returns `item.stock === 0`
  - Place the helper near the top of the `MenuListingPage` component
  - Use TypeScript type guards to ensure type safety
  - _Requirements: 1.4, 3.1_

- [ ] 4. Implement out-of-stock banner component
  - [ ] 4.1 Create banner rendering logic in MenuListingPage
    - Add `renderOutOfStockBanner` function that returns JSX for the banner
    - Position banner at the top of the card with absolute positioning
    - Use high-contrast colors (red background, white text) for visibility
    - Ensure banner text reads "OUT OF STOCK" in uppercase
    - Make banner responsive to theme changes (light/dark mode)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 4.2 Integrate banner into menu item card rendering
    - Conditionally render banner when `isOutOfStock(item)` returns true
    - Ensure banner appears above the card image with proper z-index
    - Test that banner does not obscure essential item information
    - _Requirements: 1.4, 2.1_

- [ ]* 4.3 Write property test for banner presence and text
  - **Property 6: Out-of-Stock Banner Presence and Text**
  - **Validates: Requirements 1.4, 2.1, 2.2**

- [ ]* 4.4 Write property test for theme-aware styling
  - **Property 9: Theme-Aware Styling Adjustments**
  - **Validates: Requirements 3.5**

- [ ] 5. Apply visual styling to out-of-stock item cards
  - [ ] 5.1 Add opacity styling to card wrapper
    - Apply `opacity-60` class (0.6 opacity) to cards when `isOutOfStock(item)` is true
    - Use conditional className logic to toggle styling
    - Ensure styling maintains readability of item information
    - Test styling in both light and dark themes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 5.2 Verify consistent styling across all out-of-stock items
    - Ensure the same opacity value is applied to all out-of-stock cards
    - Test with multiple out-of-stock items in the menu grid
    - _Requirements: 3.3_

- [ ]* 5.3 Write property test for visual styling application
  - **Property 7: Out-of-Stock Visual Styling Applied**
  - **Validates: Requirements 3.1, 3.2**

- [ ]* 5.4 Write property test for styling consistency
  - **Property 8: Consistent Styling Across Out-of-Stock Items**
  - **Validates: Requirements 3.3**

- [ ]* 5.5 Write property test for card structure consistency
  - **Property 5: Out-of-Stock Items Have Consistent Card Structure**
  - **Validates: Requirements 1.3**

- [ ] 6. Disable add-to-cart functionality for out-of-stock items
  - [ ] 6.1 Add disabled attribute to add-to-cart button
    - Set `disabled={isOutOfStock(item)}` on the add-to-cart button
    - Apply visual styling to disabled button (reduced opacity, cursor: not-allowed)
    - Ensure disabled button styling is consistent with theme
    - _Requirements: 4.2, 4.3, 4.4_

  - [ ] 6.2 Verify cart addition is prevented
    - Test that clicking disabled button does not trigger cart actions
    - Ensure no API calls are made when disabled button is clicked
    - _Requirements: 4.1_

- [ ]* 6.3 Write property test for button disabled attribute
  - **Property 10: Add-to-Cart Button Disabled for Out-of-Stock Items**
  - **Validates: Requirements 4.2**

- [ ]* 6.4 Write property test for cart addition prevention
  - **Property 11: Cart Addition Prevented for Out-of-Stock Items**
  - **Validates: Requirements 4.1**

- [ ]* 6.5 Write property test for disabled button styling
  - **Property 12: Disabled Button Visual Styling**
  - **Validates: Requirements 4.3, 4.4**

- [ ] 7. Verify existing functionality is preserved
  - [ ] 7.1 Test that in-stock items are unaffected
    - Verify in-stock items (stock > 0) have no out-of-stock styling
    - Ensure add-to-cart button is enabled for in-stock items
    - Confirm no banner appears on in-stock items
    - _Requirements: 6.1_

  - [ ] 7.2 Test favorite functionality on out-of-stock items
    - Click favorite icon on out-of-stock items
    - Verify favorite state toggles correctly
    - _Requirements: 6.2_

  - [ ] 7.3 Test navigation to detail page on out-of-stock items
    - Click on out-of-stock item card
    - Verify navigation to item detail page occurs
    - _Requirements: 6.3_

  - [ ] 7.4 Test filtering with out-of-stock items
    - Apply category filters and verify out-of-stock items included
    - Toggle veg-only mode and verify out-of-stock items included
    - Test search functionality with out-of-stock items
    - _Requirements: 5.5, 6.4_

- [ ]* 7.5 Write property test for available items unaffected
  - **Property 13: Available Items Unaffected by Out-of-Stock Logic**
  - **Validates: Requirements 6.1**

- [ ]* 7.6 Write property test for favorite functionality preserved
  - **Property 14: Favorite Functionality Preserved for Out-of-Stock Items**
  - **Validates: Requirements 6.2**

- [ ]* 7.7 Write property test for navigation preserved
  - **Property 15: Navigation Preserved for Out-of-Stock Items**
  - **Validates: Requirements 6.3**

- [ ]* 7.8 Write property test for filtering includes out-of-stock
  - **Property 16: Filtering Includes Out-of-Stock Items**
  - **Validates: Requirements 5.5, 6.4**

- [ ] 8. Add error handling for edge cases
  - Handle missing `stock` field in API response (treat as available)
  - Handle invalid stock values (negative numbers treated as out-of-stock)
  - Add console warnings for debugging when stock field is missing
  - Test fallback behavior when API fails (maintain existing availableOnly=true behavior)
  - _Requirements: 1.1, 3.1, 4.2_

- [ ] 9. Checkpoint - Ensure all tests pass
  - Run all unit tests for MenuListingPage component
  - Run all property-based tests
  - Manually test the feature in the browser (light and dark themes)
  - Verify no regression in existing menu functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Final integration verification
  - Test complete user flow: browse menu, see out-of-stock items, attempt to add to cart
  - Verify visual indicators work across different screen sizes (responsive design)
  - Test with various menu data sets (all in-stock, all out-of-stock, mixed)
  - Confirm no console errors or warnings in browser
  - _Requirements: All_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- The backend API already supports the `availableOnly=false` parameter, so no backend code changes are needed
- Property-based tests should use fast-check library with minimum 100 iterations
- Each property test validates specific correctness properties from the design document
- Visual styling uses Tailwind CSS classes consistent with the existing codebase
- Theme handling leverages existing theme context in the application
- All implementation tasks build incrementally on previous steps
