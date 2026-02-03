// Re-export Prisma types for User (PostgreSQL)
export type {
  User,
  Prisma
} from '@prisma/client';

// Re-export insert types from Prisma
export type InsertUser = Prisma.UserCreateInput;

// MongoDB types (defined in mongodb-models.ts)
// MongoDB types (defined in mongodb-models.ts)
import { UserRole } from '@prisma/client';
export { UserRole };

export type Category = {
  id: string;
  name: string;
  canteenId: string;
  icon?: string;
  imageUrl?: string;
  imagePublicId?: string;
  createdAt: Date;
};

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  categoryId?: string;
  canteenId: string;
  available: boolean;
  stock: number;
  description?: string;
  addOns: string;
  isVegetarian: boolean;
  isMarkable: boolean; // true = requires manual ready marking, false = auto-ready
  isTrending: boolean;
  isQuickPick: boolean; // true = marked as quick pick for faster ordering
  imageUrl?: string; // Cloudinary image URL
  imagePublicId?: string; // Cloudinary public ID for deletion
  storeCounterId?: string; // Store counter ID for this menu item
  paymentCounterId?: string; // Payment counter ID for this menu item
  kotCounterId?: string; // KOT (Kitchen Order Ticket) counter ID for this menu item (optional)
  cookingTime?: number; // Cooking/preparation time in minutes (optional, defaults to 0)
  calories?: number; // Calorie content in kcal (optional, defaults to 0)
  createdAt: Date;
};

export type Order = {
  id: string;
  orderNumber: string;
  customerId?: number; // PostgreSQL user ID
  customerName: string;
  collegeName?: string; // College name for display
  items: string;
  amount: number;
  itemsSubtotal?: number; // Subtotal of items only (no tax, no charges)
  taxAmount?: number; // Tax amount (e.g., 5% GST for POS orders)
  chargesTotal?: number; // Total canteen charges
  originalAmount?: number; // Amount before discount
  discountAmount?: number; // Discount applied
  appliedCoupon?: string; // Coupon code used
  status: string;
  estimatedTime: number;
  barcode: string;
  barcodeUsed: boolean;
  deliveredAt?: Date;
  seenBy?: number[]; // Array of user IDs who have seen this order
  canteenId: string;
  counterId?: string; // Counter ID for counter-specific orders
  storeCounterId?: string; // Store counter ID for order processing
  paymentCounterId?: string; // Payment counter ID for order processing
  kotCounterId?: string; // KOT counter ID for order processing
  paymentConfirmedBy?: string; // Payment counter ID that confirmed the payment (for offline orders)
  rejectedBy?: string; // Payment counter ID that rejected the order (for offline orders)
  allStoreCounterIds?: string[]; // All store counter IDs for this order
  allPaymentCounterIds?: string[]; // All payment counter IDs for this order
  allKotCounterIds?: string[]; // All KOT counter IDs for this order
  allCounterIds?: string[]; // All counter IDs for this order
  itemStatusByCounter?: { [counterId: string]: { [itemId: string]: 'pending' | 'ready' | 'completed' } }; // Item-level status per counter
  deliveryPersonId?: string; // Delivery person assigned to this order
  orderType?: 'delivery' | 'takeaway'; // Order type: delivery or takeaway
  deliveryAddress?: {
    label?: string;
    fullName?: string;
    phoneNumber?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmark?: string;
  }; // Delivery address for delivery orders
  createdAt: Date;
};

export type OrderItem = {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  price: number;
};

export type Notification = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  canteenId: string;
  createdAt: Date;
};

export type LoginIssue = {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  registerNumber?: string;
  staffId?: string;
  issueType: string;
  description: string;
  status: string;
  adminNotes?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
};

export type Complaint = {
  id: string;
  subject: string;
  description: string;
  userId?: number; // PostgreSQL user ID
  userName: string;
  userEmail?: string;
  category: string; // 'Payment', 'Service', 'Quality', 'Technical', 'General'
  priority: string; // 'Low', 'Medium', 'High', 'Critical'
  status: string; // 'Open', 'In Progress', 'Resolved', 'Closed'
  orderId?: string; // Related order if applicable
  adminNotes?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  canteenId: string;
  createdAt: Date;
  updatedAt: Date;
};


