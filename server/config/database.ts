import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { ConnectOptions } from 'mongoose';

export interface DatabaseConfig {
  mongodb: {
    uri: string;
    options: ConnectOptions;
  };
  postgresql: {
    url: string;
  };
}

export function getDatabaseConfig(): DatabaseConfig {
  // MongoDB Configuration
  let mongoUri: string;
  
  // Environment detection logic
  if (process.env.NODE_ENV === 'production') {
    // Production environment - require MONGODB_URI
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI must be set in production environment');
    }
    mongoUri = process.env.MONGODB_URI;
  } else {
    // Development environment - flexible configuration
    mongoUri = process.env.MONGODB_URI || 
               process.env.MONGODB_ATLAS_URI || 
               process.env.MONGODB_LOCAL_URI || 
               'mongodb://localhost:27017/kit-canteen-dev';
  }

  // PostgreSQL Configuration
  let postgresUrl: string;
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL must be set in production environment');
    }
    // Default local PostgreSQL for development
    const localPassword = process.env.POSTGRES_LOCAL_PASSWORD || 'password';
    postgresUrl = `postgresql://postgres:${localPassword}@localhost:5432/kit_canteen_dev`;
  } else {
    postgresUrl = process.env.DATABASE_URL;
  }

  // MongoDB 4.4+ compatible options with fallback for older versions
  // SCALABILITY FIX: Increased pool size to handle 1000+ concurrent users
  const mongoOptions: ConnectOptions = {
    maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '200'), // Increased from 10 to 200 for high concurrency
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4, // Use IPv4
    
    // MongoDB 4.4+ optimizations
    maxIdleTimeMS: 30000,
    minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '50'), // Increased from 2 to 50 for better connection management
    heartbeatFrequencyMS: 10000,
    
    // Connection management
    connectTimeoutMS: 10000,
    
    // Authentication and security
    authSource: 'admin', // Default auth source
    
    // Read/Write concern settings for MongoDB 4.4+
    readConcern: { level: 'majority' },
    writeConcern: { w: 'majority', j: true, wtimeout: 5000 }
  };

  // Add additional options for Atlas connections
  if (mongoUri.includes('mongodb+srv') || mongoUri.includes('mongodb.net')) {
    mongoOptions.retryWrites = true;
    mongoOptions.w = 'majority';
    
    // Atlas-specific optimizations for MongoDB 4.4+
    mongoOptions.compressors = ['snappy', 'zlib'];
    mongoOptions.zlibCompressionLevel = 6;
  }
  
  // Local development optimizations
  if (mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1')) {
    // Disable some features for local development
    mongoOptions.readConcern = undefined;
    mongoOptions.writeConcern = { w: 1 }; // Simpler write concern for local dev
    mongoOptions.heartbeatFrequencyMS = 5000; // More frequent heartbeat for local
  }

  return {
    mongodb: {
      uri: mongoUri,
      options: mongoOptions
    },
    postgresql: {
      url: postgresUrl
    }
  };
}

export function getEnvironmentType(): 'local' | 'atlas' | 'custom' {
  const mongoUri = getDatabaseConfig().mongodb.uri;
  
  if (mongoUri.includes('mongodb.net') || mongoUri.includes('mongodb+srv')) {
    return 'atlas';
  }
  
  if (mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1')) {
    return 'local';
  }
  
  return 'custom';
}

/**
 * Detects MongoDB version and adjusts configuration accordingly
 */
