# 01 - ROLES AND PERMISSIONS

## DOCUMENT METADATA
- **Extraction Date**: 2025-12-31
- **Source**: Code-derived from User model, ProtectedRoute, routes.ts, websocket.ts
- **Backend Validation**: PostgreSQL User.role field + validation schemas
- **Protocol**: Exhaustive permission boundary analysis

---

## 1. ROLE DEFINITIONS

### 1.1 Complete Role Enumeration

**Source**: `prisma/schema.prisma` (User model) + `shared/schema.ts` + `client/src/hooks/useDataSync.ts`

```typescript
// PostgreSQL User model - role field (String, not enum)
role: String  // Stored as free-form string, validated by application logic

// Validation Schema - profileCompletionSchema (shared/schema.ts:596)
role: z.enum(["student", "staff", "employee", "guest", "contractor", "visitor"])

// Frontend Role Detection - useAuthSync (client/src/hooks/useDataSync.ts:201-210)
isAdmin: user?.role === 'admin' || user?.role === 'super_admin'
isSuperAdmin: user?.role === 'super_admin'
isCanteenOwner: user?.role === 'canteen_owner'
isStudent: user?.role === 'student'
isStaff: user?.role === 'staff'
isEmployee: user?.role === 'employee'
isGuest: user?.role === 'guest'
isContractor: user?.role === 'contractor'
isVisitor: user?.role === 'visitor'
hasRole: (role: string) => user?.role === role  // Generic role checker
```

### 1.2 All Roles Identified

| Role ID | Description | Auth Type | Unique Field | Profile Fields Required |
|---------|-------------|-----------|--------------|-------------------------|
| `super_admin` | System super administrator (only one allowed) | Google OAuth or Email/Password | None | name, email, phoneNumber |
| `admin` | System administrator | Google OAuth or Email/Password | None | name, email, phoneNumber |
| `canteen_owner` | Canteen/restaurant owner | Google OAuth or Email/Password | Must match SystemSettings.canteens[].canteenOwnerEmail | name, email, phoneNumber |
| `student` | Student user | Google OAuth or Email/Password | registerNumber (unique) | name, email, phoneNumber, registerNumber, department, passingOutYear |
| `staff` | Staff user | Google OAuth or Email/Password | staffId (unique) | name, email, phoneNumber, staffId |
| `employee` | Employee user | Google OAuth or Email/Password | registerNumber (unique) | name, email, phoneNumber, registerNumber (optional) |
| `guest` | Guest user | Google OAuth or Email/Password | registerNumber (unique) or organizationId | name, email, phoneNumber, staffId OR organizationId |
| `contractor` | Contractor user | Google OAuth or Email/Password | registerNumber (unique) | name, email, phoneNumber, registerNumber (optional) |
| `visitor` | Visitor user | Google OAuth or Email/Password | registerNumber (unique) | name, email, phoneNumber, registerNumber (optional) |
| `delivery_person` | Delivery person (separate table) | Email/Password ONLY | deliveryPersonId (unique), email (optional) | name, phoneNumber, canteenId (mapped from DeliveryPerson table) |

**Notes**:
- Role stored as `String` in PostgreSQL (not enum) - allows flexibility but no database-level constraint
- `delivery_person` role created when DeliveryPerson record exists AND user account is created with email
- Temp users get `role: 'guest'` automatically (client-side only, not persisted)

---

## 2. ROLE HIERARCHY

### 2.1 Permission Levels (Derived from Code)

```
┌────────────────────────────────────────────────────────────┐
│                      SUPER ADMIN                           │
│  (Only ONE allowed system-wide)                            │
│  - Full system access                                      │
│  - Cannot be deleted or demoted                            │
│  - Can create/modify other admins                          │
└─────────────────────────┬──────────────────────────────────┘
                          │
        ┌─────────────────┴─────────────────┐
        │            ADMIN                  │
        │  - User management                 │
        │  - System settings                 │
        │  - Canteen management              │
        │  - Analytics and reports           │
        │  - Cannot delete super_admin       │
        └─────────────────┬─────────────────┘
                          │
        ┌─────────────────┴─────────────────┐
        │       CANTEEN OWNER               │
        │  - Manage own canteen              │
        │  - POS operations                  │
        │  - Counter management              │
        │  - Menu management                 │
        │  - Order fulfillment               │
        │  - Analytics (own canteen)         │
        └───────────────────────────────────┘
        
┌────────────────────────────────────────────────────────────┐
│                  DELIVERY PERSON                           │
│  - View assigned orders                                    │
│  - Mark orders as delivered                                │
│  - WebSocket room: delivery_person_<email>                 │
│  - Isolated from main app (separate portal)                │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  REGULAR USERS (student, staff, employee, guest, etc.)     │
│  - Browse menu                                             │
│  - Place orders                                            │
│  - Track orders                                            │
│  - View order history                                      │
│  - Rate and review (if authenticated)                      │
└────────────────────────────────────────────────────────────┘
```

### 2.2 Hierarchy Rules (Enforced in Backend)

**Source**: `server/routes.ts` lines 329-338, 480-489, 597-601

