import { PrismaClient, Prisma } from '@prisma/client';
import { connectToMongoDB } from './mongodb';
import {
  User, InsertUser as SharedInsertUser, UserRole
} from "@shared/schema";
import {
  Order, OrderItem, Notification, LoginIssue, Payment, Complaint, Coupon, Counter, UserAddress,
  MenuItem, Category, MediaBanner, CodingChallenge, CanteenCharge,
  type ICategory, type IMenuItem, type IOrder, type IOrderItem,
  type INotification, type ILoginIssue, type IPayment, type IComplaint, type ICoupon, type ICounter, type IUserAddress
} from './models/mongodb-models';
import { db as getPostgresDb } from "./db";
import mongoose from 'mongoose';

// Type definitions for insert operations
export type InsertUser = Prisma.UserCreateInput;
export type InsertCategory = { name: string; canteenId: string };

export interface UserFilters {
  search?: string;
  role?: string;
  college?: string;
  department?: string;
  year?: string;
}
export type InsertMenuItem = {
  name: string;
  price: number;
  categoryId?: string;
  canteenId: string;
  available?: boolean;
  stock?: number;
  description?: string;
  addOns?: string;
  isVegetarian?: boolean;
  isMarkable?: boolean;
  isTrending?: boolean
};
export type InsertOrder = {
  orderNumber: string;
  customerId?: number;
  customerName: string;
  items: string;
  amount: number;
  status?: string;
  estimatedTime?: number;
  barcode: string;
  canteenId: string;
  seenBy?: number[];
  // Counter assignment fields
  storeCounterId?: string;
  paymentCounterId?: string;
  allStoreCounterIds?: string[];
  allPaymentCounterIds?: string[];
  allCounterIds?: string[];
  // Delivery person assignment
  deliveryPersonId?: string;
  // Payment information
  paymentStatus?: string;
  paymentMethod?: string;
};
export type InsertNotification = { type: string; message: string; read?: boolean };
export type InsertLoginIssue = {
  name: string;
  email?: string;
  phoneNumber?: string;
  registerNumber?: string;
  staffId?: string;
  issueType: string;
  description: string;
  status?: string
};
export type InsertPayment = {
  customerId?: number; // PostgreSQL user ID for user-specific payment queries
  orderId?: string | null;
  canteenId?: string; // Added canteenId field
  merchantTransactionId: string;
  phonePeTransactionId?: string; // Legacy field for backward compatibility
  razorpayTransactionId?: string;
  amount: number;
  status?: string;
  paymentMethod?: string;
  responseCode?: string;
  responseMessage?: string;
  checksum?: string;
  metadata?: string
};
export type InsertComplaint = {
  subject: string;
  description: string;
  userId?: number;
  userName: string;
  userEmail?: string;
  category?: string;
  priority?: string;
  status?: string;
  orderId?: string;
  adminNotes?: string;
  resolvedBy?: string
};

export type InsertCoupon = {
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minimumOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit: number;
  isActive?: boolean;
  validFrom: Date;
  validUntil: Date;
  createdBy: number;
};

export type InsertUserAddress = {
  userId: number;
  label: string;
  fullName?: string;
  phoneNumber?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  isDefault?: boolean;
};

// Convert MongoDB document to plain object
export function mongoToPlain<T>(doc: any): T {
  if (!doc) return doc;
  if (Array.isArray(doc)) {
    return doc.map(item => mongoToPlain(item)) as any;
  }
  const obj = doc.toObject ? doc.toObject() : doc;
  if (obj._id) {
    obj.id = obj._id.toString();
    delete obj._id;
  }
  if (obj.__v !== undefined) {
    delete obj.__v;
  }
  return obj;
}

export interface IStorage {
  // Users (PostgreSQL)
  getAllUsers(): Promise<User[]>;
  getUsersPaginated(page: number, limit: number, filters?: UserFilters): Promise<{ users: User[], totalCount: number, totalPages: number, currentPage: number }>;
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined>;
  getUserByRegisterNumber(registerNumber: string): Promise<User | undefined>;
  getUserByStaffId(staffId: string): Promise<User | undefined>;
  getUserByRole(role: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  updateUserEmail(id: number, email: string): Promise<User | undefined>;
  updateUserRole(id: number, role: string): Promise<User | null>;
  blockUser(id: number): Promise<User | null>;
  unblockUser(id: number): Promise<User | null>;
  deleteUser(id: number): Promise<void>;
  deleteAllUsers(): Promise<void>;

  // User-specific data methods for admin panel
  getUserOrders(userId: number): Promise<any[]>;
  getUserPayments(userId: number): Promise<any[]>;

  getComplaintsByUser(userId: number): Promise<any[]>;

  // User Address Operations (MongoDB)
  getUserAddresses(userId: number): Promise<any[]>;
  createUserAddress(address: InsertUserAddress): Promise<any>;

  // Categories (MongoDB)
  getCategories(): Promise<any[]>;
  createCategory(category: InsertCategory): Promise<any>;
  updateCategory(id: string, data: any): Promise<any>;
  deleteCategory(id: string): Promise<void>;

  // Menu Items (MongoDB)
  getMenuItems(): Promise<any[]>;
  getMenuItem(id: string): Promise<any | undefined>;
  createMenuItem(item: InsertMenuItem): Promise<any>;
  updateMenuItem(id: string, item: Partial<InsertMenuItem>): Promise<any>;
  deleteMenuItem(id: string): Promise<void>;

  // Orders (MongoDB)
  getOrders(): Promise<any[]>;
  getOrdersPaginated(page: number, limit: number, canteenId?: string, isCounterOrder?: boolean, isOffline?: boolean): Promise<{ orders: any[], totalCount: number, totalPages: number, currentPage: number }>;
  getActiveOrdersPaginated(page: number, limit: number, canteenId?: string, customerId?: number): Promise<{ orders: any[], totalCount: number, totalPages: number, currentPage: number }>;
  getOrderStats(canteenId?: string): Promise<{ pending: number, preparing: number, completed: number, cancelled: number, total: number }>;
  getFilteredOrders(params: {
    canteenId?: string;
    search?: string;
    status?: string;
    dateRange?: string;
    amountRange?: string;
    paymentMethod?: string;
    collegeFilter?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    page: number;
    limit: number;
  }): Promise<{ orders: any[], totalCount: number, totalPages: number, currentPage: number }>;
  searchOrders(query: string, page: number, limit: number): Promise<{ orders: any[], totalCount: number, totalPages: number, currentPage: number }>;
  getOrder(id: string): Promise<any | undefined>;
  getOrderByBarcode(barcode: string): Promise<any | undefined>;
  getOrderByOrderNumber(orderNumber: string): Promise<any | undefined>;
  getOrderByQrId(qrId: string): Promise<any | undefined>;
  createOrder(order: InsertOrder): Promise<any>;
  updateOrder(id: string, order: Partial<InsertOrder & { deliveredAt?: Date; barcodeUsed?: boolean; seenBy?: number[] }>): Promise<any>;
  deleteOrder(id: string): Promise<boolean>;
  confirmOfflinePayment(orderId: string, counterId: string): Promise<any>;
  rejectOfflineOrder(orderId: string, counterId: string): Promise<any>;
  deliverOrder(orderId: string, counterId: string): Promise<any>;
  deliverOrderByDeliveryPerson(orderId: string, deliveryPersonId: string): Promise<any>;

  // Notifications (MongoDB)
  getNotifications(): Promise<any[]>;
  createNotification(notification: InsertNotification): Promise<any>;
  updateNotification(id: string, notification: Partial<InsertNotification>): Promise<any>;
  deleteNotification(id: string): Promise<void>;

  // Login Issues (MongoDB)
  getLoginIssues(): Promise<any[]>;
  getLoginIssue(id: string): Promise<any | undefined>;
  createLoginIssue(issue: InsertLoginIssue): Promise<any>;
  updateLoginIssue(id: string, issue: Partial<any>): Promise<any>;
  deleteLoginIssue(id: string): Promise<void>;


  // Payments (MongoDB)
  getPayments(): Promise<any[]>;
  getPaymentsPaginated(page: number, limit: number, searchQuery?: string, statusFilter?: string): Promise<{ payments: any[], totalCount: number, totalPages: number, currentPage: number }>;
  getPaymentsByCanteen(canteenId: string, page?: number, limit?: number): Promise<{ payments: any[], totalCount: number, totalPages: number, currentPage: number }>;
  getPaymentsByCustomerId(customerId: number, page?: number, limit?: number): Promise<{ payments: any[], totalCount: number, totalPages: number, currentPage: number }>;
  getPayment(id: string): Promise<any | undefined>;
  getPaymentByMerchantTxnId(merchantTransactionId: string): Promise<any | undefined>;
  getPaymentByMetadataField(field: string, value: string): Promise<any | undefined>;
  updatePaymentStatus(merchantTransactionId: string, status: string): Promise<any | undefined>;
  createPayment(payment: InsertPayment): Promise<any>;
  updatePayment(id: string, payment: Partial<InsertPayment>): Promise<any>;
  updatePaymentByMerchantTxnId(merchantTransactionId: string, payment: Partial<InsertPayment>): Promise<any | undefined>;
  getPaymentByRazorpayId(razorpayPaymentId: string): Promise<any | undefined>;

  // Complaints (MongoDB)
  getComplaints(): Promise<any[]>;
  getComplaint(id: string): Promise<any | undefined>;
  createComplaint(complaint: InsertComplaint): Promise<any>;
  updateComplaint(id: string, complaint: Partial<any>): Promise<any>;
  deleteComplaint(id: string): Promise<void>;

  // Coupons (MongoDB)
  getCoupons(): Promise<any[]>;
  getActiveCoupons(): Promise<any[]>;
  getCoupon(id: string): Promise<any | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<any>;
  updateCoupon(id: string, coupon: Partial<any>): Promise<any>;
  deleteCoupon(id: string): Promise<boolean>;
  toggleCouponStatus(id: string): Promise<any>;
  validateCoupon(code: string, userId?: number, orderAmount?: number): Promise<{
    valid: boolean;
    message: string;
    coupon?: any;
    discountAmount?: number;
  }>;
  applyCoupon(code: string, userId: number, orderAmount: number): Promise<{
    success: boolean;
    message: string;
    discountAmount?: number;
    finalAmount?: number;
  }>;

  // Maintenance Notice operations (MongoDB)

  // Counter operations (MongoDB)
  getCountersByCanteen(canteenId: string): Promise<any[]>;
  createCounter(data: { name: string; code: string; counterId: string; canteenId: string; type: string }): Promise<any>;
  getCounterById(counterId: string): Promise<any | null>;
  getPaymentCounterName(paymentCounterId: string): Promise<string>;
  deleteCounter(counterId: string): Promise<boolean>;

}

export class HybridStorage implements IStorage {
  constructor() {
    // MongoDB connection is initialized separately, not in constructor
    // to avoid duplicate connection attempts
  }

  // USER OPERATIONS (PostgreSQL)
  async getAllUsers(): Promise<User[]> {
    const db = getPostgresDb();
    const users = await db.user.findMany({
      orderBy: { id: 'asc' }
    });
    return users;
  }

  async getUsersPaginated(page: number, limit: number, filters?: UserFilters): Promise<{ users: User[], totalCount: number, totalPages: number, currentPage: number }> {
    const db = getPostgresDb();
    const offset = (page - 1) * limit;

    // Build where clause based on filters
    const where: any = {};
    const orConditions: any[] = [];

    if (filters?.search) {
      orConditions.push(
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { registerNumber: { contains: filters.search, mode: 'insensitive' } },
        { staffId: { contains: filters.search, mode: 'insensitive' } }
      );
    }

    if (filters?.role && filters.role !== 'all') {
      where.role = filters.role;
    }

    if (filters?.college && filters.college !== 'all') {
      where.college = filters.college;
    }

    if (filters?.department && filters.department !== 'all') {
      where.department = filters.department;
    }

    if (filters?.year && filters.year !== 'all') {
      const year = parseInt(filters.year);
      if (!isNaN(year)) {
        orConditions.push(
          { currentStudyYear: year },
          { joiningYear: year },
          { passingOutYear: year }
        );
      }
    }

    // Only add OR clause if we have OR conditions
    if (orConditions.length > 0) {
      where.OR = orConditions;
    }

    // Get total count
    const totalCount = await db.user.count({ where });

    // Get paginated users
    const users = await db.user.findMany({
      where,
      orderBy: { id: 'asc' },
      skip: offset,
      take: limit
    });

    const totalPages = Math.ceil(totalCount / limit);

    return {
      users,
      totalCount,
      totalPages,
      currentPage: page
    };
  }

