import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let redisClient: Redis | null = null;
let redisConnectionAttempts = 0;
const MAX_REDIS_CONNECTION_ATTEMPTS = 3; // Stop trying after 3 failed attempts
let redisConnectionFailed = false;

/**
 * Get or create Redis client
 * Supports both Redis and Redis Cluster
 * SCALABILITY FIX: Stops reconnecting after max attempts to prevent log spam
 */
export function getRedisClient(): Redis {
  // If Redis connection has failed permanently, return a mock client that fails gracefully
  if (redisConnectionFailed) {
    // Return a mock client that always fails gracefully
    return {
      ping: () => Promise.reject(new Error('Redis not available')),
      get: () => Promise.resolve(null),
      set: () => Promise.resolve('OK'),
      del: () => Promise.resolve(0),
      exists: () => Promise.resolve(0),
      incr: () => Promise.resolve(0),
      eval: () => Promise.resolve(0),
      status: 'end' as any,
    } as any;
  }

  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI || 'redis://localhost:6379';
  
  // Parse Redis URL for configuration
  const redisConfig: any = {
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
    retryStrategy: (times: number) => {
      // Stop retrying after max attempts
      if (times > MAX_REDIS_CONNECTION_ATTEMPTS) {
        redisConnectionFailed = true;
        console.log('⚠️ Redis connection failed after max attempts. Using in-memory cache fallback.');
        return null; // Stop retrying
      }
      const delay = Math.min(times * parseInt(process.env.REDIS_RETRY_DELAY || '50'), 2000);
      return delay;
    },
    reconnectOnError: (err: Error) => {
      redisConnectionAttempts++;
      
      // Stop reconnecting after max attempts
      if (redisConnectionAttempts > MAX_REDIS_CONNECTION_ATTEMPTS) {
        redisConnectionFailed = true;
        console.log('⚠️ Redis reconnection stopped after max attempts. Using in-memory cache fallback.');
        return false; // Stop reconnecting
      }
      
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true; // Reconnect on READONLY error
      }
      return false;
    },
    enableReadyCheck: true,
    enableOfflineQueue: false, // Don't queue commands when disconnected
    lazyConnect: true, // SCALABILITY FIX: Lazy connect - only connect when actually needed
    // Connection timeout (configurable via env)
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
    // Command timeout (configurable via env)
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
    // Keep-alive for production
    keepAlive: 30000,
    // Use IPv4 by default
    family: 4,
  };

  // If Redis URL contains cluster info, use cluster mode
  if (redisUrl.includes('cluster') || process.env.REDIS_CLUSTER === 'true') {
    // For cluster mode, parse nodes from URL or use environment variables
    const nodes = process.env.REDIS_CLUSTER_NODES 
      ? process.env.REDIS_CLUSTER_NODES.split(',').map(node => ({ host: node.split(':')[0], port: parseInt(node.split(':')[1]) }))
      : [{ host: 'localhost', port: 6379 }];
    
    redisClient = new Redis.Cluster(nodes, {
      ...redisConfig,
      redisOptions: {
        password: process.env.REDIS_PASSWORD,
      }
    });
  } else {
    // Single Redis instance
    redisClient = new Redis(redisUrl, {
      ...redisConfig,
      password: process.env.REDIS_PASSWORD,
    });
  }

  redisClient.on('connect', () => {
    console.log('✅ Redis client connected');
    redisConnectionAttempts = 0; // Reset on successful connection
    redisConnectionFailed = false;
  });

  redisClient.on('ready', () => {
    console.log('✅ Redis client ready');
    redisConnectionAttempts = 0; // Reset on ready
    redisConnectionFailed = false;
  });

  redisClient.on('error', (err) => {
    // Only log first few errors to prevent spam
    if (redisConnectionAttempts <= MAX_REDIS_CONNECTION_ATTEMPTS) {
      if (redisConnectionAttempts === 0) {
        console.warn('⚠️ Redis client error (will retry up to 3 times):', err.message);
      }
    }
    // Don't log after max attempts to prevent log spam
  });

  redisClient.on('close', () => {
    // Only log if not permanently failed
    if (!redisConnectionFailed && redisConnectionAttempts <= MAX_REDIS_CONNECTION_ATTEMPTS) {
      console.log('⚠️ Redis client connection closed');
    }
  });

  redisClient.on('reconnecting', () => {
    // Only log if not permanently failed
    if (!redisConnectionFailed && redisConnectionAttempts <= MAX_REDIS_CONNECTION_ATTEMPTS) {
      console.log(`🔄 Redis client reconnecting... (attempt ${redisConnectionAttempts + 1}/${MAX_REDIS_CONNECTION_ATTEMPTS})`);
    }
  });

  return redisClient;
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  // If we've already determined Redis is not available, don't try again
  if (redisConnectionFailed) {
    return false;
  }

  try {
    const client = getRedisClient();
    
    // If client is a mock (failed), return false immediately
    if ((client as any).status === 'end') {
      return false;
    }
    
    // Only try to connect if not already connected
    if (client.status !== 'ready' && client.status !== 'connecting') {
      // Use lazy connect - only connect when ping is called
      try {
        await client.connect();
      } catch (connectError) {
        // Connection failed, mark as unavailable
        redisConnectionFailed = true;
        if (redisConnectionAttempts === 0) {
          console.warn('⚠️ Redis not available, using in-memory cache fallback');
        }
        return false;
      }
    }
    
    await client.ping();
    redisConnectionFailed = false; // Reset on success
    redisConnectionAttempts = 0;
    return true;
  } catch (error) {
    redisConnectionFailed = true;
    // Only log once to prevent spam
    if (redisConnectionAttempts === 0) {
      console.warn('⚠️ Redis not available, using in-memory cache fallback');
    }
    return false;
  }
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('✅ Redis connection closed');
  }
}