export type Payment = {
  id: string;
  orderId?: string;
  merchantTransactionId: string;
  phonePeTransactionId?: string; // Legacy field for backward compatibility
  razorpayTransactionId?: string;
  amount: number;
  status: string;
  paymentMethod?: string;
  responseCode?: string;
  responseMessage?: string;
  checksum?: string;
  metadata?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MediaBanner = {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  type: 'image' | 'video';
  fileId?: string; // GridFS file ID (legacy support)
  cloudinaryPublicId?: string; // Cloudinary public ID
  cloudinaryUrl?: string; // Cloudinary secure URL
  isActive: boolean;
  displayOrder: number;
  displayMode?: 'fit' | 'fill'; // How to display the image: fit (contain) or fill (cover)
  uploadedBy?: number; // User ID who uploaded
  createdAt: Date;
  updatedAt: Date;
};


export type CouponUsageHistory = {
  userId: number;
  orderId: string;
  orderNumber: string;
  discountAmount: number;
  usedAt: Date;
};

export type Coupon = {
  id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minimumOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit: number;
  usedCount: number;
  usedBy: number[];
  assignmentType: 'all' | 'specific'; // Whether coupon is for all users or specific users
  assignedUsers: number[]; // Array of user IDs the coupon is assigned to (only for specific assignment)
  usageHistory: CouponUsageHistory[]; // Detailed usage history
  isActive: boolean;
  validFrom: Date;
  validUntil: Date;
  createdBy: number;
  canteenId: string;
  createdAt: Date;
};

export type Counter = {
  id: string;
  name: string;
  code: string;
  counterId: string; // Unique counter ID
  canteenId: string;
  type: 'payment' | 'store' | 'kot'; // Counter type: payment, store mode, or KOT (Kitchen Order Ticket)
  createdAt: Date;
};

export type Restaurant = {
  id: string;
  name: string;
  description?: string;
  address: string;
  contactNumber: string;
  email?: string;
  website?: string;
  totalFloors: number;
  totalKitchens: number;
  totalSeatingCapacity: number;
  operatingHours: {
    open: string;
    close: string;
    days: string[];
  };
  amenities: string[];
  cuisineTypes: string[];
  priceRange: 'budget' | 'moderate' | 'expensive' | 'luxury';
  hasParking: boolean;
  hasWifi: boolean;
  hasDelivery: boolean;
  hasTakeaway: boolean;
  hasDineIn: boolean;
  imageUrl?: string;
  imagePublicId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type RestaurantEmployee = {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  phoneNumber: string;
  employeeId: string;
  role: 'manager' | 'assistant_manager' | 'general_manager' | 'operations_manager' | 'shift_supervisor' | 'chef' | 'sous_chef' | 'line_cook' | 'prep_cook' | 'pastry_chef' | 'kitchen_manager' | 'dishwasher' | 'waiter' | 'waitress' | 'server' | 'bartender' | 'host' | 'hostess' | 'busser' | 'food_runner' | 'barback' | 'cashier' | 'receptionist' | 'delivery_driver' | 'cleaner' | 'janitor' | 'maintenance' | 'housekeeping' | 'security_guard' | 'bouncer' | 'security_manager' | 'other';
  department: 'kitchen' | 'service' | 'management' | 'cleaning' | 'security' | 'other';
  shift: 'morning' | 'afternoon' | 'evening' | 'night' | 'full_day' | 'custom';
  customShiftStart?: string; // For custom shift timing (HH:MM format)
  customShiftEnd?: string; // For custom shift timing (HH:MM format)
  salary?: number;
  hireDate: Date;
  isActive: boolean;
  assignedTables?: string[]; // Array of table IDs
  createdAt: Date;
  updatedAt: Date;
};

export type RestaurantTable = {
  id: string;
  restaurantId: string;
  tableNumber: string;
  floor: number;
  location: string; // e.g., "Near window", "Center", "Private booth"
  seatingCapacity: number;
  tableType: 'regular' | 'booth' | 'bar' | 'outdoor' | 'private' | 'family';
  isAccessible: boolean;
  // Service Department
  assignedWaiter?: string; // Employee ID
  assignedHost?: string; // Employee ID
  assignedBartender?: string; // Employee ID
  assignedBusser?: string; // Employee ID
  // Support Department
  assignedCleaner?: string; // Employee ID
  assignedSecurity?: string; // Employee ID
  status: 'available' | 'occupied' | 'reserved' | 'maintenance' | 'cleaning';
  specialFeatures?: string[]; // e.g., ["TV", "Power outlet", "View"]
  qrCodeUrl?: string; // QR code URL for table access
  imageUrl?: string;
  imagePublicId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// DeliveryPerson type from PostgreSQL (Prisma)
export type DeliveryPerson = {
  id: number;
  deliveryPersonId: string; // Unique identifier like DP001, DP002, etc.
  canteenId: string;
  name: string;
  phoneNumber: string;
  email?: string | null;
  employeeId?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  dateOfBirth?: Date | null;
  dateOfJoining?: Date | null;
  vehicleNumber?: string | null;
  licenseNumber?: string | null;
  emergencyContact?: string | null;
  emergencyContactName?: string | null;
  salary?: number | null;
  isActive: boolean;
  isAvailable: boolean;
  totalOrderDelivered: number;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SystemSettings = {
  id: string;
  maintenanceMode: {
    isActive: boolean;
    title: string;
    message: string;
    estimatedTime?: string;
    contactInfo?: string;
    // Targeting options - if all are empty/null, applies to everyone
    targetingType: string; // 'all', 'specific', 'college', 'department', 'year', 'year_college', 'year_department'
    specificUsers: string[]; // Array of registerNumbers or staffIds
    targetColleges: string[]; // Array of college codes
    targetDepartments: string[]; // Array of department codes
    targetYears: number[]; // Array of years (joiningYear, passingOutYear, currentStudyYear)
    yearType: string; // 'joining', 'passing', 'current'
    lastUpdatedBy?: number;
    lastUpdatedAt?: Date;
  };
  notifications: {
    isEnabled: boolean;
    lastUpdatedBy?: number;
    lastUpdatedAt?: Date;
  };
  appVersion: {
    version: string;
    buildTimestamp: number;
    lastUpdatedBy?: number;
    lastUpdatedAt?: Date;
  };
  colleges: {
    list: Array<{
      id: string;
      name: string;
      code: string;

      isActive: boolean;
      adminEmail?: string; // Admin email for college-specific notifications
      departments: Array<{
        code: string;
        name: string;
        isActive: boolean;
        studyDuration?: number; // Duration in years
        registrationFormats?: Array<{
          id: string; // Unique identifier for each format
          name: string; // Human-readable name for the format
          year: number;
          formats: {
            student: {
              totalLength: number;
              structure: Array<{
                position: number;
                type: 'digit' | 'alphabet' | 'alphanumeric' | 'fixed' | 'numbers_range' | 'year';
                value?: string; // For fixed characters
                description?: string;
                range?: {
                  min: number;
                  max: number;
                  positions: number[]; // Array of positions this range occupies
                };
                yearType?: 'starting' | 'passing_out'; // For year type
              }>;
              specialCharacters: Array<{
                character: string;
                positions: number[]; // Allowed positions
                description?: string;
              }>;
              example?: string;
              description?: string;
            };
            staff: {
              totalLength: number;
              structure: Array<{
                position: number;
                type: 'digit' | 'alphabet' | 'alphanumeric' | 'fixed' | 'numbers_range' | 'year';
                value?: string;
                description?: string;
                range?: {
                  min: number;
                  max: number;
                  positions: number[];
                };
              }>;
              departmentCode: {
                required: boolean;
                positions: number[];
                separator?: string;
              };
              specialCharacters: Array<{
                character: string;
                positions: number[];
                description?: string;
              }>;
              example?: string;
              description?: string;
            };
            employee: {
              totalLength: number;
              structure: Array<{
                position: number;
                type: 'digit' | 'alphabet' | 'alphanumeric' | 'fixed' | 'numbers_range' | 'year';
                value?: string;
                description?: string;
                range?: {
                  min: number;
                  max: number;
                  positions: number[];
                };
              }>;
              departmentCode: {
                required: boolean;
                positions: number[];
                separator?: string;
              };
              specialCharacters: Array<{
                character: string;
                positions: number[];
                description?: string;
              }>;
              example?: string;
              description?: string;
            };
            guest: {
              totalLength: number;
              structure: Array<{
                position: number;
                type: 'digit' | 'alphabet' | 'alphanumeric' | 'fixed' | 'numbers_range' | 'year';
                value?: string;
                description?: string;
                range?: {
                  min: number;
                  max: number;
                  positions: number[];
                };
              }>;
              departmentCode: {
                required: boolean;
                positions: number[];
                separator?: string;
              };
              specialCharacters: Array<{
                character: string;
                positions: number[];
                description?: string;
              }>;
              example?: string;
              description?: string;
            };
          };
          createdAt: Date;
          updatedAt: Date;
        }>;
        createdAt: Date;
        updatedAt: Date;
      }>;
      createdAt: Date;
      updatedAt: Date;
    }>;
    lastUpdatedBy?: number;
    lastUpdatedAt?: Date;
  };
  canteens: {
    list: Array<{
      id: string;
      name: string;
      code: string;
      description?: string;
      location?: string;
      contactNumber?: string;
      email?: string;
      canteenOwnerEmail?: string;
      collegeId?: string; // Legacy field - kept for backward compatibility
      collegeIds?: string[]; // Array of college IDs this canteen serves
      organizationId?: string; // Legacy field - kept for backward compatibility
      organizationIds?: string[]; // Array of organization IDs this canteen serves
      restaurantId?: string;
      type?: string;
      operatingHours?: {
        open: string;
        close: string;
        days: string[];
      };
      isActive: boolean;
      codingChallengesEnabled?: boolean; // Enable/disable coding challenges feature
      payAtCounterEnabled?: boolean; // Allow pay-at-counter option
      deliveryEnabled?: boolean; // Allow delivery orders
      priority?: number; // Priority for ordering (lower number = higher priority)
      createdAt: Date;
      updatedAt: Date;
    }>;
    lastUpdatedBy?: number;
    lastUpdatedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};

// Insert types for MongoDB models
export type InsertCategory = Omit<Category, 'id' | 'createdAt'>;
export type InsertMenuItem = Omit<MenuItem, 'id' | 'createdAt'>;
export type InsertOrder = Omit<Order, 'id' | 'createdAt'>;
export type InsertMediaBanner = Omit<MediaBanner, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertOrderItem = Omit<OrderItem, 'id'>;
export type InsertNotification = Omit<Notification, 'id' | 'createdAt'>;
export type InsertLoginIssue = Omit<LoginIssue, 'id' | 'createdAt'>;
export type InsertPayment = Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertComplaint = Omit<Complaint, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertCoupon = Omit<Coupon, 'id' | 'createdAt' | 'usedCount' | 'usedBy' | 'usageHistory'> & {
  assignmentType?: 'all' | 'specific';
  assignedUsers?: number[];
};
export type InsertCounter = Omit<Counter, 'id' | 'createdAt'>;
export type InsertRestaurant = Omit<Restaurant, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertRestaurantEmployee = Omit<RestaurantEmployee, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertRestaurantTable = Omit<RestaurantTable, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertDeliveryPerson = Omit<DeliveryPerson, 'id' | 'deliveryPersonId' | 'createdAt' | 'updatedAt'>;
export type InsertSystemSettings = Omit<SystemSettings, 'id' | 'createdAt' | 'updatedAt'>;

export type Settlement = {
  id: string;
  settlementId: string;
  canteenId: string;
  amount: number;
  periodStart: Date;
  periodEnd: Date;
  orderIds: string[];
  orderCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payoutRequestId?: string;
  processedAt?: Date;
  processedBy?: number;
  transactionId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PayoutRequest = {
  id: string;
  requestId: string;
  canteenId: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'cancelled';
  requestedBy?: number;
  requestedAt: Date;
  orderIds: string[];
  orderCount: number;
  periodStart?: Date;
  periodEnd?: Date;
  reviewedBy?: number;
  reviewedAt?: Date;
  approvedBy?: number;
  approvedAt?: Date;
  rejectedBy?: number;
  rejectedAt?: Date;
  rejectionReason?: string;
  settlementId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertSettlement = Omit<Settlement, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertPayoutRequest = Omit<PayoutRequest, 'id' | 'createdAt' | 'updatedAt'>;

// Keep validation schemas using Zod for form validation
import { z } from "zod";

// Profile completion schema for new users
export const profileCompletionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
  role: z.nativeEnum(UserRole, { required_error: "Role is required" }),

  // Student fields (conditional)
  registerNumber: z.string().optional(),
  department: z.string().optional(),
  passingOutYear: z.number().optional(),

  // Staff fields (conditional)
  staffId: z.string().optional(),
}).refine((data) => {
  if (data.role === UserRole.STUDENT) {
    return data.registerNumber && data.department && data.passingOutYear;
  }
  if (data.role === UserRole.STAFF || data.role === UserRole.EMPLOYEE || data.role === UserRole.GUEST) {
    return data.staffId;
  }
  return false;
}, {
  message: "Please fill all required fields for your role",
});

// Validation for register number format
export const registerNumberSchema = z.string().regex(
  /^7115\d{2}[A-Za-z]{3}\d{3}$/,
  "Register number must be in format: 7115XXABC123 (7115 + year + department + roll number)"
);

// Complaint validation schemas
export const insertComplaintSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  userId: z.number().optional(),
  userName: z.string().min(1, "User name is required"),
  userEmail: z.string().email().optional(),
  category: z.enum(["Payment", "Service", "Quality", "Technical", "General"]).default("General"),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).default("Medium"),
  status: z.enum(["Open", "In Progress", "Resolved", "Closed"]).default("Open"),
  orderId: z.string().optional(),
  adminNotes: z.string().optional(),
  resolvedBy: z.string().optional(),
  canteenId: z.string().optional(),
});

// Validation for staff ID format
export const staffIdSchema = z.string().regex(
  /^[A-Za-z_]{3}\d{3}$/,
  "Staff ID must be 3 letters followed by 3 numbers (e.g., ABC123). Use '_' for missing letters."
);

// Form validation schemas for API endpoints
export const insertUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phoneNumber: z.string().optional(),
  role: z.nativeEnum(UserRole).or(z.string()), // Allow string for backward compatibility/flexibility if needed, or stick to strict Enum
  registerNumber: z.string().optional(),
  college: z.string().optional(),
  department: z.string().optional(),
  joiningYear: z.number().optional(),
  passingOutYear: z.number().optional(),
  currentStudyYear: z.number().optional(),
  isPassed: z.boolean().optional(),
  staffId: z.string().optional(),
  organizationId: z.string().optional(), // Organization ID for guest users
  selectedLocationType: z.string().optional(), // Selected location type (college, organization, restaurant)
  selectedLocationId: z.string().optional(), // Selected location ID
  isProfileComplete: z.boolean().optional(),
  passwordHash: z.string().optional(), // Password hash for email/password authentication
});

