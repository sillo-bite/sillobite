import mongoose from 'mongoose';
import { PrismaClient } from '@prisma/client';
import { connectToMongoDB } from '../mongodb';

/**
 * Simple Schema Validation and Auto-Migration System
 * 
 * This system ensures database compatibility across deployments by:
 * 1. Validating existing schemas
 * 2. Adding missing fields with default values
 * 3. Preserving existing data
 * 4. Running safely on every startup
 */

interface MigrationResult {
  success: boolean;
  message: string;
  details?: any;
}

export class SimpleSchemaValidator {
  private prisma: PrismaClient;
  private mongoConnected = false;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async validateAndMigrateAll(): Promise<MigrationResult> {
    // Schema validation started (log is in startup-schema-check.ts to avoid duplicates)
    
    try {
      // Connect to MongoDB
      await connectToMongoDB();
      this.mongoConnected = true;
      
      // 1. Validate PostgreSQL User table
      const pgResult = await this.validatePostgreSQLSchema();
      if (!pgResult.success) {
        console.error('❌ PostgreSQL validation failed:', pgResult.message);
      }
      
      // 2. Ensure MongoDB collections have proper indexes
      const mongoResult = await this.validateMongoDBSchema();
      if (!mongoResult.success) {
        console.error('❌ MongoDB validation failed:', mongoResult.message);
      }
      
      // 3. Add missing fields to existing documents
      await this.addMissingMongoFields();
      
      console.log('✅ Schema validation completed');
      
      return {
        success: true,
        message: 'Schema validation completed successfully',
        details: { postgresql: pgResult, mongodb: mongoResult }
      };
      
    } catch (error) {
      console.error('❌ Schema validation error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { error }
      };
    } finally {
      await this.cleanup();
    }
  }

