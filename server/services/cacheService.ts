import { redisCache, isRedisAvailable } from '../config/redis';

/**
 * Cache service for frequently accessed data
 * Uses Redis when available, falls back to in-memory cache
 */
class InMemoryCache {
  private cache: Map<string, { value: any; expires: number }> = new Map();

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value as T;
  }

  set(key: string, value: any, ttlSeconds: number): void {
    const expires = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expires });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

const memoryCache = new InMemoryCache();

/**
 * College name cache service
 */
export class CollegeCacheService {
  private static readonly CACHE_TTL = 3600; // 1 hour

  /**
   * Get college name by ID (with caching)
   */
  static async getCollegeName(collegeId: string, fetchFn: () => Promise<string>): Promise<string> {
    const cacheKey = `college:name:${collegeId}`;
    
    // Try Redis first
    if (await isRedisAvailable()) {
      return await redisCache.getOrSet(cacheKey, fetchFn, this.CACHE_TTL);
    }
    
    // Fallback to memory cache
    const cached = memoryCache.get<string>(cacheKey);
    if (cached !== null) {
      return cached;
    }
    
    const value = await fetchFn();
    memoryCache.set(cacheKey, value, this.CACHE_TTL);
    return value;
  }

  /**
   * Invalidate college name cache
   */
  static async invalidateCollegeName(collegeId: string): Promise<void> {
    const cacheKey = `college:name:${collegeId}`;
    
    if (await isRedisAvailable()) {
      await redisCache.delete(cacheKey);
    } else {
      memoryCache.delete(cacheKey);
    }
  }
}

/**
 * Counter IDs cache service
 */
export class CounterCacheService {
  private static readonly CACHE_TTL = 1800; // 30 minutes

  /**
   * Get payment counters for canteen (with caching)
   */
  static async getPaymentCounters(
    canteenId: string, 
    fetchFn: () => Promise<any[]>
  ): Promise<any[]> {
    const cacheKey = `counters:payment:${canteenId}`;
    
    // Try Redis first
    if (await isRedisAvailable()) {
      return await redisCache.getOrSet(cacheKey, fetchFn, this.CACHE_TTL);
    }
    
    // Fallback to memory cache
    const cached = memoryCache.get<any[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }
    
    const value = await fetchFn();
    memoryCache.set(cacheKey, value, this.CACHE_TTL);
    return value;
  }

  /**
   * Invalidate counter cache for canteen
   */
  static async invalidateCounters(canteenId: string): Promise<void> {
    const cacheKey = `counters:payment:${canteenId}`;
    
    if (await isRedisAvailable()) {
      await redisCache.delete(cacheKey);
    } else {
      memoryCache.delete(cacheKey);
    }
  }
}

/**
 * Payment duplicate check cache service
 */
export class PaymentDuplicateCacheService {
  private static readonly CACHE_TTL = 300; // 5 minutes

  /**
   * Check if payment is duplicate (with caching)
   */
  static async checkDuplicate(
    key: string,
    fetchFn: () => Promise<boolean>
  ): Promise<boolean> {
    const cacheKey = `payment:duplicate:${key}`;
    
    // Try Redis first
    if (await isRedisAvailable()) {
      const cached = await redisCache.get<boolean>(cacheKey);
      if (cached !== null) {
        return cached;
      }
      
      const isDuplicate = await fetchFn();
      await redisCache.set(cacheKey, isDuplicate, this.CACHE_TTL);
      return isDuplicate;
    }
    
    // Fallback to memory cache
    const cached = memoryCache.get<boolean>(cacheKey);
    if (cached !== null) {
      return cached;
    }
    
    const isDuplicate = await fetchFn();
    memoryCache.set(cacheKey, isDuplicate, this.CACHE_TTL);
    return isDuplicate;
  }

  /**
   * Mark payment as processed
   */
  static async markProcessed(key: string): Promise<void> {
    const cacheKey = `payment:duplicate:${key}`;
    
    if (await isRedisAvailable()) {
      await redisCache.set(cacheKey, true, this.CACHE_TTL);
    } else {
      memoryCache.set(cacheKey, true, this.CACHE_TTL);
    }
  }
}

