import mongoose from 'mongoose';
import { getDatabaseConfig, getEnvironmentType, validateDatabaseConfig } from './config/database';

let isConnected = false;
let isConnecting = false;
let connectionPromise: Promise<void> | null = null;
let connectionType: 'local' | 'atlas' | 'custom' = 'local';

export async function connectToMongoDB() {
  // If already connected, return immediately
  if (isConnected) {
    return;
  }

  // If already connecting, wait for the existing connection attempt
  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }

  // Mark as connecting and create a connection promise
  isConnecting = true;
  connectionPromise = (async () => {
    try {
      // Validate configuration first
      validateDatabaseConfig();
      
      const config = getDatabaseConfig();
      connectionType = getEnvironmentType();

      console.log(`🔌 Attempting to connect to ${connectionType} MongoDB...`);
    
    // For local development, use shorter timeout
    const options = connectionType === 'local' 
      ? { ...config.mongodb.options, serverSelectionTimeoutMS: 2000 }
      : config.mongodb.options;

      await mongoose.connect(config.mongodb.uri, options);
      isConnected = true;
      isConnecting = false;
      
      // Log success with environment info
      switch (connectionType) {
        case 'local':
          console.log('✅ Connected to local MongoDB development database');
          console.log(`📍 Database: ${config.mongodb.uri}`);
          break;
        case 'atlas':
          console.log('✅ Connected to MongoDB Atlas cloud database');
          console.log('🌐 Environment: Production/Cloud');
          break;
        case 'custom':
          console.log('✅ Connected to custom MongoDB instance');
          console.log(`📍 Database: ${config.mongodb.uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`); // Hide credentials
          break;
      }

      // Log MongoDB version for debugging
      if (mongoose.connection.db) {
        const admin = mongoose.connection.db.admin();
        try {
          const buildInfo = await admin.buildInfo();
          console.log(`📊 MongoDB version: ${buildInfo.version}`);
          
          // Warn if version is below 3.6
          const version = buildInfo.version.split('.');
          const major = parseInt(version[0]);
          const minor = parseInt(version[1]);
          if (major < 3 || (major === 3 && minor < 6)) {
            console.warn('⚠️  Warning: MongoDB version is below 3.6. Some features may not work correctly.');
          }
        } catch (err) {
          console.log('ℹ️  Could not retrieve MongoDB version info');
        }
      }

    } catch (error) {
      isConnecting = false;
      connectionPromise = null;
      console.error(`❌ MongoDB ${connectionType} connection failed:`, error);
      
      // Provide specific troubleshooting based on connection type
      switch (connectionType) {
        case 'local':
          console.error('💡 Local MongoDB troubleshooting:');
          console.error('   1. Ensure MongoDB is installed and running locally');
          console.error('   2. Check if MongoDB service is started: sudo systemctl start mongod (Linux) or brew services start mongodb/brew/mongodb-community (macOS)');
          console.error('   3. Verify MongoDB is listening on port 27017');
          console.error('   4. Set MONGODB_URI environment variable for custom local connection');
          break;
        case 'atlas':
          console.error('💡 MongoDB Atlas troubleshooting:');
          console.error('   1. Check your Atlas connection string in MONGODB_URI or MONGODB_ATLAS_URI');
          console.error('   2. Verify IP whitelist includes 0.0.0.0/0 for development');
          console.error('   3. Ensure database user has proper permissions');
          console.error('   4. Check if your Atlas cluster is active');
          break;
        case 'custom':
          console.error('💡 Custom MongoDB troubleshooting:');
          console.error('   1. Verify the MONGODB_URI connection string format');
          console.error('   2. Check network connectivity to the MongoDB server');
          console.error('   3. Ensure authentication credentials are correct');
          console.error('   4. Verify the database server is running and accessible');
          break;
      }
      
      throw error;
    }
  })();

  return connectionPromise;
}

export function getConnectionInfo() {
  return {
    isConnected,
    connectionType,
    mongooseReadyState: mongoose.connection.readyState,
    databaseName: mongoose.connection.name || 'Unknown'
  };
}

export function isMongoConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

// Graceful shutdown handling
export async function disconnectFromMongoDB() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('🔌 MongoDB connection closed');
  }
}

export { mongoose };