export const insertCategorySchema = z.object({
  name: z.string().min(1),
  canteenId: z.string().min(1),
});

export const insertMenuItemSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
  categoryId: z.string().optional(),
  canteenId: z.string().min(1),
  available: z.boolean().optional(),
  stock: z.number().min(0).optional(),
  description: z.string().optional(),
  addOns: z.string().optional(),
  isVegetarian: z.boolean().optional(),
  isMarkable: z.boolean().optional(),
  isTrending: z.boolean().optional(),
  isQuickPick: z.boolean().optional(),
  imageUrl: z.string().optional(),
  imagePublicId: z.string().optional(),
  // Counter assignment fields (nullable because some items may not use certain counters)
  storeCounterId: z.string().nullable().optional(),
  paymentCounterId: z.string().nullable().optional(),
  kotCounterId: z.string().nullable().optional(),
  // Cooking time and calories (optional, defaults to 0)
  cookingTime: z.number().min(0).optional(),
  calories: z.number().min(0).optional(),
});

export const insertOrderSchema = z.object({
  orderNumber: z.string(),
  customerId: z.number().optional(),
  customerName: z.string().min(1),
  collegeName: z.string().optional(), // College name for display
  items: z.string(),
  amount: z.number().min(0),
  itemsSubtotal: z.number().optional(), // Menu items total before charges
  taxAmount: z.number().optional(), // Tax amount (e.g., 5% GST for POS orders)
  chargesTotal: z.number().optional(), // Total applied charges
  chargesApplied: z.array(z.object({
    name: z.string(),
    type: z.enum(['percent', 'fixed']),
    value: z.number(),
    amount: z.number()
  })).optional(), // Snapshot of applied charges
  originalAmount: z.number().optional(), // Amount before discount
  discountAmount: z.number().optional(), // Discount applied
  appliedCoupon: z.string().nullable().optional(), // Coupon code used
  status: z.string().optional(),
  estimatedTime: z.number().optional(),
  barcode: z.string(),
  isCounterOrder: z.boolean().optional(),
  isOffline: z.boolean().optional(),
  paymentStatus: z.string().optional(),
  paymentMethod: z.string().optional(),
  qrId: z.string().optional(),
  paymentId: z.string().optional(),
  canteenId: z.string().min(1),
  // Counter assignment fields
  counterId: z.string().optional(),
  // Counter IDs can be missing for some items (e.g., no KOT counter)
  storeCounterId: z.string().nullable().optional(),
  paymentCounterId: z.string().nullable().optional(),
  kotCounterId: z.string().nullable().optional(),
  allStoreCounterIds: z.array(z.string()).optional(),
  allPaymentCounterIds: z.array(z.string()).optional(),
  allKotCounterIds: z.array(z.string()).optional(),
  allCounterIds: z.array(z.string()).optional(),
  paymentConfirmedBy: z.string().optional(),
  rejectedBy: z.string().optional(),
  itemStatusByCounter: z.record(z.any()).optional(),
  deliveryPersonId: z.string().optional(),
  orderType: z.enum(['delivery', 'takeaway']).optional(),
  deliveryAddress: z.object({
    label: z.string().optional(),
    fullName: z.string().optional(),
    phoneNumber: z.string().optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    landmark: z.string().optional(),
  }).optional(),
});

