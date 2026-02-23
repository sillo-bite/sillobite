import type { Express } from "express";
import { createServer, type Server } from "http";
import mongoose from "mongoose";
import { storage } from "./storage-hybrid";
import { MenuItem, Category, MediaBanner, CodingChallenge, CanteenCharge } from "./models/mongodb-models";
import {
  insertUserSchema,
  insertCategorySchema,
  insertMenuItemSchema,
  insertOrderSchema,
  insertNotificationSchema,
  insertLoginIssueSchema,
  insertPaymentSchema,
  insertComplaintSchema,
  type Coupon,
  type InsertCoupon,
  UserRole
} from "@shared/schema";
import { generateOrderNumber } from "@shared/utils";
import {
  RAZORPAY_CONFIG,
  razorpayInstance,
  createRazorpayOrder,
  verifyWebhookSignature,
  verifyPaymentSignature,
  getPaymentDetails,
  getOrderDetails,
  createRazorpayQR,
  fetchRazorpayQR,
  fetchAllRazorpayQRPayments,
  closeRazorpayQR,
  extractUpiLinkFromQR,
  PAYMENT_STATUS,
  RAZORPAY_RESPONSE_CODES,
} from "@shared/razorpay";
import { healthCheckHandler } from "./health-check";
import { SimpleSchemaValidator } from "./migrations/simple-schema-check";
import { stockService } from "./stock-service";
import { orderService } from "./services/order-service";
import { cloudinaryService } from "./services/cloudinaryService";
import { webPushService } from "./services/webPushService.js";
import { CheckoutSessionService, checkDuplicatePaymentMiddleware } from "./checkout-session-service";
import webPushRoutes from "./routes/webPush.js";
import systemSettingsRoutes from "./routes/systemSettings.js";
import databaseManagementRoutes from "./routes/database-management.js";
import googleAuthRoutes from "./routes/googleAuth.js";
import authRoutes from "./routes/auth.js";
import sitemapRoutes from "./routes/sitemap.js";
import restaurantManagementRoutes from "./routes/restaurantManagement.js";
import printAgentRoutes from "./routes/printAgent.js";
import payoutRoutes from "./routes/payoutRoutes.js";
import biddingRoutes from "./routes/bidding.js";
import canteenAnalyticsRoutes from "./routes/canteenAnalytics.js";
import { mediaService } from "./services/mediaService.js";
import multer from "multer";
import axios from "axios";
import { getWebSocketManager } from "./websocket";
import { PaymentSessionService } from "./payment-session-service";
import { mongoToPlain } from "./storage-hybrid";

const razorpay = razorpayInstance;
// Global server start time for development update detection
const SERVER_START_TIME = Date.now();
// Performance optimization: Cache payment status API failures to avoid repeated slow calls
const paymentStatusCache = new Map<string, {
  lastAttempt: number;
  consecutiveFailures: number;
  shouldSkipApi: boolean;
}>();
const API_RETRY_INTERVAL = 30000; // 30 seconds before retrying failed API calls
const MAX_CONSECUTIVE_FAILURES = 3; // Skip API after 3 consecutive failures

// Cleanup expired checkout sessions every 5 minutes
setInterval(async () => {
  try {
    await CheckoutSessionService.cleanupExpiredSessions();
  } catch (error) {
    console.error('Error cleaning up expired checkout sessions:', error);
  }
}, 5 * 60 * 1000); // 5 minutes

