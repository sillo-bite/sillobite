import mongoose from 'mongoose';
import { storage } from '../storage-hybrid';
import { getHealthStatus } from '../health-check';
import { getSchemaHealthStatus } from '../startup-schema-check';
import { getMongoFeatures, supportsFeature } from '../config/database';

export interface DatabaseMetrics {
  postgresql: PostgreSQLMetrics;
  mongodb: MongoDBMetrics;
  overall: OverallMetrics;
  timestamp: string;
}

export interface PostgreSQLMetrics {
  connected: boolean;
  responseTime: number;
  connectionCount: number;
  databaseSize: number;
  totalTables: number;
  totalRecords: number;
  activeQueries: number;
  cacheHitRatio?: number;

}

export interface MongoDBMetrics {
  connected: boolean;
  responseTime: number;
  connectionCount: number;
  databaseSize: number;
  collections: number;
  totalDocuments: number;
  indexSize: number;
  currentOp: number;
  replicationLag?: number;
  version: string;
  features: {
    transactions: boolean;
    changeStreams: boolean;
    textSearch: boolean;
    aggregation: boolean;
    gridFS: boolean;
  };

}

export interface OverallMetrics {
  totalSize: number;
  totalConnections: number;
  averageResponseTime: number;
  healthScore: number; // 0-100
  status: 'healthy' | 'warning' | 'critical';
  alerts: Alert[];
}

export interface Alert {
  type: 'info' | 'warning' | 'error';
  source: 'postgresql' | 'mongodb' | 'system';
  message: string;
  timestamp: string;
  resolved: boolean;
}

export class DatabaseMonitor {
  private alerts: Alert[] = [];
  private lastMetrics: DatabaseMetrics | null = null;
  
  /**
   * Get comprehensive database metrics
   */
  async getMetrics(): Promise<DatabaseMetrics> {
    const timestamp = new Date().toISOString();
    
    try {
      const pgMetrics = await this.getPostgreSQLMetrics();
      
      // Try to get MongoDB metrics - if it fails, continue with PostgreSQL only
      let mongoMetrics: MongoDBMetrics;
      try {
        mongoMetrics = await this.getMongoDBMetrics();
      } catch (mongoError) {
        console.warn('MongoDB metrics unavailable - using PostgreSQL metrics only:', mongoError instanceof Error ? mongoError.message : String(mongoError));
        throw new Error(`Real-time MongoDB data unavailable: ${mongoError instanceof Error ? mongoError.message : String(mongoError)}`);
      }
      
      const overallMetrics = this.calculateOverallMetrics(pgMetrics, mongoMetrics);
      
      const metrics: DatabaseMetrics = {
        postgresql: pgMetrics,
        mongodb: mongoMetrics,
        overall: overallMetrics,
        timestamp
      };
      
      // Check for alerts
      this.checkForAlerts(metrics);
      
      this.lastMetrics = metrics;
      return metrics;
    } catch (error) {
      console.error('Error collecting database metrics:', error);
      throw error;
    }
  }
  
  /**
   * Get PostgreSQL metrics
   */
  async getPostgreSQLMetrics(): Promise<PostgreSQLMetrics> {
    const startTime = Date.now();
    
    try {
      const stats = await storage.getPostgreSQLStats();
      const responseTime = Date.now() - startTime;
      
      // Get additional PostgreSQL metrics if possible
      let connectionCount = 1; // At least our connection
      let activeQueries = 0;
      let cacheHitRatio: number | undefined;
      
      try {
        const { db } = await import('../db');
        const pgDb = db();
        
        // Get connection count
        const connectionResult = await pgDb.$queryRaw`
          SELECT count(*) as count 
          FROM pg_stat_activity 
          WHERE datname = current_database()
        ` as Array<{ count: bigint }>;
        
        connectionCount = Number(connectionResult[0]?.count || 1);
        
        // Get active queries
        const activeQueriesResult = await pgDb.$queryRaw`
          SELECT count(*) as count 
          FROM pg_stat_activity 
          WHERE state = 'active' AND datname = current_database()
        ` as Array<{ count: bigint }>;
        
        activeQueries = Number(activeQueriesResult[0]?.count || 0);
        
        // Get cache hit ratio (fixed for PostgreSQL compatibility)
        const cacheResult = await pgDb.$queryRaw`
          SELECT 
            CAST(
              ROUND(
                CAST((blks_hit::float / NULLIF(blks_hit + blks_read, 0)) * 100 AS numeric), 2
              ) AS float
            ) as cache_hit_ratio
          FROM pg_stat_database 
          WHERE datname = current_database()
        ` as Array<{ cache_hit_ratio: number }>;
        
        cacheHitRatio = cacheResult[0]?.cache_hit_ratio;
      } catch (error) {
        console.warn('Could not get extended PostgreSQL metrics:', error instanceof Error ? error.message : String(error));
      }
      
      return {
        connected: true,
        responseTime,
        connectionCount,
        databaseSize: stats.size,
        totalTables: stats.totalTables,
        totalRecords: stats.totalRecords,
        activeQueries,
        cacheHitRatio
      };
    } catch (error) {
      return {
        connected: false,
        responseTime: Date.now() - startTime,
        connectionCount: 0,
        databaseSize: 0,
        totalTables: 0,
        totalRecords: 0,
        activeQueries: 0
      };
    }
  }
  
