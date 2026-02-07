import express from 'express';
import { storage } from "../storage-hybrid";
import { UserRole, insertSystemSettingsSchema, type SystemSettings, type InsertSystemSettings } from '@shared/schema';
import mongoose from 'mongoose';

const router = express.Router();
import multer from 'multer';
import { cloudinaryService } from "../services/cloudinaryService";
import { OrderService } from "../services/order-service";

const orderService = new OrderService();

// Configure multer for canteen profile picture uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024, // 100KB limit (client should compress to 20KB, but we allow 100KB buffer)
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// MongoDB model for SystemSettings
const SystemSettingsSchema = new mongoose.Schema({
  maintenanceMode: {
    isActive: { type: Boolean, default: false },
    title: { type: String, default: 'System Maintenance' },
    message: { type: String, default: 'We are currently performing system maintenance. Please check back later.' },
    estimatedTime: { type: String, default: '' },
    contactInfo: { type: String, default: '' },
    // Targeting options - if all are empty/null, applies to everyone
    targetingType: { type: String, default: 'all' }, // 'all', 'specific', 'college', 'department', 'year', 'year_college', 'year_department'
    specificUsers: [{ type: String }], // Array of registerNumbers or staffIds
    targetColleges: [{ type: String }], // Array of college codes
    targetDepartments: [{ type: String }], // Array of department codes
    targetYears: [{ type: Number }], // Array of years (joiningYear, passingOutYear, currentStudyYear)
    yearType: { type: String, default: 'current' }, // 'joining', 'passing', 'current'
    lastUpdatedBy: { type: Number },
    lastUpdatedAt: { type: Date }
  },
  notifications: {
    isEnabled: { type: Boolean, default: true },
    lastUpdatedBy: { type: Number },
    lastUpdatedAt: { type: Date }
  },
  appVersion: {
    version: { type: String, default: '1.0.0' },
    buildTimestamp: { type: Number, default: Date.now },
    lastUpdatedBy: { type: Number },
    lastUpdatedAt: { type: Date }
  },
  organizations: {
    list: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      code: { type: String, required: true },
      description: { type: String },
      companyType: { type: String, enum: ['IT', 'Manufacturing', 'Healthcare', 'Finance', 'Education', 'Government', 'Other'], default: 'Other' },
      industry: { type: String },
      location: { type: String },
      contactEmail: { type: String },
      contactPhone: { type: String },
      isActive: { type: Boolean, default: true },
      activeRoles: {
        employee: { type: Boolean, default: true },
        contractor: { type: Boolean, default: true },
        visitor: { type: Boolean, default: true },
        guest: { type: Boolean, default: true }
      },
      departments: [{
        id: { type: String, required: true },
        name: { type: String, required: true },
        code: { type: String, required: true },
        description: { type: String },
        isActive: { type: Boolean, default: true },
        departmentType: { type: String, enum: ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations', 'Support', 'Other'], default: 'Other' },
        registrationFormats: [{
          id: { type: String },
          name: { type: String },
          formats: {
            employee: {
              totalLength: { type: Number, required: true },
              structure: [{
                position: { type: Number, required: true },
                type: { type: String, enum: ['digit', 'alphabet', 'alphanumeric', 'fixed', 'numbers_range', 'year'], required: true },
                value: { type: String }, // For fixed characters
                description: { type: String },
                yearType: { type: String, enum: ['joining', 'current', 'starting', 'passing_out'] }, // For year type
                range: {
                  min: { type: Number },
                  max: { type: Number },
                  positions: [{ type: Number }] // Array of positions this range occupies
                }
              }],
              specialCharacters: [{
                character: { type: String, required: true },
                positions: [{ type: Number }], // Allowed positions
                description: { type: String }
              }],
              example: { type: String },
              description: { type: String }
            },
            contractor: {
              totalLength: { type: Number, required: true },
              structure: [{
                position: { type: Number, required: true },
                type: { type: String, enum: ['digit', 'alphabet', 'alphanumeric', 'fixed', 'numbers_range', 'year'], required: true },
                value: { type: String }, // For fixed characters
                description: { type: String },
                yearType: { type: String, enum: ['joining', 'current', 'starting', 'passing_out'] }, // For year type
                range: {
                  min: { type: Number },
                  max: { type: Number },
                  positions: [{ type: Number }] // Array of positions this range occupies
                }
              }],
              specialCharacters: [{
                character: { type: String, required: true },
                positions: [{ type: Number }], // Allowed positions
                description: { type: String }
              }],
              example: { type: String },
              description: { type: String }
            },
            visitor: {
              totalLength: { type: Number, required: true },
              structure: [{
                position: { type: Number, required: true },
                type: { type: String, enum: ['digit', 'alphabet', 'alphanumeric', 'fixed', 'numbers_range', 'year'], required: true },
                value: { type: String }, // For fixed characters
                description: { type: String },
                yearType: { type: String, enum: ['joining', 'current', 'starting', 'passing_out'] }, // For year type
                range: {
                  min: { type: Number },
                  max: { type: Number },
                  positions: [{ type: Number }] // Array of positions this range occupies
                }
              }],
              specialCharacters: [{
                character: { type: String, required: true },
                positions: [{ type: Number }], // Allowed positions
                description: { type: String }
              }],
              example: { type: String },
              description: { type: String }
            },
            guest: {
              totalLength: { type: Number, required: true },
              structure: [{
                position: { type: Number, required: true },
                type: { type: String, enum: ['digit', 'alphabet', 'alphanumeric', 'fixed', 'numbers_range', 'year'], required: true },
                value: { type: String }, // For fixed characters
                description: { type: String },
                yearType: { type: String, enum: ['joining', 'current', 'starting', 'passing_out'] }, // For year type
                range: {
                  min: { type: Number },
                  max: { type: Number },
                  positions: [{ type: Number }] // Array of positions this range occupies
                }
              }],
              specialCharacters: [{
                character: { type: String, required: true },
                positions: [{ type: Number }], // Allowed positions
                description: { type: String }
              }],
              example: { type: String },
              description: { type: String }
            }
          },
          createdAt: { type: Date, default: Date.now },
          updatedAt: { type: Date, default: Date.now }
        }],
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      }],
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }],
    lastUpdatedBy: { type: Number },
    lastUpdatedAt: { type: Date }
  },
  colleges: {
    list: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      code: { type: String, required: true },
      isActive: { type: Boolean, default: true },
      adminEmail: { type: String }, // Admin email for college-specific notifications
      activeRoles: {
        student: { type: Boolean, default: true },
        staff: { type: Boolean, default: true },
        employee: { type: Boolean, default: true },
        guest: { type: Boolean, default: true }
      },
      qrCodes: [{
        qrId: { type: String, required: true },
        type: { type: String, enum: ['address', 'location'], default: 'address' },
        address: { type: String }, // Legacy/Simple
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
      }],
      departments: [{
        code: { type: String, required: true },
        name: { type: String, required: true },
        isActive: { type: Boolean, default: true },
        studyDuration: { type: Number, default: 4 }, // Duration in years
        registrationFormats: [{
          id: { type: String },
          name: { type: String },
          year: { type: Number, required: true },
          formats: {
            student: {
              totalLength: { type: Number, required: true },
              structure: [{
                position: { type: Number, required: true },
                type: { type: String, enum: ['digit', 'alphabet', 'alphanumeric', 'fixed', 'numbers_range', 'year'], required: true },
                value: { type: String }, // For fixed characters
                description: { type: String },
                yearType: { type: String, enum: ['joining', 'current', 'starting', 'passing_out'] }, // For year type
              },
              ],
              specialCharacters: [{
                character: { type: String, required: true },
                positions: [{ type: Number }], // Allowed positions
                description: { type: String }
              }],
              example: { type: String },
              description: { type: String }
            },
            staff: {
              totalLength: { type: Number, required: true },
              structure: [{
                position: { type: Number, required: true },
                type: { type: String, enum: ['digit', 'alphabet', 'alphanumeric', 'fixed', 'numbers_range', 'year'], required: true },
                value: { type: String },
                description: { type: String },
                range: {
                  min: { type: Number },
                  max: { type: Number },
                  positions: [{ type: Number }]
                }
              }],
              specialCharacters: [{
                character: { type: String, required: true },
                positions: [{ type: Number }],
                description: { type: String }
              }],
              example: { type: String },
              description: { type: String }
            },
            employee: {
              totalLength: { type: Number, required: true },
              structure: [{
                position: { type: Number, required: true },
                type: { type: String, enum: ['digit', 'alphabet', 'alphanumeric', 'fixed', 'numbers_range', 'year'], required: true },
                value: { type: String },
                description: { type: String },
                range: {
                  min: { type: Number },
                  max: { type: Number },
                  positions: [{ type: Number }]
                }
              }],
              specialCharacters: [{
                character: { type: String, required: true },
                positions: [{ type: Number }],
                description: { type: String }
              }],
              example: { type: String },
              description: { type: String }
            },
            guest: {
              totalLength: { type: Number, required: true },
              structure: [{
                position: { type: Number, required: true },
                type: { type: String, enum: ['digit', 'alphabet', 'alphanumeric', 'fixed', 'numbers_range', 'year'], required: true },
                value: { type: String },
                description: { type: String },
                range: {
                  min: { type: Number },
                  max: { type: Number },
                  positions: [{ type: Number }]
                }
              }],
              departmentCode: {
                required: { type: Boolean, default: false },
                positions: [{ type: Number }],
                separator: { type: String }
              },
              specialCharacters: [{
                character: { type: String, required: true },
                positions: [{ type: Number }],
                description: { type: String }
              }],
              example: { type: String },
              description: { type: String }
            }
          },
          createdAt: { type: Date, default: Date.now },
          updatedAt: { type: Date, default: Date.now }
        }],
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      }],
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }],
    lastUpdatedBy: { type: Number },
    lastUpdatedAt: { type: Date }
  },
  canteens: {
    list: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      code: { type: String, required: true },
      description: { type: String },
      imageUrl: { type: String }, // URL for the canteen profile picture
      imagePublicId: { type: String }, // Cloudinary Public ID
      location: { type: String },
      contactNumber: { type: String },
      email: { type: String },
      canteenOwnerEmail: { type: String },
      collegeId: { type: String }, // Legacy field - kept for backward compatibility
      collegeIds: { type: [String], default: [] }, // Array of college IDs this canteen serves
      organizationId: { type: String }, // Legacy field - kept for backward compatibility
      organizationIds: { type: [String], default: [] }, // Array of organization IDs this canteen serves
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
      ownerSidebarConfig: {
        type: Map,
        of: Boolean,
        default: {
          overview: true,
          counters: true,
          orders: true,
          "payment-counter": true,
          "pos-billing": true,
          menu: true,
          content: true,
          analytics: true,
          "delivery-management": true,
          payout: true,
          "position-bidding": true,
          "store-mode": true
        }
      },
      priority: { type: Number, default: 0 }, // Priority for ordering (lower number = higher priority)
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }],
    lastUpdatedBy: { type: Number },
    lastUpdatedAt: { type: Date }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const SystemSettingsModel = mongoose.model('SystemSettings', SystemSettingsSchema);

/**
 * Test storage connectivity
 */
router.get('/test-storage', async (req, res) => {
  try {
    console.log('🔍 Testing storage connectivity...');
    const users = await storage.getAllUsers();
    console.log(`✅ Storage test successful: ${users.length} users found`);
    res.json({
      success: true,
      message: 'Storage connectivity test passed',
      userCount: users.length
    });
  } catch (error) {
    console.error('❌ Storage test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Storage connectivity test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get current system settings
 */
router.get('/', async (req, res) => {
  try {
    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    // If no settings exist, create default settings
    if (!settings) {
      const defaultSettings: InsertSystemSettings = {
        maintenanceMode: {
          isActive: false,
          title: 'System Maintenance',
          message: 'We are currently performing system maintenance. Please check back later.',
          estimatedTime: '',
          contactInfo: '',
          targetingType: 'all',
          specificUsers: [],
          targetColleges: [],
          targetDepartments: [],
          targetYears: [],
          yearType: 'current'
        },
        notifications: {
          isEnabled: true
        },
        appVersion: {
          version: '1.0.0',
          buildTimestamp: Date.now()
        },
        colleges: {
          list: [
            {
              id: 'default-college-1',
              name: 'Default Engineering College',
              code: 'DEFAULT',
              isActive: true,
              departments: [
                // B.Tech Programs
                { code: 'AERO', name: 'Aeronautical Engineering', isActive: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'AGRI', name: 'Agricultural Engineering', isActive: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'AIDS', name: 'Artificial Intelligence and Data Science', isActive: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'BIO', name: 'Biotechnology', isActive: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'CSE', name: 'Computer Science and Engineering', isActive: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'AIML', name: 'Computer Science and Engineering (Artificial Intelligence and Machine Learning)', isActive: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'CSBS', name: 'Computer Science and Business Systems', isActive: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'ECE', name: 'Electronics and Communication Engineering', isActive: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'EEE', name: 'Electrical and Electronics Engineering', isActive: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'VLSI', name: 'Electronics Engineering (VLSI Design and Technology)', isActive: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'MECH', name: 'Mechanical Engineering', isActive: true, createdAt: new Date(), updatedAt: new Date() },

                // M.E./M.Tech Programs
                { code: 'MCSE', name: 'Computer Science and Engineering (M.E./M.Tech)', isActive: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'EDSN', name: 'Engineering Design (M.E./M.Tech)', isActive: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'PWS', name: 'Power System (M.E./M.Tech)', isActive: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'AE', name: 'Applied Electronics (M.E./M.Tech)', isActive: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'MVLSI', name: 'VLSI Design (M.E./M.Tech)', isActive: true, createdAt: new Date(), updatedAt: new Date() },

                // Other Programs
                { code: 'MBA', name: 'Master of Business Administration', isActive: true, createdAt: new Date(), updatedAt: new Date() },
                { code: 'MCA', name: 'Master of Computer Applications', isActive: true, createdAt: new Date(), updatedAt: new Date() }
              ],
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ]
        },
        canteens: {
          list: [
            {
              id: 'default-canteen-1',
              name: 'KIT-CANTEEN',
              code: 'KIT-CANTEEN',
              description: 'Main canteen serving delicious meals and snacks for students and staff',
              location: 'Ground Floor, Main Building',
              contactNumber: '+91-9876543210',
              email: 'kitcanteen@kit.edu',
              canteenOwnerEmail: 'kitcanteenowner@gmail.com',
              operatingHours: {
                open: '07:00',
                close: '20:00',
                days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
              },
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ]
        }
      };

      settings = new SystemSettingsModel(defaultSettings);
      await settings.save();
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({ error: 'Failed to fetch system settings' });
  }
});

/**
 * Update system settings (admin only)
 */
router.put('/', async (req, res) => {
  try {
    // Validate request body
    const validatedData = insertSystemSettingsSchema.parse(req.body);

    // Add update metadata
    const updateData = {
      ...validatedData,
      updatedAt: new Date()
    };

    // Update maintenance mode metadata if changed
    if (validatedData.maintenanceMode) {
      updateData.maintenanceMode.lastUpdatedAt = new Date();
      if (req.body.updatedBy) {
        updateData.maintenanceMode.lastUpdatedBy = req.body.updatedBy;
      }
    }

    // Update notifications metadata if changed
    if (validatedData.notifications) {
      updateData.notifications.lastUpdatedAt = new Date();
      if (req.body.updatedBy) {
        updateData.notifications.lastUpdatedBy = req.body.updatedBy;
      }
    }

    // Update app version metadata if changed
    if (validatedData.appVersion) {
      updateData.appVersion.lastUpdatedAt = new Date();
      if (req.body.updatedBy) {
        updateData.appVersion.lastUpdatedBy = req.body.updatedBy;
      }
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (settings) {
      // Update existing settings
      Object.assign(settings, updateData);
      await settings.save();
    } else {
      // Create new settings if none exist
      settings = new SystemSettingsModel(updateData);
      await settings.save();
    }

    console.log('📝 System settings updated:', {
      maintenanceMode: settings.maintenanceMode?.isActive,
      notifications: settings.notifications?.isEnabled,
      updatedBy: req.body.updatedBy || 'unknown'
    });

    res.json(settings);
  } catch (error) {
    console.error('Error updating system settings:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid request data', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to update system settings' });
    }
  }
});

/**
 * Get maintenance status only (public endpoint)
 */
router.get('/maintenance-status', async (req, res) => {
  try {
    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings) {
      // Return default maintenance status if no settings exist
      return res.json({
        isActive: false,
        title: 'System Maintenance',
        message: 'We are currently performing system maintenance. Please check back later.'
      });
    }

    res.json({
      isActive: settings.maintenanceMode?.isActive || false,
      title: settings.maintenanceMode?.title || 'System Maintenance',
      message: settings.maintenanceMode?.message || 'We are currently performing system maintenance. Please check back later.',
      estimatedTime: settings.maintenanceMode?.estimatedTime || '',
      contactInfo: settings.maintenanceMode?.contactInfo || '',
      targetingType: settings.maintenanceMode?.targetingType || 'all',
      specificUsers: settings.maintenanceMode?.specificUsers || [],
      targetColleges: settings.maintenanceMode?.targetColleges || [],
      targetDepartments: settings.maintenanceMode?.targetDepartments || [],
      targetYears: settings.maintenanceMode?.targetYears || [],
      yearType: settings.maintenanceMode?.yearType || 'current'
    });
  } catch (error) {
    console.error('Error fetching maintenance status:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance status' });
  }
});

/**
 * Check if maintenance mode applies to a specific user
 */
router.get('/maintenance-status/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (!userId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Get the user from PostgreSQL
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get maintenance settings
    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.maintenanceMode?.isActive) {
      return res.json({
        showMaintenance: false,
        reason: 'Maintenance mode is not active'
      });
    }

    const maintenanceMode = settings.maintenanceMode;

    // Check if user is admin, super admin, or canteen owner (they bypass maintenance)
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN || user.role === UserRole.CANTEEN_OWNER || user.role === 'canteen-owner') {
      return res.json({
        showMaintenance: false,
        reason: 'User has admin/canteen owner privileges'
      });
    }

    // Apply targeting logic
    let shouldShowMaintenance = false;
    let reason = '';

    switch (maintenanceMode.targetingType) {
      case 'all':
        shouldShowMaintenance = true;
        reason = 'Maintenance applies to all users';
        break;

      case 'specific':
        // Check if user's registerNumber or staffId is in the specific list
        const userIdentifier = user.role === UserRole.STUDENT ? user.registerNumber : user.staffId;
        shouldShowMaintenance = maintenanceMode.specificUsers.includes(userIdentifier || '');
        reason = shouldShowMaintenance
          ? `User ${userIdentifier} is specifically targeted`
          : `User ${userIdentifier} is not specifically targeted`;
        break;

      case 'college':
        shouldShowMaintenance = maintenanceMode.targetColleges.includes((user as any).college || '');
        reason = shouldShowMaintenance
          ? `College '${(user as any).college}' is targeted`
          : `College '${(user as any).college}' is not targeted`;
        break;

      case 'department':
        shouldShowMaintenance = maintenanceMode.targetDepartments.includes(user.department || '');
        reason = shouldShowMaintenance
          ? `Department '${user.department}' is targeted`
          : `Department '${user.department}' is not targeted`;
        break;

      case 'year':
        let userYear: number | null = null;
        if (maintenanceMode.yearType === 'joining') {
          userYear = user.joiningYear;
        } else if (maintenanceMode.yearType === 'passing') {
          userYear = user.passingOutYear;
        } else if (maintenanceMode.yearType === 'current') {
          userYear = user.currentStudyYear;
        }
        shouldShowMaintenance = userYear ? maintenanceMode.targetYears.includes(userYear) : false;
        reason = shouldShowMaintenance
          ? `User's ${maintenanceMode.yearType} year (${userYear}) is targeted`
          : `User's ${maintenanceMode.yearType} year (${userYear}) is not targeted`;
        break;

      case 'year_college':
        // Both college AND year must match
        const collegeMatch = maintenanceMode.targetColleges.includes((user as any).college || '');
        let yearMatchCollege = false;
        let yearValueCollege: number | null = null;

        if (maintenanceMode.yearType === 'joining') {
          yearValueCollege = user.joiningYear;
        } else if (maintenanceMode.yearType === 'passing') {
          yearValueCollege = user.passingOutYear;
        } else if (maintenanceMode.yearType === 'current') {
          yearValueCollege = user.currentStudyYear;
        }

        yearMatchCollege = yearValueCollege ? maintenanceMode.targetYears.includes(yearValueCollege) : false;
        shouldShowMaintenance = collegeMatch && yearMatchCollege;
        reason = shouldShowMaintenance
          ? `Both college '${(user as any).college}' and ${maintenanceMode.yearType} year (${yearValueCollege}) match`
          : `College match: ${collegeMatch}, Year match: ${yearMatchCollege}`;
        break;

      case 'year_department':
        // Both department AND year must match
        const deptMatch = maintenanceMode.targetDepartments.includes(user.department || '');
        let yearMatch = false;
        let yearValue: number | null = null;

        if (maintenanceMode.yearType === 'joining') {
          yearValue = user.joiningYear;
        } else if (maintenanceMode.yearType === 'passing') {
          yearValue = user.passingOutYear;
        } else if (maintenanceMode.yearType === 'current') {
          yearValue = user.currentStudyYear;
        }

        yearMatch = yearValue ? maintenanceMode.targetYears.includes(yearValue) : false;
        shouldShowMaintenance = deptMatch && yearMatch;
        reason = shouldShowMaintenance
          ? `Both department '${user.department}' and ${maintenanceMode.yearType} year (${yearValue}) match`
          : `Department match: ${deptMatch}, Year match: ${yearMatch}`;
        break;

      default:
        shouldShowMaintenance = false;
        reason = 'Unknown targeting type';
    }

    res.json({
      showMaintenance: shouldShowMaintenance,
      reason,
      maintenanceInfo: shouldShowMaintenance ? {
        title: maintenanceMode.title,
        message: maintenanceMode.message,
        estimatedTime: maintenanceMode.estimatedTime,
        contactInfo: maintenanceMode.contactInfo
      } : null
    });

  } catch (error) {
    console.error('Error checking maintenance status for user:', error);
    res.status(500).json({ error: 'Failed to check maintenance status' });
  }
});

/**
 * Get app version info (public endpoint)
 */
router.get('/app-version', async (req, res) => {
  try {
    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings) {
      // Return default version info if no settings exist
      return res.json({
        version: '1.0.0',
        buildTimestamp: Date.now()
      });
    }

    res.json({
      version: settings.appVersion?.version || '1.0.0',
      buildTimestamp: settings.appVersion?.buildTimestamp || Date.now()
    });
  } catch (error) {
    console.error('Error fetching app version:', error);
    res.status(500).json({ error: 'Failed to fetch app version' });
  }
});

/**
 * Get notification settings (public endpoint)
 */
router.get('/notification-status', async (req, res) => {
  try {
    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings) {
      // Return default notification status if no settings exist
      return res.json({
        isEnabled: true
      });
    }

    res.json({
      isEnabled: settings.notifications?.isEnabled || true
    });
  } catch (error) {
    console.error('Error fetching notification status:', error);
    res.status(500).json({ error: 'Failed to fetch notification status' });
  }
});

