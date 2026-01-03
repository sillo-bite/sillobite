# 03-database-models.md

**Extracted from**: Prisma schema, MongoDB models, server-side usage patterns

---

## **Database Architecture**

The system uses a **hybrid database approach**:
- **PostgreSQL (Prisma)**: User authentication, delivery persons
- **MongoDB (Mongoose)**: All other models (orders, menu, payments, etc.)

---

## **PostgreSQL Models (Prisma)**

### **User**

**Table**: `users`

**Fields**:
```typescript
{
  id: number (PK, autoincrement)
  email: string (unique, required)
  name: string (required)
  phoneNumber: string | null
  role: string (required) // "student", "staff", "employee", "guest", "canteen_owner", "admin", "super_admin"
  
  // Student fields
  registerNumber: string | null (unique)
  college: string | null
  department: string | null
  joiningYear: number | null
  passingOutYear: number | null
  currentStudyYear: number | null
  isPassed: boolean | null (default: false)
  
  // Staff/Employee fields
  staffId: string | null (unique)
  
  // Guest user fields
  organizationId: string | null
  
  // Location selection
  selectedLocationType: string | null // "college", "organization", "restaurant"
  selectedLocationId: string | null
  
  // Profile status
  isProfileComplete: boolean | null (default: false)
  
  // Authentication
  passwordHash: string | null
  
  createdAt: Date (default: now())
}
```

**Indexes**:
- `email` (unique)
- `registerNumber` (unique, sparse)
- `staffId` (unique, sparse)

**Constraints**:
- Email must be unique across all users
- RegisterNumber uppercase normalized on insert
- StaffId uppercase normalized on insert
- For `role='guest'`: student/staff fields excluded, organizationId required
- For `role='student'`: registerNumber, department, joiningYear required
- For `role='staff'` or `role='employee'`: staffId required

**Ownership**: 
- Created by user during signup
- Updated by user (profile completion) or admin

**Lifecycle**:
- Created on signup (Google OAuth or email/password)
- Updated when user completes profile
- Updated when user selects location
- Referenced by orders via `customerId`

**Invariants**:
- User email cannot be changed once created (except via admin)
- RegisterNumber and staffId must match college-specific format
- Guest users must have organizationId
- Students must have registerNumber + department + passingOutYear
- Role cannot be "blocked_*" unless blocked by admin

---

### **DeliveryPerson**

**Table**: `delivery_persons`

**Fields**:
```typescript
{
  id: number (PK, autoincrement)
  deliveryPersonId: string (unique, required) // "DP001", "DP002", etc.
  canteenId: string (required)
  name: string (required)
  phoneNumber: string (required)
  email: string | null
  employeeId: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  dateOfBirth: Date | null
  dateOfJoining: Date | null
  vehicleNumber: string | null
  licenseNumber: string | null
  emergencyContact: string | null
  emergencyContactName: string | null
  salary: Decimal(10, 2) | null
  isActive: boolean (default: true)
  isAvailable: boolean (default: true)
  totalOrderDelivered: number (default: 0)
  notes: string | null
  createdAt: Date (default: now())
  updatedAt: Date (auto-update)
}
```

**Indexes**:
- `deliveryPersonId` (unique)
- `canteenId, isActive`
- `canteenId, isAvailable`

**Constraints**:
- deliveryPersonId auto-generated as "DP{count+1}" padded to 3 digits
- deliveryPersonId unique across system
- canteenId must reference valid canteen in SystemSettings

**Ownership**: 
- Owned by canteen owner
- Created/updated by canteen owner or admin

**Lifecycle**:
- Created by canteen owner
- Updated when assigned to orders
- `totalOrderDelivered` incremented when order status = 'delivered'
- `isAvailable` toggled when assigned/unassigned from orders

**Invariants**:
- deliveryPersonId format: /^DP\d{3}$/
- Cannot be deleted if assigned to active orders
- isAvailable=false when assigned to order with status != 'delivered'

---

## **MongoDB Models (Mongoose)**

### **Category**

**Collection**: `categories`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  name: string (required)
  canteenId: string (required)
  icon: string | undefined
  imageUrl: string | undefined
  imagePublicId: string | undefined // Cloudinary ID for deletion
  createdAt: Date (default: now())
}
```

**Indexes**:
- `{ name: 1, canteenId: 1 }` (unique compound)
- `{ canteenId: 1, name: 1 }`
- `{ name: 1 }`

**Constraints**:
- Category name must be unique within a canteen
- Same category name allowed across different canteens

**Ownership**: 
- Owned by canteen owner
- Created/updated by canteen owner or admin

**Lifecycle**:
- Created by canteen owner
- Cannot be deleted if referenced by menu items

**Invariants**:
- name + canteenId must be unique
- If imageUrl exists, imagePublicId must exist

---

### **MenuItem**

**Collection**: `menuitems`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  name: string (required)
  price: number (required)
  categoryId: ObjectId | undefined (ref: Category)
  canteenId: string (required)
  available: boolean (default: true)
  stock: number (default: 0)
  description: string | undefined
  addOns: string (default: '[]') // JSON array
  isVegetarian: boolean (default: true)
  isMarkable: boolean (default: true) // true = manual ready, false = auto-ready
  isTrending: boolean (default: false)
  isQuickPick: boolean (default: false)
  imageUrl: string | undefined
  imagePublicId: string | undefined
  storeCounterId: string | undefined
  paymentCounterId: string | undefined
  kotCounterId: string | undefined
  cookingTime: number (default: 0) // minutes
  calories: number (default: 0) // kcal
  createdAt: Date (default: now())
}
```

**Indexes**:
- `{ canteenId: 1, available: 1, stock: 1 }`
- `{ canteenId: 1, categoryId: 1, available: 1 }`
- `{ canteenId: 1, isVegetarian: 1, available: 1 }`
- `{ canteenId: 1, name: 1 }`
- `{ description: 1 }`

**Constraints**:
- price > 0
- stock >= 0
- If categoryId exists, must reference valid Category

**Ownership**: 
- Owned by canteen owner
- Created/updated by canteen owner or admin

