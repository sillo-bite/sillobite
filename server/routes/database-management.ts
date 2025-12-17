import express from 'express';
import { storage } from '../storage-hybrid';
import { getHealthStatus } from '../health-check';
import { getSchemaHealthStatus } from '../startup-schema-check';
import { databaseMonitor } from '../monitoring/database-monitor';

const router = express.Router();

/**
 * Get comprehensive database statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await storage.getDatabaseStats();
    const healthStatus = await getHealthStatus();
    const schemaStatus = await getSchemaHealthStatus();
    
    res.json({
      ...stats,
      health: healthStatus,
      schema: schemaStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting database stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch database statistics',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get MongoDB-specific statistics
 */
router.get('/stats/mongodb', async (req, res) => {
  try {
    const mongoStats = await storage.getMongoDBStats();
    res.json(mongoStats);
  } catch (error) {
    console.error('Error getting MongoDB stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch MongoDB statistics',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get PostgreSQL-specific statistics
 */
router.get('/stats/postgresql', async (req, res) => {
  try {
    const pgStats = await storage.getPostgreSQLStats();
    res.json(pgStats);
  } catch (error) {
    console.error('Error getting PostgreSQL stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch PostgreSQL statistics',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Run database maintenance operations
 */
router.post('/maintenance', async (req, res) => {
  try {
    const { operations } = req.body;
    
    if (!Array.isArray(operations) || operations.length === 0) {
      return res.status(400).json({ 
        error: 'Operations array is required',
        validOperations: ['analyze_postgres', 'vacuum_postgres', 'compact_mongo', 'rebuild_indexes']
      });
    }
    
    const validOperations = ['analyze_postgres', 'vacuum_postgres', 'compact_mongo', 'rebuild_indexes'];
    const invalidOperations = operations.filter(op => !validOperations.includes(op));
    
    if (invalidOperations.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid operations',
        invalidOperations,
        validOperations
      });
    }
    
    const results = await storage.runDatabaseMaintenance(operations);
    
    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error running maintenance operations:', error);
    res.status(500).json({ 
      error: 'Failed to run maintenance operations',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Create database backup
 */
router.post('/backup', async (req, res) => {
  try {
    const { type = 'full' } = req.body;
    
    if (!['mongodb', 'postgresql', 'full'].includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid backup type',
        validTypes: ['mongodb', 'postgresql', 'full']
      });
    }
    
    const backup = await storage.createBackup(type);
    
    // If it's a PostgreSQL backup, return download info
    if (type === 'postgresql' && backup.downloadable) {
      res.json({
        success: true,
        backup: {
          ...backup,
          downloadUrl: `/api/database/backup/${backup.id}/download`
        },
        message: 'PostgreSQL backup created and ready for download'
      });
    } else {
      res.json({
        success: true,
        backup,
        message: `${type} backup created successfully`
      });
    }
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ 
      error: 'Failed to create backup',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get database health status
 */
router.get('/health', async (req, res) => {
  try {
    const health = await getHealthStatus();
    res.json(health);
  } catch (error) {
    console.error('Error getting health status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch health status',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get schema validation status
 */
router.get('/schema', async (req, res) => {
  try {
    const schema = await getSchemaHealthStatus();
    res.json(schema);
  } catch (error) {
    console.error('Error getting schema status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch schema status',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get database connection information
 */
router.get('/connections', async (req, res) => {
  try {
    const mongoose = await import('mongoose');
    const { getConnectionInfo } = await import('../mongodb');
    
    const mongoInfo = getConnectionInfo();
    
    // PostgreSQL connection info (minimal for security)
    const pgInfo = {
      connected: true, // If we reach here, PG is connected
      environment: process.env.NODE_ENV || 'development'
    };
    
    res.json({
      mongodb: {
        connected: mongoInfo.isConnected,
        connectionType: mongoInfo.connectionType,
        readyState: mongoInfo.mongooseReadyState,
        database: mongoInfo.databaseName
      },
      postgresql: pgInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting connection info:', error);
    res.status(500).json({ 
      error: 'Failed to fetch connection information',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get collection/table list with counts
 */
router.get('/collections', async (req, res) => {
  try {
    const mongoStats = await storage.getMongoDBStats();
    const pgStats = await storage.getPostgreSQLStats();
    
    res.json({
      mongodb: {
        collections: mongoStats.collections.map(col => ({
          name: col.name,
          count: col.count,
          size: col.size,
          indexes: col.indexes
        }))
      },
      postgresql: {
        tables: Object.values(pgStats.tables).map(table => ({
          name: table.name,
          count: table.count,
          columns: table.columns
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting collections info:', error);
    res.status(500).json({ 
      error: 'Failed to fetch collections information',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get comprehensive database monitoring metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    // Try to get only PostgreSQL metrics if MongoDB is having issues
    try {
      const metrics = await databaseMonitor.getMetrics();
      res.json(metrics);
    } catch (mongoError) {
      console.warn('MongoDB metrics failed, trying PostgreSQL only:', mongoError instanceof Error ? mongoError.message : String(mongoError));
      
      // Return PostgreSQL metrics only with MongoDB error info
      const pgMetrics = await databaseMonitor.getPostgreSQLMetrics();
      res.json({
        postgresql: pgMetrics,
        mongodb: {
          connected: false,
          error: 'MongoDB metrics unavailable - using PostgreSQL only'
        },
        overall: {
          totalSize: pgMetrics.databaseSize,
          totalConnections: pgMetrics.connectionCount,
          averageResponseTime: pgMetrics.responseTime,
          healthScore: pgMetrics.connected ? 80 : 20,
          status: pgMetrics.connected ? 'warning' : 'critical',
          alerts: []
        },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error getting database metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch database metrics',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get current database alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    const alerts = databaseMonitor.getAlerts();
    res.json({
      alerts,
      count: alerts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting database alerts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch database alerts',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Resolve a database alert
 */
router.post('/alerts/:index/resolve', async (req, res) => {
  try {
    const alertIndex = parseInt(req.params.index);
    if (isNaN(alertIndex)) {
      return res.status(400).json({ error: 'Invalid alert index' });
    }
    
    databaseMonitor.resolveAlert(alertIndex);
    res.json({ 
      success: true,
      message: 'Alert resolved successfully'
    });
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ 
      error: 'Failed to resolve alert',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get performance trends
 */
router.get('/trends', async (req, res) => {
  try {
    const trends = databaseMonitor.getPerformanceTrends();
    res.json(trends || { message: 'No historical data available' });
  } catch (error) {
    console.error('Error getting performance trends:', error);
    res.status(500).json({ 
      error: 'Failed to fetch performance trends',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get backup list
 */
router.get('/backups', async (req, res) => {
  try {
    const backups = await storage.getBackupList();
    res.json({
      backups,
      count: backups.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting backup list:', error);
    res.status(500).json({ 
      error: 'Failed to fetch backup list',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Restore database from backup
 */
router.post('/restore', async (req, res) => {
  try {
    const { backupId, type } = req.body;
    
    if (!backupId || !type) {
      return res.status(400).json({ error: 'Backup ID and type are required' });
    }
    
    const restoreResult = await storage.restoreFromBackup(backupId, type);
    
    res.json({
      success: true,
      message: `Database restored successfully from backup ${backupId}`,
      restore: restoreResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error restoring from backup:', error);
    res.status(500).json({ 
      error: 'Failed to restore from backup',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Delete backup
 */
router.delete('/backups/:backupId', async (req, res) => {
  try {
    const { backupId } = req.params;
    
    if (!backupId) {
      return res.status(400).json({ error: 'Backup ID is required' });
    }
    
    await storage.deleteBackup(backupId);
    
    res.json({
      success: true,
      message: `Backup ${backupId} deleted successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({ 
      error: 'Failed to delete backup',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Download backup file
 */
router.get('/backup/:backupId/download', async (req, res) => {
  try {
    const { backupId } = req.params;
    
    const backupContent = await storage.getBackupContent(backupId);
    
    res.setHeader('Content-Type', backupContent.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${backupContent.filename}"`);
    res.send(backupContent.content);
  } catch (error) {
    console.error('Error downloading backup:', error);
    res.status(404).json({ 
      error: 'Backup not found or cannot be downloaded',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});


export default router;