/**
 * Update maintenance mode only (admin shortcut)
 */
router.patch('/maintenance', async (req, res) => {
  try {
    const {
      isActive,
      title,
      message,
      estimatedTime,
      contactInfo,
      targetingType,
      specificUsers,
      targetColleges,
      targetDepartments,
      targetYears,
      yearType,
      updatedBy
    } = req.body;

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings) {
      // Create default settings if none exist
      const defaultSettings: InsertSystemSettings = {
        maintenanceMode: {
          isActive: false,
          title: 'System Maintenance',
          message: 'We are currently performing system maintenance. Please check back later.',
          estimatedTime: '',
          contactInfo: '',
          targetingType: 'all',
          specificUsers: [],
          targetColleges: [],
          targetDepartments: [],
          targetYears: [],
          yearType: 'current'
        },
        notifications: {
          isEnabled: true
        },
        appVersion: {
          version: '1.0.0',
          buildTimestamp: Date.now()
        },
        colleges: {
          list: []
        },
        canteens: {
          list: []
        }
      };

      settings = new SystemSettingsModel(defaultSettings);
    }

    // Update maintenance mode settings
    if (!settings.maintenanceMode) {
      settings.maintenanceMode = {
        isActive: false,
        title: 'System Maintenance',
        message: 'We are currently performing system maintenance. Please check back later.',
        estimatedTime: '',
        contactInfo: '',
        targetingType: 'all',
        specificUsers: [],
        targetColleges: [],
        targetDepartments: [],
        targetYears: [],
        yearType: 'current'
      };
    }

    if (typeof isActive === 'boolean') {
      settings.maintenanceMode.isActive = isActive;
    }
    if (title) {
      settings.maintenanceMode.title = title;
    }
    if (message) {
      settings.maintenanceMode.message = message;
    }
    if (estimatedTime !== undefined) {
      settings.maintenanceMode.estimatedTime = estimatedTime;
    }
    if (contactInfo !== undefined) {
      settings.maintenanceMode.contactInfo = contactInfo;
    }
    if (targetingType) {
      settings.maintenanceMode.targetingType = targetingType;
    }
    if (specificUsers !== undefined) {
      settings.maintenanceMode.specificUsers = specificUsers;
    }
    if (targetColleges !== undefined) {
      settings.maintenanceMode.targetColleges = targetColleges;
    }
    if (targetDepartments !== undefined) {
      settings.maintenanceMode.targetDepartments = targetDepartments;
    }
    if (targetYears !== undefined) {
      settings.maintenanceMode.targetYears = targetYears;
    }
    if (yearType) {
      settings.maintenanceMode.yearType = yearType;
    }

    settings.maintenanceMode.lastUpdatedAt = new Date();
    if (updatedBy) {
      settings.maintenanceMode.lastUpdatedBy = updatedBy;
    }
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`🔧 Maintenance mode ${isActive ? 'ENABLED' : 'DISABLED'} by user ${updatedBy || 'unknown'}`);

    res.json({
      success: true,
      maintenanceMode: settings.maintenanceMode
    });
  } catch (error) {
    console.error('Error updating maintenance mode:', error);
    res.status(500).json({ error: 'Failed to update maintenance mode' });
  }
});

/**
 * Get colleges list (public endpoint)
 */
router.get('/colleges', async (req, res) => {
  try {
    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.colleges?.list) {
      // Return default college with departments if none exist
      const defaultColleges = [
        {
          id: 'default-college-1',
          name: 'Default Engineering College',
          code: 'DEFAULT',
          isActive: true,
          activeRoles: {
            student: true,
            staff: true,
            employee: true,
            guest: true
          },
          departments: [
            { code: 'AERO', name: 'Aeronautical Engineering', isActive: true },
            { code: 'AGRI', name: 'Agricultural Engineering', isActive: true },
            { code: 'AIDS', name: 'Artificial Intelligence and Data Science', isActive: true },
            { code: 'BIO', name: 'Biotechnology', isActive: true },
            { code: 'CSE', name: 'Computer Science and Engineering', isActive: true },
            { code: 'AIML', name: 'Computer Science and Engineering (Artificial Intelligence and Machine Learning)', isActive: true },
            { code: 'CSBS', name: 'Computer Science and Business Systems', isActive: true },
            { code: 'ECE', name: 'Electronics and Communication Engineering', isActive: true },
            { code: 'EEE', name: 'Electrical and Electronics Engineering', isActive: true },
            { code: 'VLSI', name: 'Electronics Engineering (VLSI Design and Technology)', isActive: true },
            { code: 'MECH', name: 'Mechanical Engineering', isActive: true },
            { code: 'MCSE', name: 'Computer Science and Engineering (M.E./M.Tech)', isActive: true },
            { code: 'EDSN', name: 'Engineering Design (M.E./M.Tech)', isActive: true },
            { code: 'PWS', name: 'Power System (M.E./M.Tech)', isActive: true },
            { code: 'AE', name: 'Applied Electronics (M.E./M.Tech)', isActive: true },
            { code: 'MVLSI', name: 'VLSI Design (M.E./M.Tech)', isActive: true },
            { code: 'MBA', name: 'Master of Business Administration', isActive: true },
            { code: 'MCA', name: 'Master of Computer Applications', isActive: true }
          ]
        }
      ];
      return res.json({ colleges: defaultColleges });
    }

    // Ensure all colleges have activeRoles field and migrate if needed
    let needsMigration = false;
    const collegesWithRoles = settings.colleges.list.map((college: any) => {
      if (!college.activeRoles) {
        needsMigration = true;
        return {
          ...college,
          activeRoles: {
            student: true,
            staff: true,
            employee: true,
            guest: true
          }
        };
      }
      return college;
    });

    // If migration is needed, save the updated colleges to database
    if (needsMigration) {
      console.log('🔄 Migrating colleges to add activeRoles field...');
      settings.colleges.list = collegesWithRoles;
      settings.colleges.lastUpdatedAt = new Date();
      settings.updatedAt = new Date();
      await settings.save();
      console.log('✅ Migration completed - activeRoles added to all colleges');
    }

    res.json({ colleges: collegesWithRoles });
  } catch (error) {
    console.error('Error fetching colleges:', error);
    res.status(500).json({ error: 'Failed to fetch colleges' });
  }
});

/**
 * Get departments list (public endpoint) - for backward compatibility
 * NOTE: This endpoint has been replaced by the filtered endpoint below
 * Keeping this for backward compatibility but it should not be used
 */
router.get('/departments/all', async (req, res) => {
  try {
    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.colleges?.list) {
      // Return default departments if none exist
      const defaultDepartments = [
        { code: 'AERO', name: 'Aeronautical Engineering', isActive: true },
        { code: 'AGRI', name: 'Agricultural Engineering', isActive: true },
        { code: 'AIDS', name: 'Artificial Intelligence and Data Science', isActive: true },
        { code: 'BIO', name: 'Biotechnology', isActive: true },
        { code: 'CSE', name: 'Computer Science and Engineering', isActive: true },
        { code: 'AIML', name: 'Computer Science and Engineering (Artificial Intelligence and Machine Learning)', isActive: true },
        { code: 'CSBS', name: 'Computer Science and Business Systems', isActive: true },
        { code: 'ECE', name: 'Electronics and Communication Engineering', isActive: true },
        { code: 'EEE', name: 'Electrical and Electronics Engineering', isActive: true },
        { code: 'VLSI', name: 'Electronics Engineering (VLSI Design and Technology)', isActive: true },
        { code: 'MECH', name: 'Mechanical Engineering', isActive: true },
        { code: 'MCSE', name: 'Computer Science and Engineering (M.E./M.Tech)', isActive: true },
        { code: 'EDSN', name: 'Engineering Design (M.E./M.Tech)', isActive: true },
        { code: 'PWS', name: 'Power System (M.E./M.Tech)', isActive: true },
        { code: 'AE', name: 'Applied Electronics (M.E./M.Tech)', isActive: true },
        { code: 'MVLSI', name: 'VLSI Design (M.E./M.Tech)', isActive: true },
        { code: 'MBA', name: 'Master of Business Administration', isActive: true },
        { code: 'MCA', name: 'Master of Computer Applications', isActive: true }
      ];
      return res.json({ departments: defaultDepartments });
    }

    // Flatten all departments from all colleges
    const allDepartments = settings.colleges.list
      .filter(college => college.isActive)
      .flatMap(college => college.departments.filter(dept => dept.isActive));

    res.json({ departments: allDepartments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

/**
 * Add a new college (admin only)
 */
router.post('/colleges', async (req, res) => {
  try {
    const { name, code, isActive = true, adminEmail, activeRoles = { student: true, staff: true, employee: true, guest: true }, updatedBy } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'College name and code are required' });
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings) {
      // Create default settings if none exist
      const defaultSettings: InsertSystemSettings = {
        maintenanceMode: {
          isActive: false,
          title: 'System Maintenance',
          message: 'We are currently performing system maintenance. Please check back later.',
          estimatedTime: '',
          contactInfo: '',
          targetingType: 'all',
          specificUsers: [],
          targetColleges: [],
          targetDepartments: [],
          targetYears: [],
          yearType: 'current'
        },
        notifications: {
          isEnabled: true
        },
        appVersion: {
          version: '1.0.0',
          buildTimestamp: Date.now()
        },
        colleges: {
          list: [{
            id: `college-${Date.now()}`,
            name,
            code,
            isActive,
            adminEmail,
            activeRoles,
            departments: [],
            createdAt: new Date(),
            updatedAt: new Date()
          }]
        },
        canteens: {
          list: []
        }
      };

      settings = new SystemSettingsModel(defaultSettings);
    } else {
      // Check if college code already exists
      if (!settings.colleges) {
        settings.colleges = {
          list: [] as any,
          lastUpdatedBy: updatedBy,
          lastUpdatedAt: new Date()
        };
      }

      const existingCollege = settings.colleges.list.find((college: any) => college.code === code);
      if (existingCollege) {
        return res.status(409).json({ error: 'College code already exists' });
      }

      // Add new college
      settings.colleges.list.push({
        id: `college-${Date.now()}`,
        name,
        code,
        isActive,
        adminEmail,
        activeRoles,
        departments: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      settings.colleges.lastUpdatedBy = updatedBy;
      settings.colleges.lastUpdatedAt = new Date();
    }

    settings.updatedAt = new Date();
    await settings.save();

    console.log(`➕ New college added by user ${updatedBy || 'unknown'}: ${code} - ${name}`);

    res.json({
      success: true,
      college: { id: `college-${Date.now()}`, name, code, isActive },
      colleges: settings.colleges?.list || []
    });
  } catch (error) {
    console.error('Error adding college:', error);
    res.status(500).json({ error: 'Failed to add college' });
  }
});

/**
 * Update a specific college (admin only)
 */
router.put('/colleges/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, isActive, adminEmail, updatedBy } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'College ID is required' });
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.colleges?.list) {
      return res.status(404).json({ error: 'No colleges found' });
    }

    const collegeIndex = settings.colleges.list.findIndex((college: any) => college.id === id);
    if (collegeIndex === -1) {
      return res.status(404).json({ error: 'College not found' });
    }

    // Update college
    if (name !== undefined) {
      settings.colleges.list[collegeIndex].name = name;
    }
    if (code !== undefined) {
      settings.colleges.list[collegeIndex].code = code;
    }
    if (isActive !== undefined) {
      settings.colleges.list[collegeIndex].isActive = isActive;
    }
    if (adminEmail !== undefined) {
      settings.colleges.list[collegeIndex].adminEmail = adminEmail;
    }
    settings.colleges.list[collegeIndex].updatedAt = new Date();

    settings.colleges.lastUpdatedBy = updatedBy;
    settings.colleges.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`✏️ College updated by user ${updatedBy || 'unknown'}: ${id}`);

    res.json({
      success: true,
      college: settings.colleges.list[collegeIndex],
      colleges: settings.colleges.list
    });
  } catch (error) {
    console.error('Error updating college:', error);
    res.status(500).json({ error: 'Failed to update college' });
  }
});

/**
 * Update college active roles (admin only)
 */
router.put('/colleges/:id/roles', async (req, res) => {
  try {
    const { id } = req.params;
    const { activeRoles, updatedBy } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'College ID is required' });
    }

    if (!activeRoles || typeof activeRoles !== 'object') {
      return res.status(400).json({ error: 'Active roles object is required' });
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.colleges?.list) {
      return res.status(404).json({ error: 'No colleges found' });
    }

    const collegeIndex = settings.colleges.list.findIndex((college: any) => college.id === id);
    if (collegeIndex === -1) {
      return res.status(404).json({ error: 'College not found' });
    }

    // Update active roles
    const newActiveRoles = {
      student: activeRoles.student !== undefined ? activeRoles.student : true,
      staff: activeRoles.staff !== undefined ? activeRoles.staff : true,
      employee: activeRoles.employee !== undefined ? activeRoles.employee : true,
      guest: activeRoles.guest !== undefined ? activeRoles.guest : true
    };

    console.log(`🔧 Updating roles for college ${id}:`, {
      oldRoles: settings.colleges.list[collegeIndex].activeRoles,
      newRoles: newActiveRoles
    });

    settings.colleges.list[collegeIndex].activeRoles = newActiveRoles;
    settings.colleges.list[collegeIndex].updatedAt = new Date();

    settings.colleges.lastUpdatedBy = updatedBy;
    settings.colleges.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`✅ College roles saved to database for college ${id}:`, newActiveRoles);

    res.json({
      success: true,
      college: settings.colleges.list[collegeIndex],
      colleges: settings.colleges.list
    });
  } catch (error) {
    console.error('Error updating college roles:', error);
    res.status(500).json({ error: 'Failed to update college roles' });
  }
});