export async function detectAndOptimizeMongoConfig(): Promise<ConnectOptions> {
  const baseConfig = getDatabaseConfig();
  
  // Try to connect briefly to detect version
  try {
    const mongoose = await import('mongoose');
    
    if (mongoose.connection.readyState === 1) {
      // Already connected, check version
      const admin = mongoose.connection.db?.admin();
      if (admin) {
        const buildInfo = await admin.buildInfo();
        const version = buildInfo.version;
        const [major, minor] = version.split('.').map(Number);
        
        console.log(`🔍 Detected MongoDB version: ${version}`);
        
        // Adjust options based on version
        const optimizedOptions = { ...baseConfig.mongodb.options };
        
        if (major < 4 || (major === 4 && minor < 4)) {
          // MongoDB < 4.4: Use legacy settings
          console.log('📊 Using MongoDB legacy configuration (pre-4.4)');
          delete optimizedOptions.readConcern;
          delete optimizedOptions.writeConcern;
          delete optimizedOptions.compressors;
          delete optimizedOptions.zlibCompressionLevel;
          optimizedOptions.serverSelectionTimeoutMS = 2000;
        } else if (major === 4 && minor === 4) {
          // MongoDB 4.4: Balanced settings
          console.log('📊 Using MongoDB 4.4 optimized configuration');
          optimizedOptions.readConcern = { level: 'local' }; // Less strict for 4.4
          optimizedOptions.writeConcern = { w: 1, j: true };
        } else {
          // MongoDB 5.0+: Full feature set
          console.log('📊 Using MongoDB 5.0+ advanced configuration');
        }
        
        return optimizedOptions;
      }
    }
  } catch (error) {
    console.log('⚠️ Could not detect MongoDB version, using default configuration');
  }
  
  return baseConfig.mongodb.options;
}

export function validateDatabaseConfig(): void {
  const config = getDatabaseConfig();
  
  // Validate MongoDB URI format
  if (!config.mongodb.uri.startsWith('mongodb://') && !config.mongodb.uri.startsWith('mongodb+srv://')) {
    throw new Error('Invalid MongoDB URI format. Must start with mongodb:// or mongodb+srv://');
  }
  
  // Validate PostgreSQL URI format
  if (!config.postgresql.url.startsWith('postgresql://') && !config.postgresql.url.startsWith('postgres://')) {
    throw new Error('Invalid PostgreSQL URI format. Must start with postgresql:// or postgres://');
  }
}

/**
 * Get MongoDB version-specific features availability
 */
export async function getMongoFeatures(): Promise<{
  transactions: boolean;
  changeStreams: boolean;
  textSearch: boolean;
  aggregationPipeline: boolean;
  gridFS: boolean;
  version: string;
}> {
  try {
    // Import mongoose globally to ensure we're using the same instance
    const mongoose = (await import('mongoose')).default;
    const { isMongoConnected } = await import('../mongodb');
    
    // Use the centralized connection check
    if (!isMongoConnected()) {
      throw new Error('MongoDB not connected');
    }
    
    // Wait for the db property to be available with more retries
    let retries = 0;
    while (!mongoose.connection?.db && retries < 20) {
      await new Promise(resolve => setTimeout(resolve, 200));
      retries++;
    }
    
    if (!mongoose.connection?.db) {
      throw new Error('MongoDB db property not available after waiting');
    }
    
    const admin = mongoose.connection.db.admin();
    if (!admin) {
      throw new Error('Cannot access MongoDB admin');
    }
    
    const buildInfo = await admin.buildInfo();
    const version = buildInfo.version;
    const [major, minor] = version.split('.').map(Number);
    
    return {
      transactions: major >= 4,
      changeStreams: major >= 3 && minor >= 6,
      textSearch: major >= 2 && minor >= 6,
      aggregationPipeline: major >= 2 && minor >= 2,
      gridFS: true, // Available in all supported versions
      version
    };
  } catch (error) {
    console.warn('Could not detect MongoDB features:', error instanceof Error ? error.message : String(error));
    throw new Error(`Cannot detect real-time MongoDB features: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if MongoDB instance supports specific feature
 */
export async function supportsFeature(feature: 'transactions' | 'changeStreams' | 'textSearch' | 'aggregation' | 'gridFS'): Promise<boolean> {
  const features = await getMongoFeatures();
  
  switch (feature) {
    case 'transactions':
      return features.transactions;
    case 'changeStreams':
      return features.changeStreams;
    case 'textSearch':
      return features.textSearch;
    case 'aggregation':
      return features.aggregationPipeline;
    case 'gridFS':
      return features.gridFS;
    default:
      return false;
  }
}