// Configure multer for file uploads - menu item images
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024, // 100KB limit (will be compressed to 20KB)
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Configure multer for media banner uploads - larger files
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for media banners
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {

  // Handle Chrome DevTools well-known endpoint (prevents CSP errors in development)
  app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Health check endpoint with comprehensive database status
  app.get("/api/health", healthCheckHandler);

  // Redis health check endpoint
  app.get("/api/health/redis", async (req, res) => {
    const { redisHealthCheck } = await import('./routes/health');
    await redisHealthCheck(req, res);
  });

  // Simple health check endpoint for quick status
  app.get("/api/status", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Server info endpoint for development update detection
  app.get("/api/server-info", (req, res) => {
    res.json({
      startTime: SERVER_START_TIME,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // SSE removed - using WebSocket and trigger-based updates instead

  // Mount Canteen Analytics Routes
  app.use("/api/canteen-analytics", canteenAnalyticsRoutes);

  // Mount System Settings Routes
  app.use("/api/system-settings", systemSettingsRoutes);

  // Database schema health check endpoint
  app.get("/api/schema-status", async (req, res) => {
    try {
      const validator = new SimpleSchemaValidator();
      const status = await validator.getSchemaStatus();
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        schema: status
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Schema status check failed"
      });
    }
  });

  // MongoDB transaction diagnostics endpoint
  app.get("/api/mongodb-diagnostics", async (req, res) => {
    try {
      const mongoose = require('mongoose');

      // Get MongoDB version and configuration
      const admin = mongoose.connection.db?.admin();
      let mongoInfo: {
        connected: boolean;
        version: string;
        serverStatus: any;
      } = {
        connected: mongoose.connection.readyState === 1,
        version: 'unknown',
        serverStatus: 'unknown'
      };

      if (admin) {
        try {
          const buildInfo = await admin.buildInfo();
          mongoInfo.version = buildInfo.version;

          const serverStatus = await admin.serverStatus();
          mongoInfo.serverStatus = {
            host: serverStatus.host,
            version: serverStatus.version,
            process: serverStatus.process,
            repl: serverStatus.repl || null
          };
        } catch (error) {
          mongoInfo.serverStatus = `Error: ${error instanceof Error ? error.message : 'Unknown'}`;
        }
      }

      // Test transaction support using the stockService
      let transactionTest: {
        supported: boolean;
        error: string | null;
        testPerformed: boolean;
      } = {
        supported: false,
        error: null,
        testPerformed: false
      };

      try {
        // Reset the cached value to force a fresh test
        const stockServiceModule = require('./stock-service');
        if (stockServiceModule.stockService) {
          // Access private method through a test call
          transactionTest.testPerformed = true;
          // This will trigger the detectTransactionSupport method
          await stockServiceModule.stockService.validateAndPrepareStockUpdates([]);
        }
      } catch (error) {
        transactionTest.error = error instanceof Error ? error.message : 'Unknown error';
      }

      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        mongodb: mongoInfo,
        transactionSupport: transactionTest,
        recommendation: mongoInfo.version.startsWith('4.4') ?
          'MongoDB 4.4 detected - using non-transactional mode for compatibility' :
          'Version compatible with transactions if replica set is configured'
      });
    } catch (error) {
      res.status(500).json({
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "MongoDB diagnostics failed"
      });
    }
  });

  // WebSocket connection status endpoint
  app.get("/api/websocket/status", (req, res) => {
    try {
      const wsManager = getWebSocketManager();
      if (wsManager) {
        const stats = wsManager.getStats();
        res.json({
          status: 'active',
          ...stats,
          timestamp: new Date().toISOString()
        });
      } else {
        res.json({
          status: 'inactive',
          message: 'WebSocket server not initialized',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Failed to get WebSocket status',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // User management endpoints
  app.get("/api/users", async (req, res) => {
    try {
      console.log("📋 GET /api/users - Fetching all users");
      const users = await storage.getAllUsers();
      console.log(`✅ Successfully fetched ${users.length} users`);
      res.json(users);
    } catch (error) {
      console.error("❌ Error fetching users:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Paginated users endpoint with filtering
  app.get("/api/users/paginated", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const filters = {
        search: req.query.search as string,
        role: req.query.role as string,
        college: req.query.college as string,
        department: req.query.department as string,
        year: req.query.year as string
      };

      console.log(`📋 GET /api/users/paginated - Page: ${page}, Limit: ${limit}`, filters);
      const result = await storage.getUsersPaginated(page, limit, filters);
      console.log(`✅ Successfully fetched paginated users - Total: ${result.totalCount}, Items: ${result.users.length}`);
      res.json(result);
    } catch (error) {
      console.error("❌ Error fetching paginated users:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      console.log(`📋 GET /api/users/${userId} - Fetching user`);
      const user = await storage.getUser(userId);
      if (!user) {
        console.log(`❌ User ${userId} not found`);
        return res.status(404).json({ message: "User not found" });
      }
      console.log(`✅ User ${userId} found: ${user.name} (${user.email})`);
      res.json(user);
    } catch (error) {
      console.error(`❌ Error fetching user ${req.params.id}:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      console.log("👤 POST /api/users - Creating new user", { email: req.body.email, role: req.body.role });
      const validatedData = insertUserSchema.parse(req.body);

      // Check for duplicate email first
      const existingEmailUser = await storage.getUserByEmail(validatedData.email);
      if (existingEmailUser) {
        console.log(`ℹ️ Email ${validatedData.email} is already registered, returning existing user`);
        return res.status(200).json(existingEmailUser);
      }

      // Prevent creating multiple super admins
      if (validatedData.role === UserRole.SUPER_ADMIN) {
        const existingSuperAdmin = await storage.getUserByRole(UserRole.SUPER_ADMIN);
        if (existingSuperAdmin) {
          console.log(`❌ Cannot create super admin - one already exists`);
          return res.status(403).json({
            message: "Only one super admin is allowed in the system. A super admin already exists."
          });
        }
      }

      // Check for duplicate register number if student, employee, contractor, visitor, or guest (case-insensitive)
      if ((validatedData.role === UserRole.STUDENT || validatedData.role === UserRole.EMPLOYEE || validatedData.role === UserRole.CONTRACTOR || validatedData.role === UserRole.VISITOR || validatedData.role === UserRole.GUEST) && validatedData.registerNumber) {
        const normalizedRegisterNumber = validatedData.registerNumber.toUpperCase();
        const existingRegisterUser = await storage.getUserByRegisterNumber(normalizedRegisterNumber);
        if (existingRegisterUser) {
          console.log(`❌ Register number ${normalizedRegisterNumber} is already registered`);
          return res.status(409).json({ message: "Register number is already registered" });
        }
      }

      // Check for duplicate staff ID if staff (case-insensitive)
      if (validatedData.role === UserRole.STAFF && validatedData.staffId) {
        const normalizedStaffId = validatedData.staffId.toUpperCase();
        const existingStaffUser = await storage.getUserByStaffId(normalizedStaffId);
        if (existingStaffUser) {
          console.log(`❌ Staff ID ${normalizedStaffId} is already registered`);
          return res.status(409).json({ message: "Staff ID is already registered" });
        }
      }

      // Auto-set initial location based on college or organization
      if (validatedData.college && !(validatedData as any).organizationId) {
        // User registered with college
        (validatedData as any).selectedLocationType = 'college';
        (validatedData as any).selectedLocationId = validatedData.college;
        console.log(`📍 Auto-setting location to college: ${validatedData.college}`);
      } else if ((validatedData as any).organizationId) {
        // User registered via organization QR
        (validatedData as any).selectedLocationType = 'organization';
        (validatedData as any).selectedLocationId = (validatedData as any).organizationId;
        console.log(`📍 Auto-setting location to organization: ${(validatedData as any).organizationId}`);
      }

      const user = await storage.createUser(validatedData);
      console.log(`✅ User created successfully - ID: ${user.id}, Name: ${user.name}, Email: ${user.email}, Role: ${user.role}`);
      res.status(201).json(user);
    } catch (error) {
      console.error("❌ Error creating user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/by-email/:email", async (req, res) => {
    try {
      const email = req.params.email;
      console.log(`📋 GET /api/users/by-email/${email} - Looking up user by email`);
      const user = await storage.getUserByEmail(email);
      if (!user) {
        console.log(`❌ User with email ${email} not found`);
        return res.status(404).json({ message: "User not found" });
      }
      console.log(`✅ User found by email: ${user.name} (ID: ${user.id})`);
      res.json(user);
    } catch (error) {
      console.error(`❌ Error fetching user by email ${req.params.email}:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/by-register/:registerNumber", async (req, res) => {
    try {
      // Normalize register number for case-insensitive lookup
      const normalizedRegisterNumber = req.params.registerNumber.toUpperCase();
      console.log(`📋 GET /api/users/by-register/${normalizedRegisterNumber} - Looking up user by register number`);
      const user = await storage.getUserByRegisterNumber(normalizedRegisterNumber);
      if (!user) {
        console.log(`❌ User with register number ${normalizedRegisterNumber} not found`);
        return res.status(404).json({ message: "User not found" });
      }
      console.log(`✅ User found by register number: ${user.name} (ID: ${user.id})`);
      res.json(user);
    } catch (error) {
      console.error(`❌ Error fetching user by register number ${req.params.registerNumber}:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/by-staff/:staffId", async (req, res) => {
    try {
      // Normalize staff ID for case-insensitive lookup
      const normalizedStaffId = req.params.staffId.toUpperCase();
      console.log(`📋 GET /api/users/by-staff/${normalizedStaffId} - Looking up user by staff ID`);
      const user = await storage.getUserByStaffId(normalizedStaffId);
      if (!user) {
        console.log(`❌ User with staff ID ${normalizedStaffId} not found`);
        return res.status(404).json({ message: "User not found" });
      }
      console.log(`✅ User found by staff ID: ${user.name} (ID: ${user.id})`);
      res.json(user);
    } catch (error) {
      console.error(`❌ Error fetching user by staff ID ${req.params.staffId}:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { email } = req.body;

      console.log(`🔄 PATCH /api/users/${userId} - Updating user email to: ${email}`);

      if (!email) {
        console.log(`❌ Email is required for user ${userId}`);
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if email is already taken by another user
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        console.log(`❌ Email ${email} is already in use by user ${existingUser.id}`);
        return res.status(409).json({ message: "Email is already in use by another account" });
      }

      const updatedUser = await storage.updateUserEmail(userId, email);
      if (!updatedUser) {
        console.log(`❌ User ${userId} not found for email update`);
        return res.status(404).json({ message: "User not found" });
      }

      console.log(`✅ User ${userId} email updated successfully to: ${email}`);
      res.json(updatedUser);
    } catch (error) {
      console.error(`❌ Error updating user email for user ${req.params.id}:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      console.log(`🔄 Updating user ${userId} with data:`, JSON.stringify(req.body, null, 2));

      // Check if user exists first
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        console.log(`❌ User ${userId} not found for update`);
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent changing super admin role if it's the only super admin
      if ((existingUser.role as any) === UserRole.SUPER_ADMIN && req.body.role && (req.body.role as any) !== UserRole.SUPER_ADMIN) {
        const existingSuperAdmin = await storage.getUserByRole(UserRole.SUPER_ADMIN);
        if (existingSuperAdmin && existingSuperAdmin.id === userId) {
          console.log(`🚫 Cannot change super admin role: ${existingUser.name} is the only super admin`);
          return res.status(403).json({
            message: "Cannot change super admin role. There must always be at least one super admin in the system."
          });
        }
      }

      // Auto-set initial location based on college or organization (if not already set)
      if (!existingUser.selectedLocationType && !existingUser.selectedLocationId) {
        if (req.body.college && !req.body.organizationId) {
          // User registered with college
          req.body.selectedLocationType = 'college';
          req.body.selectedLocationId = req.body.college;
          console.log(`📍 Auto-setting location to college: ${req.body.college}`);
        } else if (req.body.organizationId) {
          // User registered via organization QR
          req.body.selectedLocationType = 'organization';
          req.body.selectedLocationId = req.body.organizationId;
          console.log(`📍 Auto-setting location to organization: ${req.body.organizationId}`);
        }
      }

      const user = await storage.updateUser(userId, req.body);
      console.log(`✅ User ${userId} updated successfully:`, JSON.stringify(user, null, 2));

      res.json(user);
    } catch (error: any) {
      console.error("❌ Error updating user:", error);
      res.status(500).json({ message: "Internal server error", error: error?.message || String(error) });
    }
  });

  // Get locations by type (college, organization, restaurant)
  app.get("/api/locations/:type", async (req, res) => {
    try {
      const type = req.params.type as 'college' | 'organization' | 'restaurant';
      console.log(`📍 GET /api/locations/${type} - Fetching locations`);

      // Fetch system settings to get the lists
      const SystemSettingsSchema = new mongoose.Schema({}, { strict: false });
      const SystemSettingsModel = mongoose.models.SystemSettings || mongoose.model('SystemSettings', SystemSettingsSchema);
      const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 }).lean().exec() as any;

      let locations: any[] = [];

      if (type === 'college') {
        locations = settings?.colleges?.list || [];
      } else if (type === 'organization') {
        locations = settings?.organizations?.list || [];
      } else if (type === 'restaurant') {
        locations = settings?.restaurants?.list || [];
      } else {
        return res.status(400).json({ message: "Invalid location type. Must be 'college', 'organization', or 'restaurant'" });
      }

      console.log(`✅ Found ${locations.length} ${type}s`);
      res.json({ locations });
    } catch (error) {
      console.error(`❌ Error fetching locations:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Save user's selected location
  app.put("/api/users/:id/location", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { locationType, locationId } = req.body;

      console.log(`📍 PUT /api/users/${userId}/location - Saving location:`, { locationType, locationId });

      if (!locationType || !locationId) {
        return res.status(400).json({ message: "locationType and locationId are required" });
      }

      if (!['college', 'organization', 'restaurant'].includes(locationType)) {
        return res.status(400).json({ message: "Invalid locationType. Must be 'college', 'organization', or 'restaurant'" });
      }

      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update user with selected location
      const updateData: any = {
        selectedLocationType: locationType,
        selectedLocationId: locationId
      };

      const updatedUser = await storage.updateUser(userId, updateData);
      console.log(`✅ User ${userId} location updated successfully`);
      res.json(updatedUser);
    } catch (error) {
      console.error(`❌ Error updating user location:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Apply Canteen QR Context to User (Location)
  app.post("/api/users/:id/apply-canteen-qr-context", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { qrId } = req.body;

      console.log(`📱 POST /api/users/${userId}/apply-canteen-qr-context - QR ID: ${qrId}`);

      if (!qrId) {
        return res.status(400).json({ message: "qrId is required" });
      }

      // 1. Find the QR Code in CanteenQRCode model
      const { CanteenQRCode, CanteenEntity } = await import('./models/mongodb-models');
      const targetQrCode = await CanteenQRCode.findOne({ qrId, isActive: true });

      if (!targetQrCode) {
        console.log(`❌ Canteen QR Code ${qrId} not found or inactive`);
        return res.status(404).json({ message: "Invalid or inactive QR Code" });
      }

      const canteenId = targetQrCode.canteenId;
      const locationType = targetQrCode.locationType;
      const locationId = targetQrCode.locationId;

      console.log(`✅ Found QR belonging to Canteen: ${canteenId}, Location: ${locationType} (${locationId})`);

      // Verify canteen exists
      const canteen = await CanteenEntity.findOne({ id: canteenId, isActive: true });
      if (!canteen) {
        return res.status(404).json({ message: "Associated canteen not found or inactive" });
      }

      // 2. Update User Location
      await storage.updateUser(userId, {
        selectedLocationType: locationType,
        selectedLocationId: locationId
      });
      console.log(`📍 User ${userId} location updated to ${locationType}: ${locationId}`);

      // We don't add full addresses automatically here since location QRs are just for global context,
      // but we could if we wanted to store address data on the QR model.

      res.json({
        message: "Canteen QR Context applied successfully",
        canteenId: canteenId,
        locationType: locationType,
        locationId: locationId
      });

    } catch (error) {
      console.error(`❌ Error applying canteen QR context:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Apply QR Context to User (Location + Address)
  app.post("/api/users/:id/apply-qr-context", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { qrId } = req.body;

      console.log(`📱 POST /api/users/${userId}/apply-qr-context - QR ID: ${qrId}`);

      if (!qrId) {
        return res.status(400).json({ message: "qrId is required" });
      }

      // 1. Find the QR Code in SystemSettings
      const SystemSettingsSchema = new mongoose.Schema({}, { strict: false });
      const SystemSettingsModel = mongoose.models.SystemSettings || mongoose.model('SystemSettings', SystemSettingsSchema);
      const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 }).lean().exec() as any;

      let targetCollege: any = null;
      let targetQrCode: any = null;

      // Search in colleges list
      if (settings?.colleges?.list) {
        for (const college of settings.colleges.list) {
          if (college.qrCodes) {
            const foundQr = college.qrCodes.find((qr: any) => qr.qrId === qrId);
            if (foundQr) {
              targetCollege = college;
              targetQrCode = foundQr;
              break;
            }
          }
        }
      }

      if (!targetCollege || !targetQrCode) {
        console.log(`❌ QR Code ${qrId} not found in any college`);
        return res.status(404).json({ message: "Invalid QR Code" });
      }

      const collegeId = targetCollege.id;
      const addressDetails = targetQrCode.fullAddress;

      console.log(`✅ Found QR belonging to College: ${targetCollege.name} (${collegeId})`);

      // 2. Update User Location
      await storage.updateUser(userId, {
        selectedLocationType: 'college',
        selectedLocationId: collegeId
      });
      console.log(`📍 User ${userId} location updated to College: ${collegeId}`);

      // 3. Add Address (De-duplication Logic)
      if (addressDetails && addressDetails.addressLine1) {
        // Fetch user details for the address
        const user = await storage.getUser(userId);
        if (user) {
          // Normalize address for comparison
          const normalize = (str: string) => str?.toLowerCase().trim().replace(/\s+/g, ' ') || '';

          const newAddressLine1 = normalize(addressDetails.addressLine1);
          const newPincode = normalize(addressDetails.pincode);

          // Get user's existing addresses
          const userAddresses = await storage.getUserAddresses(userId);

          let duplicateExists = false;
          for (const addr of userAddresses) {
            if (normalize(addr.addressLine1) === newAddressLine1 &&
              normalize(addr.pincode) === newPincode) {
              duplicateExists = true;
              break;
            }
          }

          if (!duplicateExists) {
            await storage.createUserAddress({
              userId: userId,
              label: addressDetails.label || 'College Address',
              addressLine1: addressDetails.addressLine1,
              addressLine2: addressDetails.addressLine2,
              city: addressDetails.city,
              state: addressDetails.state,
              pincode: addressDetails.pincode,
              landmark: addressDetails.landmark,
              fullName: user.name, // Use user's name
              phoneNumber: user.phoneNumber || '0000000000', // Use user's phone or dummy fallback if missing
              isDefault: false
            });
            console.log(`🏠 added new address for user ${userId}`);
          } else {
            console.log(`ℹ️ Address already exists for user ${userId}, skipping addition`);
          }
        }
      }

      res.json({
        success: true,
        message: "Context applied successfully",
        collegeId: collegeId,
        collegeName: targetCollege.name
      });

    } catch (error) {
      console.error(`❌ Error applying QR context:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      console.log(`🗑️ Attempting to delete user ${userId}`);

      // Check if user exists first
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        console.log(`❌ User ${userId} not found for deletion`);
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deletion of super admin
      if ((existingUser.role as any) === UserRole.SUPER_ADMIN) {
        console.log(`🚫 Cannot delete super admin: ${existingUser.name} (${existingUser.email})`);
        return res.status(403).json({
          message: "Super admin cannot be deleted. There must always be at least one super admin in the system."
        });
      }

      console.log(`📋 Deleting user: ${existingUser.name} (${existingUser.email})`);
      await storage.deleteUser(userId);
      console.log(`✅ User ${userId} deleted successfully from database`);

      res.json({ message: "User deleted successfully" });
    } catch (error: any) {
      console.error("❌ Error deleting user:", error);
      res.status(500).json({ message: "Internal server error", error: error?.message || String(error) });
    }
  });

  app.delete("/api/users/all", async (req, res) => {
    try {
      console.log("🗑️ DELETE /api/users/all - Deleting all users");
      await storage.deleteAllUsers();
      console.log("✅ All users deleted successfully");
      res.json({ message: "All users deleted successfully" });
    } catch (error) {
      console.error("❌ Error deleting all users:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Session validation endpoint to check if user still exists in database
  app.get("/api/users/:id/validate", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      console.log(`🔍 GET /api/users/${userId}/validate - Validating user session`);
      const user = await storage.getUser(userId) as any;

      if (!user) {
        // Session validation failed: User no longer exists
        console.log(`❌ User ${userId} validation failed - user not found`);
        return res.status(404).json({ message: "User not found", userExists: false });
      }

      console.log(`✅ User ${userId} validation successful - user exists: ${user.name}`);

      // Normalize role to ensure consistency
      const userRole = user.role ? String(user.role).toLowerCase() : UserRole.GUEST;

      // User exists, return basic info for session validation
      const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: userRole,
        phoneNumber: user.phoneNumber,
        registerNumber: user.registerNumber,
        department: user.department,
        currentStudyYear: user.currentStudyYear,
        isPassed: user.isPassed,
        staffId: user.staffId,
        // Include location data for context persistence
        selectedLocationType: user.selectedLocationType,
        selectedLocationId: user.selectedLocationId,
        college: user.college,
        collegeId: user.collegeId,
        collegeName: user.collegeName,
        organization: user.organization,
        organizationId: user.organizationId,
        organizationName: user.organizationName,
        // Include restaurant context if present
        restaurantId: user.restaurantId,
        restaurantName: user.restaurantName,
        tableNumber: user.tableNumber
      } as any; // Using any to allow adding dynamic properties like canteen

      // For canteen owners, include canteen data to avoid additional API call
      if (userRole === UserRole.CANTEEN_OWNER || userRole === 'canteen-owner') {
        try {
          // Import SystemSettings model
          const { default: mongoose } = await import('mongoose');
          const SystemSettingsSchema = new mongoose.Schema({
            canteens: {
              list: [{
                id: { type: String, required: true },
                name: { type: String, required: true },
                canteenOwnerEmail: { type: String, required: true },
                // Add other canteen fields as needed
              }]
            }
          }, { timestamps: true });

          const SystemSettingsModel = mongoose.models.SystemSettings || mongoose.model('SystemSettings', SystemSettingsSchema);

          const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

          if ((settings as any) && (settings as any).canteens?.list) {
            const canteen = (settings as any).canteens.list.find((c: any) => c.canteenOwnerEmail === user.email);
            if (canteen) {
              userData.canteen = canteen;
            }
          }
        } catch (canteenError) {
          console.warn('Failed to fetch canteen data during user validation:', canteenError);
          // Continue without canteen data - will be fetched separately if needed
        }
      }

      res.json({
        userExists: true,
        user: userData
      });
    } catch (error) {
      console.error("Error validating user session:", error);
      res.status(500).json({ message: "Internal server error", userExists: false });
    }
  });

  // User Reviews Endpoint - Returns reviews for a specific user by email
  // Placed early to ensure it's registered before any parameterized routes
  app.get("/api/user-reviews", async (req, res) => {
    // Explicitly set JSON content type FIRST - before any other processing
    res.setHeader('Content-Type', 'application/json');

    try {
      const { userEmail } = req.query;

      if (!userEmail) {
        return res.status(400).json({ message: "userEmail query parameter is required" });
      }

      // TODO: Implement review storage and retrieval when review system is fully implemented
      // For now, return empty array to prevent errors
      // This endpoint should query reviews from MongoDB where userEmail matches
      res.json([]);
    } catch (error) {
      console.error("Error fetching user reviews:", error);
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // User details endpoints for admin panel
  app.get("/api/users/:id/orders", async (req, res) => {
    try {
      const orders = await storage.getUserOrders(parseInt(req.params.id));
      res.json(orders);
    } catch (error) {
      console.error("Error fetching user orders:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/:id/payments", async (req, res) => {
    try {
      const payments = await storage.getUserPayments(parseInt(req.params.id));
      res.json(payments);
    } catch (error) {
      console.error("Error fetching user payments:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/:id/complaints", async (req, res) => {
    try {
      const complaints = await storage.getComplaintsByUser(parseInt(req.params.id));
      res.json(complaints);
    } catch (error) {
      console.error("Error fetching user complaints:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/users/:id/block", async (req, res) => {
    try {
      const user = await storage.blockUser(parseInt(req.params.id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "User blocked successfully", user });
    } catch (error) {
      console.error("Error blocking user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/users/:id/unblock", async (req, res) => {
    try {
      const user = await storage.unblockUser(parseInt(req.params.id));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "User unblocked successfully", user });
    } catch (error) {
      console.error("Error unblocking user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin dashboard stats endpoint - optimized for overview page
  app.get("/api/admin/dashboard-stats", async (req, res) => {
    try {
      // Fetching dashboard stats

      // Get only essential data for dashboard
      const orders = await storage.getOrders();
      const users = await storage.getAllUsers();

      // Calculate only what's needed for dashboard
      const stats = {
        totalRevenue: orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0),
        totalUsers: users.length,
        totalOrders: orders.length,
        pendingOrders: orders.filter(order => order.status === 'preparing').length,
        completedOrders: orders.filter(order => order.status === 'completed').length,
        recentOrders: orders
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5)
          .map(order => ({
            id: order.id,
            user: order.userName || 'Unknown',
            amount: order.totalAmount || 0,
            status: order.status,
            createdAt: order.createdAt
          }))
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Menu analytics endpoint
  app.get("/api/canteens/:canteenId/menu-analytics", async (req, res) => {
    try {
      const canteenId = req.params.canteenId;

      // Use optimized database query to get only canteen-specific menu items with minimal fields
      const canteenMenuItems = await MenuItem.find({ canteenId }).select('available stock');

      // Calculate analytics directly from database results
      const totalItems = canteenMenuItems.length;
      const activeItems = canteenMenuItems.filter(item =>
        item.available === true &&
        item.stock !== null &&
        item.stock !== undefined &&
        item.stock > 0
      ).length;
      const outOfStockItems = canteenMenuItems.filter(item =>
        item.stock !== null && item.stock !== undefined && item.stock === 0
      ).length;
      const lowStockItems = canteenMenuItems.filter(item =>
        item.stock !== null && item.stock !== undefined && item.stock > 0 && item.stock <= 5
      ).length;

      res.json({
        totalItems: totalItems || 0,
        activeItems: activeItems || 0,
        outOfStockItems: outOfStockItems || 0,
        lowStockItems: lowStockItems || 0
      });
    } catch (error) {
      console.error("Error fetching menu analytics:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Optimized categories endpoint with server-side filtering
  app.get("/api/categories", async (req, res) => {
    try {
      const canteenId = req.query.canteenId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const search = req.query.search as string;
      const sortBy = req.query.sortBy as string || 'name';
      const sortOrder = req.query.sortOrder as string || 'asc';

      console.log(`📋 GET /api/categories - Canteen: ${canteenId}, Page: ${page}, Limit: ${limit}, Search: ${search || 'none'}`);
      // Categories API called

      // Build query with server-side filtering
      let query: any = {};
      if (canteenId) { query.canteenId = canteenId; }

      // Search filter
      if (search && search.trim()) {
        query.name = { $regex: search, $options: 'i' };
      }

      // Build sort object
      const sortObj: any = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Get total count for pagination
      const totalItems = await Category.countDocuments(query);
      const totalPages = Math.ceil(totalItems / limit);

      // Use offset if provided, otherwise use page-based pagination
      const skip = offset > 0 ? offset : (page - 1) * limit;

      // Get paginated categories with direct DB query (no filtering)
      const categories = await Category.find(query)
        .select('_id name icon imageUrl canteenId createdAt')
        .sort(sortObj)
        .skip(skip)
        .limit(limit);

      // Convert MongoDB documents to plain objects
      const plainCategories = categories.map(cat => {
        const obj = cat.toObject ? cat.toObject() : cat;
        if (obj._id) {
          obj.id = obj._id.toString();
          delete obj._id;
        }
        if ((obj as any).__v !== undefined) {
          delete (obj as any).__v;
        }
        return obj;
      });

      // Return response compatible with both page-based and offset-based pagination
      const response = {
        items: plainCategories,
        total: totalItems,
        hasMore: skip + categories.length < totalItems,
        limit,
        offset: skip,
        // Legacy pagination support
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        filters: {
          search: search || '',
          sortBy,
          sortOrder
        }
      };

      console.log(`✅ Successfully fetched ${plainCategories.length} categories (Total: ${totalItems})`);
      res.json(response);
    } catch (error) {
      console.error('❌ Categories API error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Checkout Charges Management (per-canteen)
  app.get("/api/canteens/:canteenId/charges", async (req, res) => {
    try {
      const { canteenId } = req.params;
      console.log(`🔍 Fetching charges for canteenId: ${canteenId}`);
      const charges = await CanteenCharge.find({ canteenId }).sort({ createdAt: -1 });
      console.log(`📊 Found ${charges.length} total charges`);
      const items = charges.map((c) => {
        const obj: any = c.toObject ? c.toObject() : c;
        obj.id = obj._id?.toString();
        delete obj._id;
        delete obj.__v;
        return obj;
      });
      const activeCount = items.filter(i => i.active).length;
      console.log(`✅ Returning ${items.length} charges (${activeCount} active)`);
      res.json({ items });
    } catch (error) {
      console.error("Error fetching charges:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Canteen Settings Management (tax rate configuration)
  app.get("/api/canteens/:canteenId/settings", async (req, res) => {
    try {
      const { canteenId } = req.params;
      console.log(`🔍 Fetching settings for canteenId: ${canteenId}`);

      const { CanteenSettings } = await import('./models/mongodb-models');
      let settings = await CanteenSettings.findOne({ canteenId });

      // If no settings exist, create default settings
      if (!settings) {
        console.log(`📝 Creating default settings for canteenId: ${canteenId}`);
        settings = await CanteenSettings.create({
          canteenId,
          taxRate: 5, // Default 5% GST
          taxName: 'GST'
        });
      }

      const settingsObj: any = settings.toObject ? settings.toObject() : settings;
      settingsObj.id = settingsObj._id?.toString();
      delete settingsObj._id;
      delete settingsObj.__v;

      console.log(`✅ Returning settings:`, settingsObj);
      res.json(settingsObj);
    } catch (error) {
      console.error("Error fetching canteen settings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/canteens/:canteenId/settings", async (req, res) => {
    try {
      const { canteenId } = req.params;
      const { taxRate, taxName, favoriteCounterId } = req.body;

      console.log(`🔄 Updating settings for canteenId: ${canteenId}`, { taxRate, taxName, favoriteCounterId });

      // Validate taxRate
      if (taxRate !== undefined && (taxRate < 0 || taxRate > 100)) {
        return res.status(400).json({ message: "Tax rate must be between 0 and 100" });
      }

      const { CanteenSettings } = await import('./models/mongodb-models');

      const updateData: any = {
        updatedAt: new Date()
      };

      if (taxRate !== undefined) updateData.taxRate = taxRate;
      if (taxName !== undefined) updateData.taxName = taxName;
      if (favoriteCounterId !== undefined) updateData.favoriteCounterId = favoriteCounterId;

      let settings = await CanteenSettings.findOneAndUpdate(
        { canteenId },
        updateData,
        { new: true, upsert: true }
      );

      const settingsObj: any = settings.toObject ? settings.toObject() : settings;
      settingsObj.id = settingsObj._id?.toString();
      delete settingsObj._id;
      delete settingsObj.__v;

      console.log(`✅ Settings updated successfully:`, settingsObj);
      res.json(settingsObj);
    } catch (error) {
      console.error("Error updating canteen settings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/canteens/:canteenId/charges", async (req, res) => {
    try {
      const { canteenId } = req.params;
      const { name, type, value, active = true } = req.body;
      if (!name || !type || value === undefined) {
        return res.status(400).json({ message: "Name, type, and value are required" });
      }
      const charge = await CanteenCharge.create({ canteenId, name, type, value, active });
      res.status(201).json({
        id: charge._id?.toString(),
        name: charge.name,
        type: charge.type,
        value: charge.value,
        active: charge.active,
        createdAt: charge.createdAt,
        canteenId,
      });
    } catch (error) {
      console.error("Error creating charge:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/canteen-charges/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, type, value, active } = req.body;
      const update: any = {};
      if (name !== undefined) update.name = name;
      if (type !== undefined) update.type = type;
      if (value !== undefined) update.value = value;
      if (active !== undefined) update.active = active;

      const charge = await CanteenCharge.findByIdAndUpdate(id, update, { new: true });
      if (!charge) {
        return res.status(404).json({ message: "Charge not found" });
      }
      res.json({
        id: charge._id?.toString(),
        name: charge.name,
        type: charge.type,
        value: charge.value,
        active: charge.active,
        createdAt: charge.createdAt,
        canteenId: charge.canteenId,
      });
    } catch (error) {
      console.error("Error updating charge:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/canteen-charges/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const charge = await CanteenCharge.findByIdAndDelete(id);
      if (!charge) {
        return res.status(404).json({ message: "Charge not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting charge:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Batch API for home screen data - media banners, trending items, quick picks, active orders
  app.get("/api/home-data", async (req, res) => {
    try {
      const canteenId = req.query.canteenId as string;
      const userIdParam = req.query.userId as string;
      const userId = userIdParam ? parseInt(userIdParam, 10) : null;

      console.log('🏠 Home Data API called with:', { canteenId, userId });

      if (!canteenId) {
        console.log(`❌ Missing canteenId for home data request`);
        return res.status(400).json({ error: 'canteenId is required' });
      }

      // Fetch data in parallel
      const [mediaBanners, trendingItems, quickPicks, systemSettings] = await Promise.all([
        // OPTIMIZED: Media Banners - direct DB query
        MediaBanner.find({ isActive: true, canteenId: canteenId })
          .select('_id name type cloudinaryUrl fileId originalName mimeType displayMode')
          .sort({ displayOrder: 1, createdAt: -1 })
          .limit(10)
          .lean()
          .exec(),

        // OPTIMIZED: Trending Items - DB query with isTrending filter
        MenuItem.find({
          canteenId: canteenId,
          isTrending: true,
          available: true,
          stock: { $gt: 0 }
        })
          .select('_id name price imageUrl isVegetarian description isTrending storeCounterId paymentCounterId cookingTime calories')
          .sort({ trendingOrder: 1, createdAt: -1 })
          .limit(4)
          .lean()
          .exec(),

        // OPTIMIZED: Quick Picks - DB query with specific selection criteria
        MenuItem.find({
          canteenId: canteenId,
          available: true,
          stock: { $gt: 0 },
          isQuickPick: true
        })
          .select('_id name price imageUrl isVegetarian description isQuickPick storeCounterId paymentCounterId cookingTime calories')
          .sort({ quickPickOrder: 1, createdAt: -1 })
          .limit(4)
          .lean()
          .exec(),

        // Fetch content settings to check if coding challenges are enabled
        (async () => {
          const SystemSettingsSchema = new mongoose.Schema({}, { strict: false });
          const SystemSettingsModel = mongoose.models.SystemSettings || mongoose.model('SystemSettings', SystemSettingsSchema);
          return SystemSettingsModel.findOne().sort({ createdAt: -1 }).lean().exec();
        })()
      ]);

      // Fetch user active orders separately if userId is provided
      let activeOrders: any[] = [];
      if (userId && !isNaN(userId)) {
        const allActiveOrders = await storage.getUserActiveOrders(userId);
        // Filter to only orders for the selected canteen
        activeOrders = Array.isArray(allActiveOrders)
          ? allActiveOrders.filter((order: any) => order.canteenId === canteenId)
          : [];
      }

      // Get coding challenges enabled status from canteen settings
      let codingChallengesEnabled = false;
      let canteenLocation = '';
      let canteenContactNumber = '';
      let canteenLogo = '';
      if ((systemSettings as any)?.canteens?.list) {
        const canteen = (systemSettings as any).canteens.list.find((c: any) => c.id === canteenId);
        if (canteen) {
          codingChallengesEnabled = canteen.codingChallengesEnabled ?? false;
          canteenLocation = canteen.location || '';
          canteenContactNumber = canteen.contactNumber || '';
          canteenLogo = canteen.logoUrl || '';
        }
      }

      // OPTIMIZED: Convert MongoDB documents to plain objects
      // With lean(), items are already plain objects, just need _id conversion
      const formatItems = (items: any[]) => items.map(item => {
        // With lean(), item is already a plain object, no need for toObject()
        const obj = item;
        if (obj._id) {
          obj.id = obj._id.toString();
          delete obj._id;
        }
        if (obj.__v !== undefined) {
          delete obj.__v;
        }
        // Counter IDs are already included from lean() query
        return obj;
      });

      // Filter out media banners with invalid data
      const validMediaBanners = formatItems(mediaBanners).filter(banner =>
        banner.id &&
        (banner.cloudinaryUrl || banner.fileId) &&
        banner.originalName
      );

      console.log('🏠 Home Data API response:', {
        mediaBanners: mediaBanners.length,
        validMediaBanners: validMediaBanners.length,
        trendingItems: trendingItems.length,
        quickPicks: quickPicks.length,
        activeOrders: activeOrders ? activeOrders.length : 0
      });

      const response = {
        mediaBanners: validMediaBanners,
        trendingItems: formatItems(trendingItems),
        quickPicks: formatItems(quickPicks),
        activeOrders: activeOrders || [], // User's active orders (already formatted)
        codingChallengesEnabled: codingChallengesEnabled, // Content settings
        canteenLocation,
        canteenContactNumber,
        canteenLogo,
        timestamp: new Date().toISOString()
      };

      console.log(`✅ Home data fetched - Banners: ${validMediaBanners.length}, Trending: ${trendingItems.length}, Quick Picks: ${quickPicks.length}`);
      res.json(response);
    } catch (error) {
      console.error('❌ Home Data API error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      console.log(`📋 POST /api/categories - Creating category: ${req.body.name} for canteen: ${req.body.canteenId}`);
      const validatedData = insertCategorySchema.parse(req.body);

      // Check if category already exists for this canteen (optimized query)
      const existingCategory = await Category.findOne({
        name: validatedData.name,
        canteenId: validatedData.canteenId
      });

      if (existingCategory) {
        console.log(`❌ Category "${validatedData.name}" already exists in canteen ${validatedData.canteenId}`);
        return res.status(409).json({
          message: `Category "${validatedData.name}" already exists in this canteen`,
          field: 'name',
          value: validatedData.name
        });
      }

      const category = await storage.createCategory(validatedData);
      console.log(`✅ Category created successfully - ID: ${category.id}, Name: ${category.name}`);
      res.status(201).json(category);
    } catch (error: any) {
      if (error.code === 11000 || error.message?.includes('E11000')) { // MongoDB duplicate key error
        // Extract category name from the error or request body
        const categoryName = error.keyValue?.name || req.body?.name || 'Unknown';

        // Check if it's a compound key violation (name + canteenId)
        if (error.keyPattern && error.keyPattern.name && error.keyPattern.canteenId) {
          res.status(409).json({
            message: `Category "${categoryName}" already exists in this canteen`,
            field: 'name',
            value: categoryName
          });
        } else {
          res.status(409).json({
            message: "Category already exists",
            field: 'name',
            value: categoryName
          });
        }
      } else if (error.name === 'ZodError') {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error", error: error.message });
      }
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const categoryId = req.params.id;
      console.log(`🗑️ DELETE /api/categories/${categoryId} - Deleting category`);
      await storage.deleteCategory(categoryId);
      console.log(`✅ Category ${categoryId} deleted successfully`);
      res.status(204).send();
    } catch (error) {
      console.error(`❌ Error deleting category ${req.params.id}:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update category
  app.put("/api/categories/:id", async (req, res) => {
    try {
      const { name, icon, imageUrl, imagePublicId } = req.body;
      const categoryId = req.params.id;

      const updateData: any = { name };
      if (icon !== undefined) updateData.icon = icon;
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
      if (imagePublicId !== undefined) updateData.imagePublicId = imagePublicId;

      const updatedCategory = await storage.updateCategory(categoryId, updateData);
      res.json(updatedCategory);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Upload category image
  app.post("/api/categories/:id/image", upload.single('image'), async (req, res) => {
    try {
      const categoryId = req.params.id;

      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      // Compress and upload to Cloudinary (10KB target)
      const result = await cloudinaryService.uploadImage(
        req.file.buffer,
        `categories/${categoryId}`,
        undefined,
        10 * 1024 // 10KB target
      );

      const imageUrl = result.secure_url;
      const publicId = result.public_id;

      // Update category with image info
      await storage.updateCategory(categoryId, { imageUrl, imagePublicId: publicId });

      res.json({ imageUrl, imagePublicId: publicId });
    } catch (error) {
      console.error("Error uploading category image:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Remove category image
  app.delete("/api/categories/:id/image", async (req, res) => {
    try {
      const categoryId = req.params.id;

      // Get current category to find image public ID
      const categories = await storage.getCategories();
      const category = categories.find((cat: any) => cat.id === categoryId);

      if (category?.imagePublicId) {
        // Delete from Cloudinary
        await cloudinaryService.deleteImage(category.imagePublicId);
      }

      // Update category to remove image
      await storage.updateCategory(categoryId, { imageUrl: "", imagePublicId: "" });

      res.json({ message: "Image removed successfully" });
    } catch (error) {
      console.error("Error removing category image:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Optimized menu items endpoint with comprehensive server-side filtering
  app.get("/api/menu", async (req, res) => {
    try {
      const canteenId = req.query.canteenId as string;
      const search = req.query.search as string;
      const category = req.query.category as string;
      const stockFilter = req.query.stockFilter as string;
      const vegOnly = req.query.vegOnly as string; // 'true' or 'false' as string
      const availableOnly = req.query.availableOnly as string; // 'true' or 'false' as string - default true for user-facing
      const excludeIds = req.query.excludeIds as string; // Comma-separated IDs to exclude (for smart caching)
      const itemIds = req.query.itemIds as string; // Comma-separated IDs to fetch specific items (optimized batch query)
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const sortBy = req.query.sortBy as string || 'name';
      const sortOrder = req.query.sortOrder as string || 'asc';

      // Log the request for debugging
      console.log('📋 Menu API Request:', {
        canteenId,
        search,
        category,
        stockFilter,
        availableOnly,
        page,
        limit,
        sortBy,
        sortOrder,
        queryParams: req.query
      });

      // Build MongoDB query with server-side filtering
      let query: any = {};

      // OPTIMIZATION: If itemIds is provided, fetch only those specific items (batch query)
      // This is used for checkout page to fetch only items missing counter IDs
      if (itemIds && itemIds.trim()) {
        const idsToFetch = itemIds.split(',').map(id => id.trim()).filter(id => id);
        if (idsToFetch.length > 0) {
          // Convert to MongoDB ObjectIds
          const objectIds = idsToFetch
            .map(id => {
              try {
                return new mongoose.Types.ObjectId(id);
              } catch {
                return null;
              }
            })
            .filter(id => id !== null);

          if (objectIds.length > 0) {
            query._id = { $in: objectIds };
            console.log(`✅ OPTIMIZED: Fetching ${objectIds.length} specific menu items by IDs`);
          }
        }
      } else {
        // Canteen filter (REQUIRED for menu management - always filter by canteenId)
        if (canteenId && canteenId.trim()) {
          query.canteenId = canteenId.trim();
          console.log('✅ Filtering menu items by canteenId:', canteenId.trim());
        } else {
          // If canteenId is not provided, return error for menu management
          // (This prevents accidentally showing items from all canteens)
          console.warn('⚠️ Menu API called without canteenId - returning empty results');
          return res.json({
            items: [],
            pagination: {
              currentPage: page,
              totalPages: 0,
              totalItems: 0,
              itemsPerPage: limit,
              hasNextPage: false,
              hasPrevPage: false
            },
            filters: {
              search: search || '',
              category: category || 'all',
              stockFilter: stockFilter || 'all',
              vegOnly: vegOnly || 'false',
              availableOnly: availableOnly || 'true',
              sortBy,
              sortOrder
            }
          });
        }

        // Exclude IDs filter (for smart caching - don't fetch already loaded items)
        if (excludeIds && excludeIds.trim()) {
          const idsToExclude = excludeIds.split(',').map(id => id.trim()).filter(id => id);
          if (idsToExclude.length > 0) {
            query._id = { $nin: idsToExclude };
          }
        }
      }

      // Available and stock filter - default to showing only available items with stock > 0
      // unless explicitly disabled (for admin views)
      const showAvailableOnly = availableOnly !== 'false';
      if (showAvailableOnly) {
        query.available = true;
        query.stock = { $gt: 0 };
      }

      // Vegetarian filter
      if (vegOnly === 'true') {
        query.isVegetarian = true;
      }

      // Search filter - use fuzzy regex for typo-tolerant matching
      if (search && search.trim()) {
        const searchTerm = search.trim().toLowerCase();

        // Generate fuzzy regex pattern for typo tolerance
        // Key insight: biryani vs biriyani - the difference is an extra 'i' between 'r' and 'y'
        // Solution: Allow optional vowels between any two consonants
        const generateFuzzyPattern = (term: string): string => {
          const vowels = 'aeiou';
          const isVowel = (c: string) => vowels.includes(c);
          const isConsonant = (c: string) => /[a-z]/.test(c) && !isVowel(c) && c !== 'y';

          let pattern = '';
          let i = 0;

          while (i < term.length) {
            const char = term[i];
            const nextChar = term[i + 1];

            // Escape special regex characters
            const escapedChar = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            if (isVowel(char)) {
              // Vowels: match one or more vowels flexibly (handles 'i' vs 'ee', 'a' vs 'o', etc.)
              pattern += '[aeiou]+';
              // Skip consecutive vowels in the search term
              while (i + 1 < term.length && isVowel(term[i + 1])) {
                i++;
              }
            } else if (char === 'y') {
              // Y is tricky - can act as vowel or consonant
              // Make it match y, i, or e, and make it optional
              pattern += '[yie]*';
            } else if (isConsonant(char)) {
              // Consonant
              pattern += escapedChar;

              // Allow optional double consonant (coffee/coffe, birriyani/biriyani)
              if ('fsltnprbdgmck'.includes(char)) {
                pattern += char + '?';
              }

              // KEY FIX: Allow optional vowel(s) between this consonant and the next consonant
              // This handles biryani → biriyani (optional 'i' between 'r' and 'y')
              if (nextChar && (isConsonant(nextChar) || nextChar === 'y')) {
                pattern += '[aeiou]*';
              }
            } else {
              // Non-letter characters (spaces, etc.)
              pattern += escapedChar;
            }

            i++;
          }

          return pattern;
        };

        const fuzzyPattern = generateFuzzyPattern(searchTerm);
        const searchRegex = new RegExp(fuzzyPattern, 'i');

        // Also search for categories that match the search term
        const matchingCategories = await Category.find({
          canteenId,
          name: searchRegex
        }).select('_id');

        const matchingCategoryIds = matchingCategories.map(cat => cat._id);

        query.$or = [
          { name: searchRegex },
          { description: searchRegex }
        ];

        if (matchingCategoryIds.length > 0) {
          query.$or.push({ categoryId: { $in: matchingCategoryIds } });
        }

        console.log('🔍 Fuzzy search applied:', searchTerm, '→ pattern:', fuzzyPattern, 'Matching categories:', matchingCategoryIds.length);
      }

      // Stock filter (for admin views - overrides availableOnly filter)
      if (stockFilter && stockFilter !== 'all') {
        if (stockFilter === 'low_stock') {
          query.stock = { $gt: 0, $lte: 5 };
          delete query.available; // Remove available filter when using stockFilter
        } else if (stockFilter === 'out_of_stock') {
          query.stock = { $eq: 0 };
          delete query.available; // Remove available filter when using stockFilter
        }
      }

      // Category filter - find category ID first for better performance
      if (category && category !== 'all') {
        let categoryId = null;

        // Check if category is a valid ObjectId (directly passed from UI)
        if (mongoose.Types.ObjectId.isValid(category)) {
          categoryId = category;
        } else {
          // If not an ID, find by name
          const categoryDoc = await Category.findOne({ name: category, canteenId });
          if (categoryDoc) {
            categoryId = categoryDoc._id;
          }
        }

        if (categoryId) {
          query.categoryId = categoryId;
        } else {
          // If category not found, return empty results
          return res.json({
            items: [],
            pagination: {
              currentPage: page,
              totalPages: 0,
              totalItems: 0,
              itemsPerPage: limit,
              hasNextPage: false,
              hasPrevPage: false
            },
            filters: {
              search: search || '',
              category: category || 'all',
              stockFilter: stockFilter || 'all',
              sortBy,
              sortOrder
            }
          });
        }
      }

      // Build sort object
      let sortOptions: any = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // OPTIMIZED: Get total count for pagination
      // Note: For very large collections, consider caching or using estimatedDocumentCount()
      // but countDocuments() is accurate and uses indexes efficiently
      const totalItems = await MenuItem.countDocuments(query).exec();
      const totalPages = Math.ceil(totalItems / limit);
      const skip = (page - 1) * limit;

      console.log('📋 Menu Query Details:', {
        query,
        totalItems,
        totalPages,
        page,
        limit,
        skip
      });

      // OPTIMIZED: Get paginated menu items with proper query chain order
      // Order matters: find -> select -> populate -> sort -> skip -> limit -> lean
      const menuItems = await MenuItem.find(query)
        .select('name price categoryId canteenId available stock description addOns isVegetarian isMarkable isTrending isQuickPick imageUrl imagePublicId storeCounterId paymentCounterId kotCounterId cookingTime calories createdAt') // Select fields first (reduces data transfer)
        .populate('categoryId', 'name icon imageUrl') // Populate after select (only populated fields needed)
        .sort(sortOptions) // Sort before skip/limit (uses index)
        .skip(skip) // Skip after sort
        .limit(limit) // Limit after skip
        .lean() // Use lean() last to get plain JavaScript objects (faster, preserves all fields)
        .exec(); // Explicit exec() for better performance tracking

      console.log('📋 Menu Items Found:', {
        count: menuItems.length,
        sampleCanteenIds: menuItems.slice(0, 5).map(item => item.canteenId),
        requestedCanteenId: canteenId
      });

      // Check for items missing counter IDs
      const itemsWithoutCounterIds = menuItems.filter(
        item => !item.storeCounterId || !item.paymentCounterId
      );

      if (itemsWithoutCounterIds.length > 0) {
        console.warn(`⚠️ ${itemsWithoutCounterIds.length} menu items missing counter IDs:`,
          itemsWithoutCounterIds.map(item => ({
            id: item._id,
            name: item.name,
            storeCounterId: item.storeCounterId,
            paymentCounterId: item.paymentCounterId
          }))
        );
      }

      // Log sample item for debugging
      if (menuItems.length > 0) {
        const sampleItem = menuItems[0];
        console.log('📋 Sample menu item counter IDs:', {
          itemId: sampleItem._id,
          itemName: sampleItem.name,
          storeCounterId: sampleItem.storeCounterId,
          paymentCounterId: sampleItem.paymentCounterId,
          hasStoreCounterId: sampleItem.storeCounterId !== undefined && sampleItem.storeCounterId !== null,
          hasPaymentCounterId: sampleItem.paymentCounterId !== undefined && sampleItem.paymentCounterId !== null
        });
      }

      // Return paginated response
      res.json({
        items: menuItems.map(item => {
          // With lean(), item is already a plain object, no need for toObject()
          const plainItem = item as any;

          // Convert _id to id
          if (plainItem._id) {
            plainItem.id = plainItem._id.toString();
            delete plainItem._id;
          }

          // Remove __v if present
          if (plainItem.__v !== undefined) {
            delete plainItem.__v;
          }

          // Counter IDs should already be in plainItem from lean()
          // Explicitly ensure they're preserved (they should be there if in DB)
          const result = {
            ...plainItem,
            storeCounterId: plainItem.storeCounterId, // Keep as-is (don't convert to undefined)
            paymentCounterId: plainItem.paymentCounterId // Keep as-is (don't convert to undefined)
          };

          // Log if counter IDs are missing (for debugging)
          if (!result.storeCounterId || !result.paymentCounterId) {
            console.warn(`⚠️ Menu item missing counter IDs: ${result.name} (${result.id})`, {
              storeCounterId: result.storeCounterId,
              paymentCounterId: result.paymentCounterId,
              rawItem: plainItem
            });
          }

          return result;
        }),
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        filters: {
          search: search || '',
          category: category || 'all',
          stockFilter: stockFilter || 'all',
          vegOnly: vegOnly || 'false',
          availableOnly: availableOnly || 'true',
          sortBy,
          sortOrder
        }
      });
    } catch (error) {
      console.error('Error fetching menu items:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Lightweight stock check endpoint for POS checkout validation
  app.post("/api/menu/check-stock", async (req, res) => {
    try {
      const { itemIds } = req.body;

      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ message: "itemIds array is required" });
      }

      // Minimal projection — only fetch what we need
      const items = await MenuItem.find(
        { _id: { $in: itemIds } },
        { _id: 1, name: 1, stock: 1, available: 1 }
      ).lean();

      const stockMap = items.map(item => ({
        id: item._id.toString(),
        name: item.name,
        stock: item.stock,
        available: item.available,
      }));

      res.json({ items: stockMap });
    } catch (error) {
      console.error('Error checking stock:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/menu/:id", async (req, res) => {
    try {
      const menuItemId = req.params.id;
      console.log(`📋 GET /api/menu/${menuItemId} - Fetching menu item`);
      const menuItem = await storage.getMenuItem(menuItemId);
      if (!menuItem) {
        console.log(`❌ Menu item ${menuItemId} not found`);
        return res.status(404).json({ message: "Menu item not found" });
      }

      // Log counter IDs for debugging
      console.log(`✅ Menu item found: ${menuItem.name}`, {
        storeCounterId: menuItem.storeCounterId,
        paymentCounterId: menuItem.paymentCounterId,
        kotCounterId: menuItem.kotCounterId,
        hasStoreCounterId: menuItem.storeCounterId !== undefined && menuItem.storeCounterId !== null,
        hasPaymentCounterId: menuItem.paymentCounterId !== undefined && menuItem.paymentCounterId !== null,
        hasKotCounterId: menuItem.kotCounterId !== undefined && menuItem.kotCounterId !== null
      });

      // Ensure counter IDs are explicitly included
      const result = {
        ...menuItem,
        storeCounterId: menuItem.storeCounterId || undefined,
        paymentCounterId: menuItem.paymentCounterId || undefined,
        kotCounterId: menuItem.kotCounterId || undefined
      };

      if (!result.storeCounterId || !result.paymentCounterId) {
        console.warn(`⚠️ Menu item missing counter IDs: ${result.name} (${result.id})`);
      }

      res.json(result);
    } catch (error) {
      console.error(`❌ Error fetching menu item ${req.params.id}:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/menu", async (req, res) => {
    try {
      console.log(`📋 POST /api/menu - Creating menu item: ${req.body.name} for canteen: ${req.body.canteenId}`);
      const validatedData = insertMenuItemSchema.parse(req.body);

      // Convert categoryId to string if it exists (handle both string and object formats)
      const menuItemData = {
        ...validatedData,
        categoryId: validatedData.categoryId ?
          (typeof validatedData.categoryId === 'string'
            ? validatedData.categoryId
            : (validatedData.categoryId as any)?._id || (validatedData.categoryId as any)?.id || String(validatedData.categoryId)
          ) : undefined
      };
      const menuItem = await storage.createMenuItem(menuItemData);
      console.log(`✅ Menu item created successfully - ID: ${menuItem.id}, Name: ${menuItem.name}, Price: ${menuItem.price}`);
      res.status(201).json(menuItem);
    } catch (error: any) {
      console.error("Error creating menu item:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error", error: error instanceof Error ? error.message : String(error) });
      }
    }
  });

  app.put("/api/menu/:id", async (req, res) => {
    try {
      const menuItemId = req.params.id;
      console.log(`🔄 PUT /api/menu/${menuItemId} - Updating menu item`);
      // Validate the request data, but allow partial updates
      const validatedData = insertMenuItemSchema.partial().parse(req.body);

      // Convert categoryId to string if it exists (handle both string and object formats)
      const updateData = {
        ...validatedData,
        categoryId: validatedData.categoryId ?
          (typeof validatedData.categoryId === 'string'
            ? validatedData.categoryId
            : (validatedData.categoryId as any)?._id || (validatedData.categoryId as any)?.id || String(validatedData.categoryId)
          ) : undefined
      };
      // Log the update data being sent
      console.log(`🔍 Update data for menu item ${menuItemId}:`, {
        ...updateData,
        kotCounterId: updateData.kotCounterId || 'not provided'
      });

      const menuItem = await storage.updateMenuItem(menuItemId, updateData);
      console.log(`✅ Menu item ${menuItemId} updated successfully`, {
        storeCounterId: menuItem.storeCounterId,
        paymentCounterId: menuItem.paymentCounterId,
        kotCounterId: menuItem.kotCounterId
      });
      res.json(menuItem);
    } catch (error) {
      console.error("Error updating menu item:", error);
      res.status(500).json({ message: "Internal server error", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.delete("/api/menu/:id", async (req, res) => {
    try {
      const menuItemId = req.params.id;
      console.log(`🗑️ DELETE /api/menu/${menuItemId} - Deleting menu item`);
      await storage.deleteMenuItem(menuItemId);
      console.log(`✅ Menu item ${menuItemId} deleted successfully`);
      res.status(204).send();
    } catch (error) {
      console.error(`❌ Error deleting menu item ${req.params.id}:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Test endpoint to check if multipart requests are working
  app.post("/api/test-upload", upload.single('image'), (req, res) => {
    res.json({ success: true, hasFile: !!req.file });
  });

  // Test endpoint to check Cloudinary configuration
  app.get("/api/test-cloudinary", (req, res) => {
    const config = {
      hasCloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
      hasApiKey: !!process.env.CLOUDINARY_API_KEY,
      hasApiSecret: !!process.env.CLOUDINARY_API_SECRET,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Not Set',
      apiKey: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not Set',
      apiSecret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Not Set'
    };
    res.json(config);
  });

  // Menu item image upload endpoint
  app.post("/api/menu/:id/image", (req, res, next) => {
    // Handle multer errors
    upload.single('image')(req, res, (err) => {
      if (err) {
        console.error('❌ Multer error:', err);
        // Check for multer-specific error codes
        if (err && typeof err === 'object' && 'code' in err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: "File size exceeds 100KB limit" });
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ message: "Unexpected file field. Please use 'image' as the field name." });
          }
        }
        const errorMessage = err instanceof Error ? err.message : "File upload error";
        return res.status(400).json({ message: errorMessage });
      }
      next();
    });
  }, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file uploaded. Please select an image file." });
      }

      if (!req.params.id) {
        return res.status(400).json({ message: "Menu item ID is required" });
      }

      const { originalname, mimetype, buffer } = req.file;

      // Validate file type
      if (!mimetype.startsWith('image/')) {
        return res.status(400).json({ message: "Only image files are allowed" });
      }

      // Validate file size (100KB limit)
      if (buffer.length > 100 * 1024) {
        return res.status(400).json({ message: "File size exceeds 100KB limit" });
      }

      // Get existing menu item to check if it has an image
      const existingMenuItem = await storage.getMenuItem(req.params.id);
      if (!existingMenuItem) {
        return res.status(404).json({ message: "Menu item not found" });
      }

      // Delete old image if exists
      if (existingMenuItem.imagePublicId) {
        try {
          await cloudinaryService.deleteImage(existingMenuItem.imagePublicId);
          // Old image deleted from Cloudinary
        } catch (deleteError) {
          // Failed to delete old image (continuing anyway)
        }
      }

      // Generate unique public ID
      const publicId = `menu-item-${req.params.id}-${Date.now()}`;

      // Upload to Cloudinary with compression
      const uploadResult = await cloudinaryService.uploadImage(
        buffer,
        'menu-items',
        publicId,
        20 * 1024 // 20KB limit
      );

      // Update menu item with image data
      const updatedMenuItem = await storage.updateMenuItem(req.params.id, {
        imageUrl: uploadResult.secure_url,
        imagePublicId: uploadResult.public_id
      } as any);

      res.json({
        success: true,
        imageUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        menuItem: updatedMenuItem
      });
    } catch (error) {
      console.error("Error uploading menu item image:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        message: "Failed to upload image",
        error: errorMessage
      });
    }
  });

  // Delete menu item image endpoint
  app.delete("/api/menu/:id/image", async (req, res) => {
    try {
      const menuItemId = req.params.id;
      console.log(`🗑️ DELETE /api/menu/${menuItemId}/image - Deleting menu item image`);
      const menuItem = await storage.getMenuItem(menuItemId);
      if (!menuItem) {
        console.log(`❌ Menu item ${menuItemId} not found`);
        return res.status(404).json({ message: "Menu item not found" });
      }

      if (!menuItem.imagePublicId) {
        console.log(`❌ No image found for menu item ${menuItemId}`);
        return res.status(404).json({ message: "No image found for this menu item" });
      }

      // Delete from Cloudinary
      console.log(`🔄 Deleting image from Cloudinary: ${menuItem.imagePublicId}`);
      const deleted = await cloudinaryService.deleteImage(menuItem.imagePublicId);
      if (!deleted) {
        console.log(`❌ Failed to delete image from Cloudinary`);
        return res.status(500).json({ message: "Failed to delete image from Cloudinary" });
      }

      // Update menu item to remove image data
      const updatedMenuItem = await storage.updateMenuItem(menuItemId, {
        imageUrl: undefined,
        imagePublicId: undefined
      } as any);

      console.log(`✅ Image deleted successfully for menu item ${menuItemId}`);
      res.json({
        success: true,
        message: "Image deleted successfully",
        menuItem: updatedMenuItem
      });
    } catch (error) {
      console.error("❌ Error deleting menu item image:", error);
      res.status(500).json({
        message: "Failed to delete image",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Orders endpoints
  app.get("/api/orders", async (req, res) => {
    try {
      const canteenId = req.query.canteenId as string;
      const counterId = req.query.counterId as string;
      const isOffline = req.query.isOffline as string;
      const paymentStatus = req.query.paymentStatus as string;

      console.log(`📋 GET /api/orders - Filters: canteenId=${canteenId}, counterId=${counterId}, isOffline=${isOffline}, paymentStatus=${paymentStatus}`);
      const orders = await storage.getOrders();

      // Filter by canteenId if provided
      let filteredOrders = canteenId
        ? orders.filter((order: any) => order.canteenId === canteenId)
        : orders;

      // Filter by counterId if provided
      if (counterId) {
        filteredOrders = filteredOrders.filter((order: any) => order.counterId === counterId);
      }

      // Filter by isOffline if provided
      if (isOffline !== undefined) {
        const isOfflineBool = isOffline === 'true';
        filteredOrders = filteredOrders.filter((order: any) => order.isOffline === isOfflineBool);
      }

      // Filter by paymentStatus if provided
      if (paymentStatus) {
        filteredOrders = filteredOrders.filter((order: any) => order.paymentStatus === paymentStatus);
      }

      console.log(`✅ Successfully fetched ${filteredOrders.length} orders (from ${orders.length} total)`);
      res.json(filteredOrders);
    } catch (error) {
      console.error("❌ Error fetching orders:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/orders/paginated", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 15;
      const canteenId = req.query.canteenId as string;
      const isCounterOrder = req.query.isCounterOrder === 'true' ? true : req.query.isCounterOrder === 'false' ? false : undefined;
      const isOffline = req.query.isOffline === 'true' ? true : req.query.isOffline === 'false' ? false : undefined;

      const result = await storage.getOrdersPaginated(page, limit, canteenId, isCounterOrder, isOffline);

      res.json(result);
    } catch (error) {
      console.error("Error fetching paginated orders:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/orders/active/paginated", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 15;
      const canteenId = req.query.canteenId as string;
      const customerId = req.query.customerId ? parseInt(req.query.customerId as string) : undefined;

      // Security: require at least one filter to prevent leaking all users' orders
      if (!canteenId && !customerId) {
        return res.status(400).json({
          message: "Either canteenId or customerId is required to fetch active orders"
        });
      }

      const result = await storage.getActiveOrdersPaginated(page, limit, canteenId, customerId);

      res.json(result);
    } catch (error) {
      console.error("Error fetching paginated active orders:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Order stats endpoint - efficient way to get status counts without fetching all orders
  app.get("/api/orders/stats", async (req, res) => {
    try {
      const canteenId = req.query.canteenId as string;

      const stats = await storage.getOrderStats(canteenId);

      res.json(stats);
    } catch (error) {
      console.error("❌ Error fetching order stats:", error);
      console.error("❌ Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Server-side filtered orders endpoint
  app.get("/api/orders/filtered", async (req, res) => {
    try {
      console.log("🔍 Fetching filtered orders...");
      const {
        canteenId,
        search,
        status,
        dateRange,
        amountRange,
        paymentMethod,
        collegeFilter,
        sortBy = "createdAt",
        sortOrder = "desc",
        page = "1",
        limit = "15"
      } = req.query;

      console.log("🔍 Filter params:", {
        canteenId,
        search,
        status,
        dateRange,
        amountRange,
        paymentMethod,
        collegeFilter,
        sortBy,
        sortOrder,
        page,
        limit
      });

      const result = await storage.getFilteredOrders({
        canteenId: canteenId as string,
        search: search as string,
        status: status as string,
        dateRange: dateRange as string,
        amountRange: amountRange as string,
        paymentMethod: paymentMethod as string,
        collegeFilter: collegeFilter as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as "asc" | "desc",
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      });

      console.log(`🔍 Found ${result.orders.length} filtered orders, total: ${result.totalCount}`);
      res.json(result);
    } catch (error) {
      console.error("❌ Error fetching filtered orders:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Search orders across all data (server-side search)
  app.get("/api/orders/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 15;

      if (!query || query.trim().length === 0) {
        return res.status(400).json({ message: "Search query is required" });
      }

      const result = await storage.searchOrders(query.trim(), page, limit);

      res.json(result);
    } catch (error) {
      console.error("Error searching orders:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const identifier = req.params.id;
      console.log(`🔍 GET /api/orders/:id - Looking up order with identifier: ${identifier}`);

      let order = null;

      // Check if identifier is a valid MongoDB ObjectId (24 hex characters)
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);

      if (isValidObjectId) {
        // Try to find by MongoDB ObjectId first
        console.log(`🔍 Identifier looks like ObjectId, trying getOrder...`);
        try {
          order = await storage.getOrder(identifier);
        } catch (error) {
          console.error(`❌ Error in getOrder for ObjectId ${identifier}:`, error);
          // Continue to try other methods
        }
      }

      // If not found, try finding by orderNumber
      if (!order) {
        console.log(`🔍 Trying getOrderByOrderNumber...`);
        try {
          order = await storage.getOrderByOrderNumber(identifier);
        } catch (error) {
          console.error(`❌ Error in getOrderByOrderNumber for ${identifier}:`, error);
          // Continue to try barcode
        }
      }

      // If still not found, try finding by barcode (supports full barcode or 4-digit OTP)
      if (!order) {
        console.log(`🔍 Trying getOrderByBarcode...`);
        try {
          order = await storage.getOrderByBarcode(identifier);
        } catch (error) {
          console.error(`❌ Error in getOrderByBarcode for ${identifier}:`, error);
        }
      }

      // If still not found and it's a 4-digit OTP, try searching by first 4 digits of order number
      if (!order && identifier.length === 4 && /^\d{4}$/.test(identifier)) {
        console.log(`🔍 Trying to find order by 4-digit OTP (first 4 digits of order number)...`);
        try {
          const { Order } = await import('./models/mongodb-models');
          const regex = new RegExp('^' + identifier);
          const foundOrder = await Order.findOne({ orderNumber: regex });
          if (foundOrder) {
            const { mongoToPlain } = await import('./storage-hybrid');
            order = mongoToPlain(foundOrder);
          }
        } catch (error) {
          console.error(`❌ Error searching by OTP for ${identifier}:`, error);
        }
      }

      if (!order) {
        console.log(`❌ Order not found with identifier: ${identifier}`);
        return res.status(404).json({ message: "Order not found" });
      }

      console.log(`✅ Order found: ${order.orderNumber || order.id}`);
      console.log('  - Order chargesTotal:', order.chargesTotal);
      console.log('  - Order chargesApplied:', JSON.stringify(order.chargesApplied, null, 2));
      console.log('  - Order paymentMethod:', order.paymentMethod);
      res.json(order);
    } catch (error) {
      console.error("❌ Error fetching order:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Server-side rate limiting for polling endpoint (in-memory, simple implementation)
  // Industry Standard: Per-user rate limiting for better UX (not per-IP to avoid NAT issues)
  const pollingRateLimit = new Map<string, { count: number; resetTime: number }>();
  const POLLING_RATE_LIMIT = {
    maxRequests: 30, // Max 30 requests per window (generous for multiple tabs/orders)
    windowMs: 60000, // 1 minute window
    maxOrdersPerRequest: 20, // Max 20 orders per request
    // Note: Polling is fallback only - WebSocket handles real-time updates
    // 30 requests/min = 1 request every 2 seconds, which is reasonable for fallback
  };

  // Cleanup old rate limit entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of Array.from(pollingRateLimit.entries())) {
      if (now > value.resetTime) {
        pollingRateLimit.delete(key);
      }
    }
  }, 60000); // Cleanup every minute

  // Polling endpoint for order status (batch polling to reduce server load)
  // Industry Standard: Batch processing with rate limiting
  app.post("/api/orders/poll-status", async (req, res) => {
    try {
      const { orderIds } = req.body;

      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "orderIds must be a non-empty array"
        });
      }

      // Rate limiting: Max orders per request
      if (orderIds.length > POLLING_RATE_LIMIT.maxOrdersPerRequest) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${POLLING_RATE_LIMIT.maxOrdersPerRequest} orders per polling request`
        });
      }

      // Server-side rate limiting by IP with generous limits
      // Industry Standard: Generous limits since polling is fallback only (WebSocket handles real-time)
      // 30 requests/min = 1 request every 2 seconds, which is reasonable for fallback polling
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      const rateLimitKey = `polling:${clientIp}`;
      const rateLimit = pollingRateLimit.get(rateLimitKey);

      if (rateLimit) {
        if (now < rateLimit.resetTime) {
          // Still in rate limit window
          if (rateLimit.count >= POLLING_RATE_LIMIT.maxRequests) {
            const retryAfter = Math.ceil((rateLimit.resetTime - now) / 1000);
            console.warn(`⚠️ Rate limit exceeded for IP ${clientIp}: ${rateLimit.count}/${POLLING_RATE_LIMIT.maxRequests} requests`);
            return res.status(429).json({
              success: false,
              message: 'Polling rate limit reached. This is a fallback mechanism - WebSocket should handle updates. Please wait a moment.',
              retryAfter,
              // User-friendly message explaining this is fallback
              hint: 'If you see this frequently, check your WebSocket connection status.',
            });
          }
          rateLimit.count++;
        } else {
          // Window expired, reset
          pollingRateLimit.set(rateLimitKey, {
            count: 1,
            resetTime: now + POLLING_RATE_LIMIT.windowMs,
          });
        }
      } else {
        // First request from this IP
        pollingRateLimit.set(rateLimitKey, {
          count: 1,
          resetTime: now + POLLING_RATE_LIMIT.windowMs,
        });
      }

      console.log(`📊 POST /api/orders/poll-status - Polling ${orderIds.length} orders (IP: ${clientIp})`);

      const orders: any[] = [];

      // Batch fetch orders
      for (const identifier of orderIds) {
        try {
          let order = null;

          // Check if identifier is a valid MongoDB ObjectId
          const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);

          if (isValidObjectId) {
            order = await storage.getOrder(identifier);
          }

          // If not found, try orderNumber
          if (!order) {
            order = await storage.getOrderByOrderNumber(identifier);
          }

          // If still not found, try barcode
          if (!order) {
            order = await storage.getOrderByBarcode(identifier);
          }

          if (order) {
            orders.push(order);
          }
        } catch (error) {
          console.error(`❌ Error fetching order ${identifier} in batch:`, error);
          // Continue with other orders
        }
      }

      console.log(`✅ Polling complete: ${orders.length}/${orderIds.length} orders found`);

      res.json({
        success: true,
        orders,
        count: orders.length,
        requested: orderIds.length
      });
    } catch (error) {
      console.error("❌ Error in polling endpoint:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        orders: []
      });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      // Check for duplicate order session (for offline orders)
      if (req.body.isOffline && req.body.amount > 0) {
        const customerId = req.body.customerId || 0;
        const canteenId = req.body.canteenId || '';
        const amount = req.body.amount;

        console.log(`🔍 Checking for duplicate order session: Customer ${customerId}, Amount ${amount}, Canteen ${canteenId}`);

        const duplicateCheck = await checkDuplicatePaymentMiddleware(
          customerId,
          amount,
          canteenId
        );

        if (!duplicateCheck.allowed) {
          console.log(`⚠️ Duplicate order attempt blocked for customer ${customerId}`);
          return res.status(429).json({ // 429 Too Many Requests
            success: false,
            message: duplicateCheck.message,
            existingSession: duplicateCheck.existingSession,
            errorCode: 'DUPLICATE_ORDER_SESSION'
          });
        }

        // Note: Checkout session should already exist from frontend
        // We'll use the checkout session ID if provided, otherwise skip session creation
        const checkoutSessionId = req.body.checkoutSessionId;

        // If checkout session ID provided, update status
        if (checkoutSessionId) {
          try {
            await CheckoutSessionService.updateStatus(checkoutSessionId, 'active', {
              amount: amount,
              canteenId: canteenId,
              isOffline: true
            });
          } catch (error) {
            console.error('Error updating checkout session:', error);
          }
        }
      }

      // Generate unique 12-digit numeric order ID for both orderNumber and barcode
      const orderNumber = generateOrderNumber();
      const barcode = generateOrderNumber();

      console.log('📦 POST /api/orders - Received order request:', {
        customerName: req.body.customerName,
        collegeName: req.body.collegeName,
        canteenId: req.body.canteenId,
        amount: req.body.amount,
        originalAmount: req.body.originalAmount,
        discountAmount: req.body.discountAmount,
        appliedCoupon: req.body.appliedCoupon,
        isOffline: req.body.isOffline,
        isCounterOrder: req.body.isCounterOrder,
        status: req.body.status,
        paymentStatus: req.body.paymentStatus,
        orderType: req.body.orderType,
        hasDeliveryAddress: !!req.body.deliveryAddress,
        deliveryAddress: req.body.deliveryAddress,
        itemCount: req.body.items ? JSON.parse(req.body.items).length : 0,
        checkoutSessionId: req.body.checkoutSessionId
      });

      // Debug: Check if canteenId is missing or incorrect
      if (!req.body.canteenId) {
        console.error('POST /api/orders - ERROR: canteenId is missing from request body');
      }

      const orderData = { ...req.body, orderNumber, barcode };
      const validatedData = insertOrderSchema.parse(orderData);

      console.log('✅ Validated order data:', {
        isCounterOrder: validatedData.isCounterOrder,
        isOffline: validatedData.isOffline,
        status: validatedData.status,
        paymentStatus: validatedData.paymentStatus
      });

      // Parse order items
      let orderItems = [];
      try {
        orderItems = JSON.parse(validatedData.items);
      } catch (error) {
        return res.status(400).json({ message: "Invalid order items format" });
      }

      // NEW LOGIC: Add counter IDs to each item and collect all counter IDs for broadcasting
      const storeCounterIds = new Set<string>();
      const paymentCounterIds = new Set<string>();
      const kotCounterIds = new Set<string>();

      // Process each item: fetch menu item, add counter IDs and other properties to item, collect counter IDs
      for (const item of orderItems) {
        const menuItem = await storage.getMenuItem(item.id);

        if (menuItem) {
          // Add counter IDs directly to the item
          item.storeCounterId = menuItem.storeCounterId || null;
          item.paymentCounterId = menuItem.paymentCounterId || null;
          item.kotCounterId = menuItem.kotCounterId || null;

          // Add isMarkable and other relevant menu item properties to order item
          item.isMarkable = menuItem.isMarkable || false;
          item.isVegetarian = menuItem.isVegetarian !== undefined ? menuItem.isVegetarian : true;
          item.categoryId = menuItem.categoryId ? String(menuItem.categoryId) : null;
          item.available = menuItem.available !== undefined ? menuItem.available : true;

          // Collect counter IDs for broadcasting
          if (menuItem.storeCounterId) {
            storeCounterIds.add(menuItem.storeCounterId);
          }
          if (menuItem.paymentCounterId) {
            paymentCounterIds.add(menuItem.paymentCounterId);
          }
          if (menuItem.kotCounterId) {
            kotCounterIds.add(menuItem.kotCounterId);
          }

          console.log(`✅ Added properties to item ${item.name}:`, {
            storeCounterId: item.storeCounterId,
            paymentCounterId: item.paymentCounterId,
            kotCounterId: item.kotCounterId,
            isMarkable: item.isMarkable,
            isVegetarian: item.isVegetarian
          });
        } else {
          console.log(`❌ Menu item not found for ID: ${item.id}, item: ${item.name}`);
          // Still add null/false values so item structure is consistent
          item.storeCounterId = null;
          item.paymentCounterId = null;
          item.kotCounterId = null;
          item.isMarkable = false; // Default to false if menu item not found
          item.isVegetarian = true; // Default to true
          item.categoryId = null;
          item.available = true;
        }
      }

      // Get arrays of all counter IDs for broadcasting
      const allStoreCounterIds = Array.from(storeCounterIds);
      const allPaymentCounterIds = Array.from(paymentCounterIds);
      const allKotCounterIds = Array.from(kotCounterIds);
      const allCounterIds = Array.from(new Set([...Array.from(storeCounterIds), ...Array.from(paymentCounterIds), ...Array.from(kotCounterIds)]));

      console.log('📊 Counter IDs collected from items:', {
        allStoreCounterIds,
        allPaymentCounterIds,
        allKotCounterIds,
        allCounterIds,
        totalItems: orderItems.length
      });

      // Check markable status for order status determination
      let hasMarkableItem = false;
      let hasMarkableItemWithKot = false; // Check if markable items have KOT counters
      for (const item of orderItems) {
        const menuItem = await storage.getMenuItem(item.id);
        if (menuItem && menuItem.isMarkable) {
          hasMarkableItem = true;
          // Check if this markable item has a KOT counter assigned
          if (menuItem.kotCounterId) {
            hasMarkableItemWithKot = true;
          }
        }
      }

      console.log('📊 Markable items analysis:', {
        hasMarkableItem,
        hasMarkableItemWithKot,
        allKotCounterIds: allKotCounterIds.length > 0 ? allKotCounterIds : 'none'
      });

      // Determine order status based on order type and markable items
      let orderStatus;
      let paymentStatus = validatedData.paymentStatus; // Keep existing paymentStatus if provided

      console.log('🔍 Status determination - isCounterOrder:', validatedData.isCounterOrder, 'isOffline:', validatedData.isOffline);

      if (validatedData.isCounterOrder) {
        // For counter orders (POS): payment already collected, but order still needs preparation
        // Status determined by markable items (same as regular orders)
        orderStatus = hasMarkableItem ? "pending" : "ready";
        paymentStatus = paymentStatus || 'completed'; // POS orders are already paid at counter
        console.log('✅ Counter order detected - status:', orderStatus, '(payment already completed)');
      } else if (validatedData.isOffline) {
        // For offline orders (pay at counter), check if amount is 0 (free orders don't need payment)
        const orderAmount = validatedData.amount || 0;
        if (orderAmount <= 0) {
          // Free orders: determine status based on markable items (no payment needed)
          orderStatus = hasMarkableItem ? "pending" : "ready";
          paymentStatus = paymentStatus || 'completed'; // Free orders are automatically paid
        } else {
          // Paid offline orders: always start as "pending_payment"
          orderStatus = "pending_payment";
          paymentStatus = paymentStatus || 'pending'; // Set paymentStatus to 'pending' for pay at counter orders
        }
      } else {
        // For regular online orders, determine status based on markable items
        orderStatus = hasMarkableItem ? "pending" : "ready";
        paymentStatus = paymentStatus || 'paid'; // Online orders are already paid
      }

      // Initialize itemStatusByCounter for auto-ready items (non-markable items)
      // Auto-ready items should be marked as 'ready' by default for their assigned counters
      const itemStatusByCounter: { [counterId: string]: { [itemId: string]: 'pending' | 'ready' | 'completed' } } = {};

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

      console.log(`🔍 Initialized itemStatusByCounter for auto-ready items:`, {
        autoReadyItemsCount: orderItems.filter((item: any) => item.isMarkable !== true).length,
        itemStatusByCounterKeys: Object.keys(itemStatusByCounter),
        itemStatusByCounter: Object.keys(itemStatusByCounter).length > 0 ? itemStatusByCounter : 'none'
      });

      // Calculate chargesApplied if chargesTotal exists and payment method requires charges
      let chargesApplied: any[] = [];
      const userChargesTotal = validatedData.chargesTotal || 0;

      if (userChargesTotal > 0 && validatedData.canteenId) {
        const paymentMethod = validatedData.paymentMethod || (validatedData.isOffline ? 'offline' : 'online');
        const shouldIncludeCharges = paymentMethod !== 'offline' && paymentMethod !== 'cash';

        if (shouldIncludeCharges) {
          try {
            const canteenChargesDb = await CanteenCharge.find({ canteenId: validatedData.canteenId }).sort({ createdAt: -1 });
            const canteenCharges = canteenChargesDb.map((c: any) => {
              const obj: any = c.toObject ? c.toObject() : c;
              obj.id = obj._id?.toString();
              delete obj._id;
              delete obj.__v;
              return obj;
            });
            const activeCharges = canteenCharges.filter((charge: any) => charge.active);
            const subtotal = validatedData.itemsSubtotal || validatedData.originalAmount || validatedData.amount || 0;

            chargesApplied = activeCharges.map((charge: any) => {
              let chargeAmount = 0;
              if (charge.type === 'percent') {
                chargeAmount = (subtotal * charge.value) / 100;
              } else {
                chargeAmount = charge.value;
              }

              return {
                name: charge.name,
                type: charge.type,
                value: charge.value,
                amount: chargeAmount
              };
            });
          } catch (error) {
            console.error('Error fetching canteen charges for user order:', error);
          }
        }
      }

      // Update validated data with appropriate status and counter assignments
      // IMPORTANT: Update items string to include counter IDs in each item
      const finalOrderData = {
        ...validatedData,
        status: orderStatus,
        paymentStatus: paymentStatus, // Ensure paymentStatus is set correctly
        isCounterOrder: validatedData.isCounterOrder, // Explicitly preserve counter order flag
        isOffline: validatedData.isOffline, // Explicitly preserve offline flag
        items: JSON.stringify(orderItems), // Items now include storeCounterId, paymentCounterId, kotCounterId, isMarkable, etc.
        itemsSubtotal: validatedData.itemsSubtotal || validatedData.originalAmount || validatedData.amount || 0,
        taxAmount: validatedData.taxAmount || 0,
        chargesTotal: userChargesTotal,
        chargesApplied: chargesApplied.length > 0 ? chargesApplied : undefined,
        paymentMethod: validatedData.paymentMethod || (validatedData.isOffline ? 'offline' : 'online'),
        storeCounterId: allStoreCounterIds[0] || null, // Keep first for backward compatibility
        paymentCounterId: allPaymentCounterIds[0] || null, // Keep first for backward compatibility
        kotCounterId: allKotCounterIds[0] || null, // Keep first for backward compatibility
        allStoreCounterIds, // Store all store counter IDs
        allPaymentCounterIds, // Store all payment counter IDs
        allKotCounterIds, // Store all KOT counter IDs
        allCounterIds, // Store all counter IDs
        itemStatusByCounter: Object.keys(itemStatusByCounter).length > 0 ? itemStatusByCounter : undefined // Initialize with auto-ready items
      };

      // Debug: Check what fields are being passed to storage
      console.log(`🔍 Final order data being passed to storage:`, {
        isCounterOrder: finalOrderData.isCounterOrder,
        isOffline: finalOrderData.isOffline,
        paymentStatus: finalOrderData.paymentStatus,
        status: finalOrderData.status,
        orderType: finalOrderData.orderType,
        hasDeliveryAddress: !!finalOrderData.deliveryAddress,
        deliveryAddress: finalOrderData.deliveryAddress,
        canteenId: finalOrderData.canteenId,
        allStoreCounterIds: finalOrderData.allStoreCounterIds,
        allPaymentCounterIds: finalOrderData.allPaymentCounterIds,
        allKotCounterIds: finalOrderData.allKotCounterIds,
        allCounterIds: finalOrderData.allCounterIds,
        itemsCount: orderItems.length,
        itemsWithProperties: orderItems.slice(0, 3).map((item: any) => ({
          name: item.name,
          isMarkable: item.isMarkable,
          storeCounterId: item.storeCounterId,
          paymentCounterId: item.paymentCounterId,
          kotCounterId: item.kotCounterId
        }))
      });

      // Require canteenId to be provided
      if (!finalOrderData.canteenId) {
        return res.status(400).json({ message: "canteenId is required" });
      }

      console.log(`🔄 Order ${orderNumber}: Creating order for canteen ID: ${finalOrderData.canteenId}`);
      console.log(`🔄 Order ${orderNumber}: ${hasMarkableItem ? 'Has markable items - status: pending' : 'All non-markable items - status: ready'}`);

      // Check if stock was already reserved at checkout
      const checkoutSessionId = req.body.checkoutSessionId;
      const skipStockReduction = !!checkoutSessionId; // Skip if checkout session exists (stock already reserved)

      if (skipStockReduction) {
        console.log(`📦 Stock already reserved at checkout for session ${checkoutSessionId}, skipping stock reduction`);
      }

      // Process order with atomic stock management
      const order = await stockService.processOrderWithStockManagement(finalOrderData, orderItems, skipStockReduction);

      // Clear reserved stock from checkout session if order was successfully created
      if (checkoutSessionId && order) {
        try {
          await CheckoutSessionService.clearReservedStock(checkoutSessionId);
          console.log(`✅ Cleared reserved stock metadata for checkout session ${checkoutSessionId}`);
        } catch (error) {
          console.error(`❌ Error clearing reserved stock metadata:`, error);
          // Don't fail the order if clearing metadata fails
        }
      }

      console.log(`✅ Order ${orderNumber} created successfully with canteenId: ${order.canteenId}`);
      console.log(`📦 Order details saved to MongoDB:`, {
        id: order.id,
        isCounterOrder: order.isCounterOrder,
        isOffline: order.isOffline,
        paymentStatus: order.paymentStatus,
        status: order.status
      });
      console.log(`📦 Order counter arrays:`, {
        allStoreCounterIds: order.allStoreCounterIds,
        allPaymentCounterIds: order.allPaymentCounterIds,
        allKotCounterIds: order.allKotCounterIds,
        allCounterIds: order.allCounterIds
      });

      // Send push notification to canteen owner
      try {
        console.log(`🔔 Triggering push notification for order ${order.orderNumber} to canteen ${order.canteenId}`);
        await webPushService.sendNewOrderNotification(
          order.orderNumber,
          order.customerName || "Customer",
          order.amount,
          order.canteenId
        );
      } catch (error) {
        console.error('❌ Failed to send new order push notification:', error);
      }

      // Debug: Check if this is an offline order
      console.log(`🔍 Order type check:`, {
        isOffline: order.isOffline,
        paymentStatus: order.paymentStatus,
        isOfflineCheck: order.isOffline === true,
        paymentStatusCheck: order.paymentStatus === 'pending',
        condition: order.isOffline && order.paymentStatus === 'pending'
      });

      // Broadcast new order via WebSocket to appropriate counter rooms
      const wsManager = getWebSocketManager();
      if (wsManager) {
        console.log('Order object from database:', {
          orderNumber: order.orderNumber,
          storeCounterId: order.storeCounterId,
          allStoreCounterIds: order.allStoreCounterIds,
          allPaymentCounterIds: order.allPaymentCounterIds,
          allKotCounterIds: order.allKotCounterIds,
          allCounterIds: order.allCounterIds
        });
        // Collect all counter IDs that should receive this order
        // NEW LOGIC: Route based on markable items and KOT counters
        const targetCounterIds: string[] = [];

        console.log('WebSocket Broadcasting - Counter assignments:', {
          allStoreCounterIds,
          allPaymentCounterIds,
          allKotCounterIds,
          totalStoreCounters: allStoreCounterIds.length,
          totalPaymentCounters: allPaymentCounterIds.length,
          totalKotCounters: allKotCounterIds.length,
          hasMarkableItem,
          hasMarkableItemWithKot,
          orderNumber: order.orderNumber
        });

        // Always add payment counter IDs (for payment processing)
        allPaymentCounterIds.forEach(counterId => {
          targetCounterIds.push(counterId);
          console.log(`🔍 Added payment counter to broadcast: ${counterId}`);
        });

        // Routing logic for markable items:
        // 1. If markable items have KOT counters -> broadcast to BOTH KOT and store counters
        //    (Store counters will show order but disable buttons until KOT marks ready)
        // 2. If markable items don't have KOT counters -> broadcast to store counters directly
        // 3. Non-markable items always go to store counters
        if (hasMarkableItem) {
          if (hasMarkableItemWithKot && allKotCounterIds.length > 0) {
            // Markable items with KOT counters -> send to BOTH KOT and store counters
            allKotCounterIds.forEach(counterId => {
              targetCounterIds.push(counterId);
              console.log(`🔍 Added KOT counter to broadcast (markable items with KOT): ${counterId}`);
            });
            // Also send to store counters (they'll show order but disable buttons)
            allStoreCounterIds.forEach(counterId => {
              targetCounterIds.push(counterId);
              console.log(`🔍 Added store counter to broadcast (markable items with KOT - for visibility): ${counterId}`);
            });
            console.log(`📋 Order ${order.orderNumber}: Markable items have KOT counters - routing to BOTH KOT and store counters`);
          } else {
            // Markable items without KOT counters -> send directly to store counters
            allStoreCounterIds.forEach(counterId => {
              targetCounterIds.push(counterId);
              console.log(`🔍 Added store counter to broadcast (markable items without KOT): ${counterId}`);
            });
            console.log(`📋 Order ${order.orderNumber}: Markable items without KOT counters - routing directly to store counters`);
          }
        } else {
          // No markable items -> send to store counters directly
          allStoreCounterIds.forEach(counterId => {
            targetCounterIds.push(counterId);
            console.log(`🔍 Added store counter to broadcast (no markable items): ${counterId}`);
          });
          console.log(`📋 Order ${order.orderNumber}: No markable items - routing directly to store counters`);
        }

        // Also add KOT counters for non-markable items that might have KOT assignments
        // (in case there are non-markable items with KOT counters)
        if (!hasMarkableItem) {
          allKotCounterIds.forEach(counterId => {
            if (!targetCounterIds.includes(counterId)) {
              targetCounterIds.push(counterId);
              console.log(`🔍 Added KOT counter to broadcast (non-markable items): ${counterId}`);
            }
          });
        }

        // Remove duplicates
        const uniqueCounterIds = Array.from(new Set(targetCounterIds));

        if (uniqueCounterIds.length > 0) {
          // Broadcast to specific counter rooms
          // Items already have counter IDs attached, so just parse and send them
          // Determine message type: offline orders with pending payment get special type
          const isOfflinePendingPayment = order.isOffline === true &&
            (order.paymentStatus === 'pending' || order.status === 'pending_payment');

          const orderMessage = {
            type: isOfflinePendingPayment ? 'new_offline_order' : 'new_order',
            data: {
              ...order,
              // Ensure counter arrays are included in the WebSocket message
              allStoreCounterIds,
              allPaymentCounterIds,
              allKotCounterIds,
              allCounterIds,
              // Items already have storeCounterId, paymentCounterId, and kotCounterId attached
              items: orderItems
            }
          };

          console.log(`📢 Broadcasting order ${order.orderNumber} to counter rooms:`, {
            targetCounterIds: uniqueCounterIds,
            allStoreCounterIds,
            allPaymentCounterIds,
            allKotCounterIds,
            itemsWithCounters: orderItems.map((item: any) => ({
              id: item.id,
              name: item.name,
              storeCounterId: item.storeCounterId,
              paymentCounterId: item.paymentCounterId,
              kotCounterId: item.kotCounterId
            }))
          });

          wsManager.broadcastToCounters(uniqueCounterIds, orderMessage.type, orderMessage.data);
          console.log(`📢 Order ${order.orderNumber} broadcasted to counter rooms: ${uniqueCounterIds.join(', ')}`);
        } else {
          // Fallback: broadcast to canteen room if no specific counters assigned
          console.log(`📢 No specific counters assigned for order ${order.orderNumber}, broadcasting to canteen room ${order.canteenId}`);
          wsManager.broadcastNewOrder(order.canteenId, order);
          console.log(`📢 Order ${order.orderNumber} broadcasted to canteen room ${order.canteenId} (no specific counters assigned)`);
        }
      } else {
        console.log('📡 WebSocket manager not available for broadcast');
      }

      // Delivery person assignment is now done manually from store counter
      // Removed automatic assignment logic

      // Mark checkout session as completed if exists
      if (req.body.checkoutSessionId) {
        await CheckoutSessionService.updateStatus(req.body.checkoutSessionId, 'completed');
        console.log(`✅ Checkout session ${req.body.checkoutSessionId} marked as completed for order ${order.orderNumber}`);
      }

      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);

      // Cancel payment session on error if exists
      if (req.body.sessionId) {
        try {
          await PaymentSessionService.cancelSession(req.body.sessionId);
          console.log(`❌ Cancelled payment session ${req.body.sessionId} due to order creation error`);
        } catch (cancelError) {
          console.error('Error cancelling session:', cancelError);
        }
      }

      if (error instanceof Error && error.message.includes('Stock validation failed')) {
        return res.status(400).json({
          message: "Order cannot be processed due to stock issues",
          errors: [error.message]
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Order cancellation endpoint with stock restoration
  app.post("/api/orders/:id/cancel", async (req, res) => {
    try {
      const orderId = req.params.id;
      console.log(`🚫 POST /api/orders/${orderId}/cancel - Cancelling order`);
      const order = await storage.getOrder(orderId);
      if (!order) {
        console.log(`❌ Order ${orderId} not found for cancellation`);
        return res.status(404).json({ message: "Order not found" });
      }

      console.log(`📦 Order ${order.orderNumber} current status: ${order.status}`);

      // Check if order can be cancelled
      if (order.status === 'delivered' || order.status === 'cancelled') {
        console.log(`❌ Cannot cancel order ${order.orderNumber} - status is ${order.status}`);
        return res.status(400).json({
          message: `Cannot cancel order with status: ${order.status}`
        });
      }

      // Restore stock for the cancelled order
      console.log(`🔄 Restoring stock for cancelled order ${order.orderNumber}`);
      await stockService.restoreStockForOrder(orderId);

      // Update order status to cancelled
      const updatedOrder = await storage.updateOrder(req.params.id, {
        status: 'cancelled',
        deliveredAt: new Date() // Track cancellation time
      });

      // Send push notification to customer about cancellation
      try {
        const customer = await storage.getUser(order.customerId);
        if (customer) {
          await webPushService.sendOrderUpdate(
            customer.id.toString(),
            order.orderNumber,
            "cancelled",
            `Your order #${order.orderNumber} has been cancelled. If you have any questions, please contact us.`
          );
          console.log(`🔔 Cancellation notification sent to customer ${customer.email} for order ${order.orderNumber}`);
        }
      } catch (pushError) {
        console.error(`❌ Failed to send cancellation notification for order ${order.orderNumber}:`, pushError instanceof Error ? pushError.message : 'Unknown push notification error');
      }

      // Broadcast cancellation via WebSocket to canteen-specific room
      const wsManager = getWebSocketManager();
      if (wsManager) {
        wsManager.broadcastOrderStatusUpdate(
          updatedOrder.canteenId,
          updatedOrder,
          'active',
          'cancelled'
        );
        console.log(`📢 Successfully broadcasted cancellation for order ${updatedOrder.orderNumber} to canteen room ${updatedOrder.canteenId}`);
      } else {
        console.log('📡 WebSocket manager not available for cancellation broadcast');
      }

      console.log(`🚫 Order ${order.orderNumber} cancelled and stock restored`);
      res.json({
        message: "Order cancelled successfully",
        order: updatedOrder
      });
    } catch (error) {
      console.error("Error cancelling order:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Stock status endpoint
  app.get("/api/stock/status", async (req, res) => {
    try {
      const { itemIds } = req.query;
      console.log(`📋 GET /api/stock/status - Checking stock for items:`, itemIds);
      if (!itemIds) {
        console.log(`❌ itemIds query parameter is required`);
        return res.status(400).json({ message: "itemIds query parameter is required" });
      }

      const ids = Array.isArray(itemIds) ? itemIds : [itemIds];
      const stockStatus = await stockService.getStockStatus(ids as string[]);
      console.log(`✅ Stock status retrieved for ${ids.length} items`);
      res.json(stockStatus);
    } catch (error) {
      console.error("❌ Error getting stock status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/orders/:id", async (req, res) => {
    try {
      const orderId = req.params.id;
      console.log(`🔄 PUT /api/orders/${orderId} - Updating order`, { status: req.body.status, paymentStatus: req.body.paymentStatus });

      // Get order before update to check if it has a delivery person
      const oldOrder = await storage.getOrder(orderId);

      const order = await storage.updateOrder(orderId, req.body);
      console.log(`✅ Order ${order.orderNumber} updated successfully`);

      // If order status changed to "delivered", mark delivery person as available again
      if (req.body.status === 'delivered' && oldOrder?.deliveryPersonId) {
        try {
          const { db } = await import('./db');
          const database = db();
          const deliveryPerson = await database.deliveryPerson.findFirst({
            where: { deliveryPersonId: oldOrder.deliveryPersonId }
          });

          if (deliveryPerson) {
            await database.deliveryPerson.update({
              where: { id: deliveryPerson.id },
              data: { isAvailable: true }
            });
            console.log(`✅ Marked delivery person ${oldOrder.deliveryPersonId} as available after delivery`);
          }
        } catch (error) {
          console.error('❌ Error marking delivery person as available:', error);
          // Don't fail the order update if this fails
        }
      }

      res.json(order);
    } catch (error) {
      console.error(`❌ Error updating order ${req.params.id}:`, error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Mark order as seen by staff/admin
  app.patch("/api/orders/:id/mark-seen", async (req, res) => {
    try {
      const orderId = req.params.id;
      const { userId } = req.body;
      console.log(`👁️ PATCH /api/orders/${orderId}/mark-seen - User ${userId} marking order as seen`);
      if (!userId) {
        console.log(`❌ User ID is required for marking order as seen`);
        return res.status(400).json({ message: "User ID is required" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        console.log(`❌ Order ${orderId} not found`);
        return res.status(404).json({ message: "Order not found" });
      }

      // Add user ID to seenBy array if not already present
      const seenBy = order.seenBy || [];
      if (!seenBy.includes(userId)) {
        seenBy.push(userId);
        const updatedOrder = await storage.updateOrder(orderId, { seenBy: seenBy });
        console.log(`✅ Order ${order.orderNumber} marked as seen by user ${userId}`);
        res.json(updatedOrder);
      } else {
        console.log(`ℹ️ Order ${order.orderNumber} already seen by user ${userId}`);
        res.json(order); // Already seen by this user
      }
    } catch (error) {
      console.error("Error marking order as seen:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const orderId = req.params.id;
      console.log(`🔄 PATCH /api/orders/${orderId} - Updating order with data:`, req.body);
      const order = await storage.updateOrder(orderId, req.body);
      console.log(`✅ Order ${order.orderNumber} updated successfully`);

      // Send push notification to customer when status changes
      if (req.body.status && order.customerId) {
        try {
          // Get customer details for the notification
          const customer = await storage.getUser(order.customerId);
          if (customer) {
            // Send push notification based on the new status
            await webPushService.sendOrderUpdate(
              customer.id.toString(),
              order.orderNumber,
              req.body.status,
              // Optional custom message can be passed from the request
              req.body.notificationMessage
            );
            console.log(`🔔 Push notification sent to customer ${customer.email} for order ${order.orderNumber} (status: ${req.body.status})`);
          } else {
            console.warn(`⚠️  Customer not found for order ${order.orderNumber} (customerId: ${order.customerId})`);
          }
        } catch (pushError) {
          // Don't fail the order update if push notification fails
          console.error(`❌ Failed to send push notification for order ${order.orderNumber}:`, pushError instanceof Error ? pushError.message : 'Unknown push notification error');
        }
      }

      // Broadcast order status update via WebSocket to canteen-specific room
      if (req.body.status) {
        const wsManager = getWebSocketManager();
        if (wsManager) {
          wsManager.broadcastOrderStatusUpdate(
            order.canteenId,
            order,
            req.body.oldStatus || 'unknown',
            req.body.status
          );
          console.log(`📢 Successfully broadcasted status change for ${order.orderNumber} to canteen room ${order.canteenId}`);
        } else {
          console.log('📡 WebSocket manager not available for status broadcast');
        }
      } else {
        console.log('📡 No status change to broadcast');
      }

      res.json(order);
    } catch (error) {
      console.error("Error updating order:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete order endpoint (Developer mode only)
  app.delete("/api/orders/:id", async (req, res) => {
    try {
      // Only allow in development mode
      if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ message: "Order deletion is only available in development mode" });
      }

      const orderId = req.params.id;
      console.log(`🗑️ DELETE /api/orders/${orderId} - Deleting order in development mode`);

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Delete the order
      const deleted = await storage.deleteOrder(orderId);
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete order" });
      }

      console.log(`🗑️ Successfully deleted order ${order.orderNumber} (ID: ${orderId})`);
      res.status(204).send(); // No content response for successful deletion
    } catch (error) {
      console.error("Error deleting order:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Notifications endpoints
  app.get("/api/notifications", async (req, res) => {
    try {
      const notifications = await storage.getNotifications();
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      const validatedData = insertNotificationSchema.parse(req.body);
      // Add default canteen_id
      const notificationData = {
        ...validatedData,
        canteenId: validatedData.canteenId // Remove hardcoded fallback
      };
      const notification = await storage.createNotification(notificationData);
      res.status(201).json(notification);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/notifications/:id", async (req, res) => {
    try {
      const notification = await storage.updateNotification(req.params.id, req.body);
      res.json(notification);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      await storage.deleteNotification(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });



  // Barcode delivery endpoints
  app.post("/api/delivery/scan", async (req, res) => {
    try {
      const { barcode } = req.body;
      if (!barcode) {
        return res.status(400).json({ message: "Barcode is required" });
      }

      console.log("Scanning barcode/OTP:", barcode);

      // Find order by barcode (supports full barcode or 4-digit OTP)
      let order = await storage.getOrderByBarcode(barcode);

      // If not found by barcode, try to find by order number (12-digit numeric format)
      if (!order && barcode.match(/^\d{12}$/)) {
        order = await storage.getOrderByOrderNumber(barcode);
      }

      // If still not found and it's a 4-digit OTP, try searching by first 4 digits of order number
      if (!order && barcode.length === 4 && /^\d{4}$/.test(barcode)) {
        const regex = new RegExp('^' + barcode);
        const { Order } = await import('./models/mongodb-models');
        const foundOrder = await Order.findOne({ orderNumber: regex });
        if (foundOrder) {
          order = mongoToPlain(foundOrder);
        }
      }

      if (!order) {
        return res.status(404).json({
          message: "Invalid barcode. No order found.",
          error: "BARCODE_NOT_FOUND"
        });
      }

      // Check if barcode was already used
      if (order.barcodeUsed) {
        return res.status(400).json({
          message: "🔒 This order has already been delivered.",
          error: "BARCODE_ALREADY_USED",
          deliveredAt: order.deliveredAt
        });
      }

      // Check if order is ready for pickup
      if (order.status !== "ready") {
        return res.status(400).json({
          message: `Order is not ready for pickup. Current status: ${order.status}`,
          error: "ORDER_NOT_READY"
        });
      }

      // Update order to delivered and mark barcode as used
      const updatedOrder = await storage.updateOrder(order.id, {
        status: "delivered",
        barcodeUsed: true,
        deliveredAt: new Date()
      });

      console.log("Order delivered successfully:", updatedOrder);

      // Send push notification to customer about delivery completion
      try {
        const customer = await storage.getUser(order.customerId);
        if (customer) {
          await webPushService.sendOrderUpdate(
            customer.id.toString(),
            order.orderNumber,
            "delivered",
            `Your order #${order.orderNumber} has been successfully delivered. Thank you for your order!`
          );
          console.log(`🔔 Delivery notification sent to customer ${customer.email} for order ${order.orderNumber}`);
        }
      } catch (pushError) {
        console.error(`❌ Failed to send delivery notification for order ${order.orderNumber}:`, pushError instanceof Error ? pushError.message : 'Unknown push notification error');
      }

      res.json({
        success: true,
        message: "Order delivered successfully!",
        order: updatedOrder
      });
    } catch (error) {
      console.error("Error processing barcode scan:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/delivery/verify/:barcode", async (req, res) => {
    try {
      const { barcode } = req.params;
      console.log(`🔍 GET /api/delivery/verify/${barcode} - Verifying barcode`);

      const order = await storage.getOrderByBarcode(barcode);
      if (!order) {
        console.log(`❌ Barcode ${barcode} not found`);
        return res.status(404).json({
          valid: false,
          message: "Invalid barcode"
        });
      }

      console.log(`✅ Barcode ${barcode} verified - Order: ${order.orderNumber}, Status: ${order.status}`);
      res.json({
        valid: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          status: order.status,
          barcodeUsed: order.barcodeUsed,
          deliveredAt: order.deliveredAt,
          amount: order.amount
        }
      });
    } catch (error) {
      console.error("❌ Error verifying barcode:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin analytics endpoint
  app.get("/api/admin/analytics", async (req, res) => {
    try {
      console.log(`📋 GET /api/admin/analytics - Fetching admin analytics`);
      const orders = await storage.getOrders();
      const menuItems = await storage.getMenuItems();

      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((sum, order) => sum + order.amount, 0);
      const activeMenuItems = menuItems.filter(item => item.available).length;
      const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

      console.log(`✅ Analytics calculated - Orders: ${totalOrders}, Revenue: ${totalRevenue}, Active Items: ${activeMenuItems}`);
      res.json({
        totalOrders,
        totalRevenue,
        activeMenuItems,
        averageOrderValue
      });
    } catch (error) {
      console.error("❌ Error fetching admin analytics:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get media banners for a specific canteen (admin only)
  app.get("/api/media-banners/canteen/:canteenId", async (req, res) => {
    try {
      const canteenId = req.params.canteenId;
      console.log(`🖼️ GET /api/media-banners/canteen/${canteenId} - Fetching banners`);

      const banners = await mediaService.getBannersByCanteen(canteenId);
      console.log(`✅ Found ${banners.length} banners for canteen ${canteenId}`);

      res.json(banners);
    } catch (error) {
      console.error(`❌ Error fetching banners for canteen ${req.params.canteenId}:`, error);
      res.status(500).json({ message: "Failed to fetch banners" });
    }
  });

  // Media Banner endpoints
  app.get("/api/media-banners", async (req, res) => {
    try {
      // Check if this is an admin request based on query parameter or user role
      const isAdmin = req.query.admin === 'true';
      console.log(`📋 GET /api/media-banners - Admin: ${isAdmin}`);

      const banners = isAdmin
        ? await mediaService.getAllBannersForAdmin()
        : await mediaService.getGlobalBanners();

      console.log(`✅ Successfully fetched ${banners.length} media banners`);
      res.json(banners);
    } catch (error) {
      console.error("❌ Error fetching media banners:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/media-banners", mediaUpload.single('file'), async (req, res) => {
    try {
      console.log(`📋 POST /api/media-banners - Uploading media banner`);
      if (!req.file) {
        console.log(`❌ No file uploaded for media banner`);
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { originalname, buffer, mimetype } = req.file;
      const uploadedBy = req.body.userId ? parseInt(req.body.userId) : undefined;
      const canteenId = req.body.canteenId;

      console.log(`🖼️ Uploading banner: ${originalname}, size: ${buffer.length} bytes, canteenId: ${canteenId || 'global'}`);

      const banner = await mediaService.uploadFile(
        buffer,
        originalname,
        originalname,
        mimetype,
        uploadedBy,
        canteenId
      );

      // Send WebSocket notification about new banner
      const wsManager = getWebSocketManager();
      if (wsManager) {
        wsManager.broadcastToAll({
          type: 'banner_updated',
          data: { action: 'created', banner }
        });
        console.log('📢 Successfully broadcasted banner creation to all clients');
      } else {
        console.log('📡 WebSocket manager not available for banner broadcast');
      }

      res.status(201).json(banner);
    } catch (error) {
      console.error("Error uploading media banner:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Upload failed" });
    }
  });

  app.get("/api/media-banners/:fileId/file", async (req, res) => {
    try {
      const { fileId } = req.params;

      // Validate fileId
      if (!fileId || fileId === 'undefined' || fileId === 'null') {
        return res.status(400).json({ message: "Invalid file ID" });
      }

      // First, try to find the banner to check if it's a Cloudinary file
      const banner = await MediaBanner.findOne({
        $or: [
          { fileId: new mongoose.Types.ObjectId(fileId) },
          { cloudinaryPublicId: fileId }
        ]
      });

      if (!banner) {
        return res.status(404).json({ message: "File not found" });
      }

      // If it's a Cloudinary file, redirect to the Cloudinary URL
      if (banner.cloudinaryUrl) {
        return res.redirect(banner.cloudinaryUrl);
      }

      // Legacy GridFS handling
      const { stream, metadata } = await mediaService.getFile(fileId);

      res.set({
        'Content-Type': metadata.contentType,
        'Content-Length': metadata.length.toString(),
        'Cache-Control': 'public, max-age=86400', // 24 hours
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error serving media file:", error);
      res.status(404).json({ message: "File not found" });
    }
  });

  app.patch("/api/media-banners/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const updatedBanner = await mediaService.updateBanner(id, updates);

      // Send WebSocket notification about banner update
      const wsManager = getWebSocketManager();
      if (wsManager) {
        wsManager.broadcastToAll({
          type: 'banner_updated',
          data: { action: 'updated', banner: updatedBanner }
        });
        console.log('📢 Successfully broadcasted banner update to all clients');
      } else {
        console.log('📡 WebSocket manager not available for banner broadcast');
      }

      res.json(updatedBanner);
    } catch (error) {
      console.error("Error updating media banner:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Update failed" });
    }
  });

  app.patch("/api/media-banners/:id/toggle", async (req, res) => {
    try {
      const { id } = req.params;

      const updatedBanner = await mediaService.toggleBannerStatus(id);

      // Send WebSocket notification about status toggle
      const wsManager = getWebSocketManager();
      if (wsManager) {
        wsManager.broadcastToAll({
          type: 'banner_updated',
          data: { action: 'toggled', banner: updatedBanner }
        });
        console.log('📢 Successfully broadcasted banner status toggle to all clients');
      } else {
        console.log('📡 WebSocket manager not available for banner broadcast');
      }

      res.json(updatedBanner);
    } catch (error) {
      console.error("Error toggling banner status:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Toggle failed" });
    }
  });

  app.patch("/api/media-banners/:id/display-mode", async (req, res) => {
    try {
      const { id } = req.params;
      const { displayMode } = req.body;

      if (!displayMode || !['fit', 'fill'].includes(displayMode)) {
        return res.status(400).json({ message: "Display mode must be 'fit' or 'fill'" });
      }

      const updatedBanner = await mediaService.updateBanner(id, { displayMode });

      // Send WebSocket notification about display mode update
      const wsManager = getWebSocketManager();
      if (wsManager) {
        wsManager.broadcastToAll({
          type: 'banner_updated',
          data: { action: 'display_mode_updated', banner: updatedBanner }
        });
        console.log('📢 Successfully broadcasted banner display mode update to all clients');
      } else {
        console.log('📡 WebSocket manager not available for banner broadcast');
      }

      res.json(updatedBanner);
    } catch (error) {
      console.error("Error updating banner display mode:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Update failed" });
    }
  });

  app.delete("/api/media-banners/:id", async (req, res) => {
    try {
      const { id } = req.params;

      await mediaService.deleteFile(id);

      // Send WebSocket notification about banner deletion
      const wsManager = getWebSocketManager();
      if (wsManager) {
        wsManager.broadcastToAll({
          type: 'banner_updated',
          data: { action: 'deleted', bannerId: id }
        });
        console.log('📢 Successfully broadcasted banner deletion to all clients');
      } else {
        console.log('📡 WebSocket manager not available for banner broadcast');
      }

      res.json({ message: "Media banner deleted successfully" });
    } catch (error) {
      console.error("Error deleting media banner:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Delete failed" });
    }
  });

  app.post("/api/media-banners/reorder", async (req, res) => {
    try {
      const { bannerIds } = req.body;

      if (!Array.isArray(bannerIds)) {
        return res.status(400).json({ message: "Banner IDs must be an array" });
      }

      await mediaService.reorderBanners(bannerIds);

      // Send WebSocket notification about banner reordering
      const wsManager = getWebSocketManager();
      if (wsManager) {
        wsManager.broadcastToAll({
          type: 'banner_updated',
          data: { action: 'reordered', bannerIds }
        });
        console.log('📢 Successfully broadcasted banner reordering to all clients');
      } else {
        console.log('📡 WebSocket manager not available for banner broadcast');
      }

      res.json({ message: "Banners reordered successfully" });
    } catch (error) {
      console.error("Error reordering banners:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Reorder failed" });
    }
  });


  // Login Issues endpoints
  app.get("/api/login-issues", async (req, res) => {
    try {
      const issues = await storage.getLoginIssues();
      res.json(issues);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/login-issues/:id", async (req, res) => {
    try {
      const issue = await storage.getLoginIssue(req.params.id);
      if (!issue) {
        return res.status(404).json({ message: "Login issue not found" });
      }
      res.json(issue);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/login-issues", async (req, res) => {
    try {
      const validatedData = insertLoginIssueSchema.parse(req.body);
      const issue = await storage.createLoginIssue(validatedData);
      res.status(201).json(issue);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/login-issues/:id", async (req, res) => {
    try {
      const issueId = req.params.id;
      const { status, adminNotes, resolvedBy } = req.body;

      const updateData: any = {};
      if (status) updateData.status = status;
      if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
      if (resolvedBy !== undefined) updateData.resolvedBy = resolvedBy;
      if (status === "resolved") updateData.resolvedAt = new Date();

      const updatedIssue = await storage.updateLoginIssue(issueId, updateData);
      res.json(updatedIssue);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/login-issues/:id", async (req, res) => {
    try {
      await storage.deleteLoginIssue(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });


  // Razorpay Payment Integration

  // Initiate payment with Razorpay
  app.post("/api/payments/initiate", async (req, res) => {
    try {
      const { amount, customerName, orderData, idempotencyKey } = req.body;

      if (!amount || !customerName || !orderData) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: amount, customerName, orderData"
        });
      }

      // Check for duplicate payment using checkout session
      const customerId = orderData.customerId || 0;
      const canteenId = orderData.canteenId || '';
      const checkoutSessionId = req.body.checkoutSessionId;

      console.log(`🔍 Checking for duplicate payment: Customer ${customerId}, Amount ${amount}, Canteen ${canteenId}, CheckoutSessionId: ${checkoutSessionId || 'none'}`);

      // Validate checkout session exists and is active
      if (!checkoutSessionId) {
        return res.status(400).json({
          success: false,
          message: "Checkout session ID is required"
        });
      }

      const checkoutSession = await CheckoutSessionService.getSession(checkoutSessionId);
      if (!checkoutSession) {
        return res.status(404).json({
          success: false,
          message: "Checkout session not found"
        });
      }

      // Check if session is still active
      const isActive = await CheckoutSessionService.isSessionActive(checkoutSessionId);
      if (!isActive) {
        return res.status(400).json({
          success: false,
          message: "Checkout session has expired or is no longer active"
        });
      }

      // Check for duplicate payment from the same checkout session (primary check)
      const sessionDuplicateCheck = await CheckoutSessionService.checkDuplicatePaymentFromSession(checkoutSessionId);
      if (sessionDuplicateCheck.isDuplicate) {
        console.log(`⚠️ Duplicate payment request blocked for checkout session ${checkoutSessionId}`);

        // If payment was already initiated, return the existing payment details
        if (sessionDuplicateCheck.existingPayment) {
          return res.status(409).json({ // 409 Conflict
            success: false,
            message: "Payment is already in progress for this checkout session. Please complete the existing payment or wait a few moments.",
            errorCode: 'DUPLICATE_PAYMENT_REQUEST',
            existingPayment: sessionDuplicateCheck.existingPayment,
            paymentInitiatedAt: sessionDuplicateCheck.paymentInitiatedAt
          });
        } else {
          return res.status(409).json({ // 409 Conflict
            success: false,
            message: "Payment is already in progress for this checkout session. Please wait a few moments before trying again.",
            errorCode: 'DUPLICATE_PAYMENT_REQUEST'
          });
        }
      }

      // Check for duplicate payment across different sessions (secondary check)
      const duplicateCheck = await checkDuplicatePaymentMiddleware(
        customerId,
        amount,
        canteenId
      );

      if (!duplicateCheck.allowed) {
        console.log(`⚠️ Duplicate payment attempt blocked for customer ${customerId}`);
        return res.status(429).json({ // 429 Too Many Requests
          success: false,
          message: duplicateCheck.message,
          existingSession: duplicateCheck.existingSession,
          errorCode: 'DUPLICATE_PAYMENT_SESSION'
        });
      }

      // Store idempotency key in orderData for tracking
      if (idempotencyKey) {
        orderData.idempotencyKey = idempotencyKey;
      }

      // Generate unique merchant order ID
      const merchantOrderId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Optimized URL generation - cache base URL to avoid repeated detection
      const baseUrl = req.get('host')
        ? `${req.get('x-forwarded-proto') || 'https'}://${req.get('host')}`
        : `http://localhost:${process.env.PORT || '5000'}`;

      const redirectUrl = `${baseUrl}/payment-callback`;

      // Minimal logging for production performance
      console.log(`💰 Payment URLs generated: ${baseUrl}`);

      // Validate Razorpay configuration
      if (!RAZORPAY_CONFIG.KEY_ID || !RAZORPAY_CONFIG.KEY_SECRET) {
        console.error('🚨 Razorpay configuration missing: KEY_ID or KEY_SECRET not set');
        return res.status(500).json({
          success: false,
          message: "Payment gateway configuration error. Please contact support."
        });
      }

      // SCALABILITY FIX: Use job queue for payment processing if Redis is available
      // Falls back to direct processing if Redis is unavailable
      const { isRedisAvailable } = await import('./config/redis');
      const redisAvailable = await isRedisAvailable();

      if (redisAvailable) {
        // Use job queue (optimal for high load)
        try {
          const { queuePaymentInitiation, getPaymentQueue } = await import('./queues/paymentQueue');

          // Add payment job to queue
          const paymentJob = await queuePaymentInitiation({
            amount,
            customerName,
            orderData,
            idempotencyKey: idempotencyKey || `payment_${customerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            checkoutSessionId,
            merchantOrderId,
          });

          // Check if queue is available
          if (!paymentJob) {
            throw new Error('Payment queue not available');
          }

          // Wait for job to complete (with timeout)
          const jobTimeout = 30000; // 30 seconds timeout

          try {
            const { paymentQueue } = await import('./queues/paymentQueue') as any;

            const jobResult = await Promise.race([
              paymentJob.waitUntilFinished(paymentQueue.events),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Job timeout')), jobTimeout)
              )
            ]) as any;

            if (!jobResult || !jobResult.success) {
              throw new Error(jobResult?.error || 'Payment processing failed');
            }

            // Return payment details
            return res.json({
              success: true,
              merchantTransactionId: jobResult.merchantTransactionId,
              razorpayOrderId: jobResult.razorpayOrderId,
              keyId: RAZORPAY_CONFIG.KEY_ID,
              amount: jobResult.amount,
              currency: jobResult.currency,
              checkoutSessionId: checkoutSessionId
            });
          } catch (timeoutError: any) {
            // Job is still processing, return job ID for polling
            if (timeoutError.message === 'Job timeout') {
              return res.status(202).json({
                success: true,
                message: 'Payment processing started',
                jobId: paymentJob.id,
                status: 'processing',
                pollUrl: `/api/payments/job-status/${paymentJob.id}`
              });
            }
            throw timeoutError;
          }
        } catch (queueError) {
          // If queue fails, fall back to direct processing
          console.warn('⚠️ Payment queue unavailable, falling back to direct processing:', queueError);
        }
      }

      // FALLBACK: Direct payment processing (when Redis unavailable or queue fails)
      // Fallback to direct processing when Redis unavailable
      console.log('🔄 Processing payment directly (Redis unavailable or queue failed)');

      // Create Razorpay order directly
      const razorpayOrder = await createRazorpayOrder(
        amount,
        'INR',
        merchantOrderId,
        {
          customerName,
          canteenId: orderData.canteenId || '',
          checkoutSessionId: checkoutSessionId
        }
      );

      console.log(`💰 Razorpay order created: ${razorpayOrder.id}`);

      // Update checkout session status to payment_initiated
      await CheckoutSessionService.updateStatus(
        checkoutSessionId,
        'payment_initiated',
        {
          ...orderData,
          razorpayOrderId: razorpayOrder.id,
          merchantTransactionId: merchantOrderId,
          amount: amount,
          idempotencyKey: idempotencyKey || null,
          paymentInitiatedAt: new Date().toISOString()
        }
      );

      // Store payment record
      await storage.createPayment({
        merchantTransactionId: merchantOrderId,
        amount: amount * 100, // Store in paise
        status: PAYMENT_STATUS.PENDING,
        canteenId: orderData.canteenId,
        checksum: '',
        metadata: JSON.stringify({
          ...orderData,
          razorpayOrderId: razorpayOrder.id,
          checkoutSessionId: checkoutSessionId,
          idempotencyKey: idempotencyKey || null
        })
      });

      res.json({
        success: true,
        merchantTransactionId: merchantOrderId,
        razorpayOrderId: razorpayOrder.id,
        keyId: RAZORPAY_CONFIG.KEY_ID,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        checkoutSessionId: checkoutSessionId
      });
    } catch (error) {
      console.error('Payment initiation error:', error);

      // Update checkout session status on error
      const checkoutSessionId = req.body.checkoutSessionId;
      if (checkoutSessionId) {
        try {
          await CheckoutSessionService.updateStatus(checkoutSessionId, 'payment_failed');
          console.log(`❌ Updated checkout session ${checkoutSessionId} to payment_failed due to error`);
        } catch (updateError) {
          console.error('Error updating checkout session status:', updateError);
        }
      }

      // Handle Razorpay errors
      if ((error as any).error) {
        console.error('🚨 Razorpay API error:', (error as any).error);
        return res.status(502).json({
          success: false,
          message: `Payment gateway error: ${(error as any).error?.description || 'Service unavailable'}`
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error during payment initiation"
      });
    }
  });

  // POS UPI Payment Initiation (for canteen owners using POS billing)
  app.post("/api/pos/payments/initiate", async (req, res) => {
    try {
      const { amount, customerName, cart, canteenId, checkoutSessionId, totals } = req.body;

      if (!amount || !customerName || !cart || !canteenId || !checkoutSessionId) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: amount, customerName, cart, canteenId, checkoutSessionId"
        });
      }

      // Validate checkout session exists and is active
      const checkoutSession = await CheckoutSessionService.getSession(checkoutSessionId);
      if (!checkoutSession) {
        return res.status(404).json({
          success: false,
          message: "Checkout session not found"
        });
      }

      // Check if session is still active
      const isActive = await CheckoutSessionService.isSessionActive(checkoutSessionId);
      if (!isActive) {
        return res.status(400).json({
          success: false,
          message: "Checkout session has expired or is no longer active"
        });
      }

      // Check for duplicate payment from the same checkout session
      const sessionDuplicateCheck = await CheckoutSessionService.checkDuplicatePaymentFromSession(checkoutSessionId);
      if (sessionDuplicateCheck.isDuplicate) {
        console.log(`⚠️ Duplicate POS payment request blocked for checkout session ${checkoutSessionId}`);

        if (sessionDuplicateCheck.existingPayment) {
          return res.status(409).json({
            success: false,
            message: "Payment is already in progress for this checkout session.",
            errorCode: 'DUPLICATE_PAYMENT_REQUEST',
            existingPayment: sessionDuplicateCheck.existingPayment
          });
        } else {
          return res.status(409).json({
            success: false,
            message: "Payment is already in progress for this checkout session.",
            errorCode: 'DUPLICATE_PAYMENT_REQUEST'
          });
        }
      }

      // Generate unique merchant order ID
      const merchantOrderId = `POS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Validate Razorpay configuration
      if (!RAZORPAY_CONFIG.KEY_ID || !RAZORPAY_CONFIG.KEY_SECRET) {
        console.error('🚨 Razorpay configuration missing: KEY_ID or KEY_SECRET not set');
        return res.status(500).json({
          success: false,
          message: "Payment gateway configuration error. Please contact support."
        });
      }

      // Create Razorpay order
      const razorpayOrder = await createRazorpayOrder(
        amount,
        'INR',
        merchantOrderId,
        {
          customerName,
          canteenId: canteenId,
          checkoutSessionId: checkoutSessionId,
          orderType: 'pos'
        }
      );

      console.log(`💰 POS Razorpay order created: ${razorpayOrder.id}`);

      // Update checkout session status to payment_initiated
      await CheckoutSessionService.updateStatus(
        checkoutSessionId,
        'payment_initiated',
        {
          razorpayOrderId: razorpayOrder.id,
          merchantTransactionId: merchantOrderId,
          amount: amount,
          customerName: customerName,
          cart: cart,
          totals: totals,
          canteenId: canteenId,
          orderType: 'pos',
          paymentInitiatedAt: new Date().toISOString()
        }
      );

      // Store payment record
      await storage.createPayment({
        merchantTransactionId: merchantOrderId,
        amount: amount * 100,
        status: PAYMENT_STATUS.PENDING,
        canteenId: canteenId,
        checksum: '',
        metadata: JSON.stringify({
          customerName,
          canteenId,
          checkoutSessionId,
          razorpayOrderId: razorpayOrder.id,
          orderType: 'pos',
          cart: cart,
          totals: totals
        })
      });

      res.json({
        success: true,
        merchantTransactionId: merchantOrderId,
        razorpayOrderId: razorpayOrder.id,
        keyId: RAZORPAY_CONFIG.KEY_ID,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        checkoutSessionId: checkoutSessionId,
        qrCodeUrl: `upi://pay?pa=${RAZORPAY_CONFIG.KEY_ID}@razorpay&pn=Merchant&am=${amount}&cu=INR&tn=Order%20${merchantOrderId}`
      });
    } catch (error) {
      console.error('POS Payment initiation error:', error);

      const checkoutSessionId = req.body.checkoutSessionId;
      if (checkoutSessionId) {
        try {
          await CheckoutSessionService.updateStatus(checkoutSessionId, 'payment_failed');
        } catch (updateError) {
          console.error('Error updating checkout session status:', updateError);
        }
      }

      if ((error as any).error) {
        return res.status(502).json({
          success: false,
          message: `Payment gateway error: ${(error as any).error?.description || 'Service unavailable'}`
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error during payment initiation"
      });
    }
  });

  // POS Order Creation After Payment Success
  app.post("/api/pos/orders/create", async (req, res) => {
    try {
      const { checkoutSessionId, paymentId, razorpayOrderId, razorpaySignature } = req.body;

      if (!checkoutSessionId || !paymentId || !razorpayOrderId) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: checkoutSessionId, paymentId, razorpayOrderId"
        });
      }

      // Verify payment signature
      const isValid = verifyPaymentSignature(razorpayOrderId, paymentId, razorpaySignature);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment signature"
        });
      }

      // Get checkout session to retrieve cart and order data
      const session = await CheckoutSessionService.getSession(checkoutSessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: "Checkout session not found"
        });
      }

      // Parse metadata to get order details
      const metadata = session.metadata ? JSON.parse(session.metadata) : {};
      const { cart, totals, customerName, canteenId } = metadata;

      if (!cart || !totals || !customerName || !canteenId) {
        return res.status(400).json({
          success: false,
          message: "Incomplete order data in checkout session"
        });
      }

      // Generate unique order number and barcode
      const orderNumber = generateOrderNumber();
      const barcode = generateOrderNumber();

      // Map to consistent structure
      const rawItems = cart.map((item: any) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      }));

      // Enrich items via OrderService
      const enriched = await orderService.enrichOrderItems(rawItems);

      // Determine order status
      const paymentStatus = 'paid';
      const orderStatus = enriched.hasMarkableItem ? "pending" : "ready";

      // Fetch payment details from Razorpay to get payment method
      let paymentMethod = 'online'; // Default to 'online'
      try {
        const razorpayPayment = await razorpay.payments.fetch(paymentId);
        paymentMethod = razorpayPayment.method || 'online';
        console.log(`💳 POS Payment method: ${paymentMethod}`);
      } catch (error) {
        console.error('❌ Failed to fetch Razorpay payment details:', {
          message: (error as any)?.message,
          code: (error as any)?.code,
          status: (error as any)?.statusCode
        });

      }

      // Calculate charges
      const charges = await orderService.calculateCharges(canteenId, totals);

      // Construct order data
      const orderData = {
        customerName,
        collegeName: 'POS Order',
        canteenId,
        customerId: 0,
        items: JSON.stringify(enriched.enrichedItems),
        amount: totals.total,
        itemsSubtotal: totals.subtotal,
        taxAmount: totals.tax || 0,
        chargesTotal: charges.chargesTotal,
        chargesApplied: charges.chargesApplied.length > 0 ? charges.chargesApplied : undefined,
        originalAmount: totals.subtotal,
        discountAmount: totals.discount,
        status: orderStatus,
        orderNumber: orderNumber,
        barcode: barcode,
        estimatedTime: 15,
        isOffline: false,
        isCounterOrder: true,
        paymentStatus,
        paymentMethod,
        orderType: 'takeaway',
        allStoreCounterIds: enriched.allStoreCounterIds,
        allPaymentCounterIds: enriched.allPaymentCounterIds,
        allKotCounterIds: enriched.allKotCounterIds,
        allCounterIds: enriched.allCounterIds,
        itemStatusByCounter: enriched.itemStatusByCounter,
        metadata: JSON.stringify({
          orderType: 'pos',
          checkoutSessionId,
          paymentId,
          razorpayOrderId,
          paymentMethod
        })
      };

      // Create Order via Service
      const order = await orderService.createOrder({
        orderData: insertOrderSchema.parse(orderData),
        orderItems: enriched.enrichedItems,
        checkoutSessionId,
        merchantTransactionId: metadata.merchantTransactionId,
        paymentId,
        isPos: true
      });

      console.log(`✅ POS Order ${orderNumber} created successfully with payment ${paymentId}`);

      // Update payment status (Specific to POS Flow)
      if (metadata.merchantTransactionId) {
        await storage.updatePaymentByMerchantTxnId(metadata.merchantTransactionId, {
          status: PAYMENT_STATUS.SUCCESS,
          metadata: JSON.stringify({
            ...metadata,
            orderId: order.id,
            orderNumber: orderNumber,
            paymentId: paymentId
          })
        });
      }

      res.json({
        success: true,
        order: {
          id: order.id,
          orderNumber: orderNumber,
          barcode: barcode,
          status: orderStatus,
          amount: totals.total,
          customerName: customerName
        }
      });
    } catch (error) {
      console.error('❌ Failed to fetch Razorpay payment details:', {
        message: (error as any)?.message,
        code: (error as any)?.code,
        status: (error as any)?.statusCode
      });

      res.status(500).json({
        success: false,
        message: "Internal server error during order creation"
      });
    }
  });

  // POS Offline Order Creation
  app.post("/api/pos/orders/create-offline", async (req, res) => {
    try {
      const { checkoutSessionId, customerName, cart, canteenId, totals } = req.body;

      if (!checkoutSessionId || !customerName || !cart || !canteenId || !totals) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: checkoutSessionId, customerName, cart, canteenId, totals"
        });
      }

      // Get checkout session
      const session = await CheckoutSessionService.getSession(checkoutSessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: "Checkout session not found"
        });
      }

      // Generate unique order number and barcode
      const orderNumber = generateOrderNumber();
      const barcode = generateOrderNumber();

      // Map to consistent structure
      const rawItems = cart.map((item: any) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      }));

      // Enrich items via OrderService
      const enriched = await orderService.enrichOrderItems(rawItems);

      // Determine order status and payment status
      const paymentStatus = 'paid';
      const orderStatus = enriched.hasMarkableItem ? "pending" : "ready";

      // Offline orders (cash) do NOT include canteen charges (as per original logic)
      const chargesTotal = 0;
      const chargesApplied: any[] = [];

      const orderData = {
        customerName,
        collegeName: 'POS Order',
        canteenId,
        customerId: 0,
        items: JSON.stringify(enriched.enrichedItems),
        amount: totals.total,
        itemsSubtotal: totals.subtotal,
        taxAmount: totals.tax || 0,
        chargesTotal,
        chargesApplied: undefined,
        originalAmount: totals.subtotal,
        discountAmount: totals.discount,
        status: orderStatus,
        orderNumber,
        barcode,
        estimatedTime: 15,
        isOffline: true,
        isCounterOrder: true,
        paymentStatus,
        paymentMethod: 'offline',
        orderType: 'takeaway',
        allStoreCounterIds: enriched.allStoreCounterIds,
        allPaymentCounterIds: enriched.allPaymentCounterIds,
        allKotCounterIds: enriched.allKotCounterIds,
        allCounterIds: enriched.allCounterIds,
        itemStatusByCounter: enriched.itemStatusByCounter,
        metadata: JSON.stringify({
          orderType: 'pos',
          checkoutSessionId,
          paymentMethod: 'offline'
        })
      };

      // Create Order
      const order = await orderService.createOrder({
        orderData: insertOrderSchema.parse(orderData),
        orderItems: enriched.enrichedItems,
        checkoutSessionId,
        isPos: true
      });

      console.log(`✅ POS Offline Order ${orderNumber} created successfully`);

      res.json({
        success: true,
        order: {
          id: order.id,
          orderNumber: orderNumber,
          barcode: barcode,
          status: orderStatus,
          amount: totals.total,
          customerName: customerName
        }
      });
    } catch (error) {
      console.error('POS Offline Order creation error:', error);
      const errorMessage = error instanceof Error ? error.message : "Internal server error";

      if (errorMessage.includes('Stock validation failed') || errorMessage.includes('Insufficient stock')) {
        return res.status(400).json({
          success: false,
          message: errorMessage
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error during order creation"
      });
    }
  });

  // Create Razorpay QR code for POS billing
  app.post("/api/payments/create-qr", async (req, res) => {
    try {
      const { amount, customerName, canteenId, cart, totals, checkoutSessionId } = req.body;

      if (!amount || !customerName || !canteenId || !cart) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: amount, customerName, canteenId, cart"
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid amount: amount must be greater than 0"
        });
      }

      // Validate Razorpay configuration
      if (!RAZORPAY_CONFIG.KEY_ID || !RAZORPAY_CONFIG.KEY_SECRET) {
        console.error('🚨 Razorpay configuration missing: KEY_ID or KEY_SECRET not set');
        return res.status(500).json({
          success: false,
          message: "Payment gateway configuration error. Please contact support."
        });
      }

      // Generate unique order number and barcode
      const orderNumber = generateOrderNumber();
      const barcode = generateOrderNumber();

      // Prepare order items
      const orderItems = cart.map((item: any) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity
      }));

      // Process each item to add counter IDs
      const storeCounterIds = new Set<string>();
      const paymentCounterIds = new Set<string>();
      const kotCounterIds = new Set<string>();

      // OPTIMIZATION: Run Razorpay API call and menu item batch query in parallel
      const itemIds = orderItems.map((item: any) => item.id);
      const [qrCode, menuItemsFromDb] = await Promise.all([
        createRazorpayQR(
          orderNumber,
          amount,
          'INR',
          `POS Order ${orderNumber}`,
          customerName || 'POS Customer'
        ),
        MenuItem.find({ _id: { $in: itemIds } }).lean()
      ]);

      console.log(`💳 Razorpay QR code created: ${qrCode.id} for order ${orderNumber}`);

      // OPTIMIZATION: Build lookup map from batch query result
      const menuItemMap = new Map(menuItemsFromDb.map((m: any) => [m._id.toString(), m]));

      // Process each item using the batch-fetched data
      for (const item of orderItems) {
        const menuItem = menuItemMap.get(item.id);

        if (menuItem) {
          item.storeCounterId = menuItem.storeCounterId || null;
          item.paymentCounterId = menuItem.paymentCounterId || null;
          item.kotCounterId = menuItem.kotCounterId || null;
          item.isMarkable = menuItem.isMarkable || false;
          item.isVegetarian = menuItem.isVegetarian !== undefined ? menuItem.isVegetarian : true;
          item.categoryId = menuItem.categoryId ? String(menuItem.categoryId) : null;
          item.available = menuItem.available !== undefined ? menuItem.available : true;

          if (menuItem.storeCounterId) storeCounterIds.add(menuItem.storeCounterId);
          if (menuItem.paymentCounterId) paymentCounterIds.add(menuItem.paymentCounterId);
          if (menuItem.kotCounterId) kotCounterIds.add(menuItem.kotCounterId);
        } else {
          item.storeCounterId = null;
          item.paymentCounterId = null;
          item.kotCounterId = null;
          item.isMarkable = false;
          item.isVegetarian = true;
          item.categoryId = null;
          item.available = true;
        }
      }

      // OPTIMIZATION: Extract UPI link from QR image (runs while we prepare order data)
      const upiLinkPromise = extractUpiLinkFromQR(qrCode.image_url);

      const allStoreCounterIds = Array.from(storeCounterIds);
      const allPaymentCounterIds = Array.from(paymentCounterIds);
      const allKotCounterIds = Array.from(kotCounterIds);
      const allCounterIds = Array.from(new Set([...allStoreCounterIds, ...allPaymentCounterIds, ...allKotCounterIds]));

      // Determine if order has markable items
      let hasMarkableItem = false;
      for (const item of orderItems) {
        if (item.isMarkable) {
          hasMarkableItem = true;
          break;
        }
      }

      // QR orders start as pending payment
      const orderStatus = 'pending';

      // Initialize itemStatusByCounter
      const itemStatusByCounter: { [counterId: string]: { [itemId: string]: 'pending' | 'ready' | 'completed' } } = {};
      for (const counterId of allCounterIds) {
        itemStatusByCounter[counterId] = {};
        for (const item of orderItems) {
          itemStatusByCounter[counterId][item.id] = 'pending';
        }
      }

      // Calculate charges from totals (QR payments include charges)
      let chargesTotal = 0;
      let chargesApplied: any[] = [];

      console.log('🔍 [QR] Checking totals for charges calculation:', { totals, hasSubtotal: !!totals?.subtotal, hasTotal: !!totals?.total });

      if (totals && totals.subtotal && totals.total) {
        try {
          console.log(`🔍 [QR] Fetching canteen charges for canteenId: ${canteenId}`);
          const canteenChargesDb = await CanteenCharge.find({ canteenId }).sort({ createdAt: -1 });
          const canteenCharges = canteenChargesDb.map((c: any) => {
            const obj: any = c.toObject ? c.toObject() : c;
            obj.id = obj._id?.toString();
            delete obj._id;
            delete obj.__v;
            return obj;
          });
          console.log(`📊 [QR] Retrieved ${canteenCharges.length} total canteen charges`);

          const activeCharges = canteenCharges.filter((charge: any) => charge.active);
          console.log(`📊 [QR] QR Payment - Found ${activeCharges.length} active canteen charges:`, activeCharges);

          if (activeCharges.length > 0) {
            // Calculate charges and total
            activeCharges.forEach((charge: any) => {
              let chargeAmount = 0;
              if (charge.type === 'percent') {
                chargeAmount = (totals.subtotal * charge.value) / 100;
              } else {
                chargeAmount = charge.value;
              }

              console.log(`  - Processing charge: ${charge.name} (${charge.type}=${charge.value}) = ${chargeAmount}`);

              if (chargeAmount > 0) {
                chargesTotal += chargeAmount;
                chargesApplied.push({
                  name: charge.name,
                  type: charge.type,
                  value: charge.value,
                  amount: chargeAmount
                });
              }
            });

            console.log(`💰 [QR] Calculated chargesTotal: ${chargesTotal}`);
            console.log(`💰 [QR] Calculated chargesApplied: ${JSON.stringify(chargesApplied)}`);
          } else {
            console.warn('⚠️ [QR] No active canteen charges found - order will have no charges');
          }
        } catch (error) {
          console.error('❌ [QR] Error fetching canteen charges:', error);
        }
      } else {
        console.warn('⚠️ [QR] Totals missing or invalid - cannot calculate charges');
      }

      console.log('💰 QR Order Charges Debug:');
      console.log('  - chargesTotal:', chargesTotal);
      console.log('  - chargesApplied:', JSON.stringify(chargesApplied, null, 2));

      // Create order with PENDING payment status
      const order = await storage.createOrder({
        customerName: customerName,
        // collegeName: 'POS Order', // Removed as it is not in InsertOrder schema
        canteenId: canteenId,
        customerId: 0,
        items: JSON.stringify(orderItems),
        amount: totals?.total || amount,
        itemsSubtotal: totals?.subtotal || amount,
        taxAmount: totals?.tax || 0,
        chargesTotal: chargesTotal,
        chargesApplied: chargesApplied.length > 0 ? chargesApplied : undefined,
        originalAmount: totals?.subtotal || amount,
        discountAmount: totals?.discount || 0,
        status: orderStatus,
        orderNumber: orderNumber,
        barcode: barcode,
        estimatedTime: 15,
        isOffline: false,
        isCounterOrder: true,
        paymentStatus: 'PENDING',
        paymentMethod: 'qr',
        qrId: qrCode.id,
        orderType: 'takeaway',
        allStoreCounterIds: allStoreCounterIds,
        allPaymentCounterIds: allPaymentCounterIds,
        allKotCounterIds: allKotCounterIds,
        allCounterIds: allCounterIds,
        itemStatusByCounter: JSON.stringify(itemStatusByCounter),
        metadata: JSON.stringify({
          orderType: 'pos_qr',
          checkoutSessionId: checkoutSessionId,
          paymentMethod: 'qr'
        })
      } as any);

      console.log(`✅ POS QR Order ${orderNumber} created with PENDING payment status`);
      console.log('  - Saved chargesTotal:', order.chargesTotal);
      console.log('  - Saved chargesApplied:', JSON.stringify(order.chargesApplied, null, 2));

      // Store QR code details in payment record
      await storage.createPayment({
        merchantTransactionId: orderNumber,
        amount: amount * 100,
        status: PAYMENT_STATUS.PENDING,
        canteenId: canteenId,
        orderId: order.id,
        checksum: '',
        metadata: JSON.stringify({
          qrCodeId: qrCode.id,
          orderId: order.id,
          orderNumber: orderNumber,
          customerName: customerName,
          canteenId: canteenId,
          checkoutSessionId: checkoutSessionId,
          orderType: 'pos_qr',
          cart: cart,
          totals: totals,
          qrCodeDetails: qrCode
        })
      });

      // Update checkout session if provided
      if (checkoutSessionId) {
        await CheckoutSessionService.updateStatus(
          checkoutSessionId,
          'payment_initiated',
          {
            qrCodeId: qrCode.id,
            orderId: order.id,
            orderNumber: orderNumber,
            merchantTransactionId: orderNumber,
            amount: amount,
            customerName: customerName,
            cart: cart,
            totals: totals,
            canteenId: canteenId,
            orderType: 'pos_qr',
            paymentInitiatedAt: new Date().toISOString()
          }
        );
      }

      // Await the UPI link extraction (started earlier, should be done by now)
      const upiLink = await upiLinkPromise;

      res.json({
        success: true,
        qrId: qrCode.id,
        qrImageUrl: qrCode.image_url,
        upiLink: upiLink,
        qrCodeData: qrCode,
        orderId: order.id,
        orderNumber: orderNumber,
        amount: amount,
        expiresAt: qrCode.close_by,
        status: qrCode.status,
        paymentStatus: 'PENDING'
      });
    } catch (error: any) {
      console.error('QR code creation error:', error);

      const checkoutSessionId = req.body.checkoutSessionId;
      if (checkoutSessionId) {
        try {
          await CheckoutSessionService.updateStatus(checkoutSessionId, 'payment_failed');
        } catch (updateError) {
          console.error('Error updating checkout session status:', updateError);
        }
      }

      if (error.message && error.message.includes('Razorpay QR API Error')) {
        return res.status(502).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error during QR code creation",
        error: error.message || 'Unknown error'
      });
    }
  });

  // Get Razorpay QR code status and update order if payment received
  app.get("/api/payments/qr-status/:qrCodeId", async (req, res) => {
    try {
      const { qrCodeId } = req.params;

      if (!qrCodeId) {
        return res.status(400).json({
          success: false,
          message: "Missing required parameter: qrCodeId"
        });
      }

      // Fetch QR code details
      const qrCode = await fetchRazorpayQR(qrCodeId);

      // Fetch all payments for this QR code
      const payments = await fetchAllRazorpayQRPayments(qrCodeId);

      console.log(`📊 QR code status fetched: ${qrCodeId}, status: ${qrCode.status}, payments: ${payments.count}`);

      // Check if payment was received
      let paymentReceived = false;
      let razorpayPaymentId: string | null = null;

      if (payments.count > 0 && payments.items && payments.items.length > 0) {
        const successfulPayment = payments.items.find((p: any) =>
          p.status === 'captured' || p.status === 'authorized'
        );

        if (successfulPayment) {
          paymentReceived = true;
          razorpayPaymentId = successfulPayment.id;

          // Update order payment status
          const order = await storage.getOrderByQrId(qrCodeId);
          if (order && order.paymentStatus === 'PENDING') {
            await storage.updateOrder(order.id, {
              paymentStatus: 'PAID',
              paymentId: razorpayPaymentId
            } as any);

            // Update payment record
            const paymentRecord = await storage.getPaymentByMetadataField('qrCodeId', qrCodeId);
            if (paymentRecord) {
              await storage.updatePaymentStatus(
                paymentRecord.merchantTransactionId,
                PAYMENT_STATUS.SUCCESS
              );
            }

            // Update checkout session if exists
            const metadata = order.metadata ? JSON.parse(order.metadata) : {};
            if (metadata.checkoutSessionId) {
              await CheckoutSessionService.updateStatus(
                metadata.checkoutSessionId,
                'payment_completed',
                {
                  paymentId: razorpayPaymentId,
                  paymentCompletedAt: new Date().toISOString()
                }
              );
            }

            // Broadcast order update via WebSocket
            const wsManager = getWebSocketManager();
            if (wsManager) {
              const updatedOrder = await storage.getOrder(order.id);
              if (updatedOrder) {
                wsManager.broadcastToCanteen(order.canteenId, 'order_updated', updatedOrder);
                wsManager.broadcastToCanteen(order.canteenId, 'payment_success', {
                  orderNumber: order.orderNumber,
                  orderId: order.id,
                  paymentId: razorpayPaymentId,
                  qrCodeId: qrCodeId
                });

                if (order.allCounterIds) {
                  order.allCounterIds.forEach((counterId: string) => {
                    wsManager.broadcastToCounter(counterId, 'order_updated', updatedOrder);
                    wsManager.broadcastToCounter(counterId, 'payment_success', {
                      orderNumber: order.orderNumber,
                      orderId: order.id,
                      paymentId: razorpayPaymentId,
                      qrCodeId: qrCodeId
                    });
                  });
                }
              }
            }

            console.log(`✅ Order payment updated: ${order.orderNumber} - Payment ID: ${razorpayPaymentId}`);
          }
        }
      }

      // Get order details to include in response
      const order = await storage.getOrderByQrId(qrCodeId);

      res.json({
        success: true,
        qrCode: qrCode,
        payments: payments,
        hasPayment: payments.count > 0,
        paymentReceived: paymentReceived,
        paymentId: razorpayPaymentId,
        status: qrCode.status,
        orderNumber: order?.orderNumber,
        orderId: order?.id
      });
    } catch (error: any) {
      console.error('QR status fetch error:', error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch QR code status",
        error: error.message || 'Unknown error'
      });
    }
  });

  // Close Razorpay QR code
  app.post("/api/payments/qr-close/:qrCodeId", async (req, res) => {
    try {
      const { qrCodeId } = req.params;

      if (!qrCodeId) {
        return res.status(400).json({
          success: false,
          message: "Missing required parameter: qrCodeId"
        });
      }

      // Close the QR code
      const qrCode = await closeRazorpayQR(qrCodeId);

      console.log(`🔒 QR code closed: ${qrCodeId}`);

      res.json({
        success: true,
        qrCode: qrCode,
        message: "QR code closed successfully"
      });
    } catch (error: any) {
      console.error('QR close error:', error);
      res.status(500).json({
        success: false,
        message: "Failed to close QR code",
        error: error.message || 'Unknown error'
      });
    }
  });

  // Razorpay QR webhook handler for payment notifications
  app.post("/api/webhooks/razorpay", async (req, res) => {
    const startTime = Date.now();
    try {
      const receivedSignature = req.headers['x-razorpay-signature'] as string;
      const payload = req.body;

      console.log('📡 Razorpay QR webhook received:', {
        event: payload.event,
        timestamp: new Date().toISOString()
      });

      if (!receivedSignature) {
        console.warn('📡 QR Webhook missing signature');
        return res.status(401).json({ success: false, message: 'Missing signature' });
      }

      // Verify webhook signature
      const payloadString = JSON.stringify(payload);

      if (!verifyWebhookSignature(payloadString, receivedSignature)) {
        console.error('📡 Invalid QR webhook signature - potential security issue');

        // In development/test environment, be more lenient
        if (process.env.NODE_ENV === 'development') {
          console.warn('📡 Proceeding with QR webhook processing despite signature failure in development');
        } else {
          return res.status(401).json({ success: false, message: 'Invalid signature' });
        }
      }

      // Handle Razorpay webhook payload structure
      const event = payload.event;
      const entity = payload.payload?.payment?.entity || payload.payload?.qr_code?.entity;

      if (!entity) {
        console.error('📡 Invalid QR webhook payload structure:', payload);
        return res.status(400).json({ success: false, message: 'Invalid payload structure' });
      }

      console.log('📡 QR Webhook event:', event);

      // Handle payment.captured event for QR code payments
      if (event === 'payment.captured' || event === 'payment.authorized') {
        const razorpayPaymentId = entity.id;
        const paymentStatus = entity.status;
        const paymentMethod = entity.method;
        const notes = entity.notes || {};

        // Extract QR code reference from notes
        const orderId = notes.orderId || notes.reference_id;
        const qrCodeId = entity.qr_code_id;

        console.log('📡 Payment captured:', {
          paymentId: razorpayPaymentId,
          orderId: orderId,
          qrCodeId: qrCodeId,
          status: paymentStatus
        });

        if (!orderId && !qrCodeId) {
          console.log('📡 Standard payment webhook detected (no QR notes) - checking metadata');

          // Try to handle standard payment using metadata (same logic as main webhook)
          // 1. Get payment record to access metadata (since payload entity notes might be limited)
          console.log(`📡 Fetching local payment record for ${razorpayPaymentId} to get metadata`);

          try {
            // Find the payment record using the Razorpay Order ID (order_...)
            // The webhook payload has `entity.order_id` which matches what we stored in metadata.razorpayOrderId
            const razorpayOrderId = entity.order_id;
            let paymentRecord = null;

            if (razorpayOrderId) {
              console.log(`📡 Searching for payment with Razorpay Order ID: ${razorpayOrderId}`);
              paymentRecord = await storage.getPaymentByMetadataField('razorpayOrderId', razorpayOrderId);
            } else {
              // Determine logic if no order_id (e.g. direct QR scan?)
              // In that case, we might need to rely on `notes` if present, or we can't link it.
              // But for standard checkout, order_id is crucial.
              console.log('⚠️ Webhook payload missing order_id - attempting fallback by payment ID (unlikely to work for new ops)');
              paymentRecord = await storage.getPaymentByRazorpayId(razorpayPaymentId);
            }

            if (paymentRecord && paymentRecord.metadata) {
              console.log(`✅ Found local payment record for ${razorpayPaymentId}`);

              // 2. Parse the metadata
              let metadata;
              try {
                metadata = typeof paymentRecord.metadata === 'string'
                  ? JSON.parse(paymentRecord.metadata)
                  : paymentRecord.metadata;
              } catch (e) {
                console.error('❌ Failed to parse payment metadata:', e);
              }

              // 3. Check for cartItems or orderData (saved as flattened object in initiate)
              // In initiate we save: ...orderData, razorpayOrderId, checkoutSessionId
              if (metadata && (metadata.cartItems || metadata.items || metadata.customerId)) {
                console.log('✅ Found order data in local payment metadata - attempting to create order');

                const merchantTransactionId = paymentRecord.merchantTransactionId;

                // Create order using service
                // We pass metadata as orderData since it contains what we saved
                const newOrder = await orderService.createOrderFromPayment(metadata, merchantTransactionId);

                console.log(`✅ Successfully created order ${newOrder.orderNumber} (ID: ${newOrder.id}) via QR Webhook fallback`);
                return res.json({ success: true, message: 'Order created from webhook' });
              } else {
                console.warn('⚠️ Payment record found but missing required order data in metadata');
              }
            } else {
              console.log(`⚠️ No local payment record found for ${razorpayPaymentId}`);
            }

          } catch (error: any) {
            console.error('❌ Error in QR webhook standard payment fallback:', error);
            if (error.message && error.message.includes('Duplicate')) {
              return res.json({ success: true, message: 'Order already exists' });
            }
            // Don't return error, let it fall through to 404
          }
        }

        // Find order by QR ID or order number
        let order = null;

        if (qrCodeId) {
          order = await storage.getOrderByQrId(qrCodeId);
          console.log('📡 Order lookup by QR ID:', { qrCodeId, found: !!order });
        }

        if (!order && orderId) {
          order = await storage.getOrderByOrderNumber(orderId);
          console.log('📡 Order lookup by order number:', { orderId, found: !!order });
        }

        if (!order) {
          console.error('📡 Order not found for payment:', { orderId, qrCodeId });
          return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Check if payment is already processed
        if (order.paymentStatus === 'PAID') {
          console.log('📡 Payment already processed for order:', order.orderNumber);
          return res.status(200).json({
            success: true,
            message: 'Payment already processed'
          });
        }

        // Update order payment status
        await storage.updateOrder(order.id, {
          paymentStatus: 'PAID',
          paymentId: razorpayPaymentId,
          paymentMethod: paymentMethod || 'qr'
        } as any);

        console.log(`✅ Order payment updated via webhook: ${order.orderNumber} - Payment ID: ${razorpayPaymentId}`);

        // Update payment record if exists
        const paymentRecord = await storage.getPaymentByMetadataField('qrCodeId', qrCodeId || '');
        if (!paymentRecord && order.orderNumber) {
          const paymentByOrderNumber = await storage.getPaymentByMerchantTxnId(order.orderNumber);
          if (paymentByOrderNumber) {
            await storage.updatePaymentStatus(order.orderNumber, PAYMENT_STATUS.SUCCESS);
            await storage.updatePaymentByMerchantTxnId(order.orderNumber, {
              razorpayTransactionId: razorpayPaymentId,
              paymentMethod: paymentMethod || 'qr'
            });
          }
        } else if (paymentRecord) {
          await storage.updatePaymentStatus(paymentRecord.merchantTransactionId, PAYMENT_STATUS.SUCCESS);
          await storage.updatePaymentByMerchantTxnId(paymentRecord.merchantTransactionId, {
            razorpayTransactionId: razorpayPaymentId,
            paymentMethod: paymentMethod || 'qr'
          });
        }

        // Update checkout session if exists
        const metadata = order.metadata ? JSON.parse(order.metadata) : {};
        if (metadata.checkoutSessionId) {
          await CheckoutSessionService.updateStatus(
            metadata.checkoutSessionId,
            'payment_completed',
            {
              paymentId: razorpayPaymentId,
              paymentCompletedAt: new Date().toISOString()
            }
          );
        }

        // Broadcast order update via WebSocket
        const wsManager = getWebSocketManager();
        if (wsManager) {
          const updatedOrder = await storage.getOrder(order.id);
          if (updatedOrder) {
            wsManager.broadcastToCanteen(order.canteenId, 'order_updated', updatedOrder);
            wsManager.broadcastToCanteen(order.canteenId, 'payment_success', {
              orderNumber: order.orderNumber,
              paymentId: razorpayPaymentId
            });

            if (order.allCounterIds) {
              order.allCounterIds.forEach((counterId: string) => {
                wsManager.broadcastToCounter(counterId, 'order_updated', updatedOrder);
                wsManager.broadcastToCounter(counterId, 'payment_success', {
                  orderNumber: order.orderNumber,
                  paymentId: razorpayPaymentId
                });
              });
            }
          }
        }

        const processingTime = Date.now() - startTime;
        console.log(`✅ QR webhook processed successfully in ${processingTime}ms`);

        res.status(200).json({
          success: true,
          message: 'Payment processed successfully',
          orderNumber: order.orderNumber
        });
      } else {
        console.log('📡 Unhandled QR webhook event:', event);
        res.status(200).json({
          success: true,
          message: 'Event acknowledged but not processed'
        });
      }
    } catch (error: any) {
      console.error('📡 QR Webhook processing error:', error);
      console.error('📡 Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Webhook processing failed',
        error: error.message || 'Unknown error'
      });
    }
  });

  // Get payment job status (for polling)
  app.get("/api/payments/job-status/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const { paymentQueue } = await import('./queues/paymentQueue') as any;

      const job = await paymentQueue.getJob(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      const state = await job.getState();
      const progress = job.progress;

      if (state === 'completed') {
        const result = await job.returnvalue;
        return res.json({
          success: true,
          status: 'completed',
          result: result
        });
      } else if (state === 'failed') {
        const failedReason = await job.getFailedReason();
        return res.status(500).json({
          success: false,
          status: 'failed',
          error: failedReason
        });
      } else {
        return res.json({
          success: true,
          status: state,
          progress: progress
        });
      }
    } catch (error) {
      console.error('Error getting job status:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting job status'
      });
    }
  });

  // Razorpay webhook handler with production optimizations
  app.post("/api/payments/webhook", async (req, res) => {
    const startTime = Date.now();
    try {
      const receivedSignature = req.headers['x-razorpay-signature'] as string;
      const payload = req.body;

      if (!receivedSignature) {
        console.warn('📡 Webhook missing signature');
        return res.status(401).json({ success: false, message: 'Missing signature' });
      }

      // Verify webhook signature
      const signatureStart = Date.now();
      const payloadString = JSON.stringify(payload);
      console.log('📡 Webhook verification details:', {
        receivedSignature: receivedSignature.substring(0, 20) + '...',
        payloadKeys: Object.keys(payload),
        environment: process.env.NODE_ENV
      });

      if (!verifyWebhookSignature(payloadString, receivedSignature)) {
        console.error('📡 Invalid webhook signature - potential security issue');
        console.log('📡 This might be expected in test/sandbox environment');

        // In development/test environment, we might want to be more lenient
        if (process.env.NODE_ENV === 'development') {
          console.warn('📡 Proceeding with webhook processing despite signature failure in development');
        } else {
          return res.status(401).json({ success: false, message: 'Invalid signature' });
        }
      }
      const signatureTime = Date.now() - signatureStart;
      console.log(`📡 Signature verification took ${signatureTime}ms`);

      // Handle Razorpay webhook payload structure
      const event = payload.event;
      const entity = payload.payload?.payment?.entity || payload.payload?.order?.entity;

      if (!entity) {
        console.error('📡 Invalid webhook payload structure:', payload);
        return res.status(400).json({ success: false, message: 'Invalid payload structure' });
      }

      // Extract payment/order information
      const razorpayPaymentId = entity.id || entity.payment_id;
      const razorpayOrderId = entity.order_id;
      const paymentStatus = entity.status;
      const paymentMethod = entity.method;

      // Find payment by razorpayOrderId in metadata
      let payment = null;
      const payments = await storage.getPayments();
      for (const p of payments) {
        if (p.metadata) {
          try {
            const metadata = JSON.parse(p.metadata);
            if (metadata.razorpayOrderId === razorpayOrderId) {
              payment = p;
              break;
            }
          } catch (e) {
            // Skip invalid metadata
          }
        }
      }

      if (!payment) {
        console.error('📡 Payment not found for order:', razorpayOrderId);
        return res.status(404).json({ success: false, message: 'Payment not found' });
      }

      const merchantTransactionId = payment.merchantTransactionId;

      // Map Razorpay status to our payment status
      let mappedPaymentStatus: string;
      if (paymentStatus === 'captured' || paymentStatus === 'authorized') {
        mappedPaymentStatus = PAYMENT_STATUS.SUCCESS;
      } else if (paymentStatus === 'failed') {
        mappedPaymentStatus = PAYMENT_STATUS.FAILED;
      } else {
        mappedPaymentStatus = PAYMENT_STATUS.PENDING;
      }

      // Update payment record
      await storage.updatePaymentByMerchantTxnId(merchantTransactionId, {
        razorpayTransactionId: razorpayPaymentId,
        status: mappedPaymentStatus,
        paymentMethod: paymentMethod || 'unknown',
        responseCode: paymentStatus,
        responseMessage: entity.error_description || `Payment ${paymentStatus}`
      });

      // Get updated payment after status update
      const updatedPayment = await storage.getPaymentByMerchantTxnId(merchantTransactionId);

      // If payment successful, create order from metadata
      if (mappedPaymentStatus === PAYMENT_STATUS.SUCCESS && (event === 'payment.captured' || event === 'payment.authorized')) {
        if (updatedPayment?.metadata && !updatedPayment.orderId) {
          // Parse order data from metadata
          const orderData = JSON.parse(updatedPayment.metadata);

          // Create order using OrderService
          try {
            const newOrder = await orderService.createOrderFromPayment(orderData, merchantTransactionId);

            if (!newOrder || !newOrder.id) {
              throw new Error('Order creation returned invalid order object');
            }

            console.log(`✅ Successfully created order ${newOrder.orderNumber} (ID: ${newOrder.id}) from Razorpay webhook`);
          } catch (error) {
            console.error('❌ Error creating order from webhook:', error);
            // Don't fail the webhook
          }
        }
      } else if (mappedPaymentStatus === PAYMENT_STATUS.FAILED) {
        // Handle any failed payment event (payment.failed, order.paid with failed status, etc.)
        // If payment failed, create order entry but don't broadcast to counters
        console.log(`📡 Processing failed payment webhook for merchantTransactionId: ${merchantTransactionId}, event: ${event}`);

        if (updatedPayment?.metadata && !updatedPayment.orderId) {
          // Parse order data from metadata
          const orderData = JSON.parse(updatedPayment.metadata);

          // Create order for failed payment (no broadcasting)
          try {
            const newOrder = await orderService.createOrderForFailedPayment(orderData, merchantTransactionId);
            console.log(`✅ Successfully created order ${newOrder.orderNumber} (ID: ${newOrder.id}) for failed payment from Razorpay webhook`);
          } catch (error) {
            console.error('❌ Error creating order for failed payment from webhook:', error);
          }
        } else {
          console.log(`📡 Failed payment webhook - Order already exists or no metadata. orderId: ${updatedPayment?.orderId}, hasMetadata: ${!!updatedPayment?.metadata}`);
        }
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ success: false, message: 'Processing failed' });
    }
  });

  // Endpoint to manually create order for failed payment (fallback)
  app.post("/api/payments/:merchantTransactionId/create-failed-order", async (req, res) => {
    try {
      const { merchantTransactionId } = req.params;
      const payment = await storage.getPaymentByMerchantTxnId(merchantTransactionId);

      if (!payment) {
        console.log(`❌ Payment ${merchantTransactionId} not found`);
        return res.status(404).json({
          success: false,
          message: "Payment not found"
        });
      }

      console.log(`✅ Payment ${merchantTransactionId} found - Status: ${payment.status}`);

      if (payment.status !== PAYMENT_STATUS.FAILED) {
        return res.status(400).json({
          success: false,
          message: "Payment is not in failed status"
        });
      }

      if (payment.orderId) {
        const existingOrder = await storage.getOrder(payment.orderId);
        return res.json({
          success: true,
          message: "Order already exists for this payment",
          order: existingOrder
        });
      }

      if (!payment.metadata) {
        return res.status(400).json({
          success: false,
          message: "Payment metadata not found"
        });
      }

      const orderData = JSON.parse(payment.metadata);
      const newOrder = await orderService.createOrderForFailedPayment(orderData, merchantTransactionId);

      // Order is already linked in createOrderForFailedPayment, just verify
      if (!newOrder || !newOrder.id) {
        return res.status(500).json({
          success: false,
          message: "Failed to create order"
        });
      }

      res.json({
        success: true,
        message: "Order created for failed payment",
        order: newOrder
      });
    } catch (error) {
      console.error('Error creating order for failed payment:', error);
      res.status(500).json({
        success: false,
        message: "Failed to create order for failed payment",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Check payment status
  app.get("/api/payments/status/:merchantTransactionId", async (req, res) => {
    try {
      const { merchantTransactionId } = req.params;

      // Get payment from database
      const payment = await storage.getPaymentByMerchantTxnId(merchantTransactionId);
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found"
        });
      }

      // If already successful, ensure order is created and return cached status
      if (payment.status === PAYMENT_STATUS.SUCCESS) {
        let orderNumber = null;

        // Create order if not already created (FIXED: Use helper function with stock service)
        if (payment.metadata && !payment.orderId) {
          try {
            const orderData = JSON.parse(payment.metadata);
            const newOrder = await orderService.createOrderFromPayment(orderData, merchantTransactionId);
            orderNumber = newOrder.orderNumber;
            console.log(`📦 Order ${newOrder.orderNumber} created via cached status check with stock management`);
          } catch (error) {
            console.error('❌ Error creating order from payment callback:', error);
            // Don't fail the request, just log the error
            // Order creation will be retried on next status check
          }
        } else if (payment.orderId) {
          // Get existing order number
          const order = await storage.getOrder(payment.orderId);
          orderNumber = order?.orderNumber;
        }

        return res.json({
          success: true,
          status: payment.status,
          data: {
            ...payment,
            orderNumber,
            shouldClearCart: true // Flag to clear cart on frontend
          }
        });
      }

      // If already failed, check if order exists, if not create it
      if (payment.status === PAYMENT_STATUS.FAILED) {
        // Create order if it doesn't exist yet
        if (payment.metadata && !payment.orderId) {
          try {
            const orderData = JSON.parse(payment.metadata);
            const newOrder = await orderService.createOrderForFailedPayment(orderData, merchantTransactionId);

            if (!newOrder || !newOrder.id) {
              throw new Error('Order creation returned invalid order object');
            }

            // Get updated payment with order ID (order is already linked in createOrderForFailedPayment)
            const updatedPayment = await storage.getPaymentByMerchantTxnId(merchantTransactionId);

            console.log(`✅ Successfully created order ${newOrder.orderNumber} (ID: ${newOrder.id}) for failed payment from status check`);

            return res.json({
              success: true,
              status: updatedPayment.status,
              data: {
                ...updatedPayment,
                orderNumber: newOrder.orderNumber,
                orderId: newOrder.id,
                shouldRetry: true // Flag to show retry option
              }
            });
          } catch (error) {
            console.error('❌ Error creating order for failed payment from status check:', error);
            // Continue to return failed status even if order creation fails
          }
        }

        return res.json({
          success: true,
          status: payment.status,
          data: {
            ...payment,
            shouldRetry: true // Flag to show retry option
          }
        });
      }

      // Check if we should skip API call due to recent failures
      const cacheKey = merchantTransactionId;
      const cachedInfo = paymentStatusCache.get(cacheKey);
      const now = Date.now();

      if (cachedInfo?.shouldSkipApi && (now - cachedInfo.lastAttempt) < API_RETRY_INTERVAL) {
        console.log(`⚡ Skipping Razorpay API (${cachedInfo.consecutiveFailures} failures) - returning cached data for ${merchantTransactionId}`);
        return res.json({
          success: true,
          status: payment.status,
          data: { ...payment, fromCache: true, reason: 'api_temporarily_disabled' }
        });
      }

      // Try to check with Razorpay for latest status
      console.log(`⚡ Attempting Razorpay status check for ${merchantTransactionId}`);

      // Get Razorpay order ID from metadata
      let razorpayOrderId = null;
      if (payment.metadata) {
        try {
          const metadata = JSON.parse(payment.metadata);
          razorpayOrderId = metadata.razorpayOrderId;
        } catch (e) {
          console.error('Error parsing payment metadata:', e);
        }
      }

      if (!razorpayOrderId) {
        console.log('⚡ No Razorpay order ID found in metadata, returning cached status');
        return res.json({
          success: true,
          status: payment.status,
          data: { ...payment, fromCache: true, reason: 'no_razorpay_order_id' }
        });
      }

      try {
        // Fetch order details from Razorpay
        const razorpayOrder = await getOrderDetails(razorpayOrderId);

        // API call succeeded - reset failure count
        paymentStatusCache.set(cacheKey, { lastAttempt: now, consecutiveFailures: 0, shouldSkipApi: false });

        // Get payment details if available

        let paymentStatus: string = PAYMENT_STATUS.PENDING;
        let razorpayPaymentId: string | undefined;
        let paymentMethod = 'unknown';

        if ((razorpayOrder as any).payments && (razorpayOrder as any).payments.length > 0) {
          const latestPayment = (razorpayOrder as any).payments[0] as any;
          razorpayPaymentId = latestPayment.id;
          paymentMethod = latestPayment.method || 'unknown';

          if (latestPayment.status === 'captured' || latestPayment.status === 'authorized') {
            paymentStatus = PAYMENT_STATUS.SUCCESS;
          } else if (latestPayment.status === 'failed') {
            paymentStatus = PAYMENT_STATUS.FAILED;
          }
        } else if (razorpayOrder.status === 'paid') {
          paymentStatus = PAYMENT_STATUS.SUCCESS;
        }

        // Update payment record with correct data from Razorpay response
        const updatedPayment = await storage.updatePaymentByMerchantTxnId(merchantTransactionId, {
          razorpayTransactionId: razorpayPaymentId,
          status: paymentStatus,
          paymentMethod: paymentMethod,
          responseCode: razorpayOrder.status,
          responseMessage: `Payment ${razorpayOrder.status}`
        });

        // If payment successful or failed, create order if not already created
        let finalUpdatedPayment = updatedPayment;
        if (paymentStatus === PAYMENT_STATUS.SUCCESS) {
          // Use updatedPayment to get latest metadata
          if (updatedPayment?.metadata && !updatedPayment.orderId) {
            try {
              // Parse order data from metadata and create order with proper stock management
              const orderData = JSON.parse(updatedPayment.metadata);
              const newOrder = await orderService.createOrderFromPayment(orderData, merchantTransactionId);

              if (!newOrder || !newOrder.id) {
                throw new Error('Order creation returned invalid order object - missing id');
              }

              // Update payment with order connection (Mongoose will convert string to ObjectId)
              const orderIdString = typeof newOrder.id === 'string' ? newOrder.id : String(newOrder.id);

              const updateResult = await storage.updatePaymentByMerchantTxnId(merchantTransactionId, {
                orderId: orderIdString // Mongoose will convert string to ObjectId automatically
              });

              if (!updateResult) {
                console.error(`❌ Failed to update payment ${merchantTransactionId} with orderId ${newOrder.id}`);
              } else {
                console.log(`✅ Successfully created order ${newOrder.orderNumber} (ID: ${newOrder.id}) from payment status check and linked to payment`);
              }

              // Get updated payment with order ID
              finalUpdatedPayment = await storage.getPaymentByMerchantTxnId(merchantTransactionId);
            } catch (error) {
              console.error('❌ Error creating order from payment status check:', error);
              console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
              if (updatedPayment?.metadata) {
                try {
                  const errorOrderData = JSON.parse(updatedPayment.metadata);
                  console.error('❌ Order data:', JSON.stringify(errorOrderData, null, 2));
                } catch (e) {
                  console.error('❌ Could not parse order data from metadata');
                }
              }
              // Don't fail the request, order creation can be retried
            }
          } else if (updatedPayment?.orderId) {
            // Order already exists, get order details
            const existingOrder = await storage.getOrder(updatedPayment.orderId);
            if (existingOrder) {
              finalUpdatedPayment = { ...updatedPayment, orderNumber: existingOrder.orderNumber };
            }
          }
        } else if (paymentStatus === PAYMENT_STATUS.FAILED) {
          // Create order for failed payment (no broadcasting)
          // Use updatedPayment instead of payment to get latest metadata
          if (updatedPayment?.metadata && !updatedPayment.orderId) {
            try {
              // Parse order data from metadata
              const orderData = JSON.parse(updatedPayment.metadata);
              const newOrder = await orderService.createOrderForFailedPayment(orderData, merchantTransactionId);

              if (!newOrder || !newOrder.id) {
                throw new Error('Order creation returned invalid order object');
              }

              // Get updated payment with order ID (order is already linked in createOrderForFailedPayment)
              finalUpdatedPayment = await storage.getPaymentByMerchantTxnId(merchantTransactionId);

              console.log(`✅ Successfully created order ${newOrder.orderNumber} (ID: ${newOrder.id}) for failed payment from payment status check`);
            } catch (error) {
              console.error('❌ Error creating order for failed payment from payment status check:', error);
              console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
              if (updatedPayment?.metadata) {
                try {
                  const errorOrderData = JSON.parse(updatedPayment.metadata);
                  console.error('❌ Order data:', JSON.stringify(errorOrderData, null, 2));
                } catch (e) {
                  console.error('❌ Could not parse order data from metadata');
                }
              }
              // Don't fail the request, order creation can be retried
            }
          } else if (updatedPayment?.orderId) {
            // Order already exists, get order details
            const existingOrder = await storage.getOrder(updatedPayment.orderId);
            if (existingOrder) {
              finalUpdatedPayment = { ...updatedPayment, orderNumber: existingOrder.orderNumber };
            }
          }
        }

        // Return appropriate data based on payment status
        const responseData: any = { ...finalUpdatedPayment };

        if (paymentStatus === PAYMENT_STATUS.SUCCESS) {
          responseData.shouldClearCart = true;
          // Get order number if order exists
          const orderId = payment.orderId || finalUpdatedPayment?.orderId;
          if (orderId) {
            const order = await storage.getOrder(orderId);
            if (order) {
              responseData.orderNumber = order.orderNumber;
              responseData.orderId = order.id;
            }
          }
        } else if (paymentStatus === PAYMENT_STATUS.FAILED) {
          responseData.shouldRetry = true;
          // Get order number if order exists
          const orderId = payment.orderId || finalUpdatedPayment?.orderId;
          if (orderId) {
            const order = await storage.getOrder(orderId);
            if (order) {
              responseData.orderNumber = order.orderNumber;
              responseData.orderId = order.id;
            }
          }
        }

        res.json({
          success: true,
          status: paymentStatus,
          data: responseData
        });
      } catch (error) {
        // API call failed - track failure and return cached data
        console.log(`⚡ Razorpay API error:`, error);

        return res.json({
          success: true,
          status: payment.status,
          data: {
            ...payment,
            fromCache: true,
            reason: 'api_error',
            message: 'Payment verification in progress. Status will update automatically.'
          }
        });
      }
    } catch (error) {
      // Track API failure for caching
      const now = Date.now();
      const cacheKey = req.params.merchantTransactionId;
      const currentInfo = paymentStatusCache.get(cacheKey) || { lastAttempt: 0, consecutiveFailures: 0, shouldSkipApi: false };
      const newFailures = currentInfo.consecutiveFailures + 1;
      paymentStatusCache.set(cacheKey, {
        lastAttempt: now,
        consecutiveFailures: newFailures,
        shouldSkipApi: newFailures >= MAX_CONSECUTIVE_FAILURES
      });

      console.log(`⚡ Razorpay API failed (${newFailures}/${MAX_CONSECUTIVE_FAILURES}) for ${req.params.merchantTransactionId}`);

      // Handle timeout specifically
      if ((error as any).code === 'ECONNABORTED' || (error as any).code === 'ETIMEDOUT') {
        console.log('⏰ Razorpay API timeout - returning cached payment status if available');

        // Return the cached payment status to avoid user seeing timeout error
        try {
          const cachedPayment = await storage.getPaymentByMerchantTxnId(req.params.merchantTransactionId);
          if (cachedPayment) {
            const responseData: any = {
              ...cachedPayment,
              isTimeout: true, // Flag to indicate this is cached due to timeout
              message: 'Payment verification in progress. Please check again in a moment.'
            };

            // If payment is successful and has order, include order info
            if (cachedPayment.status === 'success' && cachedPayment.orderId) {
              try {
                const order = await storage.getOrder(cachedPayment.orderId);
                if (order) {
                  responseData.orderNumber = order.orderNumber;
                  responseData.orderId = order.id;
                  responseData.shouldClearCart = true;
                }
              } catch (orderError) {
                console.error('Error fetching order for cached payment:', orderError);
              }
            }

            return res.json({
              success: true,
              status: cachedPayment.status,
              data: responseData
            });
          }
        } catch (dbError) {
          console.error('Error fetching cached payment:', dbError);
        }
      }

      res.status(500).json({
        success: false,
        message: "Internal server error during status check"
      });
    }
  });

  // Verify Razorpay payment signature (for frontend callback)
  app.post("/api/payments/verify-razorpay", async (req, res) => {
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields"
        });
      }

      // Verify payment signature
      const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment signature"
        });
      }

      // Find payment by razorpay order ID in metadata
      const payments = await storage.getPayments();
      let payment = null;
      for (const p of payments) {
        if (p.metadata) {
          try {
            const metadata = JSON.parse(p.metadata);
            if (metadata.razorpayOrderId === razorpay_order_id) {
              payment = p;
              break;
            }
          } catch (e) {
            // Skip invalid metadata
          }
        }
      }

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found"
        });
      }

      // Update payment with Razorpay transaction ID
      await storage.updatePaymentByMerchantTxnId(payment.merchantTransactionId, {
        razorpayTransactionId: razorpay_payment_id,
        status: PAYMENT_STATUS.SUCCESS
      });

      res.json({
        success: true,
        merchantTransactionId: payment.merchantTransactionId
      });
    } catch (error) {
      console.error('Razorpay verification error:', error);
      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  });

  // Get all payments (admin)
  app.get("/api/payments", async (req, res) => {
    try {
      console.log(`📋 GET /api/payments - Fetching all payments`);
      const payments = await storage.getPayments();
      console.log(`✅ Successfully fetched ${payments.length} payments`);
      res.json(payments);
    } catch (error) {
      console.error("❌ Error fetching payments:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get payments for a specific canteen
  app.get("/api/canteens/:canteenId/payments", async (req, res) => {
    try {
      const { canteenId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await storage.getPaymentsByCanteen(canteenId, page, limit);
      res.json(result);
    } catch (error) {
      console.error('Error fetching payments for canteen:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Simple test endpoint to add canteenId to one payment
  app.post("/api/test-payment-canteen", async (req, res) => {
    try {
      const { Payment } = await import('./models/mongodb-models');

      // Find the first payment without canteenId
      const payment = await Payment.findOne({ canteenId: { $exists: false } });

      if (payment) {
        // Update it with canteenId
        await Payment.findByIdAndUpdate(payment._id, {
          canteenId: 'canteen-1758205071111'
        });

        res.json({
          success: true,
          message: `Updated payment ${payment.merchantTransactionId} with canteenId`,
          paymentId: payment._id
        });
      } else {
        res.json({
          success: false,
          message: 'No payments found without canteenId'
        });
      }
    } catch (error) {
      console.error('Error updating payment:', error);
      res.status(500).json({
        success: false,
        error: 'Update failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Endpoint to check and update all payments with correct canteenId
  app.post("/api/update-all-payments-canteen", async (req, res) => {
    try {
      const { Payment } = await import('./models/mongodb-models');

      // Update all payments to have the correct canteenId
      const result = await Payment.updateMany(
        {}, // Update all payments
        { $set: { canteenId: 'canteen-1758205071111' } }
      );

      res.json({
        success: true,
        message: `Updated ${result.modifiedCount} payments with canteenId`,
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      });
    } catch (error) {
      console.error('Error updating payments:', error);
      res.status(500).json({
        success: false,
        error: 'Update failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Migration endpoint to update payments with canteenId
  app.post("/api/migrate-payments-canteen", async (req, res) => {
    try {
      console.log('🔄 Starting payments canteen migration...');

      const { Payment, Order } = await import('./models/mongodb-models');
      const DEFAULT_CANTEEN_ID = 'canteen-1758205071111';

      // Find all payments without canteenId
      const paymentsWithoutCanteen = await Payment.find({
        canteenId: { $exists: false }
      });

      console.log(`📊 Found ${paymentsWithoutCanteen.length} payments without canteenId`);

      let updatedCount = 0;
      let defaultAssignedCount = 0;

      for (const payment of paymentsWithoutCanteen) {
        try {
          if (payment.orderId) {
            // Get the order to find its canteenId
            const order = await Order.findById(payment.orderId);

            if (order && order.canteenId) {
              // Update payment with the order's canteenId
              await Payment.findByIdAndUpdate(payment._id, {
                canteenId: order.canteenId
              });
              updatedCount++;
              console.log(`✅ Updated payment ${payment.merchantTransactionId} with canteenId: ${order.canteenId}`);
            } else {
              // Order not found or doesn't have canteenId, assign to default
              await Payment.findByIdAndUpdate(payment._id, {
                canteenId: DEFAULT_CANTEEN_ID
              });
              defaultAssignedCount++;
              console.log(`⚠️ Payment ${payment.merchantTransactionId} assigned to default canteen (order not found or no canteenId)`);
            }
          } else {
            // Payment has no orderId, assign to default canteen
            await Payment.findByIdAndUpdate(payment._id, {
              canteenId: DEFAULT_CANTEEN_ID
            });
            defaultAssignedCount++;
            console.log(`⚠️ Payment ${payment.merchantTransactionId} assigned to default canteen (no orderId)`);
          }
        } catch (error) {
          console.error(`❌ Error updating payment ${payment.merchantTransactionId}:`, error);
        }
      }

      console.log('🎉 Payments canteen migration completed!');
      console.log(`📊 Summary:`);
      console.log(`   - Updated from orders: ${updatedCount}`);
      console.log(`   - Assigned to default canteen: ${defaultAssignedCount}`);
      console.log(`   - Total processed: ${updatedCount + defaultAssignedCount}`);

      res.json({
        success: true,
        updatedFromOrders: updatedCount,
        assignedToDefault: defaultAssignedCount,
        totalProcessed: updatedCount + defaultAssignedCount
      });

    } catch (error) {
      console.error('Error running payments canteen migration:', error);
      res.status(500).json({
        success: false,
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // TEST ENDPOINT: Simulate PhonePe payment completion for development
  // Admin get all payments with detailed information
  app.get("/api/admin/payments", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const searchQuery = req.query.search as string;
      const statusFilter = req.query.status as string;

      // If there's a search query, we need to handle customer name search separately
      let finalResult;
      if (searchQuery && searchQuery.trim()) {
        // First get payments that match payment fields
        const paymentResult = await storage.getPaymentsPaginated(page, limit, searchQuery, statusFilter);

        // Also search for payments by customer name via orders
        const allOrders = await storage.getOrders();
        const customerSearchRegex = new RegExp(searchQuery.trim(), 'i');
        const matchingOrderIds = allOrders
          .filter(order => customerSearchRegex.test(order.customerName || '') || customerSearchRegex.test(order.orderNumber || ''))
          .map(order => order.id);

        // Get payments that match these order IDs
        const allPayments = await storage.getPayments();
        const customerMatchingPayments = allPayments.filter(payment =>
          matchingOrderIds.includes(payment.orderId) &&
          (!statusFilter || statusFilter === 'all' || payment.status?.toLowerCase() === statusFilter.toLowerCase())
        );

        // Combine and deduplicate results
        const combinedPayments = [...paymentResult.payments];
        customerMatchingPayments.forEach(custPayment => {
          if (!combinedPayments.find(p => p.id === custPayment.id)) {
            combinedPayments.push(custPayment);
          }
        });

        // Sort by creation date and paginate the combined results
        const sortedPayments = combinedPayments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const startIndex = (page - 1) * limit;
        const paginatedPayments = sortedPayments.slice(startIndex, startIndex + limit);

        finalResult = {
          payments: paginatedPayments,
          totalCount: sortedPayments.length,
          totalPages: Math.ceil(sortedPayments.length / limit),
          currentPage: page
        };
      } else {
        finalResult = await storage.getPaymentsPaginated(page, limit, searchQuery, statusFilter);
      }

      // Enhance payment data with order information
      const enhancedPayments = await Promise.all(
        finalResult.payments.map(async (payment) => {
          let orderDetails = null;
          let customerName = null;

          // Try to get order details if orderId exists
          if (payment.orderId) {
            try {
              // Handle both string and ObjectId formats
              const orderIdStr = typeof payment.orderId === 'string'
                ? payment.orderId
                : payment.orderId.toString();

              const order = await storage.getOrder(orderIdStr);
              if (order) {
                orderDetails = {
                  orderNumber: order.orderNumber,
                  orderStatus: order.status,
                  customerName: order.customerName,
                  amount: order.amount,
                  items: order.items
                };
                customerName = order.customerName;
              }
            } catch (error) {
              console.error(`Error fetching order ${payment.orderId} for payment ${payment.merchantTransactionId}:`, error);
            }
          }

          // Fallback: Get customerName from metadata if order doesn't exist
          if (!customerName && payment.metadata) {
            try {
              const metadata = typeof payment.metadata === 'string'
                ? JSON.parse(payment.metadata)
                : payment.metadata;
              customerName = metadata.customerName || null;
            } catch (e) {
              // Ignore parse errors
            }
          }

          // Parse metadata safely
          let parsedMetadata = null;
          if (payment.metadata) {
            try {
              parsedMetadata = typeof payment.metadata === 'string'
                ? JSON.parse(payment.metadata)
                : payment.metadata;
            } catch (e) {
              // Ignore parse errors
            }
          }

          return {
            ...payment,
            orderDetails: orderDetails || (customerName ? { customerName } : null),
            customerName: customerName || 'Guest User', // Fallback for display
            metadata: parsedMetadata,
            formattedAmount: `₹${payment.amount / 100}`,
            createdAtFormatted: new Date(payment.createdAt).toLocaleString('en-IN'),
            updatedAtFormatted: new Date(payment.updatedAt).toLocaleString('en-IN')
          };
        })
      );

      res.json({
        success: true,
        payments: enhancedPayments,
        totalCount: finalResult.totalCount,
        totalPages: finalResult.totalPages,
        currentPage: finalResult.currentPage,
        hasNextPage: page < finalResult.totalPages,
        hasPrevPage: page > 1
      });
    } catch (error) {
      console.error('Error fetching payments:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch payments' });
    }
  });

  app.post("/api/payments/test-complete/:merchantTransactionId", async (req, res) => {
    try {
      const { merchantTransactionId } = req.params;

      // Get payment from database
      const payment = await storage.getPaymentByMerchantTxnId(merchantTransactionId);
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found"
        });
      }

      // Update payment to success
      await storage.updatePaymentByMerchantTxnId(merchantTransactionId, {
        phonePeTransactionId: `TEST_${Date.now()}`,
        status: PAYMENT_STATUS.SUCCESS,
        paymentMethod: 'UPI',
        responseCode: 'SUCCESS',
        responseMessage: 'Test payment completed successfully'
      });

      // Update order status
      if (payment.orderId) {
        await storage.updateOrder(payment.orderId, { status: 'preparing' });

        // Send WebSocket notification
        const wsManager = getWebSocketManager();
        if (wsManager) {
          wsManager.broadcastToAll({
            type: 'payment_success',
            data: {
              orderId: payment.orderId,
              merchantTransactionId,
              message: 'Test payment completed successfully'
            }
          });
          console.log('📢 Successfully broadcasted test payment success to all clients');
        } else {
          console.log('📡 WebSocket manager not available for test payment broadcast');
        }
      }

      res.json({
        success: true,
        message: 'Test payment completed successfully',
        merchantTransactionId
      });
    } catch (error) {
      console.error('Test payment completion error:', error);
      res.status(500).json({ success: false, message: 'Test payment completion failed' });
    }
  });

  // Payment Counter Endpoints for Offline Orders (now handled as regular orders)


  // Confirm payment for offline order
  app.post("/api/payments/confirm/:orderId", async (req, res) => {
    try {
      const { orderId } = req.params;
      console.log(`💰 POST /api/payments/confirm/${orderId} - Confirming payment for offline order`);

      // Get the offline order
      const order = await storage.getOrder(orderId);
      if (!order) {
        console.log(`❌ Order ${orderId} not found`);
        return res.status(404).json({
          success: false,
          message: "Order not found"
        });
      }

      // Check if it's an offline order with pending payment
      if (!order.isOffline || order.paymentStatus !== 'pending') {
        console.log(`❌ Order ${order.orderNumber} is not an offline order with pending payment - isOffline: ${order.isOffline}, paymentStatus: ${order.paymentStatus}`);
        return res.status(400).json({
          success: false,
          message: "Order is not an offline order with pending payment"
        });
      }

      // Parse order items to check for markable items
      let orderItems = [];
      try {
        orderItems = JSON.parse(order.items);
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
      let newStatus = order.status;
      if (order.status === 'pending_payment') {
        newStatus = hasMarkableItem ? 'pending' : 'ready';
        console.log(`💳 Payment confirmation: Order has markable items: ${hasMarkableItem}, setting status to: ${newStatus}`);
      }

      const updatedOrder = await storage.updateOrder(orderId, {
        paymentStatus: 'confirmed',
        status: newStatus
      });

      // Broadcast payment confirmation to canteen
      const wsManager = getWebSocketManager();
      if (wsManager) {
        // Broadcast to store mode (active orders)
        wsManager.broadcastNewOrder(order.canteenId, updatedOrder);

        // Broadcast payment confirmation event
        wsManager.broadcastToCanteen(order.canteenId, 'payment_confirmed', { order: updatedOrder, orderId });

        // Also broadcast order update to ensure all clients get the status change
        wsManager.broadcastToCanteen(order.canteenId, 'order_updated', updatedOrder);

        console.log(`📢 Payment confirmed for offline order ${order.orderNumber} in canteen ${order.canteenId}`);
        console.log(`📢 Order status changed from pending_payment to ${newStatus}`);
        console.log(`📢 Broadcasting to canteen room: canteen_${order.canteenId}`);
        console.log(`📢 Updated order data:`, {
          id: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          status: updatedOrder.status,
          paymentStatus: updatedOrder.paymentStatus,
          isOffline: updatedOrder.isOffline
        });
      }

      res.json({
        success: true,
        order: updatedOrder,
        message: 'Payment confirmed successfully'
      });
    } catch (error) {
      console.error('Error confirming payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to confirm payment'
      });
    }
  });

  // Payment Session Management Endpoints - DEPRECATED (using checkout sessions now)
  // Keeping for backward compatibility but redirecting to checkout session endpoints

  // ============================================
  // Checkout Session Management Endpoints
  // ============================================

  // Create checkout session (called when checkout page loads)
  app.post("/api/checkout-sessions/create", async (req, res) => {
    try {
      const { customerId, canteenId, sessionDurationMinutes, sessionType } = req.body;

      // For POS sessions, customerId can be 0 (no customer ID required)
      const isPosSession = sessionType === 'pos';

      if (!isPosSession && !customerId) {
        return res.status(400).json({
          success: false,
          message: "Customer ID is required"
        });
      }

      // Use custom duration if provided, otherwise default to 20 minutes
      // For POS sessions, default to 15 minutes
      const duration = sessionDurationMinutes || (isPosSession ? 15 : 20);

      const sessionId = await CheckoutSessionService.createSession(
        customerId || 0,
        canteenId,
        duration
      );

      const sessionStatus = await CheckoutSessionService.getSessionStatus(sessionId);

      res.json({
        success: true,
        sessionId,
        sessionType: sessionType || 'user',
        ...sessionStatus
      });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({
        success: false,
        message: "Failed to create checkout session"
      });
    }
  });

  // Get checkout session status
  app.get("/api/checkout-sessions/:sessionId/status", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const sessionStatus = await CheckoutSessionService.getSessionStatus(sessionId);

      if (!sessionStatus) {
        return res.status(404).json({
          success: false,
          message: "Session not found"
        });
      }

      // Broadcast status update via WebSocket (optimized - debounced)
      const wsManager = getWebSocketManager();
      if (wsManager && sessionStatus.canteenId) {
        wsManager.broadcastCheckoutSessionStatus(
          sessionId,
          sessionStatus.status,
          sessionStatus.timeRemaining,
          sessionStatus.canteenId
        );
      }

      res.json({
        success: true,
        ...sessionStatus
      });
    } catch (error) {
      console.error('Error getting checkout session status:', error);
      res.status(500).json({
        success: false,
        message: "Failed to get session status"
      });
    }
  });

  // Update checkout session status
  app.post("/api/checkout-sessions/:sessionId/update-status", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { status, metadata } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: "Status is required"
        });
      }

      await CheckoutSessionService.updateStatus(sessionId, status, metadata);
      const sessionStatus = await CheckoutSessionService.getSessionStatus(sessionId);

      res.json({
        success: true,
        ...sessionStatus
      });
    } catch (error) {
      console.error('Error updating checkout session status:', error);
      res.status(500).json({
        success: false,
        message: "Failed to update session status"
      });
    }
  });

  // Reserve stock for checkout session (called when proceeding to checkout)
  app.post("/api/checkout-sessions/:sessionId/reserve-stock", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { cartItems } = req.body;

      if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Cart items are required"
        });
      }

      // Validate session exists
      const session = await CheckoutSessionService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: "Checkout session not found"
        });
      }

      // Reserve stock
      await CheckoutSessionService.reserveStockForSession(sessionId, cartItems);

      res.json({
        success: true,
        message: "Stock reserved successfully"
      });
    } catch (error: any) {
      console.error('Error reserving stock for checkout session:', error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to reserve stock"
      });
    }
  });

  // Update checkout session activity (heartbeat)
  app.post("/api/checkout-sessions/:sessionId/activity", async (req, res) => {
    try {
      const { sessionId } = req.params;
      await CheckoutSessionService.updateActivity(sessionId);

      // Broadcast status update via WebSocket (optimized - debounced)
      const sessionStatus = await CheckoutSessionService.getSessionStatus(sessionId);
      const wsManager = getWebSocketManager();
      if (wsManager && sessionStatus && sessionStatus.canteenId) {
        wsManager.broadcastCheckoutSessionStatus(
          sessionId,
          sessionStatus.status,
          sessionStatus.timeRemaining,
          sessionStatus.canteenId
        );
      }

      res.json({
        success: true,
        message: "Activity updated"
      });
    } catch (error) {
      console.error('Error updating checkout session activity:', error);
      res.status(500).json({
        success: false,
        message: "Failed to update activity"
      });
    }
  });

  // Abandon checkout session (called when user leaves checkout page)
  app.post("/api/checkout-sessions/:sessionId/abandon", async (req, res) => {
    try {
      const { sessionId } = req.params;
      await CheckoutSessionService.abandonSession(sessionId);

      res.json({
        success: true,
        message: "Session abandoned"
      });
    } catch (error) {
      console.error('Error abandoning checkout session:', error);
      res.status(500).json({
        success: false,
        message: "Failed to abandon session"
      });
    }
  });


  // Complaint management endpoints
  app.get("/api/complaints", async (req, res) => {
    try {
      const complaints = await storage.getComplaints();
      res.json(complaints);
    } catch (error) {
      console.error("Error fetching complaints:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/complaints", async (req, res) => {
    try {
      const validatedData = insertComplaintSchema.parse(req.body);
      // Add default canteen_id
      const complaintData = {
        ...validatedData,
        canteenId: validatedData.canteenId // Remove hardcoded fallback
      };
      const complaint = await storage.createComplaint(complaintData);
      res.status(201).json(complaint);
    } catch (error) {
      console.error("Error creating complaint:", error);
      res.status(400).json({ message: "Invalid complaint data" });
    }
  });

  app.get("/api/complaints/:id", async (req, res) => {
    try {
      const complaint = await storage.getComplaint(req.params.id);
      if (!complaint) {
        return res.status(404).json({ message: "Complaint not found" });
      }
      res.json(complaint);
    } catch (error) {
      console.error("Error fetching complaint:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/complaints/:id", async (req, res) => {
    try {
      const updateData = req.body;
      const complaint = await storage.updateComplaint(req.params.id, updateData);
      if (!complaint) {
        return res.status(404).json({ message: "Complaint not found" });
      }
      res.json(complaint);
    } catch (error) {
      console.error("Error updating complaint:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/complaints/:id", async (req, res) => {
    try {
      const complaint = await storage.deleteComplaint(req.params.id);
      if (!complaint) {
        return res.status(404).json({ message: "Complaint not found" });
      }
      res.json({ message: "Complaint deleted successfully" });
    } catch (error) {
      console.error("Error deleting complaint:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create sample complaints based on real users and orders
  app.post("/api/complaints/generate-samples", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const orders = await storage.getOrders();

      const sampleComplaints = [];
      const complaintTypes = [
        { subject: "Payment Issue", description: "Payment was deducted but order not processed", category: "Payment" },
        { subject: "Order Delay", description: "Order taking too long to prepare", category: "Service" },
        { subject: "Food Quality", description: "Food quality was not satisfactory", category: "Quality" },
        { subject: "Missing Items", description: "Some items were missing from my order", category: "Service" },
        { subject: "Wrong Order", description: "Received different items than ordered", category: "Service" },
        { subject: "Cold Food", description: "Food was cold when received", category: "Quality" },
        { subject: "App Issue", description: "Unable to place order through app", category: "Technical" },
        { subject: "Refund Request", description: "Need refund for cancelled order", category: "Payment" }
      ];

      // Generate complaints from real users
      for (let i = 0; i < Math.min(5, users.length); i++) {
        const user = users[i];
        const complaintType = complaintTypes[i % complaintTypes.length];
        const userOrder = orders.find(o => o.customerId === user.id);

        const complaint = await storage.createComplaint({
          subject: complaintType.subject,
          description: complaintType.description,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          category: complaintType.category,
          priority: ['High', 'Medium', 'Low'][i % 3],
          status: 'Open',
          orderId: userOrder?.id
        });

        sampleComplaints.push(complaint);
      }

      res.json({
        success: true,
        message: `Generated ${sampleComplaints.length} sample complaints`,
        complaints: sampleComplaints
      });
    } catch (error) {
      console.error("Error generating sample complaints:", error);
      res.status(500).json({ message: "Failed to generate sample complaints" });
    }
  });

  // Inventory Management Endpoints

  // Get all inventory items (menu item stock tracking)
  app.get("/api/inventory", async (req, res) => {
    try {
      console.log(`📋 GET /api/inventory - Fetching inventory items`);
      // Fetch menu items and categories from database
      const menuItems = await storage.getMenuItems();
      const categories = await storage.getCategories();

      // Convert menu items to inventory tracking items
      const inventoryItems = menuItems.map((item: any) => {
        const category = categories.find((cat: any) => cat.id === item.categoryId);

        // Generate realistic stock levels for prepared dishes/items
        const baseStock = Math.floor(Math.random() * 50) + 10; // 10-60 items available
        const minThreshold = 5; // Minimum 5 items before restock
        const maxThreshold = 100; // Maximum capacity

        // Determine status based on stock levels
        let status = "in_stock";
        if (baseStock === 0) {
          status = "out_of_stock";
        } else if (baseStock <= minThreshold) {
          status = "low_stock";
        }

        return {
          id: `inv_${item.id}`,
          name: item.name,
          category: category?.name || 'Uncategorized',
          unit: "pcs", // Menu items are counted in pieces
          currentStock: baseStock,
          minThreshold,
          maxThreshold,
          sellingPrice: item.price,
          lastPrepared: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
          description: item.description || `Ready-to-serve ${item.name}`,
          status,
          menuItemId: item.id,
          available: item.available && baseStock > 0
        };
      });

      console.log(`✅ Successfully fetched ${inventoryItems.length} inventory items`);
      res.json(inventoryItems);
    } catch (error) {
      console.error("❌ Error fetching inventory:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add new inventory item
  app.post("/api/inventory", async (req, res) => {
    try {
      console.log(`📋 POST /api/inventory - Creating inventory item: ${req.body.name}`);
      const itemData = req.body;

      // Validate required fields
      if (!itemData.name || !itemData.category) {
        console.log(`❌ Missing required fields: name or category`);
        return res.status(400).json({ message: "Name and category are required" });
      }

      // Determine status based on current stock and thresholds
      let status = "in_stock";
      if (itemData.currentStock === 0) {
        status = "out_of_stock";
      } else if (itemData.currentStock <= itemData.minThreshold) {
        status = "low_stock";
      }

      const newItem = {
        ...itemData,
        id: `inv_${Date.now()}`,
        lastRestocked: new Date().toISOString(),
        status
      };

      // In production, save to database
      console.log(`✅ New inventory item created: ${newItem.name} (ID: ${newItem.id})`);

      res.json(newItem);
    } catch (error) {
      console.error("❌ Error creating inventory item:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update inventory item
  app.patch("/api/inventory/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`🔄 PATCH /api/inventory/${id} - Updating inventory item`);
      const updateData = req.body;

      // In production, update in database
      console.log(`Updated inventory item ${id}:`, updateData);

      res.json({ id, ...updateData });
    } catch (error) {
      console.error("Error updating inventory item:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete inventory item
  app.delete("/api/inventory/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`🗑️ DELETE /api/inventory/${id} - Deleting inventory item`);

      // In production, delete from database
      console.log(`✅ Inventory item ${id} deleted successfully`);

      res.json({ message: "Item deleted successfully" });
    } catch (error) {
      console.error("❌ Error deleting inventory item:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get stock movements based on menu items  
  app.get("/api/inventory/movements", async (req, res) => {
    try {
      console.log(`📋 GET /api/inventory/movements - Fetching stock movements`);
      // Fetch menu items to generate realistic movements
      const menuItems = await storage.getMenuItems();

      // Generate realistic stock movements for menu items
      const movements: any[] = [];
      const movementTypes = ['in', 'out', 'adjustment'];
      const reasons = {
        'in': ['Items prepared', 'Kitchen production', 'Daily prep', 'Fresh batch ready'],
        'out': ['Order served', 'Customer purchase', 'Daily sales', 'Item sold'],
        'adjustment': ['Stock count correction', 'Expired items removed', 'Quality check adjustment']
      };
      const users = ['Kitchen Staff', 'Chef', 'Canteen Manager', 'Server'];

      // Generate movements for first 10 menu items to keep it manageable
      menuItems.slice(0, 10).forEach((item: any, index: number) => {
        // Generate 1-3 movements per item over the past week
        const numMovements = Math.floor(Math.random() * 3) + 1;

        for (let i = 0; i < numMovements; i++) {
          const type = movementTypes[Math.floor(Math.random() * movementTypes.length)];
          const reasonList = reasons[type as keyof typeof reasons];
          const reason = reasonList[Math.floor(Math.random() * reasonList.length)];
          const user = users[Math.floor(Math.random() * users.length)];

          let quantity = Math.floor(Math.random() * 15) + 1; // 1-15 items
          const originalQuantity = quantity;

          if (type === 'out') quantity = -quantity;
          if (type === 'adjustment') quantity = Math.random() > 0.5 ? quantity : -quantity;

          movements.push({
            id: `mov_${item.id}_${i}`,
            itemId: `inv_${item.id}`,
            itemName: item.name,
            type,
            quantity: Math.abs(originalQuantity),
            reason,
            date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
            user,
            value: Math.abs(originalQuantity) * item.price
          });
        }
      });

      // Sort by date (newest first)
      movements.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

      res.json(movements);
    } catch (error) {
      console.error("Error fetching stock movements:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Record stock movement
  app.post("/api/inventory/movements", async (req, res) => {
    try {
      const movementData = req.body;

      // Validate required fields
      if (!movementData.itemId || !movementData.type || !movementData.quantity || !movementData.reason) {
        return res.status(400).json({ message: "ItemId, type, quantity, and reason are required" });
      }

      const newMovement = {
        ...movementData,
        id: `mov_${Date.now()}`,
        date: new Date().toISOString()
      };

      // In production, save to database and update item stock
      console.log("New stock movement recorded:", newMovement);

      res.json(newMovement);
    } catch (error) {
      console.error("Error recording stock movement:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get suppliers based on menu categories
  app.get("/api/inventory/suppliers", async (req, res) => {
    try {
      // For menu item inventory, suppliers would be kitchen/preparation teams
      const categories = await storage.getCategories();
      const menuItems = await storage.getMenuItems();

      // Generate kitchen teams/suppliers based on actual categories
      const suppliers = categories.map((category: any) => {
        const categoryItems = menuItems.filter((item: any) => item.categoryId === category.id);
        const itemCount = categoryItems.length;

        // Calculate total value based on actual menu items in stock
        const totalValue = categoryItems.reduce((sum: number, item: any) => {
          const avgStock = Math.floor(Math.random() * 30) + 10; // Average stock
          return sum + (item.price * avgStock);
        }, 0);

        // Generate kitchen team/supplier name based on category
        const teamNames: { [key: string]: string } = {
          'default': `${category.name} Kitchen Team`,
          'snack': 'Snacks Preparation Team',
          'sweet': 'Desserts & Sweets Team',
          'beverage': 'Beverages Counter',
          'main': 'Main Course Kitchen',
          'rice': 'Rice & Grains Station',
          'curry': 'Curry & Gravy Station'
        };

        const teamKey = Object.keys(teamNames).find(key =>
          category.name.toLowerCase().includes(key)
        ) || 'default';

        const teamName = teamNames[teamKey] || `${category.name} Team`;

        return {
          id: `sup_${category.id}`,
          name: teamName,
          contact: `Ext. ${Math.floor(Math.random() * 100) + 100}`,
          email: `${teamName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '')}@sillobite.production`,
          itemCount,
          totalValue: Math.round(totalValue),
          category: category.name
        };
      }).filter((supplier: any) => supplier.itemCount > 0); // Only include teams with items

      res.json(suppliers);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ===========================================
  // COUPON MANAGEMENT ROUTES
  // ===========================================

  // Get all coupons (admin only)
  app.get("/api/coupons", async (req, res) => {
    try {
      const coupons = await storage.getCoupons();
      res.json(coupons);
    } catch (error) {
      console.error("Error fetching coupons:", error);
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });

  // Get active coupons for users
  app.get("/api/coupons/active", async (req, res) => {
    try {
      const activeCoupons = await storage.getActiveCoupons();
      res.json(activeCoupons);
    } catch (error) {
      console.error("Error fetching active coupons:", error);
      res.status(500).json({ message: "Failed to fetch active coupons" });
    }
  });

  // Create new coupon (admin only)
  app.post("/api/coupons", async (req, res) => {
    try {
      const couponData: InsertCoupon = req.body;

      // Validate required fields
      if (!couponData.code || !couponData.description || !couponData.discountType ||
        !couponData.discountValue || !couponData.usageLimit || !couponData.validFrom ||
        !couponData.validUntil || !couponData.createdBy) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Validate discount value
      if (couponData.discountType === 'percentage' && couponData.discountValue > 100) {
        return res.status(400).json({ message: "Percentage discount cannot exceed 100%" });
      }

      if (couponData.discountValue <= 0) {
        return res.status(400).json({ message: "Discount value must be greater than 0" });
      }

      // Validate dates
      const validFrom = new Date(couponData.validFrom);
      const validUntil = new Date(couponData.validUntil);

      if (validFrom >= validUntil) {
        return res.status(400).json({ message: "Valid from date must be before valid until date" });
      }

      // Add default canteen_id
      const finalCouponData = {
        ...couponData,
        canteenId: couponData.canteenId // Remove hardcoded fallback
      };

      const coupon = await storage.createCoupon(finalCouponData);
      res.status(201).json(coupon);
    } catch (error) {
      console.error("Error creating coupon:", error);
      if (error instanceof Error && error.message.includes('duplicate key')) {
        res.status(400).json({ message: "Coupon code already exists" });
      } else {
        res.status(500).json({ message: "Failed to create coupon" });
      }
    }
  });

  // Validate coupon for user
  app.post("/api/coupons/validate", async (req, res) => {
    try {
      const { code, userId, orderAmount } = req.body;

      if (!code || !orderAmount) {
        return res.status(400).json({
          valid: false,
          message: "Coupon code and order amount are required"
        });
      }

      const validation = await storage.validateCoupon(code, userId, orderAmount);
      res.json(validation);
    } catch (error) {
      console.error("Error validating coupon:", error);
      res.status(500).json({
        valid: false,
        message: "Failed to validate coupon"
      });
    }
  });

  // Apply coupon to order
  app.post("/api/coupons/apply", async (req, res) => {
    try {
      const { code, userId, orderAmount } = req.body;

      if (!code || !userId || !orderAmount) {
        return res.status(400).json({
          success: false,
          message: "Coupon code, user ID, and order amount are required"
        });
      }

      const result = await storage.applyCoupon(code, userId, orderAmount);
      res.json(result);
    } catch (error) {
      console.error("Error applying coupon:", error);
      res.status(500).json({
        success: false,
        message: "Failed to apply coupon"
      });
    }
  });

  // Get coupon by ID
  app.get("/api/coupons/:id", async (req, res) => {
    try {
      const coupon = await storage.getCoupon(req.params.id);
      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      res.json(coupon);
    } catch (error) {
      console.error("Error fetching coupon:", error);
      res.status(500).json({ message: "Failed to fetch coupon" });
    }
  });

  // Update coupon (admin only)
  app.put("/api/coupons/:id", async (req, res) => {
    try {
      const updateData = req.body;
      const coupon = await storage.updateCoupon(req.params.id, updateData);
      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      res.json(coupon);
    } catch (error) {
      console.error("Error updating coupon:", error);
      res.status(500).json({ message: "Failed to update coupon" });
    }
  });

  // Delete coupon (admin only)
  app.delete("/api/coupons/:id", async (req, res) => {
    try {
      const success = await storage.deleteCoupon(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      res.json({ message: "Coupon deleted successfully" });
    } catch (error) {
      console.error("Error deleting coupon:", error);
      res.status(500).json({ message: "Failed to delete coupon" });
    }
  });

  // Toggle coupon status (admin only)
  app.patch("/api/coupons/:id/toggle", async (req, res) => {
    try {
      const coupon = await storage.toggleCouponStatus(req.params.id);
      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      res.json(coupon);
    } catch (error) {
      console.error("Error toggling coupon status:", error);
      res.status(500).json({ message: "Failed to toggle coupon status" });
    }
  });

  // Get detailed usage information for a coupon (admin only)
  app.get("/api/coupons/:id/usage", async (req, res) => {
    try {
      const result = await storage.getCouponUsageDetails(req.params.id);
      if (!result.success) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      res.json(result);
    } catch (error) {
      console.error("Error fetching coupon usage details:", error);
      res.status(500).json({ message: "Failed to fetch coupon usage details" });
    }
  });

  // Assign coupon to specific users (admin only)
  app.post("/api/coupons/:id/assign", async (req, res) => {
    try {
      const { userIds } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: "User IDs array is required" });
      }

      const result = await storage.assignCouponToUsers(req.params.id, userIds);
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      res.json({ message: result.message });
    } catch (error) {
      console.error("Error assigning coupon to users:", error);
      res.status(500).json({ message: "Failed to assign coupon to users" });
    }
  });

  // Get available coupons for a specific user
  app.get("/api/users/:userId/coupons", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const coupons = await storage.getCouponsForUser(userId);
      res.json(coupons);
    } catch (error) {
      console.error("Error fetching user coupons:", error);
      res.status(500).json({ message: "Failed to fetch user coupons" });
    }
  });

  // Get all users for coupon assignment (admin only)
  app.get("/api/admin/users", async (req, res) => {
    try {
      const { search, role } = req.query;
      let users = [];

      // Get all users from PostgreSQL
      const allUsers = await storage.getAllUsers();

      // Filter by search term if provided
      if (search) {
        const searchTerm = (search as string).toLowerCase();
        users = allUsers.filter(user =>
          user.name.toLowerCase().includes(searchTerm) ||
          user.email.toLowerCase().includes(searchTerm) ||
          (user.registerNumber && user.registerNumber.toLowerCase().includes(searchTerm)) ||
          (user.staffId && user.staffId.toLowerCase().includes(searchTerm))
        );
      } else {
        users = allUsers;
      }

      // Filter by role if provided
      if (role && role !== 'all') {
        users = users.filter(user => user.role === role);
      }

      // Format users for frontend display
      const formattedUsers = users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        identifier: ((user.role as string) === 'student' || (user.role as string) === 'employee' || (user.role as string) === 'contractor' || (user.role as string) === 'visitor' || (user.role as string) === 'guest') ? user.registerNumber : user.staffId,
        department: user.department || '',
        createdAt: user.createdAt
      }));

      res.json(formattedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get users by organization ID (admin only)
  app.get("/api/admin/organization/:organizationId/users", async (req, res) => {
    try {
      const { organizationId } = req.params;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      // Get all users from PostgreSQL
      const allUsers = await storage.getAllUsers();

      // Filter users by organization ID
      // Organization users have the organization ID in the 'college' field (prefixed with 'org-')
      // or in a separate 'organization' field
      const organizationUsers = allUsers.filter(user => {
        // Check if college field contains the organization ID (with or without 'org-' prefix)
        // Organization IDs are stored as 'org-{id}' in the college field
        const collegeMatches = user.college === organizationId ||
          user.college === `org-${organizationId}`;

        // Check if organization field matches (if it exists)
        const organizationMatches = (user as any).organization === organizationId;

        // Also check for organization roles (employee, contractor, visitor, guest)
        const isOrgRole = ['employee', 'contractor', 'visitor', 'guest'].includes(user.role);

        return (collegeMatches || organizationMatches) && isOrgRole;
      });

      // Format users for frontend display
      const formattedUsers = organizationUsers.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || '',
        registerNumber: user.registerNumber || '',
        createdAt: user.createdAt,
        isActive: true // You can add an isActive field to the User model if needed
      }));

      res.json({ users: formattedUsers });
    } catch (error) {
      console.error("Error fetching organization users:", error);
      res.status(500).json({ error: "Failed to fetch organization users" });
    }
  });

  // Counter Management Routes
  // Get all counters for a canteen (with caching)
  app.get("/api/counters", async (req, res) => {
    try {
      const { canteenId, type } = req.query;
      if (!canteenId) {
        return res.status(400).json({ message: "Canteen ID is required" });
      }

      // SCALABILITY FIX: Use cache service for counters
      const { CounterCacheService } = await import('./services/cacheService');
      const counters = await CounterCacheService.getPaymentCounters(
        canteenId as string,
        async () => await storage.getCountersByCanteen(canteenId as string)
      );

      // Filter by type if specified
      let filteredCounters = counters;
      if (type && ['payment', 'store', 'kot'].includes(type as string)) {
        filteredCounters = counters.filter((counter: any) => counter.type === type);
      }

      res.json(filteredCounters);
    } catch (error) {
      console.error("Error fetching counters:", error);
      res.status(500).json({ message: "Failed to fetch counters" });
    }
  });

  // Create a new counter
  app.post("/api/counters", async (req, res) => {
    try {
      const { name, code, canteenId, type } = req.body;

      if (!name || !code || !canteenId || !type) {
        return res.status(400).json({ message: "Name, code, canteenId, and type are required" });
      }

      if (!['payment', 'store', 'kot'].includes(type)) {
        return res.status(400).json({ message: "Type must be either 'payment', 'store', or 'kot'" });
      }

      // Generate unique counter ID
      const counterId = `CNT_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const counter = await storage.createCounter({
        name,
        code: code.toUpperCase(),
        counterId,
        canteenId,
        type
      });

      // Invalidate cache after creating counter
      const { CounterCacheService } = await import('./services/cacheService');
      await CounterCacheService.invalidateCounters(canteenId);

      res.status(201).json(counter);
    } catch (error) {
      console.error("Error creating counter:", error);
      if ((error as any).message?.includes('duplicate')) {
        res.status(409).json({ message: "Counter code already exists for this canteen" });
      } else {
        res.status(500).json({ message: "Failed to create counter" });
      }
    }
  });

  // Get a single counter by ID
  app.get("/api/counters/:id", async (req, res) => {
    try {
      const counterId = req.params.id;
      const counter = await storage.getCounterById(counterId);

      if (!counter) {
        return res.status(404).json({ message: "Counter not found" });
      }

      res.json(counter);
    } catch (error) {
      console.error("Error fetching counter:", error);
      res.status(500).json({ message: "Failed to fetch counter" });
    }
  });

  // Get payment counter name by ID
  app.get("/api/counters/:id/name", async (req, res) => {
    try {
      const counterId = req.params.id;
      const counterName = await storage.getPaymentCounterName(counterId);

      res.json({ name: counterName });
    } catch (error) {
      console.error("Error fetching counter name:", error);
      res.status(500).json({ message: "Failed to fetch counter name" });
    }
  });

  // Delete a counter
  app.delete("/api/counters/:id", async (req, res) => {
    try {
      const counterId = req.params.id;

      // Get counter first to get canteenId for cache invalidation
      const counter = await storage.getCounterById(counterId);
      if (!counter) {
        return res.status(404).json({ message: "Counter not found" });
      }

      const deleted = await storage.deleteCounter(counterId);

      if (!deleted) {
        return res.status(404).json({ message: "Counter not found" });
      }

      // Invalidate cache after deleting counter
      const { CounterCacheService } = await import('./services/cacheService');
      await CounterCacheService.invalidateCounters(counter.canteenId);

      res.json({ message: "Counter deleted successfully" });
    } catch (error) {
      console.error("Error deleting counter:", error);
      res.status(500).json({ message: "Failed to delete counter" });
    }
  });

  // Get payment statistics for a counter
  app.get("/api/payment-stats", async (req, res) => {
    try {
      const { canteenId, counterId } = req.query;

      if (!canteenId || !counterId) {
        return res.status(400).json({ message: "Canteen ID and Counter ID are required" });
      }

      const stats = await storage.getPaymentStats(canteenId as string, counterId as string);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching payment stats:", error);
      res.status(500).json({ message: "Failed to fetch payment statistics" });
    }
  });

  // Get store statistics for a counter
  app.get("/api/store-stats", async (req, res) => {
    try {
      const { canteenId, counterId } = req.query;

      if (!canteenId || !counterId) {
        return res.status(400).json({ message: "Canteen ID and Counter ID are required" });
      }

      const stats = await storage.getStoreStats(canteenId as string, counterId as string);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching store stats:", error);
      res.status(500).json({ message: "Failed to fetch store statistics" });
    }
  });

  // Process payment for an order
  app.post("/api/orders/:id/process-payment", async (req, res) => {
    try {
      const orderId = req.params.id;
      const { counterId } = req.body;

      // Get the order before updating to capture old status
      const oldOrder = await storage.getOrder(orderId);
      if (!oldOrder) {
        return res.status(404).json({ message: "Order not found" });
      }

      const result = await storage.processPayment(orderId, counterId);
      if (!result) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Broadcast the status update to WebSocket rooms
      const wsManager = getWebSocketManager();
      if (wsManager) {
        console.log(`📢 Broadcasting process-payment update for order ${result.orderNumber}:`, {
          orderId: result.id,
          orderNumber: result.orderNumber,
          canteenId: result.canteenId,
          oldStatus: oldOrder.status,
          newStatus: result.status
        });

        // Broadcast to canteen room (for user order status page)
        wsManager.broadcastOrderStatusUpdate(result.canteenId, result, oldOrder.status, result.status);

        // Also broadcast to specific counter room if counterId is provided
        if (counterId) {
          console.log(`📢 Broadcasting process-payment update to counter room: ${counterId}`);
          wsManager.broadcastToCounter(counterId, 'order_status_changed', result);
        }
      } else {
        console.log('📡 WebSocket manager not available for process-payment broadcast');
      }

      res.json({ message: "Payment processed successfully", order: result });
    } catch (error) {
      console.error("Error processing payment:", error);
      res.status(500).json({ message: "Failed to process payment" });
    }
  });

  // Confirm offline payment and broadcast to store counters
  app.post("/api/orders/:id/confirm-payment", async (req, res) => {
    try {
      const orderId = req.params.id;
      const { counterId } = req.body;

      // Get the order before updating to capture old status
      const oldOrder = await storage.getOrder(orderId);
      if (!oldOrder) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Verify this is an offline order with pending payment
      if (!oldOrder.isOffline || oldOrder.status !== 'pending_payment' || oldOrder.paymentStatus !== 'pending') {
        return res.status(400).json({ message: "Order is not an offline order pending payment" });
      }

      // Update order status to preparing and payment status to completed
      console.log(`💳 Server: About to confirm offline payment for order ${orderId}`);
      const result = await storage.confirmOfflinePayment(orderId, counterId);
      if (!result) {
        console.log(`💳 Server: Order ${orderId} not found during confirmation`);
        return res.status(404).json({ message: "Order not found" });
      }
      console.log(`💳 Server: Order ${orderId} confirmed successfully:`, {
        id: result.id,
        orderNumber: result.orderNumber,
        status: result.status,
        paymentStatus: result.paymentStatus,
        isOffline: result.isOffline
      });

      // Broadcast the status update to WebSocket rooms
      const wsManager = getWebSocketManager();
      if (wsManager) {
        console.log(`📢 Broadcasting confirm-payment update for offline order ${result.orderNumber}:`, {
          orderId: result.id,
          orderNumber: result.orderNumber,
          canteenId: result.canteenId,
          oldStatus: oldOrder.status,
          newStatus: result.status,
          oldPaymentStatus: oldOrder.paymentStatus,
          newPaymentStatus: result.paymentStatus,
          allStoreCounterIds: result.allStoreCounterIds
        });

        // Broadcast to canteen room (for user order status page)
        wsManager.broadcastOrderStatusUpdate(result.canteenId, result, oldOrder.status, result.status);

        // Broadcast to all store counter rooms that this order should now be processed
        if (result.allStoreCounterIds && result.allStoreCounterIds.length > 0) {
          result.allStoreCounterIds.forEach((storeCounterId: string) => {
            console.log(`📢 Broadcasting offline order confirmation to store counter room: ${storeCounterId}`);
            wsManager.broadcastToCounter(storeCounterId, 'new_order', result);
          });
        }

        // Broadcast to ALL payment counters to remove the order from their UI
        if (result.allPaymentCounterIds && result.allPaymentCounterIds.length > 0) {
          result.allPaymentCounterIds.forEach((paymentCounterId: string) => {
            console.log(`📢 Broadcasting payment confirmation to payment counter room: ${paymentCounterId}`);
            wsManager.broadcastToCounter(paymentCounterId, 'payment_confirmed', result);
          });
        }

        // Also broadcast to the specific payment counter that confirmed the payment
        if (counterId) {
          console.log(`📢 Broadcasting confirm-payment update to confirming payment counter room: ${counterId}`);
          wsManager.broadcastToCounter(counterId, 'order_status_changed', result);
        }
      } else {
        console.log('📡 WebSocket manager not available for confirm-payment broadcast');
      }

      res.json({ message: "Offline payment confirmed successfully - order broadcasted to store counters", order: result });
    } catch (error) {
      console.error("Error confirming offline payment:", error);
      res.status(500).json({ message: "Failed to confirm offline payment" });
    }
  });

  // Reject offline order endpoint
  app.post("/api/orders/:id/reject", async (req, res) => {
    try {
      const orderId = req.params.id;
      const { counterId } = req.body;

      // Get the order before updating to capture old status
      const oldOrder = await storage.getOrder(orderId);
      if (!oldOrder) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Verify this is an offline order with pending payment
      if (!oldOrder.isOffline || oldOrder.status !== 'pending_payment' || oldOrder.paymentStatus !== 'pending') {
        return res.status(400).json({ message: "Order is not an offline order pending payment" });
      }

      // Update order status to rejected
      console.log(`💳 Server: About to reject offline order ${orderId} with counter ${counterId}`);
      const result = await storage.rejectOfflineOrder(orderId, counterId);
      if (!result) {
        console.log(`💳 Server: Order ${orderId} not found during rejection`);
        return res.status(404).json({ message: "Order not found" });
      }
      console.log(`💳 Server: Order ${orderId} rejected successfully:`, {
        id: result.id,
        orderNumber: result.orderNumber,
        status: result.status,
        paymentStatus: result.paymentStatus,
        isOffline: result.isOffline,
        rejectedBy: result.rejectedBy,
        allPaymentCounterIds: result.allPaymentCounterIds
      });

      // Broadcast the status update to WebSocket rooms
      const wsManager = getWebSocketManager();
      if (wsManager) {
        console.log(`📢 Broadcasting order rejection for offline order ${result.orderNumber}:`, {
          orderId: result.id,
          orderNumber: result.orderNumber,
          canteenId: result.canteenId,
          oldStatus: oldOrder.status,
          newStatus: result.status,
          oldPaymentStatus: oldOrder.paymentStatus,
          newPaymentStatus: result.paymentStatus,
          rejectedByCounter: counterId
        });

        // Broadcast to canteen room (for user order status page)
        wsManager.broadcastOrderStatusUpdate(result.canteenId, result, oldOrder.status, result.status);

        // Broadcast to all payment counters to remove the order from their UI
        if (result.allPaymentCounterIds && result.allPaymentCounterIds.length > 0) {
          console.log(`📢 Broadcasting order rejection to ${result.allPaymentCounterIds.length} payment counters:`, result.allPaymentCounterIds);
          result.allPaymentCounterIds.forEach((paymentCounterId: string) => {
            console.log(`📢 Broadcasting order rejection to payment counter room: ${paymentCounterId}`);
            const rejectionMessage = {
              type: 'order_rejected',
              data: result,
              oldStatus: oldOrder.status,
              newStatus: result.status,
              orderNumber: result.orderNumber,
              rejectedByCounter: counterId,
              message: 'Order rejected - remove from payment counter UI'
            };
            console.log(`📢 Rejection message for counter ${paymentCounterId}:`, rejectionMessage);
            wsManager.broadcastToCounter(paymentCounterId, 'order_rejected', result);
          });
        } else {
          console.log(`📢 No payment counter IDs found for order ${result.orderNumber}, cannot broadcast rejection`);
        }
      } else {
        console.log('📡 WebSocket manager not available for order rejection broadcast');
      }

      res.json({ message: "Offline order rejected successfully", order: result });
    } catch (error) {
      console.error("Error rejecting offline order:", error);
      res.status(500).json({ message: "Failed to reject offline order" });
    }
  });

  // Mark order as out for delivery
  app.post("/api/orders/:id/out-for-delivery", async (req, res) => {
    try {
      const orderId = req.params.id;
      const { counterId, deliveryPersonId, deliveryPersonEmail } = req.body;

      console.log(`🚚 POST /api/orders/${orderId}/out-for-delivery - Request received:`, {
        orderId,
        counterId,
        deliveryPersonId,
        deliveryPersonEmail
      });

      if (!orderId || orderId === 'undefined' || orderId === 'null') {
        console.error(`❌ Invalid order ID: ${orderId}`);
        return res.status(400).json({ message: "Invalid order ID" });
      }

      if (!counterId) {
        console.error(`❌ Counter ID is required but not provided`);
        return res.status(400).json({ message: "Counter ID is required" });
      }

      if (!deliveryPersonId) {
        console.error(`❌ Delivery person ID is required but not provided`);
        return res.status(400).json({ message: "Delivery person ID is required" });
      }

      if (!deliveryPersonEmail) {
        console.warn(`⚠️ Delivery person email not provided, WebSocket notification may fail`);
      }

      const oldOrder = await storage.getOrder(orderId);
      if (!oldOrder) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Mark items at counter level as out for delivery
      const result = await storage.markOrderOutForDelivery(orderId, counterId, deliveryPersonId);
      if (!result) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Verify the update was successful
      const updatedOrder = await storage.getOrder(orderId);
      console.log(`✅ Order updated. Verification:`, {
        orderId: updatedOrder?.id || updatedOrder?._id,
        orderNumber: updatedOrder?.orderNumber,
        status: updatedOrder?.status,
        deliveryPersonId: updatedOrder?.deliveryPersonId,
        expectedDeliveryPersonId: deliveryPersonId,
        itemStatusByCounter: updatedOrder?.itemStatusByCounter
      });

      if (updatedOrder?.deliveryPersonId !== deliveryPersonId) {
        console.error(`❌ WARNING: Order deliveryPersonId mismatch! Expected: ${deliveryPersonId}, Got: ${updatedOrder?.deliveryPersonId}`);
      }

      // Update delivery person stats and mark as unavailable
      const { db } = await import('./db');
      const database = db();
      let deliveryPerson = null;

      if (deliveryPersonId) {
        deliveryPerson = await database.deliveryPerson.findFirst({
          where: { deliveryPersonId }
        });

        if (deliveryPerson) {
          console.log(`🔍 Found delivery person in database:`, {
            id: deliveryPerson.id,
            deliveryPersonId: deliveryPerson.deliveryPersonId,
            name: deliveryPerson.name,
            email: deliveryPerson.email,
            requestedEmail: deliveryPersonEmail
          });

          // Verify email matches
          if (deliveryPerson.email !== deliveryPersonEmail) {
            console.warn(`⚠️ Email mismatch! Delivery person ${deliveryPersonId} has email ${deliveryPerson.email}, but assignment requested ${deliveryPersonEmail}`);
          }

          await database.deliveryPerson.update({
            where: { id: deliveryPerson.id },
            data: {
              isAvailable: false, // Mark as unavailable while delivering
              totalOrderDelivered: { increment: 1 }
            }
          });
          console.log(`✅ Assigned delivery person ${deliveryPersonId} (${deliveryPerson.email}) to order ${result.orderNumber}`);
        } else {
          console.warn(`⚠️ Delivery person ${deliveryPersonId} not found in database`);
        }
      }

      // Broadcast the status update to WebSocket rooms
      const wsManager = getWebSocketManager();
      if (wsManager) {
        // Get order ID in correct format (MongoDB uses _id)
        const orderIdForMessage = (result as any)._id?.toString() || result.id?.toString() || result.id;

        console.log(`📢 Broadcasting out-for-delivery for order ${result.orderNumber}:`, {
          orderId: orderIdForMessage,
          orderNumber: result.orderNumber,
          canteenId: result.canteenId,
          oldStatus: oldOrder.status,
          newStatus: result.status,
          deliveryPersonId,
          deliveryPersonEmail
        });

        // Broadcast to canteen room (for user order status page)
        wsManager.broadcastOrderStatusUpdate(result.canteenId, result, oldOrder.status, result.status);

        // Send notification to assigned delivery person via WebSocket
        if (deliveryPersonEmail) {
          wsManager.broadcastToDeliveryPerson(deliveryPersonEmail, {
            type: 'delivery_assignment',
            data: {
              orderId: orderIdForMessage,
              orderNumber: result.orderNumber,
              customerName: result.customerName,
              amount: result.amount,
              items: result.items,
              address: (result as any).address || 'Pickup from canteen',
              createdAt: result.createdAt,
              status: 'out_for_delivery',
              deliveryPersonId: deliveryPersonId
            }
          });
          console.log(`📤 Sent delivery assignment notification to ${deliveryPersonEmail} for order ${result.orderNumber}`);
        } else {
          console.warn(`⚠️ No delivery person email provided, cannot send WebSocket notification`);
        }

        // Broadcast to all relevant counter rooms with item-level status update
        if (result.allStoreCounterIds && result.allStoreCounterIds.length > 0) {
          result.allStoreCounterIds.forEach((storeCounterId: string) => {
            console.log(`📢 Broadcasting item-level out-for-delivery to counter room: ${storeCounterId}`);
            wsManager.broadcastToCounter(storeCounterId, 'item_status_changed', result);
          });
        }

        // Also broadcast to specific counter room if counterId is provided
        if (counterId) {
          console.log(`📢 Broadcasting item-level out-for-delivery to specific counter room: ${counterId}`);
          wsManager.broadcastToCounter(counterId, 'item_status_changed', result);
        }

        // If overall order status changed to out_for_delivery, also broadcast order status change
        if (result.status === 'out_for_delivery' && oldOrder.status !== 'out_for_delivery') {
          console.log(`📢 Broadcasting overall order status change to out_for_delivery`);
          wsManager.broadcastOrderStatusUpdate(result.canteenId, result, oldOrder.status, result.status);
        }
      } else {
        console.log('📡 WebSocket manager not available for out-for-delivery broadcast');
      }

      console.log(`✅ Order ${orderId} marked as out for delivery`);
      res.json(result);
    } catch (error) {
      console.error("Error marking order as out for delivery:", error);
      res.status(500).json({ message: "Failed to mark order as out for delivery" });
    }
  });

  // Mark order as ready
  app.post("/api/orders/:id/mark-ready", async (req, res) => {
    try {
      const orderId = req.params.id;
      const { counterId } = req.body; // counterId is optional - if not provided, all markable items will be marked ready

      // Validate orderId
      if (!orderId || orderId === 'undefined' || orderId === 'null') {
        console.error(`❌ Invalid order ID: ${orderId}`);
        return res.status(400).json({ message: "Invalid order ID" });
      }

      // Get the order before updating to capture old status
      const oldOrder = await storage.getOrder(orderId);
      if (!oldOrder) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Parse order items to check if counterId is a KOT counter
      let orderItems = [];
      try {
        orderItems = typeof oldOrder.items === 'string' ? JSON.parse(oldOrder.items) : oldOrder.items;
      } catch (error) {
        console.error('Error parsing order items:', error);
      }

      const result = await storage.markOrderReady(orderId, counterId);
      if (!result) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if items were marked ready from a KOT counter
      const kotStoreCounters = (result as any)._kotStoreCounters || [];
      const isKotCounter = kotStoreCounters.length > 0 || (counterId && orderItems.some((item: any) => item.kotCounterId === counterId));

      // Broadcast the status update to WebSocket rooms
      const wsManager = getWebSocketManager();
      if (wsManager) {
        console.log(`📢 Broadcasting mark-ready update for order ${result.orderNumber}:`, {
          orderId: result.id,
          orderNumber: result.orderNumber,
          canteenId: result.canteenId,
          oldStatus: oldOrder.status,
          newStatus: result.status,
          counterId: counterId,
          isKotCounter,
          kotStoreCounters,
          itemStatusByCounter: result.itemStatusByCounter
        });

        // Broadcast to canteen room (for user order status page)
        // Fetch full order from DB to ensure all fields are included (especially important for KOT counter updates)
        const fullOrderForUser = await storage.getOrder(orderId);
        if (!fullOrderForUser) {
          console.error(`❌ Could not fetch full order ${orderId} for user broadcast`);
        } else {
          // Prepare order data with updated itemStatusByCounter
          const orderDataForUser = {
            ...fullOrderForUser,
            itemStatusByCounter: result.itemStatusByCounter || fullOrderForUser.itemStatusByCounter,
            status: result.status || fullOrderForUser.status
          };

          console.log(`📢 Broadcasting to canteen room for user order status page:`, {
            orderNumber: orderDataForUser.orderNumber,
            canteenId: orderDataForUser.canteenId,
            itemStatusByCounter: orderDataForUser.itemStatusByCounter,
            itemStatusByCounterKeys: orderDataForUser.itemStatusByCounter ? Object.keys(orderDataForUser.itemStatusByCounter) : [],
            status: orderDataForUser.status,
            oldStatus: oldOrder.status,
            hasItems: !!orderDataForUser.items,
            itemsType: typeof orderDataForUser.items
          });

          // Always broadcast status update (even if status doesn't change, itemStatusByCounter might have changed)
          wsManager.broadcastOrderStatusUpdate(orderDataForUser.canteenId, orderDataForUser, oldOrder.status, orderDataForUser.status);
          console.log(`📢 ✅ Broadcasted order_status_changed to canteen room ${orderDataForUser.canteenId}`);

          // Also broadcast order_updated to ensure user side receives item-level status changes
          // This is important when items are marked ready from KOT counter (status might not change)
          wsManager.broadcastToCanteen(orderDataForUser.canteenId, 'order_updated', orderDataForUser);
          console.log(`📢 ✅ Broadcasted order_updated to canteen room ${orderDataForUser.canteenId}:`, {
            orderNumber: orderDataForUser.orderNumber,
            hasItemStatusByCounter: !!orderDataForUser.itemStatusByCounter
          });

          // Also broadcast item_status_changed for user side to handle item-level updates
          wsManager.broadcastToCanteen(orderDataForUser.canteenId, 'item_status_changed', orderDataForUser);
          console.log(`📢 ✅ Broadcasted item_status_changed to canteen room ${orderDataForUser.canteenId}:`, {
            orderNumber: orderDataForUser.orderNumber,
            hasItemStatusByCounter: !!orderDataForUser.itemStatusByCounter
          });
        }

        // If marked ready from KOT counter, broadcast to store counters
        if (isKotCounter && kotStoreCounters.length > 0) {
          console.log(`🍳 Items marked ready from KOT counter ${counterId}, broadcasting to store counters:`, kotStoreCounters);

          // Get the full order with all fields populated for broadcasting
          // Use the result from markOrderReady which already has the updated data
          // But fetch fresh from DB to ensure we have all fields including items
          const fullOrder = await storage.getOrder(orderId);
          if (!fullOrder) {
            console.error(`❌ Could not fetch full order ${orderId} for broadcasting`);
            // Fallback: use result if available
            if (result) {
              console.log(`⚠️ Using result data as fallback for broadcasting`);
              const fallbackOrder = {
                ...result,
                items: result.items || oldOrder.items, // Ensure items are included
                itemStatusByCounter: result.itemStatusByCounter || oldOrder.itemStatusByCounter
              };

              kotStoreCounters.forEach((storeCounterId: string) => {
                wsManager.broadcastToCounter(storeCounterId, 'item_status_changed', fallbackOrder);
                console.log(`📢 ✅ Broadcasted item_status_changed (fallback) for order ${fallbackOrder.orderNumber} to store counter ${storeCounterId}`);
              });
            }
          } else {
            // Ensure items are properly included and parsed
            let orderItems = [];
            try {
              orderItems = typeof fullOrder.items === 'string' ? JSON.parse(fullOrder.items) : fullOrder.items;
            } catch (error) {
              console.error('Error parsing order items for broadcast:', error);
              orderItems = [];
            }

            // Prepare order data with all necessary fields
            const orderDataForBroadcast = {
              ...fullOrder,
              items: typeof fullOrder.items === 'string' ? fullOrder.items : JSON.stringify(fullOrder.items || []), // Ensure items is a string
              itemStatusByCounter: result.itemStatusByCounter || fullOrder.itemStatusByCounter,
              status: result.status || fullOrder.status,
              allStoreCounterIds: fullOrder.allStoreCounterIds || result.allStoreCounterIds,
              allKotCounterIds: fullOrder.allKotCounterIds || result.allKotCounterIds,
              allCounterIds: fullOrder.allCounterIds || result.allCounterIds,
              _fromKotCounter: counterId // Flag to indicate this came from KOT counter
            };

            console.log(`📢 Preparing to broadcast order ${orderDataForBroadcast.orderNumber} to store counters:`, {
              orderId: orderDataForBroadcast.id,
              orderNumber: orderDataForBroadcast.orderNumber,
              itemsCount: orderItems.length,
              itemStatusByCounter: orderDataForBroadcast.itemStatusByCounter,
              allStoreCounterIds: orderDataForBroadcast.allStoreCounterIds,
              storeCountersToNotify: kotStoreCounters
            });

            kotStoreCounters.forEach((storeCounterId: string) => {
              // Use item_status_changed instead of new_order to properly update existing orders
              wsManager.broadcastToCounter(storeCounterId, 'item_status_changed', orderDataForBroadcast);
              console.log(`📢 ✅ Broadcasted item_status_changed for order ${orderDataForBroadcast.orderNumber} to store counter ${storeCounterId} (from KOT counter ${counterId})`);
            });
          }
        }

        // Broadcast to all relevant counter rooms (for status updates)
        if (result.allStoreCounterIds && result.allStoreCounterIds.length > 0) {
          result.allStoreCounterIds.forEach((storeCounterId: string) => {
            // Skip if we already broadcasted from KOT counter
            if (!(isKotCounter && kotStoreCounters.includes(storeCounterId))) {
              console.log(`📢 Broadcasting item-level status update to counter room: ${storeCounterId}`);
              wsManager.broadcastToCounter(storeCounterId, 'item_status_changed', result);
            }
          });
        }

        // Also broadcast to specific counter room if counterId is provided
        if (counterId) {
          console.log(`📢 Broadcasting mark-ready update to specific counter room: ${counterId}`);
          wsManager.broadcastToCounter(counterId, 'order_status_changed', result);
        }
      } else {
        console.log('📡 WebSocket manager not available for mark-ready broadcast');
      }

      res.json({ message: "Order marked as ready", order: result });
    } catch (error) {
      console.error("Error marking order as ready:", error);
      res.status(500).json({ message: "Failed to mark order as ready" });
    }
  });

  // Update order status
  app.post("/api/orders/:id/update-status", async (req, res) => {
    try {
      const orderId = req.params.id;
      const { status, counterId } = req.body;

      // Get the order before updating to capture old status
      const oldOrder = await storage.getOrder(orderId);
      if (!oldOrder) {
        return res.status(404).json({ message: "Order not found" });
      }

      const result = await storage.updateOrderStatus(orderId, status, counterId);
      if (!result) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Broadcast the status update to WebSocket rooms
      const wsManager = getWebSocketManager();
      if (wsManager) {
        console.log(`📢 Broadcasting update-status for order ${result.orderNumber}:`, {
          orderId: result.id,
          orderNumber: result.orderNumber,
          canteenId: result.canteenId,
          oldStatus: oldOrder.status,
          newStatus: result.status
        });

        // Broadcast to canteen room (for user order status page)
        wsManager.broadcastOrderStatusUpdate(result.canteenId, result, oldOrder.status, result.status);

        // Also broadcast to specific counter room if counterId is provided
        if (counterId) {
          console.log(`📢 Broadcasting update-status to counter room: ${counterId}`);
          wsManager.broadcastToCounter(counterId, 'order_status_changed', result);
        }
      } else {
        console.log('📡 WebSocket manager not available for update-status broadcast');
      }

      res.json({ message: "Order status updated", order: result });
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Complete order
  app.post("/api/orders/:id/complete", async (req, res) => {
    try {
      const orderId = req.params.id;
      const { counterId } = req.body;

      // Get the order before updating to capture old status
      const oldOrder = await storage.getOrder(orderId);
      if (!oldOrder) {
        return res.status(404).json({ message: "Order not found" });
      }

      const result = await storage.completeOrder(orderId, counterId);
      if (!result) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Broadcast the status update to WebSocket rooms
      const wsManager = getWebSocketManager();
      if (wsManager) {
        console.log(`📢 Broadcasting complete order for order ${result.orderNumber}:`, {
          orderId: result.id,
          orderNumber: result.orderNumber,
          canteenId: result.canteenId,
          oldStatus: oldOrder.status,
          newStatus: result.status
        });

        // Broadcast to canteen room (for user order status page)
        wsManager.broadcastOrderStatusUpdate(result.canteenId, result, oldOrder.status, result.status);

        // Also broadcast to specific counter room if counterId is provided
        if (counterId) {
          console.log(`📢 Broadcasting complete order to counter room: ${counterId}`);
          wsManager.broadcastToCounter(counterId, 'order_status_changed', result);
        }
      } else {
        console.log('📡 WebSocket manager not available for complete order broadcast');
      }

      res.json({ message: "Order completed", order: result });
    } catch (error) {
      console.error("Error completing order:", error);
      res.status(500).json({ message: "Failed to complete order" });
    }
  });

  // Deliver order endpoint
  app.post("/api/orders/:id/deliver", async (req, res) => {
    try {
      const orderId = req.params.id;
      const { counterId, deliveryPersonId } = req.body;

      // Validate orderId
      if (!orderId || orderId === 'undefined' || orderId === 'null') {
        console.error(`❌ Invalid order ID: ${orderId}`);
        return res.status(400).json({ message: "Invalid order ID" });
      }

      console.log(`🚚 Deliver order request:`, { orderId, counterId, deliveryPersonId });

      // Get the order before updating to capture old status
      const oldOrder = await storage.getOrder(orderId);
      if (!oldOrder) {
        console.log(`❌ Order not found: ${orderId}`);
        return res.status(404).json({ message: "Order not found" });
      }

      console.log(`📦 Old order status: ${oldOrder.status}`);

      // Check if this is a delivery person delivery (either from body or order has deliveryPersonId)
      const isDeliveryPersonDelivery = !!deliveryPersonId || (!!oldOrder.deliveryPersonId && !counterId);

      // Check if this is a direct complete order request (no counterId and no deliveryPersonId)
      const isDirectComplete = !counterId && !deliveryPersonId && !oldOrder.deliveryPersonId;

      let result;
      if (isDeliveryPersonDelivery) {
        // Delivery person delivery - mark entire order as delivered immediately
        console.log(`🚚 Delivery person marking order as delivered:`, {
          orderId,
          deliveryPersonId: deliveryPersonId || oldOrder.deliveryPersonId
        });
        result = await storage.deliverOrderByDeliveryPerson(orderId, deliveryPersonId || oldOrder.deliveryPersonId);
      } else if (isDirectComplete) {
        // Direct complete - mark entire order as delivered (for POS orders without delivery person)
        console.log(`📦 Directly completing order ${orderId} (POS order without delivery person)`);
        const { Order } = await import('./models/mongodb-models');
        result = await Order.findByIdAndUpdate(
          orderId,
          {
            status: 'delivered',
            deliveredAt: new Date(),
            barcodeUsed: true
          },
          { new: true }
        );
      } else {
        // Counter delivery - mark items for specific counter
        result = await storage.deliverOrder(orderId, counterId);
      }

      if (!result) {
        console.log(`❌ Failed to deliver order: ${orderId}`);
        return res.status(404).json({ message: "Order not found" });
      }
      // Cast result to any for safe access
      const resultAny = result as any;

      console.log(`✅ Order delivered successfully:`, {
        orderId: resultAny.id,
        orderNumber: resultAny.orderNumber,
        oldStatus: oldOrder.status,
        newStatus: resultAny.status,
        canteenId: resultAny.canteenId,
        deliveryPersonId: resultAny.deliveryPersonId,
        isDeliveryPersonDelivery
      });

      // Broadcast the status update to WebSocket rooms
      const wsManager = getWebSocketManager();
      if (wsManager) {
        // Cast result to any to access properties safely
        const resultAny = result as any;
        console.log(`📢 Broadcasting deliver order for order ${resultAny.orderNumber}:`, {
          orderId: resultAny.id,
          orderNumber: resultAny.orderNumber,
          canteenId: resultAny.canteenId,
          oldStatus: oldOrder.status,
          newStatus: resultAny.status,
          isDeliveryPersonDelivery
        });

        // Broadcast to canteen room (for user order status page)
        // Ensure order data includes all identifiers for proper matching on client
        const orderDataForBroadcast = {
          ...(resultAny.toObject ? resultAny.toObject() : resultAny),
          id: resultAny.id || resultAny._id,
          _id: resultAny._id || resultAny.id,
          orderNumber: resultAny.orderNumber
        };
        wsManager.broadcastOrderStatusUpdate(resultAny.canteenId, orderDataForBroadcast, oldOrder.status, resultAny.status);

        // Broadcast to all relevant counter rooms for item-level updates
        if (resultAny.allStoreCounterIds && resultAny.allStoreCounterIds.length > 0) {
          resultAny.allStoreCounterIds.forEach((storeCounterId: string) => {
            console.log(`📢 Broadcasting item-level delivery update to counter room: ${storeCounterId}`);
            wsManager.broadcastToCounter(storeCounterId, 'item_status_changed', orderDataForBroadcast);
          });
        }

        // Also broadcast to specific counter room if counterId is provided
        if (counterId) {
          console.log(`📢 Broadcasting deliver order to counter room: ${counterId}`);
          wsManager.broadcastToCounter(counterId, 'order_status_changed', orderDataForBroadcast);
        }

        // Broadcast to delivery person if this was a delivery person delivery
        if (isDeliveryPersonDelivery && resultAny.deliveryPersonId) {
          try {
            const { db } = await import('./db');
            const database = db();
            const deliveryPerson = await database.deliveryPerson.findUnique({
              where: { deliveryPersonId: resultAny.deliveryPersonId }
            });

            if (deliveryPerson && deliveryPerson.email) {
              console.log(`📢 Broadcasting delivery completion to delivery person: ${deliveryPerson.email}`);
              wsManager.broadcastToDeliveryPerson(deliveryPerson.email, {
                type: 'order_delivered',
                data: orderDataForBroadcast,
                orderNumber: resultAny.orderNumber,
                status: resultAny.status
              });
            }
          } catch (error) {
            console.error('❌ Error broadcasting to delivery person:', error);
          }
        }
      } else {
        console.log('📡 WebSocket manager not available for deliver order broadcast');
      }

      res.json({ message: "Order delivered", order: result });
    } catch (error) {
      console.error("Error delivering order:", error);
      res.status(500).json({ message: "Failed to deliver order" });
    }
  });

  // ========== Delivery Person Management API Routes ==========

  // Helper function to generate unique delivery person ID
  async function generateDeliveryPersonId(database: any): Promise<string> {
    // Get the count of existing delivery persons
    const count = await database.deliveryPerson.count();
    // Generate ID in format DP001, DP002, etc.
    const nextNumber = (count + 1).toString().padStart(3, '0');
    return `DP${nextNumber}`;
  }

  // Get all delivery persons for a canteen
  app.get("/api/canteens/:canteenId/delivery-persons", async (req, res) => {
    try {
      console.log("🚚 GET /api/canteens/:canteenId/delivery-persons - Request received");
      const { canteenId } = req.params;
      console.log("🚚 Canteen ID:", canteenId);

      if (!canteenId) {
        return res.status(400).json({ error: "Canteen ID is required" });
      }

      const { db } = await import('./db');
      const database = db();

      // Check if deliveryPerson model exists - Prisma uses camelCase for model names
      if (!database.deliveryPerson) {
        console.error("❌ DeliveryPerson model not found in Prisma client.");
        console.error("Available models:", Object.keys(database).filter(k => !k.startsWith('_') && typeof (database as any)[k] === 'object'));
        return res.status(500).json({
          error: "DeliveryPerson model not available. Please restart the server after running 'npx prisma generate'"
        });
      }

      const deliveryPersons = await database.deliveryPerson.findMany({
        where: {
          canteenId,
          isActive: true
        },
        orderBy: [
          { isAvailable: 'desc' }, // Available first
          { totalOrderDelivered: 'desc' }, // Then by delivery count
          { createdAt: 'desc' }
        ]
      });

      console.log(`🚚 Found ${deliveryPersons.length} delivery persons for canteen ${canteenId}:`,
        deliveryPersons.map(dp => ({
          id: dp.id,
          deliveryPersonId: dp.deliveryPersonId,
          name: dp.name,
          email: dp.email
        }))
      );

      res.json(deliveryPersons);
    } catch (error: any) {
      console.error("❌ Error fetching delivery persons:", error);
      if (error.message?.includes('deliveryPerson') || error.message?.includes('findMany')) {
        return res.status(500).json({
          error: "Database model not available. Please restart the server after running 'npx prisma generate'"
        });
      }
      res.status(500).json({ error: "Failed to fetch delivery persons" });
    }
  });

  // Get a specific delivery person
  app.get("/api/delivery-persons/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { db } = await import('./db');
      const database = db();

      const deliveryPerson = await database.deliveryPerson.findUnique({
        where: { id: parseInt(id) }
      });

      if (!deliveryPerson) {
        return res.status(404).json({ error: "Delivery person not found" });
      }

      res.json(deliveryPerson);
    } catch (error) {
      console.error("Error fetching delivery person:", error);
      res.status(500).json({ error: "Failed to fetch delivery person" });
    }
  });

  // Get delivery person by email (for delivery person portal)
  app.get("/api/delivery-persons/by-email/:email", async (req, res) => {
    try {
      const { email } = req.params;
      const { db } = await import('./db');
      const database = db();

      console.log(`🔍 GET /api/delivery-persons/by-email/${email} - Fetching delivery person`);

      // Check for multiple records with same email
      const allWithEmail = await database.deliveryPerson.findMany({
        where: { email: email }
      });

      if (allWithEmail.length > 1) {
        console.warn(`⚠️ Found ${allWithEmail.length} delivery persons with email ${email}:`,
          allWithEmail.map(dp => ({ id: dp.id, deliveryPersonId: dp.deliveryPersonId, name: dp.name, isActive: dp.isActive }))
        );
      }

      // Prioritize active delivery persons, then by most recent
      const deliveryPerson = await database.deliveryPerson.findFirst({
        where: { email: email },
        orderBy: [
          { isActive: 'desc' }, // Active first
          { createdAt: 'desc' } // Then most recent
        ]
      });

      if (!deliveryPerson) {
        console.error(`❌ Delivery person not found for email: ${email}`);
        return res.status(404).json({ error: "Delivery person not found" });
      }

      console.log(`✅ Found delivery person by email:`, {
        id: deliveryPerson.id,
        deliveryPersonId: deliveryPerson.deliveryPersonId,
        name: deliveryPerson.name,
        email: deliveryPerson.email,
        canteenId: deliveryPerson.canteenId
      });

      res.json(deliveryPerson);
    } catch (error) {
      console.error("Error fetching delivery person by email:", error);
      res.status(500).json({ error: "Failed to fetch delivery person" });
    }
  });

  // Create a new delivery person
  app.post("/api/canteens/:canteenId/delivery-persons", async (req, res) => {
    try {
      const { canteenId } = req.params;
      const { db } = await import('./db');
      const database = db();
      const { insertDeliveryPersonSchema, insertUserSchema } = await import('@shared/schema');
      const bcrypt = await import('bcrypt');

      // Prepare data - convert empty strings to undefined
      const email = req.body.email && req.body.email.trim() !== '' ? req.body.email.trim() : undefined;

      // If email is provided, check if user already exists
      let existingUser = null;
      if (email) {
        existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.passwordHash) {
          // User exists with password - cannot create duplicate
          return res.status(409).json({ error: "A user with this email already exists" });
        }
        // If user exists without passwordHash, we'll update it after creating delivery person
      }

      const dataToValidate = {
        canteenId,
        name: req.body.name,
        phoneNumber: req.body.phoneNumber,
        email: email,
        employeeId: req.body.employeeId && req.body.employeeId.trim() !== '' ? req.body.employeeId.trim() : undefined,
        address: req.body.address || undefined,
        city: req.body.city || undefined,
        state: req.body.state || undefined,
        pincode: req.body.pincode || undefined,
        dateOfBirth: req.body.dateOfBirth || undefined,
        dateOfJoining: req.body.dateOfJoining || undefined,
        vehicleNumber: req.body.vehicleNumber || undefined,
        licenseNumber: req.body.licenseNumber || undefined,
        emergencyContact: req.body.emergencyContact || undefined,
        emergencyContactName: req.body.emergencyContactName || undefined,
        salary: req.body.salary ? parseFloat(req.body.salary) : undefined,
        isActive: true,
        notes: req.body.notes || undefined,
      };

      // Validate input
      const validatedData = insertDeliveryPersonSchema.parse(dataToValidate);

      // Generate unique delivery person ID
      const deliveryPersonId = await generateDeliveryPersonId(database);

      // Create delivery person in PostgreSQL
      const deliveryPerson = await database.deliveryPerson.create({
        data: {
          ...validatedData,
          deliveryPersonId,
        }
      });

      // If email is provided, create or update User account with delivery_person role
      let createdUser = null;
      if (email) {
        try {
          // Get password from request body
          const password = req.body.password;

          if (!password || password.trim() === '') {
            // Rollback: Delete the delivery person if password is missing
            await database.deliveryPerson.delete({ where: { id: deliveryPerson.id } });
            return res.status(400).json({ error: "Password is required when email is provided" });
          }

          // Validate password strength (minimum 6 characters)
          if (password.length < 6) {
            // Rollback: Delete the delivery person if password is invalid
            await database.deliveryPerson.delete({ where: { id: deliveryPerson.id } });
            return res.status(400).json({ error: "Password must be at least 6 characters long" });
          }

          // Hash the password
          const saltRounds = 10;
          const passwordHash = await bcrypt.default.hash(password, saltRounds);

          if (existingUser) {
            // User exists but doesn't have passwordHash - update it
            await storage.updateUser(existingUser.id, {
              passwordHash,
              role: 'delivery_person',
              isProfileComplete: true
            });
            createdUser = await storage.getUser(existingUser.id);
            console.log(`✅ Updated existing user account for delivery person: ${email}`);
            console.log(`   User ID: ${createdUser?.id}, Email: ${createdUser?.email}`);
          } else {
            // Create new user account
            const userData = {
              email: email,
              name: validatedData.name,
              phoneNumber: validatedData.phoneNumber,
              role: 'delivery_person',
              passwordHash: passwordHash,
              isProfileComplete: true, // Delivery person profile is already complete
            };

            const validatedUserData = insertUserSchema.parse(userData);
            createdUser = await storage.createUser(validatedUserData);

            console.log(`✅ Created user account for delivery person: ${email} with role: delivery_person`);
            console.log(`   User ID: ${createdUser.id}, Email: ${createdUser.email}`);
          }

          // Note: Password is set by canteen owner, no need to log it
        } catch (userError: any) {
          console.error("❌ Error creating/updating user account for delivery person:", userError);

          // Rollback: Delete the delivery person if user creation/update fails
          try {
            await database.deliveryPerson.delete({ where: { id: deliveryPerson.id } });
            console.log(`🔄 Rolled back: Deleted delivery person ${deliveryPersonId} due to user creation failure`);
          } catch (deleteError) {
            console.error("❌ Failed to rollback delivery person deletion:", deleteError);
          }

          // If user creation fails, we still have the delivery person record
          // Log the error but don't fail the entire request
          if (userError.code === 'P2002') {
            console.warn(`⚠️ User with email ${email} already exists, skipping user creation`);
            return res.status(409).json({ error: "A user with this email already exists" });
          }

          // Return detailed error for other cases
          const errorMessage = userError.message || 'Unknown error';
          console.error(`❌ User creation/update failed: ${errorMessage}`);
          return res.status(500).json({
            error: "Failed to create/update user account for delivery person",
            details: errorMessage
          });
        }
      }

      console.log(`✅ Created delivery person: ${deliveryPersonId} for canteen ${canteenId}`);
      if (createdUser) {
        console.log(`   Associated user account created: ${createdUser.email} (ID: ${createdUser.id})`);
      }

      res.status(201).json({
        ...deliveryPerson,
        userCreated: !!createdUser,
        userId: createdUser?.id
      });
    } catch (error: any) {
      console.error("❌ Error creating delivery person:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      if (error.code === 'P2002') {
        return res.status(409).json({ error: "Delivery person ID already exists" });
      }
      res.status(500).json({ error: "Failed to create delivery person" });
    }
  });

  // Update a delivery person
  app.put("/api/delivery-persons/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { db } = await import('./db');
      const database = db();

      // Check if delivery person exists
      const existing = await database.deliveryPerson.findUnique({
        where: { id: parseInt(id) }
      });

      if (!existing) {
        return res.status(404).json({ error: "Delivery person not found" });
      }

      // Prepare update data
      const updateData: any = {};
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.phoneNumber !== undefined) updateData.phoneNumber = req.body.phoneNumber;
      if (req.body.email !== undefined) updateData.email = req.body.email && req.body.email.trim() !== '' ? req.body.email.trim() : null;
      if (req.body.employeeId !== undefined) updateData.employeeId = req.body.employeeId && req.body.employeeId.trim() !== '' ? req.body.employeeId.trim() : null;
      if (req.body.address !== undefined) updateData.address = req.body.address || null;
      if (req.body.city !== undefined) updateData.city = req.body.city || null;
      if (req.body.state !== undefined) updateData.state = req.body.state || null;
      if (req.body.pincode !== undefined) updateData.pincode = req.body.pincode || null;
      if (req.body.dateOfBirth !== undefined) updateData.dateOfBirth = req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : null;
      if (req.body.dateOfJoining !== undefined) updateData.dateOfJoining = req.body.dateOfJoining ? new Date(req.body.dateOfJoining) : null;
      if (req.body.vehicleNumber !== undefined) updateData.vehicleNumber = req.body.vehicleNumber || null;
      if (req.body.licenseNumber !== undefined) updateData.licenseNumber = req.body.licenseNumber || null;
      if (req.body.emergencyContact !== undefined) updateData.emergencyContact = req.body.emergencyContact || null;
      if (req.body.emergencyContactName !== undefined) updateData.emergencyContactName = req.body.emergencyContactName || null;
      if (req.body.salary !== undefined) updateData.salary = req.body.salary ? parseFloat(req.body.salary) : null;
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
      if (req.body.isAvailable !== undefined) updateData.isAvailable = req.body.isAvailable;
      if (req.body.totalOrderDelivered !== undefined) updateData.totalOrderDelivered = parseInt(req.body.totalOrderDelivered);
      if (req.body.notes !== undefined) updateData.notes = req.body.notes || null;

      const deliveryPerson = await database.deliveryPerson.update({
        where: { id: parseInt(id) },
        data: updateData
      });

      res.json(deliveryPerson);
    } catch (error) {
      console.error("Error updating delivery person:", error);
      res.status(500).json({ error: "Failed to update delivery person" });
    }
  });

  // Delete a delivery person (soft delete by setting isActive to false)
  app.delete("/api/delivery-persons/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { db } = await import('./db');
      const database = db();

      const deliveryPerson = await database.deliveryPerson.findUnique({
        where: { id: parseInt(id) }
      });

      if (!deliveryPerson) {
        return res.status(404).json({ error: "Delivery person not found" });
      }

      // Soft delete - set isActive to false
      await database.deliveryPerson.update({
        where: { id: parseInt(id) },
        data: { isActive: false }
      });

      res.json({ message: "Delivery person deleted successfully" });
    } catch (error) {
      console.error("Error deleting delivery person:", error);
      res.status(500).json({ error: "Failed to delete delivery person" });
    }
  });

  // Get orders assigned to a delivery person
  app.get("/api/delivery-persons/:id/orders", async (req, res) => {
    try {
      const { id } = req.params;
      const { db } = await import('./db');
      const database = db();
      const { Order } = await import('./models/mongodb-models');

      // Get delivery person to find their deliveryPersonId
      const deliveryPerson = await database.deliveryPerson.findUnique({
        where: { id: parseInt(id) }
      });

      if (!deliveryPerson) {
        return res.status(404).json({ error: "Delivery person not found" });
      }

      // Get orders assigned to this delivery person that are not completed/delivered
      const orders = await Order.find({
        deliveryPersonId: deliveryPerson.deliveryPersonId,
        status: { $nin: ['completed', 'delivered', 'cancelled'] }
      }).sort({ createdAt: -1 });

      res.json(orders.map(order => ({
        id: (order as any)._id?.toString() || (order as any).id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        items: order.items,
        amount: order.amount,
        status: order.status,
        estimatedTime: order.estimatedTime,
        barcode: order.barcode,
        canteenId: order.canteenId,
        deliveryPersonId: order.deliveryPersonId,
        orderType: order.orderType,
        deliveryAddress: order.deliveryAddress,
        itemStatusByCounter: order.itemStatusByCounter,
        createdAt: order.createdAt
      })));
    } catch (error) {
      console.error("Error fetching delivery person orders:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Get orders assigned to a delivery person by email (for delivery person portal)
  app.get("/api/delivery-persons/by-email/:email/orders", async (req, res) => {
    try {
      const { email } = req.params;
      const { db } = await import('./db');
      const database = db();
      const { Order } = await import('./models/mongodb-models');

      // Get delivery person by email to find their deliveryPersonId
      const deliveryPerson = await database.deliveryPerson.findFirst({
        where: { email: email }
      });

      if (!deliveryPerson) {
        console.error(`❌ Delivery person not found for email: ${email}`);
        return res.status(404).json({ error: "Delivery person not found" });
      }

      console.log(`🔍 Fetching orders for delivery person:`, {
        email,
        deliveryPersonId: deliveryPerson.deliveryPersonId,
        deliveryPersonName: deliveryPerson.name,
        isActive: deliveryPerson.isActive,
        isAvailable: deliveryPerson.isAvailable
      });

      // Get all orders assigned to this delivery person (active and completed)
      const activeOrders = await Order.find({
        deliveryPersonId: deliveryPerson.deliveryPersonId,
        status: { $nin: ['completed', 'delivered', 'cancelled'] }
      }).sort({ createdAt: -1 });

      console.log(`📦 Found ${activeOrders.length} active orders for delivery person ${deliveryPerson.deliveryPersonId}:`,
        activeOrders.map((o: any) => ({
          orderNumber: o.orderNumber,
          status: o.status,
          deliveryPersonId: o.deliveryPersonId
        }))
      );

      const completedOrders = await Order.find({
        deliveryPersonId: deliveryPerson.deliveryPersonId,
        status: { $in: ['completed', 'delivered'] }
      }).sort({ createdAt: -1 }).limit(20); // Limit to last 20 completed orders

      // Get all counters for the canteen to map counter IDs to names
      const { Counter } = await import('./models/mongodb-models');
      const allCanteenIds = Array.from(new Set([...activeOrders.map((o: any) => o.canteenId), ...completedOrders.map((o: any) => o.canteenId)]));
      const counters = await Counter.find({
        canteenId: { $in: allCanteenIds },
        type: 'store'
      });
      const counterMap: { [key: string]: { id: string; name: string; code: string } } = {};
      counters.forEach((c: any) => {
        counterMap[c.counterId] = { id: c.counterId, name: c.name, code: c.code };
      });

      res.json({
        active: activeOrders.map(order => ({
          id: (order as any)._id.toString(),
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          items: order.items,
          amount: order.amount,
          status: order.status,
          estimatedTime: order.estimatedTime,
          barcode: order.barcode,
          canteenId: order.canteenId,
          deliveryPersonId: order.deliveryPersonId,
          orderType: order.orderType,
          deliveryAddress: order.deliveryAddress,
          itemStatusByCounter: order.itemStatusByCounter || {},
          allStoreCounterIds: order.allStoreCounterIds || [],
          createdAt: order.createdAt,
          // Include counter information for frontend
          counterMap: counterMap
        })),
        completed: completedOrders.map(order => ({
          id: (order as any)._id.toString(),
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          items: order.items,
          amount: order.amount,
          status: order.status,
          estimatedTime: order.estimatedTime,
          barcode: order.barcode,
          canteenId: order.canteenId,
          deliveryPersonId: order.deliveryPersonId,
          orderType: order.orderType,
          deliveryAddress: order.deliveryAddress,
          itemStatusByCounter: order.itemStatusByCounter || {},
          allStoreCounterIds: order.allStoreCounterIds || [],
          createdAt: order.createdAt,
          deliveredAt: order.deliveredAt,
          // Include counter information for frontend
          counterMap: counterMap
        }))
      });
    } catch (error) {
      console.error("Error fetching delivery person orders by email:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Accept delivery assignment
  app.post("/api/delivery-assignments/:orderId/accept", async (req, res) => {
    try {
      const { orderId } = req.params;
      const { deliveryPersonEmail } = req.body;

      if (!deliveryPersonEmail) {
        return res.status(400).json({ error: "Delivery person email is required" });
      }

      const { deliveryAssignmentService } = await import('./delivery-assignment-service');
      const success = await deliveryAssignmentService.acceptAssignment(orderId, deliveryPersonEmail);

      if (success) {
        res.json({ success: true, message: "Assignment accepted" });
      } else {
        res.status(400).json({ error: "Failed to accept assignment" });
      }
    } catch (error) {
      console.error("Error accepting delivery assignment:", error);
      res.status(500).json({ error: "Failed to accept assignment" });
    }
  });

  // Reject delivery assignment
  app.post("/api/delivery-assignments/:orderId/reject", async (req, res) => {
    try {
      const { orderId } = req.params;
      const { deliveryPersonEmail } = req.body;

      if (!deliveryPersonEmail) {
        return res.status(400).json({ error: "Delivery person email is required" });
      }

      const { deliveryAssignmentService } = await import('./delivery-assignment-service');
      const success = await deliveryAssignmentService.rejectAssignment(orderId, deliveryPersonEmail);

      if (success) {
        res.json({ success: true, message: "Assignment rejected" });
      } else {
        res.status(400).json({ error: "Failed to reject assignment" });
      }
    } catch (error) {
      console.error("Error rejecting delivery assignment:", error);
      res.status(500).json({ error: "Failed to reject assignment" });
    }
  });

  // Get pending assignment for delivery person
  app.get("/api/delivery-assignments/pending", async (req, res) => {
    try {
      const { email } = req.query;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: "Email is required" });
      }

      const { deliveryAssignmentService } = await import('./delivery-assignment-service');
      const assignment = await deliveryAssignmentService.getPendingAssignmentForPerson(email);

      if (assignment) {
        // Get order details
        const order = await storage.getOrder(assignment.orderId);
        if (order) {
          res.json({
            hasPending: true,
            assignment: {
              orderId: assignment.orderId,
              orderNumber: assignment.orderNumber,
              order: order,
              expiresAt: assignment.startTime + 120000 - (Date.now() - assignment.startTime)
            }
          });
        } else {
          res.json({ hasPending: false });
        }
      } else {
        res.json({ hasPending: false });
      }
    } catch (error) {
      console.error("Error getting pending assignment:", error);
      res.status(500).json({ error: "Failed to get pending assignment" });
    }
  });

  // Register Web Push API routes
  app.use('/api/push', webPushRoutes);

  // Register System Settings API routes
  app.use('/api/system-settings', systemSettingsRoutes);
  app.use('/api/database', databaseManagementRoutes);

  // Register Google OAuth API routes
  app.use('/api/auth/google', googleAuthRoutes);

  // Register Email/Password Authentication API routes
  app.use('/api/auth', authRoutes);

  // Register Temporary User Session API routes
  const { default: tempUserSessionRoutes } = await import('./routes/tempUserSession');
  app.use('/', tempUserSessionRoutes);

  // Register Restaurant Management API routes
  app.use('/', restaurantManagementRoutes);

  // Register SEO routes (sitemap, robots.txt)
  app.use('/', sitemapRoutes);

  // Register Print Agent API routes
  app.use('/api/print', printAgentRoutes);

  // Register Bidding API routes
  app.use('/api/bidding', biddingRoutes);
  app.use('/api', payoutRoutes);

  // Organization QR code scan handler - redirects to /app with organization context
  app.get('/org-qr/:organizationId/:address/:hash', async (req, res) => {
    try {
      const { organizationId, address, hash } = req.params;
      const decodedAddress = decodeURIComponent(address);

      // Validate QR code
      const { validateOrganizationQRCodeHash } = await import('@shared/qrCodeUtils');
      const validation = validateOrganizationQRCodeHash(organizationId, decodedAddress, hash);

      if (!validation.isValid) {
        // Redirect to login with error
        return res.redirect(`/login?error=invalid_qr&fromQR=true`);
      }

      // Store QR data in sessionStorage via redirect with query params
      // The frontend will handle this and redirect to login
      const qrData = {
        organizationId,
        address: decodedAddress,
        hash,
        timestamp: Date.now()
      };

      // Redirect to login with QR data
      const qrDataEncoded = encodeURIComponent(JSON.stringify(qrData));
      return res.redirect(`/login?orgQR=${qrDataEncoded}&fromQR=true`);
    } catch (error) {
      console.error('Error handling organization QR scan:', error);
      return res.redirect(`/login?error=qr_scan_failed&fromQR=true`);
    }
  });

  // Register Icon Generator routes
  const { registerIconRoutes } = await import('./routes/iconGenerator');
  registerIconRoutes(app);

  // ========== Coding Challenges API Routes ==========

  // Get all challenges (admin only)
  app.get("/api/admin/challenges", async (req, res) => {
    try {
      const challenges = await CodingChallenge.find().sort({ createdAt: -1 });
      res.json(challenges.map(challenge => ({
        id: (challenge as any)._id.toString(),
        name: challenge.name,
        description: challenge.description,
        questionCount: challenge.questionCount,
        totalQuestions: challenge.totalQuestions,
        tags: challenge.tags,
        xpReward: challenge.xpReward,
        link: challenge.link,
        rules: challenge.rules,
        termsAndConditions: challenge.termsAndConditions,
        isActive: challenge.isActive,
        createdAt: challenge.createdAt,
        updatedAt: challenge.updatedAt
      })));
    } catch (error) {
      console.error("Error fetching challenges:", error);
      res.status(500).json({ message: "Failed to fetch challenges" });
    }
  });

  // Get active challenges (user side)
  app.get("/api/challenges", async (req, res) => {
    try {
      const challenges = await CodingChallenge.find({ isActive: true }).sort({ createdAt: -1 });
      res.json(challenges.map(challenge => ({
        id: (challenge as any)._id.toString(),
        name: challenge.name,
        description: challenge.description,
        questionCount: challenge.questionCount,
        totalQuestions: challenge.totalQuestions,
        tags: challenge.tags,
        xpReward: challenge.xpReward,
        link: challenge.link,
        rules: challenge.rules,
        termsAndConditions: challenge.termsAndConditions,
        isActive: challenge.isActive,
        createdAt: challenge.createdAt,
        updatedAt: challenge.updatedAt
      })));
    } catch (error) {
      console.error("Error fetching active challenges:", error);
      res.status(500).json({ message: "Failed to fetch challenges" });
    }
  });

  // Create new challenge (admin only)
  app.post("/api/admin/challenges", async (req, res) => {
    try {
      const challengeData = req.body;

      // Validate required fields
      if (!challengeData.name || !challengeData.description ||
        challengeData.questionCount === undefined || challengeData.totalQuestions === undefined ||
        challengeData.xpReward === undefined) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (challengeData.xpReward < 0) {
        return res.status(400).json({ message: "XP reward must be non-negative" });
      }

      if (challengeData.questionCount < 0 || challengeData.totalQuestions < 1) {
        return res.status(400).json({ message: "Invalid question count" });
      }

      const challenge = new CodingChallenge({
        name: challengeData.name,
        description: challengeData.description,
        questionCount: challengeData.questionCount,
        totalQuestions: challengeData.totalQuestions,
        tags: Array.isArray(challengeData.tags) ? challengeData.tags : [],
        xpReward: challengeData.xpReward,
        link: challengeData.link || undefined,
        rules: challengeData.rules || undefined,
        termsAndConditions: challengeData.termsAndConditions || undefined,
        isActive: challengeData.isActive !== undefined ? challengeData.isActive : true
      });

      await challenge.save();

      res.status(201).json({
        id: (challenge as any)._id.toString(),
        name: challenge.name,
        description: challenge.description,
        questionCount: challenge.questionCount,
        totalQuestions: challenge.totalQuestions,
        tags: challenge.tags,
        xpReward: challenge.xpReward,
        link: challenge.link,
        rules: challenge.rules,
        termsAndConditions: challenge.termsAndConditions,
        isActive: challenge.isActive,
        createdAt: challenge.createdAt,
        updatedAt: challenge.updatedAt
      });
    } catch (error) {
      console.error("Error creating challenge:", error);
      res.status(500).json({ message: "Failed to create challenge" });
    }
  });

  // Update challenge (admin only)
  app.put("/api/admin/challenges/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const challengeData = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid challenge ID" });
      }

      const challenge = await CodingChallenge.findById(id);
      if (!challenge) {
        return res.status(404).json({ message: "Challenge not found" });
      }

      // Update fields
      if (challengeData.name !== undefined) challenge.name = challengeData.name;
      if (challengeData.description !== undefined) challenge.description = challengeData.description;
      if (challengeData.questionCount !== undefined) challenge.questionCount = challengeData.questionCount;
      if (challengeData.totalQuestions !== undefined) challenge.totalQuestions = challengeData.totalQuestions;
      if (challengeData.tags !== undefined) challenge.tags = Array.isArray(challengeData.tags) ? challengeData.tags : [];
      if (challengeData.xpReward !== undefined) challenge.xpReward = challengeData.xpReward;
      if (challengeData.link !== undefined) challenge.link = challengeData.link || undefined;
      if (challengeData.rules !== undefined) challenge.rules = challengeData.rules || undefined;
      if (challengeData.termsAndConditions !== undefined) challenge.termsAndConditions = challengeData.termsAndConditions || undefined;
      if (challengeData.isActive !== undefined) challenge.isActive = challengeData.isActive;

      await challenge.save();

      res.json({
        id: (challenge as any)._id.toString(),
        name: challenge.name,
        description: challenge.description,
        questionCount: challenge.questionCount,
        totalQuestions: challenge.totalQuestions,
        tags: challenge.tags,
        xpReward: challenge.xpReward,
        link: challenge.link,
        rules: challenge.rules,
        termsAndConditions: challenge.termsAndConditions,
        isActive: challenge.isActive,
        createdAt: challenge.createdAt,
        updatedAt: challenge.updatedAt
      });
    } catch (error) {
      console.error("Error updating challenge:", error);
      res.status(500).json({ message: "Failed to update challenge" });
    }
  });

  // Delete challenge (admin only)
  app.delete("/api/admin/challenges/:id", async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid challenge ID" });
      }

      const challenge = await CodingChallenge.findByIdAndDelete(id);
      if (!challenge) {
        return res.status(404).json({ message: "Challenge not found" });
      }

      res.json({ message: "Challenge deleted successfully" });
    } catch (error) {
      console.error("Error deleting challenge:", error);
      res.status(500).json({ message: "Failed to delete challenge" });
    }
  });

  // Toggle challenge active status (admin only)
  app.patch("/api/admin/challenges/:id/toggle-active", async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid challenge ID" });
      }

      const challenge = await CodingChallenge.findById(id);
      if (!challenge) {
        return res.status(404).json({ message: "Challenge not found" });
      }

      challenge.isActive = isActive !== undefined ? isActive : !challenge.isActive;
      await challenge.save();

      res.json({
        id: (challenge as any)._id.toString(),
        isActive: challenge.isActive
      });
    } catch (error) {
      console.error("Error toggling challenge status:", error);
      res.status(500).json({ message: "Failed to toggle challenge status" });
    }
  });

  // User Address Routes
  // Get all addresses for a user
  app.get("/api/addresses", async (req, res) => {
    try {
      const userId = parseInt(req.query.userId as string);

      if (!userId || isNaN(userId)) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const { UserAddress } = await import('./models/mongodb-models');
      const addresses = await UserAddress.find({ userId }).sort({ isDefault: -1, createdAt: -1 });

      res.json(addresses.map((addr: any) => ({
        id: (addr._id as any).toString(),
        userId: addr.userId,
        label: addr.label,
        fullName: addr.fullName,
        phoneNumber: addr.phoneNumber,
        addressLine1: addr.addressLine1,
        addressLine2: addr.addressLine2,
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        landmark: addr.landmark,
        isDefault: addr.isDefault,
        createdAt: addr.createdAt,
        updatedAt: addr.updatedAt
      })));
    } catch (error) {
      console.error("Error fetching addresses:", error);
      res.status(500).json({ error: "Failed to fetch addresses" });
    }
  });

  // Create a new address
  app.post("/api/addresses", async (req, res) => {
    try {
      const { userId, label, fullName, phoneNumber, addressLine1, addressLine2, city, state, pincode, landmark, isDefault } = req.body;

      if (!userId || !label || !fullName || !phoneNumber || !addressLine1 || !city || !state || !pincode) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const { UserAddress } = await import('./models/mongodb-models');

      // If this is set as default, unset other default addresses
      if (isDefault) {
        await UserAddress.updateMany({ userId, isDefault: true }, { isDefault: false });
      }

      const address = new UserAddress({
        userId,
        label,
        fullName,
        phoneNumber,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        landmark,
        isDefault: isDefault || false
      });

      await address.save();

      res.status(201).json({
        id: (address as any)._id.toString(),
        userId: address.userId,
        label: address.label,
        fullName: address.fullName,
        phoneNumber: address.phoneNumber,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        landmark: address.landmark,
        isDefault: address.isDefault,
        createdAt: address.createdAt,
        updatedAt: address.updatedAt
      });
    } catch (error) {
      console.error("Error creating address:", error);
      res.status(500).json({ error: "Failed to create address" });
    }
  });

  // Update an address
  app.put("/api/addresses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { label, fullName, phoneNumber, addressLine1, addressLine2, city, state, pincode, landmark, isDefault } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid address ID" });
      }

      const { UserAddress } = await import('./models/mongodb-models');
      const address = await UserAddress.findById(id);

      if (!address) {
        return res.status(404).json({ error: "Address not found" });
      }

      // If setting as default, unset other default addresses for this user
      if (isDefault && !address.isDefault) {
        await UserAddress.updateMany({ userId: address.userId, isDefault: true }, { isDefault: false });
      }

      // Update fields
      if (label !== undefined) address.label = label;
      if (fullName !== undefined) address.fullName = fullName;
      if (phoneNumber !== undefined) address.phoneNumber = phoneNumber;
      if (addressLine1 !== undefined) address.addressLine1 = addressLine1;
      if (addressLine2 !== undefined) address.addressLine2 = addressLine2;
      if (city !== undefined) address.city = city;
      if (state !== undefined) address.state = state;
      if (pincode !== undefined) address.pincode = pincode;
      if (landmark !== undefined) address.landmark = landmark;
      if (isDefault !== undefined) address.isDefault = isDefault;

      await address.save();

      res.json({
        id: (address as any)._id.toString(),
        userId: address.userId,
        label: address.label,
        fullName: address.fullName,
        phoneNumber: address.phoneNumber,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        landmark: address.landmark,
        isDefault: address.isDefault,
        createdAt: address.createdAt,
        updatedAt: address.updatedAt
      });
    } catch (error) {
      console.error("Error updating address:", error);
      res.status(500).json({ error: "Failed to update address" });
    }
  });

  // Delete an address
  app.delete("/api/addresses/:id", async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid address ID" });
      }

      const { UserAddress } = await import('./models/mongodb-models');
      const address = await UserAddress.findByIdAndDelete(id);

      if (!address) {
        return res.status(404).json({ error: "Address not found" });
      }

      res.json({ message: "Address deleted successfully" });
    } catch (error) {
      console.error("Error deleting address:", error);
      res.status(500).json({ error: "Failed to delete address" });
    }
  });




  const httpServer = createServer(app);

  return httpServer;
}