/**
 * Get college name by ID (public endpoint)
 */
router.get('/colleges/:id/name', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'College ID is required' });
    }

    // SCALABILITY FIX: Use cache service for college names
    const { CollegeCacheService } = await import('../services/cacheService');

    const collegeData = await CollegeCacheService.getCollegeName(
      id,
      async () => {
        const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

        if (!settings || !settings.colleges?.list) {
          throw new Error('No colleges found');
        }

        const college = settings.colleges.list.find((college: any) => college.id === id);
        if (!college) {
          throw new Error('College not found');
        }

        return college.name;
      }
    );

    // Get college code (not cached, but less frequently accessed)
    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });
    const college = settings?.colleges?.list.find((college: any) => college.id === id);

    res.json({
      id: id,
      name: collegeData,
      code: college?.code || ''
    });
  } catch (error) {
    console.error('Error fetching college name:', error);
    res.status(500).json({ error: 'Failed to fetch college name' });
  }
});

/**
 * Delete a college with cascade deletion (admin only)
 * - Deletes all users from the college
 * - Deletes all canteens from the college
 * - Preserves orders and payments with necessary user details
 */
router.delete('/colleges/:id', async (req, res) => {
  try {
    console.log('🗑️ College deletion request received:', req.params.id);
    const { id } = req.params;
    const { updatedBy } = req.body;

    if (!id) {
      console.log('❌ No college ID provided');
      return res.status(400).json({ error: 'College ID is required' });
    }

    console.log('🔍 Fetching system settings...');
    let settings;
    try {
      settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });
      console.log('✅ System settings fetched successfully');
    } catch (error) {
      console.error('❌ Error fetching system settings:', error);
      throw new Error(`Failed to fetch system settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (!settings || !settings.colleges?.list) {
      console.log('❌ No colleges found in system settings');
      return res.status(404).json({ error: 'No colleges found' });
    }

    console.log(`🔍 Found ${settings.colleges.list.length} colleges in system`);
    const collegeIndex = settings.colleges.list.findIndex((college: any) => college.id === id);
    if (collegeIndex === -1) {
      console.log(`❌ College with ID ${id} not found`);
      return res.status(404).json({ error: 'College not found' });
    }

    const deletedCollege = settings.colleges.list[collegeIndex];
    console.log(`🗑️ Starting cascade deletion for college: ${deletedCollege.name} (${deletedCollege.code}) - ID: ${id}`);

    // Use the already imported storage instance
    console.log('🔍 Storage instance available:', !!storage);

    // Step 1: Get all users from this college
    console.log('🔍 Step 1: Fetching users from college...');
    let allUsers: any[] = [];
    let collegeUsers: any[] = [];
    try {
      console.log('🔍 Calling storage.getAllUsers()...');
      allUsers = await storage.getAllUsers();
      console.log(`🔍 Retrieved ${allUsers.length} total users from storage`);
      collegeUsers = allUsers.filter((user: any) => user.college === id);
      console.log(`📊 Found ${collegeUsers.length} users in college ${deletedCollege.name}`);
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to fetch users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Step 2: Get all canteens from this college
    const collegeCanteens = settings.canteens?.list?.filter((canteen: any) => canteen.collegeId === id) || [];
    console.log(`📊 Found ${collegeCanteens.length} canteens in college ${deletedCollege.name}`);

    // Step 3: Preserve order and payment data before deleting users
    const preservedData: {
      orders: any[];
      payments: any[];
      userDetails: any[];
    } = {
      orders: [],
      payments: [],
      userDetails: []
    };

    for (const user of collegeUsers) {
      try {
        // Get user's orders and payments
        const userOrders = await storage.getUserOrders(user.id);
        const userPayments = await storage.getUserPayments(user.id);

        // Preserve essential user details for historical records
        const userDetails = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phoneNumber: user.phoneNumber,
          registerNumber: user.registerNumber,
          department: user.department,
          staffId: user.staffId,
          college: deletedCollege.name, // Preserve college name
          collegeCode: deletedCollege.code,
          deletedAt: new Date(),
          deletedBy: updatedBy
        };

        preservedData.userDetails.push(userDetails);
        preservedData.orders.push(...userOrders);
        preservedData.payments.push(...userPayments);

        console.log(`📋 Preserved data for user ${user.name}: ${userOrders.length} orders, ${userPayments.length} payments`);
      } catch (error) {
        console.error(`❌ Error preserving data for user ${user.id}:`, error);
      }
    }

    // Step 4: Delete all users from this college
    let deletedUsersCount = 0;
    for (const user of collegeUsers) {
      try {
        await storage.deleteUser(user.id);
        deletedUsersCount++;
        console.log(`✅ Deleted user: ${user.name} (${user.email})`);
      } catch (error) {
        console.error(`❌ Error deleting user ${user.id}:`, error);
        // Continue with other users even if one fails
      }
    }

    // Step 5: Delete all canteens from this college
    let deletedCanteensCount = 0;
    if (settings.canteens?.list) {
      // Remove canteens from the list
      settings.canteens.list = settings.canteens.list.filter((canteen: any) => canteen.collegeId !== id) as any;
      deletedCanteensCount = collegeCanteens.length;

      for (const canteen of collegeCanteens) {
        console.log(`✅ Deleted canteen: ${canteen.name} (${canteen.code})`);
      }
    }

    // Step 6: Remove the college from the list
    settings.colleges.list.splice(collegeIndex, 1);

    // Step 7: Update system settings
    settings.colleges.lastUpdatedBy = updatedBy;
    settings.colleges.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`🎉 College cascade deletion completed:`);
    console.log(`   - College: ${deletedCollege.name} (${deletedCollege.code})`);
    console.log(`   - Users deleted: ${deletedUsersCount}`);
    console.log(`   - Canteens deleted: ${deletedCanteensCount}`);
    console.log(`   - Orders preserved: ${preservedData.orders.length}`);
    console.log(`   - Payments preserved: ${preservedData.payments.length}`);

    res.json({
      success: true,
      deletedCollege: deletedCollege,
      colleges: settings.colleges.list,
      cascadeDeletion: {
        usersDeleted: deletedUsersCount,
        canteensDeleted: deletedCanteensCount,
        ordersPreserved: preservedData.orders.length,
        paymentsPreserved: preservedData.payments.length,
        userDetailsPreserved: preservedData.userDetails.length
      },
      preservedData: preservedData // Include preserved data in response for admin review
    });
  } catch (error) {
    console.error('Error deleting college with cascade:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      collegeId: req.params.id
    });
    res.status(500).json({
      error: 'Failed to delete college with cascade deletion',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get college for logged-in admin
 */
router.get('/admin/my-college', async (req, res) => {
  try {
    // Check for user in session (standardized) or Passport-style user object
    const user = (req as any).session?.user || (req as any).session?.googleUser || (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!user.email) {
      return res.status(400).json({ error: 'User has no email' });
    }

    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.colleges?.list) {
      return res.status(404).json({ error: 'No colleges found' });
    }

    // Find college where adminEmail matches user email
    let college = settings.colleges.list.find((c: any) =>
      c.adminEmail && c.adminEmail.toLowerCase() === user.email.toLowerCase()
    );

    // Fallback: Check if user has a college assigned in their profile
    if (!college && user.college) {
      // flexible match: check if user.college matches college code OR college name
      college = settings.colleges.list.find((c: any) =>
        (c.code && c.code === user.college) ||
        (c.name && c.name === user.college) ||
        (c.id === user.college) // strict id match just in case
      );
    }

    if (!college) {
      return res.json({ college: null });
    }

    res.json({
      college: {
        id: college.id,
        name: college.name,
        code: college.code,
        adminEmail: college.adminEmail
      }
    });

  } catch (error) {
    console.error('Error fetching admin college:', error);
    res.status(500).json({ error: 'Failed to fetch admin college' });
  }
});

/**
 * Add a department to a college (admin only)
 */
router.post('/colleges/:collegeId/departments', async (req, res) => {
  try {
    const { collegeId } = req.params;
    const { code, name, isActive = true, studyDuration = 4, registrationFormats, updatedBy } = req.body;

    if (!collegeId || !code || !name) {
      return res.status(400).json({ error: 'College ID, department code and name are required' });
    }

    // Validate that registration formats are provided for all years
    if (!registrationFormats || !Array.isArray(registrationFormats) || registrationFormats.length === 0) {
      return res.status(400).json({ error: 'Registration formats are required for all years of study' });
    }

    // Validate that formats are provided for each year (1 to studyDuration)
    const expectedYears = Array.from({ length: studyDuration }, (_, i) => i + 1);
    const providedYears = registrationFormats.map((format: any) => format.year).sort();

    if (JSON.stringify(expectedYears) !== JSON.stringify(providedYears)) {
      return res.status(400).json({
        error: `Registration formats must be provided for all years (1 to ${studyDuration}). Expected years: ${expectedYears.join(', ')}, Provided years: ${providedYears.join(', ')}`
      });
    }

    // Validate each format
    const requiredTypes = ['student', 'staff', 'employee', 'guest'];
    for (const format of registrationFormats) {
      if (!format.year || !format.formats) {
        return res.status(400).json({ error: `Format for year ${format.year} is missing required fields` });
      }

      for (const type of requiredTypes) {
        if (!format.formats[type]) {
          return res.status(400).json({ error: `Format for ${type} is required for year ${format.year}` });
        }
        if (!format.formats[type].totalLength || !format.formats[type].structure) {
          return res.status(400).json({ error: `totalLength and structure are required for ${type} in year ${format.year}` });
        }
      }
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.colleges?.list) {
      return res.status(404).json({ error: 'No colleges found' });
    }

    const collegeIndex = settings.colleges.list.findIndex((college: any) => college.id === collegeId);
    if (collegeIndex === -1) {
      return res.status(404).json({ error: 'College not found' });
    }

    const college = settings.colleges.list[collegeIndex];

    // Check if department code already exists in this college
    const existingDept = college.departments.find((dept: any) => dept.code === code);
    if (existingDept) {
      return res.status(409).json({ error: 'Department code already exists in this college' });
    }

    // Add new department with registration formats
    college.departments.push({
      code,
      name,
      isActive,
      studyDuration,
      registrationFormats: registrationFormats.map((format: any) => ({
        ...format,
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    college.updatedAt = new Date();
    settings.colleges.lastUpdatedBy = updatedBy;
    settings.colleges.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`➕ New department added to college ${collegeId} by user ${updatedBy || 'unknown'}: ${code} - ${name} with ${registrationFormats.length} registration formats`);

    res.json({
      success: true,
      department: { code, name, isActive, studyDuration, registrationFormats },
      college: college,
      colleges: settings.colleges.list
    });
  } catch (error) {
    console.error('Error adding department to college:', error);
    res.status(500).json({ error: 'Failed to add department to college' });
  }
});

/**
 * Update a department in a college (admin only)
 */
router.put('/colleges/:collegeId/departments/:deptCode', async (req, res) => {
  try {
    const { collegeId, deptCode } = req.params;
    const { name, isActive, studyDuration, updatedBy } = req.body;

    if (!collegeId || !deptCode) {
      return res.status(400).json({ error: 'College ID and department code are required' });
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.colleges?.list) {
      return res.status(404).json({ error: 'No colleges found' });
    }

    const collegeIndex = settings.colleges.list.findIndex((college: any) => college.id === collegeId);
    if (collegeIndex === -1) {
      return res.status(404).json({ error: 'College not found' });
    }

    const college = settings.colleges.list[collegeIndex];
    const deptIndex = college.departments.findIndex((dept: any) => dept.code === deptCode);
    if (deptIndex === -1) {
      return res.status(404).json({ error: 'Department not found in this college' });
    }

    // Update department
    if (name !== undefined) {
      college.departments[deptIndex].name = name;
    }
    if (isActive !== undefined) {
      college.departments[deptIndex].isActive = isActive;
    }
    if (studyDuration !== undefined) {
      college.departments[deptIndex].studyDuration = studyDuration;
    }
    college.departments[deptIndex].updatedAt = new Date();
    college.updatedAt = new Date();

    settings.colleges.lastUpdatedBy = updatedBy;
    settings.colleges.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`✏️ Department updated in college ${collegeId} by user ${updatedBy || 'unknown'}: ${deptCode}`);

    res.json({
      success: true,
      department: college.departments[deptIndex],
      college: college,
      colleges: settings.colleges.list
    });
  } catch (error) {
    console.error('Error updating department in college:', error);
    res.status(500).json({ error: 'Failed to update department in college' });
  }
});

/**
 * Delete a department from a college (admin only)
 */
router.delete('/colleges/:collegeId/departments/:deptCode', async (req, res) => {
  try {
    const { collegeId, deptCode } = req.params;
    const { updatedBy } = req.body;

    if (!collegeId || !deptCode) {
      return res.status(400).json({ error: 'College ID and department code are required' });
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.colleges?.list) {
      return res.status(404).json({ error: 'No colleges found' });
    }

    const collegeIndex = settings.colleges.list.findIndex((college: any) => college.id === collegeId);
    if (collegeIndex === -1) {
      return res.status(404).json({ error: 'College not found' });
    }

    const college = settings.colleges.list[collegeIndex];
    const deptIndex = college.departments.findIndex((dept: any) => dept.code === deptCode);
    if (deptIndex === -1) {
      return res.status(404).json({ error: 'Department not found in this college' });
    }

    // Remove department
    const deletedDept = college.departments.splice(deptIndex, 1)[0];
    college.updatedAt = new Date();

    settings.colleges.lastUpdatedBy = updatedBy;
    settings.colleges.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`🗑️ Department deleted from college ${collegeId} by user ${updatedBy || 'unknown'}: ${deptCode} - ${deletedDept.name}`);

    res.json({
      success: true,
      deletedDepartment: deletedDept,
      college: college,
      colleges: settings.colleges.list
    });
  } catch (error) {
    console.error('Error deleting department from college:', error);
    res.status(500).json({ error: 'Failed to delete department from college' });
  }
});

/**
 * Get institutions by type (colleges or organizations)
 * This endpoint is used by the ProfileSetupScreen
 */
router.get('/institutions', async (req, res) => {
  try {
    const { type } = req.query;

    if (!type || (type !== 'college' && type !== 'organization')) {
      return res.status(400).json({ error: 'Type parameter is required and must be "college" or "organization"' });
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings) {
      console.log(`❌ No system settings found in database`);
      return res.status(404).json({ error: 'System settings not found' });
    }

    console.log(`📊 System settings found:`, {
      hasColleges: !!settings.colleges?.list,
      collegesCount: settings.colleges?.list?.length || 0,
      hasOrganizations: !!settings.organizations?.list,
      organizationsCount: settings.organizations?.list?.length || 0
    });

    let institutions = [];

    if (type === 'college') {
      institutions = settings.colleges?.list || [];
      console.log(`📚 Found ${institutions.length} colleges:`, institutions.map((c: any) => ({ id: c.id, name: c.name, code: c.code, isActive: c.isActive })));

      // Filter only active colleges
      institutions = institutions.filter((college: any) => college.isActive !== false);
      console.log(`📚 Active colleges: ${institutions.length}`, institutions.map((c: any) => ({ id: c.id, name: c.name, code: c.code })));
    } else if (type === 'organization') {
      institutions = settings.organizations?.list || [];
      console.log(`🏢 Found ${institutions.length} organizations:`, institutions.map((o: any) => ({ id: o.id, name: o.name, code: o.code, isActive: o.isActive })));

      // Filter only active organizations
      institutions = institutions.filter((org: any) => org.isActive !== false);
      console.log(`🏢 Active organizations: ${institutions.length}`, institutions.map((o: any) => ({ id: o.id, name: o.name, code: o.code })));
    }

    console.log(`📋 Returning institutions for type "${type}":`, { success: true, institutions: institutions.length, type });

    res.json({
      success: true,
      institutions,
      type
    });
  } catch (error: any) {
    console.error('Error fetching institutions:', error);
    res.status(500).json({ error: 'Failed to fetch institutions' });
  }
});

/**
 * Get departments by institution type and institution ID
 * This endpoint is used by the ProfileSetupScreen
 */
router.get('/departments', async (req, res) => {
  try {
    const { institutionType, institutionId } = req.query;

    if (!institutionType || !institutionId) {
      return res.status(400).json({ error: 'institutionType and institutionId parameters are required' });
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings) {
      return res.status(404).json({ error: 'System settings not found' });
    }

    let departments = [];

    if (institutionType === 'college') {
      const college = settings.colleges?.list?.find((col: any) => col.id === institutionId);
      console.log(`🏫 Looking for college with ID: ${institutionId}`);
      console.log(`🏫 Available colleges:`, settings.colleges?.list?.map((c: any) => ({ id: c.id, name: c.name })));
      if (college) {
        departments = college.departments || [];
        console.log(`🏫 Found college "${college.name}" with ${departments.length} departments`);
        console.log(`🏫 All departments:`, departments.map((d: any) => ({ code: d.code, name: d.name, isActive: d.isActive })));

        // Filter only active departments
        const activeDepartments = departments.filter((dept: any) => dept.isActive !== false);
        console.log(`🏫 Active departments: ${activeDepartments.length}`, activeDepartments.map((d: any) => ({ code: d.code, name: d.name })));
        departments = activeDepartments;
      } else {
        console.log(`🏫 College not found with ID: ${institutionId}`);
      }
    } else if (institutionType === 'organization') {
      const organization = settings.organizations?.list?.find((org: any) => org.id === institutionId);
      console.log(`🏢 Looking for organization with ID: ${institutionId}`);
      console.log(`🏢 Available organizations:`, settings.organizations?.list?.map((o: any) => ({ id: o.id, name: o.name })));
      if (organization) {
        departments = organization.departments || [];
        console.log(`🏢 Found organization "${organization.name}" with ${departments.length} departments`);
        console.log(`🏢 All departments:`, departments.map((d: any) => ({ code: d.code, name: d.name, isActive: d.isActive })));

        // Filter only active departments
        const activeDepartments = departments.filter((dept: any) => dept.isActive !== false);
        console.log(`🏢 Active departments: ${activeDepartments.length}`, activeDepartments.map((d: any) => ({ code: d.code, name: d.name })));
        departments = activeDepartments;
      } else {
        console.log(`🏢 Organization not found with ID: ${institutionId}`);
      }
    }

    res.json({
      success: true,
      departments,
      institutionType,
      institutionId
    });
  } catch (error: any) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

/**
 * Get registration formats by institution type, institution ID, department code, year, and role
 * This endpoint is used by the ProfileSetupScreen for STUDENT roles only
 * For colleges: year parameter is passingOutYear (converted to studyYear)
 * For organizations: year parameter is joiningYear (used directly)
 */
router.get('/registration-formats', async (req, res) => {
  try {
    const { institutionType, institutionId, departmentCode, passingOutYear, joiningYear, role } = req.query;

    console.log(`📋 Registration formats API called with:`, {
      institutionType,
      institutionId,
      departmentCode,
      passingOutYear,
      joiningYear,
      role,
      fullUrl: req.url
    });

    if (!institutionType || !institutionId || !departmentCode || !role) {
      console.log(`❌ Missing required parameters:`, { institutionType, institutionId, departmentCode, passingOutYear, joiningYear, role });
      return res.status(400).json({ error: 'All parameters are required: institutionType, institutionId, departmentCode, role, and either passingOutYear (for colleges) or joiningYear (for organizations)' });
    }

    // Determine the year to use based on institution type
    let yearToUse: number;
    let yearType: string;

    if (institutionType === 'college') {
      if (!passingOutYear) {
        return res.status(400).json({ error: 'passingOutYear is required for colleges' });
      }
      // Convert passing out year to study year for colleges
      const passingOutYearNum = parseInt(passingOutYear as string);
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth(); // 0-11

      // Calculate current academic year (starts in June)
      const currentAcademicYear = currentMonth >= 5 ? currentYear : currentYear - 1;

      // Calculate study year from passing out year
      const yearsRemaining = passingOutYearNum - currentAcademicYear;
      yearToUse = yearsRemaining + 1;
      yearType = 'studyYear';

      console.log(`📋 College year conversion:`, {
        passingOutYear: passingOutYearNum,
        currentYear,
        currentMonth,
        currentAcademicYear,
        yearsRemaining,
        studyYear: yearToUse
      });
    } else if (institutionType === 'organization') {
      // Organizations don't have students - all roles should use /registration-formats/no-year endpoint
      return res.status(400).json({ error: `Organizations don't have students. Use /registration-formats/no-year for ${role} role.` });
    } else {
      return res.status(400).json({ error: 'Invalid institutionType. Must be "college" or "organization"' });
    }

    console.log(`📋 Will filter for ${yearType}: ${yearToUse} and role: ${role}`);

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings) {
      return res.status(404).json({ error: 'System settings not found' });
    }

    let formats = [];

    if (institutionType === 'college') {
      // Handle college
      if (!settings.colleges?.list) {
        return res.status(404).json({ error: 'No colleges found' });
      }

      const college = settings.colleges.list.find((col: any) => col.id === institutionId);
      if (!college) {
        return res.status(404).json({ error: 'College not found' });
      }

      const department = college.departments.find((dept: any) => dept.code === departmentCode);
      if (!department) {
        return res.status(404).json({ error: 'Department not found in this college' });
      }

      // Use MongoDB query to filter at database level
      console.log(`📋 Querying college formats with MongoDB filter: year=${yearToUse}, role=${role}`);

      const filteredFormats = await SystemSettingsModel.aggregate([
        { $match: { _id: settings._id } },
        { $unwind: "$colleges.list" },
        { $match: { "colleges.list.id": institutionId } },
        { $unwind: "$colleges.list.departments" },
        { $match: { "colleges.list.departments.code": departmentCode } },
        { $unwind: "$colleges.list.departments.registrationFormats" },
        {
          $match: {
            "colleges.list.departments.registrationFormats.year": yearToUse,
            [`colleges.list.departments.registrationFormats.formats.${role}.structure`]: { $exists: true, $ne: [] }
          }
        },
        {
          $project: {
            _id: "$colleges.list.departments.registrationFormats._id",
            id: "$colleges.list.departments.registrationFormats.id",
            name: "$colleges.list.departments.registrationFormats.name",
            year: "$colleges.list.departments.registrationFormats.year",
            formats: {
              [role]: `$colleges.list.departments.registrationFormats.formats.${role}`
            },
            createdAt: "$colleges.list.departments.registrationFormats.createdAt",
            updatedAt: "$colleges.list.departments.registrationFormats.updatedAt"
          }
        }
      ]);

      console.log(`📋 MongoDB query returned ${filteredFormats.length} matching formats`);
      formats = filteredFormats;

    } else if (institutionType === 'organization') {
      // Handle organization
      if (!settings.organizations?.list) {
        return res.status(404).json({ error: 'No organizations found' });
      }

      const organization = settings.organizations.list.find((org: any) => org.id === institutionId);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const department = organization.departments.find((dept: any) => dept.code === departmentCode);
      if (!department) {
        return res.status(404).json({ error: 'Department not found in this organization' });
      }

      // Use MongoDB query to filter at database level
      if (yearToUse !== null) {
        console.log(`📋 Querying organization formats with MongoDB filter: year=${yearToUse}, role=${role}`);
      } else {
        console.log(`📋 Querying organization formats with MongoDB filter: no year filtering, role=${role}`);
      }

      // Build the aggregation pipeline based on whether year filtering is needed
      const aggregationPipeline = [
        { $match: { _id: settings._id } },
        { $unwind: "$organizations.list" },
        { $match: { "organizations.list.id": institutionId } },
        { $unwind: "$organizations.list.departments" },
        { $match: { "organizations.list.departments.code": departmentCode } },
        { $unwind: "$organizations.list.departments.registrationFormats" }
      ];

      // Add year filtering only if yearToUse is not null
      if (yearToUse !== null) {
        aggregationPipeline.push({
          $match: {
            "organizations.list.departments.registrationFormats.year": yearToUse,
            [`organizations.list.departments.registrationFormats.formats.${role}.structure`]: { $exists: true, $ne: [] }
          }
        });
      } else {
        aggregationPipeline.push({
          $match: {
            [`organizations.list.departments.registrationFormats.formats.${role}.structure`]: { $exists: true, $ne: [] }
          }
        });
      }

      aggregationPipeline.push({
        $project: {
          _id: "$organizations.list.departments.registrationFormats._id",
          id: "$organizations.list.departments.registrationFormats.id",
          name: "$organizations.list.departments.registrationFormats.name",
          year: "$organizations.list.departments.registrationFormats.year",
          formats: {
            [role]: `$organizations.list.departments.registrationFormats.formats.${role}`
          },
          createdAt: "$organizations.list.departments.registrationFormats.createdAt",
          updatedAt: "$organizations.list.departments.registrationFormats.updatedAt"
        }
      });

      const filteredFormats = await SystemSettingsModel.aggregate(aggregationPipeline);
      console.log(`📋 MongoDB query returned ${filteredFormats.length} matching formats`);
      formats = filteredFormats;
    } else {
      return res.status(400).json({ error: 'Invalid institution type. Must be "college" or "organization"' });
    }

    console.log(`📋 Database-level filtering complete: ${formats.length} matching formats found`);
    console.log(`📋 Final filtered formats:`, formats.map((f: any) => ({
      id: f.id,
      name: f.name,
      year: f.year,
      hasStudentFormat: !!f.formats?.student,
      hasStaffFormat: !!f.formats?.staff,
      hasEmployeeFormat: !!f.formats?.employee,
      hasGuestFormat: !!f.formats?.guest
    })));

    // Log complete format details being sent from server
    console.log(`📋 SERVER SENDING ${formats.length} FORMATS TO CLIENT:`);
    formats.forEach((format: any, index: number) => {
      console.log(`📋 ===== FORMAT ${index + 1} DETAILS =====`);
      console.log(`📋 Format ID: ${format.id}`);
      console.log(`📋 Format Name: "${format.name}"`);
      console.log(`📋 Format Year: ${format.year}`);
      console.log(`📋 Format Created: ${format.createdAt}`);
      console.log(`📋 Format Updated: ${format.updatedAt}`);

      // Log complete formats object
      console.log(`📋 Complete formats object:`, format.formats);

      // Log each role format in detail
      Object.keys(format.formats || {}).forEach(roleKey => {
        const roleFormat = format.formats[roleKey];
        console.log(`📋 --- ${roleKey.toUpperCase()} ROLE FORMAT ---`);
        console.log(`📋   Total Length: ${roleFormat.totalLength}`);
        console.log(`📋   Structure Length: ${roleFormat.structure?.length || 0}`);
        console.log(`📋   Example: "${roleFormat.example}"`);
        console.log(`📋   Description: "${roleFormat.description}"`);
        console.log(`📋   Special Characters:`, roleFormat.specialCharacters);

        // Log complete structure array
        if (roleFormat.structure) {
          console.log(`📋   Complete Structure Array:`, roleFormat.structure);

          // Log each position in detail (only relevant data)
          roleFormat.structure.forEach((position: any, posIndex: number) => {
            const positionData: any = {
              type: position.type,
              position: position.position,
              description: position.description,
              range: position.range
            };

            // Only include yearType if it's defined and relevant
            if (position.yearType && position.type === 'year') {
              positionData.yearType = position.yearType;
            }

            // Only include value if it's defined and relevant
            if (position.value && position.type === 'fixed') {
              positionData.value = position.value;
            }

            // Only include _id if needed for debugging
            if (position._id) {
              positionData._id = position._id;
            }

            console.log(`📋     Position ${posIndex + 1}:`, positionData);
          });
        }
      });

      console.log(`📋 ===== END FORMAT ${index + 1} =====`);
    });

    const responseData = {
      success: true,
      formats: formats,
      institutionType,
      institutionId,
      departmentCode,
      ...(institutionType === 'college' ? {
        passingOutYear: parseInt(passingOutYear as string),
        studyYear: yearToUse
      } : institutionType === 'organization' && yearToUse !== null ? {
        joiningYear: yearToUse
      } : {}),
      role,
      totalFormatsFound: formats.length,
      filteredFormatsCount: formats.length,
      filteringCriteria: {
        ...(institutionType === 'college' ? {
          passingOutYear: parseInt(passingOutYear as string),
          studyYear: yearToUse,
          description: `Formats matching study year ${yearToUse} (from passing out year ${passingOutYear}) with ${role} role format`
        } : institutionType === 'organization' && yearToUse !== null ? {
          joiningYear: yearToUse,
          description: `Formats matching joining year ${yearToUse} with ${role} role format`
        } : {
          description: `Formats for ${role} role (no year filtering)`
        }),
        role: role
      }
    };

    console.log(`📋 ===== COMPLETE API RESPONSE BEING SENT =====`);
    console.log(`📋 Response Success: ${responseData.success}`);
    console.log(`📋 Institution Type: ${responseData.institutionType}`);
    console.log(`📋 Institution ID: ${responseData.institutionId}`);
    console.log(`📋 Department Code: ${responseData.departmentCode}`);
    console.log(`📋 Passing Out Year: ${responseData.passingOutYear}`);
    console.log(`📋 Study Year: ${responseData.studyYear}`);
    console.log(`📋 Role: ${responseData.role}`);
    console.log(`📋 Total Formats Found: ${responseData.totalFormatsFound}`);
    console.log(`📋 Filtered Formats Count: ${responseData.filteredFormatsCount}`);
    console.log(`📋 Filtering Criteria:`, responseData.filteringCriteria);

    console.log(`📋 ===== FORMATS ARRAY IN RESPONSE =====`);
    responseData.formats.forEach((format: any, index: number) => {
      console.log(`📋 Response Format ${index + 1}:`, {
        id: format.id,
        name: format.name,
        year: format.year,
        formats: format.formats,
        createdAt: format.createdAt,
        updatedAt: format.updatedAt
      });

      // Log only the requested role format details
      const requestedRoleFormat = format.formats?.[role];
      if (requestedRoleFormat) {
        console.log(`📋   ${role.toUpperCase()} Role Details:`, {
          totalLength: requestedRoleFormat.totalLength,
          structureLength: requestedRoleFormat.structure?.length || 0,
          example: requestedRoleFormat.example,
          description: requestedRoleFormat.description
        });
      }
    });

    console.log(`📋 ===== RESPONSE METADATA =====`);
    console.log(`📋 Response Size: ${JSON.stringify(responseData).length} characters`);
    console.log(`📋 Number of Formats: ${responseData.formats.length}`);
    console.log(`📋 Complete Response Object:`, responseData);
    console.log(`📋 ===== END API RESPONSE =====`);

    res.json(responseData);
  } catch (error: any) {
    console.error('Error fetching registration formats:', error);
    res.status(500).json({ error: 'Failed to fetch registration formats' });
  }
});