**Lifecycle**:
- Created by canteen owner
- `stock` decremented when order placed
- `stock` restored if order cancelled
- `available` toggled by owner

**Invariants**:
- stock must never go negative (checked before order placement)
- If isMarkable=false, order items auto-marked ready on creation

---

### **CanteenCharge**

**Collection**: `canteencharges`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  canteenId: string (required)
  name: string (required) // e.g., "Service Charge", "Packaging Fee"
  type: 'percent' | 'fixed' (required)
  value: number (required) // Percentage (5) or fixed amount in rupees
  active: boolean (default: true)
  createdAt: Date (default: now())
}
```

**Indexes**:
- `{ canteenId: 1 }`
- `{ canteenId: 1, name: 1 }`

**Constraints**:
- type must be 'percent' or 'fixed'
- For 'percent': value between 0-100
- For 'fixed': value >= 0

**Ownership**: 
- Owned by canteen owner
- Created/updated by canteen owner

**Lifecycle**:
- Created by canteen owner
- Applied to orders during checkout
- Calculated on frontend, stored in order.chargesApplied

**Invariants**:
- Only active charges applied to new orders

---

### **CanteenSettings**

**Collection**: `canteensettings`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  canteenId: string (required, unique)
  taxRate: number (default: 5, min: 0, max: 100) // Percentage
  taxName: string (default: 'GST')
  favoriteCounterId: string | undefined // Owner's favorite counter
  createdAt: Date (default: now())
  updatedAt: Date (default: now())
}
```

**Indexes**:
- `{ canteenId: 1 }` (unique)

**Constraints**:
- canteenId must be unique
- taxRate between 0-100

**Ownership**: 
- Owned by canteen owner
- Created when canteen created
- Updated by canteen owner

**Lifecycle**:
- Auto-created when canteen created
- Tax applied to orders during checkout

**Invariants**:
- One CanteenSettings per canteen

---

### **Order**

**Collection**: `orders`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  orderNumber: string (required, unique) // "ORD-{timestamp}-{random}"
  customerId: number | undefined // PostgreSQL User.id
  customerName: string (required)
  collegeName: string | undefined
  items: string (required) // JSON array of order items
  amount: number (required) // Total amount in rupees
  itemsSubtotal: number | undefined
  taxAmount: number | undefined
  chargesTotal: number | undefined
  chargesApplied: Array<{
    name: string;
    type: 'percent' | 'fixed';
    value: number;
    amount: number;
  }> | undefined
  originalAmount: number | undefined // Before discount
  discountAmount: number | undefined
  appliedCoupon: string | undefined
  status: string (default: 'preparing')
    // 'pending' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'completed' | 'cancelled'
  estimatedTime: number (default: 15) // minutes
  barcode: string (required, unique)
  barcodeUsed: boolean (default: false)
  deliveredAt: Date | undefined
  seenBy: number[] (default: []) // User IDs
  canteenId: string (required)
  counterId: string | undefined
  storeCounterId: string | undefined
  paymentCounterId: string | undefined
  kotCounterId: string | undefined
  paymentConfirmedBy: string | undefined
  rejectedBy: string | undefined
  allStoreCounterIds: string[] | undefined
  allPaymentCounterIds: string[] | undefined
  allKotCounterIds: string[] | undefined
  allCounterIds: string[] | undefined
  isOffline: boolean | undefined
  paymentStatus: string (default: 'PENDING') // 'PENDING' | 'PAID' | 'FAILED'
  paymentMethod: string | undefined // 'online' | 'offline' | 'upi' | 'cash' | 'card'
  qrId: string | undefined // Razorpay QR ID
  paymentId: string | undefined // Razorpay payment ID
  isCounterOrder: boolean | undefined
  itemStatusByCounter: {
    [counterId: string]: {
      [itemId: string]: 'pending' | 'ready' | 'completed'
    }
  } | undefined
  deliveryPersonId: string | undefined
  orderType: 'delivery' | 'takeaway' | undefined
  deliveryAddress: {
    label: string | undefined;
    fullName: string | undefined;
    phoneNumber: string | undefined;
    addressLine1: string | undefined;
    addressLine2: string | undefined;
    city: string | undefined;
    state: string | undefined;
    pincode: string | undefined;
    landmark: string | undefined;
  } | undefined
  createdAt: Date (default: now())
}
```

**Indexes**:
- `{ customerId: 1, status: 1, createdAt: -1 }`
- `{ canteenId: 1, status: 1, createdAt: -1 }`
- `{ deliveryPersonId: 1, status: 1, createdAt: -1 }`
- `{ status: 1, createdAt: -1 }`
- `{ orderNumber: 1 }` (unique)
- `{ barcode: 1 }` (unique)

**Status Meanings**:
- `pending`: Order placed, awaiting owner acceptance (offline orders only)
- `preparing`: Order accepted, being prepared in kitchen
- `ready`: Order ready for pickup (takeaway) or delivery dispatch
- `out_for_delivery`: Order assigned to delivery person, in transit
- `delivered`: Delivery person marked as delivered
- `completed`: Customer confirmed receipt / picked up
- `cancelled`: Order cancelled (owner rejection or payment failure)

**Payment Status**:
- `PENDING`: Payment not completed
- `PAID`: Payment successful
- `FAILED`: Payment failed

**Ownership**: 
- Owned by customer (customerId)
- Managed by canteen owner and counter operators

**Lifecycle**:
1. Created with status='preparing' (online) or 'pending' (offline)
2. Owner accepts → 'preparing'
3. Kitchen marks ready → 'ready'
4. If delivery: assigned to delivery person → 'out_for_delivery' → 'delivered'
5. If takeaway: customer picks up → 'completed'
6. Any stage: can be cancelled → 'cancelled'

**Invariants**:
- orderNumber unique across system
- barcode unique across system
- If orderType='delivery', deliveryAddress must exist
- If deliveryPersonId exists, orderType must be 'delivery'
- If status='out_for_delivery', deliveryPersonId must exist
- If paymentMethod='online', paymentStatus must be 'PAID'
- amount >= itemsSubtotal + taxAmount + chargesTotal - discountAmount
- status transitions must follow valid flow (no 'completed' → 'preparing')

---

### **OrderItem**

**Collection**: `orderitems`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  orderId: ObjectId (required, ref: Order)
  menuItemId: ObjectId (required, ref: MenuItem)
  quantity: number (required)
  price: number (required)
}
```