/**
 * Redis cache helper functions
 */
export class RedisCache {
  private client: Redis;

  constructor() {
    this.client = getRedisClient();
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Error getting cache key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.client.setex(key, ttlSeconds, serialized);
    } catch (error) {
      console.error(`Error setting cache key ${key}:`, error);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error(`Error deleting cache key ${key}:`, error);
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      console.error(`Error deleting cache pattern ${pattern}:`, error);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Error checking cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Increment a counter
   */
  async increment(key: string, ttlSeconds?: number): Promise<number> {
    try {
      const result = await this.client.incr(key);
      if (ttlSeconds && result === 1) {
        // Set TTL only on first increment
        await this.client.expire(key, ttlSeconds);
      }
      return result;
    } catch (error) {
      console.error(`Error incrementing cache key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get or set with callback (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 3600
  ): Promise<T> {
    try {
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      const value = await fetchFn();
      await this.set(key, value, ttlSeconds);
      return value;
    } catch (error) {
      console.error(`Error in getOrSet for key ${key}:`, error);
      // Fallback to direct fetch if cache fails
      return await fetchFn();
    }
  }
}

/**
 * Distributed lock implementation using Redis
 */
export class DistributedLock {
  private client: Redis;
  private lockKey: string;
  private lockValue: string;
  private ttl: number; // Lock TTL in seconds

  constructor(key: string, ttl: number = 30) {
    this.client = getRedisClient();
    this.lockKey = `lock:${key}`;
    this.lockValue = `${Date.now()}-${Math.random()}`;
    this.ttl = ttl;
  }

  /**
   * Acquire lock (non-blocking)
   * Returns true if lock acquired, false otherwise
   */
  async acquire(): Promise<boolean> {
    try {
      const result = await this.client.set(
        this.lockKey,
        this.lockValue,
        'EX',
        this.ttl,
        'NX' // Only set if not exists
      );
      return result === 'OK';
    } catch (error) {
      console.error(`Error acquiring lock ${this.lockKey}:`, error);
      return false;
    }
  }

  /**
   * Acquire lock with retry (blocking)
   * Returns true if lock acquired within timeout, false otherwise
   */
  async acquireWithRetry(maxRetries: number = 10, retryDelay: number = 100): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      if (await this.acquire()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    return false;
  }

  /**
   * Release lock (only if we own it)
   */
  async release(): Promise<boolean> {
    try {
      // Lua script to atomically check and delete
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      const result = await this.client.eval(script, 1, this.lockKey, this.lockValue);
      return result === 1;
    } catch (error) {
      console.error(`Error releasing lock ${this.lockKey}:`, error);
      return false;
    }
  }

  /**
   * Extend lock TTL
   */
  async extend(newTtl: number): Promise<boolean> {
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("expire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;
      const result = await this.client.eval(script, 1, this.lockKey, this.lockValue, newTtl);
      return result === 1;
    } catch (error) {
      console.error(`Error extending lock ${this.lockKey}:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const redisCache = new RedisCache();

