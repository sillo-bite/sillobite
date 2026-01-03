# 04-rest-apis.md

**Extracted from**: server/routes.ts, server/routes/*.ts, client API usage patterns

---

## **Table of Contents**

1. [Authentication & Session Management](#authentication--session-management)
2. [User Management](#user-management)
3. [Menu & Categories](#menu--categories)
4. [Order Management](#order-management)
5. [Payment Processing](#payment-processing)
6. [Delivery Management](#delivery-management)
7. [Notification System](#notification-system)
8. [Media & Content](#media--content)
9. [Coupon & Promotions](#coupon--promotions)
10. [Admin & Analytics](#admin--analytics)
11. [System Configuration](#system-configuration)
12. [Health & Monitoring](#health--monitoring)
13. [Appendix A: Common Patterns](#appendix-a-common-patterns)
14. [Appendix B: Error Codes](#appendix-b-error-codes)

---

## **Authentication & Session Management**

### **POST /api/auth/register**

Register new user with email/password authentication.

**Authentication**: None (public endpoint)

**Request Body**:
```typescript
{
  identifier: string;      // Email or phone number
  email?: string;          // Alternative: provide email directly
  phoneNumber?: string;    // Alternative: provide phone directly
  password: string;        // Min 6 characters
  name?: string;           // Optional: user's name
}
```

**Response** (201 Created):
```typescript
{
  message: "User registered successfully";
  user: {
    id: number;
    email: string;
    name: string;
    role: "student"; // Default
    isProfileComplete: false;
    createdAt: Date;
    // No passwordHash in response
  };
}
```

**Errors**:
- `400`: Missing identifier/password, invalid format, password < 6 chars
- `409`: Email/phone already registered
- `500`: Database/hashing error

**Side Effects**:
- Creates User in PostgreSQL with hashed password
- Auto-generates email if phone-only registration
- Sets default role to 'student'
- Sets isProfileComplete to false

**Idempotency**: Not idempotent (duplicate email/phone returns 409)

---

### **POST /api/auth/login**

Login with email/password or phone/password.

**Authentication**: None (public endpoint)

**Request Body**:
```typescript
{
  identifier: string; // Email or phone
  email?: string;     // Alternative field
  password: string;
}
```

**Response** (200 OK):
```typescript
{
  message: "Login successful";
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
    phoneNumber?: string;
    registerNumber?: string;
    department?: string;
    // ... other user fields except passwordHash
  };
}
```

**Errors**:
- `400`: Missing identifier/password
- `401`: Invalid credentials, user not found, wrong password
- `401`: User has no password (Google OAuth only user)
- `403`: User blocked (role starts with "blocked_")
- `500`: Database error

**Side Effects**: None (read-only)

**Idempotency**: Idempotent (same credentials return same result)

**Security**:
- Password compared with bcrypt
- Password hash never returned
- Blocked users cannot login

---

### **GET /api/auth/google**

Initiate Google OAuth 2.0 flow.

**Authentication**: None (public endpoint)

**Query Parameters**: None

**Response**: 302 Redirect to Google OAuth consent screen

**Side Effects**:
- Generates authorization URL with client_id, redirect_uri, scopes
- Prompts user for account selection

**Idempotency**: Idempotent (generates same redirect)

---

### **GET /api/auth/google/callback**

Handle Google OAuth callback after user authorization.

**Authentication**: None (OAuth callback)

**Query Parameters**:
```typescript
{
  code?: string;  // Authorization code from Google
  error?: string; // Error code if authorization failed
}
```

**Response**: 302 Redirect to frontend `/auth/callback` with query params

Success redirect:
```
/auth/callback?email=...&name=...&picture=...&id=...
```

Error redirect:
```
/auth/callback?error=...
```

**Side Effects**:
- Exchanges authorization code for tokens
- Verifies ID token
- Stores user data in session (if session enabled)

**Idempotency**: Not idempotent (authorization code is one-time use)

---

### **POST /api/auth/google/token**

Exchange Google authorization code for access token.

**Authentication**: None (OAuth flow)

**Request Body**:
```typescript
{
  code: string; // Authorization code from Google
}
```

**Response** (200 OK):
```typescript
{
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number; // Timestamp
}
```

**Errors**:
- `400`: Missing code, invalid code, expired code, redirect URI mismatch
- `500`: Token exchange failure

**Side Effects**: None (stateless token exchange)

**Idempotency**: Not idempotent (code is one-time use)

**Security**:
- Verifies redirect_uri matches Google Cloud Console configuration
- One-time use authorization codes

---

### **GET /api/auth/google/me**

Get current authenticated Google user from session.

**Authentication**: Session-based (requires googleUser in session)

**Response** (200 OK):
```typescript
{
  id: string;           // Google user ID
  email: string;
  name: string;
  picture: string;      // Profile picture URL
  emailVerified: boolean;
}
```

**Errors**:
- `401`: Not authenticated (no session)

**Side Effects**: None (read-only)

**Idempotency**: Idempotent

---

### **POST /api/auth/google/verify**

Verify Google ID token.

**Authentication**: None (token verification endpoint)

**Request Body**:
```typescript
{
  id_token: string; // Google ID token to verify
}
```

**Response** (200 OK):
```typescript
{
  valid: true;
  user: {
    id: string;
    email: string;
    name: string;
    picture: string;
  };
}
```

**Errors**:
- `400`: Missing token, invalid token, expired token
- `500`: Verification error

**Side Effects**: None (stateless verification)

**Idempotency**: Idempotent

**Security**:
- Verifies token signature with Google's public keys
- Validates audience matches client_id

---

## **User Management**

### **GET /api/users**

Fetch all users (admin only - no enforcement in code).

**Authentication**: None (application-level)

**Query Parameters**: None

**Response** (200 OK):
```typescript
User[] // Array of all users
```

**Errors**:
- `500`: Database error

**Side Effects**: None (read-only)

**Idempotency**: Idempotent

**Performance**: Fetches all users (no pagination) - use `/api/users/paginated` instead

---

### **GET /api/users/paginated**

Fetch users with pagination and filtering (admin only).

**Authentication**: None (application-level)

**Query Parameters**:
```typescript
{
  page?: number;      // Default: 1
  limit?: number;     // Default: 10
  search?: string;    // Search by name, email, registerNumber
  role?: string;      // Filter by role
  college?: string;   // Filter by college
  department?: string;// Filter by department
  year?: string;      // Filter by year
}
```

**Response** (200 OK):
```typescript
{
  users: User[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}
```

**Errors**:
- `500`: Database error

**Side Effects**: None (read-only)

**Idempotency**: Idempotent

---

### **GET /api/users/:id**

Get user by ID.

**Authentication**: None (application-level)

**Path Parameters**:
- `id`: User ID (number)

**Response** (200 OK):
```typescript
{
  id: number;
  email: string;
  name: string;
  phoneNumber?: string;
  role: string;
  registerNumber?: string;
  college?: string;
  department?: string;
  joiningYear?: number;
  passingOutYear?: number;
  currentStudyYear?: number;
  isPassed?: boolean;
  staffId?: string;
  organizationId?: string;
  selectedLocationType?: string;
  selectedLocationId?: string;
  isProfileComplete?: boolean;
  createdAt: Date;
}
```

**Errors**:
- `404`: User not found
- `500`: Database error

**Side Effects**: None (read-only)

**Idempotency**: Idempotent

---

### **GET /api/users/:id/validate**

Validate user session - check if user still exists.

**Authentication**: None (session validation)

**Path Parameters**:
- `id`: User ID (number)

**Response** (200 OK):
```typescript
{
  userExists: true;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    phoneNumber?: string;
    registerNumber?: string;
    department?: string;
    currentStudyYear?: number;
    isPassed?: boolean;
    staffId?: string;
    canteen?: { // If role is canteen_owner
      id: string;
      name: string;
      // ... other canteen fields
    };
  };
}
```

**Errors**:
- `404`: User not found (session invalid)
- `500`: Database error

**Side Effects**: None (read-only)

**Idempotency**: Idempotent

**Performance**: For canteen owners, includes canteen data to avoid additional API call

---

### **GET /api/users/by-email/:email**

Lookup user by email.

**Authentication**: None (application-level)

**Path Parameters**:
- `email`: User email (string)

**Response** (200 OK):
```typescript
User // Full user object
```

**Errors**:
- `404`: User not found
- `500`: Database error

**Side Effects**: None (read-only)

**Idempotency**: Idempotent

---

### **GET /api/users/by-register/:registerNumber**

Lookup user by register number (case-insensitive).

**Authentication**: None (application-level)

**Path Parameters**:
- `registerNumber`: Register number (string, normalized to uppercase)

**Response** (200 OK):
```typescript
User
```

**Errors**:
- `404`: User not found
- `500`: Database error

**Side Effects**:
- Register number normalized to uppercase before lookup

**Idempotency**: Idempotent

---

### **GET /api/users/by-staff/:staffId**

Lookup user by staff ID (case-insensitive).

**Authentication**: None (application-level)

**Path Parameters**:
- `staffId`: Staff ID (string, normalized to uppercase)

**Response** (200 OK):
```typescript
User
```

**Errors**:
- `404`: User not found
- `500`: Database error

**Side Effects**:
- Staff ID normalized to uppercase before lookup

**Idempotency**: Idempotent

---

### **POST /api/users**

Create new user.

**Authentication**: None (application-level)

**Request Body**:
```typescript
{
  email: string;
  name: string;
  phoneNumber?: string;
  role: "student" | "staff" | "employee" | "guest" | "canteen_owner" | "admin" | "super_admin";
  
  // Student fields
  registerNumber?: string; // Required if role=student
  college?: string;
  department?: string;     // Required if role=student
  joiningYear?: number;
  passingOutYear?: number; // Required if role=student
  currentStudyYear?: number;
  isPassed?: boolean;
  
  // Staff/Employee fields
  staffId?: string;        // Required if role=staff/employee
  
  // Guest fields
  organizationId?: string; // Required if role=guest
  
  // Profile status
  isProfileComplete?: boolean;
  
  // Authentication
  passwordHash?: string;
}
```

**Response** (200 OK - if email exists):
```typescript
User // Existing user with same email
```

**Response** (201 Created):
```typescript
User // Newly created user
```

**Errors**:
- `403`: Cannot create super_admin if one already exists
- `409`: Register number already registered (student/employee/contractor/visitor/guest)
- `409`: Staff ID already registered (staff)
- `500`: Database error

**Side Effects**:
- Creates User in PostgreSQL
- Normalizes registerNumber and staffId to uppercase
- Auto-sets selectedLocationType and selectedLocationId based on college/organizationId
- For guest users: excludes student/staff fields
- Duplicate email returns existing user (200, not 409)

**Idempotency**: Idempotent for duplicate email (returns existing user)

**Validation**:
- Validated against `insertUserSchema` (Zod)
- Register number format must match college-specific pattern
- Staff ID format must match college-specific pattern

---

### **PUT /api/users/:id**

Update user.

**Authentication**: None (application-level)

**Path Parameters**:
- `id`: User ID (number)

**Request Body**: Partial user object (any fields to update)

**Response** (200 OK):
```typescript
User // Updated user
```

**Errors**:
- `404`: User not found
- `403`: Cannot change super_admin role if only super_admin
- `500`: Database error

**Side Effects**:
- Updates User in PostgreSQL
- Auto-sets location if not already set (based on college/organizationId)
- Prevents changing last super_admin's role

**Idempotency**: Idempotent (same update produces same result)

---

### **PATCH /api/users/:id**

Update user email only.

**Authentication**: None (application-level)

**Path Parameters**:
- `id`: User ID (number)

**Request Body**:
```typescript
{
  email: string;
}
```

**Response** (200 OK):
```typescript
User // Updated user
```

**Errors**:
- `400`: Email is required
- `404`: User not found
- `409`: Email already in use by another user
- `500`: Database error

**Side Effects**:
- Updates User.email in PostgreSQL
- Checks for duplicate email across all users

**Idempotency**: Idempotent

---

### **DELETE /api/users/:id**

Delete user.

**Authentication**: None (application-level)

**Path Parameters**:
- `id`: User ID (number)

**Response** (200 OK):
```typescript
{
  message: "User deleted successfully";
}
```

**Errors**:
- `404`: User not found
- `403`: Cannot delete super_admin
- `500`: Database error

**Side Effects**:
- Deletes User from PostgreSQL
- Prevents deletion of super_admin

**Idempotency**: Not idempotent (subsequent calls return 404)

**Security**:
- Super admin cannot be deleted

---

### **DELETE /api/users/all**

Delete all users (dangerous - should be admin-only).

**Authentication**: None (application-level)

**Response** (200 OK):
```typescript
{
  message: "All users deleted successfully";
}
```

**Errors**:
- `500`: Database error

**Side Effects**:
- Deletes ALL users from PostgreSQL

**Idempotency**: Idempotent (deleting all users multiple times has same effect)

**Security**: ⚠️ **DANGEROUS ENDPOINT** - No authentication/authorization enforced in code

---

### **PUT /api/users/:id/location**

Save user's selected location.

**Authentication**: None (application-level)

**Path Parameters**:
- `id`: User ID (number)

**Request Body**:
```typescript
{
  locationType: "college" | "organization" | "restaurant";
  locationId: string;
}
```

**Response** (200 OK):
```typescript
User // Updated user
```

**Errors**:
- `400`: Missing locationType/locationId, invalid locationType
- `404`: User not found
- `500`: Database error

**Side Effects**:
- Updates User.selectedLocationType and selectedLocationId in PostgreSQL

**Idempotency**: Idempotent

---

### **GET /api/locations/:type**

Get locations by type.

**Authentication**: None (public endpoint)

**Path Parameters**:
- `type`: "college" | "organization" | "restaurant"

**Response** (200 OK):
```typescript
{
  locations: Array<{
    id: string;
    name: string;
    code: string;
    isActive: boolean;
    // ... other location fields
  }>;
}
```

**Errors**:
- `400`: Invalid location type
- `500`: Database error

**Side Effects**: None (read-only)

**Idempotency**: Idempotent

**Data Source**: SystemSettings.colleges/organizations/restaurants

---

### **GET /api/users/:id/orders**

Get user's order history (admin only).

**Authentication**: None (application-level)

**Path Parameters**:
- `id`: User ID (number)

**Response** (200 OK):
```typescript
Order[] // Array of orders for this user
```

**Errors**:
- `500`: Database error

**Side Effects**: None (read-only)

**Idempotency**: Idempotent

---

### **GET /api/users/:id/payments**

Get user's payment history (admin only).

**Authentication**: None (application-level)

**Path Parameters**:
- `id`: User ID (number)

**Response** (200 OK):
```typescript
Payment[] // Array of payments for this user's orders
```

**Errors**:
- `500`: Database error

**Side Effects**: None (read-only)

**Idempotency**: Idempotent

---

### **GET /api/users/:id/complaints**

Get user's complaints (admin only).

**Authentication**: None (application-level)

**Path Parameters**:
- `id`: User ID (number)

**Response** (200 OK):
```typescript
Complaint[] // Array of complaints by this user
```

**Errors**:
- `500`: Database error

**Side Effects**: None (read-only)

**Idempotency**: Idempotent

---

### **PUT /api/users/:id/block**

Block user (admin only).

**Authentication**: None (application-level)

**Path Parameters**:
- `id`: User ID (number)

**Response** (200 OK):
```typescript
{
  message: "User blocked successfully";
  user: User; // User with role prefixed with "blocked_"
}
```

**Errors**:
- `404`: User not found
- `500`: Database error

**Side Effects**:
- Updates User.role to "blocked_{originalRole}" in PostgreSQL
- User cannot login after blocking

**Idempotency**: Idempotent (blocking already blocked user has no effect)

---

### **PUT /api/users/:id/unblock**

Unblock user (admin only).

**Authentication**: None (application-level)

**Path Parameters**:
- `id`: User ID (number)

**Response** (200 OK):
```typescript
{
  message: "User unblocked successfully";
  user: User; // User with original role restored
}
```

**Errors**:
- `404`: User not found
- `500`: Database error

**Side Effects**:
- Removes "blocked_" prefix from User.role in PostgreSQL
- User can login after unblocking

**Idempotency**: Idempotent

---

### **GET /api/user-reviews**

Get reviews for a user (not implemented).

**Authentication**: None (public endpoint)

**Query Parameters**:
```typescript
{
  userEmail: string; // Required
}
```

**Response** (200 OK):
```typescript
[] // Empty array (TODO: implement review system)
```

**Errors**:
- `400`: Missing userEmail
- `500`: Database error

**Side Effects**: None (read-only)

**Idempotency**: Idempotent

**Status**: Placeholder endpoint for future review system

---

## **Menu & Categories**

### **GET /api/categories**

Get categories with pagination and filtering.

**Authentication**: None (public endpoint)

**Query Parameters**:
```typescript
{
  canteenId?: string;   // Filter by canteen
  page?: number;        // Default: 1
  limit?: number;       // Default: 50
  offset?: number;      // Alternative to page-based pagination
  search?: string;      // Search by name
  sortBy?: string;      // Default: "name"
  sortOrder?: "asc" | "desc"; // Default: "asc"
}
```

**Response** (200 OK):
```typescript
{
  items: Array<{
    id: string;
    name: string;
    icon?: string;
    imageUrl?: string;
    canteenId: string;
    createdAt: Date;
  }>;
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  filters: {
    search: string;
    sortBy: string;
    sortOrder: string;
  };
}
```

**Errors**:
- `500`: Database error

**Side Effects**: None (read-only)

**Idempotency**: Idempotent

**Performance**: Server-side filtering and pagination

---

### **POST /api/categories**

Create new category.

**Authentication**: None (canteen owner only - application-level)

**Request Body**:
```typescript
{
  name: string;
  canteenId: string;
  icon?: string;
  imageUrl?: string;
  imagePublicId?: string;
}
```

**Response** (201 Created):
```typescript
{
  id: string;
  name: string;
  canteenId: string;
  icon?: string;
  imageUrl?: string;
  imagePublicId?: string;
  createdAt: Date;
}
```

**Errors**:
- `409`: Category name already exists in this canteen
- `400`: Invalid data (Zod validation)
- `500`: Database error

**Side Effects**:
- Creates Category in MongoDB
- Enforces unique (name, canteenId) constraint

**Idempotency**: Not idempotent (duplicate name returns 409)

**Validation**: Validated against `insertCategorySchema` (Zod)

---

### **PUT /api/categories/:id**

Update category.

**Authentication**: None (canteen owner only - application-level)

**Path Parameters**:
- `id`: Category ID (MongoDB ObjectId)

**Request Body**:
```typescript
{
  name?: string;
  icon?: string;
  imageUrl?: string;
  imagePublicId?: string;
}
```

**Response** (200 OK):
```typescript
Category // Updated category
```

**Errors**:
- `500`: Database error

**Side Effects**:
- Updates Category in MongoDB

**Idempotency**: Idempotent

---

### **DELETE /api/categories/:id**

Delete category.

**Authentication**: None (canteen owner only - application-level)

**Path Parameters**:
- `id`: Category ID (MongoDB ObjectId)

**Response** (204 No Content)

**Errors**:
- `500`: Database error

**Side Effects**:
- Deletes Category from MongoDB
- ⚠️ No check for menu items referencing this category

**Idempotency**: Idempotent

**Security**: Should check if menu items reference this category before deletion

---

### **POST /api/categories/:id/image**

Upload category image.

**Authentication**: None (canteen owner only - application-level)

**Path Parameters**:
- `id`: Category ID (MongoDB ObjectId)

**Request Body**: multipart/form-data
- `image`: Image file (max 100KB)

**Response** (200 OK):
```typescript
{
  imageUrl: string;       // Cloudinary URL
  imagePublicId: string;  // Cloudinary public ID
}
```

**Errors**:
- `400`: No image file provided, file too large, invalid file type
- `500`: Upload error, database error

**Side Effects**:
- Uploads image to Cloudinary (compressed to 10KB target)
- Updates Category.imageUrl and imagePublicId in MongoDB

**Idempotency**: Not idempotent (replaces existing image)

**File Processing**:
- Max size: 100KB
- Target compression: 10KB
- Allowed types: image/*

---

### **DELETE /api/categories/:id/image**

Remove category image.

**Authentication**: None (canteen owner only - application-level)

**Path Parameters**:
- `id`: Category ID (MongoDB ObjectId)

**Response** (200 OK):
```typescript
{
  message: "Image removed successfully";
}
```

**Errors**:
- `500`: Database error

**Side Effects**:
- Deletes image from Cloudinary
- Clears Category.imageUrl and imagePublicId in MongoDB

**Idempotency**: Idempotent

---

### **GET /api/menu**

Get menu items with comprehensive filtering.

**Authentication**: None (public endpoint)

**Query Parameters**:
```typescript
{
  canteenId?: string;        // Required for menu management
  search?: string;           // Search by name, description, category name
  category?: string;         // Filter by category ID
  stockFilter?: string;      // "all" | "in_stock" | "low_stock" | "out_of_stock"
  vegOnly?: "true" | "false";// Filter vegetarian only
  availableOnly?: "true" | "false"; // Default: "true"
  excludeIds?: string;       // Comma-separated IDs to exclude (smart caching)
  itemIds?: string;          // Comma-separated IDs to fetch (batch query)
  page?: number;             // Default: 1
  limit?: number;            // Default: 20
  sortBy?: string;           // Default: "name"
  sortOrder?: "asc" | "desc"; // Default: "asc"
}
```

**Response** (200 OK):
```typescript
{
  items: Array<{
    id: string;
    name: string;
    price: number;
    categoryId?: string;
    canteenId: string;
    available: boolean;
    stock: number;
    description?: string;
    addOns: string; // JSON array
    isVegetarian: boolean;
    isMarkable: boolean;
    isTrending: boolean;
    isQuickPick: boolean;
    imageUrl?: string;
    imagePublicId?: string;
    storeCounterId?: string;
    paymentCounterId?: string;
    kotCounterId?: string;
    cookingTime?: number;
    calories?: number;
    createdAt: Date;
  }>;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  filters: {
    search: string;
    category: string;
    stockFilter: string;
    vegOnly: string;
    availableOnly: string;
    sortBy: string;
    sortOrder: string;
  };
}
```

**Errors**:
- `500`: Database error

**Side Effects**: None (read-only)

**Idempotency**: Idempotent

**Performance**:
- Server-side filtering and pagination
- Category name search optimized with separate query
- Smart caching with excludeIds
- Batch query optimization with itemIds
- Default: available=true, stock>0 (user-facing)
- Admin views: availableOnly=false (show all items)

---

### **POST /api/menu**

Create menu item.

**Authentication**: None (canteen owner only - application-level)

**Request Body**:
```typescript
{
  name: string;
  price: number;
  categoryId?: string;
  canteenId: string;
  available?: boolean; // Default: true
  stock?: number;      // Default: 0
  description?: string;
  addOns?: string;     // JSON array
  isVegetarian?: boolean; // Default: true
  isMarkable?: boolean;   // Default: true
  isTrending?: boolean;   // Default: false
  isQuickPick?: boolean;  // Default: false
  storeCounterId?: string;
  paymentCounterId?: string;
  kotCounterId?: string;
  cookingTime?: number;   // Default: 0
  calories?: number;      // Default: 0
}
```

**Response** (201 Created):
```typescript
MenuItem // Created menu item
```

**Errors**:
- `400`: Invalid data (Zod validation)
- `500`: Database error

**Side Effects**:
- Creates MenuItem in MongoDB

**Idempotency**: Not idempotent (creates duplicate items)

**Validation**: Validated against `insertMenuItemSchema` (Zod)

---

### **PUT /api/menu/:id**

Update menu item.

**Authentication**: None (canteen owner only - application-level)

**Path Parameters**:
- `id`: MenuItem ID (MongoDB ObjectId)

**Request Body**: Partial menu item (any fields to update)

**Response** (200 OK):
```typescript
MenuItem // Updated menu item
```

**Errors**:
- `404`: Menu item not found
- `500`: Database error

**Side Effects**:
- Updates MenuItem in MongoDB

**Idempotency**: Idempotent

---

### **DELETE /api/menu/:id**

Delete menu item.

**Authentication**: None (canteen owner only - application-level)

**Path Parameters**:
- `id`: MenuItem ID (MongoDB ObjectId)

**Response** (204 No Content)

**Errors**:
- `404`: Menu item not found
- `500`: Database error

**Side Effects**:
- Deletes MenuItem from MongoDB
- Deletes image from Cloudinary if exists

**Idempotency**: Idempotent

---

### **POST /api/menu/:id/image**

Upload menu item image.

**Authentication**: None (canteen owner only - application-level)

**Path Parameters**:
- `id`: MenuItem ID (MongoDB ObjectId)

**Request Body**: multipart/form-data
- `image`: Image file (max 100KB)

**Response** (200 OK):
```typescript
{
  imageUrl: string;
  imagePublicId: string;
}
```

**Errors**:
- `400`: No image file, file too large, invalid file type
- `404`: Menu item not found
- `500`: Upload error, database error

**Side Effects**:
- Uploads image to Cloudinary (compressed to 20KB target)
- Updates MenuItem.imageUrl and imagePublicId in MongoDB

**Idempotency**: Not idempotent (replaces existing image)

**File Processing**:
- Max size: 100KB
- Target compression: 20KB
- Allowed types: image/*

---

### **DELETE /api/menu/:id/image**

Remove menu item image.

**Authentication**: None (canteen owner only - application-level)

**Path Parameters**:
- `id`: MenuItem ID (MongoDB ObjectId)

**Response** (200 OK):
```typescript
{
  message: "Image removed successfully";
}
```

**Errors**:
- `404`: Menu item not found
- `500`: Database error

**Side Effects**:
- Deletes image from Cloudinary
- Clears MenuItem.imageUrl and imagePublicId in MongoDB

**Idempotency**: Idempotent

---

### **PATCH /api/menu/:id/stock**

Update menu item stock.

**Authentication**: None (canteen owner only - application-level)

**Path Parameters**:
- `id`: MenuItem ID (MongoDB ObjectId)

**Request Body**:
```typescript
{
  stock: number;
}
```

**Response** (200 OK):
```typescript
MenuItem // Updated menu item
```

**Errors**:
- `400`: Invalid stock value
- `404`: Menu item not found
- `500`: Database error

**Side Effects**:
- Updates MenuItem.stock in MongoDB

**Idempotency**: Idempotent

---

### **POST /api/menu/batch-update-stock**

Batch update menu item stock.

**Authentication**: None (canteen owner only - application-level)

**Request Body**:
```typescript
{
  updates: Array<{
    id: string;     // MenuItem ID
    stock: number;  // New stock value
  }>;
}
```

**Response** (200 OK):
```typescript
{
  success: boolean;
  updated: number; // Count of updated items
}
```

**Errors**:
- `400`: Invalid updates array
- `500`: Database error

**Side Effects**:
- Updates multiple MenuItem.stock in MongoDB

**Idempotency**: Idempotent

**Performance**: Batch operation for efficiency

---

### **POST /api/menu/toggle-trending**

Toggle menu item trending status.

**Authentication**: None (canteen owner only - application-level)

**Request Body**:
```typescript
{
  itemId: string;        // MenuItem ID
  isTrending: boolean;   // New trending status
}
```

**Response** (200 OK):
```typescript
MenuItem // Updated menu item
```

**Errors**:
- `404`: Menu item not found
- `500`: Database error

**Side Effects**:
- Updates MenuItem.isTrending in MongoDB

**Idempotency**: Idempotent

---

### **POST /api/menu/toggle-quick-pick**

Toggle menu item quick pick status.

**Authentication**: None (canteen owner only - application-level)

**Request Body**:
```typescript
{
  itemId: string;        // MenuItem ID
  isQuickPick: boolean;  // New quick pick status
}
```

**Response** (200 OK):
```typescript
MenuItem // Updated menu item
```

**Errors**:
- `404`: Menu item not found
- `500`: Database error

**Side Effects**:
- Updates MenuItem.isQuickPick in MongoDB

**Idempotency**: Idempotent

---

### **GET /api/canteens/:canteenId/charges**

Get canteen charges (service charge, packaging fee, etc.).

**Authentication**: None (public endpoint)

**Path Parameters**:
- `canteenId`: Canteen ID (string)

**Response** (200 OK):
```typescript
{
  items: Array<{
    id: string;
    canteenId: string;
    name: string;           // e.g., "Service Charge"
    type: "percent" | "fixed";
    value: number;          // Percentage (5) or amount in rupees
    active: boolean;
    createdAt: Date;
  }>;
}
```

**Errors**:
- `500`: Database error

**Side Effects**: None (read-only)

**Idempotency**: Idempotent

---

### **POST /api/canteens/:canteenId/charges**

Create canteen charge.

**Authentication**: None (canteen owner only - application-level)

**Path Parameters**:
- `canteenId`: Canteen ID (string)

**Request Body**:
```typescript
{
  name: string;
  type: "percent" | "fixed";
  value: number;
  active?: boolean; // Default: true
}
```

**Response** (201 Created):
```typescript
{
  id: string;
  name: string;
  type: "percent" | "fixed";
  value: number;
  active: boolean;
  createdAt: Date;
  canteenId: string;
}
```

**Errors**:
- `400`: Missing name/type/value
- `500`: Database error

**Side Effects**:
- Creates CanteenCharge in MongoDB

**Idempotency**: Not idempotent

---

### **PUT /api/canteen-charges/:id**

Update canteen charge.

**Authentication**: None (canteen owner only - application-level)

**Path Parameters**:
- `id`: CanteenCharge ID (MongoDB ObjectId)

**Request Body**:
```typescript
{
  name?: string;
  type?: "percent" | "fixed";
  value?: number;
  active?: boolean;
}
```

**Response** (200 OK):
```typescript
CanteenCharge // Updated charge
```

**Errors**:
- `404`: Charge not found
- `500`: Database error

**Side Effects**:
- Updates CanteenCharge in MongoDB

**Idempotency**: Idempotent

---

### **DELETE /api/canteen-charges/:id**

Delete canteen charge.

**Authentication**: None (canteen owner only - application-level)

**Path Parameters**:
- `id`: CanteenCharge ID (MongoDB ObjectId)

**Response** (200 OK):
```typescript
{
  success: true;
}
```

**Errors**:
- `404`: Charge not found
- `500`: Database error

**Side Effects**:
- Deletes CanteenCharge from MongoDB

**Idempotency**: Idempotent

---

### **GET /api/canteens/:canteenId/settings**

Get canteen settings (tax configuration).

**Authentication**: None (public endpoint)

**Path Parameters**:
- `canteenId`: Canteen ID (string)

**Response** (200 OK):
```typescript
{
  id: string;
  canteenId: string;
  taxRate: number;           // Default: 5 (5%)
  taxName: string;           // Default: "GST"
  favoriteCounterId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Errors**:
- `500`: Database error

**Side Effects**:
- Creates default settings if not exist (taxRate=5, taxName="GST")

**Idempotency**: Idempotent (auto-creates default settings)

---

### **PUT /api/canteens/:canteenId/settings**

Update canteen settings.

**Authentication**: None (canteen owner only - application-level)

**Path Parameters**:
- `canteenId`: Canteen ID (string)

**Request Body**:
```typescript
{
  taxRate?: number;         // 0-100
  taxName?: string;
  favoriteCounterId?: string;
}
```

**Response** (200 OK):
```typescript
CanteenSettings // Updated settings
```

**Errors**:
- `400`: Tax rate out of range (0-100)
- `500`: Database error

**Side Effects**:
- Updates CanteenSettings in MongoDB (upsert: creates if not exists)

**Idempotency**: Idempotent

---

### **GET /api/canteens/:canteenId/menu-analytics**

Get menu analytics for canteen owner.

**Authentication**: None (canteen owner only - application-level)

**Path Parameters**:
- `canteenId`: Canteen ID (string)

**Response** (200 OK):
```typescript
{
  totalItems: number;
  activeItems: number;      // available=true, stock>0
  outOfStockItems: number;  // stock=0
  lowStockItems: number;    // stock>0 and stock<=5
}
```

**Errors**:
- `500`: Database error

**Side Effects**: None (read-only)

**Idempotency**: Idempotent

**Performance**: Optimized MongoDB query with minimal field selection

---

## **Order Management**

*(Continuing in next section due to size...)*

---

## **Appendix A: Common Patterns**

### **Authentication Enforcement**

All endpoints currently have **NO authentication enforcement at the HTTP layer**. Authentication and authorization are expected to be handled at the **application level** (frontend/client):

- Frontend checks user role before making API calls
- Session management handled via localStorage/sessionStorage
- No JWT tokens or session cookies validated on server
- Sensitive operations (admin, canteen owner) rely on client-side role checks

**Security Implication**: Any client with API access can call any endpoint. Production deployment should add server-side authentication middleware.

---

### **Role-Based Access**

While no server-side enforcement exists, the **intended** role-based access is:

- **Public**: Authentication endpoints, menu viewing, location lookup
- **Student/Staff/Guest**: Order placement, payment, complaints
- **Canteen Owner**: Menu management, order status updates, counter management
- **Admin**: User management, coupon management, complaint resolution
- **Super Admin**: System settings, database operations

**Recommended Pattern**:
```typescript
// Middleware to add
function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.session?.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

---

### **Error Response Format**

Standard error responses:
```typescript
{
  message?: string;       // Human-readable error
  error?: string;         // Error type or message
  details?: string;       // Technical details
  code?: string;          // Error code (e.g., 'DUPLICATE_EMAIL')
}
```

---

### **Pagination Patterns**

Two pagination approaches:

**Page-based** (legacy):
```typescript
{
  page: 1,
  limit: 20
}
```

**Offset-based** (newer):
```typescript
{
  offset: 0,
  limit: 20
}
```

Both return compatible response structure.

---

### **ID Formats**

- **PostgreSQL IDs**: `number` (auto-increment)
- **MongoDB IDs**: `string` (24-character hex ObjectId)
- **Canteen IDs**: `string` (from SystemSettings)
- **Counter IDs**: `string` (UUID-like)

---

### **Date Handling**

- All dates stored as ISO 8601 strings
- Timestamps include timezone (UTC)
- createdAt/updatedAt auto-managed

---

### **File Upload Pattern**

Using `multer` with memory storage:
```typescript
upload.single('image')  // Single file
mediaUpload.single('file')  // Media banners
```

Limits:
- Menu items: 100KB → compressed to 20KB
- Categories: 100KB → compressed to 10KB
- Media banners: 50MB (no compression)

---

## **Appendix B: Error Codes**

### **HTTP Status Codes**

- `200`: Success
- `201`: Created
- `204`: No Content (successful deletion)
- `400`: Bad Request (validation error, missing fields)
- `401`: Unauthorized (not authenticated)
- `403`: Forbidden (insufficient permissions, blocked user)
- `404`: Not Found (resource doesn't exist)
- `409`: Conflict (duplicate email, register number, etc.)
- `429`: Too Many Requests (rate limiting - future)
- `500`: Internal Server Error (database, unexpected errors)

---

### **Custom Error Codes**

- `DUPLICATE_EMAIL`: Email already registered
- `DUPLICATE_REGISTER_NUMBER`: Register number already exists
- `DUPLICATE_STAFF_ID`: Staff ID already exists
- `DUPLICATE_PAYMENT_REQUEST`: Payment already in progress
- `PAYMENT_INIT_ERROR`: Payment gateway initialization failed
- `PAYMENT_AUTH_ERROR`: Payment gateway authentication failed
- `PAYMENT_RATE_LIMIT`: Too many payment requests
- `SESSION_EXPIRED`: Checkout session expired
- `STOCK_UNAVAILABLE`: Menu item out of stock

---

**End of Section 1 (Authentication, User Management, Menu & Categories)**

**Note**: This document continues with Order Management, Payment Processing, Delivery, Notifications, Media, Coupons, Admin, System Configuration, and Health endpoints. The full specification exceeds 200 endpoints. Refer to server/routes.ts lines 1-9730 and server/routes/*.ts for complete implementation details.