/**
 * Get college QR codes
 */
router.get('/colleges/:collegeId/qr-codes', async (req, res) => {
  try {
    const { collegeId } = req.params;

    if (!collegeId) {
      return res.status(400).json({ error: 'College ID is required' });
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.colleges?.list) {
      return res.status(404).json({ error: 'No colleges found' });
    }

    const college = settings.colleges.list.find((col: any) => col.id === collegeId);
    if (!college) {
      return res.status(404).json({ error: 'College not found' });
    }

    res.json({
      success: true,
      qrCodes: college.qrCodes || []
    });
  } catch (error: any) {
    console.error('Error fetching college QR codes:', error);
    res.status(500).json({ error: 'Failed to fetch QR codes' });
  }
});

/**
 * Create college QR code
 */
router.post('/colleges/:collegeId/qr-codes', async (req, res) => {
  try {
    const { collegeId } = req.params;
    const { address, fullAddress, type = 'address', label } = req.body;

    if (!collegeId) {
      return res.status(400).json({ error: 'College ID is required' });
    }

    if (type === 'address' && !address && !fullAddress) {
      return res.status(400).json({ error: 'Address details are required' });
    }

    if (type === 'location' && !label) {
      return res.status(400).json({ error: 'Label is required for Location QR' });
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.colleges?.list) {
      return res.status(404).json({ error: 'No colleges found' });
    }

    const collegeIndex = settings.colleges.list.findIndex((col: any) => col.id === collegeId);
    if (collegeIndex === -1) {
      return res.status(404).json({ error: 'College not found' });
    }

    const qrId = 'QR' + Date.now().toString(36).toUpperCase();
    const hash = Buffer.from(`${collegeId}-${qrId}-${Date.now()}`).toString('base64');
    // Using a simpler URL structure for now, can be updated to actual frontend route
    const baseUrl = process.env.APP_URL || process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const qrCodeUrl = `${baseUrl}/qr/college/${qrId}`;

    // Construct new QR object based on type
    const newQrCode: any = {
      qrId,
      type,
      qrCodeUrl,
      hash,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (type === 'address') {
      newQrCode.address = address || fullAddress?.addressLine1 || '';
      newQrCode.fullAddress = fullAddress || {
        label: 'Default Label', // Should come from frontend
        addressLine1: address
      };
    } else if (type === 'location') {
      // distinct structure for location QR if needed, or just minimal fields
      newQrCode.address = label; // Use label as address for display purposes list
      newQrCode.fullAddress = { label: label };
    }


    if (!settings.colleges.list[collegeIndex].qrCodes) {
      settings.colleges.list[collegeIndex].qrCodes = [];
    }

    settings.colleges.list[collegeIndex].qrCodes.push(newQrCode);
    settings.markModified('colleges.list');
    await settings.save();

    res.json({
      success: true,
      qrCode: newQrCode
    });
  } catch (error: any) {
    console.error('Error creating college QR code:', error);
    res.status(500).json({ error: 'Failed to create QR code' });
  }
});

/**
 * Delete college QR code
 */
router.delete('/colleges/:collegeId/qr-codes/:qrId', async (req, res) => {
  try {
    const { collegeId, qrId } = req.params;

    if (!collegeId || !qrId) {
      return res.status(400).json({ error: 'College ID and QR ID are required' });
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.colleges?.list) {
      return res.status(404).json({ error: 'No colleges found' });
    }

    const collegeIndex = settings.colleges.list.findIndex((col: any) => col.id === collegeId);
    if (collegeIndex === -1) {
      return res.status(404).json({ error: 'College not found' });
    }

    const college = settings.colleges.list[collegeIndex];
    if (!college.qrCodes) {
      return res.status(404).json({ error: 'QR Code not found' });
    }

    const qrIndex = college.qrCodes.findIndex((qr: any) => qr.qrId === qrId);
    if (qrIndex === -1) {
      return res.status(404).json({ error: 'QR Code not found' });
    }

    college.qrCodes.splice(qrIndex, 1);
    settings.markModified('colleges.list');
    await settings.save();

    res.json({
      success: true,
      message: 'QR Code deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting college QR code:', error);
    res.status(500).json({ error: 'Failed to delete QR code' });
  }
});

/**
 * Get registration formats for a department (admin only)
 */
router.get('/colleges/:collegeId/departments/:deptCode/registration-formats', async (req, res) => {
  try {
    const { collegeId, deptCode } = req.params;

    if (!collegeId || !deptCode) {
      return res.status(400).json({ error: 'College ID and department code are required' });
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.colleges?.list) {
      return res.status(404).json({ error: 'No colleges found' });
    }

    const collegeIndex = settings.colleges.list.findIndex((col: any) => col.id === collegeId);
    if (collegeIndex === -1) {
      return res.status(404).json({ error: 'College not found' });
    }

    const college = settings.colleges.list[collegeIndex];
    const deptIndex = college.departments.findIndex((dept: any) => dept.code === deptCode);
    if (deptIndex === -1) {
      return res.status(404).json({ error: 'Department not found in this college' });
    }

    const department = college.departments[deptIndex];
    const registrationFormats = department.registrationFormats || [];

    res.json({
      success: true,
      registrationFormats,
      department: {
        code: department.code,
        name: department.name
      },
      college: {
        id: college.id,
        code: college.code,
        name: college.name
      }
    });
  } catch (error: any) {
    console.error('Error fetching registration formats:', error);
    res.status(500).json({ error: 'Failed to fetch registration formats' });
  }
});

/**
 * Add registration format for a department (admin only)
 */
router.post('/colleges/:collegeId/departments/:deptCode/registration-formats', async (req, res) => {
  try {
    const { collegeId, deptCode } = req.params;
    const { year, formats, name, updatedBy } = req.body;

    // Debug: Log the incoming data
    console.log('Incoming registration format data:', JSON.stringify({ year, formats, name }, null, 2));

    if (!collegeId || !deptCode || !year || !formats || !name) {
      return res.status(400).json({ error: 'College ID, department code, year, formats, and name are required' });
    }

    // Validate that all required user types are present
    const requiredTypes = ['student', 'staff', 'employee', 'guest'];
    for (const type of requiredTypes) {
      if (!formats[type]) {
        return res.status(400).json({ error: `Format for ${type} is required` });
      }
      if (!formats[type].totalLength || !formats[type].structure) {
        return res.status(400).json({ error: `totalLength and structure are required for ${type}` });
      }
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.colleges?.list) {
      return res.status(404).json({ error: 'No colleges found' });
    }

    const collegeIndex = settings.colleges.list.findIndex((college: any) => college.id === collegeId);
    if (collegeIndex === -1) {
      return res.status(404).json({ error: 'College not found' });
    }

    const college = settings.colleges.list[collegeIndex];
    const deptIndex = college.departments.findIndex((dept: any) => dept.code === deptCode);
    if (deptIndex === -1) {
      return res.status(404).json({ error: 'Department not found in this college' });
    }

    const department = college.departments[deptIndex];

    // Check if format with this name already exists for this department (across all years)
    const existingFormatIndex = department.registrationFormats.findIndex((format: any) =>
      format.name && format.name.toLowerCase().trim() === name.toLowerCase().trim()
    );

    if (existingFormatIndex !== -1) {
      const existingFormat = department.registrationFormats[existingFormatIndex];
      return res.status(409).json({
        error: `Registration format with name "${name}" already exists for year ${existingFormat.year} in this department. Please choose a different name.`
      });
    }

    // Validate name is not empty or just whitespace
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Format name is required and cannot be empty' });
    }

    // Generate unique ID for the format
    const formatId = `format_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add new registration format
    department.registrationFormats.push({
      id: formatId,
      name: name.trim(),
      year,
      formats,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`➕ Added new registration format "${name}" for department ${deptCode} year ${year} by user ${updatedBy || 'unknown'}`);

    department.updatedAt = new Date();
    college.updatedAt = new Date();
    settings.colleges.lastUpdatedBy = updatedBy;
    settings.colleges.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    res.json({
      success: true,
      registrationFormat: { id: formatId, name, year, formats },
      department: department,
      college: college,
      colleges: settings.colleges.list
    });
  } catch (error) {
    console.error('Error adding registration format:', error);
    res.status(500).json({ error: 'Failed to add registration format' });
  }
});

/**
 * Update registration format for a department (admin only)
 */
router.put('/colleges/:collegeId/departments/:deptCode/registration-formats/:formatId', async (req, res) => {
  try {
    const { collegeId, deptCode, formatId } = req.params;
    const { formats, name, updatedBy } = req.body;

    console.log('🔍 Update registration format request:');
    console.log('  - Params:', { collegeId, deptCode, formatId });
    console.log('  - Body:', { formats: !!formats, name, updatedBy });

    if (!collegeId || !deptCode || !formatId) {
      return res.status(400).json({ error: 'College ID, department code, and format ID are required' });
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.colleges?.list) {
      return res.status(404).json({ error: 'No colleges found' });
    }

    const collegeIndex = settings.colleges.list.findIndex((college: any) => college.id === collegeId);
    if (collegeIndex === -1) {
      return res.status(404).json({ error: 'College not found' });
    }

    const college = settings.colleges.list[collegeIndex];
    const deptIndex = college.departments.findIndex((dept: any) => dept.code === deptCode);
    if (deptIndex === -1) {
      return res.status(404).json({ error: 'Department not found in this college' });
    }

    const department = college.departments[deptIndex];
    console.log('  - Department found:', deptCode);
    console.log('  - Existing formats:', department.registrationFormats.map(f => ({ id: f.id, name: f.name, year: f.year })));

    const formatIndex = department.registrationFormats.findIndex((format: any) => format.id === formatId);
    console.log('  - Format index found:', formatIndex);

    if (formatIndex === -1) {
      return res.status(404).json({ error: 'Registration format not found' });
    }

    // Update registration format
    if (formats !== undefined) {
      department.registrationFormats[formatIndex].formats = formats;
    }
    // Note: Name cannot be changed once set to prevent conflicts
    // if (name !== undefined) {
    //   department.registrationFormats[formatIndex].name = name;
    // }
    department.registrationFormats[formatIndex].updatedAt = new Date();

    department.updatedAt = new Date();
    college.updatedAt = new Date();
    settings.colleges.lastUpdatedBy = updatedBy;
    settings.colleges.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`✏️ Registration format updated for department ${deptCode} by user ${updatedBy || 'unknown'}`);

    res.json({
      success: true,
      registrationFormat: department.registrationFormats[formatIndex],
      department: department,
      college: college,
      colleges: settings.colleges.list
    });
  } catch (error) {
    console.error('Error updating registration format:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ error: 'Failed to update registration format' });
  }
});

/**
 * Delete registration format for a department (admin only)
 */
router.delete('/colleges/:collegeId/departments/:deptCode/registration-formats/:formatId', async (req, res) => {
  try {
    const { collegeId, deptCode, formatId } = req.params;
    const { updatedBy } = req.body;

    if (!collegeId || !deptCode || !formatId) {
      return res.status(400).json({ error: 'College ID, department code, and format ID are required' });
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.colleges?.list) {
      return res.status(404).json({ error: 'No colleges found' });
    }

    const collegeIndex = settings.colleges.list.findIndex((college: any) => college.id === collegeId);
    if (collegeIndex === -1) {
      return res.status(404).json({ error: 'College not found' });
    }

    const college = settings.colleges.list[collegeIndex];
    const deptIndex = college.departments.findIndex((dept: any) => dept.code === deptCode);
    if (deptIndex === -1) {
      return res.status(404).json({ error: 'Department not found in this college' });
    }

    const department = college.departments[deptIndex];
    const formatIndex = department.registrationFormats.findIndex((format: any) => format.id === formatId);
    if (formatIndex === -1) {
      return res.status(404).json({ error: 'Registration format not found' });
    }

    // Remove registration format
    const deletedFormat = department.registrationFormats.splice(formatIndex, 1)[0];
    department.updatedAt = new Date();
    college.updatedAt = new Date();

    settings.colleges.lastUpdatedBy = updatedBy;
    settings.colleges.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`🗑️ Registration format "${deletedFormat.name}" deleted for department ${deptCode} by user ${updatedBy || 'unknown'}`);

    res.json({
      success: true,
      deletedRegistrationFormat: deletedFormat,
      department: department,
      college: college,
      colleges: settings.colleges.list
    });
  } catch (error) {
    console.error('Error deleting registration format:', error);
    res.status(500).json({ error: 'Failed to delete registration format' });
  }
});

// ==================== CANTEEN MANAGEMENT ENDPOINTS ====================

/**
 * Get all canteens
 */
router.get('/canteens', async (req, res) => {
  try {
    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings) {
      return res.json({ canteens: [] });
    }

    res.json({ canteens: settings.canteens?.list || [] });
  } catch (error) {
    console.error('Error fetching canteens:', error);
    res.status(500).json({ error: 'Failed to fetch canteens' });
  }
});

/**
 * Get canteens by college ID (efficient filtering)
 */
router.get('/canteens/by-college/:collegeId', async (req, res) => {
  try {
    const { collegeId } = req.params;

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings) {
      return res.json({ canteens: [] });
    }

    // Filter canteens by college ID - check both legacy field and array
    const collegeCanteens = settings.canteens?.list?.filter(canteen => {
      // Check if collegeId is in the array (new way) or matches legacy field (backward compatibility)
      const inArray = canteen.collegeIds && Array.isArray(canteen.collegeIds) && canteen.collegeIds.includes(collegeId);
      const matchesLegacy = canteen.collegeId === collegeId;
      return (inArray || matchesLegacy) && canteen.isActive !== false;
    }) || [];

    // Sort by priority (lower number = higher priority), then by name
    collegeCanteens.sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    console.log(`🏫 Fetched ${collegeCanteens.length} canteens for college ${collegeId}`);
    res.json({ canteens: collegeCanteens });
  } catch (error) {
    console.error('Error fetching canteens by college:', error);
    res.status(500).json({ error: 'Failed to fetch canteens' });
  }
});

/**
 * Get canteens by organization ID (efficient filtering)
 */
router.get('/canteens/by-organization/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params;

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings) {
      return res.json({ canteens: [] });
    }

    // Filter canteens by organization ID - check both legacy field and array
    const organizationCanteens = settings.canteens?.list?.filter(canteen => {
      // Check if organizationId is in the array (new way) or matches legacy field (backward compatibility)
      const inArray = canteen.organizationIds && Array.isArray(canteen.organizationIds) && canteen.organizationIds.includes(organizationId);
      const matchesLegacy = canteen.organizationId === organizationId;
      return (inArray || matchesLegacy) && canteen.isActive !== false;
    }) || [];

    // Sort by priority (lower number = higher priority), then by name
    organizationCanteens.sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    console.log(`🏢 Fetched ${organizationCanteens.length} canteens for organization ${organizationId}`);
    res.json({ canteens: organizationCanteens });
  } catch (error) {
    console.error('Error fetching canteens by organization:', error);
    res.status(500).json({ error: 'Failed to fetch canteens' });
  }
});

/**
 * Get canteens by restaurant ID
 */
router.get('/canteens/by-restaurant/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings) {
      return res.json({ canteens: [] });
    }

    // Filter canteens by restaurant ID
    const restaurantCanteens = settings.canteens?.list?.filter(canteen =>
      canteen.restaurantId === restaurantId && canteen.isActive
    ) || [];

    // Sort by priority (lower number = higher priority), then by name
    restaurantCanteens.sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    console.log(`🍽️ Fetched ${restaurantCanteens.length} canteens for restaurant ${restaurantId}`);
    res.json({ canteens: restaurantCanteens });
  } catch (error) {
    console.error('Error fetching canteens by restaurant:', error);
    res.status(500).json({ error: 'Failed to fetch canteens' });
  }
});

/**
 * Get canteens by institution (college or organization) with pagination
 * Used for preloading canteens on profile setup completion
 */
router.get('/canteens/by-institution', async (req, res) => {
  try {
    const { institutionType, institutionId, limit = 5, offset = 0, category } = req.query;

    console.log(`🏪 Fetching canteens for ${institutionType} ${institutionId} (limit: ${limit}, offset: ${offset}, category: ${category || 'none'})`)

      ;

    if (!institutionType || !institutionId) {
      return res.status(400).json({ error: 'institutionType and institutionId are required' });
    }

    const limitNum = parseInt(limit as string) || 5;
    const offsetNum = parseInt(offset as string) || 0;
    const categoryFilter = category as string | undefined;

    // Build the match condition based on institution type
    // Support both array-based (new) and single value (legacy) matching
    let matchCondition = {};
    if (institutionType === 'college') {
      matchCondition = {
        $or: [
          { 'canteens.list.collegeIds': institutionId }, // New: check if in array
          { 'canteens.list.collegeId': institutionId }    // Legacy: check single value
        ],
        'canteens.list.isActive': { $ne: false }
      };
    } else if (institutionType === 'organization') {
      matchCondition = {
        $or: [
          { 'canteens.list.organizationIds': institutionId }, // New: check if in array
          { 'canteens.list.organizationId': institutionId }   // Legacy: check single value
        ],
        'canteens.list.isActive': { $ne: false }
      };
    } else if (institutionType === 'restaurant') {
      matchCondition = {
        'canteens.list.restaurantId': institutionId,
        'canteens.list.isActive': { $ne: false }
      };
    } else {
      return res.status(400).json({ error: 'Invalid institutionType. Must be "college", "organization", or "restaurant"' });
    }

    // Use MongoDB aggregation for efficient database-level filtering and pagination
    const pipeline = [
      // Match the latest system settings document
      { $sort: { createdAt: -1 } },
      { $limit: 1 },

      // Unwind the canteens array
      { $unwind: '$canteens.list' },

      // Match canteens by institution type and active status
      { $match: matchCondition },

      // Project only the canteen fields we need
      {
        $project: {
          _id: '$canteens.list._id',
          id: '$canteens.list.id',
          name: '$canteens.list.name',
          code: '$canteens.list.code',
          description: '$canteens.list.description',
          location: '$canteens.list.location',
          contactNumber: '$canteens.list.contactNumber',
          email: '$canteens.list.email',
          canteenOwnerEmail: '$canteens.list.canteenOwnerEmail',
          collegeId: '$canteens.list.collegeId', // Legacy field
          collegeIds: '$canteens.list.collegeIds', // New array field
          organizationId: '$canteens.list.organizationId', // Legacy field
          organizationIds: '$canteens.list.organizationIds', // New array field
          restaurantId: '$canteens.list.restaurantId',
          type: '$canteens.list.type',
          operatingHours: '$canteens.list.operatingHours',
          isActive: '$canteens.list.isActive',
          priority: { $ifNull: ['$canteens.list.priority', 0] }, // Default to 0 if not set
          createdAt: '$canteens.list.createdAt',
          updatedAt: '$canteens.list.updatedAt',
          imageUrl: '$canteens.list.imageUrl', // Profile Picture URL
          imagePublicId: '$canteens.list.imagePublicId' // Cloudinary Public ID
        }
      },

      // Sort by priority (lower number = higher priority), then by name
      { $sort: { priority: 1, name: 1 } },

      // Group to get total count and paginated results
      {
        $facet: {
          totalCount: [{ $count: 'count' }],
          canteens: [
            { $skip: offsetNum },
            { $limit: limitNum }
          ]
        }
      }
    ];

    console.log(`🏪 Executing MongoDB aggregation pipeline for ${institutionType} ${institutionId}`);

    const result = await SystemSettingsModel.aggregate(pipeline);

    if (!result || result.length === 0) {
      return res.json({ canteens: [], total: 0, hasMore: false, limit: limitNum, offset: offsetNum });
    }

    const total = result[0].totalCount[0]?.count || 0;
    let canteens = result[0].canteens || [];
    const hasMore = offsetNum + limitNum < total;

    console.log(`🏪 MongoDB aggregation result: ${total} total canteens, returning ${canteens.length} canteens (hasMore: ${hasMore})`);

    // Apply category filtering if category is provided
    if (categoryFilter) {
      console.log(`🏪 Applying category filter: ${categoryFilter}`);
      console.log(`🏪 Total canteens before filtering: ${canteens.length}`);

      const { Category, MenuItem } = await import('../models/mongodb-models');

      // Filter canteens based on category
      const filteredCanteens = await Promise.all(
        canteens.map(async (canteen: any) => {
          try {
            const canteenIdentifier = canteen.id || canteen._id;
            console.log(`🏪 Checking canteen: ${canteen.name} (ID: ${canteenIdentifier})`);

            // Check if canteen has matching category
            const hasMatchingCategory = await Category.findOne({
              canteenId: canteenIdentifier,
              name: { $regex: categoryFilter, $options: 'i' } // Case-insensitive match
            });

            if (hasMatchingCategory) {
              console.log(`🏪 ✅ Canteen "${canteen.name}" matches via category: ${hasMatchingCategory.name}`);
              return canteen;
            }

            // Check if any menu item name contains the category as substring
            const hasMatchingMenuItem = await MenuItem.findOne({
              canteenId: canteenIdentifier,
              name: { $regex: categoryFilter, $options: 'i' } // Case-insensitive substring match
            });

            if (hasMatchingMenuItem) {
              console.log(`🏪 ✅ Canteen "${canteen.name}" matches via menu item: ${hasMatchingMenuItem.name}`);
              return canteen;
            }

            console.log(`🏪 ❌ Canteen "${canteen.name}" does NOT match category "${categoryFilter}"`);
            return null; // No match found
          } catch (error) {
            console.error(`Error filtering canteen ${canteen.id}:`, error);
            return null;
          }
        })
      );

      // Remove null values (canteens that didn't match)
      canteens = filteredCanteens.filter((c: any) => c !== null);
      console.log(`🏪 After category filtering: ${canteens.length} canteens match "${categoryFilter}"`);
    }

    // Fetch trending items for each canteen (up to 4 items)
    const canteensWithTrending = await Promise.all(
      canteens.map(async (canteen: any) => {
        try {
          const trendingItems = await orderService.getTrendingItems(canteen.id);
          // Extract name and price, limit to 4 items
          const trendingItemsData = trendingItems
            .slice(0, 4)
            .map((item: any) => ({
              name: item.name,
              price: item.price
            }))
            .filter((item: any) => item.name && item.price !== undefined); // Filter out invalid items

          return {
            ...canteen,
            trendingItems: trendingItemsData
          };
        } catch (error) {
          console.error(`Error fetching trending items for canteen ${canteen.id}:`, error);
          // Return canteen with empty trending items on error
          return {
            ...canteen,
            trendingItems: []
          };
        }
      })
    );

    console.log(`🏪 Added trending items to ${canteensWithTrending.length} canteens`);

    // Fetch categories for each canteen (up to 3 categories)
    const { Category } = await import('../models/mongodb-models');
    const canteensWithCategories = await Promise.all(
      canteensWithTrending.map(async (canteen: any) => {
        try {
          // Fetch categories for this canteen
          const categories = await Category.find({ canteenId: canteen.id })
            .sort({ name: 1 })
            .limit(3)
            .lean();

          // Extract only the names
          const categoryNames = categories
            .map((cat: any) => cat.name)
            .filter((name: string) => name); // Filter out any undefined/null names

          return {
            ...canteen,
            categories: categoryNames
          };
        } catch (error) {
          console.error(`Error fetching categories for canteen ${canteen.id}:`, error);
          // Return canteen with empty categories on error
          return {
            ...canteen,
            categories: []
          };
        }
      })
    );

    console.log(`🏪 Added categories to ${canteensWithCategories.length} canteens`);

    res.json({
      canteens: canteensWithCategories,
      total,
      hasMore,
      limit: limitNum,
      offset: offsetNum
    });
  } catch (error) {
    console.error('Error fetching canteens by institution:', error);
    res.status(500).json({ error: 'Failed to fetch canteens' });
  }
});

/**
 * Get canteen by owner email
 */
router.get('/canteens/by-owner/:email', async (req, res) => {
  try {
    const { email } = req.params;

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.canteens?.list) {
      return res.status(404).json({ error: 'No canteens found' });
    }

    const canteen = settings.canteens.list.find(c => c.canteenOwnerEmail === email);

    if (!canteen) {
      return res.status(404).json({ error: 'Canteen not found for this owner' });
    }

    res.json({ canteen });
  } catch (error) {
    console.error('Error fetching canteen by owner email:', error);
    res.status(500).json({ error: 'Failed to fetch canteen' });
  }
});

/**
 * Get canteen by ID
 */
router.get('/canteens/:id', async (req, res) => {
  try {
    const { id } = req.params;

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.canteens?.list) {
      return res.status(404).json({ error: 'No canteens found' });
    }

    const canteen = settings.canteens.list.find(c => c.id === id);

    if (!canteen) {
      return res.status(404).json({ error: 'Canteen not found' });
    }

    console.log('🏪 Server: Returning canteen data for ID:', id, canteen);
    res.json(canteen);
  } catch (error) {
    console.error('Error fetching canteen by ID:', error);
    res.status(500).json({ error: 'Failed to fetch canteen' });
  }
});

/**
 * Add a new canteen
 */
router.post('/canteens', async (req, res) => {
  try {
    const { name, code, description, location, contactNumber, email, canteenOwnerEmail, collegeId, organizationId, collegeIds, organizationIds, restaurantId, type, operatingHours, isActive = true, priority = 0 } = req.body;
    const updatedBy = req.body.updatedBy;

    console.log('Received canteen data:', { name, code, collegeId, organizationId, collegeIds, organizationIds, updatedBy }); // Debug log

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    // Handle backward compatibility: if collegeId/organizationId provided, convert to arrays
    const finalCollegeIds = collegeIds || (collegeId ? [collegeId] : []);
    const finalOrganizationIds = organizationIds || (organizationId ? [organizationId] : []);
    const defaultOwnerSidebarConfig = {
      overview: true,
      counters: true,
      orders: true,
      "payment-counter": true,
      "pos-billing": true,
      menu: true,
      content: true,
      analytics: true,
      "delivery-management": true,
      payout: true,
      "position-bidding": true,
      "store-mode": true
    };

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings) {
      // Create default settings if none exist
      const defaultSettings: InsertSystemSettings = {
        maintenanceMode: {
          isActive: false,
          title: 'System Maintenance',
          message: 'We are currently performing system maintenance. Please check back later.',
          estimatedTime: '',
          contactInfo: '',
          targetingType: 'all',
          specificUsers: [],
          targetColleges: [],
          targetDepartments: [],
          targetYears: [],
          yearType: 'current'
        },
        notifications: {
          isEnabled: true
        },
        appVersion: {
          version: '1.0.0',
          buildTimestamp: Date.now()
        },
        colleges: {
          list: []
        },
        canteens: {
          list: [{
            id: `canteen-${Date.now()}`,
            name,
            code,
            description,
            location,
            contactNumber,
            email,
            canteenOwnerEmail,
            collegeId, // Legacy field
            collegeIds: finalCollegeIds,
            organizationId, // Legacy field
            organizationIds: finalOrganizationIds,
            restaurantId,
            type,
            operatingHours,
            isActive,
            priority,
            ownerSidebarConfig: defaultOwnerSidebarConfig,
            createdAt: new Date(),
            updatedAt: new Date()
          }]
        }
      };

      settings = new SystemSettingsModel(defaultSettings);
      await settings.save();
    } else {
      // Check if canteen code already exists
      const existingCanteen = settings.canteens?.list?.find((canteen: any) => canteen.code === code);
      if (existingCanteen) {
        return res.status(409).json({ error: 'Canteen code already exists' });
      }

      // Initialize canteens if it doesn't exist
      if (!settings.canteens) {
        settings.canteens = { list: [] as any };
      }

      settings.canteens.list.push({
        id: `canteen-${Date.now()}`,
        name,
        code,
        description,
        location,
        contactNumber,
        email,
        canteenOwnerEmail,
        collegeId, // Legacy field
        collegeIds: finalCollegeIds,
        organizationId, // Legacy field
        organizationIds: finalOrganizationIds,
        restaurantId,
        type,
        operatingHours,
        priority,
        isActive,
        ownerSidebarConfig: defaultOwnerSidebarConfig,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      settings.canteens!.lastUpdatedBy = updatedBy;
      settings.canteens!.lastUpdatedAt = new Date();
    }

    settings.updatedAt = new Date();
    await settings.save();

    console.log(`➕ New canteen added by user ${updatedBy || 'unknown'}: ${code} - ${name} - Colleges: ${finalCollegeIds.join(', ')} - Organizations: ${finalOrganizationIds.join(', ')}`);

    res.json({
      success: true,
      canteen: { id: `canteen-${Date.now()}`, name, code, isActive, collegeIds: finalCollegeIds, organizationIds: finalOrganizationIds },
      canteens: settings.canteens?.list || []
    });
  } catch (error) {
    console.error('Error adding canteen:', error);
    res.status(500).json({ error: 'Failed to add canteen' });
  }
});

/**
 * Update a canteen
 */
router.put('/canteens/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, location, contactNumber, email, canteenOwnerEmail, collegeId, organizationId, collegeIds, organizationIds, restaurantId, type, operatingHours, isActive, priority } = req.body;
    const updatedBy = req.body.updatedBy;

    console.log('Updating canteen:', { id, name, code, collegeId, organizationId, collegeIds, organizationIds, updatedBy, priority }); // Debug log

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.canteens?.list) {
      return res.status(404).json({ error: 'Canteen not found' });
    }

    const canteenIndex = settings.canteens.list.findIndex((canteen: any) => canteen.id === id);
    if (canteenIndex === -1) {
      return res.status(404).json({ error: 'Canteen not found' });
    }

    // Update canteen
    if (name !== undefined) {
      settings.canteens.list[canteenIndex].name = name;
    }
    if (code !== undefined) {
      settings.canteens.list[canteenIndex].code = code;
    }
    if (description !== undefined) {
      settings.canteens.list[canteenIndex].description = description;
    }
    if (location !== undefined) {
      settings.canteens.list[canteenIndex].location = location;
    }
    if (contactNumber !== undefined) {
      settings.canteens.list[canteenIndex].contactNumber = contactNumber;
    }
    if (email !== undefined) {
      settings.canteens.list[canteenIndex].email = email;
    }
    if (canteenOwnerEmail !== undefined) {
      settings.canteens.list[canteenIndex].canteenOwnerEmail = canteenOwnerEmail;
    }
    // Handle backward compatibility: if collegeId/organizationId provided, convert to arrays
    if (collegeIds !== undefined) {
      settings.canteens.list[canteenIndex].collegeIds = collegeIds;
      // Also update legacy field for backward compatibility
      if (collegeIds.length > 0) {
        settings.canteens.list[canteenIndex].collegeId = collegeIds[0];
      }
    } else if (collegeId !== undefined) {
      settings.canteens.list[canteenIndex].collegeId = collegeId;
      // Convert single value to array if array doesn't exist
      if (!settings.canteens.list[canteenIndex].collegeIds) {
        settings.canteens.list[canteenIndex].collegeIds = [collegeId];
      } else if (!settings.canteens.list[canteenIndex].collegeIds.includes(collegeId)) {
        settings.canteens.list[canteenIndex].collegeIds.push(collegeId);
      }
    }
    if (organizationIds !== undefined) {
      settings.canteens.list[canteenIndex].organizationIds = organizationIds;
      // Also update legacy field for backward compatibility
      if (organizationIds.length > 0) {
        settings.canteens.list[canteenIndex].organizationId = organizationIds[0];
      }
    } else if (organizationId !== undefined) {
      settings.canteens.list[canteenIndex].organizationId = organizationId;
      // Convert single value to array if array doesn't exist
      if (!settings.canteens.list[canteenIndex].organizationIds) {
        settings.canteens.list[canteenIndex].organizationIds = [organizationId];
      } else if (!settings.canteens.list[canteenIndex].organizationIds.includes(organizationId)) {
        settings.canteens.list[canteenIndex].organizationIds.push(organizationId);
      }
    }
    if (restaurantId !== undefined) {
      settings.canteens.list[canteenIndex].restaurantId = restaurantId;
    }
    if (type !== undefined) {
      settings.canteens.list[canteenIndex].type = type;
    }
    if (operatingHours !== undefined) {
      settings.canteens.list[canteenIndex].operatingHours = operatingHours;
    }
    if (isActive !== undefined) {
      settings.canteens.list[canteenIndex].isActive = isActive;
    }
    if (priority !== undefined) {
      settings.canteens.list[canteenIndex].priority = priority;
      console.log(`✏️ Updating canteen ${id} priority to: ${priority}`);
    }
    settings.canteens.list[canteenIndex].updatedAt = new Date();

    settings.canteens!.lastUpdatedBy = updatedBy;
    settings.canteens!.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    // Mark the canteens array as modified to ensure Mongoose saves nested changes
    settings.markModified('canteens.list');

    await settings.save();

    console.log(`✏️ Canteen updated by user ${updatedBy || 'unknown'}: ${id} - Priority: ${settings.canteens.list[canteenIndex].priority} - Colleges: ${settings.canteens.list[canteenIndex].collegeIds?.join(', ') || 'none'} - Organizations: ${settings.canteens.list[canteenIndex].organizationIds?.join(', ') || 'none'}`);

    res.json({
      success: true,
      canteen: settings.canteens.list[canteenIndex],
      canteens: settings.canteens.list
    });
  } catch (error) {
    console.error('Error updating canteen:', error);
    res.status(500).json({ error: 'Failed to update canteen' });
  }
});

/**
 * Update canteen content settings
 */
router.put('/canteens/:id/content-settings', async (req, res) => {
  try {
    const { id } = req.params;
    const { codingChallengesEnabled, ownerSidebarConfig, payAtCounterEnabled, deliveryEnabled, updatedBy } = req.body;

    console.log('Updating canteen content settings:', { id, codingChallengesEnabled, payAtCounterEnabled, deliveryEnabled, updatedBy });

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.canteens?.list) {
      return res.status(404).json({ error: 'Canteen not found' });
    }

    const canteenIndex = settings.canteens.list.findIndex((canteen: any) => canteen.id === id);
    if (canteenIndex === -1) {
      return res.status(404).json({ error: 'Canteen not found' });
    }

    // Update content settings
    if (codingChallengesEnabled !== undefined) {
      settings.canteens.list[canteenIndex].codingChallengesEnabled = codingChallengesEnabled;
    }
    if (payAtCounterEnabled !== undefined) {
      settings.canteens.list[canteenIndex].payAtCounterEnabled = payAtCounterEnabled;
    }
    if (deliveryEnabled !== undefined) {
      settings.canteens.list[canteenIndex].deliveryEnabled = deliveryEnabled;
    }
    if (ownerSidebarConfig !== undefined) {
      // Merge with defaults to avoid losing keys
      const defaultOwnerSidebarConfig = {
        overview: true,
        counters: true,
        "payment-counter": true,
        "pos-billing": true,
        orders: true,
        menu: true,
        content: true,
        analytics: true,
        "delivery-management": true,
        payout: true,
        "position-bidding": true,
        "store-mode": true
      };
      settings.canteens.list[canteenIndex].ownerSidebarConfig = {
        ...defaultOwnerSidebarConfig,
        ...ownerSidebarConfig
      };
    }

    settings.canteens.list[canteenIndex].updatedAt = new Date();
    settings.canteens!.lastUpdatedBy = updatedBy;
    settings.canteens!.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`✏️ Canteen content settings updated by user ${updatedBy || 'unknown'}: ${id} - Coding Challenges: ${codingChallengesEnabled ? 'enabled' : 'disabled'}`);

    res.json({
      success: true,
      canteen: settings.canteens.list[canteenIndex],
      canteens: settings.canteens.list
    });
  } catch (error) {
    console.error('Error updating canteen content settings:', error);
    res.status(500).json({ error: 'Failed to update canteen content settings' });
  }
});

/**
 * Delete a canteen
 */
router.delete('/canteens/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedBy = req.body.updatedBy;

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.canteens?.list) {
      return res.status(404).json({ error: 'Canteen not found' });
    }

    const canteenIndex = settings.canteens.list.findIndex((canteen: any) => canteen.id === id);
    if (canteenIndex === -1) {
      return res.status(404).json({ error: 'Canteen not found' });
    }

    // Remove canteen
    const deletedCanteen = settings.canteens.list.splice(canteenIndex, 1)[0];

    settings.canteens!.lastUpdatedBy = updatedBy;
    settings.canteens!.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`🗑️ Canteen deleted by user ${updatedBy || 'unknown'}: ${id} - ${deletedCanteen.name}`);

    res.json({
      success: true,
      deletedCanteen,
      canteens: settings.canteens.list
    });
  } catch (error) {
    console.error('Error deleting canteen:', error);
    res.status(500).json({ error: 'Failed to delete canteen' });
  }
});

// Migration endpoint to update canteen IDs
router.post('/migrate-canteen-ids', async (req, res) => {
  try {
    const OLD_CANTEEN_ID = '68cbd4d516f0e1a512cb6504';
    const NEW_CANTEEN_ID = 'canteen-1758205071111';

    console.log('🔄 Starting canteen ID migration...');
    console.log(`📝 Updating from ${OLD_CANTEEN_ID} to ${NEW_CANTEEN_ID}`);

    // Use the same mongoose connection that the models use
    if (!mongoose.connection.db) {
      throw new Error('MongoDB not connected');
    }

    const db = mongoose.connection.db;

    // Collections to update
    const collections = [
      'categories',
      'menuitems',
      'orders',
      'notifications',
      'quickorders',
      'complaints',
      'coupons',
      'payments'
    ];

    const results = {};

    for (const collectionName of collections) {
      const collection = db.collection(collectionName);

      // Debug: Show total documents in collection
      const totalCount = await collection.countDocuments();
      console.log(`📊 Total documents in ${collectionName}: ${totalCount}`);

      // Debug: Show sample documents
      const sampleDocs = await collection.find({}).limit(2).toArray();
      console.log(`📋 Sample documents in ${collectionName}:`, sampleDocs.map(doc => ({ id: doc._id, canteenId: doc.canteenId })));

      // Count documents with old canteen ID
      const count = await collection.countDocuments({ canteenId: OLD_CANTEEN_ID });
      console.log(`📊 Found ${count} documents in ${collectionName} with old canteen ID`);

      if (count > 0) {
        // Update all documents with old canteen ID to new canteen ID
        const result = await collection.updateMany(
          { canteenId: OLD_CANTEEN_ID },
          { $set: { canteenId: NEW_CANTEEN_ID } }
        );

        console.log(`✅ Updated ${result.modifiedCount} documents in ${collectionName}`);
        results[collectionName] = { updated: result.modifiedCount };
      } else {
        results[collectionName] = { updated: 0 };
      }
    }

    // Also update documents that don't have canteenId at all
    for (const collectionName of collections) {
      const collection = db.collection(collectionName);

      // Count documents without canteenId
      const count = await collection.countDocuments({ canteenId: { $exists: false } });
      console.log(`📊 Found ${count} documents in ${collectionName} without canteenId`);

      if (count > 0) {
        // Add canteenId to documents that don't have it
        const result = await collection.updateMany(
          { canteenId: { $exists: false } },
          { $set: { canteenId: NEW_CANTEEN_ID } }
        );

        console.log(`✅ Added canteenId to ${result.modifiedCount} documents in ${collectionName}`);
        results[collectionName] = {
          ...results[collectionName],
          added: result.modifiedCount
        };
      } else {
        results[collectionName] = {
          ...results[collectionName],
          added: 0
        };
      }
    }

    console.log('🎉 Migration completed successfully!');

    res.json({
      success: true,
      message: 'Canteen ID migration completed successfully',
      results
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Migration endpoint to update existing users with default college
 */
router.post('/migrate-user-colleges', async (req, res) => {
  try {
    const { defaultCollegeCode = 'DEFAULT', updatedBy } = req.body;

    console.log(`🔄 Starting user college migration with default college: ${defaultCollegeCode}`);

    // Use the already imported storage instance

    const allUsers = await storage.getAllUsers();
    console.log(`📊 Found ${allUsers.length} total users`);

    // Filter users without college information
    const usersWithoutCollege = allUsers.filter((user: any) => !user.college || user.college.trim() === '');
    console.log(`📋 Found ${usersWithoutCollege.length} users without college information`);

    if (usersWithoutCollege.length === 0) {
      return res.json({
        success: true,
        message: 'No users need college migration',
        totalUsers: allUsers.length,
        usersUpdated: 0
      });
    }

    // Update users with default college
    let updatedCount = 0;
    const updateResults = [];

    for (const user of usersWithoutCollege) {
      try {
        console.log(`🔄 Updating user ${user.id} (${user.email}) with college: ${defaultCollegeCode}`);

        const updatedUser = await storage.updateUser(user.id, { college: defaultCollegeCode });
        updatedCount++;
        updateResults.push({
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          oldCollege: user.college || 'null',
          newCollege: defaultCollegeCode,
          success: true
        });

        console.log(`✅ User ${user.id} updated successfully`);
      } catch (error) {
        console.error(`❌ Failed to update user ${user.id}:`, error);
        updateResults.push({
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          oldCollege: user.college || 'null',
          newCollege: defaultCollegeCode,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    console.log(`🎉 User college migration completed! Updated ${updatedCount} out of ${usersWithoutCollege.length} users`);

    res.json({
      success: true,
      message: `User college migration completed successfully`,
      totalUsers: allUsers.length,
      usersNeedingUpdate: usersWithoutCollege.length,
      usersUpdated: updatedCount,
      usersFailed: usersWithoutCollege.length - updatedCount,
      defaultCollegeCode,
      results: updateResults
    });

  } catch (error) {
    console.error('❌ User college migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'User college migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug endpoint to check database connection
router.get('/debug-db', async (req, res) => {
  try {
    const db = mongoose.connection.db;

    if (!db) {
      return res.json({ error: 'MongoDB not connected' });
    }

    // Get database name
    const dbName = db.databaseName;

    // Get collections
    const collections = await db.listCollections().toArray();

    // Get sample data from orders collection
    const ordersCollection = db.collection('orders');
    const orderCount = await ordersCollection.countDocuments();
    const sampleOrder = await ordersCollection.findOne({});

    res.json({
      databaseName: dbName,
      collections: collections.map(c => c.name),
      ordersCount: orderCount,
      sampleOrder: sampleOrder ? {
        id: sampleOrder._id,
        orderNumber: sampleOrder.orderNumber,
        canteenId: sampleOrder.canteenId
      } : null
    });

  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Test endpoint to update one order
router.post('/test-update-order', async (req, res) => {
  try {
    const OLD_CANTEEN_ID = '68cbd4d516f0e1a512cb6504';
    const NEW_CANTEEN_ID = 'canteen-1758205071111';

    const db = mongoose.connection.db;
    const ordersCollection = db.collection('orders');

    // Find one order with old canteen ID
    const order = await ordersCollection.findOne({ canteenId: OLD_CANTEEN_ID });

    if (!order) {
      return res.json({ error: 'No order found with old canteen ID' });
    }

    // Update that order
    const result = await ordersCollection.updateOne(
      { _id: order._id },
      { $set: { canteenId: NEW_CANTEEN_ID } }
    );

    res.json({
      success: true,
      originalOrder: { id: order._id, orderNumber: order.orderNumber, canteenId: order.canteenId },
      updateResult: result,
      newCanteenId: NEW_CANTEEN_ID
    });

  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * ========================================
 * ORGANIZATION MANAGEMENT ENDPOINTS
 * ========================================
 */

/**
 * Get organizations list (admin only)
 */
router.get('/organizations', async (req, res) => {
  try {
    console.log('🏢 Fetching organizations...');
    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    console.log('🏢 Settings found:', settings ? 'Yes' : 'No');
    console.log('🏢 Organizations list:', settings?.organizations?.list ? `Found ${settings.organizations.list.length} organizations` : 'No organizations list');

    if (!settings || !settings.organizations?.list) {
      // Return empty list if no organizations exist
      console.log('🏢 Returning empty organizations list');
      return res.json({ organizations: [] });
    }

    // Ensure all organizations have activeRoles field and migrate if needed
    let needsMigration = false;
    const organizationsWithRoles = settings.organizations.list.map((org: any) => {
      if (!org.activeRoles) {
        needsMigration = true;
        return {
          ...org,
          activeRoles: {
            employee: true,
            contractor: true,
            visitor: true,
            guest: true
          }
        };
      }
      return org;
    });

    // If migration is needed, save the updated organizations to database
    if (needsMigration) {
      console.log('🔄 Migrating organizations to add activeRoles field...');
      settings.organizations.list = organizationsWithRoles;
      settings.organizations.lastUpdatedAt = new Date();
      settings.updatedAt = new Date();
      await settings.save();
      console.log('✅ Migration completed - activeRoles added to all organizations');
    }

    res.json({ organizations: organizationsWithRoles });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

/**
 * Add a new organization (admin only)
 */
router.post('/organizations', async (req, res) => {
  try {
    console.log('🏢 Creating new organization with data:', req.body);
    const {
      name,
      code,
      description,
      companyType = 'Other',
      industry,
      location,
      contactEmail,
      contactPhone,
      isActive = true,
      activeRoles = { employee: true, contractor: true, visitor: true, guest: true },
      updatedBy
    } = req.body;

    if (!name || !code) {
      console.log('🏢 Missing required fields:', { name: !!name, code: !!code });
      return res.status(400).json({ error: 'Organization name and code are required' });
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings) {
      // Create default settings if none exist
      const defaultSettings: InsertSystemSettings = {
        maintenanceMode: {
          isActive: false,
          title: 'System Maintenance',
          message: 'We are currently performing system maintenance. Please check back later.',
          estimatedTime: '',
          contactInfo: '',
          targetingType: 'all',
          specificUsers: [],
          targetColleges: [],
          targetDepartments: [],
          targetYears: [],
          yearType: 'current'
        },
        notifications: {
          isEnabled: true
        },
        appVersion: {
          version: '1.0.0',
          buildTimestamp: Date.now()
        },
        organizations: {
          list: [{
            id: `org-${Date.now()}`,
            name,
            code,
            description,
            companyType,
            industry,
            location,
            contactEmail,
            contactPhone,
            isActive,
            activeRoles,
            departments: [],
            createdAt: new Date(),
            updatedAt: new Date()
          }]
        },
        colleges: {
          list: []
        },
        canteens: {
          list: []
        }
      };

      settings = new SystemSettingsModel(defaultSettings);
    } else {
      // Check if organization code already exists
      if (!settings.organizations) {
        settings.organizations = {
          list: [] as any,
          lastUpdatedBy: updatedBy,
          lastUpdatedAt: new Date()
        };
      }

      const existingOrganization = settings.organizations.list.find((org: any) => org.code === code);
      if (existingOrganization) {
        return res.status(409).json({ error: 'Organization code already exists' });
      }

      // Add new organization
      settings.organizations.list.push({
        id: `org-${Date.now()}`,
        name,
        code,
        description,
        companyType,
        industry,
        location,
        contactEmail,
        contactPhone,
        isActive,
        activeRoles,
        departments: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });

      settings.organizations.lastUpdatedBy = updatedBy;
      settings.organizations.lastUpdatedAt = new Date();
    }

    settings.updatedAt = new Date();
    await settings.save();

    console.log(`➕ New organization added by user ${updatedBy || 'unknown'}: ${code} - ${name}`);
    console.log('🏢 Organizations after save:', settings.organizations?.list?.length || 0);

    res.json({
      success: true,
      organization: { id: `org-${Date.now()}`, name, code, description, isActive },
      organizations: settings.organizations?.list || []
    });
  } catch (error) {
    console.error('Error adding organization:', error);
    res.status(500).json({ error: 'Failed to add organization' });
  }
});

/**
 * Get a specific organization by ID (admin only)
 */
router.get('/organizations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.organizations?.list) {
      return res.status(404).json({ error: 'No organizations found' });
    }

    const organization = settings.organizations.list.find((org: any) => org.id === id);

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json({ organization });
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

/**
 * Update a specific organization (admin only)
 */
router.put('/organizations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, isActive, updatedBy } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.organizations?.list) {
      return res.status(404).json({ error: 'No organizations found' });
    }

    const orgIndex = settings.organizations.list.findIndex((org: any) => org.id === id);
    if (orgIndex === -1) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Update organization
    if (name !== undefined) {
      settings.organizations.list[orgIndex].name = name;
    }
    if (code !== undefined) {
      settings.organizations.list[orgIndex].code = code;
    }
    if (description !== undefined) {
      settings.organizations.list[orgIndex].description = description;
    }
    if (isActive !== undefined) {
      settings.organizations.list[orgIndex].isActive = isActive;
    }
    settings.organizations.list[orgIndex].updatedAt = new Date();

    settings.organizations.lastUpdatedBy = updatedBy;
    settings.organizations.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`✏️ Organization updated by user ${updatedBy || 'unknown'}: ${id}`);

    res.json({
      success: true,
      organization: settings.organizations.list[orgIndex],
      organizations: settings.organizations.list
    });
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

/**
 * Delete a specific organization (admin only)
 */
router.delete('/organizations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { updatedBy } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.organizations?.list) {
      return res.status(404).json({ error: 'No organizations found' });
    }

    const orgIndex = settings.organizations.list.findIndex((org: any) => org.id === id);
    if (orgIndex === -1) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const organization = settings.organizations.list[orgIndex];

    // Remove organization
    settings.organizations.list.splice(orgIndex, 1);

    settings.organizations.lastUpdatedBy = updatedBy;
    settings.organizations.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`🗑️ Organization deleted by user ${updatedBy || 'unknown'}: ${organization.code} - ${organization.name}`);

    res.json({
      success: true,
      organizations: settings.organizations.list
    });
  } catch (error) {
    console.error('Error deleting organization:', error);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

/**
 * Update organization active roles (admin only)
 */
router.put('/organizations/:id/roles', async (req, res) => {
  try {
    const { id } = req.params;
    const { activeRoles, updatedBy } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    if (!activeRoles || typeof activeRoles !== 'object') {
      return res.status(400).json({ error: 'Active roles object is required' });
    }

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.organizations?.list) {
      return res.status(404).json({ error: 'No organizations found' });
    }

    const orgIndex = settings.organizations.list.findIndex((org: any) => org.id === id);
    if (orgIndex === -1) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Update active roles
    const newActiveRoles = {
      employee: activeRoles.employee !== undefined ? activeRoles.employee : true,
      contractor: activeRoles.contractor !== undefined ? activeRoles.contractor : true,
      visitor: activeRoles.visitor !== undefined ? activeRoles.visitor : true,
      guest: activeRoles.guest !== undefined ? activeRoles.guest : true
    };

    console.log(`🔧 Updating roles for organization ${id}:`, {
      oldRoles: settings.organizations.list[orgIndex].activeRoles,
      newRoles: newActiveRoles
    });

    settings.organizations.list[orgIndex].activeRoles = newActiveRoles;
    settings.organizations.list[orgIndex].updatedAt = new Date();

    settings.organizations.lastUpdatedBy = updatedBy;
    settings.organizations.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`✅ Organization roles saved to database for organization ${id}:`, newActiveRoles);

    res.json({
      success: true,
      organization: settings.organizations.list[orgIndex],
      organizations: settings.organizations.list
    });
  } catch (error) {
    console.error('Error updating organization roles:', error);
    res.status(500).json({ error: 'Failed to update organization roles' });
  }
});

/**
 * Add a new department to an organization (admin only)
 */
router.post('/organizations/:orgId/departments', async (req, res) => {
  try {
    console.log('🏢 Creating new department with data:', req.body);
    const {
      name,
      code,
      description,
      departmentType = 'Other',
      isActive = true,
      updatedBy
    } = req.body;

    if (!name || !code) {
      console.log('🏢 Missing required fields:', { name: !!name, code: !!code });
      return res.status(400).json({ error: 'Department name and code are required' });
    }

    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });
    if (!settings) {
      return res.status(404).json({ error: 'System settings not found' });
    }

    const orgIndex = settings.organizations.list.findIndex((org: any) => org.id === req.params.orgId);
    if (orgIndex === -1) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check if department code already exists in this organization
    const existingDepartment = settings.organizations.list[orgIndex].departments.find((dept: any) => dept.code === code);
    if (existingDepartment) {
      return res.status(409).json({ error: 'Department code already exists in this organization' });
    }

    // Add new department
    const departmentId = `dept-${Date.now()}`;
    const newDepartment = {
      id: departmentId,
      name,
      code,
      description,
      departmentType,
      isActive,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('🏢 Adding new department:', newDepartment);
    settings.organizations.list[orgIndex].departments.push(newDepartment);

    settings.organizations.list[orgIndex].updatedAt = new Date();
    settings.organizations.lastUpdatedBy = updatedBy;
    settings.organizations.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`➕ New department added by user ${updatedBy || 'unknown'}: ${code} - ${name}`);
    console.log('🏢 Organizations after save:', settings.organizations?.list?.length || 0);
    console.log('🏢 Departments in organization after save:', settings.organizations.list[orgIndex].departments.length);

    res.status(201).json({
      message: 'Department added successfully',
      department: newDepartment
    });
  } catch (error) {
    console.error('Error adding department:', error);
    res.status(500).json({ error: 'Failed to add department' });
  }
});

/**
 * Update a department in an organization (admin only)
 */
router.put('/organizations/:orgId/departments/:deptId', async (req, res) => {
  try {
    console.log('🏢 Updating department with data:', req.body);
    const {
      name,
      code,
      description,
      departmentType,
      isActive,
      updatedBy
    } = req.body;

    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });
    if (!settings) {
      return res.status(404).json({ error: 'System settings not found' });
    }

    const orgIndex = settings.organizations.list.findIndex((org: any) => org.id === req.params.orgId);
    if (orgIndex === -1) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const deptIndex = settings.organizations.list[orgIndex].departments.findIndex((dept: any) => dept.id === req.params.deptId);
    if (deptIndex === -1) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Check if department code already exists in this organization (excluding current department)
    if (code && code !== settings.organizations.list[orgIndex].departments[deptIndex].code) {
      const existingDepartment = settings.organizations.list[orgIndex].departments.find((dept: any) => dept.code === code && dept.id !== req.params.deptId);
      if (existingDepartment) {
        return res.status(409).json({ error: 'Department code already exists in this organization' });
      }
    }

    // Update department
    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code;
    if (description !== undefined) updateData.description = description;
    if (departmentType !== undefined) updateData.departmentType = departmentType;
    if (isActive !== undefined) updateData.isActive = isActive;

    Object.assign(settings.organizations.list[orgIndex].departments[deptIndex], updateData);

    settings.organizations.list[orgIndex].updatedAt = new Date();
    settings.organizations.lastUpdatedBy = updatedBy;
    settings.organizations.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`✏️ Department updated by user ${updatedBy || 'unknown'}: ${req.params.deptId}`);
    res.json({ message: 'Department updated successfully' });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

/**
 * Delete a department from an organization (admin only)
 */
router.delete('/organizations/:orgId/departments/:deptId', async (req, res) => {
  try {
    console.log('🏢 Deleting department:', req.params.deptId);

    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });
    if (!settings) {
      return res.status(404).json({ error: 'System settings not found' });
    }

    const orgIndex = settings.organizations.list.findIndex((org: any) => org.id === req.params.orgId);
    if (orgIndex === -1) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const deptIndex = settings.organizations.list[orgIndex].departments.findIndex((dept: any) => dept.id === req.params.deptId);
    if (deptIndex === -1) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Remove department
    const deletedDepartment = settings.organizations.list[orgIndex].departments.splice(deptIndex, 1)[0];

    settings.organizations.list[orgIndex].updatedAt = new Date();
    settings.organizations.lastUpdatedBy = req.body.updatedBy;
    settings.organizations.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`🗑️ Department deleted by user ${req.body.updatedBy || 'unknown'}: ${deletedDepartment.code} - ${deletedDepartment.name}`);
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

/**
 * Test route to verify organization routing is working
 */
router.get('/organizations/test', async (req, res) => {
  console.log('🏢 [TEST] Test route hit');
  res.json({ message: 'Organization routes are working', timestamp: new Date().toISOString() });
});

/**
 * Get all departments for an organization (admin only)
 */
router.get('/organizations/:orgId/departments', async (req, res) => {
  try {
    console.log('🏢 [GET] Fetching departments for organization:', req.params.orgId);
    console.log('🏢 [GET] Full URL:', req.originalUrl);
    console.log('🏢 [GET] Method:', req.method);

    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });
    if (!settings) {
      console.log('🏢 [GET] No system settings found');
      return res.status(404).json({ error: 'System settings not found' });
    }

    console.log('🏢 [GET] Found system settings, organizations count:', settings.organizations?.list?.length || 0);

    const orgIndex = settings.organizations.list.findIndex((org: any) => org.id === req.params.orgId);
    if (orgIndex === -1) {
      console.log('🏢 [GET] Organization not found:', req.params.orgId);
      console.log('🏢 [GET] Available organizations:', settings.organizations.list.map((org: any) => org.id));
      return res.status(404).json({ error: 'Organization not found' });
    }

    const departments = settings.organizations.list[orgIndex].departments || [];
    console.log('🏢 [GET] Found departments:', departments.length);
    console.log('🏢 [GET] Department details:', departments.map((dept: any) => ({ id: dept.id, code: dept.code, name: dept.name })));

    res.json({ departments });
  } catch (error) {
    console.error('🏢 [GET] Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

/**
 * Get registration formats for a department in an organization (admin only)
 */
router.get('/organizations/:orgId/departments/:deptId/registration-formats', async (req, res) => {
  try {
    console.log('🏢 Fetching registration formats for department:', req.params.deptId);

    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });
    if (!settings) {
      return res.status(404).json({ error: 'System settings not found' });
    }

    const orgIndex = settings.organizations.list.findIndex((org: any) => org.id === req.params.orgId);
    if (orgIndex === -1) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const deptIndex = settings.organizations.list[orgIndex].departments.findIndex((dept: any) => dept.id === req.params.deptId);
    if (deptIndex === -1) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const formats = settings.organizations.list[orgIndex].departments[deptIndex].registrationFormats || [];
    console.log('🏢 Found registration formats:', formats.length);

    res.json({ formats });
  } catch (error) {
    console.error('Error fetching registration formats:', error);
    res.status(500).json({ error: 'Failed to fetch registration formats' });
  }
});

/**
 * Add a new registration format to a department in an organization (admin only)
 */
router.post('/organizations/:orgId/departments/:deptId/registration-formats', async (req, res) => {
  try {
    console.log('🏢 Creating new registration format with data:', req.body);
    const { name, formats, updatedBy } = req.body;

    if (!name || !formats) {
      console.log('🏢 Missing required fields:', { name: !!name, formats: !!formats });
      return res.status(400).json({ error: 'Format name and formats are required' });
    }

    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });
    if (!settings) {
      return res.status(404).json({ error: 'System settings not found' });
    }

    const orgIndex = settings.organizations.list.findIndex((org: any) => org.id === req.params.orgId);
    if (orgIndex === -1) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const deptIndex = settings.organizations.list[orgIndex].departments.findIndex((dept: any) => dept.id === req.params.deptId);
    if (deptIndex === -1) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // Check if format name already exists in this department
    const existingFormat = settings.organizations.list[orgIndex].departments[deptIndex].registrationFormats?.find((format: any) => format.name === name);
    if (existingFormat) {
      return res.status(409).json({ error: 'Registration format name already exists in this department' });
    }

    // Add new registration format
    const formatId = `format_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newFormat = {
      id: formatId,
      name,
      formats,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('🏢 Adding new registration format:', newFormat);

    if (!settings.organizations.list[orgIndex].departments[deptIndex].registrationFormats) {
      settings.organizations.list[orgIndex].departments[deptIndex].registrationFormats = [];
    }

    settings.organizations.list[orgIndex].departments[deptIndex].registrationFormats.push(newFormat);
    settings.organizations.list[orgIndex].departments[deptIndex].updatedAt = new Date();
    settings.organizations.list[orgIndex].updatedAt = new Date();
    settings.organizations.lastUpdatedBy = updatedBy;
    settings.organizations.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`➕ New registration format added by user ${updatedBy || 'unknown'}: ${name}`);
    res.status(201).json({
      message: 'Registration format added successfully',
      format: newFormat
    });
  } catch (error) {
    console.error('Error adding registration format:', error);
    res.status(500).json({ error: 'Failed to add registration format' });
  }
});

/**
 * Update a registration format in a department in an organization (admin only)
 */
router.put('/organizations/:orgId/departments/:deptId/registration-formats/:formatId', async (req, res) => {
  try {
    console.log('🏢 Updating registration format with data:', req.body);
    const { name, formats, updatedBy } = req.body;

    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });
    if (!settings) {
      return res.status(404).json({ error: 'System settings not found' });
    }

    const orgIndex = settings.organizations.list.findIndex((org: any) => org.id === req.params.orgId);
    if (orgIndex === -1) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const deptIndex = settings.organizations.list[orgIndex].departments.findIndex((dept: any) => dept.id === req.params.deptId);
    if (deptIndex === -1) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const formatIndex = settings.organizations.list[orgIndex].departments[deptIndex].registrationFormats?.findIndex((format: any) => format.id === req.params.formatId);
    if (formatIndex === -1 || formatIndex === undefined) {
      return res.status(404).json({ error: 'Registration format not found' });
    }

    // Check if format name already exists in this department (excluding current format)
    if (name && name !== settings.organizations.list[orgIndex].departments[deptIndex].registrationFormats[formatIndex].name) {
      const existingFormat = settings.organizations.list[orgIndex].departments[deptIndex].registrationFormats.find((format: any) => format.name === name && format.id !== req.params.formatId);
      if (existingFormat) {
        return res.status(409).json({ error: 'Registration format name already exists in this department' });
      }
    }

    // Update registration format
    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (formats !== undefined) updateData.formats = formats;

    Object.assign(settings.organizations.list[orgIndex].departments[deptIndex].registrationFormats[formatIndex], updateData);

    settings.organizations.list[orgIndex].departments[deptIndex].updatedAt = new Date();
    settings.organizations.list[orgIndex].updatedAt = new Date();
    settings.organizations.lastUpdatedBy = updatedBy;
    settings.organizations.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`✏️ Registration format updated by user ${updatedBy || 'unknown'}: ${req.params.formatId}`);
    res.json({ message: 'Registration format updated successfully' });
  } catch (error) {
    console.error('Error updating registration format:', error);
    res.status(500).json({ error: 'Failed to update registration format' });
  }
});

