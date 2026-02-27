import mongoose, { Schema, Document } from 'mongoose';

// Web Push Subscription Model
export interface IWebPushSubscription extends Document {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId: string;
  userRole: string;
  canteenId?: string;
  deviceInfo?: string;
  userAgent?: string;
  subscriptionId: string; // Hash of endpoint
  createdAt: Date;
  updatedAt: Date;
}

const WebPushSubscriptionSchema = new Schema<IWebPushSubscription>({
  endpoint: { type: String, required: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },
  userId: { type: String, required: true, index: true },
  userRole: { type: String, required: true, index: true },
  canteenId: { type: String, index: true },
  deviceInfo: { type: String },
  userAgent: { type: String },
  subscriptionId: { type: String, required: true, unique: true, index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
WebPushSubscriptionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const WebPushSubscription = mongoose.model<IWebPushSubscription>('WebPushSubscription', WebPushSubscriptionSchema);

// Category Model
export interface ICategory extends Document {
  name: string;
  canteenId: string;
  icon?: string;
  imageUrl?: string;
  imagePublicId?: string;
  createdAt: Date;
}

const CategorySchema = new Schema<ICategory>({
  name: { type: String, required: true },
  canteenId: { type: String, required: true },
  icon: { type: String },
  imageUrl: { type: String },
  imagePublicId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Compound unique index on name + canteenId (allows same category name across different canteens)
CategorySchema.index({ name: 1, canteenId: 1 }, { unique: true });

// Index for canteen-specific category queries (most common)
CategorySchema.index({ canteenId: 1, name: 1 });

// Index for category name search
CategorySchema.index({ name: 1 });

export const Category = mongoose.model<ICategory>('Category', CategorySchema);

// MenuItem Model
export interface IMenuItem extends Document {
  name: string;
  price: number;
  categoryId?: mongoose.Types.ObjectId;
  canteenId: string;
  available: boolean;
  stock: number;
  description?: string;
  addOns: string; // JSON array of add-ons
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
}

const MenuItemSchema = new Schema<IMenuItem>({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
  canteenId: { type: String, required: true },
  available: { type: Boolean, default: true },
  stock: { type: Number, default: 0 },
  description: { type: String },
  addOns: { type: String, default: '[]' },
  isVegetarian: { type: Boolean, default: true },
  isMarkable: { type: Boolean, default: true },
  isTrending: { type: Boolean, default: false },
  isQuickPick: { type: Boolean, default: false }, // true = marked as quick pick for faster ordering
  imageUrl: { type: String },
  imagePublicId: { type: String },
  storeCounterId: { type: String }, // Store counter ID for this menu item
  paymentCounterId: { type: String }, // Payment counter ID for this menu item
  kotCounterId: { type: String }, // KOT counter ID for this menu item (optional)
  cookingTime: { type: Number, default: 0 }, // Cooking/preparation time in minutes
  calories: { type: Number, default: 0 }, // Calorie content in kcal
  createdAt: { type: Date, default: Date.now }
});

// Compound indexes for optimal query performance
// Index for canteen-specific queries (most common)
MenuItemSchema.index({ canteenId: 1, available: 1, stock: 1 });

// Index for category filtering within a canteen
MenuItemSchema.index({ canteenId: 1, categoryId: 1, available: 1 });

// Index for vegetarian filtering
MenuItemSchema.index({ canteenId: 1, isVegetarian: 1, available: 1 });

// Index for name search within a canteen (supports regex substring matching)
MenuItemSchema.index({ canteenId: 1, name: 1 });

// Index for description search
MenuItemSchema.index({ description: 1 });

// Text index for efficient full-text search (name and description)
MenuItemSchema.index(
  { name: 'text', description: 'text' },
  {
    weights: { name: 10, description: 5 },
    name: 'menu_item_text_search'
  }
);

export const MenuItem = mongoose.model<IMenuItem>('MenuItem', MenuItemSchema);

// Canteen Charge Model
export interface ICanteenCharge extends Document {
  canteenId: string;
  name: string;
  type: 'percent' | 'fixed';
  value: number;
  active: boolean;
  createdAt: Date;
}

const CanteenChargeSchema = new Schema<ICanteenCharge>({
  canteenId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['percent', 'fixed'], required: true },
  value: { type: Number, required: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

CanteenChargeSchema.index({ canteenId: 1, name: 1 });

export const CanteenCharge = mongoose.model<ICanteenCharge>('CanteenCharge', CanteenChargeSchema);

// Canteen Settings Model
export interface ICanteenSettings extends Document {
  canteenId: string;
  taxRate: number; // Tax rate as a percentage (e.g., 5 for 5%)
  taxName: string; // Name of the tax (e.g., "GST", "VAT")
  favoriteCounterId?: string; // Favorite counter ID for owner
  createdAt: Date;
  updatedAt: Date;
}

const CanteenSettingsSchema = new Schema<ICanteenSettings>({
  canteenId: { type: String, required: true, unique: true, index: true },
  taxRate: { type: Number, default: 5, min: 0, max: 100 }, // Default 5% GST
  taxName: { type: String, default: 'GST' },
  favoriteCounterId: { type: String }, // Favorite counter ID for owner
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

CanteenSettingsSchema.index({ canteenId: 1 });

export const CanteenSettings = mongoose.model<ICanteenSettings>('CanteenSettings', CanteenSettingsSchema);

// Order Model
export interface IOrder extends Document {
  orderNumber: string;
  customerId?: number; // PostgreSQL user ID
  customerName: string;
  collegeName?: string; // College name for display
  items: string; // JSON string
  amount: number;
  itemsSubtotal?: number;
  taxAmount?: number; // Tax amount (e.g., 5% GST for POS orders)
  chargesTotal?: number;
  chargesApplied?: Array<{
    name: string;
    type: 'percent' | 'fixed';
    value: number;
    amount: number;
  }>;
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
  isOffline?: boolean; // For offline orders
  paymentStatus?: string; // Payment status: 'PENDING', 'PAID', etc.
  paymentMethod?: string; // Payment method: 'online', 'offline', 'upi', 'cash', etc.
  qrId?: string; // Razorpay QR code ID for QR-based payments
  paymentId?: string; // Razorpay payment ID after successful payment
  isCounterOrder?: boolean; // For counter orders
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
}

const OrderSchema = new Schema<IOrder>({
  orderNumber: { type: String, required: true, unique: true },
  customerId: { type: Number }, // References PostgreSQL user
  customerName: { type: String, required: true },
  collegeName: { type: String }, // College name for display
  items: { type: String, required: true },
  amount: { type: Number, required: true },
  itemsSubtotal: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  chargesTotal: { type: Number, default: 0 },
  chargesApplied: { type: Schema.Types.Mixed, default: [] },
  originalAmount: { type: Number }, // Amount before discount
  discountAmount: { type: Number }, // Discount applied
  appliedCoupon: { type: String }, // Coupon code used
  status: { type: String, default: 'preparing' },
  estimatedTime: { type: Number, default: 15 },
  barcode: { type: String, required: true, unique: true },
  barcodeUsed: { type: Boolean, default: false },
  deliveredAt: { type: Date },
  seenBy: { type: [Number], default: [] }, // Array of user IDs who have seen this order
  canteenId: { type: String, required: true },
  counterId: { type: String }, // Counter ID for counter-specific orders
  storeCounterId: { type: String }, // Store counter ID for order processing
  paymentCounterId: { type: String }, // Payment counter ID for order processing
  kotCounterId: { type: String }, // KOT counter ID for order processing
  paymentConfirmedBy: { type: String }, // Payment counter ID that confirmed the payment (for offline orders)
  rejectedBy: { type: String }, // Payment counter ID that rejected the order (for offline orders)
  allStoreCounterIds: { type: [String] }, // All store counter IDs for this order
  allPaymentCounterIds: { type: [String] }, // All payment counter IDs for this order
  allKotCounterIds: { type: [String] }, // All KOT counter IDs for this order
  allCounterIds: { type: [String] }, // All counter IDs for this order
  isOffline: { type: Boolean }, // For offline orders
  paymentStatus: { type: String, default: 'PENDING' }, // Payment status: 'PENDING', 'PAID', etc.
  paymentMethod: { type: String }, // Payment method: 'online', 'offline', 'upi', 'cash', etc.
  qrId: { type: String }, // Razorpay QR code ID for QR-based payments
  paymentId: { type: String }, // Razorpay payment ID after successful payment
  isCounterOrder: { type: Boolean }, // For counter orders
  itemStatusByCounter: { type: Schema.Types.Mixed, default: {} }, // Item-level status per counter
  deliveryPersonId: { type: String }, // Delivery person assigned to this order
  orderType: { type: String, enum: ['delivery', 'takeaway'] }, // Order type: delivery or takeaway
  deliveryAddress: { type: Schema.Types.Mixed }, // Delivery address for delivery orders
  createdAt: { type: Date, default: Date.now }
});

// ✅ Optimized indexes for efficient queries
// Compound index for user's active orders query (most common use case)
OrderSchema.index({ customerId: 1, status: 1, createdAt: -1 });

// Compound index for canteen owner's order management
OrderSchema.index({ canteenId: 1, status: 1, createdAt: -1 });

// Index for delivery person order queries
OrderSchema.index({ deliveryPersonId: 1, status: 1, createdAt: -1 });

// Individual indexes for lookups
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ orderNumber: 1 }); // Already unique, but explicit index
OrderSchema.index({ barcode: 1 }); // Already unique, but explicit index

export const Order = mongoose.model<IOrder>('Order', OrderSchema);

// OrderItem Model (for detailed order tracking)
export interface IOrderItem extends Document {
  orderId: mongoose.Types.ObjectId;
  menuItemId: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
}

const OrderItemSchema = new Schema<IOrderItem>({
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
  menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true }
});

export const OrderItem = mongoose.model<IOrderItem>('OrderItem', OrderItemSchema);

// ⚠️ DEPRECATED: DeliveryPerson Model
// NOTE: DeliveryPerson is now stored in PostgreSQL (Prisma), not MongoDB.
// This MongoDB model is kept for backward compatibility but should not be used for new code.
// Use the PostgreSQL DeliveryPerson model from @prisma/client instead.
// 
// If you need to query delivery persons, use:
//   import { db } from './db';
//   const deliveryPersons = await db.deliveryPerson.findMany({ ... });
//
// This model may be removed in a future version.
export interface IDeliveryPerson extends Document {
  canteenId: string;
  name: string;
  phoneNumber: string;
  email?: string;
  employeeId?: string; // Optional employee ID
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryPersonSchema = new Schema<IDeliveryPerson>({
  canteenId: { type: String, required: true },
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  email: { type: String },
  employeeId: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
DeliveryPersonSchema.index({ canteenId: 1, isActive: 1 });
DeliveryPersonSchema.index({ canteenId: 1, createdAt: -1 });

// Update the updatedAt field before saving
DeliveryPersonSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const DeliveryPerson = mongoose.model<IDeliveryPerson>('DeliveryPerson', DeliveryPersonSchema);

// Notification Model
export interface INotification extends Document {
  type: string;
  message: string;
  read: boolean;
  canteenId: string;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  type: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  canteenId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

// Notification Template Schema for customizable push notification templates
export interface INotificationTemplate extends Document {
  id: string;
  status: string;
  title: string;
  message: string;
  icon: string;
  priority: 'normal' | 'high';
  requireInteraction: boolean;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationTemplateSchema = new Schema<INotificationTemplate>({
  id: { type: String, required: true, unique: true },
  status: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  icon: { type: String, required: true },
  priority: { type: String, enum: ['normal', 'high'], default: 'normal' },
  requireInteraction: { type: Boolean, default: false },
  enabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
NotificationTemplateSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const NotificationTemplate = mongoose.model<INotificationTemplate>('NotificationTemplate', NotificationTemplateSchema);

// Custom Notification Template Schema for admin-created broadcast templates
export interface ICustomNotificationTemplate extends Document {
  id: string;
  name: string;
  title: string;
  message: string;
  icon: string;
  priority: 'normal' | 'high';
  requireInteraction: boolean;
  enabled: boolean;
  createdBy: number; // Admin user ID
  createdAt: Date;
  updatedAt: Date;
}

const CustomNotificationTemplateSchema = new Schema<ICustomNotificationTemplate>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  icon: { type: String, required: true },
  priority: { type: String, enum: ['normal', 'high'], default: 'normal' },
  requireInteraction: { type: Boolean, default: false },
  enabled: { type: Boolean, default: true },
  createdBy: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
CustomNotificationTemplateSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const CustomNotificationTemplate = mongoose.model<ICustomNotificationTemplate>('CustomNotificationTemplate', CustomNotificationTemplateSchema);

// LoginIssue Model
export interface ILoginIssue extends Document {
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
}

const LoginIssueSchema = new Schema<ILoginIssue>({
  name: { type: String, required: true },
  email: { type: String },
  phoneNumber: { type: String },
  registerNumber: { type: String },
  staffId: { type: String },
  issueType: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, default: 'pending' },
  adminNotes: { type: String },
  resolvedBy: { type: String },
  resolvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

export const LoginIssue = mongoose.model<ILoginIssue>('LoginIssue', LoginIssueSchema);

// Complaint Model
export interface IComplaint extends Document {
  subject: string;
  description: string;
  userId?: number; // PostgreSQL user ID
  userName: string;
  userEmail?: string;
  category: string; // 'Payment', 'Service', 'Quality', 'Technical', 'General'
  priority: string; // 'Low', 'Medium', 'High', 'Critical'
  status: string; // 'Open', 'In Progress', 'Resolved', 'Closed'
  orderId?: mongoose.Types.ObjectId; // Related order if applicable
  adminNotes?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  canteenId: string;
  createdAt: Date;
  updatedAt: Date;
}

const ComplaintSchema = new Schema<IComplaint>({
  subject: { type: String, required: true },
  description: { type: String, required: true },
  userId: { type: Number }, // References PostgreSQL user
  userName: { type: String, required: true },
  userEmail: { type: String },
  category: {
    type: String,
    required: true,
    enum: ['Payment', 'Service', 'Quality', 'Technical', 'General'],
    default: 'General'
  },
  priority: {
    type: String,
    required: true,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  status: {
    type: String,
    required: true,
    enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
    default: 'Open'
  },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  adminNotes: { type: String },
  resolvedBy: { type: String },
  resolvedAt: { type: Date },
  canteenId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field on save
ComplaintSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const Complaint = mongoose.model<IComplaint>('Complaint', ComplaintSchema);


// Payment Model
export interface IPayment extends Document {
  customerId?: number; // PostgreSQL user ID for querying payments by user
  orderId?: mongoose.Types.ObjectId;
  canteenId?: string; // Added canteenId field for direct canteen mapping
  merchantTransactionId: string;
  phonePeTransactionId?: string; // Legacy field for backward compatibility
  razorpayTransactionId?: string;
  razorpayOrderId?: string; // Razorpay Order ID for webhook lookups
  razorpayPaymentId?: string; // Razorpay Payment ID for webhook lookups
  checkoutSessionId?: string; // Checkout session ID for session-based lookups
  amount: number;
  status: string;
  paymentMethod?: string;
  responseCode?: string;
  responseMessage?: string;
  checksum?: string;
  metadata?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>({
  customerId: { type: Number }, // PostgreSQL user ID for user-specific payment queries
  orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  canteenId: { type: String }, // Added canteenId field for direct canteen mapping
  merchantTransactionId: { type: String, required: true, unique: true },
  phonePeTransactionId: { type: String }, // Legacy field for backward compatibility
  razorpayTransactionId: { type: String, index: true }, // Indexed for webhook lookups
  razorpayOrderId: { type: String, index: true }, // Indexed for webhook lookups by order ID
  razorpayPaymentId: { type: String, index: true }, // Indexed for webhook lookups by payment ID
  checkoutSessionId: { type: String, index: true }, // Indexed for session-based lookups
  amount: { type: Number, required: true },
  status: { type: String, default: 'pending' },
  paymentMethod: { type: String },
  responseCode: { type: String },
  responseMessage: { type: String },
  checksum: { type: String },
  metadata: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
PaymentSchema.index({ canteenId: 1, createdAt: -1 }); // For getPaymentsByCanteen queries
PaymentSchema.index({ orderId: 1 }); // For order-based payment lookups
PaymentSchema.index({ status: 1, createdAt: -1 }); // For status-based queries
PaymentSchema.index({ merchantTransactionId: 1 }); // Already unique, but explicit index for lookups
PaymentSchema.index({ customerId: 1, createdAt: -1 }); // For user-specific payment queries (My Payments)
PaymentSchema.index({ razorpayOrderId: 1 }); // For webhook lookups by Razorpay Order ID
PaymentSchema.index({ razorpayPaymentId: 1 }); // For webhook lookups by Razorpay Payment ID
PaymentSchema.index({ checkoutSessionId: 1 }); // For session-based lookups

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);

// MediaBanner Model
export interface IMediaBanner extends Document {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  type: 'image' | 'video';
  fileId?: mongoose.Types.ObjectId; // GridFS file ID (legacy support)
  cloudinaryPublicId?: string; // Cloudinary public ID
  cloudinaryUrl?: string; // Cloudinary secure URL
  isActive: boolean;
  displayOrder: number;
  displayMode?: 'fit' | 'fill'; // How to display the image: fit (contain) or fill (cover)
  uploadedBy?: number; // User ID who uploaded
  canteenId?: string; // Canteen ID this banner belongs to
  createdAt: Date;
  updatedAt: Date;
}

const MediaBannerSchema = new Schema<IMediaBanner>({
  fileName: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  type: {
    type: String,
    required: true,
    enum: ['image', 'video']
  },
  fileId: { type: Schema.Types.ObjectId }, // GridFS file reference (legacy support)
  cloudinaryPublicId: { type: String }, // Cloudinary public ID
  cloudinaryUrl: { type: String }, // Cloudinary secure URL
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
  displayMode: { type: String, enum: ['fit', 'fill'], default: 'fill' }, // How to display the image
  canteenId: { type: String, index: true }, // Canteen ID this banner belongs to
  uploadedBy: { type: Number }, // References PostgreSQL user ID
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for efficient querying by canteen
MediaBannerSchema.index({ canteenId: 1, displayOrder: 1 });

// Update the updatedAt field on save
MediaBannerSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const MediaBanner = mongoose.model<IMediaBanner>('MediaBanner', MediaBannerSchema);

// Coupon Usage History Interface
export interface ICouponUsageHistory {
  userId: number;
  orderId: mongoose.Types.ObjectId;
  orderNumber: string;
  discountAmount: number;
  usedAt: Date;
}

// Discount Coupon Model
export interface ICoupon extends Document {
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minimumOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit: number;
  usedCount: number;
  usedBy: number[]; // Array of user IDs who have used this coupon
  assignmentType: 'all' | 'specific'; // Whether coupon is for all users or specific users
  assignedUsers: number[]; // Array of user IDs the coupon is assigned to (only for specific assignment)
  usageHistory: ICouponUsageHistory[]; // Detailed usage history
  isActive: boolean;
  validFrom: Date;
  validUntil: Date;
  createdBy: number; // Admin user ID
  canteenId: string;
  createdAt: Date;
}

const CouponUsageHistorySchema = new Schema<ICouponUsageHistory>({
  userId: { type: Number, required: true },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
  orderNumber: { type: String, required: true },
  discountAmount: { type: Number, required: true },
  usedAt: { type: Date, default: Date.now }
}, { _id: false });

const CouponSchema = new Schema<ICoupon>({
  code: { type: String, required: true, unique: true, uppercase: true },
  description: { type: String, required: true },
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
  discountValue: { type: Number, required: true },
  minimumOrderAmount: { type: Number, default: 0 },
  maxDiscountAmount: { type: Number },
  usageLimit: { type: Number, required: true },
  usedCount: { type: Number, default: 0 },
  usedBy: { type: [Number], default: [] },
  assignmentType: { type: String, enum: ['all', 'specific'], default: 'all' },
  assignedUsers: { type: [Number], default: [] },
  usageHistory: { type: [CouponUsageHistorySchema], default: [] },
  isActive: { type: Boolean, default: true },
  validFrom: { type: Date, required: true },
  validUntil: { type: Date, required: true },
  createdBy: { type: Number, required: true },
  canteenId: { type: String, required: true, default: 'GLOBAL' }, // GLOBAL for all canteens
  createdAt: { type: Date, default: Date.now }
});

// CRITICAL INDEXES for coupon atomicity and performance
// 1. Index on code for fast lookups (already unique)
// 2. Compound index for atomic updates
CouponSchema.index({ code: 1, isActive: 1, validFrom: 1, validUntil: 1 });
// 3. Index on usedBy array for fast user lookup
CouponSchema.index({ usedBy: 1 });
// 4. Index on canteenId for canteen-specific queries
CouponSchema.index({ canteenId: 1, isActive: 1 });

export const Coupon = mongoose.model<ICoupon>('Coupon', CouponSchema);

// Counter Model
export interface ICounter extends Document {
  name: string;
  code: string;
  counterId: string; // Unique counter ID
  canteenId: string;
  type: 'payment' | 'store' | 'kot'; // Counter type: payment, store mode, or KOT (Kitchen Order Ticket)
  createdAt: Date;
}

const CounterSchema = new Schema<ICounter>({
  name: { type: String, required: true },
  code: { type: String, required: true, uppercase: true },
  counterId: { type: String, required: true, unique: true },
  canteenId: { type: String, required: true },
  type: { type: String, required: true, enum: ['payment', 'store', 'kot'] },
  createdAt: { type: Date, default: Date.now }
});

// Create compound unique index on code + canteenId
// This allows the same counter code across different canteens
CounterSchema.index({ code: 1, canteenId: 1 }, { unique: true });

export const Counter = mongoose.model<ICounter>('Counter', CounterSchema);



// Coding Challenge Model
export interface ICodingChallenge extends Document {
  name: string;
  description: string;
  questionCount: number;
  totalQuestions: number;
  tags: string[];
  xpReward: number;
  link?: string;
  rules?: string;
  termsAndConditions?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CodingChallengeSchema = new Schema<ICodingChallenge>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  questionCount: { type: Number, required: true, min: 0 },
  totalQuestions: { type: Number, required: true, min: 1 },
  tags: { type: [String], default: [] },
  xpReward: { type: Number, required: true, min: 0 },
  link: { type: String },
  rules: { type: String },
  termsAndConditions: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update updatedAt on save
CodingChallengeSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const CodingChallenge = mongoose.model<ICodingChallenge>('CodingChallenge', CodingChallengeSchema);

// Payment Session Model - Prevents duplicate payment submissions
export interface IPaymentSession extends Document {
  sessionId: string; // Unique session identifier
  customerId: number; // User ID initiating payment
  amount: number; // Payment amount
  canteenId: string; // Canteen ID
  orderData: string; // JSON string of order data
  status: 'active' | 'completed' | 'expired' | 'cancelled'; // Session status
  expiresAt: Date; // Session expiration timestamp
  createdAt: Date;
  completedAt?: Date; // When the payment was completed
}

const PaymentSessionSchema = new Schema<IPaymentSession>({
  sessionId: { type: String, required: true, unique: true },
  customerId: { type: Number, required: true },
  amount: { type: Number, required: true },
  canteenId: { type: String, required: true },
  orderData: { type: String, required: true },
  status: {
    type: String,
    enum: ['active', 'completed', 'expired', 'cancelled'],
    default: 'active'
  },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

// Create indexes for efficient queries
PaymentSessionSchema.index({ sessionId: 1 });
PaymentSessionSchema.index({ customerId: 1, status: 1 });
PaymentSessionSchema.index({ expiresAt: 1 }); // For TTL cleanup
PaymentSessionSchema.index({ status: 1, createdAt: -1 });

// TTL index to automatically delete expired sessions after 1 hour
PaymentSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export const PaymentSession = mongoose.model<IPaymentSession>('PaymentSession', PaymentSessionSchema);

// Webhook Log Model - Tracks webhook events for retry and debugging
export interface IWebhookLog extends Document {
  event: string; // Webhook event type (e.g., payment.captured)
  paymentId?: string; // Razorpay payment ID
  razorpayOrderId?: string; // Razorpay order ID
  payload: string; // Full webhook payload as JSON string
  status: 'success' | 'failed' | 'pending'; // Processing status
  retryCount: number; // Number of retry attempts
  error?: string; // Error message if failed
  processedAt?: Date; // When successfully processed
  createdAt: Date;
  updatedAt: Date;
}

const WebhookLogSchema = new Schema<IWebhookLog>({
  event: { type: String, required: true },
  paymentId: { type: String, index: true },
  razorpayOrderId: { type: String, index: true },
  payload: { type: String, required: true },
  status: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'pending',
    index: true
  },
  retryCount: { type: Number, default: 0 },
  error: { type: String },
  processedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
WebhookLogSchema.index({ status: 1, retryCount: 1, createdAt: -1 }); // For retry queries
WebhookLogSchema.index({ razorpayOrderId: 1, event: 1 }); // For duplicate detection
WebhookLogSchema.index({ createdAt: -1 }); // For recent logs

export const WebhookLog = mongoose.model<IWebhookLog>('WebhookLog', WebhookLogSchema);

// Checkout Session Model - Tracks entire checkout flow
export interface ICheckoutSession extends Document {
  sessionId: string; // Unique session identifier
  customerId: number; // User ID
  canteenId?: string; // Canteen ID
  status: 'active' | 'completed' | 'abandoned' | 'expired' | 'payment_initiated' | 'payment_completed' | 'payment_failed'; // Session status
  expiresAt: Date; // Session expiration timestamp (typically 15-20 minutes)
  createdAt: Date;
  completedAt?: Date; // When checkout was completed
  abandonedAt?: Date; // When user left checkout
  lastActivity: Date; // Last activity timestamp
  metadata?: string; // JSON string for additional data
}

const CheckoutSessionSchema = new Schema<ICheckoutSession>({
  sessionId: { type: String, required: true, unique: true },
  customerId: { type: Number, required: true },
  canteenId: { type: String },
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned', 'expired', 'payment_initiated', 'payment_completed', 'payment_failed'],
    default: 'active'
  },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  abandonedAt: { type: Date },
  lastActivity: { type: Date, default: Date.now },
  metadata: { type: String }
});

// Create indexes for efficient queries
CheckoutSessionSchema.index({ sessionId: 1 });
CheckoutSessionSchema.index({ customerId: 1, status: 1 });
CheckoutSessionSchema.index({ status: 1, expiresAt: 1 });
CheckoutSessionSchema.index({ createdAt: -1 });

// TTL index to automatically delete expired sessions after 2 hours
CheckoutSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7200 });

export const CheckoutSession = mongoose.model<ICheckoutSession>('CheckoutSession', CheckoutSessionSchema);

// Print Agent Models

// Printer Model
export interface IPrinter extends Document {
  agentId: string; // Reference to agent
  printerId: string; // Printer's unique ID
  name: string; // Printer name
  type: 'usb' | 'network' | 'bluetooth' | 'windows'; // Printer connection type
  isDefault: boolean; // Whether this is the default printer
  capabilities: string; // JSON string of capabilities
  createdAt: Date;
}

const PrinterSchema = new Schema<IPrinter>({
  agentId: { type: String, required: true },
  printerId: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['usb', 'network', 'bluetooth', 'windows'], required: true },
  isDefault: { type: Boolean, default: false },
  capabilities: { type: String, default: '{}' },
  createdAt: { type: Date, default: Date.now }
});

// Index for efficient queries
PrinterSchema.index({ agentId: 1 });
PrinterSchema.index({ agentId: 1, printerId: 1 }, { unique: true });

export const Printer = mongoose.model<IPrinter>('Printer', PrinterSchema);

// Print Agent Model
export interface IPrintAgent extends Document {
  agentId: string; // Unique agent identifier
  outletId: string; // Canteen/outlet ID
  apiKey: string; // Encrypted API key
  version: string; // Agent version
  platform: string; // OS platform
  status: 'online' | 'offline'; // Agent status
  capabilities: string; // JSON string of capabilities
  lastSeen: Date; // Last activity timestamp
  createdAt: Date;
  updatedAt: Date;
}

const PrintAgentSchema = new Schema<IPrintAgent>({
  agentId: { type: String, required: true, unique: true },
  outletId: { type: String, required: true },
  apiKey: { type: String, required: true },
  version: { type: String, required: true },
  platform: { type: String, required: true },
  status: { type: String, enum: ['online', 'offline'], default: 'offline' },
  capabilities: { type: String, default: '{}' },
  lastSeen: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
PrintAgentSchema.index({ agentId: 1 });
PrintAgentSchema.index({ outletId: 1 });
PrintAgentSchema.index({ outletId: 1, status: 1 });
PrintAgentSchema.index({ status: 1 });

// Update updatedAt before saving
PrintAgentSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const PrintAgent = mongoose.model<IPrintAgent>('PrintAgent', PrintAgentSchema);

// Print Job Model
export interface IPrintJob extends Document {
  jobId: string; // Unique job identifier
  outletId: string; // Canteen/outlet ID
  agentId?: string; // Agent ID (nullable until assigned)
  receiptType: 'KOT' | 'BILL' | 'TOKEN'; // Receipt type
  content: string; // JSON string of receipt content
  escposCommands?: string; // JSON string of ESC/POS commands (optional)
  printerType?: string; // Target printer type (optional)
  targetPrinter?: string; // Target printer name (optional)
  priority: 'normal' | 'high' | 'urgent'; // Job priority
  status: 'pending' | 'sent' | 'printed' | 'failed' | 'retrying'; // Job status
  error?: string; // Error message (if failed)
  orderId?: mongoose.Types.ObjectId; // Related order ID
  orderNumber?: string; // Related order number
  createdAt: Date;
  updatedAt: Date;
  printedAt?: Date; // When the job was printed
  sentAt?: Date; // When the job was sent to agent
}

const PrintJobSchema = new Schema<IPrintJob>({
  jobId: { type: String, required: true, unique: true },
  outletId: { type: String, required: true },
  agentId: { type: String },
  receiptType: { type: String, enum: ['KOT', 'BILL', 'TOKEN'], required: true },
  content: { type: String, required: true },
  escposCommands: { type: String },
  printerType: { type: String, enum: ['usb', 'network', 'bluetooth', 'windows'] },
  targetPrinter: { type: String },
  priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
  status: { type: String, enum: ['pending', 'sent', 'printed', 'failed', 'retrying'], default: 'pending' },
  error: { type: String },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  orderNumber: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  printedAt: { type: Date },
  sentAt: { type: Date }
});

// Indexes for efficient queries
PrintJobSchema.index({ jobId: 1 });
PrintJobSchema.index({ outletId: 1, status: 1, createdAt: -1 });
PrintJobSchema.index({ agentId: 1, status: 1 });
PrintJobSchema.index({ status: 1, priority: -1, createdAt: 1 });
PrintJobSchema.index({ orderId: 1 });
PrintJobSchema.index({ orderNumber: 1 });

// Update updatedAt before saving
PrintJobSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const PrintJob = mongoose.model<IPrintJob>('PrintJob', PrintJobSchema);

// Pairing Code Model
export interface IPairingCode extends Document {
  code: string; // Pairing code
  outletId: string; // Canteen/outlet ID
  expiresAt: Date; // Expiration timestamp
  used: boolean; // Whether code has been used
  usedBy?: string; // Agent ID that used this code
  createdAt: Date;
}

const PairingCodeSchema = new Schema<IPairingCode>({
  code: { type: String, required: true, unique: true },
  outletId: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
  usedBy: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
PairingCodeSchema.index({ code: 1 });
PairingCodeSchema.index({ outletId: 1, expiresAt: -1 });
PairingCodeSchema.index({ expiresAt: 1 }); // For TTL cleanup

// TTL index to automatically delete expired codes after 1 hour
PairingCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export const PairingCode = mongoose.model<IPairingCode>('PairingCode', PairingCodeSchema);

// User Address Model
export interface IUserAddress extends Document {
  userId: number; // PostgreSQL user ID
  label: string; // Address label (e.g., "Home", "Work", "College")
  fullName: string; // Full name for delivery
  phoneNumber: string; // Contact phone number
  addressLine1: string; // Primary address line
  addressLine2?: string; // Secondary address line (optional)
  city: string;
  state: string;
  pincode: string;
  landmark?: string; // Nearby landmark (optional)
  isDefault: boolean; // Whether this is the default address
  createdAt: Date;
  updatedAt: Date;
}

const UserAddressSchema = new Schema<IUserAddress>({
  userId: { type: Number, required: true },
  label: { type: String, required: true },
  fullName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  addressLine1: { type: String, required: true },
  addressLine2: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  landmark: { type: String },
  isDefault: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
UserAddressSchema.index({ userId: 1, createdAt: -1 });
UserAddressSchema.index({ userId: 1, isDefault: 1 });

// Update updatedAt before saving
UserAddressSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const UserAddress = mongoose.model<IUserAddress>('UserAddress', UserAddressSchema);

// Organization QR Code Address Interface
export interface IQRCodeAddress {
  label: string; // Address label (e.g., "Main Campus", "Building A")
  fullName?: string; // Full name for delivery (optional, can use user's name)
  phoneNumber?: string; // Contact phone number (optional, can use user's phone)
  addressLine1: string; // Primary address line
  addressLine2?: string; // Secondary address line (optional)
  city: string;
  state: string;
  pincode: string;
  landmark?: string; // Nearby landmark (optional)
}

// Organization QR Code Model
export interface IOrganizationQRCode extends Document {
  qrId: string; // Unique QR code identifier
  organizationId: string; // Organization ID this QR belongs to
  address: string; // Legacy: Simple address string (for backward compatibility and QR URL)
  fullAddress?: IQRCodeAddress; // Full address object for user address creation
  qrCodeUrl: string; // Full QR code URL
  hash: string; // Security hash for validation
  isActive: boolean; // Whether QR code is active
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationQRCodeSchema = new Schema<IOrganizationQRCode>({
  qrId: { type: String, required: true, unique: true },
  organizationId: { type: String, required: true },
  address: { type: String, required: true }, // Keep for backward compatibility and QR URL
  fullAddress: {
    label: { type: String },
    fullName: { type: String },
    phoneNumber: { type: String },
    addressLine1: { type: String },
    addressLine2: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    landmark: { type: String }
  },
  qrCodeUrl: { type: String, required: true },
  hash: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
OrganizationQRCodeSchema.index({ organizationId: 1, isActive: 1 });
OrganizationQRCodeSchema.index({ qrId: 1 });
OrganizationQRCodeSchema.index({ hash: 1 });

// Update updatedAt before saving
OrganizationQRCodeSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const OrganizationQRCode = mongoose.model<IOrganizationQRCode>('OrganizationQRCode', OrganizationQRCodeSchema);

// Settlement Model - Tracks completed payouts to canteen owners
export interface ISettlement extends Document {
  settlementId: string; // Unique settlement identifier
  canteenId: string; // Canteen ID
  amount: number; // Settlement amount in paise
  periodStart: Date; // Start date of settlement period
  periodEnd: Date; // End date of settlement period
  orderIds: string[]; // Array of order IDs included in this settlement
  orderCount: number; // Number of orders settled
  status: 'pending' | 'processing' | 'completed' | 'failed'; // Settlement status
  payoutRequestId?: string; // Reference to payout request if applicable
  processedAt?: Date; // When settlement was processed
  processedBy?: number; // Admin user ID who processed it
  transactionId?: string; // External transaction ID (bank transfer, etc.)
  notes?: string; // Additional notes
  createdAt: Date;
  updatedAt: Date;
}

const SettlementSchema = new Schema<ISettlement>({
  settlementId: { type: String, required: true, unique: true },
  canteenId: { type: String, required: true },
  amount: { type: Number, required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  orderIds: { type: [String], default: [] },
  orderCount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  payoutRequestId: { type: String },
  processedAt: { type: Date },
  processedBy: { type: Number },
  transactionId: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
SettlementSchema.index({ canteenId: 1, createdAt: -1 });
SettlementSchema.index({ settlementId: 1 });
SettlementSchema.index({ status: 1, createdAt: -1 });
SettlementSchema.index({ payoutRequestId: 1 });

// Update updatedAt before saving
SettlementSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const Settlement = mongoose.model<ISettlement>('Settlement', SettlementSchema);

// Payout Request Model - Tracks payout requests from canteen owners
export interface IPayoutRequest extends Document {
  requestId: string; // Unique request identifier
  canteenId: string; // Canteen ID
  amount: number; // Requested payout amount in paise
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'cancelled'; // Request status
  requestedBy?: number; // Canteen owner user ID (optional)
  requestedAt: Date; // When request was created
  orderIds: string[]; // Array of order IDs included in this request
  orderCount: number; // Number of orders in this request
  periodStart?: Date; // Start date of orders period (optional)
  periodEnd?: Date; // End date of orders period (optional)
  reviewedBy?: number; // Admin user ID who reviewed it
  reviewedAt?: Date; // When request was reviewed
  approvedBy?: number; // Admin user ID who approved it
  approvedAt?: Date; // When request was approved
  rejectedBy?: number; // Admin user ID who rejected it
  rejectedAt?: Date; // When request was rejected
  rejectionReason?: string; // Reason for rejection
  settlementId?: string; // Reference to settlement if created
  notes?: string; // Additional notes
  createdAt: Date;
  updatedAt: Date;
}

const PayoutRequestSchema = new Schema<IPayoutRequest>({
  requestId: { type: String, required: true, unique: true },
  canteenId: { type: String, required: true },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'processing', 'completed', 'cancelled'],
    default: 'pending'
  },
  requestedBy: { type: Number },
  requestedAt: { type: Date, default: Date.now },
  orderIds: { type: [String], default: [] },
  orderCount: { type: Number, default: 0 },
  periodStart: { type: Date },
  periodEnd: { type: Date },
  reviewedBy: { type: Number },
  reviewedAt: { type: Date },
  approvedBy: { type: Number },
  approvedAt: { type: Date },
  rejectedBy: { type: Number },
  rejectedAt: { type: Date },
  rejectionReason: { type: String },
  settlementId: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
PayoutRequestSchema.index({ canteenId: 1, createdAt: -1 });
PayoutRequestSchema.index({ requestId: 1 });
PayoutRequestSchema.index({ status: 1, createdAt: -1 });
PayoutRequestSchema.index({ requestedBy: 1 });
PayoutRequestSchema.index({ settlementId: 1 });

// Update updatedAt before saving
PayoutRequestSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const PayoutRequest = mongoose.model<IPayoutRequest>('PayoutRequest', PayoutRequestSchema);

// Position Bidding Model - Allows canteens to bid for priority positions
export interface IPositionBid extends Document {
  bidId: string; // Unique bid identifier
  canteenId: string; // Canteen making the bid
  organizationId?: string; // Organization the bid is for (if applicable)
  collegeId?: string; // College the bid is for (if applicable)
  targetDate: Date; // Date for which the bid is for (next day)
  bidAmount: number; // Bid amount in paise
  status: 'pending' | 'closed' | 'paid' | 'failed' | 'expired' | 'active'; // Bid status
  paymentStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'; // Payment status
  paymentTransactionId?: string; // Payment transaction ID
  priority: number; // Priority position after payment (calculated based on bid ranking)
  biddingClosedAt?: Date; // When bidding closed (1 PM day before)
  paymentDueAt?: Date; // Payment deadline (3 PM day before)
  paidAt?: Date; // When payment was completed
  createdAt: Date;
  updatedAt: Date;
}

const PositionBidSchema = new Schema<IPositionBid>({
  bidId: { type: String, required: true, unique: true },
  canteenId: { type: String, required: true },
  organizationId: { type: String },
  collegeId: { type: String },
  targetDate: { type: Date, required: true },
  bidAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'closed', 'paid', 'failed', 'expired', 'active'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentTransactionId: { type: String },
  priority: { type: Number },
  biddingClosedAt: { type: Date },
  paymentDueAt: { type: Date },
  paidAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
PositionBidSchema.index({ canteenId: 1, targetDate: 1 });
PositionBidSchema.index({ organizationId: 1, targetDate: 1, status: 1 });
PositionBidSchema.index({ collegeId: 1, targetDate: 1, status: 1 });
PositionBidSchema.index({ targetDate: 1, status: 1, bidAmount: -1 }); // For ranking bids
PositionBidSchema.index({ status: 1, paymentStatus: 1, targetDate: 1 });
PositionBidSchema.index({ bidId: 1 });

// Update updatedAt before saving
PositionBidSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const PositionBid = mongoose.model<IPositionBid>('PositionBid', PositionBidSchema);

// CanteenEntity Model - Dedicated collection for canteens (migrated from SystemSettings.canteens.list)
export interface ICanteenEntity extends Document {
  id: string; // Legacy string ID (e.g., 'canteen-1234567890')
  name: string;
  code: string;
  description?: string;
  imageUrl?: string;
  imagePublicId?: string;
  logoUrl?: string;
  logoPublicId?: string;
  bannerUrl?: string;
  bannerPublicId?: string;
  location?: string;
  contactNumber?: string;
  email?: string;
  canteenOwnerEmail?: string;
  collegeId?: string; // Legacy single value
  collegeIds: string[]; // Array of college IDs this canteen serves
  organizationId?: string; // Legacy single value
  organizationIds: string[]; // Array of organization IDs this canteen serves
  restaurantId?: string;
  type?: string;
  operatingHours?: {
    open?: string;
    close?: string;
    days?: string[];
  };
  isActive: boolean;
  codingChallengesEnabled: boolean;
  payAtCounterEnabled: boolean;
  deliveryEnabled: boolean;
  ownerSidebarConfig?: Record<string, boolean>;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

const CanteenEntitySchema = new Schema<ICanteenEntity>({
  id: { type: String, required: true, unique: true }, // Legacy string ID
  name: { type: String, required: true },
  code: { type: String, required: true },
  description: { type: String },
  imageUrl: { type: String },
  imagePublicId: { type: String },
  logoUrl: { type: String },
  logoPublicId: { type: String },
  bannerUrl: { type: String },
  bannerPublicId: { type: String },
  location: { type: String },
  contactNumber: { type: String },
  email: { type: String },
  canteenOwnerEmail: { type: String },
  collegeId: { type: String }, // Legacy
  collegeIds: { type: [String], default: [] },
  organizationId: { type: String }, // Legacy
  organizationIds: { type: [String], default: [] },
  restaurantId: { type: String },
  type: { type: String },
  operatingHours: {
    open: { type: String },
    close: { type: String },
    days: [{ type: String }]
  },
  isActive: { type: Boolean, default: true },
  codingChallengesEnabled: { type: Boolean, default: false },
  payAtCounterEnabled: { type: Boolean, default: true },
  deliveryEnabled: { type: Boolean, default: true },
  ownerSidebarConfig: { type: Schema.Types.Mixed, default: {} },
  priority: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient querying
CanteenEntitySchema.index({ id: 1 }); // Already unique, explicit index for lookups
CanteenEntitySchema.index({ collegeIds: 1, isActive: 1 }); // Multikey index for college filtering
CanteenEntitySchema.index({ organizationIds: 1, isActive: 1 }); // Multikey index for organization filtering
CanteenEntitySchema.index({ restaurantId: 1, isActive: 1 }); // Restaurant filter
CanteenEntitySchema.index({ priority: 1, name: 1 }); // Sort order
CanteenEntitySchema.index({ canteenOwnerEmail: 1 }); // Owner lookup
CanteenEntitySchema.index({ code: 1 }, { unique: true }); // Unique code

// Update updatedAt before saving
CanteenEntitySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const CanteenEntity = mongoose.model<ICanteenEntity>('CanteenEntity', CanteenEntitySchema);

// Canteen Location-Specific QR Code Model
export interface ICanteenQRCode extends Document {
  qrId: string; // Unique QR code identifier
  canteenId: string; // Canteen ID this QR belongs to
  locationType: 'college' | 'organization'; // Type of location it sets context for
  locationId: string; // The specific collegeId or organizationId
  qrCodeUrl: string; // Full QR code URL linking to /qr/canteen/:qrId
  hash: string; // Security hash for validation
  isActive: boolean; // Whether QR code is active
  createdAt: Date;
  updatedAt: Date;
}

const CanteenQRCodeSchema = new Schema<ICanteenQRCode>({
  qrId: { type: String, required: true, unique: true },
  canteenId: { type: String, required: true },
  locationType: { type: String, enum: ['college', 'organization'], required: true },
  locationId: { type: String, required: true },
  qrCodeUrl: { type: String, required: true },
  hash: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
CanteenQRCodeSchema.index({ canteenId: 1, isActive: 1 });
CanteenQRCodeSchema.index({ qrId: 1 });
CanteenQRCodeSchema.index({ hash: 1 });

// Update updatedAt before saving
CanteenQRCodeSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const CanteenQRCode = mongoose.model<ICanteenQRCode>('CanteenQRCode', CanteenQRCodeSchema);
