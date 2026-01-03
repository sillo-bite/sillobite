# Frontend State and Data Management

**Version**: 1.0  
**Last Updated**: 2026-01-02

---

## Table of Contents

1. [Overview](#overview)
2. [React Context Providers](#react-context-providers)
3. [Global vs Local State](#global-vs-local-state)
4. [React Query Configuration](#react-query-configuration)
5. [Optimistic Updates](#optimistic-updates)
6. [Derived State Patterns](#derived-state-patterns)
7. [State Synchronization](#state-synchronization)
8. [State Transitions](#state-transitions)
9. [Appendices](#appendices)

---

## Overview

The system uses a **hybrid state management architecture**:

- **React Context**: Global application state (auth, cart, canteen selection, theme)
- **React Query (TanStack Query)**: Server state management with caching
- **localStorage**: Persistent state across sessions
- **Custom Events**: Cross-tab and intra-tab synchronization

### Key Principles

1. **Separation of Concerns**: Server state (React Query) vs UI state (Context/Local)
2. **Single Source of Truth**: Each data type has one authoritative source
3. **Optimistic UI**: Update UI immediately, revert on failure
4. **Stale-While-Revalidate**: Show cached data, fetch fresh in background
5. **Progressive Enhancement**: Work offline, sync when online

---

## React Context Providers

### 1. CartContext

**Purpose**: Manage shopping cart state with canteen isolation

**Storage**: `localStorage` with canteen-specific keys (`digital-canteen-cart-{canteenId}`)

**State Schema**:

```typescript
interface CartItem {
  id: string;                    // Menu item MongoDB ID
  name: string;
  price: number;
  quantity: number;
  isVegetarian: boolean;
  canteenId: string;             // Isolation key
  category?: string;
  description?: string;
  addedAt?: number;              // Timestamp for staleness tracking
  storeCounterId?: string;       // REQUIRED
  paymentCounterId?: string;     // REQUIRED
}

interface CartState {
  cart: CartItem[];
  currentCanteenId: string | null;
}
```

**State Transitions**:

```
INITIALIZATION:
  No canteenId → []
  Has canteenId → Load from localStorage(canteenId)

ADD_TO_CART:
  Same canteen → Merge with existing cart
  Different canteen → Load target canteen cart, then add
  Missing counter IDs → Throw error (hard failure)

CANTEEN_SWITCH:
  Current cart persisted to localStorage(oldCanteenId)
  New cart loaded from localStorage(newCanteenId)
  Cart state replaced (not merged)

LOGOUT:
  All canteen carts cleared from localStorage
  currentCanteenId = null
  cart = []

CROSS_TAB_SYNC:
  storage event → Parse cart for matching canteenId
  Update state only if canteenId matches
  Validate cart structure before applying

SAME_TAB_SYNC:
  Custom 'cartUpdated' event → Update state if different
  Prevent update loops with JSON comparison
```

**Validation Logic**:

```typescript
// From CartContext.tsx:54-59
const isValidCart = Array.isArray(parsedCart) && 
  parsedCart.every(item => 
    typeof item.id === 'string' && 
    item.id.length > 10 &&           // MongoDB ObjectId length check
    item.canteenId === canteenId     // Canteen isolation
  );

// Counter ID validation (from CartContext.tsx:217-225)
if (!item.storeCounterId || !item.paymentCounterId) {
  throw new Error(
    `Counter IDs are required for "${item.name}". ` +
    `Please refresh the page and add the item again.`
  );
}
```

**Key Operations**:

1. **addToCart**: 
   - Validates counter IDs (REQUIRED)
   - Handles canteen switching automatically
   - Merges quantity if item exists
   - Adds timestamp for staleness tracking

2. **Canteen Isolation**: 
   - Each canteen has separate cart storage
   - Switching canteens loads target cart
   - No cross-canteen contamination

3. **Cleanup on Logout**: 
   - Removes all `digital-canteen-cart-*` keys
   - Listens for `userAuthChange` event
   - Polls localStorage every 1s to detect logout

---

### 2. CanteenContext

**Purpose**: Manage available canteens and selected canteen with institution filtering

**State Schema**:

```typescript
interface CanteenState {
  selectedCanteen: Canteen | null;
  availableCanteens: Canteen[];      // Filtered by institution
  isLoading: boolean;
  error: string | null;
  userCollege?: string;
  isFiltered: boolean;               // Whether filtering is active
  // Lazy loading
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  totalCanteens: number;
}

interface Canteen {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  priority?: number;                 // Lower = higher priority
  // Institution associations
  collegeIds?: string[];
  organizationIds?: string[];
  restaurantId?: string;
  type?: 'college' | 'organization' | 'restaurant';
}
```

**State Transitions**:

```
INITIALIZATION:
  User loading → Wait
  No user → Empty canteens
  User authenticated → Determine institution filter
  
INSTITUTION_FILTER_DETERMINATION (Priority Order):
  1. selectedLocation (from LocationContext) → Use location filter
  2. User has restaurant context → Filter by restaurantId
  3. User has organization → Filter by organizationId
  4. User has college (no org) → Filter by collegeId
  5. Admin user → No filter (all canteens)
  6. No filter criteria → Empty canteens

CANTEEN_LOADING:
  Institution type determined → Fetch canteens (lazy load, 5 per page)
  Canteens loaded → Sort by priority (ascending), then name
  No canteens → selectedCanteen = null
  Has canteens && no selection → Auto-select highest priority canteen
  
MANUAL_SELECTION:
  User selects canteen → hasManuallySelected = true
  Manual selection preserved until:
    - Selected canteen becomes unavailable
    - User switches location
    - Institution filter changes

AUTO_SELECTION:
  Occurs when:
    - No canteen selected
    - Selected canteen not in available list
    - Manual selection flag is false
  Logic:
    - Select first active canteen (sorted by priority)
    - If no active, select first canteen

LOCATION_CHANGE:
  'locationChanged' event → Clear selectedCanteen
  Reset hasManuallySelected flag
  Trigger new canteen fetch

CANTEEN_SWITCH:
  New canteen selected → Initialize cart for new canteen
  hasManuallySelected = true
```

**Institution Filter Logic**:

```typescript
// From CanteenContext.tsx:136-151
const institutionType = 
  selectedLocationType ? selectedLocationType :              // Priority 1
  shouldUseCollegeFilter ? 'college' :                      // Priority 2
  shouldUseOrganizationFilter ? 'organization' :            // Priority 3
  shouldUseRestaurantFilter ? 'restaurant' :                // Priority 4
  null;                                                      // No filter

const institutionId = 
  selectedLocationId ? selectedLocationId :                  // Priority 1
  shouldUseCollegeFilter ? userCollege :                    // Priority 2
  shouldUseOrganizationFilter ? 
    (userOrganization || (collegeIsOrganization ? userCollege : null)) : // Priority 3
  shouldUseRestaurantFilter ? 
    (hasRestaurantContext ? user?.restaurantId : 
     serverTempUser?.restaurantId || tempUserData?.restaurantId) : // Priority 4
  null;
```

**Organization Detection** (from CanteenContext.tsx:119):

```typescript
// Check if college field contains organization ID
const collegeIsOrganization = userCollege && userCollege.startsWith('org-');
const hasRealCollege = userCollege && !collegeIsOrganization;
const hasRealOrganization = userOrganization || collegeIsOrganization;

// Prioritize organization over college
const shouldUseOrganizationFilter = 
  effectiveIsAuthenticated && 
  !isAdmin && 
  !shouldUseRestaurantFilter && 
  hasRealOrganization;
```

**Lazy Loading**:

```typescript
// From CanteenContext.tsx:196-208
const { 
  data: canteensLazyData, 
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage
} = useCanteensLazyLoad(
  institutionType,
  institutionId,
  5,  // Load 5 canteens per page
  shouldFetchCanteens && !!institutionType && !!institutionId
);

// Flatten pages
const lazyLoadedCanteens = canteensLazyData?.pages?.flatMap(
  page => page.canteens
) || [];
```

---

### 3. LocationContext

**Purpose**: Manage user's selected location (college/organization/restaurant)

**Storage**: `localStorage` + User database field

**State Schema**:

```typescript
interface LocationState {
  selectedLocationType: 'college' | 'organization' | 'restaurant' | null;
  selectedLocationId: string | null;
  selectedLocationName: string | null;
  isLoading: boolean;
}
```

**State Transitions**:

```
INITIALIZATION:
  Check user.selectedLocationType/selectedLocationId in database
  If found → Fetch location name from API
  Save to localStorage for offline access
  If not found → Load from localStorage

SET_LOCATION:
  Update localStorage immediately
  Update context state
  Call PUT /api/users/{id}/location to persist
  Dispatch 'locationChanged' event

CLEAR_LOCATION:
  Remove from localStorage
  Clear context state
  Dispatch 'locationChanged' event
  
DOWNSTREAM_EFFECTS:
  'locationChanged' event triggers:
    - CanteenContext: Clear selectedCanteen, reset filter
    - Other contexts: Re-evaluate permissions
```

**Persistence Strategy**:

```typescript
// From LocationContext.tsx:26-79
// 1. Try database first (source of truth)
if (user?.selectedLocationType && user?.selectedLocationId) {
  const response = await fetch(`/api/locations/${user.selectedLocationType}`);
  const location = data.locations?.find(loc => loc.id === user.selectedLocationId);
  if (location) {
    // Use database location
    localStorage.setItem('selectedLocation', JSON.stringify({
      type, id, name
    }));
    return;
  }
}

// 2. Fallback to localStorage
const stored = localStorage.getItem('selectedLocation');
if (stored) {
  const location = JSON.parse(stored);
  // Use localStorage location
}
```

---

### 4. NotificationContext

**Purpose**: Merge server notifications with real-time WebSocket notifications

**State Schema**:

```typescript
interface NotificationState {
  notifications: Notification[];           // Merged server + local
  unreadCount: number;
  localNotifications: Notification[];      // Real-time only
}

interface Notification {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  type: 'order' | 'promotion' | 'system' | 'general';
  read: boolean;
  priority: 'low' | 'medium' | 'high';
  actionUrl?: string;
  canteenId?: string;
  userId?: string;
}
```

**State Transitions**:

```
INITIALIZATION:
  Fetch server notifications (React Query)
  Initialize localNotifications = []

WEBSOCKET_EVENT (new_order):
  Create notification { type: 'order', priority: 'high', read: false }
  Add to localNotifications
  allNotifications = merge(serverNotifications, localNotifications)

WEBSOCKET_EVENT (order_status_changed):
  Create notification with status-specific message
  Priority = 'high'
  Add to localNotifications

MARK_AS_READ (Optimistic):
  1. Update local notification immediately (read = true)
  2. Call API PUT /api/notifications/{id}
  3. Invalidate React Query cache
  4. UI shows immediate feedback

MARK_ALL_AS_READ (Optimistic):
  1. Update all local notifications (read = true)
  2. Call API for all unread notifications in parallel
  3. Invalidate React Query cache

CLEANUP:
  Every 5 minutes: Remove notifications older than 1 hour
  Keep max 50 local notifications (FIFO)
```

**Merge Logic** (from NotificationContext.tsx:57-63):

```typescript
const allNotifications = useMemo(() => {
  const serverIds = new Set(serverNotifications.map(n => n.id));
  const localOnly = localNotifications.filter(n => !serverIds.has(n.id));
  return [...serverNotifications, ...localOnly].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}, [serverNotifications, localNotifications]);
```

---

### 5. ThemeContext

**Purpose**: Manage application theme (light/dark/system)

**Storage**: `localStorage` (`digital-canteen-theme`)

**State Schema**:

```typescript
type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';  // Actual applied theme
}
```

**State Transitions**:

```
INITIALIZATION:
  Load from localStorage OR default 'system'
  Calculate resolvedTheme:
    theme = 'system' → Check window.matchMedia('(prefers-color-scheme: dark)')
    theme = 'light'/'dark' → Use directly

SET_THEME:
  Update state
  Save to localStorage
  Apply theme class to document.documentElement

SYSTEM_THEME_CHANGE:
  If theme = 'system':
    Listen to mediaQuery.addEventListener('change')
    Recalculate resolvedTheme
    Re-apply theme class

APPLY_THEME:
  Remove existing classes: root.classList.remove('light', 'dark')
  Add new class: root.classList.add(resolvedTheme)
```

---

### 6. useAuth (Custom Hook)

**Purpose**: Manage authentication state with database validation

**Storage**: `localStorage` (`user` or `temp_user_session`)

**State Schema**:

```typescript
interface User {
  id: string | number;
  name: string;
  email: string;
  role: string;
  college?: string;
  organization?: string;
  isTemporary?: boolean;         // Temporary user flag
  sessionId?: string;            // Server session ID (temp users)
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isValidating: boolean;
}
```

**State Transitions**:

```
INITIALIZATION (with validation cache):
  Check validationCache first (15 min TTL)
  If cached && fresh → Use cached user
  If validationLock exists → Wait for result
  
  Load from localStorage:
    1. Check temp_user_session first
    2. Fall back to 'user'
  
  For temporary/guest users:
    Skip database validation
    Use localStorage data directly
    
  For regular users:
    Call GET /api/users/{id}/validate
    Success && userExists && !blocked → Set user
    User blocked (role.startsWith('blocked_')) → Clear auth, redirect to /login
    User not found (404) → Clear auth
    Network error → Keep localStorage session (fail-safe)

VALIDATION_CACHE:
  Key: user.id.toString()
  Value: { user: User | null, timestamp: number }
  TTL: 15 minutes
  Purpose: Prevent repeated API calls on every hook mount

VALIDATION_LOCK:
  Map<userId, Promise<User | null>>
  Prevent concurrent validations for same user
  Other components wait for in-flight validation

LOGIN:
  Set user state
  Call setPWAAuth(userData) → localStorage.setItem('user')
  Mark onboarding_completed = true
  Dispatch 'userAuthChange' event

LOGOUT:
  Temporary user:
    Call POST /api/temp-session/{sessionId}/end
    Clear temp_user_session from localStorage
  Regular user:
    Sign out from Google OAuth
    Clear all caches (CacheManager.clearLogoutCaches())
  Clear user state
  Clear PWA auth
  Dispatch 'userAuthChange' event
  Force reload to /login or / (temp users)

CROSS_TAB_SYNC:
  storage event for 'user' or 'temp_user_session':
    Reload user from localStorage
    Revalidate if necessary

ACTIVITY_TRACKING:
  Update last_activity timestamp
  Extend session_timestamp
```

**Database Validation** (from useAuth.ts:120-175):

```typescript
const validationPromise = (async () => {
  try {
    const response = await fetch(`/api/users/${user.id}/validate`, {
      cache: 'default',
      headers: { 'Cache-Control': 'max-age=60' }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.userExists) {
        // Check if user is blocked
        if (data.user.role && data.user.role.startsWith('blocked_')) {
          clearPWAAuth();
          window.location.href = '/login';
          return null;
        }
        validationCache.set(cacheKey, { user: data.user, timestamp: now });
        return data.user;
      } else {
        // User doesn't exist
        clearPWAAuth();
        return null;
      }
    } else if (response.status === 404) {
      clearPWAAuth();
      return null;
    } else {
      // Network error - keep session
      validationCache.set(cacheKey, { user: authState.user, timestamp: now });
      return authState.user;
    }
  } catch (error) {
    // Network error - keep session
    validationCache.set(cacheKey, { user: authState.user, timestamp: now });
    return authState.user;
  }
})();

validationLocks.set(cacheKey, validationPromise);
```

---

## Global vs Local State

### Global State (React Context)

| Context | Scope | Persistence | Sync Method |
|---------|-------|-------------|-------------|
| **CartContext** | Shopping cart per canteen | localStorage | storage event + custom event |
| **CanteenContext** | Available canteens, selected canteen | None (derived from API) | React Query invalidation |
| **LocationContext** | User's location selection | localStorage + DB | storage event |
| **NotificationContext** | Notifications | None (merged server + local) | WebSocket + React Query |
| **ThemeContext** | UI theme preference | localStorage | None (UI only) |
| **useAuth** | Authentication state | localStorage | storage event |

### Local State (useState/useRef)

| Component/Hook | State | Persistence | Purpose |
|----------------|-------|-------------|---------|
| **usePaymentCallback** | Payment processing status | None | One-time payment flow |
| **useStockValidation** | Stock validation result | None | Derived from API |
| **useWebSocket** | Connection status | None | Real-time communication |
| **usePaginatedOrders** | Current page | Component mount | Pagination |
| **Form Components** | Input values | None | User input |

### Server State (React Query)

| Query Key | Data Type | Source | Stale Time |
|-----------|-----------|--------|------------|
| `['/api/menu', canteenId]` | Menu items | MongoDB | 30s |
| `['/api/categories', canteenId]` | Categories | MongoDB | 30s |
| `['/api/orders/paginated', ...]` | Orders | MongoDB | 2min |
| `['/api/orders/active/paginated', ...]` | Active orders | MongoDB | 30s |
| `['home-data', canteenId, userId]` | Home screen data | MongoDB (batch) | 30s |
| `['/api/notifications']` | Notifications | MongoDB | No polling (WebSocket) |
| `['/api/stock/status', itemIds]` | Stock status | MongoDB | 30s |
| `['user']` | User from cache | localStorage | Never stale |
| `['/api/system-settings/canteens']` | All canteens | MongoDB | 5min |

---

## React Query Configuration

### Global Configuration (queryClient)

```typescript
// From lib/queryClient.ts (inferred)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,                    // Default: immediately stale
      gcTime: 1000 * 60 * 5,           // 5 minutes cache time
      retry: 3,                        // Retry failed queries 3 times
      retryDelay: (attemptIndex) => 
        Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,      // Default: refetch on focus
      refetchOnReconnect: true,        // Refetch on network reconnect
      refetchOnMount: true,            // Refetch on component mount
    },
    mutations: {
      retry: 0,                        // Don't retry mutations
    },
  },
});
```

### Query Key Patterns

```typescript
// Entity-based keys
['/api/menu', canteenId]
['/api/categories', canteenId]
['/api/orders/paginated', page, limit, canteenId]

// Search/filter keys
['/api/orders/search', query, page, limit]
['/api/stock/status', itemIds]  // itemIds = comma-separated sorted IDs

// User-specific keys
['user']                                              // User from localStorage
['/api/notifications']                                // User's notifications
['/api/orders/active/paginated', page, limit, canteenId, customerId]

// Settings keys
['/api/system-settings/canteens']
['/api/system-settings/canteens/by-college', collegeId]
['/api/system-settings/maintenance-status/{userId}']

// Home data (batch endpoint)
['home-data', canteenId, userId]

// Institution keys
['institutions', institutionType]
['departments', institutionType, institutionId]
['registration-formats', institutionType, institutionId, departmentCode, role]
```

### Stale Time Configuration

| Query | Stale Time | Rationale |
|-------|------------|-----------|
| User data | Never | Updated via logout only |
| Menu items | 30s | Menu changes infrequent, WebSocket for real-time |
| Categories | 30s | Categories rarely change |
| Active orders | 30s | Balance between freshness and performance |
| Paginated orders | 2min | Historical data, doesn't change often |
| Home data | 30s | Batch query, expensive to refetch |
| Stock status | 30s | Real-time via WebSocket, this is fallback |
| Canteens | 5min | Canteen list rarely changes |
| Maintenance status | 5min | Maintenance mode infrequent |
| Notifications | No polling | WebSocket for real-time, query on demand |

### Cache Time (gcTime) Configuration

| Query | GC Time | Rationale |
|-------|---------|-----------|
| Default | 5min | Balance memory vs network |
| Paginated orders | 10min | User may navigate back to previous pages |
| Active orders | 5min | Shorter retention for current data |
| Home data | 5min | Batch query, keep cached |
| Institutions | 5min | Static data, keep longer |

### Refetch Policies

```typescript
// Disable refetch for static/expensive queries
// From useHomeData.ts:70-75
useQuery({
  queryKey: ['home-data', canteenId, userId],
  staleTime: 30 * 1000,
  gcTime: 5 * 60 * 1000,
  refetchOnWindowFocus: false,   // WebSocket handles updates
  refetchOnMount: false,          // Use cache if fresh
  refetchOnReconnect: false,      // Don't refetch on reconnect
});

// Disable polling for notification queries
// From useNotifications.ts:42
useQuery({
  queryKey: ['/api/notifications'],
  refetchInterval: false,         // No polling - use WebSocket
});

// Enable refetch for critical data
// From usePaginatedOrders.ts:27-31
useQuery({
  queryKey: ['/api/orders/paginated', page, limit, canteenId],
  staleTime: 2 * 60 * 1000,
  refetchInterval: false,         // Use WebSocket
  refetchOnWindowFocus: false,
  refetchOnMount: false,          // Don't refetch if fresh
});
```

### Debouncing Strategies

```typescript
// Stock validation (from useStockValidation.ts:53-67)
const [debouncedItemIds, setDebouncedItemIds] = useState(itemIds);

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedItemIds(itemIds);
  }, 300); // Debounce by 300ms
  
  return () => clearTimeout(timer);
}, [itemIds]);

useQuery({
  queryKey: ['/api/stock/status', debouncedItemIds.join(',')],
  // ... query triggers only after 300ms of stable itemIds
});

// Search queries (from useOrderSearch.ts:14-21)
const [debouncedQuery, setDebouncedQuery] = useState(query);

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedQuery(query);
  }, 300);
  
  return () => clearTimeout(timer);
}, [query]);
```

---

## Optimistic Updates

### Pattern 1: Immediate UI Update + Invalidation

**Use Case**: Mark notification as read

```typescript
// From NotificationContext.tsx:159-165
const markAsRead = useCallback((id: string) => {
  // 1. Update local notification immediately (optimistic)
  updateNotification(id, { read: true });
  
  // 2. Call API
  serverMarkAsRead(id);  // Internally invalidates query
}, [updateNotification, serverMarkAsRead]);

// Server mutation (from useNotifications.ts:63-82)
const markAsReadMutation = useMutation({
  mutationFn: async (notificationId: string) => {
    const response = await fetch(`/api/notifications/${notificationId}`, {
      method: 'PUT',
      body: JSON.stringify({ read: true }),
    });
    return response.json();
  },
  onSuccess: () => {
    // Invalidate triggers refetch
    queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
  },
});
```

**State Transition**:

```
User clicks "Mark as read"
  ↓
Update localNotifications (id → read: true)
  ↓ (immediate UI update)
Call PUT /api/notifications/{id}
  ↓ (async)
onSuccess → invalidateQueries(['/api/notifications'])
  ↓
React Query refetches notifications
  ↓
Server data overwrites local data (reconciliation)
```

### Pattern 2: Invalidation Only (No Optimistic Update)

**Use Case**: CRUD operations on canteens, menu items, categories

```typescript
// From useCanteens.ts:123-135
export function useUpdateCanteen() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, ...canteenData }: UpdateCanteenRequest) => 
      apiRequest(`/api/system-settings/canteens/${id}`, {
        method: 'PUT',
        body: JSON.stringify(canteenData),
      }),
    onSuccess: () => {
      // No optimistic update - just invalidate
      queryClient.invalidateQueries({ queryKey: ['/api/system-settings/canteens'] });
    },
  });
}
```

**State Transition**:

```
User submits form
  ↓
Show loading state (isLoading = true)
  ↓
Call PUT /api/system-settings/canteens/{id}
  ↓
onSuccess → invalidateQueries(['/api/system-settings/canteens'])
  ↓
React Query refetches canteens
  ↓
UI updates with new data
```

### Pattern 3: Cart Optimistic Update

**Use Case**: Add item to cart

```typescript
// From CartContext.tsx:203-313
const addToCart = useCallback((item, quantity) => {
  // Optimistic: Update cart state immediately
  setCart(currentCart => {
    // If switching canteens, load target cart first
    if (currentCanteenId !== item.canteenId) {
      const loadedCart = loadCartFromLocalStorage(item.canteenId);
      return addItemToCart(loadedCart, item, quantity);
    } else {
      return addItemToCart(currentCart, item, quantity);
    }
  });
  
  // No API call - cart is local-only
  // Save to localStorage in useEffect
}, [currentCanteenId]);

// Persistence in useEffect (CartContext.tsx:97-107)
useEffect(() => {
  if (currentCanteenId && cart.length >= 0) {
    saveCartForCanteen(currentCanteenId, cart);
    
    // Dispatch custom event for same-tab sync
    window.dispatchEvent(new CustomEvent('cartUpdated', { 
      detail: { canteenId: currentCanteenId, cart } 
    }));
  }
}, [cart, currentCanteenId]);
```

**State Transition**:

```
User clicks "Add to Cart"
  ↓
Update cart state immediately (optimistic)
  ↓ (instant UI feedback)
useEffect triggers
  ↓
Save to localStorage
  ↓
Dispatch 'cartUpdated' event
  ↓
Other components/tabs sync
```

### Pattern 4: Payment Success Optimistic Clear

**Use Case**: Clear cart after payment success

```typescript
// From usePaymentCallback.ts:185-216
if (paymentStatus === 'success') {
  // 1. Clear cart immediately (optimistic)
  clearCart();
  
  // 2. Direct localStorage clear (double-check)
  if (canteenId) {
    const canteenCartKey = `digital-canteen-cart-${canteenId}`;
    localStorage.removeItem(canteenCartKey);
  }
  
  // 3. Clear legacy key
  localStorage.removeItem('digital-canteen-cart');
  
  // 4. Invalidate orders queries
  queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
  queryClient.invalidateQueries({ queryKey: ['/api/orders/active/paginated'] });
  
  // 5. Redirect to order status (with 100ms delay for persistence)
  setTimeout(() => {
    window.location.href = `/order-status/${orderNumber}?from=payment`;
  }, 100);
}
```

**State Transition**:

```
Payment callback receives success
  ↓
clearCart() → cart = [], currentCanteenId = null
  ↓ (immediate UI update)
localStorage.removeItem(canteen cart keys)
  ↓
invalidateQueries (orders)
  ↓
Wait 100ms (ensure localStorage persisted)
  ↓
window.location.href = order status page
  ↓
Full page reload (clean state)
```

---

## Derived State Patterns

### 1. Loading States

```typescript
// Combined loading (from useDataSync.ts:88)
const isLoading = 
  categoriesQuery.isLoading || 
  menuItemsQuery.isLoading || 
  ordersQuery.isLoading;

// Derived from multiple sources
const isLoading = 
  userLoading ||               // User fetch
  locationLoading ||           // Location fetch
  canteensLoading;             // Canteens fetch
```

### 2. Empty States

```typescript
// From CanteenContext.tsx:280-283
if (canteens.length === 0 && selectedCanteen) {
  // No canteens after filtering → clear selection
  setSelectedCanteen(null);
  hasManuallySelected.current = false;
}
```

### 3. Error States

```typescript
// Combined error (from useDataSync.ts:91)
const hasError = 
  categoriesQuery.error || 
  menuItemsQuery.error || 
  ordersQuery.error;

// Error recovery (from useAuth.ts:162-167)
if (response.status === 404) {
  // User doesn't exist → clear auth
  clearPWAAuth();
  return null;
} else {
  // Network error → keep session (fail-safe)
  return authState.user;
}
```

### 4. Stale States

```typescript
// Timestamp-based staleness (from CartContext.tsx:12)
interface CartItem {
  addedAt?: number;  // Timestamp for staleness tracking
}

// Validation cache staleness (from useAuth.ts:26, 95)
const VALIDATION_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

const cached = validationCache.get(cacheKey);
const now = Date.now();

if (cached && (now - cached.timestamp) < VALIDATION_CACHE_DURATION) {
  // Use cached result
} else {
  // Revalidate
}
```

### 5. Computed Values

```typescript
// From useDataSync.ts:77-85
const stats = {
  totalCategories: categories.length,
  totalMenuItems: menuItems.length,
  availableItems: menuItems.filter(item => item.available).length,
  totalOrders: totalOrdersCount || orders.length,
  pendingOrders: orders.filter(order => order.status === 'preparing').length,
  completedOrders: orders.filter(order => order.status === 'completed').length,
  totalRevenue: orders.reduce((sum, order) => sum + (order.amount || 0), 0),
};

// From useNotifications.ts:186-188
const unreadCount = notifications.filter(n => !n.read).length;
const unreadNotifications = notifications.filter(n => !n.read);
const readNotifications = notifications.filter(n => n.read);
```

### 6. Validation States

```typescript
// From useStockValidation.ts:93-160
useEffect(() => {
  if (error) {
    setValidationResult({
      isValid: false,
      errors: [{ message: 'Unable to verify stock availability' }],
      items: []
    });
    return;
  }
  
  if (!stockData || cartItems.length === 0) {
    setValidationResult({ isValid: true, errors: [], items: [] });
    return;
  }
  
  const errors: StockValidationResult['errors'] = [];
  
  cartItems.forEach(cartItem => {
    const stockItem = stockData.find(item => item.id === cartItem.id);
    
    if (!stockItem) {
      errors.push({
        itemId: cartItem.id,
        itemName: cartItem.name,
        requested: cartItem.quantity,
        available: 0,
        message: `${cartItem.name} is no longer available`
      });
    } else if (!stockItem.available) {
      errors.push({
        itemId: cartItem.id,
        itemName: cartItem.name,
        requested: cartItem.quantity,
        available: stockItem.stock,
        message: `${cartItem.name} is currently out of stock`
      });
    } else if (stockItem.stock < cartItem.quantity) {
      errors.push({
        itemId: cartItem.id,
        itemName: cartItem.name,
        requested: cartItem.quantity,
        available: stockItem.stock,
        message: `${cartItem.name}: Only ${stockItem.stock} available`
      });
    }
  });
  
  setValidationResult({
    isValid: errors.length === 0,
    errors,
    items: stockData
  });
}, [cartItems, stockData, error]);
```

---

## State Synchronization

### Cross-Tab Synchronization (storage event)

```typescript
// From CartContext.tsx:110-163
useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    // Only handle cart-related storage changes
    if (!e.key || !e.key.startsWith(CART_STORAGE_PREFIX)) {
      return;
    }
    
    // Extract canteen ID from storage key
    const canteenId = e.key.replace(CART_STORAGE_PREFIX, '');
    
    // Only sync if it's for the current canteen
    if (canteenId === currentCanteenId && e.newValue) {
      try {
        const parsedCart = JSON.parse(e.newValue);
        const isValidCart = /* validation logic */;
        
        if (isValidCart) {
          setCart(parsedCart);
        }
      } catch (error) {
        console.error('Error parsing cart from storage event:', error);
      }
    }
  };
  
  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}, [currentCanteenId, cart]);
```

### Same-Tab Synchronization (custom event)

```typescript
// From CartContext.tsx:103-106 (Emit)
window.dispatchEvent(new CustomEvent('cartUpdated', { 
  detail: { canteenId: currentCanteenId, cart } 
}));

// From CartContext.tsx:145-155 (Listen)
const handleCartUpdate = (e: CustomEvent) => {
  if (e.detail?.canteenId === currentCanteenId) {
    // Only update if cart is different
    const currentCartStr = JSON.stringify(cart);
    const newCartStr = JSON.stringify(e.detail.cart);
    if (currentCartStr !== newCartStr) {
      setCart(e.detail.cart);
    }
  }
};

window.addEventListener('cartUpdated', handleCartUpdate as EventListener);
```

### Auth Synchronization

```typescript
// From useAuth.ts:196-213
useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    if ((e.key === 'user' || e.key === 'temp_user_session') && !isValidating) {
      loadUserFromStorage();  // Reload user
    }
  };
  
  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}, []);

// From useDataSync.ts:154-182
useEffect(() => {
  const handleStorageChange = () => {
    try {
      // Check temp user first
      const tempUserSession = localStorage.getItem('temp_user_session');
      if (tempUserSession) {
        setUser({ ...JSON.parse(tempUserSession), isTemporary: true });
        return;
      }
      
      // Fall back to regular user
      const newUser = JSON.parse(localStorage.getItem('user') || 'null');
      setUser(newUser);
    } catch {
      setUser(null);
    }
  };
  
  // Listen for storage events (from other tabs)
  window.addEventListener('storage', handleStorageChange);
  
  // Also listen for custom events (from same tab)
  window.addEventListener('userAuthChange', handleStorageChange);
  
  return () => {
    window.removeEventListener('storage', handleStorageChange);
    window.removeEventListener('userAuthChange', handleStorageChange);
  };
}, []);
```

### Location Change Synchronization

```typescript
// From CanteenContext.tsx:185-193
useEffect(() => {
  const handleLocationChange = () => {
    setSelectedCanteen(null);
    hasManuallySelected.current = false;
  };
  
  window.addEventListener('locationChanged', handleLocationChange);
  return () => window.removeEventListener('locationChanged', handleLocationChange);
}, []);

// Emitted from LocationContext.tsx:98, 110
window.dispatchEvent(new CustomEvent('locationChanged'));
```

### Logout Synchronization

```typescript
// From CartContext.tsx:166-201
useEffect(() => {
  const handleLogout = () => {
    // Clear all canteen-specific carts
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CART_STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    localStorage.removeItem(CART_STORAGE_KEY);
    setCart([]);
    setCurrentCanteenId(null);
  };
  
  window.addEventListener('userAuthChange', handleLogout);
  
  // Also poll for logout
  const checkUserLogout = () => {
    const user = localStorage.getItem('user');
    const tempUser = localStorage.getItem('temp_user_session');
    if (!user && !tempUser && cart.length > 0) {
      handleLogout();
    }
  };
  
  const interval = setInterval(checkUserLogout, 1000);
  
  return () => {
    window.removeEventListener('userAuthChange', handleLogout);
    clearInterval(interval);
  };
}, [cart]);
```

---

## State Transitions

### Cart State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                        CART STATES                          │
└─────────────────────────────────────────────────────────────┘

[EMPTY] ──addToCart(item)──> [HAS_ITEMS]
                             │
                             ├──addToCart(different canteen)──> [CANTEEN_SWITCH]
                             │                                  │
                             │                                  └──load cart──> [HAS_ITEMS]
                             │
                             ├──removeFromCart(last item)──────> [EMPTY]
                             │
                             ├──clearCart()────────────────────> [EMPTY]
                             │
                             ├──payment success────────────────> [CLEARING]
                             │                                  │
                             │                                  └──cleared──> [EMPTY]
                             │
                             └──logout──────────────────────────> [EMPTY]

[HAS_ITEMS] ──quantity change──> [HAS_ITEMS]
            ──stock validation──> [VALID | INVALID]
```

### Authentication State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION STATES                     │
└─────────────────────────────────────────────────────────────┘

[LOADING] ──localStorage has user──> [VALIDATING]
                                     │
                                     ├──temp/guest user──────────> [AUTHENTICATED]
                                     │
                                     ├──cached & fresh───────────> [AUTHENTICATED]
                                     │
                                     ├──validation success───────> [AUTHENTICATED]
                                     │
                                     ├──user blocked─────────────> [UNAUTHENTICATED]
                                     │                             │
                                     │                             └──redirect /login
                                     │
                                     ├──user not found───────────> [UNAUTHENTICATED]
                                     │
                                     └──network error────────────> [AUTHENTICATED]
                                                                   (fail-safe)

[AUTHENTICATED] ──logout──────────────────────> [LOGGING_OUT]
                                                │
                                                ├──temp user:
                                                │  ├── POST /api/temp-session/{id}/end
                                                │  └── clearServerTempUserSession()
                                                │
                                                ├──regular user:
                                                │  ├── signOutGoogle()
                                                │  └── CacheManager.clearLogoutCaches()
                                                │
                                                └──complete──> [UNAUTHENTICATED]
                                                              │
                                                              └──force reload

[UNAUTHENTICATED] ──login(userData)──> [AUTHENTICATED]
```

### Canteen Selection State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                 CANTEEN SELECTION STATES                     │
└─────────────────────────────────────────────────────────────┘

[NO_SELECTION] ──user authenticated──> [DETERMINING_FILTER]
                                       │
                                       ├──location selected────────> [FILTERED_BY_LOCATION]
                                       ├──restaurant context───────> [FILTERED_BY_RESTAURANT]
                                       ├──organization context─────> [FILTERED_BY_ORGANIZATION]
                                       ├──college context──────────> [FILTERED_BY_COLLEGE]
                                       └──admin user───────────────> [UNFILTERED]

[FILTERED_*] ──canteens loaded──> [LOADING_CANTEENS]
                                  │
                                  ├──has canteens && no selection──> [AUTO_SELECTING]
                                  │                                  │
                                  │                                  └──select highest priority──> [SELECTED]
                                  │
                                  ├──has canteens && has selection──> [SELECTED]
                                  │
                                  └──no canteens─────────────────────> [NO_SELECTION]

[SELECTED] ──user selects canteen──────> [SELECTED] (manual)
           ──location changes──────────> [NO_SELECTION]
           ──selected canteen inactive──> [AUTO_SELECTING]
           ──canteen switch────────────> [SELECTED] (new canteen)
                                         │
                                         └──initializeCartForCanteen()
```

### Payment Callback State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                  PAYMENT CALLBACK STATES                     │
└─────────────────────────────────────────────────────────────┘

[CHECKING] ──extract transaction ID──> [VERIFYING]
                                       │
                                       ├──Razorpay callback──────> [VERIFYING_RAZORPAY]
                                       │                          │
                                       │                          ├──success──> [CHECKING_STATUS]
                                       │                          └──failed───> [FAILED]
                                       │
                                       └──no Razorpay params─────> [CHECKING_STATUS]

[CHECKING_STATUS] ──GET /api/payments/status/{id}──> [PROCESSING_STATUS]
                                                     │
                                                     ├──status = 'success'──────> [SUCCESS]
                                                     │                           │
                                                     │                           ├── clearCart()
                                                     │                           ├── invalidateQueries()
                                                     │                           ├── clear localStorage
                                                     │                           └── redirect order status
                                                     │
                                                     ├──status = 'failed'───────> [FAILED]
                                                     │                           │
                                                     │                           └── show error
                                                     │
                                                     └──status = 'pending'──────> [PENDING]
                                                                                 │
                                                                                 └──retry (max 5)──> [CHECKING_STATUS]

[SUCCESS] ──100ms delay──> [REDIRECTING]
                          │
                          └──window.location.href = /order-status/{orderNumber}

[FAILED] ──user action──> [RETRY | RETURN_TO_CART]

[PENDING] ──retry timeout (3s)──> [CHECKING_STATUS]
```

### Stock Validation State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                 STOCK VALIDATION STATES                      │
└─────────────────────────────────────────────────────────────┘

[IDLE] ──cart items change──> [DEBOUNCING]
                              │
                              └──300ms elapsed──> [VALIDATING]
                                                 │
                                                 ├──API success──────> [CHECKING_STOCK]
                                                 │                    │
                                                 │                    ├──all available──> [VALID]
                                                 │                    └──some unavailable──> [INVALID]
                                                 │
                                                 └──API error────────> [ERROR]

[VALID] ──cart items change──> [DEBOUNCING]
        ──WebSocket orderUpdate──> [DEBOUNCING] (refetch)

[INVALID] ──user removes unavailable items──> [DEBOUNCING]
          ──WebSocket orderUpdate──> [DEBOUNCING] (refetch)

[ERROR] ──user clicks retry──> [VALIDATING]
```

---

## Appendices

### Appendix A: Query Key Structure Reference

```typescript
// Flat keys (no parameters)
['user']                           // User from localStorage
['/api/notifications']              // User's notifications

// Entity keys (single parameter)
['/api/menu', canteenId]
['/api/categories', canteenId]

// Paginated keys (multiple parameters)
['/api/orders/paginated', page, limit, canteenId]
['/api/orders/active/paginated', page, limit, canteenId, customerId]

// Search/filter keys (multiple parameters)
['/api/orders/search', debouncedQuery, page, limit]
['/api/stock/status', sortedItemIds.join(',')]

// Nested entity keys
['/api/system-settings/canteens']
['/api/system-settings/canteens/by-college', collegeId]
['/api/system-settings/canteens/by-organization', organizationId]

// Batch endpoint keys
['home-data', canteenId, userId]

// Institution hierarchy keys
['institutions', institutionType]
['departments', institutionType, institutionId]
['registration-formats', institutionType, institutionId, departmentCode, role]
```

### Appendix B: localStorage Keys Reference

```typescript
// Authentication
'user'                                    // Regular user session
'temp_user_session'                       // Temporary user session
'session_timestamp'                       // Session expiry tracking
'last_activity'                           // Activity tracking

// Cart (per-canteen isolation)
'digital-canteen-cart-{canteenId}'        // Cart for specific canteen
'digital-canteen-cart'                    // Legacy cart key (deprecated)

// Preferences
'digital-canteen-theme'                   // Theme preference
'digital-canteen-favorites'               // Favorite items
'selectedCanteenId'                       // Selected canteen (deprecated)
'selectedLocation'                        // Selected location (college/org/restaurant)

// Onboarding
'onboarding_completed'                    // Onboarding completion flag

// Payment
'payment_transaction_id'                  // Current payment transaction
'payment_order_id'                        // Order being paid for
'payment_checkout_session'                // Checkout session ID
'payment_pending_order'                   // Pending order data
```

### Appendix C: Custom Event Reference

```typescript
// User authentication
'userAuthChange'
  - Emitted when: login, logout, user data change
  - Listeners: useAuth, useDataSync, CartContext
  - Purpose: Sync auth state across hooks

// Cart updates
'cartUpdated'
  - Emitted when: cart state changes
  - Payload: { canteenId: string, cart: CartItem[] }
  - Listeners: CartContext (same-tab sync)
  - Purpose: Sync cart changes within same tab

// Location changes
'locationChanged'
  - Emitted when: location selected or cleared
  - Listeners: CanteenContext
  - Purpose: Trigger canteen list refresh
```

### Appendix D: Invalidation Patterns

```typescript
// After mutation success
queryClient.invalidateQueries({ queryKey: ['/api/canteens'] });
queryClient.invalidateQueries({ queryKey: ['/api/menu', canteenId] });

// After payment success
queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
queryClient.invalidateQueries({ queryKey: ['/api/orders/active/paginated'] });

// After notification read
queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });

// Pattern: Invalidate all related queries
queryClient.invalidateQueries({ 
  predicate: (query) => query.queryKey[0] === '/api/orders' 
});
```

### Appendix E: Validation Cache Structure

```typescript
// User validation cache (from useAuth.ts:25-26)
const validationCache = new Map<string, { 
  user: User | null; 
  timestamp: number 
}>();
const VALIDATION_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// Validation lock (prevent concurrent validations)
const validationLocks = new Map<string, Promise<User | null>>();

// Usage
const cacheKey = user.id.toString();
const cached = validationCache.get(cacheKey);
const now = Date.now();

if (cached && (now - cached.timestamp) < VALIDATION_CACHE_DURATION) {
  // Use cached validation result
  return cached.user;
}

// Check if validation already in progress
const existingValidation = validationLocks.get(cacheKey);
if (existingValidation) {
  // Wait for existing validation
  return await existingValidation;
}

// Start new validation
const validationPromise = validateUser(user.id);
validationLocks.set(cacheKey, validationPromise);
const result = await validationPromise;
validationCache.set(cacheKey, { user: result, timestamp: now });
validationLocks.delete(cacheKey);
```

---

**End of Document**