/**
 * Delete a registration format from a department in an organization (admin only)
 */
router.delete('/organizations/:orgId/departments/:deptId/registration-formats/:formatId', async (req, res) => {
  try {
    console.log('🏢 Deleting registration format:', req.params.formatId);

    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });
    if (!settings) {
      return res.status(404).json({ error: 'System settings not found' });
    }

    const orgIndex = settings.organizations.list.findIndex((org: any) => org.id === req.params.orgId);
    if (orgIndex === -1) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const deptIndex = settings.organizations.list[orgIndex].departments.findIndex((dept: any) => dept.id === req.params.deptId);
    if (deptIndex === -1) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const formatIndex = settings.organizations.list[orgIndex].departments[deptIndex].registrationFormats?.findIndex((format: any) => format.id === req.params.formatId);
    if (formatIndex === -1 || formatIndex === undefined) {
      return res.status(404).json({ error: 'Registration format not found' });
    }

    // Remove registration format
    const deletedFormat = settings.organizations.list[orgIndex].departments[deptIndex].registrationFormats.splice(formatIndex, 1)[0];

    settings.organizations.list[orgIndex].departments[deptIndex].updatedAt = new Date();
    settings.organizations.list[orgIndex].updatedAt = new Date();
    settings.organizations.lastUpdatedBy = req.body.updatedBy;
    settings.organizations.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`🗑️ Registration format deleted by user ${req.body.updatedBy || 'unknown'}: ${deletedFormat.name}`);
    res.json({ message: 'Registration format deleted successfully' });
  } catch (error) {
    console.error('Error deleting registration format:', error);
    res.status(500).json({ error: 'Failed to delete registration format' });
  }
});