  /**
   * Get MongoDB metrics
   */
  private async getMongoDBMetrics(): Promise<MongoDBMetrics> {
    const startTime = Date.now();
    
    try {
      // Get real-time MongoDB stats only - no fallbacks to dummy data
      const stats = await storage.getMongoDBStats();
      const features = await getMongoFeatures();
      
      const responseTime = Date.now() - startTime;
      
      // Get additional MongoDB metrics (real-time only)
      let connectionCount = 0;
      let currentOp = 0;
      let replicationLag: number | undefined;
      
      try {
        // Wait for db property to be available
        let retries = 0;
        while (!mongoose.connection.db && retries < 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          retries++;
        }
        
        if (mongoose.connection.db) {
          const admin = mongoose.connection.db.admin();
          
          try {
            // Try to get connection count from server status
            const serverStatus = await admin.serverStatus();
            connectionCount = serverStatus.connections?.current || 0;
            currentOp = serverStatus.opcounters?.query || 0;
            
            // Check replication lag if in replica set
            if (serverStatus.repl) {
              try {
                const replStatus = await admin.replSetGetStatus();
                if (replStatus.members) {
                  const primary = replStatus.members.find((m: any) => m.stateStr === 'PRIMARY');
                  const secondary = replStatus.members.find((m: any) => m.stateStr === 'SECONDARY');
                  
                  if (primary && secondary) {
                    replicationLag = Math.abs(
                      new Date(secondary.optimeDate).getTime() - 
                      new Date(primary.optimeDate).getTime()
                    );
                  }
                }
              } catch (replError) {
                console.warn('Could not get replication status:', replError instanceof Error ? replError.message : String(replError));
              }
            }
          } catch (serverStatusError) {
            // If serverStatus fails due to permissions, use minimal fallback
            console.warn('Could not get extended MongoDB metrics:', serverStatusError instanceof Error ? serverStatusError.message : String(serverStatusError));
            connectionCount = 1; // At least our connection
            currentOp = 0;
          }
        }
      } catch (error) {
        console.warn('Could not access MongoDB admin:', error instanceof Error ? error.message : String(error));
      }
      
      return {
        connected: mongoose.connection && mongoose.connection.readyState === 1,
        responseTime,
        connectionCount,
        databaseSize: stats.dataSize,
        collections: stats.totalCollections,
        totalDocuments: stats.totalDocuments,
        indexSize: stats.indexSize,
        currentOp,
        replicationLag,
        version: features.version,
        features: {
          transactions: features.transactions,
          changeStreams: features.changeStreams,
          textSearch: features.textSearch,
          aggregation: features.aggregationPipeline,
          gridFS: features.gridFS
        }
      };
    } catch (error) {
      // Don't return dummy data - throw error to indicate real-time data unavailable
      throw new Error(`Cannot fetch real-time MongoDB metrics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Calculate overall system metrics
   */
  private calculateOverallMetrics(pgMetrics: PostgreSQLMetrics, mongoMetrics: MongoDBMetrics): OverallMetrics {
    const totalSize = pgMetrics.databaseSize + mongoMetrics.databaseSize;
    const totalConnections = pgMetrics.connectionCount + mongoMetrics.connectionCount;
    const averageResponseTime = (pgMetrics.responseTime + mongoMetrics.responseTime) / 2;
    
    // Calculate health score (0-100)
    let healthScore = 100;
    
    // Deduct points for connection issues
    if (!pgMetrics.connected) healthScore -= 40;
    if (!mongoMetrics.connected) healthScore -= 40;
    
    // Deduct points for high response times
    if (averageResponseTime > 1000) healthScore -= 10;
    if (averageResponseTime > 5000) healthScore -= 20;
    
    // Error handling is now done at the method level through exceptions
    
    // Deduct points for high connection usage (assuming 100 max connections)
    if (totalConnections > 80) healthScore -= 10;
    if (totalConnections > 90) healthScore -= 20;
    
    // Determine status
    let status: 'healthy' | 'warning' | 'critical';
    if (healthScore >= 80) status = 'healthy';
    else if (healthScore >= 60) status = 'warning';
    else status = 'critical';
    
    return {
      totalSize,
      totalConnections,
      averageResponseTime,
      healthScore: Math.max(0, healthScore),
      status,
      alerts: this.alerts.filter(alert => !alert.resolved)
    };
  }
  
  /**
   * Check for alerts based on metrics
   */
  private checkForAlerts(metrics: DatabaseMetrics): void {
    const timestamp = new Date().toISOString();
    
    // Clear old alerts (keep only last 24 hours)
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(alert => 
      new Date(alert.timestamp).getTime() > twentyFourHoursAgo
    );
    
    // Check PostgreSQL alerts
    if (!metrics.postgresql.connected) {
      this.addAlert('error', 'postgresql', 'PostgreSQL database connection lost', timestamp);
    }
    
    if (metrics.postgresql.responseTime > 5000) {
      this.addAlert('warning', 'postgresql', `PostgreSQL response time high: ${metrics.postgresql.responseTime}ms`, timestamp);
    }
    
    if (metrics.postgresql.connectionCount > 90) {
      this.addAlert('warning', 'postgresql', `PostgreSQL connection count high: ${metrics.postgresql.connectionCount}`, timestamp);
    }
    
    // Check MongoDB alerts
    if (!metrics.mongodb.connected) {
      this.addAlert('error', 'mongodb', 'MongoDB database connection lost', timestamp);
    }
    
    if (metrics.mongodb.responseTime > 5000) {
      this.addAlert('warning', 'mongodb', `MongoDB response time high: ${metrics.mongodb.responseTime}ms`, timestamp);
    }
    
    if (metrics.mongodb.replicationLag && metrics.mongodb.replicationLag > 10000) {
      this.addAlert('warning', 'mongodb', `MongoDB replication lag high: ${metrics.mongodb.replicationLag}ms`, timestamp);
    }
    
    // Check overall system alerts
    if (metrics.overall.healthScore < 60) {
      this.addAlert('error', 'system', `System health score critical: ${metrics.overall.healthScore}%`, timestamp);
    } else if (metrics.overall.healthScore < 80) {
      this.addAlert('warning', 'system', `System health score low: ${metrics.overall.healthScore}%`, timestamp);
    }
  }
  
  /**
   * Add a new alert
   */
  private addAlert(type: Alert['type'], source: Alert['source'], message: string, timestamp: string): void {
    // Check if similar alert already exists
    const existingAlert = this.alerts.find(alert => 
      alert.source === source && 
      alert.message === message && 
      !alert.resolved
    );
    
    if (!existingAlert) {
      this.alerts.push({
        type,
        source,
        message,
        timestamp,
        resolved: false
      });
    }
  }
  
  /**
   * Get current alerts
   */
  getAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }
  
  /**
   * Resolve an alert
   */
  resolveAlert(index: number): void {
    if (this.alerts[index]) {
      this.alerts[index].resolved = true;
    }
  }
  
  /**
   * Get performance trends (requires previous metrics)
   */
  getPerformanceTrends(): any {
    if (!this.lastMetrics) {
      return null;
    }
    
    // This could be expanded to track trends over time
    // For now, just return the last metrics for comparison
    return {
      lastUpdate: this.lastMetrics.timestamp,
      currentHealthScore: this.lastMetrics.overall.healthScore,
      currentResponseTime: this.lastMetrics.overall.averageResponseTime
    };
  }
}

export const databaseMonitor = new DatabaseMonitor();