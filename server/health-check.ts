import { Request, Response } from 'express';
import { getConnectionInfo, connectToMongoDB } from './mongodb';
import { db as getPostgresDb } from './db';
import mongoose from 'mongoose';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  services: {
    mongodb: {
      status: 'connected' | 'disconnected' | 'error';
      connectionType: 'local' | 'atlas' | 'custom';
      version?: string;
      database?: string;
      readyState: number;
      details?: string;
    };
    postgresql: {
      status: 'connected' | 'disconnected' | 'error';
      details?: string;
    };
  };
  environment: string;
  uptime: number;
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const startTime = process.hrtime();
  
  // MongoDB health check
  let mongoStatus: HealthStatus['services']['mongodb'] = {
    status: 'disconnected',
    connectionType: 'local',
    readyState: 0
  };

  try {
    await connectToMongoDB();
    const connectionInfo = getConnectionInfo();
    
    mongoStatus = {
      status: connectionInfo.isConnected ? 'connected' : 'disconnected',
      connectionType: connectionInfo.connectionType,
      readyState: connectionInfo.mongooseReadyState,
      database: connectionInfo.databaseName
    };

    // Get MongoDB version if connected
    if (mongoose.connection.db) {
      try {
        const admin = mongoose.connection.db.admin();
        const buildInfo = await admin.buildInfo();
        mongoStatus.version = buildInfo.version;
      } catch (err) {
        mongoStatus.details = 'Could not retrieve version info';
      }
    }
  } catch (error) {
    mongoStatus.status = 'error';
    mongoStatus.details = error instanceof Error ? error.message : 'Unknown error';
  }

  // PostgreSQL health check
  let postgresStatus: HealthStatus['services']['postgresql'] = {
    status: 'disconnected'
  };

  try {
    const db = getPostgresDb();
    await db.$queryRaw`SELECT 1`;
    postgresStatus.status = 'connected';
  } catch (error) {
    postgresStatus.status = 'error';
    postgresStatus.details = error instanceof Error ? error.message : 'Unknown error';
  }

  // Determine overall status
  let overallStatus: HealthStatus['status'] = 'healthy';
  if (mongoStatus.status === 'error' || postgresStatus.status === 'error') {
    overallStatus = 'unhealthy';
  } else if (mongoStatus.status !== 'connected' || postgresStatus.status !== 'connected') {
    overallStatus = 'degraded';
  }

  const endTime = process.hrtime(startTime);
  const uptimeSeconds = process.uptime();

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoStatus,
      postgresql: postgresStatus
    },
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(uptimeSeconds)
  };
}

export async function healthCheckHandler(req: Request, res: Response) {
  try {
    const health = await getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 503 : 500;
    
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.floor(process.uptime())
    });
  }
}

export async function mongoVersionCheck(): Promise<void> {
  try {
    await connectToMongoDB();
    
    if (mongoose.connection.db) {
      const admin = mongoose.connection.db.admin();
      const buildInfo = await admin.buildInfo();
      const version = buildInfo.version;
      
      console.log(`📊 MongoDB version: ${version}`);
      
      // Parse version
      const versionParts = version.split('.');
      const major = parseInt(versionParts[0]);
      const minor = parseInt(versionParts[1]);
      
      // Check compatibility
      if (major < 3 || (major === 3 && minor < 6)) {
        console.warn('⚠️  Warning: MongoDB version is below 3.6. Some features may not work correctly.');
        console.warn('   Recommended: MongoDB 3.6 or higher for full compatibility');
      } else if (major >= 4) {
        console.log('✅ MongoDB version is fully supported and optimized');
      } else {
        console.log('✅ MongoDB 3.6+ detected - all features supported');
      }
      
      // Feature availability check
      if (major >= 4) {
        console.log('📋 Advanced features available: Change Streams, Transactions, etc.');
      } else if (major === 3 && minor >= 6) {
        console.log('📋 Core features available: Aggregation Pipeline, GridFS, etc.');
      }
    }
  } catch (error) {
    console.error('❌ Could not check MongoDB version:', error);
  }
}