  async getUser(id: number): Promise<User | undefined> {
    const db = getPostgresDb();
    const user = await db.user.findUnique({
      where: { id }
    });
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const db = getPostgresDb();
    const user = await db.user.findUnique({
      where: { email }
    });
    return user || undefined;
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    const db = getPostgresDb();
    // Try exact match and sanitized digits-only match for flexibility
    const normalizedPhone = phoneNumber.replace(/\D/g, '');
    const user = await db.user.findFirst({
      where: {
        OR: [
          { phoneNumber },
          { phoneNumber: normalizedPhone }
        ]
      }
    });
    return user || undefined;
  }

  async getUserByRegisterNumber(registerNumber: string): Promise<User | undefined> {
    const db = getPostgresDb();
    // Case-insensitive search for register number
    const user = await db.user.findFirst({
      where: {
        registerNumber: {
          equals: registerNumber,
          mode: 'insensitive'
        }
      }
    });
    return user || undefined;
  }

  async getUserByStaffId(staffId: string): Promise<User | undefined> {
    const db = getPostgresDb();
    // Case-insensitive search for staff ID
    const user = await db.user.findFirst({
      where: {
        staffId: {
          equals: staffId,
          mode: 'insensitive'
        }
      }
    });
    return user || undefined;
  }

  async getUserByRole(role: string): Promise<User | undefined> {
    const db = getPostgresDb();
    // Case-insensitive search for role
    const user = await db.user.findFirst({
      where: {
        role: {
          equals: role as any, // Cast to any to allow string search on enum
        }
      }
    });
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const db = getPostgresDb();

    // Normalize register number and staff ID to uppercase for consistency
    // For guest users, don't include registerNumber, department, or joiningYear
    const userData = { ...insertUser };

    const normalizedUser: any = {
      ...userData,
      registerNumber: insertUser.registerNumber?.toUpperCase(),
      staffId: insertUser.staffId?.toUpperCase()
    };

    // Ensure role is correctly cast to UserRole enum if it's a string
    if (typeof normalizedUser.role === "string") {
      const roleStr = normalizedUser.role;

      if (!Object.values(UserRole).includes(roleStr as UserRole)) {
        throw new Error(`Invalid role: ${normalizedUser.role}`);
      }

      normalizedUser.role = roleStr.toUpperCase() as UserRole;
    }

    console.log(normalizedUser, typeof normalizedUser.role);

    // For guest users, ensure we don't include unnecessary fields
    if (normalizedUser.role === UserRole.GUEST) {
      delete normalizedUser.registerNumber;
      delete normalizedUser.department;
      delete normalizedUser.joiningYear;
      delete normalizedUser.passingOutYear;
      delete normalizedUser.currentStudyYear;
      delete normalizedUser.isPassed;
      delete normalizedUser.staffId;
      // Keep organizationId for guest users
    }

    const user = await db.user.create({
      data: normalizedUser
    });
    return user;
  }

  async updateUser(id: number, updateData: Partial<InsertUser>): Promise<User> {
    const db = getPostgresDb();

    // Ensure role is correctly cast to UserRole enum if it's a string
    // Prisma Client expects the Enum Value (e.g. "ADMIN"), not the mapped DB string (e.g. "admin")
    if (updateData.role && typeof updateData.role === 'string') {
      const roleStr = (updateData.role as string).toUpperCase();
      // Check if the uppercase string is a valid key in UserRole
      if (Object.prototype.hasOwnProperty.call(UserRole, roleStr)) {
        // Cast to any to assign, then valid usage
        (updateData as any).role = UserRole[roleStr as keyof typeof UserRole];
      }
    }

    const user = await db.user.update({
      where: { id },
      data: updateData as any // Cast to any to handle Partial<InsertUser> vs UserUpdateInput mismatch
    });
    return user;
  }

  async updateUserEmail(id: number, email: string): Promise<User | undefined> {
    const db = getPostgresDb();
    try {
      const user = await db.user.update({
        where: { id },
        data: { email }
      });
      return user;
    } catch (error) {
      return undefined;
    }
  }

  async deleteUser(id: number): Promise<void> {
    const db = getPostgresDb();
    await db.user.delete({
      where: { id }
    });
  }

  async deleteAllUsers(): Promise<void> {
    const db = getPostgresDb();
    await db.user.deleteMany();
  }

  // USER ADDRESS OPERATIONS (MongoDB)
  async getUserAddresses(userId: number): Promise<any[]> {
    const addresses = await UserAddress.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
    return mongoToPlain(addresses);
  }

  async createUserAddress(address: InsertUserAddress): Promise<any> {
    // If setting as default, unset other defaults for this user
    if (address.isDefault) {
      await UserAddress.updateMany({ userId: address.userId }, { isDefault: false });
    }

    // If this is the first address, make it default automatically
    const count = await UserAddress.countDocuments({ userId: address.userId });
    if (count === 0) {
      address.isDefault = true;
    }

    const newAddress = new UserAddress(address);
    const saved = await newAddress.save();
    return mongoToPlain(saved);
  }

  // CATEGORY OPERATIONS (MongoDB)
  async getCategories(): Promise<any[]> {
    const categories = await Category.find().sort({ name: 1 });
    console.log('🔍 Available categories:', categories.map(cat => ({
      id: cat._id,
      name: cat.name,
      canteenId: cat.canteenId
    })));
    return mongoToPlain(categories);
  }

  async createCategory(category: InsertCategory): Promise<any> {
    const newCategory = new Category(category);
    const saved = await newCategory.save();
    return mongoToPlain(saved);
  }

  async updateCategory(id: string, data: any): Promise<any> {
    const updated = await Category.findByIdAndUpdate(id, data, { new: true });
    if (!updated) {
      throw new Error(`Category with id ${id} not found`);
    }
    return mongoToPlain(updated);
  }

  async deleteCategory(id: string): Promise<void> {
    console.log(`🗑️ Starting deletion of category ${id}`);

    try {
      // First, find and count menu items in this category
      const menuItemsInCategory = await MenuItem.find({ categoryId: id });
      console.log(`🗑️ Found ${menuItemsInCategory.length} menu items for category ${id}`);
      console.log(`🗑️ Menu items:`, menuItemsInCategory.map(item => ({ id: item._id, name: item.name, categoryId: item.categoryId })));

      // Delete all menu items in this category
      const deleteResult = await MenuItem.deleteMany({ categoryId: id });
      console.log(`🗑️ Delete result:`, deleteResult);
      console.log(`🗑️ Deleted ${deleteResult.deletedCount} menu items for category ${id}`);

      // Verify deletion
      const remainingItems = await MenuItem.find({ categoryId: id });
      console.log(`🗑️ Remaining items after deletion: ${remainingItems.length}`);

      // Then delete the category itself
      const categoryResult = await Category.findByIdAndDelete(id);
      console.log(`🗑️ Deleted category ${id}:`, categoryResult ? 'Success' : 'Not found');
    } catch (error) {
      console.error(`🗑️ Error deleting category ${id}:`, error);
      throw error;
    }
  }

  // MENU ITEM OPERATIONS (MongoDB)
  async getMenuItems(): Promise<any[]> {
    const menuItems = await MenuItem.find().populate('categoryId', 'name').sort({ name: 1 });
    console.log('🔍 Menu items with populated categories:', menuItems.map(item => ({
      id: item._id,
      name: item.name,
      categoryId: item.categoryId,
      categoryName: (item.categoryId as any)?.name || 'No category'
    })));
    console.log('🔍 Total menu items found:', menuItems.length);

    // Add fallback category names for items without categories
    const itemsWithFallback = menuItems.map(item => {
      const plainItem: any = mongoToPlain(item);
      if (!plainItem.categoryId || !plainItem.categoryId.name) {
        // Add a default category based on item name or type
        plainItem.category = this.getDefaultCategoryName(plainItem.name);
      } else {
        plainItem.category = plainItem.categoryId.name;
      }
      return plainItem;
    });

    console.log('🔍 Final menu items with categories:', itemsWithFallback.map(item => ({
      name: item.name,
      category: item.category
    })));

    return itemsWithFallback;
  }

  private getDefaultCategoryName(itemName: string): string {
    const name = itemName.toLowerCase();
    if (name.includes('tea') || name.includes('coffee') || name.includes('juice') || name.includes('drink')) {
      return 'Beverages';
    } else if (name.includes('rice') || name.includes('biryani') || name.includes('curry')) {
      return 'Main Course';
    } else if (name.includes('snack') || name.includes('samosa') || name.includes('pakora')) {
      return 'Snacks';
    } else if (name.includes('sweet') || name.includes('dessert') || name.includes('cake')) {
      return 'Desserts';
    } else if (name.includes('bread') || name.includes('roti') || name.includes('naan')) {
      return 'Bread';
    } else {
      return 'Main Course';
    }
  }

  async getMenuItem(id: string): Promise<any | undefined> {
    // Use lean() to get plain JavaScript object (preserves all fields including counter IDs)
    const item = await MenuItem.findById(id)
      .populate('categoryId', 'name')
      .lean(); // Use lean() to get plain object directly

    if (!item) return undefined;

    const plainItem: any = mongoToPlain(item);
    if (!plainItem.categoryId || !plainItem.categoryId.name) {
      plainItem.category = this.getDefaultCategoryName(plainItem.name);
    } else {
      plainItem.category = plainItem.categoryId.name;
    }

    // Counter IDs should already be in plainItem from lean() and mongoToPlain()
    // No need to modify them - they're already there if in DB

    return plainItem;
  }

  async createMenuItem(item: InsertMenuItem): Promise<any> {
    const newItem = new MenuItem(item);
    const saved = await newItem.save();
    return mongoToPlain(saved);
  }

  async updateMenuItem(id: string, item: Partial<InsertMenuItem>): Promise<any> {
    const updatedItem = await MenuItem.findByIdAndUpdate(
      id,
      { $set: item },
      { new: true, runValidators: true }
    );
    return mongoToPlain(updatedItem);
  }

  async deleteMenuItem(id: string): Promise<void> {
    await MenuItem.findByIdAndDelete(id);
  }

  // ORDER OPERATIONS (MongoDB)
  async getOrders(): Promise<any[]> {
    const orders = await Order.find().sort({ createdAt: -1 });
    return mongoToPlain(orders);
  }

  async getOrdersPaginated(page: number = 1, limit: number = 15, canteenId?: string, isCounterOrder?: boolean, isOffline?: boolean): Promise<{ orders: any[], totalCount: number, totalPages: number, currentPage: number }> {
    const skip = (page - 1) * limit;
    const filter: any = canteenId ? { canteenId } : {};

    if (isCounterOrder !== undefined) {
      filter.isCounterOrder = isCounterOrder;
    }

    if (isOffline !== undefined) {
      filter.isOffline = isOffline;
    }

    const [orders, totalCount] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(filter)
    ]);