1. **Super Admin Protection**:
   ```typescript
   // Only ONE super_admin allowed (routes.ts:330-337)
   if (validatedData.role === 'super_admin') {
     const existingSuperAdmin = await storage.getUserByRole('super_admin');
     if (existingSuperAdmin) {
       return res.status(403).json({ 
         message: "Only one super admin is allowed in the system." 
       });
     }
   }
   
   // Cannot change super_admin role (routes.ts:481-488)
   if (existingUser.role === 'super_admin' && req.body.role !== 'super_admin') {
     return res.status(403).json({ 
       message: "Cannot change super admin role. There must always be at least one super admin." 
     });
   }
   
   // Cannot delete super_admin (routes.ts:597-600)
   if (existingUser.role === 'super_admin') {
     return res.status(403).json({ 
       message: "Super admin cannot be deleted." 
     });
   }
   ```

2. **No Explicit Hierarchy** (Flat Permission Model):
   - Admins cannot delete or modify super_admin
   - No role inheritance (each role has discrete permissions)
   - Permission checks are role-based, not hierarchical

---

## 3. PERMISSION BOUNDARIES (BACKEND ENFORCEMENT)

### 3.1 API Route Protection

**Mechanism**: No middleware - permission checks embedded in route handlers

**Pattern Analysis** (from `server/routes.ts` - 9730 lines):
- **No authentication middleware** - routes are publicly accessible
- **No role-based middleware** - no `requireAuth()` or `requireRole()` decorators
- **Manual permission checks** - implemented per-route as needed
- **Client-side enforcement primary** - ProtectedRoute component handles most access control

### 3.2 Backend Permission Enforcement Locations

**User Management** (`server/routes.ts`):
```typescript
// Super admin creation restriction (line 330-337)
POST /api/users
  - Prevents creating multiple super_admin users
  - No role check (publicly accessible endpoint)

// Super admin role change prevention (line 481-488)
PUT /api/users/:id
  - Prevents changing super_admin role
  - No role check (publicly accessible endpoint)

// Super admin deletion prevention (line 597-600)
DELETE /api/users/:id
  - Prevents deleting super_admin
  - No role check (publicly accessible endpoint)
```

**Observations**:
- Backend routes do NOT enforce role-based access at API level
- Super admin protection only prevents modification/deletion
- No checks like "only admin can call POST /api/users"
- Security relies on client-side ProtectedRoute + obfuscation

### 3.3 Database-Level Constraints

**PostgreSQL (Prisma)**:
```sql
-- User table constraints
- email: UNIQUE
- registerNumber: UNIQUE (nullable)
- staffId: UNIQUE (nullable)
- role: String (no enum constraint)

-- DeliveryPerson table constraints
- deliveryPersonId: UNIQUE
- email: UNIQUE (nullable)
```

**MongoDB (Mongoose)**:
```typescript
// No role-based indexes
// No collection-level permissions
// All queries filtered by application logic
```

---

## 4. ROLE-BASED UI LOGIC (FRONTEND)

### 4.1 ProtectedRoute Component

**Source**: `client/src/components/auth/ProtectedRoute.tsx`

```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;       // Single role requirement
  requiredRoles?: string[];    // Multiple role requirement (OR logic)
  requireAuth?: boolean;       // Default: true
}

// Permission check logic (lines 23-40)
useEffect(() => {
  // 1. Authentication check
  if (requireAuth && !isAuthenticated) {
    setLocation("/login");
    return;
  }

  // 2. Single role check
  if (requiredRole && !hasRole(requiredRole)) {
    setLocation("/login");  // Redirect to login (not access denied)
    return;
  }

  // 3. Multiple roles check (OR logic)
  if (requiredRoles.length > 0 && !requiredRoles.some(role => hasRole(role))) {
    setLocation("/login");  // Redirect to login
    return;
  }
}, [isAuthenticated, user, requiredRole, requiredRoles, requireAuth, hasRole, setLocation]);

// Access denied UI (lines 43-77)
// - Shows "Authentication Required" if not authenticated
// - Shows "Access Denied" if role mismatch
// - Provides "Go to Login" button
```

### 4.2 Role Detection Hook

**Source**: `client/src/hooks/useDataSync.ts` lines 135-212

```typescript
export function useAuthSync() {
  // User source priority:
  // 1. temp_user_session (localStorage) → force role: 'guest'
  // 2. user (localStorage) → read role from stored user

  return {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
    isSuperAdmin: user?.role === 'super_admin',
    isCanteenOwner: user?.role === 'canteen_owner',
    isStudent: user?.role === 'student',
    isStaff: user?.role === 'staff',
    isEmployee: user?.role === 'employee',
    isGuest: user?.role === 'guest',
    isContractor: user?.role === 'contractor',
    isVisitor: user?.role === 'visitor',
    hasRole: (role: string) => user?.role === role,  // Exact match
  };
}
```

**Key Behaviors**:
- Temp user sessions always get `role: 'guest'` (line 142, 160)
- Role stored in `localStorage` (persists across reloads)
- `isAdmin` check includes both `admin` and `super_admin` (line 201)
- `hasRole()` uses exact string match (line 210)

### 4.3 Role-Based Routing

**Source**: `client/src/App.tsx` (565 lines)

**Route Protection Patterns**:

