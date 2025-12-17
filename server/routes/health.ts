import { Request, Response } from 'express';
import { isRedisAvailable, getRedisClient } from '../config/redis';

/**
 * Redis health check endpoint
 * Useful for monitoring and debugging
 */
export async function redisHealthCheck(req: Request, res: Response) {
  try {
    const available = await isRedisAvailable();
    
    if (!available) {
      return res.status(503).json({
        status: 'unavailable',
        message: 'Redis is not available',
        timestamp: new Date().toISOString()
      });
    }

    const client = getRedisClient();
    
    // Get Redis info
    const [serverInfo, memoryInfo, statsInfo] = await Promise.all([
      client.info('server').catch(() => ''),
      client.info('memory').catch(() => ''),
      client.info('stats').catch(() => '')
    ]);

    // Parse info strings
    const parseInfo = (info: string, key: string): string | null => {
      const match = info.match(new RegExp(`${key}:([^\\r\\n]+)`));
      return match ? match[1] : null;
    };

    res.json({
      status: 'healthy',
      available: true,
      timestamp: new Date().toISOString(),
      info: {
        version: parseInfo(serverInfo, 'redis_version'),
        uptime: parseInfo(serverInfo, 'uptime_in_seconds'),
        connectedClients: parseInfo(statsInfo, 'connected_clients'),
        totalCommandsProcessed: parseInfo(statsInfo, 'total_commands_processed'),
        memory: {
          used: parseInfo(memoryInfo, 'used_memory_human'),
          peak: parseInfo(memoryInfo, 'used_memory_peak_human'),
          max: parseInfo(memoryInfo, 'maxmemory_human') || 'unlimited',
        },
        keyspace: {
          keys: parseInfo(statsInfo, 'keyspace_keys'),
          hits: parseInfo(statsInfo, 'keyspace_hits'),
          misses: parseInfo(statsInfo, 'keyspace_misses'),
        }
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