export const insertNotificationSchema = z.object({
  type: z.string(),
  message: z.string(),
  read: z.boolean().optional(),
  canteenId: z.string().optional(),
});

export const insertLoginIssueSchema = z.object({
  name: z.string().min(1),
  email: z.string().optional(),
  phoneNumber: z.string().optional(),
  registerNumber: z.string().optional(),
  staffId: z.string().optional(),
  issueType: z.string(),
  description: z.string().min(1),
  status: z.string().optional(),
});


export const insertPaymentSchema = z.object({
  orderId: z.number().optional(),
  merchantTransactionId: z.string(),
  phonePeTransactionId: z.string().optional(), // Legacy field for backward compatibility
  razorpayTransactionId: z.string().optional(),
  amount: z.number().positive(),
  status: z.string().optional(),
  paymentMethod: z.string().optional(),
  responseCode: z.string().optional(),
  responseMessage: z.string().optional(),
  checksum: z.string().optional(),
  metadata: z.string().optional(),
});

export const insertRestaurantSchema = z.object({
  name: z.string().min(1, "Restaurant name is required"),
  description: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  contactNumber: z.string().min(10, "Contact number must be at least 10 digits"),
  email: z.union([z.string().email(), z.literal(""), z.undefined()]).optional(),
  website: z.union([z.string().url(), z.literal(""), z.undefined()]).optional(),
  totalFloors: z.number().min(1, "Total floors must be at least 1"),
  totalKitchens: z.number().min(1, "Total kitchens must be at least 1"),
  totalSeatingCapacity: z.number().min(1, "Total seating capacity must be at least 1"),
  operatingHours: z.object({
    open: z.string().min(1, "Opening time is required"),
    close: z.string().min(1, "Closing time is required"),
    days: z.array(z.string()).min(1, "At least one day must be selected"),
  }),
  amenities: z.array(z.string()).default([]),
  cuisineTypes: z.array(z.string()).default([]),
  priceRange: z.enum(['budget', 'moderate', 'expensive', 'luxury']).default('moderate'),
  hasParking: z.boolean().default(false),
  hasWifi: z.boolean().default(false),
  hasDelivery: z.boolean().default(false),
  hasTakeaway: z.boolean().default(false),
  hasDineIn: z.boolean().default(true),
  imageUrl: z.string().optional(),
  imagePublicId: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const insertRestaurantEmployeeSchema = z.object({
  restaurantId: z.string().min(1, "Restaurant ID is required"),
  name: z.string().min(1, "Employee name is required"),
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
  employeeId: z.string().min(1, "Employee ID is required"),
  role: z.enum(['manager', 'assistant_manager', 'general_manager', 'operations_manager', 'shift_supervisor', 'chef', 'sous_chef', 'line_cook', 'prep_cook', 'pastry_chef', 'kitchen_manager', 'dishwasher', 'waiter', 'waitress', 'server', 'bartender', 'host', 'hostess', 'busser', 'food_runner', 'barback', 'cashier', 'receptionist', 'delivery_driver', 'cleaner', 'janitor', 'maintenance', 'housekeeping', 'security_guard', 'bouncer', 'security_manager', 'other']),
  department: z.enum(['kitchen', 'service', 'management', 'cleaning', 'security', 'other']),
  shift: z.enum(['morning', 'afternoon', 'evening', 'night', 'full_day', 'custom']),
  customShiftStart: z.string().optional(),
  customShiftEnd: z.string().optional(),
  salary: z.number().positive().optional(),
  hireDate: z.date(),
  isActive: z.boolean().default(true),
  assignedTables: z.array(z.string()).default([]),
});

export const insertDeliveryPersonSchema = z.object({
  canteenId: z.string().min(1, "Canteen ID is required"),
  name: z.string().min(1, "Name is required"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits"),
  email: z.union([z.string().email(), z.literal('')]).optional().transform(val => val === '' ? undefined : val),
  employeeId: z.union([z.string().min(1), z.literal('')]).optional().transform(val => val === '' ? undefined : val),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  dateOfBirth: z.string().optional().transform(val => val ? new Date(val) : undefined),
  dateOfJoining: z.string().optional().transform(val => val ? new Date(val) : undefined),
  vehicleNumber: z.string().optional(),
  licenseNumber: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyContactName: z.string().optional(),
  salary: z.number().positive().optional(),
  isActive: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  totalOrderDelivered: z.number().int().min(0).default(0),
  notes: z.string().optional(),
});

export const insertRestaurantTableSchema = z.object({
  restaurantId: z.string().min(1, "Restaurant ID is required"),
  tableNumber: z.string().min(1, "Table number is required"),
  floor: z.number().min(1, "Floor must be at least 1"),
  location: z.string().min(1, "Location is required"),
  seatingCapacity: z.number().min(1, "Seating capacity must be at least 1"),
  tableType: z.enum(['regular', 'booth', 'bar', 'outdoor', 'private', 'family']),
  isAccessible: z.boolean().default(false),
  // Service Department
  assignedWaiter: z.string().optional(),
  assignedHost: z.string().optional(),
  assignedBartender: z.string().optional(),
  assignedBusser: z.string().optional(),
  // Support Department
  assignedCleaner: z.string().optional(),
  assignedSecurity: z.string().optional(),
  status: z.enum(['available', 'occupied', 'reserved', 'maintenance', 'cleaning']).default('available'),
  specialFeatures: z.array(z.string()).default([]),
  qrCodeUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  imagePublicId: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const insertSystemSettingsSchema = z.object({
  maintenanceMode: z.object({
    isActive: z.boolean(),
    title: z.string().min(1, "Maintenance title is required"),
    message: z.string().min(1, "Maintenance message is required"),
    estimatedTime: z.string().optional(),
    contactInfo: z.string().optional(),
    targetingType: z.enum(['all', 'specific', 'department', 'year', 'year_department']).default('all'),
    specificUsers: z.array(z.string()).default([]),
    targetDepartments: z.array(z.string()).default([]),
    targetYears: z.array(z.number()).default([]),
    yearType: z.enum(['joining', 'passing', 'current']).default('current'),
    lastUpdatedBy: z.number().optional(),
    lastUpdatedAt: z.date().optional(),
  }),
  notifications: z.object({
    isEnabled: z.boolean(),
    lastUpdatedBy: z.number().optional(),
    lastUpdatedAt: z.date().optional(),
  }),
  appVersion: z.object({
    version: z.string().min(1, "App version is required"),
    buildTimestamp: z.number(),
    lastUpdatedBy: z.number().optional(),
    lastUpdatedAt: z.date().optional(),
  }),
  colleges: z.object({
    list: z.array(z.object({
      id: z.string(),
      name: z.string(),
      code: z.string(),
      isActive: z.boolean(),
      adminEmail: z.string().email().optional().or(z.literal("")),
      departments: z.array(z.object({
        code: z.string(),
        name: z.string(),
        isActive: z.boolean(),
        studyDuration: z.number().default(4),
        registrationFormats: z.array(z.object({
          id: z.string().optional(),
          name: z.string().optional(),
          year: z.number(),
          formats: z.record(z.any()), // Simplifying structure for now to avoid massive duplication
          createdAt: z.date().optional(),
          updatedAt: z.date().optional()
        })).optional(),
        createdAt: z.date().optional(),
        updatedAt: z.date().optional()
      })),
      createdAt: z.date().optional(),
      updatedAt: z.date().optional()
    })),
    lastUpdatedBy: z.number().optional(),
    lastUpdatedAt: z.date().optional(),
  }),
});


// Import Prisma namespace for type inference
import type { Prisma } from '@prisma/client';