    return {
      orders: mongoToPlain(orders),
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    };
  }

  async getActiveOrdersPaginated(page: number = 1, limit: number = 15, canteenId?: string, customerId?: number): Promise<{ orders: any[], totalCount: number, totalPages: number, currentPage: number }> {
    const skip = (page - 1) * limit;
    // Include all active order statuses: placed, pending, pending_payment (COD), preparing, ready (ready for pickup)
    const activeStatusFilter = { status: { $in: ['placed', 'pending', 'pending_payment', 'preparing', 'ready'] } };
    let filter: any = { ...activeStatusFilter };

    // Filter by customerId if provided (for user-specific orders)
    if (customerId) {
      filter.customerId = customerId;
    }

    // Filter by canteenId if provided
    if (canteenId) {
      filter.canteenId = canteenId;
    }

    const [orders, totalCount] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), // Newest first for user's current order
      Order.countDocuments(filter)
    ]);

    return {
      orders: mongoToPlain(orders),
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    };
  }

  /**
   * Get user's active orders efficiently - optimized for home page
   * Filters at DB level, no server-side or client-side filtering needed
   * Uses compound index: { customerId: 1, status: 1, createdAt: -1 }
   */
  async getUserActiveOrders(customerId: number): Promise<any[]> {
    // Active statuses (non-delivered, non-cancelled)
    const activeStatuses = ['placed', 'pending', 'pending_payment', 'preparing', 'ready'];

    // ✅ Efficient DB-level query with compound index
    const orders = await Order.find({
      customerId: customerId,
      status: { $in: activeStatuses }
    })
      .sort({ createdAt: -1 }) // Newest first
      .limit(10) // Realistically, users have max 3-5 active orders
      .select('orderNumber customerId customerName collegeName items amount originalAmount discountAmount appliedCoupon status estimatedTime barcode canteenId createdAt')
      .lean(); // Use lean() for faster reads - no mongoose overhead

    return orders.map(order => {
      if (order._id) {
        (order as any).id = order._id.toString();
        delete (order as any)._id;
      }
      if ((order as any).__v !== undefined) {
        delete (order as any).__v;
      }
      return order;
    });
  }

  async getOrderStats(canteenId?: string): Promise<{ pending: number, preparing: number, completed: number, cancelled: number, total: number }> {
    try {
      console.log('📊 getOrderStats called with canteenId:', canteenId);

      // Check MongoDB connection with retry logic
      let retries = 0;
      const maxRetries = 5;

      while (mongoose.connection.readyState !== 1 && retries < maxRetries) {
        console.log(`📊 MongoDB not connected (attempt ${retries + 1}/${maxRetries}), attempting to connect...`);
        await connectToMongoDB();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        retries++;
      }

      if (mongoose.connection.readyState !== 1) {
        throw new Error('Failed to establish MongoDB connection after multiple attempts');
      }

      const filter = canteenId ? { canteenId } : {};
      console.log('📊 Filter for stats:', filter);

      const [pending, preparing, completed, cancelled, total] = await Promise.all([
        Order.countDocuments({ ...filter, status: 'pending' }),
        Order.countDocuments({ ...filter, status: 'preparing' }),
        Order.countDocuments({ ...filter, status: 'completed' }),
        Order.countDocuments({ ...filter, status: 'cancelled' }),
        Order.countDocuments(filter)
      ]);

      const stats = {
        pending,
        preparing,
        completed,
        cancelled,
        total
      };

      console.log('📊 Order stats result:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Error in getOrderStats:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  }

  async getFilteredOrders(params: {
    canteenId?: string;
    search?: string;
    status?: string;
    dateRange?: string;
    amountRange?: string;
    paymentMethod?: string;
    collegeFilter?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    page: number;
    limit: number;
  }): Promise<{ orders: any[], totalCount: number, totalPages: number, currentPage: number }> {
    try {
      console.log('🔍 getFilteredOrders called with params:', params);

      // Check MongoDB connection with retry logic
      let retries = 0;
      const maxRetries = 5;

      while (mongoose.connection.readyState !== 1 && retries < maxRetries) {
        console.log(`🔍 MongoDB not connected (attempt ${retries + 1}/${maxRetries}), attempting to connect...`);
        await connectToMongoDB();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        retries++;
      }

      if (mongoose.connection.readyState !== 1) {
        throw new Error('Failed to establish MongoDB connection after multiple attempts');
      }

      // Build MongoDB query
      const query: any = {};

      // Canteen filter
      if (params.canteenId) {
        query.canteenId = params.canteenId;
      }

      // Status filter
      if (params.status && params.status !== 'all') {
        query.status = params.status;
      }

      // Search filter
      if (params.search) {
        const searchRegex = new RegExp(params.search, 'i');
        query.$or = [
          { orderNumber: searchRegex },
          { customerName: searchRegex },
          { items: searchRegex },
          { collegeName: searchRegex }
        ];
      }

      // Date range filter
      if (params.dateRange && params.dateRange !== 'all') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        switch (params.dateRange) {
          case 'today':
            query.createdAt = { $gte: today };
            break;
          case 'week':
            query.createdAt = { $gte: weekAgo };
            break;
          case 'month':
            query.createdAt = { $gte: monthAgo };
            break;
        }
      }

      // Amount range filter
      if (params.amountRange && params.amountRange !== 'all') {
        switch (params.amountRange) {
          case 'low':
            query.amount = { $gt: 0, $lte: 50 };
            break;
          case 'medium':
            query.amount = { $gt: 50, $lte: 150 };
            break;
          case 'high':
            query.amount = { $gt: 150 };
            break;
        }
      }

      // Payment method filter
      if (params.paymentMethod && params.paymentMethod !== 'all') {
        switch (params.paymentMethod) {
          case 'free':
            query.amount = 0;
            break;
          case 'cash':
          case 'online':
            query.amount = { $gt: 0 };
            break;
        }
      }

      // College filter
      if (params.collegeFilter && params.collegeFilter !== 'all') {
        query.$or = [
          { collegeName: params.collegeFilter },
          { collegeId: params.collegeFilter },
          { college: params.collegeFilter }
        ];
      }

      console.log('🔍 MongoDB query:', JSON.stringify(query, null, 2));

      // Build sort object
      const sortObj: any = {};
      const sortField = params.sortBy || 'createdAt';
      const sortDirection = params.sortOrder === 'asc' ? 1 : -1;
      sortObj[sortField] = sortDirection;

      console.log('🔍 Sort object:', sortObj);

      // Calculate pagination
      const skip = (params.page - 1) * params.limit;

      // Execute queries in parallel
      const [orders, totalCount] = await Promise.all([
        Order.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(params.limit)
          .lean(),
        Order.countDocuments(query)
      ]);

      const totalPages = Math.ceil(totalCount / params.limit);

      console.log(`🔍 Found ${orders.length} orders, total: ${totalCount}, pages: ${totalPages}`);

      return {
        orders: mongoToPlain(orders),
        totalCount,
        totalPages,
        currentPage: params.page
      };
    } catch (error) {
      console.error('❌ Error in getFilteredOrders:', error);
      throw error;
    }
  }

  async searchOrders(query: string, page: number = 1, limit: number = 15): Promise<{ orders: any[], totalCount: number, totalPages: number, currentPage: number }> {
    const skip = (page - 1) * limit;

    // Create a comprehensive search filter
    const searchFilter = {
      $or: [
        { orderNumber: { $regex: query, $options: 'i' } },
        { customerName: { $regex: query, $options: 'i' } },
        { items: { $regex: query, $options: 'i' } }, // Search in items JSON string
        { barcode: { $regex: query, $options: 'i' } }
      ]
    };

    const [orders, totalCount] = await Promise.all([
      Order.find(searchFilter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(searchFilter)
    ]);

    return {
      orders: mongoToPlain(orders),
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    };
  }

  async getOrder(id: string): Promise<any | undefined> {
    const order = await Order.findById(id);
    return order ? mongoToPlain(order) : undefined;
  }

  async createOrder(order: InsertOrder): Promise<any> {
    const newOrder = new Order(order);
    const saved = await newOrder.save();
    return mongoToPlain(saved);
  }

  async updateOrder(id: string, order: Partial<InsertOrder & { deliveredAt?: Date; barcodeUsed?: boolean }>): Promise<any> {
    const updatedOrder = await Order.findByIdAndUpdate(id, order, { new: true });
    return mongoToPlain(updatedOrder);
  }

  async getOrderByBarcode(barcode: string): Promise<any | undefined> {
    // First try exact barcode match
    let order = await Order.findOne({ barcode });

    // If not found and barcode is 4 digits, try to find by first 4 digits (OTP)
    if (!order && barcode.length === 4 && /^\d{4}$/.test(barcode)) {
      // Use regex to find orders where barcode starts with these 4 digits
      const regex = new RegExp('^' + barcode);
      order = await Order.findOne({ barcode: regex });
    }

    return order ? mongoToPlain(order) : undefined;
  }

  async getOrderByOrderNumber(orderNumber: string): Promise<any | undefined> {
    const order = await Order.findOne({ orderNumber });
    return order ? mongoToPlain(order) : undefined;
  }

  async getOrderByQrId(qrId: string): Promise<any | undefined> {
    const order = await Order.findOne({ qrId });
    return order ? mongoToPlain(order) : undefined;
  }

  async deleteOrder(id: string): Promise<boolean> {
    try {
      const result = await Order.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error('Error deleting order:', error);
      return false;
    }
  }

  // NOTIFICATION OPERATIONS (MongoDB)
  async getNotifications(): Promise<any[]> {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    return mongoToPlain(notifications);
  }

  async createNotification(notification: InsertNotification): Promise<any> {
    const newNotification = new Notification(notification);
    const saved = await newNotification.save();
    return mongoToPlain(saved);
  }

  async updateNotification(id: string, notification: Partial<InsertNotification>): Promise<any> {
    const updatedNotification = await Notification.findByIdAndUpdate(id, notification, { new: true });
    return mongoToPlain(updatedNotification);
  }

  async deleteNotification(id: string): Promise<void> {
    await Notification.findByIdAndDelete(id);
  }

  // LOGIN ISSUE OPERATIONS (MongoDB)
  async getLoginIssues(): Promise<any[]> {
    const issues = await LoginIssue.find().sort({ createdAt: -1 });
    return mongoToPlain(issues);
  }

  async getLoginIssue(id: string): Promise<any | undefined> {
    const issue = await LoginIssue.findById(id);
    return issue ? mongoToPlain(issue) : undefined;
  }

  async createLoginIssue(issue: InsertLoginIssue): Promise<any> {
    const newIssue = new LoginIssue(issue);
    const saved = await newIssue.save();
    return mongoToPlain(saved);
  }

  async updateLoginIssue(id: string, updateData: Partial<any>): Promise<any> {
    const updatedIssue = await LoginIssue.findByIdAndUpdate(id, updateData, { new: true });
    return mongoToPlain(updatedIssue);
  }

  async deleteLoginIssue(id: string): Promise<void> {
    await LoginIssue.findByIdAndDelete(id);
  }


  // PAYMENT OPERATIONS (MongoDB)
  async getPayments(): Promise<any[]> {
    const payments = await Payment.find().sort({ createdAt: -1 });
    return mongoToPlain(payments);
  }

  async getPaymentsPaginated(page: number, limit: number, searchQuery?: string, statusFilter?: string): Promise<{ payments: any[], totalCount: number, totalPages: number, currentPage: number }> {
    const skip = (page - 1) * limit;

    // Build search filter
    let filter: any = {};

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      filter.status = { $regex: new RegExp(statusFilter, 'i') };
    }

    // Search query filter
    if (searchQuery && searchQuery.trim()) {
      const searchRegex = new RegExp(searchQuery.trim(), 'i');
      filter.$or = [
        { merchantTransactionId: searchRegex },
        {
          $or: [
            { phonePeTransactionId: searchRegex },
            { razorpayTransactionId: searchRegex }
          ]
        },
        { paymentMethod: searchRegex },
        { responseCode: searchRegex },
        { responseMessage: searchRegex }
      ];
    }

    const [payments, totalCount] = await Promise.all([
      Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Payment.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      payments: mongoToPlain(payments),
      totalCount,
      totalPages,
      currentPage: page
    };
  }

  async getPaymentsByCanteen(canteenId: string, page: number = 1, limit: number = 10): Promise<{ payments: any[], totalCount: number, totalPages: number, currentPage: number }> {
    const skip = (page - 1) * limit;

    // Get payments directly by canteenId (new approach)
    const [payments, totalCount] = await Promise.all([
      Payment.find({ canteenId })
        .populate('orderId', 'orderNumber customerName amount status createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments({ canteenId })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      payments: mongoToPlain(payments),
      totalCount,
      totalPages,
      currentPage: page
    };
  }

  async getPaymentsByCustomerId(customerId: number, page: number = 1, limit: number = 20): Promise<{ payments: any[], totalCount: number, totalPages: number, currentPage: number }> {
    const skip = (page - 1) * limit;

    const [payments, totalCount] = await Promise.all([
      Payment.find({ customerId })
        .populate('orderId', 'orderNumber customerName amount status createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Payment.countDocuments({ customerId })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      payments: mongoToPlain(payments),
      totalCount,
      totalPages,
      currentPage: page
    };
  }

  async getPayment(id: string): Promise<any | undefined> {
    const payment = await Payment.findById(id);
    return payment ? mongoToPlain(payment) : undefined;
  }

  async getPaymentByMerchantTxnId(merchantTransactionId: string): Promise<any | undefined> {
    const payment = await Payment.findOne({ merchantTransactionId });
    return payment ? mongoToPlain(payment) : undefined;
  }

  async createPayment(payment: InsertPayment): Promise<any> {
    const newPayment = new Payment(payment);
    const saved = await newPayment.save();
    return mongoToPlain(saved);
  }

  async updatePayment(id: string, payment: Partial<InsertPayment>): Promise<any> {
    const updatedPayment = await Payment.findByIdAndUpdate(
      id,
      { ...payment, updatedAt: new Date() },
      { new: true }
    );
    return mongoToPlain(updatedPayment);
  }

  async updatePaymentByMerchantTxnId(merchantTransactionId: string, payment: Partial<InsertPayment>): Promise<any | undefined> {
    try {
      const updatedPayment = await Payment.findOneAndUpdate(
        { merchantTransactionId },
        { ...payment, updatedAt: new Date() },
        { new: true }
      );
      return updatedPayment ? mongoToPlain(updatedPayment) : undefined;
    } catch (error) {
      return undefined;
    }
  }

  async getPaymentByMetadataField(field: string, value: string): Promise<any | undefined> {
    try {
      const regex = new RegExp(`"${field}"\\s*:\\s*"${value}"`, 'i');
      const payment = await Payment.findOne({ metadata: { $regex: regex } });
      return payment ? mongoToPlain(payment) : undefined;
    } catch (error) {
      console.error('Error fetching payment by metadata field:', error);
      return undefined;
    }
  }

  async updatePaymentStatus(merchantTransactionId: string, status: string): Promise<any | undefined> {
    try {
      const updatedPayment = await Payment.findOneAndUpdate(
        { merchantTransactionId },
        { status, updatedAt: new Date() },
        { new: true }
      );
      return updatedPayment ? mongoToPlain(updatedPayment) : undefined;
    } catch (error) {
      console.error('Error updating payment status:', error);
      return undefined;
    }
  }

  // Complaint methods
  async createComplaint(complaintData: InsertComplaint): Promise<any> {
    const complaint = new Complaint(complaintData);
    const saved = await complaint.save();
    return mongoToPlain(saved);
  }

  async getComplaints(): Promise<any[]> {
    const complaints = await Complaint.find().sort({ createdAt: -1 });
    return mongoToPlain(complaints);
  }

  async getComplaint(id: string): Promise<any | undefined> {
    const complaint = await Complaint.findById(id);
    return complaint ? mongoToPlain(complaint) : undefined;
  }

  async updateComplaint(id: string, updateData: Partial<InsertComplaint>): Promise<any | undefined> {
    const complaint = await Complaint.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );
    return complaint ? mongoToPlain(complaint) : undefined;
  }

  async deleteComplaint(id: string): Promise<any | undefined> {
    const result = await Complaint.findByIdAndDelete(id);
    return result ? mongoToPlain(result) : undefined;
  }

  async getComplaintsByStatus(status: string): Promise<any[]> {
    const complaints = await Complaint.find({ status }).sort({ createdAt: -1 });
    return mongoToPlain(complaints);
  }

  async getComplaintsByUser(userId: number): Promise<any[]> {
    const complaints = await Complaint.find({ userId }).sort({ createdAt: -1 });
    return mongoToPlain(complaints);
  }

  // Additional user-specific methods for admin panel
  async getUserOrders(userId: number): Promise<any[]> {
    const orders = await Order.find({ customerId: userId }).sort({ createdAt: -1 });
    return mongoToPlain(orders);
  }

  async getUserPayments(userId: number): Promise<any[]> {
    // Get orders for the user first, then get payments for those orders
    const userOrders = await Order.find({ customerId: userId }, { _id: 1 });
    const orderIds = userOrders.map(order => order._id);
    const payments = await Payment.find({ orderId: { $in: orderIds } }).sort({ createdAt: -1 });
    return mongoToPlain(payments);
  }

  async updateUserRole(id: number, role: string): Promise<User | null> {
    const db = getPostgresDb();
    return await db.user.update({
      where: { id },
      data: { role: role as any }
    });
  }

  async blockUser(id: number): Promise<User | null> {
    // For now, we'll use a role-based approach for blocking
    const db = getPostgresDb();
    const user = await db.user.findUnique({ where: { id } });
    if (!user) return null;

    return await db.user.update({
      where: { id },
      data: { role: ('blocked_' + user.role) as any } // Cast to any to allow non-enum value
    });
  }

  async unblockUser(id: number): Promise<User | null> {
    const db = getPostgresDb();
    const user = await db.user.findUnique({ where: { id } });
    if (!user) return null;

    // Remove 'blocked_' prefix if it exists
    const unblocked_role = user.role?.startsWith('blocked_')
      ? user.role.replace('blocked_', '')
      : user.role;

    return await db.user.update({
      where: { id },
      data: { role: unblocked_role as any }
    });
  }

  // ===========================================
  // COUPON METHODS (MongoDB)
  // ===========================================

  async getCoupons(): Promise<any[]> {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    return mongoToPlain(coupons);
  }

  async getActiveCoupons(): Promise<any[]> {
    const now = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $expr: { $lt: ['$usedCount', '$usageLimit'] }
    }).sort({ createdAt: -1 });
    return mongoToPlain(coupons);
  }

  async getCoupon(id: string): Promise<any | undefined> {
    const coupon = await Coupon.findById(id);
    return coupon ? mongoToPlain(coupon) : undefined;
  }

  async createCoupon(couponData: InsertCoupon): Promise<any> {
    const coupon = new Coupon({
      ...couponData,
      usedCount: 0,
      usedBy: [],
      usageHistory: [],
      assignmentType: (couponData as any).assignmentType || 'all',
      assignedUsers: (couponData as any).assignedUsers || [],
      isActive: couponData.isActive ?? true
    });
    const saved = await coupon.save();
    return mongoToPlain(saved);
  }

  async updateCoupon(id: string, updateData: Partial<any>): Promise<any | undefined> {
    const coupon = await Coupon.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    return coupon ? mongoToPlain(coupon) : undefined;
  }

  async deleteCoupon(id: string): Promise<boolean> {
    const result = await Coupon.findByIdAndDelete(id);
    return !!result;
  }

  async toggleCouponStatus(id: string): Promise<any | undefined> {
    const coupon = await Coupon.findById(id);
    if (!coupon) return undefined;

    coupon.isActive = !coupon.isActive;
    const saved = await coupon.save();
    return mongoToPlain(saved);
  }

  async validateCoupon(code: string, userId?: number, orderAmount?: number): Promise<{
    valid: boolean;
    message: string;
    coupon?: any;
    discountAmount?: number;
  }> {
    try {
      const coupon = await Coupon.findOne({ code });

      if (!coupon) {
        return { valid: false, message: 'Coupon not found' };
      }

      if (!coupon.isActive) {
        return { valid: false, message: 'Coupon is not active' };
      }

      // Check if coupon is assigned to specific users and user is authorized
      if (coupon.assignmentType === 'specific' && userId) {
        if (!coupon.assignedUsers.includes(userId)) {
          return { valid: false, message: 'This coupon is not assigned to you' };
        }
      }

      const now = new Date();
      if (now < coupon.validFrom) {
        return { valid: false, message: 'Coupon is not yet valid' };
      }

      if (now > coupon.validUntil) {
        return { valid: false, message: 'Coupon has expired' };
      }

      if (coupon.usedCount >= coupon.usageLimit) {
        return { valid: false, message: 'Coupon usage limit reached' };
      }

      if (userId && coupon.usedBy.includes(userId)) {
        return { valid: false, message: 'You have already used this coupon' };
      }

      if (orderAmount && coupon.minimumOrderAmount && orderAmount < coupon.minimumOrderAmount) {
        return {
          valid: false,
          message: `Minimum order amount of ₹${coupon.minimumOrderAmount} required`
        };
      }

      let discountAmount = 0;
      if (orderAmount) {
        if (coupon.discountType === 'percentage') {
          discountAmount = (orderAmount * coupon.discountValue) / 100;
          if (coupon.maxDiscountAmount) {
            discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
          }
        } else {
          discountAmount = coupon.discountValue;
        }
        discountAmount = Math.min(discountAmount, orderAmount);
      }

      return {
        valid: true,
        message: 'Coupon is valid',
        coupon: mongoToPlain(coupon),
        discountAmount
      };
    } catch (error) {
      console.error('Error validating coupon:', error);
      return { valid: false, message: 'Error validating coupon' };
    }
  }

  async applyCoupon(code: string, userId: number, orderAmount: number, orderId?: string, orderNumber?: string): Promise<{
    success: boolean;
    message: string;
    discountAmount?: number;
    finalAmount?: number;
  }> {
    try {
      const validation = await this.validateCoupon(code, userId, orderAmount);

      if (!validation.valid) {
        return {
          success: false,
          message: validation.message
        };
      }

      const coupon = await Coupon.findOne({ code });
      if (!coupon) {
        return { success: false, message: 'Coupon not found' };
      }

      const discountAmount = validation.discountAmount || 0;
      const finalAmount = orderAmount - discountAmount;

      // Prepare usage history entry
      const usageHistoryEntry = {
        userId,
        orderId: orderId ? new mongoose.Types.ObjectId(orderId) : new mongoose.Types.ObjectId(),
        orderNumber: orderNumber || 'N/A',
        discountAmount,
        usedAt: new Date()
      };

      // Update coupon usage with detailed history
      await Coupon.findByIdAndUpdate(coupon._id, {
        $inc: { usedCount: 1 },
        $addToSet: { usedBy: userId },
        $push: { usageHistory: usageHistoryEntry }
      });

      return {
        success: true,
        message: 'Coupon applied successfully',
        discountAmount,
        finalAmount
      };
    } catch (error) {
      console.error('Error applying coupon:', error);
      return { success: false, message: 'Error applying coupon' };
    }
  }

  // New methods for enhanced coupon management
  async getCouponUsageDetails(couponId: string): Promise<{
    success: boolean;
    coupon?: any;
    usageDetails?: {
      totalUsed: number;
      usersWhoUsed: any[];
      usageHistory: any[];
      assignedUsers?: any[];
    };
  }> {
    try {
      const coupon = await Coupon.findById(couponId);
      if (!coupon) {
        return { success: false };
      }

      // Get user details for users who have used the coupon
      const usersWhoUsed = [];
      if (coupon.usedBy.length > 0) {
        const users = await this.getUsersByIds(coupon.usedBy);
        usersWhoUsed.push(...users);
      }

      // Get assigned user details if it's a specific assignment coupon
      let assignedUsers = [];
      if (coupon.assignmentType === 'specific' && coupon.assignedUsers.length > 0) {
        assignedUsers = await this.getUsersByIds(coupon.assignedUsers);
      }

      return {
        success: true,
        coupon: mongoToPlain(coupon),
        usageDetails: {
          totalUsed: coupon.usedCount,
          usersWhoUsed,
          usageHistory: coupon.usageHistory || [],
          assignedUsers
        }
      };
    } catch (error) {
      console.error('Error getting coupon usage details:', error);
      return { success: false };
    }
  }

  async assignCouponToUsers(couponId: string, userIds: number[]): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const coupon = await Coupon.findByIdAndUpdate(
        couponId,
        {
          assignmentType: 'specific',
          assignedUsers: userIds
        },
        { new: true }
      );

      if (!coupon) {
        return { success: false, message: 'Coupon not found' };
      }

      return {
        success: true,
        message: `Coupon assigned to ${userIds.length} user(s)`
      };
    } catch (error) {
      console.error('Error assigning coupon to users:', error);
      return { success: false, message: 'Error assigning coupon' };
    }
  }

  async getCouponsForUser(userId: number): Promise<any[]> {
    try {
      const now = new Date();

      // Find coupons assigned to this specific user or available to all
      const coupons = await Coupon.find({
        isActive: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
        $expr: { $lt: ['$usedCount', '$usageLimit'] },
        $or: [
          { assignmentType: 'all' },
          { assignmentType: 'specific', assignedUsers: userId }
        ],
        usedBy: { $ne: userId } // Exclude already used coupons
      }).sort({ createdAt: -1 });

      return mongoToPlain(coupons);
    } catch (error) {
      console.error('Error getting coupons for user:', error);
      return [];
    }
  }

  async getUsersByIds(userIds: number[]): Promise<any[]> {
    try {
      const db = getPostgresDb();
      const users = await db.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          registerNumber: true,
          staffId: true,
          department: true,
          createdAt: true
        }
      });
      return users;
    } catch (error) {
      console.error('Error getting users by IDs:', error);
      return [];
    }
  }

  // DATABASE MANAGEMENT OPERATIONS

  /**
   * Get database statistics for admin dashboard
   */
  async getDatabaseStats() {
    try {
      const mongoStats = await this.getMongoDBStats();
      const pgStats = await this.getPostgreSQLStats();

      const totalSizeBytes = (mongoStats.dataSize || 0) + (pgStats.size || 0);

      return {
        mongodb: mongoStats,
        postgresql: pgStats,
        overall: {
          totalSize: totalSizeBytes,
          totalConnections: 0, // Can be calculated from individual database connections
          averageResponseTime: 0, // Can be calculated from individual response times
          healthScore: 95, // Can be calculated based on various factors
          status: 'healthy' as const,
          alerts: []
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      throw error;
    }
  }

  /**
   * Get MongoDB collection statistics
   */
  async getMongoDBStats() {
    try {
      // Use centralized connection check
      const { isMongoConnected } = await import('./mongodb');

      if (!isMongoConnected()) {
        throw new Error('MongoDB not connected');
      }

      // Wait for the db property to be available
      let retries = 0;
      while (!mongoose.connection.db && retries < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }

      if (!mongoose.connection.db) {
        throw new Error('MongoDB database not available');
      }

      const admin = mongoose.connection.db.admin();
      const dbStats = await admin.command({ dbStats: 1 });


      // Get collection stats (real-time data only)
      const collections = await mongoose.connection.db.listCollections().toArray();
      const collectionStats = [];
      let totalDataSize = 0;
      let totalStorageSize = 0;
      let totalIndexSize = 0;

      for (const collection of collections) {
        try {
          const stats = await mongoose.connection.db.command({ collStats: collection.name });
          const count = await mongoose.connection.db.collection(collection.name).countDocuments();

          const collectionSize = stats.size || 0;
          const collectionStorageSize = stats.storageSize || 0;
          const collectionIndexSize = stats.totalIndexSize || 0;


          totalDataSize += collectionSize;
          totalStorageSize += collectionStorageSize;
          totalIndexSize += collectionIndexSize;

          collectionStats.push({
            name: collection.name,
            count: count,
            size: collectionSize,
            storageSize: collectionStorageSize,
            avgObjSize: stats.avgObjSize || 0,
            indexes: stats.nindexes || 0,
            indexSize: collectionIndexSize
          });

        } catch (err) {
          console.warn(`Could not get stats for collection ${collection.name}:`, err instanceof Error ? err.message : String(err));
        }
      }

      // Use the calculated totals if dbStats shows 0
      const finalDataSize = dbStats.dataSize || totalDataSize;
      const finalStorageSize = dbStats.storageSize || totalStorageSize;
      const finalIndexSize = dbStats.indexSize || totalIndexSize;


      return {
        dataSize: finalDataSize,
        storageSize: finalStorageSize,
        indexSize: finalIndexSize,
        collections: collectionStats,
        totalCollections: collections.length,
        totalDocuments: collectionStats.reduce((sum, col) => sum + col.count, 0)
      };
    } catch (error) {
      console.error('Error getting MongoDB stats:', error);
      // Don't return dummy data - throw error to indicate real data is not available
      throw new Error(`Cannot fetch real-time MongoDB data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get PostgreSQL database statistics
   */
  async getPostgreSQLStats() {
    try {
      const db = getPostgresDb();

      // Get database size
      const sizeResult = await db.$queryRaw`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size,
               pg_database_size(current_database()) as size_bytes
      ` as Array<{ size: string; size_bytes: bigint }>;

      // Get table statistics
      const tableStats = await db.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats 
        WHERE schemaname = 'public'
        ORDER BY tablename, attname
      ` as Array<any>;

      // Get user count
      const userCount = await db.user.count();

      return {
        size: Number(sizeResult[0]?.size_bytes || 0),
        sizeFormatted: sizeResult[0]?.size || '0 bytes',
        tables: {
          users: {
            name: 'users',
            count: userCount,
            columns: tableStats.filter(stat => stat.tablename === 'users').length
          }
        },
        totalTables: 1,
        totalRecords: userCount
      };
    } catch (error) {
      console.error('Error getting PostgreSQL stats:', error);
      return {
        size: 0,
        sizeFormatted: '0 bytes',
        tables: {},
        totalTables: 0,
        totalRecords: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Run database maintenance operations (alias for compatibility)
   */
  async runMaintenance(operations: string[]) {
    return this.runDatabaseMaintenance(operations);
  }

  /**
   * Run database maintenance operations
   */
  async runDatabaseMaintenance(operations: string[]) {
    const results = [];

    for (const operation of operations) {
      try {
        switch (operation) {
          case 'analyze_postgres':
            await this.analyzePostgreSQL();
            results.push({ operation, status: 'success', message: 'PostgreSQL analysis completed' });
            break;

          case 'compact_mongo':
            await this.compactMongoDB();
            results.push({ operation, status: 'success', message: 'MongoDB compaction initiated' });
            break;

          case 'rebuild_indexes':
            await this.rebuildMongoIndexes();
            results.push({ operation, status: 'success', message: 'MongoDB indexes rebuilt' });
            break;

          case 'vacuum_postgres':
            await this.vacuumPostgreSQL();
            results.push({ operation, status: 'success', message: 'PostgreSQL vacuum completed' });
            break;

          case 'optimize_postgres':
            await this.optimizePostgreSQL();
            results.push({ operation, status: 'success', message: 'PostgreSQL optimization completed' });
            break;

          case 'cleanup_mongo':
            await this.cleanupMongoDB();
            results.push({ operation, status: 'success', message: 'MongoDB cleanup completed' });
            break;

          case 'reindex_postgres':
            await this.reindexPostgreSQL();
            results.push({ operation, status: 'success', message: 'PostgreSQL reindexing completed' });
            break;

          case 'validate_mongo':
            await this.validateMongoCollections();
            results.push({ operation, status: 'success', message: 'MongoDB collections validated' });
            break;

          default:
            results.push({ operation, status: 'error', message: 'Unknown operation' });
        }
      } catch (error) {
        results.push({
          operation,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Analyze PostgreSQL tables for optimization
   */
  private async analyzePostgreSQL() {
    const db = getPostgresDb();
    await db.$executeRaw`ANALYZE`;
  }

  /**
   * Vacuum PostgreSQL database
   */
  private async vacuumPostgreSQL() {
    const db = getPostgresDb();
    await db.$executeRaw`VACUUM ANALYZE`;
  }

  /**
   * Compact MongoDB collections
   */
  private async compactMongoDB() {
    if (!mongoose.connection.db) {
      throw new Error('MongoDB not connected');
    }

    // Get MongoDB version to check if compact is supported
    const admin = mongoose.connection.db.admin();
    const buildInfo = await admin.buildInfo();
    const version = buildInfo.version;
    const majorVersion = parseInt(version.split('.')[0]);

    if (majorVersion >= 4) {
      // Use compact command for MongoDB 4.0+
      const collections = await mongoose.connection.db.listCollections().toArray();

      for (const collection of collections) {
        try {
          await mongoose.connection.db.command({ compact: collection.name });
        } catch (error) {
          console.warn(`Could not compact collection ${collection.name}:`, error instanceof Error ? error.message : String(error));
        }
      }
    } else {
      console.log('MongoDB version does not support compact command');
    }
  }

  /**
   * Rebuild MongoDB indexes
   */
  private async rebuildMongoIndexes() {
    if (!mongoose.connection.db) {
      throw new Error('MongoDB not connected');
    }

    const collections = await mongoose.connection.db.listCollections().toArray();

    for (const collection of collections) {
      try {
        await mongoose.connection.db.command({ reIndex: collection.name });
      } catch (error) {
        console.warn(`Could not rebuild indexes for collection ${collection.name}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  /**
   * Optimize PostgreSQL database
   */
  private async optimizePostgreSQL() {
    const db = getPostgresDb();

    try {
      // Run full vacuum and analyze
      await db.$executeRaw`VACUUM FULL ANALYZE`;

      // Update table statistics
      await db.$executeRaw`ANALYZE`;

      // Recompute table statistics
      await db.$executeRaw`
        UPDATE pg_stat_user_tables 
        SET last_analyze = NOW() 
        WHERE schemaname = 'public'
      `;
    } catch (error) {
      console.warn('Some PostgreSQL optimization operations failed:', error instanceof Error ? error.message : String(error));
      // Fallback to basic operations if full optimization fails
      await db.$executeRaw`VACUUM ANALYZE`;
    }
  }

  /**
   * Clean up MongoDB collections
   */
  private async cleanupMongoDB() {
    if (!mongoose.connection.db) {
      throw new Error('MongoDB not connected');
    }

    const collections = await mongoose.connection.db.listCollections().toArray();

    for (const collection of collections) {
      try {
        const collectionObj = mongoose.connection.db.collection(collection.name);

        // Remove documents with null or undefined critical fields (if any)
        // This is a basic cleanup - in a real app you'd have specific cleanup rules
        const result = await collectionObj.deleteMany({
          $or: [
            { _id: { $type: 10 } }, // BSON null type
            { _id: { $exists: false } }
          ]
        });

        if (result.deletedCount > 0) {
          console.log(`Cleaned up ${result.deletedCount} invalid documents from ${collection.name}`);
        }
      } catch (error) {
        console.warn(`Could not clean up collection ${collection.name}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  /**
   * Reindex PostgreSQL database
   */
  private async reindexPostgreSQL() {
    const db = getPostgresDb();

    try {
      // Reindex all indexes in the database
      await db.$executeRaw`REINDEX DATABASE CURRENT_DATABASE()`;
    } catch (error) {
      console.warn('Full database reindex failed, trying table-level reindex:', error instanceof Error ? error.message : String(error));

      try {
        // Fallback to reindexing specific tables
        await db.$executeRaw`REINDEX TABLE "User"`;
      } catch (fallbackError) {
        console.warn('Table-level reindex also failed:', fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
        throw new Error('PostgreSQL reindexing failed');
      }
    }
  }

  /**
   * Validate MongoDB collections
   */
  private async validateMongoCollections() {
    if (!mongoose.connection.db) {
      throw new Error('MongoDB not connected');
    }

    const collections = await mongoose.connection.db.listCollections().toArray();
    const validationResults = [];

    for (const collection of collections) {
      try {
        const result = await mongoose.connection.db.command({
          validate: collection.name,
          full: false // Set to true for more thorough validation (slower)
        });

        validationResults.push({
          collection: collection.name,
          valid: result.valid,
          warnings: result.warnings || [],
          errors: result.errors || []
        });

        if (!result.valid) {
          console.warn(`Collection ${collection.name} validation failed:`, result);
        }
      } catch (error) {
        console.warn(`Could not validate collection ${collection.name}:`, error instanceof Error ? error.message : String(error));
        validationResults.push({
          collection: collection.name,
          valid: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return validationResults;
  }

  /**
   * Create database backup metadata
   */
  async createBackupMetadata(type: 'mongodb' | 'postgresql' | 'full') {
    const timestamp = new Date().toISOString();
    const metadata = {
      id: `backup_${Date.now()}`,
      type,
      timestamp,
      status: 'initiated',
      size: 0,
      collections: [] as string[],
      tables: [] as string[]
    };

    if (type === 'mongodb' || type === 'full') {
      const mongoStats = await this.getMongoDBStats();
      metadata.collections = mongoStats.collections.map(c => c.name);
      metadata.size += mongoStats.dataSize;
    }

    if (type === 'postgresql' || type === 'full') {
      const pgStats = await this.getPostgreSQLStats();
      metadata.tables = Object.keys(pgStats.tables);
      metadata.size += pgStats.size;
    }

    return metadata;
  }

  // BACKUP AND RESTORE OPERATIONS

  /**
   * Create database backup
   */
  async createBackup(type: 'mongodb' | 'postgresql' | 'full') {
    const timestamp = new Date().toISOString();
    const backupId = `backup_${Date.now()}`;

    try {
      let backupData: any = {
        id: backupId,
        type,
        timestamp,
        status: 'in_progress',
        data: {},
        downloadable: false
      };

      if (type === 'mongodb' || type === 'full') {
        // MongoDB backup
        const mongoBackup = await this.createMongoBackup();
        backupData.data.mongodb = mongoBackup;
      }

      if (type === 'postgresql' || type === 'full') {
        // PostgreSQL backup
        const pgBackup = await this.createPostgreSQLBackup();
        backupData.data.postgresql = pgBackup;
        backupData.downloadable = true;
        backupData.filename = `postgresql_backup_${backupId}.sql`;
      }

      backupData.status = 'completed';
      if (type === 'postgresql') {
        backupData.size = backupData.data.postgresql.size;
      } else {
        backupData.size = JSON.stringify(backupData.data).length;
      }

      // Store backup metadata (in production, you'd store this in a proper backup storage)
      this.backupStorage.set(backupId, backupData);

      return {
        id: backupId,
        type,
        timestamp,
        status: 'completed',
        size: backupData.size,
        downloadable: backupData.downloadable,
        filename: backupData.filename
      };
    } catch (error) {
      console.error('Error creating backup:', error);
      throw new Error(`Failed to create ${type} backup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private backupStorage = new Map<string, any>();

  /**
   * Create MongoDB backup
   */
  private async createMongoBackup() {
    const collections = await mongoose.connection.db?.listCollections().toArray() || [];
    const backup: any = {};

    for (const collection of collections) {
      try {
        const collectionData = await mongoose.connection.db?.collection(collection.name).find({}).toArray();
        backup[collection.name] = collectionData;
      } catch (error) {
        console.warn(`Could not backup collection ${collection.name}:`, error instanceof Error ? error.message : String(error));
        backup[collection.name] = [];
      }
    }

    return backup;
  }

  /**
   * Create PostgreSQL backup as SQL dump
   */
  private async createPostgreSQLBackup() {
    const db = getPostgresDb();

    try {
      // Get all users (this is the main table we have)
      const users = await db.user.findMany();

      // Generate SQL dump content
      let sqlDump = `-- PostgreSQL Database Backup\n-- Generated on: ${new Date().toISOString()}\n\n`;

      // Add table creation statement
      sqlDump += `-- Table: users\n`;
      sqlDump += `DROP TABLE IF EXISTS "users";\n`;
      sqlDump += `CREATE TABLE "users" (\n`;
      sqlDump += `  "id" SERIAL PRIMARY KEY,\n`;
      sqlDump += `  "email" TEXT NOT NULL UNIQUE,\n`;
      sqlDump += `  "name" TEXT NOT NULL,\n`;
      sqlDump += `  "phone_number" TEXT,\n`;
      sqlDump += `  "role" TEXT NOT NULL,\n`;
      sqlDump += `  "register_number" TEXT UNIQUE,\n`;
      sqlDump += `  "department" TEXT,\n`;
      sqlDump += `  "joining_year" INTEGER,\n`;
      sqlDump += `  "passing_out_year" INTEGER,\n`;
      sqlDump += `  "current_study_year" INTEGER,\n`;
      sqlDump += `  "is_passed" BOOLEAN DEFAULT false,\n`;
      sqlDump += `  "staff_id" TEXT UNIQUE,\n`;
      sqlDump += `  "is_profile_complete" BOOLEAN DEFAULT false,\n`;
      sqlDump += `  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
      sqlDump += `);\n\n`;

      // Add data inserts
      if (users.length > 0) {
        sqlDump += `-- Data for table: users\n`;
        for (const user of users) {
          const values = [
            user.id,
            `'${user.email.replace(/'/g, "''")}'`,
            `'${user.name.replace(/'/g, "''")}'`,
            user.phoneNumber ? `'${user.phoneNumber.replace(/'/g, "''")}'` : 'NULL',
            `'${user.role.replace(/'/g, "''")}'`,
            user.registerNumber ? `'${user.registerNumber.replace(/'/g, "''")}'` : 'NULL',
            user.department ? `'${user.department.replace(/'/g, "''")}'` : 'NULL',
            user.joiningYear || 'NULL',
            user.passingOutYear || 'NULL',
            user.currentStudyYear || 'NULL',
            user.isPassed ? 'true' : 'false',
            user.staffId ? `'${user.staffId.replace(/'/g, "''")}'` : 'NULL',
            user.isProfileComplete ? 'true' : 'false',
            `'${user.createdAt.toISOString()}'`
          ];

          sqlDump += `INSERT INTO "users" ("id", "email", "name", "phone_number", "role", "register_number", "department", "joining_year", "passing_out_year", "current_study_year", "is_passed", "staff_id", "is_profile_complete", "created_at") VALUES (${values.join(', ')});\n`;
        }
      }

      sqlDump += `\n-- End of backup\n`;

      return {
        sql: sqlDump,
        recordCount: users.length,
        size: Buffer.byteLength(sqlDump, 'utf8')
      };
    } catch (error) {
      console.error('Error creating PostgreSQL backup:', error);
      throw error;
    }
  }

  /**
   * Get backup list
   */
  async getBackupList() {
    const backups = Array.from(this.backupStorage.values()).map(backup => ({
      id: backup.id,
      type: backup.type,
      timestamp: backup.timestamp,
      status: backup.status,
      size: backup.size,
      filename: `${backup.id}_${backup.type}.json`
    }));

    return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Get backup info
   */
  async getBackupInfo(backupId: string) {
    const backup = this.backupStorage.get(backupId);

    if (!backup) {
      return null;
    }

    return {
      id: backup.id,
      type: backup.type,
      timestamp: backup.timestamp,
      status: backup.status,
      size: backup.size,
      downloadable: backup.downloadable || false,
      filename: backup.filename || `${backup.id}_${backup.type}.json`
    };
  }

  /**
   * Get backup content for download
   */
  async getBackupContent(backupId: string) {
    const backup = this.backupStorage.get(backupId);

    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    if (backup.type === 'postgresql' && backup.data.postgresql.sql) {
      return {
        content: backup.data.postgresql.sql,
        filename: backup.filename || `${backupId}_postgresql.sql`,
        contentType: 'application/sql'
      };
    }

    // For MongoDB or other types, return JSON
    return {
      content: JSON.stringify(backup.data, null, 2),
      filename: backup.filename || `${backupId}_${backup.type}.json`,
      contentType: 'application/json'
    };
  }


  /**
   * Restore from backup
   */
  async restoreFromBackup(backupId: string, type?: string) {
    const backup = this.backupStorage.get(backupId);

    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    if (type && backup.type !== type && backup.type !== 'full') {
      throw new Error(`Backup type mismatch. Expected ${type}, got ${backup.type}`);
    }

    try {
      const results: any = {
        restored: [],
        errors: []
      };

      if (backup.data.mongodb && (type === 'mongodb' || type === 'full' || !type)) {
        try {
          await this.restoreMongoBackup(backup.data.mongodb);
          results.restored.push('mongodb');
        } catch (error) {
          results.errors.push(`MongoDB restore failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (backup.data.postgresql && (type === 'postgresql' || type === 'full' || !type)) {
        try {
          await this.restorePostgreSQLBackup(backup.data.postgresql);
          results.restored.push('postgresql');
        } catch (error) {
          results.errors.push(`PostgreSQL restore failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return {
        backupId,
        timestamp: new Date().toISOString(),
        ...results
      };
    } catch (error) {
      console.error('Error restoring from backup:', error);
      throw new Error(`Failed to restore from backup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Restore MongoDB backup
   */
  private async restoreMongoBackup(mongoData: any) {
    if (!mongoose.connection.db) {
      throw new Error('MongoDB not connected');
    }

    for (const [collectionName, data] of Object.entries(mongoData)) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);

        // Clear existing data
        await collection.deleteMany({});

        // Insert backup data
        if (Array.isArray(data) && data.length > 0) {
          await collection.insertMany(data as any[]);
        }
      } catch (error) {
        console.warn(`Could not restore collection ${collectionName}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  /**
   * Restore PostgreSQL backup
   */
  private async restorePostgreSQLBackup(pgData: any) {
    const db = getPostgresDb();

    try {
      if (pgData.users && Array.isArray(pgData.users)) {
        // Clear existing users
        await db.user.deleteMany();

        // Insert backup users
        for (const user of pgData.users) {
          try {
            await db.user.create({
              data: {
                email: user.email,
                name: user.name,
                registerNumber: user.registerNumber,
                staffId: user.staffId,
                role: user.role,
                department: user.department
              }
            });
          } catch (error) {
            console.warn(`Could not restore user ${user.email}:`, error instanceof Error ? error.message : String(error));
          }
        }
      }
    } catch (error) {
      console.error('Error restoring PostgreSQL data:', error);
      throw error;
    }
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string) {
    const backup = this.backupStorage.get(backupId);

    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    this.backupStorage.delete(backupId);

    return {
      deleted: true,
      backupId,
      timestamp: new Date().toISOString()
    };
  }

  // MAINTENANCE NOTICE OPERATIONS (MongoDB)

  // COUNTER OPERATIONS (MongoDB)

  async getCountersByCanteen(canteenId: string) {
    try {
      const counters = await Counter.find({ canteenId }).sort({ createdAt: -1 });
      return counters.map((counter: any) => ({
        id: counter._id.toString(),
        name: counter.name,
        code: counter.code,
        counterId: counter.counterId,
        canteenId: counter.canteenId,
        type: counter.type,
        createdAt: counter.createdAt
      }));
    } catch (error) {
      console.error('Error fetching counters by canteen:', error);
      throw error;
    }
  }

  async createCounter(data: { name: string; code: string; counterId: string; canteenId: string; type: string }) {
    try {
      const counter = new Counter({
        name: data.name,
        code: data.code.toUpperCase(),
        counterId: data.counterId,
        canteenId: data.canteenId,
        type: data.type
      });

      await counter.save();
      return {
        id: (counter as any)._id.toString(),
        name: counter.name,
        code: counter.code,
        counterId: counter.counterId,
        canteenId: counter.canteenId,
        type: counter.type,
        createdAt: counter.createdAt
      };
    } catch (error: any) {
      console.error('Error creating counter:', error);
      if (error.code === 11000) {
        throw new Error('Counter code already exists for this canteen');
      }
      throw error;
    }
  }

  async getCounterById(counterId: string) {
    try {
      const counter = await Counter.findById(counterId);
      if (!counter) {
        return null;
      }
      return {
        id: (counter as any)._id.toString(),
        name: counter.name,
        code: counter.code,
        counterId: counter.counterId,
        canteenId: counter.canteenId,
        type: counter.type,
        createdAt: counter.createdAt
      };
    } catch (error) {
      console.error('Error fetching counter by ID:', error);
      throw error;
    }
  }

  async getPaymentCounterName(paymentCounterId: string) {
    try {
      const counter = await Counter.findById(paymentCounterId);
      if (!counter) {
        return 'Unknown Counter';
      }
      return counter.name;
    } catch (error) {
      console.error('Error fetching payment counter name:', error);
      return 'Unknown Counter';
    }
  }

  async deleteCounter(counterId: string) {
    try {
      const result = await Counter.findByIdAndDelete(counterId);
      return !!result;
    } catch (error) {
      console.error('Error deleting counter:', error);
      throw error;
    }
  }

  async getPaymentStats(canteenId: string, counterId: string) {
    try {
      const orders = await Order.find({ canteenId, counterId });

      const totalAmount = orders.reduce((sum, order) => sum + order.amount, 0);
      const completedPayments = orders.filter(order => order.paymentStatus === 'completed').length;
      const pendingPayments = orders.filter(order => order.paymentStatus === 'pending').length;
      const failedPayments = orders.filter(order => order.paymentStatus === 'failed').length;

      return {
        totalAmount,
        completedPayments,
        pendingPayments,
        failedPayments
      };
    } catch (error) {
      console.error('Error fetching payment stats:', error);
      throw error;
    }
  }

  async getStoreStats(canteenId: string, counterId: string) {
    try {
      const orders = await Order.find({ canteenId, counterId });

      const totalOrders = orders.length;
      const completedOrders = orders.filter(order => order.status === 'completed').length;
      const pendingOrders = orders.filter(order => ['preparing', 'ready'].includes(order.status)).length;
      const totalRevenue = orders.reduce((sum, order) => sum + order.amount, 0);
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      return {
        totalOrders,
        completedOrders,
        pendingOrders,
        totalRevenue,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100
      };
    } catch (error) {
      console.error('Error fetching store stats:', error);
      throw error;
    }
  }

  async processPayment(orderId: string, counterId: string) {
    try {
      const order = await Order.findByIdAndUpdate(
        orderId,
        {
          paymentStatus: 'completed',
          status: 'ready',
          counterId
        },
        { new: true }
      );
      return order;
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    }
  }

  async confirmOfflinePayment(orderId: string, counterId: string) {
    try {
      console.log(`💳 Storage: Confirming offline payment for order ${orderId} with counter ${counterId}`);

      // First, let's check the current order state
      const currentOrder = await Order.findById(orderId);
      if (!currentOrder) {
        throw new Error('Order not found');
      }

      console.log(`💳 Storage: Current order state:`, {
        id: currentOrder?.id,
        orderNumber: currentOrder?.orderNumber,
        status: currentOrder?.status,
        paymentStatus: currentOrder?.paymentStatus,
        isOffline: currentOrder?.isOffline
      });

      // Parse order items to check for markable items
      let orderItems = [];
      try {
        orderItems = JSON.parse(currentOrder.items);
      } catch (error) {
        console.error('Error parsing order items:', error);
        orderItems = [];
      }

      // Check if order has markable items (using embedded isMarkable property)
      let hasMarkableItem = false;
      for (const item of orderItems) {
        // Use embedded isMarkable property (added during order creation)
        if (item.isMarkable === true) {
          hasMarkableItem = true;
          break;
        }
      }

      // Determine status based on markable items (same logic as order creation)
      // If has markable items, status should be 'pending' (needs manual marking)
      // If no markable items, status should be 'ready' (auto-ready)
      const newStatus = hasMarkableItem ? 'pending' : 'ready';

      console.log(`💳 Storage: Order has markable items: ${hasMarkableItem}, setting status to: ${newStatus}`);

      // Initialize itemStatusByCounter for auto-ready items (non-markable items)
      // Auto-ready items should be marked as 'ready' by default for their assigned counters
      const currentItemStatus = currentOrder.itemStatusByCounter
        ? (typeof currentOrder.itemStatusByCounter === 'string'
          ? JSON.parse(currentOrder.itemStatusByCounter)
          : currentOrder.itemStatusByCounter)
        : {};
      const itemStatusByCounter: { [counterId: string]: { [itemId: string]: 'pending' | 'ready' | 'completed' } } = { ...currentItemStatus };

      for (const item of orderItems) {
        // Skip markable items - they will be marked ready manually
        if (item.isMarkable === true) {
          continue;
        }

        // Auto-ready items: mark as 'ready' for their assigned counters
        // For store counter items
        if (item.storeCounterId) {
          if (!itemStatusByCounter[item.storeCounterId]) {
            itemStatusByCounter[item.storeCounterId] = {};
          }
          itemStatusByCounter[item.storeCounterId][item.id] = 'ready';
        }

        // For KOT counter items (if any auto-ready items are assigned to KOT counters)
        if (item.kotCounterId) {
          if (!itemStatusByCounter[item.kotCounterId]) {
            itemStatusByCounter[item.kotCounterId] = {};
          }
          itemStatusByCounter[item.kotCounterId][item.id] = 'ready';
        }
      }

      console.log(`🔍 confirmOfflinePayment - Initialized itemStatusByCounter for auto-ready items:`, {
        autoReadyItemsCount: orderItems.filter((item: any) => item.isMarkable !== true).length,
        itemStatusByCounterKeys: Object.keys(itemStatusByCounter),
        itemStatusByCounter: Object.keys(itemStatusByCounter).length > 0 ? itemStatusByCounter : 'none'
      });

      const order = await Order.findByIdAndUpdate(
        orderId,
        {
          paymentStatus: 'completed',
          status: newStatus, // Set status based on markable items
          paymentConfirmedBy: counterId, // Track which payment counter confirmed the payment
          counterId,
          itemStatusByCounter: Object.keys(itemStatusByCounter).length > 0 ? itemStatusByCounter : currentOrder.itemStatusByCounter // Initialize with auto-ready items 
        },
        { new: true }
      );

      console.log(`💳 Storage: Updated order state:`, {
        id: order?.id,
        orderNumber: order?.orderNumber,
        status: order?.status,
        paymentStatus: order?.paymentStatus,
        isOffline: order?.isOffline,
        hasMarkableItems: hasMarkableItem
      });

      return order;
    } catch (error) {
      console.error('Error confirming offline payment:', error);
      throw error;
    }
  }

  async rejectOfflineOrder(orderId: string, counterId: string) {
    try {
      console.log(`💳 Storage: Rejecting offline order ${orderId} with counter ${counterId}`);

      // First, let's check the current order state
      const currentOrder = await Order.findById(orderId);
      if (!currentOrder) {
        console.log(`💳 Storage: Order ${orderId} not found`);
        return null;
      }

      console.log(`💳 Storage: Current order state:`, {
        id: currentOrder.id,
        orderNumber: currentOrder.orderNumber,
        status: currentOrder.status,
        paymentStatus: currentOrder.paymentStatus,
        isOffline: currentOrder.isOffline
      });

      const updateData = {
        paymentStatus: 'rejected',
        status: 'rejected', // Change to rejected status
        rejectedBy: counterId, // Track which payment counter rejected the order
        counterId
      };

      console.log(`💳 Storage: Updating order with data:`, updateData);

      const order = await Order.findByIdAndUpdate(
        orderId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!order) {
        console.log(`💳 Storage: Failed to update order ${orderId}`);
        return null;
      }

      console.log(`💳 Storage: Updated order state:`, {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        isOffline: order.isOffline,
        rejectedBy: order.rejectedBy
      });

      return order;
    } catch (error) {
      console.error('Error rejecting offline order:', error);
      throw error;
    }
  }


  async getPaymentByRazorpayId(razorpayPaymentId: string): Promise<any | undefined> {
    // Try to find payment by razorpayTransactionId
    // Note: The field in our schema is `razorpayTransactionId`
    // We should search for that.

    // First try MongoDB
    let payment = await Payment.findOne({ razorpayTransactionId: razorpayPaymentId });

    if (payment) {
      return payment.toObject ? payment.toObject() : payment;
    }

    // Fallback: Check if it's stored in metadata (unlikely for main ID but possible)
    // Or maybe check by _id if the razorpayPaymentId was used as our ID? (Not how we do it)

    return null;
  }




  async markOrderReady(orderId: string, counterId?: string) {
    try {
      // Get the current order to access items and existing status
      const currentOrder = await Order.findById(orderId);
      if (!currentOrder) {
        throw new Error('Order not found');
      }

      // Parse order items
      const orderItems = JSON.parse(currentOrder.items);

      // Initialize itemStatusByCounter if it doesn't exist
      const currentItemStatus = currentOrder.itemStatusByCounter
        ? (typeof currentOrder.itemStatusByCounter === 'string'
          ? JSON.parse(currentOrder.itemStatusByCounter)
          : currentOrder.itemStatusByCounter)
        : {};

      // If counterId is provided, mark items for that specific counter
      // Otherwise, mark all markable items as ready (for orders without counter assignment)
      if (counterId) {
        if (!currentItemStatus[counterId]) {
          currentItemStatus[counterId] = {};
        }

        // Check if this is a KOT counter by checking if any items have this as kotCounterId
        const isKotCounter = orderItems.some((item: any) => item.kotCounterId === counterId);

        // Filter items that belong to this counter
        // For KOT counters: use kotCounterId
        // For store counters: use storeCounterId
        const counterItems = orderItems.filter((item: any) => {
          if (isKotCounter) {
            // KOT counter: check kotCounterId and isMarkable
            const belongsToKotCounter = item.kotCounterId === counterId;
            const isMarkable = item.isMarkable === true;
            return belongsToKotCounter && isMarkable;
          } else {
            // Store counter: check storeCounterId and isMarkable
            const belongsToCounter = item.storeCounterId === counterId;
            const isMarkable = item.isMarkable === true;
            return belongsToCounter && isMarkable;
          }
        });

        // Mark items belonging to this counter as ready
        counterItems.forEach((item: any) => {
          // For KOT counters, mark in the KOT counter's status
          // But also track which store counter should receive this item
          if (isKotCounter) {
            currentItemStatus[counterId][item.id] = 'ready';
            // If item has a storeCounterId, also mark it ready for the store counter
            if (item.storeCounterId) {
              if (!currentItemStatus[item.storeCounterId]) {
                currentItemStatus[item.storeCounterId] = {};
              }
              currentItemStatus[item.storeCounterId][item.id] = 'ready';
              console.log(`✅ Item ${item.name} marked ready from KOT counter ${counterId}, also marked for store counter ${item.storeCounterId}`);
            }
          } else {
            // Store counter: mark normally
            currentItemStatus[counterId][item.id] = 'ready';
          }
        });
      } else {
        // No counterId provided - mark all markable items as ready
        // This handles cases where orders don't have specific counter assignments
        const allMarkableItems = orderItems.filter((item: any) => item.isMarkable === true);

        // Group items by their storeCounterId
        const itemsByCounter: { [counterId: string]: any[] } = {};
        allMarkableItems.forEach((item: any) => {
          const itemCounterId = item.storeCounterId || 'default';
          if (!itemsByCounter[itemCounterId]) {
            itemsByCounter[itemCounterId] = [];
          }
          itemsByCounter[itemCounterId].push(item);
        });

        // Mark all markable items as ready in their respective counters
        Object.keys(itemsByCounter).forEach((itemCounterId) => {
          if (!currentItemStatus[itemCounterId]) {
            currentItemStatus[itemCounterId] = {};
          }
          itemsByCounter[itemCounterId].forEach((item: any) => {
            currentItemStatus[itemCounterId][item.id] = 'ready';
          });
        });
      }

      // Check if all markable items across all counters are ready
      // For items with KOT counters: they must be ready in their store counter (after KOT processing)
      // For items without KOT counters: they must be ready in their store counter
      const allItems = orderItems;
      let allItemsReady = true;

      for (const item of allItems) {
        // Only check markable items
        if (item.isMarkable === true) {
          // Items with KOT counters: check store counter status (KOT -> Store flow)
          // Items without KOT counters: check store counter status directly
          const itemStoreCounterId = item.storeCounterId || 'default';
          const itemStatus = currentItemStatus[itemStoreCounterId]?.[item.id];
          if (itemStatus !== 'ready') {
            allItemsReady = false;
            break;
          }
        }
      }

      // Update the order
      const updateData: any = {
        itemStatusByCounter: currentItemStatus
      };

      // If all items are ready, mark the entire order as ready
      if (allItemsReady) {
        updateData.status = 'ready';
      }

      const order = await Order.findByIdAndUpdate(
        orderId,
        updateData,
        { new: true }
      );

      if (counterId) {
        // Check if this was a KOT counter
        const isKotCounter = orderItems.some((item: any) => item.kotCounterId === counterId);

        if (isKotCounter) {
          // KOT counter: get items that were marked ready
          const kotItems = orderItems.filter((item: any) => {
            const belongsToKotCounter = item.kotCounterId === counterId;
            const isMarkable = item.isMarkable === true;
            return belongsToKotCounter && isMarkable;
          });

          // Get store counters that should receive these items
          const storeCounterIds = new Set<string>();
          kotItems.forEach((item: any) => {
            if (item.storeCounterId) {
              storeCounterIds.add(item.storeCounterId);
            }
          });

          console.log(`🍳 Marked items ready from KOT counter ${counterId} in order ${orderId}:`, {
            kotItems: kotItems.map((item: any) => item.name),
            storeCountersToNotify: Array.from(storeCounterIds),
            allItemsReady,
            newOrderStatus: order?.status
          });

          // Return store counter IDs that need to be notified
          // Convert to plain object first to ensure proper serialization
          const plainOrder: any = mongoToPlain(order);
          return { ...plainOrder, _kotStoreCounters: Array.from(storeCounterIds) };
        } else {
          // Store counter: normal flow
          const counterItems = orderItems.filter((item: any) => {
            const belongsToCounter = item.storeCounterId === counterId;
            const isMarkable = item.isMarkable === true;
            return belongsToCounter && isMarkable;
          });
          console.log(`🏪 Marked items ready for store counter ${counterId} in order ${orderId}:`, {
            counterItems: counterItems.map((item: any) => item.name),
            allItemsReady,
            newOrderStatus: order?.status
          });
        }
      } else {
        const allMarkableItems = orderItems.filter((item: any) => item.isMarkable === true);
        console.log(`🏪 Marked all markable items ready in order ${orderId}:`, {
          markableItems: allMarkableItems.map((item: any) => item.name),
          allItemsReady,
          newOrderStatus: order?.status
        });
      }

      // Convert to plain object before returning to ensure all fields are serializable
      return mongoToPlain(order);
    } catch (error) {
      console.error('Error marking order as ready:', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId: string, status: string, counterId?: string) {
    try {
      const updateData: any = { status };
      if (counterId) {
        updateData.counterId = counterId;
      }
      const order = await Order.findByIdAndUpdate(
        orderId,
        updateData,
        { new: true }
      );
      return order;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  async completeOrder(orderId: string, counterId: string) {
    try {
      const order = await Order.findByIdAndUpdate(
        orderId,
        {
          status: 'completed',
          deliveredAt: new Date(),
          counterId
        },
        { new: true }
      );
      return order;
    } catch (error) {
      console.error('Error completing order:', error);
      throw error;
    }
  }

  async markOrderOutForDelivery(orderId: string, counterId: string, deliveryPersonId: string) {
    try {
      console.log(`🚚 Storage: Marking order ${orderId} as out for delivery for counter ${counterId} with delivery person ${deliveryPersonId}`);

      // Get the current order to access items and existing status
      const currentOrder = await Order.findById(orderId);
      if (!currentOrder) {
        throw new Error('Order not found');
      }

      // Parse order items
      const orderItems = JSON.parse(currentOrder.items);

      // Initialize itemStatusByCounter if it doesn't exist
      const currentItemStatus = currentOrder.itemStatusByCounter
        ? (typeof currentOrder.itemStatusByCounter === 'string'
          ? JSON.parse(currentOrder.itemStatusByCounter)
          : currentOrder.itemStatusByCounter)
        : {};
      if (!currentItemStatus[counterId]) {
        currentItemStatus[counterId] = {};
      }

      // Filter items that belong to this counter and are already ready
      const counterItems = orderItems.filter((item: any) => {
        const belongsToCounter = item.storeCounterId === counterId;
        // Only mark items that are already ready (either markable items marked as ready, or auto-ready items)
        const itemStatus = currentItemStatus[counterId]?.[item.id];
        const isReady = itemStatus === 'ready' ||
          (item.isMarkable !== true && (currentOrder.status === 'ready' || currentOrder.status === 'preparing'));
        return belongsToCounter && isReady;
      });

      // Mark ready items belonging to this counter as out_for_delivery
      counterItems.forEach((item: any) => {
        currentItemStatus[counterId][item.id] = 'out_for_delivery';
      });

      // Use existing deliveryPersonId if already assigned, otherwise use the provided one
      const finalDeliveryPersonId = currentOrder.deliveryPersonId || deliveryPersonId;

      // Check if all ready items across all counters are marked as out_for_delivery or completed
      // We only check items that are ready (not pending/preparing)
      const allItems = orderItems;
      let allReadyItemsOutForDelivery = true;

      for (const item of allItems) {
        const itemCounterId = item.storeCounterId || 'default';
        const itemStatus = currentItemStatus[itemCounterId]?.[item.id];

        // Determine if item is ready
        const isReady = itemStatus === 'ready' ||
          (item.isMarkable !== true && (currentOrder.status === 'ready' || currentOrder.status === 'preparing'));

        // Only check items that are ready
        if (isReady) {
          const currentStatus = currentItemStatus[itemCounterId]?.[item.id];
          // Item must be out_for_delivery or completed to be considered ready for delivery
          if (currentStatus !== 'out_for_delivery' && currentStatus !== 'completed') {
            allReadyItemsOutForDelivery = false;
            break;
          }
        }
      }

      // Update the order
      const updateData: any = {
        itemStatusByCounter: currentItemStatus,
        deliveryPersonId: finalDeliveryPersonId
      };

      // If all ready items are out for delivery, mark the entire order as out_for_delivery
      if (allReadyItemsOutForDelivery) {
        updateData.status = 'out_for_delivery';
      }

      const order = await Order.findByIdAndUpdate(
        orderId,
        updateData,
        { new: true }
      );

      console.log(`🚚 Storage: Items marked as out for delivery for counter ${counterId} in order ${orderId}:`, {
        counterItems: counterItems.map((item: any) => item.name),
        allReadyItemsOutForDelivery,
        newOrderStatus: order?.status,
        deliveryPersonId: finalDeliveryPersonId
      });

      return order;
    } catch (error) {
      console.error('Error marking order as out for delivery:', error);
      throw error;
    }
  }

  async deliverOrder(orderId: string, counterId: string) {
    try {
      console.log(`🚚 Storage: Delivering order ${orderId} with counterId ${counterId}`);

      // Get the current order to access items and existing status
      const currentOrder = await Order.findById(orderId);
      if (!currentOrder) {
        throw new Error('Order not found');
      }

      // Parse order items
      const orderItems = JSON.parse(currentOrder.items);

      // Get menu items to find which items belong to this counter
      const menuItems = await MenuItem.find({ canteenId: currentOrder.canteenId });

      // Filter items that belong to this counter
      const counterItems = orderItems.filter((item: any) => {
        const menuItem = menuItems.find((mi: any) => mi.id === item.id || mi._id === item.id);
        return menuItem && menuItem.storeCounterId === counterId;
      });

      // Initialize itemStatusByCounter if it doesn't exist
      const currentItemStatus = currentOrder.itemStatusByCounter
        ? (typeof currentOrder.itemStatusByCounter === 'string'
          ? JSON.parse(currentOrder.itemStatusByCounter)
          : currentOrder.itemStatusByCounter)
        : {};
      if (!currentItemStatus[counterId]) {
        currentItemStatus[counterId] = {};
      }

      // Mark items belonging to this counter as completed
      counterItems.forEach((item: any) => {
        currentItemStatus[counterId][item.id] = 'completed';
      });

      // Check if all items across all counters are completed
      const allItems = orderItems;
      let allItemsCompleted = true;

      for (const item of allItems) {
        const menuItem = menuItems.find((mi: any) => mi.id === item.id || mi._id === item.id);
        if (menuItem && menuItem.storeCounterId) {
          const itemStatus = currentItemStatus[menuItem.storeCounterId]?.[item.id];
          if (itemStatus !== 'completed') {
            allItemsCompleted = false;
            break;
          }
        }
      }

      // Update the order
      const updateData: any = {
        itemStatusByCounter: currentItemStatus
      };

      // If all items are completed, mark the entire order as delivered
      if (allItemsCompleted) {
        updateData.status = 'delivered';
        updateData.deliveredAt = new Date();

        // Increment totalOrderDelivered for the delivery person if assigned
        if (currentOrder.deliveryPersonId) {
          try {
            const { db } = await import('./db');
            const database = db();

            // Find delivery person by deliveryPersonId (not the database id)
            const deliveryPerson = await database.deliveryPerson.findUnique({
              where: { deliveryPersonId: currentOrder.deliveryPersonId }
            });

            if (deliveryPerson) {
              await database.deliveryPerson.update({
                where: { id: deliveryPerson.id },
                data: {
                  totalOrderDelivered: {
                    increment: 1
                  }
                }
              });
              console.log(`✅ Incremented delivery count for ${deliveryPerson.deliveryPersonId}: ${deliveryPerson.totalOrderDelivered + 1}`);
            }
          } catch (error) {
            console.error('❌ Error updating delivery person stats:', error);
            // Don't fail the order delivery if stats update fails
          }
        }
      }

      const order = await Order.findByIdAndUpdate(
        orderId,
        updateData,
        { new: true }
      );

      console.log(`🚚 Storage: Items delivered for counter ${counterId} in order ${orderId}:`, {
        counterItems: counterItems.map((item: any) => item.name),
        allItemsCompleted,
        newOrderStatus: order?.status
      });

      return order;
    } catch (error) {
      console.error('Error delivering order:', error);
      throw error;
    }
  }

  async deliverOrderByDeliveryPerson(orderId: string, deliveryPersonId: string) {
    try {
      console.log(`🚚 Storage: Delivering order ${orderId} by delivery person ${deliveryPersonId}`);

      // Get the current order
      const currentOrder = await Order.findById(orderId);
      if (!currentOrder) {
        throw new Error('Order not found');
      }

      // Verify the delivery person matches
      if (currentOrder.deliveryPersonId !== deliveryPersonId) {
        console.warn(`⚠️ Delivery person mismatch: order has ${currentOrder.deliveryPersonId}, but ${deliveryPersonId} is trying to deliver`);
        // Still allow it, but log the warning
      }

      // Mark the entire order as delivered
      const updateData: any = {
        status: 'delivered',
        deliveredAt: new Date(),
        barcodeUsed: true
      };

      // Update all item statuses to completed if itemStatusByCounter exists
      if (currentOrder.itemStatusByCounter) {
        const itemStatusByCounter = currentOrder.itemStatusByCounter;
        const orderItems = JSON.parse(currentOrder.items);

        // Mark all items as completed for all counters
        for (const item of orderItems) {
          // Find which counter this item belongs to
          const menuItems = await MenuItem.find({ canteenId: currentOrder.canteenId });
          const menuItem = menuItems.find((mi: any) => mi.id === item.id || mi._id === item.id);

          if (menuItem && menuItem.storeCounterId) {
            const counterId = menuItem.storeCounterId;
            if (!itemStatusByCounter[counterId]) {
              itemStatusByCounter[counterId] = {};
            }
            itemStatusByCounter[counterId][item.id] = 'completed';
          }
        }

        updateData.itemStatusByCounter = itemStatusByCounter;
      }

      // Update the order
      const order = await Order.findByIdAndUpdate(
        orderId,
        updateData,
        { new: true }
      );

      // Increment totalOrderDelivered for the delivery person
      if (deliveryPersonId) {
        try {
          const { db } = await import('./db');
          const database = db();

          // Find delivery person by deliveryPersonId (not the database id)
          const deliveryPerson = await database.deliveryPerson.findUnique({
            where: { deliveryPersonId: deliveryPersonId }
          });

          if (deliveryPerson) {
            await database.deliveryPerson.update({
              where: { id: deliveryPerson.id },
              data: {
                totalOrderDelivered: {
                  increment: 1
                },
                isAvailable: true // Mark as available again after delivery
              }
            });
            console.log(`✅ Incremented delivery count for ${deliveryPerson.deliveryPersonId}: ${deliveryPerson.totalOrderDelivered + 1}`);
          } else {
            console.warn(`⚠️ Delivery person not found: ${deliveryPersonId}`);
          }
        } catch (error) {
          console.error('❌ Error updating delivery person stats:', error);
          // Don't fail the order delivery if stats update fails
        }
      }

      console.log(`🚚 Storage: Order ${orderId} delivered by delivery person ${deliveryPersonId}`);

      return order ? mongoToPlain(order) : undefined;
    } catch (error) {
      console.error('Error delivering order by delivery person:', error);
      throw error;
    }
  }


}

// Create storage instance
// Note: MongoDB connection is handled in startup-check.ts to avoid duplicates
const storage = new HybridStorage();

export { storage };