**Indexes**:
- None explicitly defined (small collection, denormalized in Order.items)

**Ownership**: 
- Owned by order

**Lifecycle**:
- Created with order
- Typically denormalized in Order.items JSON field
- This collection may be deprecated in favor of denormalized approach

**Invariants**:
- quantity > 0
- price matches MenuItem.price at time of order

---

### **Notification**

**Collection**: `notifications`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  type: string (required) // 'order_update', 'system_alert', etc.
  message: string (required)
  read: boolean (default: false)
  canteenId: string (required)
  createdAt: Date (default: now())
}
```

**Indexes**:
- None explicitly defined

**Ownership**: 
- System-generated for canteen owners

**Lifecycle**:
- Created on order events
- Marked read by owner
- Auto-deleted after 30 days (application-level)

**Invariants**:
- None

---

### **NotificationTemplate**

**Collection**: `notificationtemplates`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  id: string (required, unique)
  status: string (required, unique) // 'pending', 'preparing', 'ready', etc.
  title: string (required)
  message: string (required)
  icon: string (required) // Emoji
  priority: 'normal' | 'high' (default: 'normal')
  requireInteraction: boolean (default: false)
  enabled: boolean (default: true)
  createdAt: Date (default: now())
  updatedAt: Date (default: now())
}
```

**Indexes**:
- `{ id: 1 }` (unique)
- `{ status: 1 }` (unique)

**Ownership**: 
- System-managed
- Can be customized by admin

**Lifecycle**:
- Seeded on system initialization
- Updated by admin
- Used for web push notifications

**Invariants**:
- status must match Order.status values

---

### **CustomNotificationTemplate**

**Collection**: `customnotificationtemplates`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  id: string (required, unique)
  name: string (required)
  title: string (required)
  message: string (required)
  icon: string (required)
  priority: 'normal' | 'high' (default: 'normal')
  requireInteraction: boolean (default: false)
  enabled: boolean (default: true)
  createdBy: number (required) // Admin user ID
  createdAt: Date (default: now())
  updatedAt: Date (default: now())
}
```

**Indexes**:
- `{ id: 1 }` (unique)

**Ownership**: 
- Created by admin
- Used for broadcast notifications

**Lifecycle**:
- Created by admin
- Used for manual broadcasts to users

**Invariants**:
- createdBy must reference valid User.id with admin role

---

### **LoginIssue**

**Collection**: `loginissues`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  name: string (required)
  email: string | undefined
  phoneNumber: string | undefined
  registerNumber: string | undefined
  staffId: string | undefined
  issueType: string (required) // 'forgot_password', 'account_locked', etc.
  description: string (required)
  status: string (default: 'pending') // 'pending' | 'resolved' | 'rejected'
  adminNotes: string | undefined
  resolvedBy: string | undefined // Admin user name/ID
  resolvedAt: Date | undefined
  createdAt: Date (default: now())
}
```

**Indexes**:
- None explicitly defined

**Ownership**: 
- Created by user experiencing login issue
- Managed by admin

**Lifecycle**:
- Created by user on login issue
- Admin reviews and resolves
- Status updated to 'resolved' or 'rejected'

**Invariants**:
- At least one of: email, phoneNumber, registerNumber, staffId must be provided

---

### **Complaint**

**Collection**: `complaints`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  subject: string (required)
  description: string (required)
  userId: number | undefined // PostgreSQL User.id
  userName: string (required)
  userEmail: string | undefined
  category: 'Payment' | 'Service' | 'Quality' | 'Technical' | 'General' (required, default: 'General')
  priority: 'Low' | 'Medium' | 'High' | 'Critical' (required, default: 'Medium')
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed' (required, default: 'Open')
  orderId: ObjectId | undefined (ref: Order)
  adminNotes: string | undefined
  resolvedBy: string | undefined
  resolvedAt: Date | undefined
  canteenId: string (required)
  createdAt: Date (default: now())
  updatedAt: Date (default: now())
}
```

**Indexes**:
- None explicitly defined

**Category Meanings**:
- `Payment`: Payment issues (double charge, refund, failed transaction)
- `Service`: Service quality issues (rude staff, slow service)
- `Quality`: Food quality issues (taste, freshness, hygiene)
- `Technical`: App/system issues (crashes, bugs, feature requests)
- `General`: Other complaints

**Priority Meanings**:
- `Low`: Non-urgent, minor issue
- `Medium`: Standard priority
- `High`: Requires prompt attention
- `Critical`: Urgent, major issue affecting business

**Status Meanings**:
- `Open`: New complaint, not yet addressed
- `In Progress`: Admin is working on it
- `Resolved`: Issue resolved, awaiting user confirmation
- `Closed`: Complaint fully resolved and closed

**Ownership**: 
- Created by user (customerId)
- Managed by admin

**Lifecycle**:
- Created by user
- Admin reviews and updates status
- Status flows: Open → In Progress → Resolved → Closed

**Invariants**:
- If orderId exists, must reference valid Order

---

### **Payment**

**Collection**: `payments`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  orderId: ObjectId | undefined (ref: Order)
  canteenId: string | undefined
  merchantTransactionId: string (required, unique)
  phonePeTransactionId: string | undefined // Legacy
  razorpayTransactionId: string | undefined
  amount: number (required) // in rupees
  status: string (default: 'pending') 
    // 'pending' | 'success' | 'failed' | 'timeout' | 'authorized' | 'captured' | 'refunded'
  paymentMethod: string | undefined // 'upi' | 'card' | 'netbanking' | 'wallet'
  responseCode: string | undefined
  responseMessage: string | undefined
  checksum: string | undefined
  metadata: string | undefined // JSON
  createdAt: Date (default: now())
  updatedAt: Date (default: now())
}
```

