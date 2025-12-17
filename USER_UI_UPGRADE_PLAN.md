# User UI Upgrade Plan

## Priority 1: Critical Issues (Must Fix)

### 1. ReorderPage.tsx
**Current Issues:**
- Uses hardcoded mock data
- Uses `/placeholder.png` for all images
- Not connected to real order API
- Price formatting uses `$` instead of `₹`

**Upgrade Tasks:**
- [ ] Fetch real order data from `/api/orders/:orderId`
- [ ] Fetch actual menu item images from order items
- [ ] Replace placeholder images with real images or proper fallback
- [ ] Fix currency formatting to use `₹` (Indian Rupees)
- [ ] Connect "Add to Cart" to actual cart functionality
- [ ] Add loading states while fetching order data
- [ ] Add error handling for failed API calls
- [ ] Handle cases where order items are no longer available

**Files to Modify:**
- `client/src/components/orders/ReorderPage.tsx`

---

### 2. RateReviewPage.tsx
**Current Issues:**
- Uses hardcoded mock data
- Uses `/placeholder.png` for all images
- Photo upload button doesn't work
- Not connected to review submission API
- Missing form validation

**Upgrade Tasks:**
- [ ] Fetch real order data from `/api/orders/:orderId`
- [ ] Fetch actual menu item images from order items
- [ ] Implement photo upload functionality (camera/gallery)
- [ ] Connect to review submission API endpoint
- [ ] Add form validation (require ratings before submit)
- [ ] Add loading states during submission
- [ ] Add success/error feedback after submission
- [ ] Handle missing images with proper fallbacks

**Files to Modify:**
- `client/src/components/profile/RateReviewPage.tsx`

---

## Priority 2: Feature Completion

### 3. HomeScreen.tsx - Quick Picks
**Current Issues:**
- Shows "Quick picks coming soon" placeholder
- Quick picks section not functional

**Upgrade Tasks:**
- [ ] Remove placeholder message
- [ ] Display actual quick pick items from API
- [ ] Add proper loading state
- [ ] Add "View All" button linking to ViewAllQuickPicksPage
- [ ] Handle empty state when no quick picks available

**Files to Modify:**
- `client/src/components/pages/HomeScreen.tsx`

---

## Priority 3: UX Improvements

### 4. Empty States Enhancement
**Components Affected:**
- CartPage
- FavoritesPage
- OrdersPage
- HomeScreen

**Upgrade Tasks:**
- [ ] Add custom illustrations/icons for each empty state
- [ ] Improve messaging to be more engaging
- [ ] Add clear call-to-action buttons
- [ ] Add helpful tips or suggestions
- [ ] Ensure consistent styling across all empty states

**Files to Modify:**
- `client/src/components/pages/CartPage.tsx`
- `client/src/components/pages/FavoritesPage.tsx`
- `client/src/components/orders/OrdersPage.tsx`
- `client/src/components/pages/HomeScreen.tsx`

---

### 5. Image Handling Consistency
**Components Affected:**
- MenuItemCard
- DishDetailPage
- OrderStatusPage
- ReorderPage
- RateReviewPage

**Upgrade Tasks:**
- [ ] Create a unified image component with consistent fallbacks
- [ ] Replace all `/placeholder.png` references
- [ ] Add proper error handling for broken images
- [ ] Add loading skeletons for images
- [ ] Use LazyImage component consistently across all pages
- [ ] Add proper alt text for accessibility

**Files to Modify:**
- `client/src/components/menu/MenuItemCard.tsx`
- `client/src/components/menu/DishDetailPage.tsx`
- `client/src/components/orders/OrderStatusPage.tsx`
- `client/src/components/orders/ReorderPage.tsx`
- `client/src/components/profile/RateReviewPage.tsx`

---

### 6. CurrentOrderBottomSheet.tsx Enhancements
**Current Status:** Functional but could be improved

**Potential Improvements:**
- [ ] Add swipe-to-dismiss gesture
- [ ] Add smooth animations for appearance/disappearance
- [ ] Add haptic feedback on interactions
- [ ] Improve visual hierarchy
- [ ] Add order status indicators (pending, preparing, ready)

**Files to Modify:**
- `client/src/components/orders/CurrentOrderBottomSheet.tsx`

---

## Priority 4: Polish & Refinement

### 7. Loading States
**Upgrade Tasks:**
- [ ] Ensure all API calls have proper loading states
- [ ] Use consistent skeleton loaders
- [ ] Add loading indicators for image loading
- [ ] Improve loading state messaging

### 8. Error Handling
**Upgrade Tasks:**
- [ ] Add user-friendly error messages
- [ ] Add retry mechanisms for failed API calls
- [ ] Handle network errors gracefully
- [ ] Add error boundaries where needed

### 9. Accessibility
**Upgrade Tasks:**
- [ ] Ensure all images have proper alt text
- [ ] Add ARIA labels where needed
- [ ] Improve keyboard navigation
- [ ] Ensure proper color contrast
- [ ] Add screen reader support

---

## Implementation Order

1. **Week 1:** Fix ReorderPage and RateReviewPage (Priority 1)
2. **Week 2:** Implement Quick Picks functionality (Priority 2)
3. **Week 3:** Enhance empty states and image handling (Priority 3)
4. **Week 4:** Polish and refinement (Priority 4)

---

## Notes

- All placeholder images should be replaced with proper fallback UI (emoji icons or styled divs)
- Currency should be consistently `₹` (Indian Rupees) throughout
- All API calls should have proper error handling
- Loading states should be consistent across all components
- Empty states should be engaging and actionable

