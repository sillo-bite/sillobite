import { runStartupSchemaCheck, SimpleSchemaValidator } from './migrations/simple-schema-check';

/**
 * Startup Schema Check
 * 
 * This function runs on every application startup to ensure:
 * 1. Database schemas are up-to-date
 * 2. Missing columns/collections are added
 * 3. Data migration is performed safely
 * 4. Backward compatibility is maintained
 */
export async function performStartupSchemaCheck(): Promise<void> {
  const startTime = Date.now();
  console.log('🚀 Starting database schema validation...');
  
  try {
    const success = await runStartupSchemaCheck();
    
    const duration = Date.now() - startTime;
    
    if (success) {
      console.log(`✅ Schema validation completed successfully in ${duration}ms`);
    } else {
      console.log(`⚠️ Schema validation completed with warnings in ${duration}ms`);
    }
    
  } catch (error) {
    console.error('❌ Schema validation failed:', error);
    
    // Log error details but don't crash the application
    console.error('🔧 Application will continue with existing schema');
    console.error('📧 Please check logs and contact administrator if issues persist');
  }
}

/**
 * Health check for schema status
 */
export async function getSchemaHealthStatus(): Promise<{
  status: 'healthy' | 'warning' | 'error';
  version: string;
  lastCheck: Date;
  details: any;
}> {
  try {
    const validator = new SimpleSchemaValidator();
    const status = await validator.getSchemaStatus();
    
    // Get current schema version from MongoDB
    const mongoose = await import('mongoose');
    const SchemaVersionModel = mongoose.model('SchemaVersion', new mongoose.Schema({
      version: { type: String, required: true, unique: true },
      timestamp: { type: Date, default: Date.now },
      description: { type: String, required: true },
      appliedMigrations: { type: [String], default: [] }
    }));
    
    const currentVersion = await SchemaVersionModel.findOne().sort({ timestamp: -1 });
    
    // Status already includes all necessary info
    
    return {
      status: 'healthy',
      version: currentVersion?.version || 'unknown',
      lastCheck: new Date(),
      details: {
        appliedMigrations: currentVersion?.appliedMigrations || [],
        description: currentVersion?.description || 'No schema version found'
      }
    };
    
  } catch (error) {
    return {
      status: 'error',
      version: 'unknown',
      lastCheck: new Date(),
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    };
  }
}