**Indexes**:
- `{ canteenId: 1, createdAt: -1 }`
- `{ orderId: 1 }`
- `{ status: 1, createdAt: -1 }`
- `{ merchantTransactionId: 1 }` (unique)

**Status Meanings** (Razorpay):
- `pending`: Payment initiated, not completed
- `authorized`: Payment authorized by bank, awaiting capture
- `captured`: Payment successfully captured (equivalent to 'success')
- `failed`: Payment failed
- `refunded`: Payment refunded
- `timeout`: Payment timed out

**Ownership**: 
- System-generated on payment initiation

**Lifecycle**:
1. Created with status='pending' on payment initiation
2. Razorpay callback updates status
3. If status='authorized' or 'captured', order created
4. If status='failed', stock restored, order not created

**Invariants**:
- merchantTransactionId unique across system
- If orderId exists, must reference valid Order
- status must match Razorpay response codes

---

### **MediaBanner**

**Collection**: `mediabanners`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  fileName: string (required)
  originalName: string (required)
  mimeType: string (required)
  size: number (required) // bytes
  type: 'image' | 'video' (required)
  fileId: ObjectId | undefined // GridFS (legacy)
  cloudinaryPublicId: string | undefined
  cloudinaryUrl: string | undefined
  isActive: boolean (default: true)
  displayOrder: number (default: 0)
  uploadedBy: number | undefined // User.id
  createdAt: Date (default: now())
  updatedAt: Date (default: now())
}
```

**Indexes**:
- None explicitly defined

**Ownership**: 
- Uploaded by admin
- Displayed to all users on home page

**Lifecycle**:
- Uploaded by admin via Cloudinary
- Displayed in order of displayOrder
- Can be deactivated (isActive=false)
- Deleted by admin (removes from Cloudinary)

**Invariants**:
- If cloudinaryUrl exists, cloudinaryPublicId must exist

---

### **Coupon**

**Collection**: `coupons`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  code: string (required, unique, uppercase)
  description: string (required)
  discountType: 'percentage' | 'fixed' (required)
  discountValue: number (required)
  minimumOrderAmount: number (default: 0)
  maxDiscountAmount: number | undefined // For percentage type
  usageLimit: number (required)
  usedCount: number (default: 0)
  usedBy: number[] (default: []) // User IDs
  assignmentType: 'all' | 'specific' (default: 'all')
  assignedUsers: number[] (default: []) // User IDs (if specific)
  usageHistory: Array<{
    userId: number;
    orderId: ObjectId;
    orderNumber: string;
    discountAmount: number;
    usedAt: Date;
  }> (default: [])
  isActive: boolean (default: true)
  validFrom: Date (required)
  validUntil: Date (required)
  createdBy: number (required) // Admin user ID
  canteenId: string (required)
  createdAt: Date (default: now())
}
```

**Indexes**:
- `{ code: 1 }` (unique)

**Ownership**: 
- Created by admin
- Assigned to users

**Lifecycle**:
- Created by admin
- Applied by user during checkout
- usedCount incremented, usedBy and usageHistory updated
- Expires when validUntil reached or usageLimit reached

**Invariants**:
- code uppercase
- discountValue > 0
- If discountType='percentage', discountValue <= 100
- If assignmentType='specific', assignedUsers must not be empty
- usedCount <= usageLimit
- validFrom < validUntil
- User can use coupon only once (checked via usedBy array)

---

### **Counter**

**Collection**: `counters`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  name: string (required)
  code: string (required, uppercase)
  counterId: string (required, unique)
  canteenId: string (required)
  type: 'payment' | 'store' | 'kot' (required)
  createdAt: Date (default: now())
}
```

**Indexes**:
- `{ code: 1, canteenId: 1 }` (unique compound)

**Type Meanings**:
- `payment`: Counter for payment collection and order confirmation (offline orders)
- `store`: Counter for order fulfillment and item ready marking
- `kot`: Kitchen Order Ticket counter for kitchen staff

**Ownership**: 
- Owned by canteen owner
- Created by canteen owner

**Lifecycle**:
- Created by canteen owner
- Assigned to menu items (storeCounterId, paymentCounterId, kotCounterId)
- Used for order routing and status updates

**Invariants**:
- code + canteenId must be unique (allows same code across canteens)
- counterId globally unique

---

### **CodingChallenge**

**Collection**: `codingchallenges`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  name: string (required)
  description: string (required)
  questionCount: number (required, min: 0)
  totalQuestions: number (required, min: 1)
  tags: string[] (default: [])
  xpReward: number (required, min: 0)
  link: string | undefined
  rules: string | undefined
  termsAndConditions: string | undefined
  isActive: boolean (default: true)
  createdAt: Date (default: now())
  updatedAt: Date (default: now())
}
```

**Indexes**:
- None explicitly defined

**Ownership**: 
- Created by admin
- Gamification feature for canteens

**Lifecycle**:
- Created by admin
- Displayed to users if isActive=true
- XP rewards tracked per user (not implemented in current schema)

**Invariants**:
- questionCount <= totalQuestions
- xpReward >= 0

---

### **PaymentSession**

**Collection**: `paymentsessions`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  sessionId: string (required, unique)
  customerId: number (required) // User.id
  amount: number (required)
  canteenId: string (required)
  orderData: string (required) // JSON
  status: 'active' | 'completed' | 'expired' | 'cancelled' (default: 'active')
  expiresAt: Date (required)
  createdAt: Date (default: now())
  completedAt: Date | undefined
}
```

**Indexes**:
- `{ sessionId: 1 }`
- `{ customerId: 1, status: 1 }`
- `{ expiresAt: 1 }` (TTL: 3600 seconds)
- `{ status: 1, createdAt: -1 }`

**Ownership**: 
- System-generated on payment initiation

**Lifecycle**:
- Created when user initiates payment
- Prevents duplicate payment requests
- Status updated to 'completed' on successful payment
- Auto-deleted 1 hour after expiration (TTL index)

**Invariants**:
- sessionId unique
- Only one active session per customerId + orderData combination
- expiresAt typically 15 minutes from creation

---

### **CheckoutSession**

**Collection**: `checkoutsessions`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  sessionId: string (required, unique)
  customerId: number (required) // User.id
  canteenId: string | undefined
  status: 'active' | 'completed' | 'abandoned' | 'expired' | 'payment_initiated' | 'payment_completed' | 'payment_failed' (default: 'active')
  expiresAt: Date (required)
  createdAt: Date (default: now())
  completedAt: Date | undefined
  abandonedAt: Date | undefined
  lastActivity: Date (default: now())
  metadata: string | undefined // JSON
}
```