  private async validatePostgreSQLSchema(): Promise<MigrationResult> {
    try {
      console.log('🔍 Validating PostgreSQL schema...');
      
      // Check if users table exists
      const result = await this.prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'users'
        );
      ` as Array<{ exists: boolean }>;

      if (!result[0]?.exists) {
        console.log('⚠️ Users table missing - will be created by Prisma on first use');
      } else {
        console.log('✅ PostgreSQL users table exists');
      }

      // Try to query the users table if it exists
      if (result[0]?.exists) {
        await this.prisma.user.findMany({ take: 1 });
        return { success: true, message: 'PostgreSQL schema validated' };
      } else {
        console.log('📋 To create the users table, run: npx prisma migrate dev --schema=prisma/postgres/schema.prisma');
        return { success: true, message: 'PostgreSQL schema validation skipped - users table will be created on first migration' };
      }
      
    } catch (error) {
      console.error('⚠️ PostgreSQL validation issue:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'PostgreSQL validation failed'
      };
    }
  }

  private async validateMongoDBSchema(): Promise<MigrationResult> {
    try {
      console.log('🔍 Validating MongoDB schema...');
      
      // Wait for MongoDB connection to be fully ready
      let retries = 0;
      const maxRetries = 10;
      while (mongoose.connection.readyState !== 1 && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500));
        retries++;
      }
      
      if (mongoose.connection.readyState !== 1) {
        throw new Error('MongoDB connection not ready after timeout');
      }
      
      const db = mongoose.connection.db;
      if (!db) {
        throw new Error('MongoDB connection not available');
      }

      // Get all collections
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      const expectedCollections = [
        'categories', 'menuitems', 'orders', 'orderitems', 
        'notifications', 'loginissues', 'quickorders', 'payments', 'complaints'
      ];
      
      for (const expected of expectedCollections) {
        if (!collectionNames.includes(expected)) {
          console.log(`⚠️ Collection '${expected}' will be auto-created by Mongoose`);
        } else {
          console.log(`✅ Collection '${expected}' exists`);
        }
      }
      
      return { success: true, message: 'MongoDB schema validated' };
      
    } catch (error) {
      console.error('⚠️ MongoDB validation issue:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'MongoDB validation failed'
      };
    }
  }

  private async addMissingMongoFields(): Promise<void> {
    try {
      console.log('🔄 Adding missing fields to existing documents...');
      
      // Add isTrending field to MenuItem documents that don't have it
      if (mongoose.models.MenuItem) {
        const menuUpdates = await mongoose.models.MenuItem.updateMany(
          { isTrending: { $exists: false } },
          { $set: { isTrending: false } }
        );
        if (menuUpdates.modifiedCount > 0) {
          console.log(`✅ Added isTrending field to ${menuUpdates.modifiedCount} menu items`);
        }
      }

      // Add updatedAt field to Payment documents that don't have it
      if (mongoose.models.Payment) {
        const paymentUpdates = await mongoose.models.Payment.updateMany(
          { updatedAt: { $exists: false } },
          { $set: { updatedAt: new Date() } }
        );
        if (paymentUpdates.modifiedCount > 0) {
          console.log(`✅ Added updatedAt field to ${paymentUpdates.modifiedCount} payments`);
        }
      }

      // Add barcodeUsed field to Order documents that don't have it
      if (mongoose.models.Order) {
        const orderUpdates = await mongoose.models.Order.updateMany(
          { barcodeUsed: { $exists: false } },
          { $set: { barcodeUsed: false } }
        );
        if (orderUpdates.modifiedCount > 0) {
          console.log(`✅ Added barcodeUsed field to ${orderUpdates.modifiedCount} orders`);
        }
      }

      console.log('✅ Missing field addition completed');
      
    } catch (error) {
      console.error('⚠️ Error adding missing fields:', error);
      // Don't throw - this is non-critical
    }
  }

  private async cleanup(): Promise<void> {
    try {
      await this.prisma.$disconnect();
    } catch (error) {
      console.error('Error disconnecting from PostgreSQL:', error);
    }
  }

  async getSchemaStatus(): Promise<{
    postgresql: { connected: boolean; tablesExist: boolean };
    mongodb: { connected: boolean; collectionsCount: number };
    lastCheck: Date;
  }> {
    try {
      const postgresqlStatus = {
        connected: false,
        tablesExist: false
      };

      const mongodbStatus = {
        connected: false,
        collectionsCount: 0
      };

      // Check PostgreSQL
      try {
        await this.prisma.user.findMany({ take: 1 });
        postgresqlStatus.connected = true;
        postgresqlStatus.tablesExist = true;
      } catch (error) {
        console.error('PostgreSQL check failed:', error);
      }

      // Check MongoDB
      try {
        if (this.mongoConnected || mongoose.connection.readyState === 1) {
          mongodbStatus.connected = true;
          const db = mongoose.connection.db;
          if (db) {
            const collections = await db.listCollections().toArray();
            mongodbStatus.collectionsCount = collections.length;
          }
        }
      } catch (error) {
        console.error('MongoDB check failed:', error);
      }

      return {
        postgresql: postgresqlStatus,
        mongodb: mongodbStatus,
        lastCheck: new Date()
      };
      
    } catch (error) {
      return {
        postgresql: { connected: false, tablesExist: false },
        mongodb: { connected: false, collectionsCount: 0 },
        lastCheck: new Date()
      };
    }
  }
}

/**
 * Main function to run schema validation on startup
 */
export async function runStartupSchemaCheck(): Promise<boolean> {
  const validator = new SimpleSchemaValidator();
  
  try {
    const result = await validator.validateAndMigrateAll();
    
    if (result.success) {
      console.log('✅ Database schema validation completed successfully');
      return true;
    } else {
      console.error('⚠️ Schema validation had issues but application will continue');
      console.error('Details:', result.message);
      return true; // Don't crash the app, just log warnings
    }
    
  } catch (error) {
    console.error('❌ Schema validation failed:', error);
    console.error('🔧 Application will continue with existing schema');
    return true; // Don't crash the app
  }
}