```typescript
// 1. Any authenticated user (requireAuth=true)
<ProtectedRoute requireAuth={true}>
  <AppPage />              // Main app (menu browsing)
  <CheckoutPage />         // Checkout
  <OrderDetailPage />      // Order tracking
  <NotificationsPage />    // Push notifications
  <SearchPage />           // Menu search
</ProtectedRoute>

// 2. Canteen Owner only (requiredRole="canteen_owner")
<ProtectedRoute requiredRole="canteen_owner">
  <CanteenOwnerDashboard />           // /canteen-owner
  <CanteenOrderDetailPage />          // /canteen-order-detail/:orderId
  <CounterInterfaceWrapper />         // /canteen-owner-dashboard/:canteenId/counter/:counterId
</ProtectedRoute>

// 3. Admin or Super Admin (requiredRoles=["admin", "super_admin"])
<ProtectedRoute requiredRoles={["admin", "super_admin"]}>
  <AdminDashboard />                  // /admin
  <AdminUserManagementPage />         // /admin/user-management
  <AdminAnalyticsPage />              // /admin/analytics
  <AdminCollegeManagementPage />      // /admin/college-management
  <AdminCanteenManagement />          // /admin/canteen-management
  <AdminPaymentManagementPage />      // /admin/payment-management
  // ... 20+ more admin routes
</ProtectedRoute>

// 4. Delivery Person only (requiredRole="delivery_person")
<ProtectedRoute requiredRole="delivery_person">
  <DeliveryPersonPortal />            // /delivery-portal
</ProtectedRoute>

// 5. Public routes (no ProtectedRoute wrapper)
/                                      // Landing page
/splashscreen                          // PWA splash
/onboarding                            // Onboarding flow
/login                                 // Login page
/privacy-policy                        // Legal pages
/terms-conditions
/payment-callback                      // Payment redirect
/order-status/:orderId                 // Public order tracking (barcode)
```

### 4.4 Role-Based Redirects (Post-Login)

**Source**: `client/src/components/auth/LoginScreen.tsx` lines 393-414

```typescript
// Redirect based on role after successful login
if (userData.role === 'super_admin' || userData.role === 'admin') {
  setLocation("/admin");
} else if (userData.role === 'canteen_owner' || userData.role === 'canteen-owner') {
  // Fetch canteen by owner email
  const canteenResponse = await fetch(`/api/system-settings/canteens/by-owner/${userData.email}`);
  if (canteenResponse.ok) {
    const canteenData = await canteenResponse.json();
    setLocation(`/canteen-owner-dashboard/${canteenData.canteen.id}/counters`);
  } else {
    setLocation('/login?error=no_canteen');
  }
} else if (userData.role === 'delivery_person') {
  setLocation("/delivery-portal");
} else {
  setLocation("/app");  // All other roles → main app
}
```

**Delivery Person Redirect Guard** (`client/src/components/pages/AppPage.tsx` lines 74-81):
```typescript
// Prevent delivery persons from accessing main app
useEffect(() => {
  if (user && user.role === 'delivery_person') {
    console.log('🚚 Delivery person detected in AppPage, redirecting to delivery portal');
    setLocation('/delivery-portal');
    return;
  }
}, [user, setLocation]);
```

---

## 5. WEBSOCKET ROLE-BASED ACCESS

### 5.1 Socket Room Architecture

**Source**: `server/websocket.ts` (613 lines)

**Room Types**:
```typescript
private canteenRooms: Map<string, Set<string>>         // canteenId → socketIds
private counterRooms: Map<string, Set<string>>         // counterId → socketIds
private deliveryPersonRooms: Map<string, Set<string>>  // email → socketIds
```

### 5.2 Room Join Events (No Role Enforcement)

```typescript
// 1. Join Canteen Rooms (lines 53-104)
socket.on('joinCanteenRooms', (data: { canteenIds: string[], userId?: string, userRole?: string }) => {
  // No role validation
  // Any connected socket can join any canteen room
  // Client sends canteenIds, userId, userRole (self-reported)
  
  const roomName = `canteen_${canteenId}`;
  socket.join(roomName);
  this.canteenRooms.get(canteenId)!.add(socket.id);
});

// 2. Join Counter Room (lines 140-181)
socket.on('joinCounterRoom', (data: { counterId: string, canteenId: string }) => {
  // No role validation
  // Any connected socket can join any counter room
  // Used by canteen owners and admins for POS interfaces
  
  const roomName = `counter_${counterId}`;
  socket.join(roomName);
  this.counterRooms.get(counterId)!.add(socket.id);
});

// 3. Join Delivery Person Room (lines 226-254)
socket.on('joinDeliveryPersonRoom', (data: { email: string }) => {
  // No role validation
  // Any connected socket can join any delivery person room
  // Self-reported email (not verified)
  
  const roomName = `delivery_person_${email}`;
  socket.join(roomName);
  this.deliveryPersonRooms.get(email)!.add(socket.id);
  
  // Set userRole in tracking (line 246)
  userInfo.userRole = 'delivery_person';  // Self-reported, not validated
});
```

### 5.3 Broadcast Patterns by Role