**Indexes**:
- `{ sessionId: 1 }`
- `{ customerId: 1, status: 1 }`
- `{ status: 1, expiresAt: 1 }`
- `{ createdAt: -1 }`
- `{ expiresAt: 1 }` (TTL: 7200 seconds)

**Status Meanings**:
- `active`: User browsing checkout page
- `payment_initiated`: User clicked "Pay Now", Razorpay order created
- `payment_completed`: Payment successful, order created
- `payment_failed`: Payment failed, stock restored
- `abandoned`: User left checkout without completing
- `expired`: Session expired
- `completed`: Order successfully placed

**Ownership**: 
- System-generated on checkout page load

**Lifecycle**:
- Created when user navigates to checkout
- lastActivity updated on user interactions
- Status flows: active → payment_initiated → payment_completed/payment_failed → completed
- Auto-deleted 2 hours after expiration (TTL index)

**Invariants**:
- sessionId unique
- expiresAt typically 15-20 minutes from creation

---

### **Printer**

**Collection**: `printers`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  agentId: string (required)
  printerId: string (required)
  name: string (required)
  type: 'usb' | 'network' | 'bluetooth' | 'windows' (required)
  isDefault: boolean (default: false)
  capabilities: string (default: '{}') // JSON
  createdAt: Date (default: now())
}
```

**Indexes**:
- `{ agentId: 1 }`
- `{ agentId: 1, printerId: 1 }` (unique compound)

**Ownership**: 
- Registered by print agent
- Associated with PrintAgent

**Lifecycle**:
- Registered when print agent connects
- Updated when printer capabilities change

**Invariants**:
- agentId + printerId must be unique
- agentId must reference valid PrintAgent

---

### **PrintAgent**

**Collection**: `printagents`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  agentId: string (required, unique)
  outletId: string (required) // canteenId
  apiKey: string (required) // Encrypted
  version: string (required)
  platform: string (required) // 'Windows', 'Linux', 'Mac'
  status: 'online' | 'offline' (default: 'offline')
  capabilities: string (default: '{}') // JSON
  lastSeen: Date (default: now())
  createdAt: Date (default: now())
  updatedAt: Date (default: now())
}
```

**Indexes**:
- `{ agentId: 1 }` (unique)
- `{ outletId: 1 }`
- `{ outletId: 1, status: 1 }`
- `{ status: 1 }`

**Ownership**: 
- Created by canteen owner
- Runs on local machine at canteen

**Lifecycle**:
- Created when paired via pairing code
- Status updated to 'online' on connection
- Status updated to 'offline' on disconnect
- lastSeen updated on heartbeat

**Invariants**:
- agentId unique
- apiKey encrypted

---

### **PrintJob**

**Collection**: `printjobs`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  jobId: string (required, unique)
  outletId: string (required) // canteenId
  agentId: string | undefined
  receiptType: 'KOT' | 'BILL' | 'TOKEN' (required)
  content: string (required) // JSON
  escposCommands: string | undefined // JSON
  printerType: 'usb' | 'network' | 'bluetooth' | 'windows' | undefined
  targetPrinter: string | undefined
  priority: 'normal' | 'high' | 'urgent' (default: 'normal')
  status: 'pending' | 'sent' | 'printed' | 'failed' | 'retrying' (default: 'pending')
  error: string | undefined
  orderId: ObjectId | undefined (ref: Order)
  orderNumber: string | undefined
  createdAt: Date (default: now())
  updatedAt: Date (default: now())
  printedAt: Date | undefined
  sentAt: Date | undefined
}
```

**Indexes**:
- `{ jobId: 1 }` (unique)
- `{ outletId: 1, status: 1, createdAt: -1 }`
- `{ agentId: 1, status: 1 }`
- `{ status: 1, priority: -1, createdAt: 1 }`
- `{ orderId: 1 }`
- `{ orderNumber: 1 }`

**Receipt Type Meanings**:
- `KOT`: Kitchen Order Ticket (sent to kitchen)
- `BILL`: Customer bill/invoice
- `TOKEN`: Order token for pickup

**Status Meanings**:
- `pending`: Created, waiting for agent
- `sent`: Sent to print agent
- `printed`: Successfully printed
- `failed`: Print failed
- `retrying`: Retrying after failure

**Ownership**: 
- System-generated on order events

**Lifecycle**:
- Created on order status change
- Assigned to PrintAgent
- Status updated by PrintAgent

**Invariants**:
- jobId unique
- If orderId exists, must reference valid Order

---

### **PairingCode**

**Collection**: `pairingcodes`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  code: string (required, unique)
  outletId: string (required) // canteenId
  expiresAt: Date (required)
  used: boolean (default: false)
  usedBy: string | undefined // agentId
  createdAt: Date (default: now())
}
```

**Indexes**:
- `{ code: 1 }`
- `{ outletId: 1, expiresAt: -1 }`
- `{ expiresAt: 1 }` (TTL: 3600 seconds)

**Ownership**: 
- Generated by canteen owner

**Lifecycle**:
- Created by canteen owner for print agent pairing
- Used by print agent on first connection
- Auto-deleted 1 hour after expiration (TTL index)

**Invariants**:
- code unique (6-digit alphanumeric)
- Cannot be reused (used=true after first use)

---

### **UserAddress**