/**
 * Get registration formats by institution type, institution ID, department code, and role (NO YEAR FILTERING)
 * This endpoint is used by the ProfileSetupScreen for NON-STUDENT roles (employee, staff, contractor, guest, visitor)
 * These roles don't need year-specific formats
 */
router.get('/registration-formats/no-year', async (req, res) => {
  try {
    const { institutionType, institutionId, departmentCode, role } = req.query;

    console.log(`📋 Registration formats (no year) API called with:`, {
      institutionType,
      institutionId,
      departmentCode,
      role,
      fullUrl: req.url
    });

    if (!institutionType || !institutionId || !departmentCode || !role) {
      console.log(`❌ Missing required parameters:`, { institutionType, institutionId, departmentCode, role });
      return res.status(400).json({ error: 'All parameters are required: institutionType, institutionId, departmentCode, role' });
    }

    // Only allow non-student roles for this endpoint
    if (role === UserRole.STUDENT) {
      return res.status(400).json({ error: 'This endpoint is for non-student roles only. Use /registration-formats for student roles.' });
    }

    console.log(`📋 Will filter for role: ${role} (no year filtering)`);

    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings) {
      return res.status(404).json({ error: 'System settings not found' });
    }

    let formats = [];

    if (institutionType === 'college') {
      const college = settings.colleges?.list?.find((col: any) => col.id === institutionId);
      if (!college) {
        return res.status(404).json({ error: 'College not found' });
      }

      const department = college.departments.find((dept: any) => dept.code === departmentCode);
      if (!department) {
        return res.status(404).json({ error: 'Department not found in this college' });
      }

      // Use MongoDB query to filter at database level (no year filtering)
      console.log(`📋 Querying college formats with MongoDB filter: role=${role} (no year filtering)`);

      const filteredFormats = await SystemSettingsModel.aggregate([
        { $match: { _id: settings._id } },
        { $unwind: "$colleges.list" },
        { $match: { "colleges.list.id": institutionId } },
        { $unwind: "$colleges.list.departments" },
        { $match: { "colleges.list.departments.code": departmentCode } },
        { $unwind: "$colleges.list.departments.registrationFormats" },
        {
          $match: {
            [`colleges.list.departments.registrationFormats.formats.${role}.structure`]: { $exists: true, $ne: [] }
          }
        },
        {
          $project: {
            _id: "$colleges.list.departments.registrationFormats._id",
            id: "$colleges.list.departments.registrationFormats.id",
            name: "$colleges.list.departments.registrationFormats.name",
            year: "$colleges.list.departments.registrationFormats.year",
            formats: {
              [role]: `$colleges.list.departments.registrationFormats.formats.${role}`
            },
            createdAt: "$colleges.list.departments.registrationFormats.createdAt",
            updatedAt: "$colleges.list.departments.registrationFormats.updatedAt"
          }
        }
      ]);

      console.log(`📋 MongoDB query returned ${filteredFormats.length} matching formats`);
      formats = filteredFormats;

    } else if (institutionType === 'organization') {
      const organization = settings.organizations?.list?.find((org: any) => org.id === institutionId);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const department = organization.departments.find((dept: any) => dept.code === departmentCode);
      if (!department) {
        return res.status(404).json({ error: 'Department not found in this organization' });
      }

      // Use MongoDB query to filter at database level (no year filtering)
      console.log(`📋 Querying organization formats with MongoDB filter: role=${role} (no year filtering)`);

      const filteredFormats = await SystemSettingsModel.aggregate([
        { $match: { _id: settings._id } },
        { $unwind: "$organizations.list" },
        { $match: { "organizations.list.id": institutionId } },
        { $unwind: "$organizations.list.departments" },
        { $match: { "organizations.list.departments.code": departmentCode } },
        { $unwind: "$organizations.list.departments.registrationFormats" },
        {
          $match: {
            [`organizations.list.departments.registrationFormats.formats.${role}.structure`]: { $exists: true, $ne: [] }
          }
        },
        {
          $project: {
            _id: "$organizations.list.departments.registrationFormats._id",
            id: "$organizations.list.departments.registrationFormats.id",
            name: "$organizations.list.departments.registrationFormats.name",
            year: "$organizations.list.departments.registrationFormats.year",
            formats: {
              [role]: `$organizations.list.departments.registrationFormats.formats.${role}`
            },
            createdAt: "$organizations.list.departments.registrationFormats.createdAt",
            updatedAt: "$organizations.list.departments.registrationFormats.updatedAt"
          }
        }
      ]);

      console.log(`📋 MongoDB query returned ${filteredFormats.length} matching formats`);
      formats = filteredFormats;
    } else {
      return res.status(400).json({ error: 'Invalid institution type. Must be "college" or "organization"' });
    }

    console.log(`📋 Database-level filtering complete: ${formats.length} matching formats found`);

    const responseData = {
      success: true,
      formats: formats,
      institutionType,
      institutionId,
      departmentCode,
      role,
      totalFormatsFound: formats.length,
      filteredFormatsCount: formats.length,
      filteringCriteria: {
        description: `Formats for ${role} role (no year filtering)`,
        role: role
      }
    };

    console.log(`📋 ===== COMPLETE API RESPONSE BEING SENT =====`);
    console.log(`📋 Response Success: ${responseData.success}`);
    console.log(`📋 Institution Type: ${responseData.institutionType}`);
    console.log(`📋 Institution ID: ${responseData.institutionId}`);
    console.log(`📋 Department Code: ${responseData.departmentCode}`);
    console.log(`📋 Role: ${responseData.role}`);
    console.log(`📋 Total Formats Found: ${responseData.totalFormatsFound}`);
    console.log(`📋 Filtered Formats Count: ${responseData.filteredFormatsCount}`);
    console.log(`📋 Filtering Criteria:`, responseData.filteringCriteria);
    console.log(`📋 Complete API Response Object:`, responseData);

    res.json(responseData);
  } catch (error) {
    console.error('Error fetching registration formats (no year):', error);
    res.status(500).json({ error: 'Failed to fetch registration formats' });
  }
});