```typescript
// New order → Broadcast to canteen room (lines 325-343)
broadcastNewOrder(canteenId: string, orderData: any): void {
  const roomName = `canteen_${canteenId}`;
  this.io.to(roomName).emit('orderUpdate', {
    type: 'new_order',
    data: orderData
  });
}
// Received by:
// - Canteen owners monitoring canteen
// - Admins viewing canteen dashboard
// - Anyone who joined the canteen room (no enforcement)

// Counter update → Broadcast to counter room (lines 491-527)
broadcastToCounter(counterId: string, eventType: string, data: any): void {
  const roomName = `counter_${counterId}`;
  this.io.to(roomName).emit('orderUpdate', {
    type: eventType,
    data: data
  });
}
// Received by:
// - Canteen owners at POS counter
// - Admins viewing counter interface
// - Anyone who joined the counter room (no enforcement)

// Delivery assignment → Broadcast to delivery person room (lines 537-558)
broadcastToDeliveryPerson(email: string, message: any): void {
  const roomName = `delivery_person_${email}`;
  this.io.to(roomName).emit('deliveryAssignment', message);
}
// Received by:
// - Delivery person with matching email
// - Anyone who joined the delivery person room with that email (no enforcement)
```

### 5.4 Security Observations

**Critical Issues**:
1. **No authentication on WebSocket connections** - any client can connect
2. **No role verification on room join** - client self-reports role
3. **No authorization checks** - any socket can join any room
4. **Email-based delivery rooms** - no validation that socket user matches email
5. **Trust client-provided data** - userId, userRole, email all client-controlled