**Collection**: `useraddresses`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  userId: number (required) // User.id
  label: string (required) // "Home", "Work", "College"
  fullName: string (required)
  phoneNumber: string (required)
  addressLine1: string (required)
  addressLine2: string | undefined
  city: string (required)
  state: string (required)
  pincode: string (required)
  landmark: string | undefined
  isDefault: boolean (default: false)
  createdAt: Date (default: now())
  updatedAt: Date (default: now())
}
```

**Indexes**:
- `{ userId: 1, createdAt: -1 }`
- `{ userId: 1, isDefault: 1 }`

**Ownership**: 
- Owned by user (userId)

**Lifecycle**:
- Created by user
- Updated by user
- Selected during checkout for delivery orders

**Invariants**:
- Only one address can be default per user
- phoneNumber must be valid format

---

### **OrganizationQRCode**

**Collection**: `organizationqrcodes`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  qrId: string (required, unique)
  organizationId: string (required)
  address: string (required) // Legacy simple string
  fullAddress: {
    label: string;
    fullName: string | undefined;
    phoneNumber: string | undefined;
    addressLine1: string;
    addressLine2: string | undefined;
    city: string;
    state: string;
    pincode: string;
    landmark: string | undefined;
  } | undefined
  qrCodeUrl: string (required)
  hash: string (required) // Security hash
  isActive: boolean (default: true)
  createdAt: Date (default: now())
  updatedAt: Date (default: now())
}
```

**Indexes**:
- `{ organizationId: 1, isActive: 1 }`
- `{ qrId: 1 }`
- `{ hash: 1 }`

**Ownership**: 
- Created by organization admin
- Used for delivery address auto-fill

**Lifecycle**:
- Created by organization admin
- Scanned by users for delivery orders
- Address auto-filled from fullAddress

**Invariants**:
- qrId unique
- hash must be valid for security

---

### **Settlement**

**Collection**: `settlements`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  settlementId: string (required, unique)
  canteenId: string (required)
  amount: number (required) // in paise
  periodStart: Date (required)
  periodEnd: Date (required)
  orderIds: string[] (default: [])
  orderCount: number (default: 0)
  status: 'pending' | 'processing' | 'completed' | 'failed' (default: 'pending')
  payoutRequestId: string | undefined
  processedAt: Date | undefined
  processedBy: number | undefined // Admin user ID
  transactionId: string | undefined
  notes: string | undefined
  createdAt: Date (default: now())
  updatedAt: Date (default: now())
}
```

**Indexes**:
- `{ canteenId: 1, createdAt: -1 }`
- `{ settlementId: 1 }`
- `{ status: 1, createdAt: -1 }`
- `{ payoutRequestId: 1 }`

**Status Meanings**:
- `pending`: Created, awaiting processing
- `processing`: Admin is processing payout
- `completed`: Payout completed
- `failed`: Payout failed

**Ownership**: 
- Created by admin for canteen owner payout

**Lifecycle**:
- Created by admin after approving payout request
- Status updated during payout processing
- transactionId added when bank transfer completed

**Invariants**:
- settlementId unique
- orderIds must reference valid Orders
- amount = sum of order amounts for orderIds

---

### **PayoutRequest**

**Collection**: `payoutrequests`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  requestId: string (required, unique)
  canteenId: string (required)
  amount: number (required) // in paise
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'cancelled' (default: 'pending')
  requestedBy: number | undefined // Canteen owner user ID
  requestedAt: Date (default: now())
  orderIds: string[] (default: [])
  orderCount: number (default: 0)
  periodStart: Date | undefined
  periodEnd: Date | undefined
  reviewedBy: number | undefined // Admin user ID
  reviewedAt: Date | undefined
  approvedBy: number | undefined
  approvedAt: Date | undefined
  rejectedBy: number | undefined
  rejectedAt: Date | undefined
  rejectionReason: string | undefined
  settlementId: string | undefined
  notes: string | undefined
  createdAt: Date (default: now())
  updatedAt: Date (default: now())
}
```

**Indexes**:
- `{ canteenId: 1, createdAt: -1 }`
- `{ requestId: 1 }`
- `{ status: 1, createdAt: -1 }`
- `{ requestedBy: 1 }`
- `{ settlementId: 1 }`

**Status Meanings**:
- `pending`: Submitted by canteen owner, awaiting review
- `approved`: Approved by admin, awaiting processing
- `rejected`: Rejected by admin
- `processing`: Admin is processing payout
- `completed`: Payout completed (Settlement created)
- `cancelled`: Cancelled by owner or admin

**Ownership**: 
- Created by canteen owner (requestedBy)
- Managed by admin

**Lifecycle**:
- Created by canteen owner
- Admin reviews: approved or rejected
- If approved: status → processing → completed
- Settlement created on completion

**Invariants**:
- requestId unique
- orderIds must reference valid Orders
- amount = sum of order amounts for orderIds
- If status='approved', approvedBy and approvedAt must exist
- If status='rejected', rejectedBy and rejectionReason must exist

---

### **PositionBid**

**Collection**: `positionbids`

**Fields**:
```typescript
{
  _id: ObjectId (PK)
  bidId: string (required, unique)
  canteenId: string (required)
  organizationId: string | undefined
  collegeId: string | undefined
  targetDate: Date (required) // Next day
  bidAmount: number (required) // in paise
  status: 'pending' | 'closed' | 'paid' | 'failed' | 'expired' | 'active' (default: 'pending')
  paymentStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' (default: 'pending')
  paymentTransactionId: string | undefined
  priority: number | undefined // Calculated after payment
  biddingClosedAt: Date | undefined // 1 PM day before
  paymentDueAt: Date | undefined // 3 PM day before
  paidAt: Date | undefined
  createdAt: Date (default: now())
  updatedAt: Date (default: now())
}
```

**Indexes**:
- `{ canteenId: 1, targetDate: 1 }`
- `{ organizationId: 1, targetDate: 1, status: 1 }`
- `{ collegeId: 1, targetDate: 1, status: 1 }`
- `{ targetDate: 1, status: 1, bidAmount: -1 }`
- `{ status: 1, paymentStatus: 1, targetDate: 1 }`
- `{ bidId: 1 }`