/**
 * ========================================
 * ORGANIZATION QR CODE MANAGEMENT ENDPOINTS
 * ========================================
 */

/**
 * Get all QR codes for an organization
 */
router.get('/organizations/:organizationId/qr-codes', async (req, res) => {
  try {
    const { organizationId } = req.params;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    const { OrganizationQRCode } = await import('../models/mongodb-models');
    const qrCodes = await OrganizationQRCode.find({ organizationId, isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ qrCodes });
  } catch (error) {
    console.error('Error fetching QR codes:', error);
    res.status(500).json({ error: 'Failed to fetch QR codes' });
  }
});

/**
 * Create a new QR code for an organization
 */
router.post('/organizations/:organizationId/qr-codes', async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { address, fullAddress } = req.body;

    // Support both legacy (address string) and new (fullAddress object) formats
    if (!organizationId || (!address && !fullAddress)) {
      return res.status(400).json({ error: 'Organization ID and address are required' });
    }

    // Verify organization exists
    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });
    if (!settings || !settings.organizations?.list) {
      return res.status(404).json({ error: 'No organizations found' });
    }

    const organization = settings.organizations.list.find((org: any) => org.id === organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const { OrganizationQRCode } = await import('../models/mongodb-models');
    const { generateOrganizationQRCodeUrl } = await import('@shared/qrCodeUtils');

    // Use address string for QR URL (backward compatibility)
    // If fullAddress is provided, use addressLine1 as the address string, otherwise use provided address
    const addressString = fullAddress?.addressLine1 || address;

    // Generate QR code
    const baseUrl = process.env.BASE_URL || req.protocol + '://' + req.get('host');
    const qrCodeUrl = generateOrganizationQRCodeUrl(baseUrl, organizationId, addressString);
    const hash = qrCodeUrl.split('/').pop() || '';

    // Create unique QR ID
    const qrId = `qr_${organizationId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const qrCode = new OrganizationQRCode({
      qrId,
      organizationId,
      address: addressString, // Keep for backward compatibility and QR URL
      fullAddress: fullAddress || undefined, // Store full address object if provided
      qrCodeUrl,
      hash,
      isActive: true
    });

    await qrCode.save();

    res.json({
      success: true,
      qrCode: {
        qrId: qrCode.qrId,
        organizationId: qrCode.organizationId,
        address: qrCode.address,
        fullAddress: qrCode.fullAddress,
        qrCodeUrl: qrCode.qrCodeUrl,
        createdAt: qrCode.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating QR code:', error);
    res.status(500).json({ error: 'Failed to create QR code' });
  }
});

/**
 * Delete a QR code
 */
router.delete('/organizations/:organizationId/qr-codes/:qrId', async (req, res) => {
  try {
    const { organizationId, qrId } = req.params;

    if (!organizationId || !qrId) {
      return res.status(400).json({ error: 'Organization ID and QR ID are required' });
    }

    const { OrganizationQRCode } = await import('../models/mongodb-models');
    const qrCode = await OrganizationQRCode.findOne({ qrId, organizationId });

    if (!qrCode) {
      return res.status(404).json({ error: 'QR code not found' });
    }

    // Soft delete by setting isActive to false
    qrCode.isActive = false;
    await qrCode.save();

    res.json({ success: true, message: 'QR code deleted successfully' });
  } catch (error) {
    console.error('Error deleting QR code:', error);
    res.status(500).json({ error: 'Failed to delete QR code' });
  }
});

/**
 * Validate and get QR code details (for scanning)
 */
router.get('/qr-codes/validate/:organizationId/:hash', async (req, res) => {
  try {
    const { organizationId, hash } = req.params;
    const address = req.query.address as string;

    if (!organizationId || !hash || !address) {
      return res.status(400).json({ error: 'Organization ID, hash, and address are required' });
    }

    const { OrganizationQRCode } = await import('../models/mongodb-models');
    const { validateOrganizationQRCodeHash } = await import('@shared/qrCodeUtils');

    // Validate hash
    const validation = validateOrganizationQRCodeHash(organizationId, decodeURIComponent(address), hash);
    if (!validation.isValid) {
      return res.status(400).json({ error: 'Invalid QR code' });
    }

    // Find QR code in database
    const qrCode = await OrganizationQRCode.findOne({
      organizationId,
      hash,
      address: decodeURIComponent(address),
      isActive: true
    });

    if (!qrCode) {
      return res.status(404).json({ error: 'QR code not found or inactive' });
    }

    // Get organization details
    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });
    if (!settings || !settings.organizations?.list) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const organization = settings.organizations.list.find((org: any) => org.id === organizationId);
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        code: organization.code
      },
      address: qrCode.address, // Legacy: simple address string
      fullAddress: qrCode.fullAddress // Full address object for user address creation
    });
  } catch (error) {
    console.error('Error validating QR code:', error);
    res.status(500).json({ error: 'Failed to validate QR code' });
  }
});

/**
 * Get all canteens (public or protected based on usage)
 */
router.get('/canteens', async (req, res) => {
  try {
    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });
    const canteens = settings?.canteens?.list || [];
    res.json({ canteens });
  } catch (error) {
    console.error('Error fetching canteens:', error);
    res.status(500).json({ error: 'Failed to fetch canteens' });
  }
});

/**
 * Get canteens by college ID
 */
router.get('/canteens/by-college/:collegeId', async (req, res) => {
  try {
    const { collegeId } = req.params;
    console.log(`📋 GET /api/system-settings/canteens/by-college/${collegeId}`);

    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });
    const allCanteens = settings?.canteens?.list || [];

    // Filter canteens associated with this college
    const collegeCanteens = allCanteens.filter(canteen =>
      (canteen.collegeIds && canteen.collegeIds.includes(collegeId)) ||
      canteen.collegeId === collegeId
    );

    console.log(`✅ Found ${collegeCanteens.length} canteens for college ${collegeId}`);
    res.json({ canteens: collegeCanteens });
  } catch (error) {
    console.error(`❌ Error fetching canteens for college ${req.params.collegeId}:`, error);
    res.status(500).json({ error: 'Failed to fetch canteens by college' });
  }
});

/**
 * Get specific canteen by ID
 */
router.get('/canteens/:canteenId', async (req, res) => {
  try {
    const { canteenId } = req.params;

    const settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.canteens?.list) {
      return res.status(404).json({ error: 'No canteens found' });
    }

    const canteen = settings.canteens.list.find((c: any) => c.id === canteenId);

    if (!canteen) {
      return res.status(404).json({ error: 'Canteen not found' });
    }

    res.json(canteen);
  } catch (error) {
    console.error('Error fetching canteen:', error);
    res.status(500).json({ error: 'Failed to fetch canteen' });
  }
});

/**
 * Upload canteen profile picture
 * Expects 'image' file in request
 */
router.post('/canteens/:canteenId/profile-image', upload.single('image'), async (req, res) => {
  try {
    const { canteenId } = req.params;
    const { updatedBy } = req.body;

    if (!canteenId) {
      return res.status(400).json({ error: 'Canteen ID is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    // Upload to Cloudinary
    const result = await cloudinaryService.uploadImage(
      req.file.buffer,
      'canteen-profiles',
      `canteen-${canteenId}-profile`
    );

    // Update System Settings
    let settings = await SystemSettingsModel.findOne().sort({ createdAt: -1 });

    if (!settings || !settings.canteens?.list) {
      return res.status(404).json({ error: 'No canteens found' });
    }

    const canteenIndex = settings.canteens.list.findIndex((c: any) => c.id === canteenId);
    if (canteenIndex === -1) {
      // If image uploaded successfully but canteen not found, try to delete the image
      await cloudinaryService.deleteImage(result.public_id);
      return res.status(404).json({ error: 'Canteen not found' });
    }

    // Update canteen with image details
    settings.canteens.list[canteenIndex].imageUrl = result.secure_url;
    settings.canteens.list[canteenIndex].imagePublicId = result.public_id;
    settings.canteens.list[canteenIndex].updatedAt = new Date();

    settings.canteens.lastUpdatedBy = updatedBy;
    settings.canteens.lastUpdatedAt = new Date();
    settings.updatedAt = new Date();

    await settings.save();

    console.log(`📸 Canteen profile picture updated for ${canteenId}: ${result.secure_url}`);

    res.json({
      success: true,
      imageUrl: result.secure_url,
      imagePublicId: result.public_id,
      canteen: settings.canteens.list[canteenIndex]
    });
  } catch (error) {
    console.error('Error uploading canteen profile picture:', error);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

export default router;