**Mitigation** (Client-Side Only):
- ProtectedRoute prevents unauthorized users from accessing pages that join rooms
- Client code only joins rooms for authorized canteens/counters
- Security by obscurity (client doesn't know other canteen IDs)

---

## 6. EDGE CASES

### 6.1 Multi-Role Users (NOT SUPPORTED)

**Observation**: User model has single `role` field (String)

**Evidence**:
```typescript
// prisma/schema.prisma
role: String  // Single value only

// No role array or role junction table
// No mechanism to assign multiple roles to one user
```

**Edge Case Handling**:
- User can only have ONE role at a time
- Changing role overwrites previous role
- No concept of "user is both admin and canteen_owner"

### 6.2 Invalid Role Values

**Validation Points**:
```typescript
// 1. Profile completion schema (shared/schema.ts:596) - STRICT
role: z.enum(["student", "staff", "employee", "guest", "contractor", "visitor"])
// Only allows these 6 roles during profile setup
// Does NOT include: admin, super_admin, canteen_owner, delivery_person

// 2. User creation schema (shared/schema.ts:650) - PERMISSIVE
role: z.string()
// Allows any string value
// No validation against allowed role list

// 3. Database schema (prisma/schema.prisma) - NO CONSTRAINT
role: String
// No enum constraint, no check constraint
// Can store any arbitrary string
```

**Edge Case**: User with `role: "invalid_role"` can be created
- Stored in database successfully
- `hasRole("invalid_role")` returns true
- All role checks (`isAdmin`, `isStudent`, etc.) return false
- ProtectedRoute blocks access to all protected routes
- User effectively locked out of app

### 6.3 Super Admin Edge Cases

**Scenario 1: No Super Admin Exists**
```typescript
// routes.ts:330-337 - Allows creation of first super_admin
if (validatedData.role === 'super_admin') {
  const existingSuperAdmin = await storage.getUserByRole('super_admin');
  if (existingSuperAdmin) {
    // Block creation
  } else {
    // Allow creation (first super admin)
  }
}
```

**Scenario 2: Super Admin Account Deletion Attempted**
```typescript
// routes.ts:597-601 - Blocked
if (existingUser.role === 'super_admin') {
  return res.status(403).json({ 
    message: "Super admin cannot be deleted." 
  });
}
```

**Scenario 3: Super Admin Role Change Attempted**
```typescript
// routes.ts:481-488 - Blocked
if (existingUser.role === 'super_admin' && req.body.role !== 'super_admin') {
  return res.status(403).json({ 
    message: "Cannot change super admin role." 
  });
}
```

**Scenario 4: Super Admin Demotes Self**
- Edge case NOT handled
- Super admin can call `PUT /api/users/:id` with own ID
- Validation blocks role change from super_admin
- BUT: No validation prevents setting own role to null or empty string
- Potential for system lockout if last super admin demotes self

### 6.4 Canteen Owner Without Canteen

**Setup**:
```typescript
// User created with role: 'canteen_owner'
// But no matching entry in SystemSettings.canteens[].canteenOwnerEmail
```

**Login Behavior** (`client/src/components/auth/LoginScreen.tsx:398-408`):
```typescript
const canteenResponse = await fetch(`/api/system-settings/canteens/by-owner/${userData.email}`);
if (canteenResponse.ok) {
  const canteenData = await canteenResponse.json();
  setLocation(`/canteen-owner-dashboard/${canteenData.canteen.id}/counters`);
} else {
  setLocation('/login?error=no_canteen');  // Redirect to login with error
}
```

**Result**: Canteen owner locked out, cannot access app

### 6.5 Delivery Person Edge Cases

**Scenario 1: Delivery Person Without User Account**
```typescript
// DeliveryPerson record exists in PostgreSQL
// But no User account with matching email and role='delivery_person'
// Result: Cannot log in (no credentials)
```

**Scenario 2: User with role='delivery_person' But No DeliveryPerson Record**
```typescript
// User account exists with role='delivery_person'
// But no DeliveryPerson record in PostgreSQL
// Login succeeds, redirected to /delivery-portal
// DeliveryPersonPortal component queries: GET /api/delivery-persons/by-email/${user.email}
// Returns 404, shows "Delivery Person Not Found" error
```

**Source**: `client/src/components/delivery/DeliveryPersonPortal.tsx` lines 70-81

**Scenario 3: Delivery Person Accesses Main App**
```typescript
// Redirect guard in AppPage (client/src/components/pages/AppPage.tsx:74-81)
useEffect(() => {
  if (user && user.role === 'delivery_person') {
    setLocation('/delivery-portal');  // Force redirect
    return;
  }
}, [user, setLocation]);
```

**Result**: Delivery person cannot access main app, forced to delivery portal

### 6.6 Temp User Sessions

**Mechanism** (`client/src/hooks/useDataSync.ts` lines 139-142):
```typescript
const tempUserSession = localStorage.getItem('temp_user_session');
if (tempUserSession) {
  const parsed = JSON.parse(tempUserSession);
  return { ...parsed, isTemporary: true, role: 'guest' };
}
```

**Behavior**:
- Temp sessions always get `role: 'guest'`
- Stored in `localStorage` (key: `temp_user_session`)
- Not persisted to database
- Used for guest checkout flows

**Edge Case**: Temp user tries to access admin routes
- `hasRole('admin')` returns false (role is 'guest')
- ProtectedRoute blocks access
- Redirected to login

---

## 7. PERMISSION MAPPING TABLES

### 7.1 Role → UI Routes

| Role | Allowed Routes | Blocked Routes | Default Landing |
|------|---------------|----------------|-----------------|
| `super_admin` | /admin/*, /app, /checkout, /orders, /profile, /notifications, /search, /feedback, /reviews, /barcode-scanner | /delivery-portal, /canteen-owner* | /admin |
| `admin` | /admin/*, /app, /checkout, /orders, /profile, /notifications, /search, /feedback, /reviews, /barcode-scanner | /delivery-portal, /canteen-owner* | /admin |
| `canteen_owner` | /canteen-owner*, /canteen-order-detail/:orderId, /barcode-scanner | /admin/*, /delivery-portal | /canteen-owner-dashboard/:canteenId/counters |
| `delivery_person` | /delivery-portal | /app, /admin/*, /canteen-owner*, /checkout, /orders, /profile | /delivery-portal |
| `student` | /app, /checkout, /orders, /profile, /notifications, /search, /feedback, /reviews, /quick-picks, /dish/:dishId, /order-detail/:orderId, /rate-review | /admin/*, /canteen-owner*, /delivery-portal | /app |
| `staff` | /app, /checkout, /orders, /profile, /notifications, /search, /feedback, /reviews, /quick-picks, /dish/:dishId, /order-detail/:orderId, /rate-review | /admin/*, /canteen-owner*, /delivery-portal | /app |
| `employee` | /app, /checkout, /orders, /profile, /notifications, /search, /feedback, /reviews, /quick-picks, /dish/:dishId, /order-detail/:orderId, /rate-review | /admin/*, /canteen-owner*, /delivery-portal | /app |
| `guest` | /app, /checkout, /orders, /profile, /notifications, /search, /feedback, /reviews, /quick-picks, /dish/:dishId, /order-detail/:orderId, /rate-review | /admin/*, /canteen-owner*, /delivery-portal | /app |
| `contractor` | /app, /checkout, /orders, /profile, /notifications, /search, /feedback, /reviews, /quick-picks, /dish/:dishId, /order-detail/:orderId, /rate-review | /admin/*, /canteen-owner*, /delivery-portal | /app |
| `visitor` | /app, /checkout, /orders, /profile, /notifications, /search, /feedback, /reviews, /quick-picks, /dish/:dishId, /order-detail/:orderId, /rate-review | /admin/*, /canteen-owner*, /delivery-portal | /app |
| (unauthenticated) | /, /splashscreen, /onboarding, /login, /privacy-policy, /terms-conditions, /payment-callback, /order-status/:orderId, /help-support, /about, /table/:restaurantId/:tableNumber/:hash | ALL protected routes | / or /login |

**Notes**:
- `*` denotes wildcard (all sub-routes)
- Regular users (student, staff, employee, guest, contractor, visitor) have identical permissions
- Admin routes protected with `requiredRoles={["admin", "super_admin"]}` (OR logic)

### 7.2 Role → API Endpoints

| Role | Endpoint Pattern | Access Level | Enforcement Location |
|------|-----------------|--------------|---------------------|
| ALL | GET /api/health, /api/status, /api/server-info | Public | None (no auth) |
| ALL | POST /api/users | Public | Backend (super_admin limit only) |
| ALL | GET /api/users/:id, /api/users/by-email/:email | Public | None |
| ALL | PUT /api/users/:id, DELETE /api/users/:id | Public | Backend (super_admin protection only) |
| ALL | GET /api/categories, /api/menu | Public | None |
| ALL | POST /api/orders | Public (but needs user data) | None |
| ALL | GET /api/orders, /api/orders/:id | Public | None |
| ALL | POST /api/razorpay/create-order, /api/razorpay/verify-payment | Public | None |
| ALL | GET /api/system-settings | Public | None |
| `admin`, `super_admin` | POST /api/categories, PUT /api/categories/:id, DELETE /api/categories/:id | Expected (not enforced) | None |
| `admin`, `super_admin` | POST /api/menu, PUT /api/menu/:id, DELETE /api/menu/:id | Expected (not enforced) | None |
| `admin`, `super_admin` | PUT /api/system-settings/* | Expected (not enforced) | None |
| `canteen_owner` | GET /api/orders/canteen/:canteenId | Expected (not enforced) | None |
| `canteen_owner` | PATCH /api/orders/:id/status | Expected (not enforced) | None |
| `canteen_owner` | GET /api/canteens/:canteenId/charges, GET /api/canteens/:canteenId/settings | Expected (not enforced) | None |
| `delivery_person` | GET /api/delivery-persons/by-email/:email | Expected (not enforced) | None |
| `delivery_person` | GET /api/orders/delivery-person/:deliveryPersonId | Expected (not enforced) | None |

**Critical Finding**: NO API endpoint has role-based access control enforced at backend level

**Security Model**:
- Client-side ProtectedRoute prevents UI access to protected pages
- Protected pages don't render API call UI for unauthorized roles
- Backend relies on client not knowing about restricted endpoints
- Any HTTP client can call any API endpoint (tested via curl/Postman)

### 7.3 Role → WebSocket Events

| Role | Socket Events (Emit) | Socket Events (Receive) | Room Join Pattern |
|------|---------------------|------------------------|-------------------|
| `admin`, `super_admin` | joinCanteenRooms(canteenIds), joinCounterRoom(counterId) | orderUpdate (new_order, order_status_changed, order_updated), banner_updated, menu_updated | canteen_* (any), counter_* (any) |
| `canteen_owner` | joinCanteenRooms([ownCanteenId]), joinCounterRoom(counterId) | orderUpdate (new_order, order_status_changed, order_updated) | canteen_<ownCanteenId>, counter_* (own canteen) |
| `delivery_person` | joinDeliveryPersonRoom(email) | deliveryAssignment | delivery_person_<email> |
| Regular users | joinCanteenRooms(canteenIds) | orderUpdate (order_status_changed for own orders) | canteen_* (any, but typically own college) |
| (all) | ping | pong | N/A |

**Room Join Authorization**: NONE
- Any connected socket can join any room
- Client self-reports userId, userRole, email (not validated)
- No backend verification of user identity or permissions

**Event Authorization**: NONE
- All clients in a room receive all events for that room
- No filtering based on user role or order ownership
- Broadcast is indiscriminate (all room members get same message)

### 7.4 Role → Database Access

**PostgreSQL (Prisma)**:
| Role | Table | Operations | Enforcement |
|------|-------|------------|-------------|
| ALL | users | SELECT (by id, email, registerNumber, staffId) | None (API level) |
| `admin`, `super_admin` | users | INSERT, UPDATE, DELETE | Backend (super_admin protection only) |
| ALL | delivery_persons | SELECT (by id, email, deliveryPersonId) | None |
| `admin`, `super_admin` | delivery_persons | INSERT, UPDATE, DELETE | Expected (not enforced) |

**MongoDB (Mongoose)**:
| Role | Collection | Operations | Enforcement |
|------|-----------|------------|-------------|
| ALL | orders | SELECT (by customerId, canteenId, orderId) | None (query parameter) |
| ALL | orders | INSERT (create order) | None |
| `canteen_owner` | orders | UPDATE (status, itemStatusByCounter) | Expected (not enforced) |
| ALL | menuitems | SELECT (by canteenId, categoryId) | None |
| `admin`, `super_admin`, `canteen_owner` | menuitems | INSERT, UPDATE, DELETE | Expected (not enforced) |
| ALL | categories | SELECT (by canteenId) | None |
| `admin`, `super_admin`, `canteen_owner` | categories | INSERT, UPDATE, DELETE | Expected (not enforced) |
| ALL | payments | SELECT (by orderId, merchantTransactionId) | None |
| ALL | payments | INSERT (create payment) | None (payment gateway) |
| `admin`, `super_admin` | systemsettings | SELECT, UPDATE | Expected (not enforced) |

**Critical Finding**: NO database-level row-level security (RLS) or collection-level permissions

---

## 8. SECURITY ANALYSIS

### 8.1 Vulnerability Summary

| Layer | Issue | Severity | Exploitability |
|-------|-------|----------|----------------|
| API | No authentication on any endpoint | CRITICAL | Trivial (curl) |
| API | No role-based authorization checks | CRITICAL | Trivial (curl) |
| API | Super admin protection only | HIGH | Moderate (race condition on first super admin) |
| WebSocket | No authentication on connections | CRITICAL | Trivial (Socket.IO client) |
| WebSocket | No room join authorization | CRITICAL | Trivial (joinCanteenRooms with any ID) |
| WebSocket | Self-reported user data | CRITICAL | Trivial (send fake userId/userRole) |
| Frontend | ProtectedRoute only defense | HIGH | Moderate (client can modify React code) |
| Database | No row-level security | HIGH | Requires API access (already compromised) |

### 8.2 Security Model

**Current Approach**: Security by Obscurity + Client-Side Enforcement

**Assumptions**:
1. Users don't know how to use browser DevTools
2. Users don't know how to make raw HTTP requests
3. Users don't reverse-engineer React app
4. Users don't read this documentation

**Actual Security**:
- ProtectedRoute prevents honest users from accessing UI they shouldn't see
- Backend has no defense against malicious actors
- Anyone with curl can call any API endpoint
- Anyone with Socket.IO client can join any WebSocket room

### 8.3 Recommended Mitigations (NOT IMPLEMENTED)

**Backend Authentication Middleware**:
```typescript
// NOT IMPLEMENTED - Example only
function requireAuth(req, res, next) {
  const sessionUser = req.session?.user;
  if (!sessionUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = sessionUser;
  next();
}

function requireRole(allowedRoles: string[]) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// Usage (NOT IMPLEMENTED):
app.get('/api/admin/users', requireAuth, requireRole(['admin', 'super_admin']), async (req, res) => {
  // Handler
});
```

**WebSocket Authentication**:
```typescript
// NOT IMPLEMENTED - Example only
io.use((socket, next) => {
  const sessionID = socket.handshake.auth.sessionID;
  // Validate sessionID against database
  // Attach user info to socket.data.user
  next();
});

socket.on('joinCanteenRooms', (data) => {
  const user = socket.data.user;
  if (!user) return socket.emit('error', 'Unauthorized');
  
  // Validate user can access these canteens
  if (user.role === 'canteen_owner') {
    // Only allow joining own canteen
  }
});
```

---

## 9. PERMISSION DECISION TREE

```
┌─────────────────────────────────────────────────────────┐
│ User makes request (UI action or direct API call)      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ Is user authenticated? │ (Frontend check only)
        └────────┬───────┬───────┘
                 │       │
            YES  │       │  NO
                 │       └───────> Redirect to /login
                 ▼                 (ProtectedRoute)
        ┌────────────────────────┐
        │ Does route require     │
        │ specific role?         │
        └────────┬───────┬───────┘
                 │       │
            YES  │       │  NO
                 │       └───────> Allow access
                 │                 (Any authenticated user)
                 ▼
        ┌────────────────────────┐
        │ Does user.role match   │
        │ requiredRole or is in  │
        │ requiredRoles array?   │
        └────────┬───────┬───────┘
                 │       │
            YES  │       │  NO
                 │       └───────> Redirect to /login
                 │                 (ProtectedRoute shows "Access Denied")
                 ▼
        ┌────────────────────────┐
        │ Allow access           │
        │ (Render protected page)│
        └────────────────────────┘
                 │
                 ▼
        ┌────────────────────────┐
        │ Page makes API call    │
        └────────┬───────────────┘
                 │
                 ▼
        ┌────────────────────────┐
        │ Backend receives       │
        │ request                │
        └────────┬───────────────┘
                 │
                 ▼
        ┌────────────────────────┐
        │ NO AUTHENTICATION      │ ❌ CRITICAL
        │ NO AUTHORIZATION       │ ❌ CRITICAL
        │ Process request        │
        └────────────────────────┘
```

**Key Decision Points**:
1. **Frontend**: Is `isAuthenticated === true`? (localStorage check)
2. **Frontend**: Does `user.role` match required role? (string comparison)
3. **Backend**: None (all endpoints accessible)

---

## 10. ROLE ASSIGNMENT FLOWS

### 10.1 Regular User Registration (Student, Staff, etc.)

```
1. User visits /login
2. Clicks "Sign in with Google" or enters email/password
3. OAuth flow or email/password verification
4. Backend checks: GET /api/users/by-email/:email
   - If exists: Login user (retrieve role from database)
   - If not exists: Redirect to /profile-setup
5. User fills profile form (role selection):
   - role: student → requires registerNumber, department, passingOutYear
   - role: staff → requires staffId
   - role: employee, guest, contractor, visitor → requires registerNumber OR staffId
6. POST /api/users (create user with selected role)
7. Backend validates:
   - registerNumber uniqueness (if student/employee/guest/contractor/visitor)
   - staffId uniqueness (if staff)
8. User created with role, redirect to /app
```

### 10.2 Admin Creation (super_admin or admin)

**Method 1**: Manual database insert
```sql
-- Must be done by database administrator
INSERT INTO users (email, name, role, "phone_number", "is_profile_complete", "created_at")
VALUES ('admin@example.com', 'Admin Name', 'admin', '1234567890', true, NOW());
```

**Method 2**: First super_admin creation via API
```typescript
// POST /api/users (no authentication required)
// Only works if no super_admin exists yet
{
  "email": "superadmin@example.com",
  "name": "Super Admin",
  "role": "super_admin",
  "phoneNumber": "1234567890",
  "isProfileComplete": true
}
// Backend checks: no existing super_admin → allow creation
```

**Method 3**: Super admin creates additional admins
```typescript
// POST /api/users (called from admin panel UI)
// UI only accessible to users with role: 'admin' or 'super_admin'
// But endpoint is public (no backend enforcement)
{
  "email": "newadmin@example.com",
  "name": "New Admin",
  "role": "admin",  // NOT super_admin (only one allowed)
  "phoneNumber": "1234567890",
  "isProfileComplete": true
}
```

### 10.3 Canteen Owner Assignment

```
1. Super admin or admin accesses /admin/system-settings
2. Navigates to "Canteen Management"
3. Edits canteen settings
4. Sets "canteenOwnerEmail" to user's email
5. Backend updates SystemSettings.canteens[].canteenOwnerEmail
6. User with matching email needs role='canteen_owner'
   - Option A: Admin manually updates user role via /admin/user-management
   - Option B: User logs in, admin updates role: PUT /api/users/:id { role: 'canteen_owner' }
7. User logs in → redirected to /canteen-owner-dashboard/:canteenId/counters
```

**Critical**: Canteen owner role requires TWO pieces:
1. User.role === 'canteen_owner' (database)
2. SystemSettings.canteens[].canteenOwnerEmail === User.email (database)

### 10.4 Delivery Person Creation

**Source**: `server/routes.ts` lines 8800-8900 (Delivery person endpoint)

```
1. Admin or canteen owner accesses delivery person management UI
2. Fills delivery person form:
   - name (required)
   - phoneNumber (required)
   - email (optional but recommended)
   - canteenId (required)
   - password (required if email provided)
3. POST /api/delivery-persons
4. Backend creates DeliveryPerson record in PostgreSQL
5. If email provided:
   a. Check if User account exists with that email
   b. If exists:
      - Hash password (bcrypt, 10 rounds)
      - Update user: role='delivery_person', passwordHash, isProfileComplete=true
   c. If not exists:
      - Hash password
      - Create User: email, role='delivery_person', name=deliveryPerson.name, passwordHash
6. Delivery person can now log in with email/password
7. Login redirects to /delivery-portal
```

**Notes**:
- Delivery person MUST use email/password login (no Google OAuth)
- If email not provided, delivery person cannot log in (no user account created)
- DeliveryPerson and User are linked by email (not by foreign key)

---

## 11. PERMISSION CHANGE FLOWS

### 11.1 Promoting User to Admin

```
Current: User with role='student'
Target: User with role='admin'

Steps (Admin UI):
1. Super admin or admin accesses /admin/user-management
2. Finds user (search by email, name, or ID)
3. Clicks "Edit User"
4. Changes role dropdown from 'student' to 'admin'
5. Clicks "Save"
6. Frontend: PUT /api/users/:id { role: 'admin' }
7. Backend: Updates user.role in PostgreSQL (no validation)
8. User's next login → isAdmin=true → redirected to /admin

Edge Case: If user is currently logged in
- localStorage still has old role
- User must log out and log back in to see new permissions
- OR: Client must call GET /api/users/:id/validate to refresh user data
```

### 11.2 Demoting Admin to Regular User

```
Current: User with role='admin'
Target: User with role='student'

Steps:
1. Super admin accesses /admin/user-management
2. Finds admin user
3. Changes role to 'student'
4. Fills required student fields (registerNumber, department, passingOutYear)
5. Saves changes
6. Backend: PUT /api/users/:id updates role + student fields
7. User's next login → isAdmin=false → redirected to /app

Blocked Scenario: Demoting super_admin
- Backend validation (routes.ts:481-488) blocks role change from 'super_admin'
- Returns 403 error: "Cannot change super admin role"
```

### 11.3 Removing Canteen Owner Status

```
Option A: Change user role
1. Admin changes user role from 'canteen_owner' to another role
2. User can no longer access /canteen-owner routes
3. But SystemSettings.canteens[].canteenOwnerEmail still points to their email

Option B: Change canteen owner email
1. Admin edits canteen settings
2. Changes canteenOwnerEmail to different email
3. User still has role='canteen_owner'
4. Login fails: GET /api/system-settings/canteens/by-owner/:email returns 404
5. Redirected to /login?error=no_canteen

Recommended: Do both (change role AND canteen owner email)
```

### 11.4 Deactivating Delivery Person

```
Option A: Soft delete (mark inactive)
1. Admin accesses delivery person management
2. Toggles "isActive" to false
3. PUT /api/delivery-persons/:id { isActive: false }
4. Delivery person can still log in
5. But queries like GET /api/delivery-persons/active exclude them

Option B: Hard delete
1. DELETE /api/delivery-persons/:id
2. Deletes DeliveryPerson record
3. User account still exists with role='delivery_person'
4. Login succeeds but /delivery-portal shows "Delivery Person Not Found"

Recommended: Option A (soft delete) to preserve audit trail
```

---

## END OF DOCUMENT

**Last Updated**: 2025-12-31  
**Lines Analyzed**: 15,000+ LOC (routes.ts, App.tsx, ProtectedRoute.tsx, websocket.ts, useDataSync.ts)  
**Critical Findings**:
1. No backend API authentication or authorization
2. No WebSocket authentication or room authorization
3. Security relies entirely on client-side ProtectedRoute
4. All roles stored as string (no enum constraint)
5. Super admin protection is only backend enforcement found
6. Multi-role users not supported (single role per user)