**Bid Status Meanings**:
- `pending`: Bid placed, bidding window open
- `closed`: Bidding closed at 1 PM, awaiting payment
- `paid`: Payment completed
- `active`: Bid is active for target date
- `failed`: Payment failed
- `expired`: Payment deadline passed

**Payment Status**:
- `pending`: Payment not initiated
- `processing`: Payment in progress
- `completed`: Payment successful
- `failed`: Payment failed
- `refunded`: Payment refunded

**Ownership**: 
- Created by canteen owner

**Lifecycle**:
1. Canteen owner places bid before 1 PM day before
2. Bidding closes at 1 PM → status='closed'
3. Top bids notified, payment due by 3 PM
4. Payment completed → paymentStatus='completed', status='paid'
5. At midnight, status='active' for target date
6. Priority calculated based on bid amount ranking

**Invariants**:
- targetDate must be tomorrow (validated on creation)
- bidAmount > 0
- One bid per canteen per target date per institution
- If status='paid', paymentStatus must be 'completed'

---

### **SystemSettings**

**Collection**: `systemsettings`

**Schema**: Highly nested, defined in [server/routes/systemSettings.ts](file:///d:/steepanProjects/sillobite-pos/sillobite/server/routes/systemSettings.ts)

**Top-Level Fields**:
```typescript
{
  _id: ObjectId (PK)
  maintenanceMode: {
    isActive: boolean;
    title: string;
    message: string;
    estimatedTime: string | undefined;
    contactInfo: string | undefined;
    targetingType: 'all' | 'specific' | 'college' | 'department' | 'year' | 'year_college' | 'year_department';
    specificUsers: string[];
    targetColleges: string[];
    targetDepartments: string[];
    targetYears: number[];
    yearType: 'joining' | 'passing' | 'current';
    lastUpdatedBy: number | undefined;
    lastUpdatedAt: Date | undefined;
  };
  notifications: {
    isEnabled: boolean;
    lastUpdatedBy: number | undefined;
    lastUpdatedAt: Date | undefined;
  };
  appVersion: {
    version: string;
    buildTimestamp: number;
    lastUpdatedBy: number | undefined;
    lastUpdatedAt: Date | undefined;
  };
  colleges: {
    list: Array<{
      id: string;
      name: string;
      code: string;
      isActive: boolean;
      departments: Array<{
        code: string;
        name: string;
        isActive: boolean;
        studyDuration: number | undefined;
        registrationFormats: Array<{...}>;
        createdAt: Date;
        updatedAt: Date;
      }>;
      createdAt: Date;
      updatedAt: Date;
    }>;
    lastUpdatedBy: number | undefined;
    lastUpdatedAt: Date | undefined;
  };
  canteens: {
    list: Array<{
      id: string;
      name: string;
      code: string;
      description: string | undefined;
      location: string | undefined;
      contactNumber: string | undefined;
      email: string | undefined;
      canteenOwnerEmail: string | undefined;
      collegeId: string | undefined; // Legacy
      collegeIds: string[] | undefined;
      organizationId: string | undefined; // Legacy
      organizationIds: string[] | undefined;
      restaurantId: string | undefined;
      type: string | undefined;
      operatingHours: {
        open: string;
        close: string;
        days: string[];
      };
      isActive: boolean;
      codingChallengesEnabled: boolean;
      payAtCounterEnabled: boolean;
      deliveryEnabled: boolean;
      ownerSidebarConfig: Map<string, boolean>;
      priority: number;
      createdAt: Date;
      updatedAt: Date;
    }>;
    lastUpdatedBy: number | undefined;
    lastUpdatedAt: Date | undefined;
  };
  createdAt: Date (default: now())
  updatedAt: Date (default: now())
}
```

**Ownership**: 
- Managed by admin and super_admin

**Lifecycle**:
- Single document (singleton pattern)
- Updated by admin via system settings routes
- Queried by all users for app configuration

**Invariants**:
- Only one SystemSettings document should exist
- colleges.list[].code must be unique
- canteens.list[].code must be unique
- departments[].code must be unique within a college

---

## **Cross-Model Relationships**

### **User ↔ Order**
- `Order.customerId` → `User.id` (PostgreSQL)
- One user can have many orders
- Orders query: `{ customerId: userId, status: { $in: ['preparing', 'ready'] } }`

### **DeliveryPerson ↔ Order**
- `Order.deliveryPersonId` → `DeliveryPerson.deliveryPersonId` (PostgreSQL)
- One delivery person can have many active orders
- Orders query: `{ deliveryPersonId: dpId, status: 'out_for_delivery' }`

### **Category ↔ MenuItem**
- `MenuItem.categoryId` → `Category._id` (MongoDB)
- One category can have many menu items
- Cascade delete not enforced (application-level check required)

### **MenuItem ↔ Order**
- `Order.items` (JSON string) contains menu item IDs
- Denormalized for performance (no foreign key)

### **Order ↔ Payment**
- `Payment.orderId` → `Order._id` (MongoDB)
- One order can have one payment
- Payment created before order if online payment

### **Order ↔ Complaint**
- `Complaint.orderId` → `Order._id` (MongoDB)
- One order can have many complaints

### **Coupon ↔ Order**
- `Order.appliedCoupon` → `Coupon.code` (string reference)
- Coupon usage tracked in `Coupon.usageHistory`

### **Canteen (SystemSettings) ↔ Everything**
- `canteenId` string field in most models
- References `SystemSettings.canteens.list[].id`
- No foreign key enforcement (application-level validation)

---

## **Critical Invariants (Must Never Be Violated)**

### **Order Lifecycle**
1. **Stock consistency**: When order created, stock decremented. If order cancelled, stock restored.
2. **Payment-order linkage**: If `paymentMethod='online'`, payment must exist with `status='captured'` or `status='authorized'`.
3. **Delivery assignment**: If `status='out_for_delivery'`, `deliveryPersonId` must be set and DeliveryPerson.isAvailable=false.
4. **Status transitions**: Must follow valid flow:
   - `pending` → `preparing` | `cancelled`
   - `preparing` → `ready` | `cancelled`
   - `ready` → `out_for_delivery` (delivery) | `completed` (takeaway) | `cancelled`
   - `out_for_delivery` → `delivered` | `cancelled`
   - `delivered` → `completed`
   - `cancelled` (terminal state)
5. **Barcode uniqueness**: Order.barcode must be globally unique.
6. **Amount calculation**: `amount = itemsSubtotal + taxAmount + chargesTotal - discountAmount`

### **Payment Integrity**
1. **Idempotency**: merchantTransactionId unique across all payments.
2. **Duplicate prevention**: PaymentSession prevents duplicate payment attempts.
3. **Order creation**: Order created only if payment status='captured' or 'authorized'.
4. **Stock restoration**: If payment fails, stock must be restored.

### **Coupon Usage**
1. **One-time use**: User cannot use same coupon twice (enforced via `usedBy` array).
2. **Usage limit**: `usedCount <= usageLimit`.
3. **Validity**: Current date must be between `validFrom` and `validUntil`.
4. **Assignment**: If `assignmentType='specific'`, user must be in `assignedUsers` array.

### **User Authentication**
1. **Email uniqueness**: User.email globally unique.
2. **Role-based fields**: Student must have registerNumber; Staff/Employee must have staffId.
3. **Register number format**: Must match college-specific format from SystemSettings.

### **Delivery Person**
1. **Availability**: Cannot be assigned to multiple orders simultaneously (isAvailable=false when assigned).
2. **Order count**: totalOrderDelivered incremented only when order status='delivered'.

### **Canteen Configuration**
1. **Menu items**: All menu items must belong to active canteen.
2. **Counter assignment**: MenuItem counters must reference valid Counters for same canteen.

---

## **Enum Values (Validated by Application)**

### **Order Status**
```typescript
type OrderStatus = 
  | 'pending'           // Awaiting owner acceptance (offline only)
  | 'preparing'         // Being prepared in kitchen
  | 'ready'             // Ready for pickup/delivery
  | 'out_for_delivery'  // With delivery person
  | 'delivered'         // Delivered by delivery person
  | 'completed'         // Customer confirmed receipt
  | 'cancelled';        // Cancelled by owner or system
```

### **Payment Status**
```typescript
type PaymentStatus = 
  | 'PENDING'   // Payment not completed
  | 'PAID'      // Payment successful
  | 'FAILED';   // Payment failed
```

### **Razorpay Payment Status**
```typescript
type RazorpayStatus = 
  | 'pending'     // Payment initiated
  | 'authorized'  // Bank authorized, not captured
  | 'captured'    // Successfully captured (equivalent to PAID)
  | 'failed'      // Payment failed
  | 'refunded'    // Payment refunded
  | 'timeout';    // Payment timed out
```

### **User Role**
```typescript
type UserRole = 
  | 'student'
  | 'staff'
  | 'employee'
  | 'guest'
  | 'canteen_owner'
  | 'admin'
  | 'super_admin'
  | 'contractor'
  | 'visitor'
  | `blocked_${string}`; // Blocked users
```

### **Complaint Category**
```typescript
type ComplaintCategory = 
  | 'Payment'   // Payment issues
  | 'Service'   // Service quality
  | 'Quality'   // Food quality
  | 'Technical' // App/system issues
  | 'General';  // Other
```

### **Complaint Priority**
```typescript
type ComplaintPriority = 
  | 'Low'      // Non-urgent
  | 'Medium'   // Standard
  | 'High'     // Urgent
  | 'Critical'; // Critical business issue
```

### **Complaint Status**
```typescript
type ComplaintStatus = 
  | 'Open'        // New, not addressed
  | 'In Progress' // Being worked on
  | 'Resolved'    // Resolved, awaiting confirmation
  | 'Closed';     // Fully closed
```

### **Counter Type**
```typescript
type CounterType = 
  | 'payment' // Payment collection counter
  | 'store'   // Order fulfillment counter
  | 'kot';    // Kitchen counter
```

### **Order Type**
```typescript
type OrderType = 
  | 'delivery' // Home delivery
  | 'takeaway'; // Pickup from counter
```

### **Settlement Status**
```typescript
type SettlementStatus = 
  | 'pending'    // Created, not processed
  | 'processing' // Being processed
  | 'completed'  // Payout completed
  | 'failed';    // Payout failed
```

### **Payout Request Status**
```typescript
type PayoutRequestStatus = 
  | 'pending'    // Submitted, awaiting review
  | 'approved'   // Approved by admin
  | 'rejected'   // Rejected by admin
  | 'processing' // Being processed
  | 'completed'  // Payout completed
  | 'cancelled'; // Cancelled
```

### **Position Bid Status**
```typescript
type PositionBidStatus = 
  | 'pending'  // Bid placed, window open
  | 'closed'   // Bidding closed, awaiting payment
  | 'paid'     // Payment completed
  | 'active'   // Bid active for target date
  | 'failed'   // Payment failed
  | 'expired'; // Payment deadline passed
```

---

## **Data Ownership by Role**

### **Student/Staff/Employee/Guest (Customer)**
- **Owns**: UserAddress, Complaint (as submitter)
- **Creates**: Order (as customer)
- **References**: Order.customerId

### **Canteen Owner**
- **Owns**: Category, MenuItem, CanteenCharge, CanteenSettings, Counter, DeliveryPerson, PrintAgent, Printer
- **Creates**: PayoutRequest
- **Manages**: Order (status updates), Coupon (via canteenId)
- **References**: SystemSettings.canteens.list[] (canteenOwnerEmail)

### **Admin**
- **Owns**: MediaBanner, Coupon, CodingChallenge, SystemSettings
- **Creates**: Settlement
- **Manages**: LoginIssue, Complaint, PayoutRequest (approval), User (blocking)

### **Super Admin**
- **Owns**: SystemSettings (full control)
- **Manages**: All admin capabilities + canteen creation/deletion

### **System (Auto-generated)**
- **Creates**: Payment, PaymentSession, CheckoutSession, Notification, NotificationTemplate, PrintJob, PairingCode

---

**End of document. All information derived from code analysis.**
