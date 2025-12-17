# Redis Production Setup Guide

This guide covers Redis setup for production environments to handle 1000+ concurrent users.

## 🎯 Production Redis Options

### Option 1: Managed Redis Services (Recommended)

**Best for**: Most production deployments
**Pros**: High availability, automatic backups, monitoring, scaling
**Cons**: Cost (usually $10-50/month)

#### Recommended Providers:

1. **Redis Cloud (Redis Labs)**
   - Free tier: 30MB
   - Paid: From $5/month
   - URL: https://redis.com/cloud/
   - Setup: Create account → Create database → Get connection URL

2. **AWS ElastiCache for Redis**
   - Managed Redis on AWS
   - High availability with Multi-AZ
   - URL: https://aws.amazon.com/elasticache/redis/
   - Best for: AWS deployments

3. **Azure Cache for Redis**
   - Managed Redis on Azure
   - URL: https://azure.microsoft.com/services/cache/
   - Best for: Azure deployments

4. **Google Cloud Memorystore for Redis**
   - Managed Redis on GCP
   - URL: https://cloud.google.com/memorystore
   - Best for: GCP deployments

5. **DigitalOcean Managed Redis**
   - Simple, affordable
   - From $15/month
   - URL: https://www.digitalocean.com/products/managed-databases

### Option 2: Self-Hosted Redis

**Best for**: Full control, cost optimization
**Pros**: Full control, no vendor lock-in
**Cons**: You manage backups, scaling, monitoring

#### Self-Hosted Setup:

```bash
# Using Docker (Recommended)
docker run -d \
  --name redis-production \
  --restart unless-stopped \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes --requirepass YOUR_STRONG_PASSWORD

# Using Docker Compose
```

Create `docker-compose.redis.yml`:
```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    container_name: redis-production
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: >
      redis-server
      --appendonly yes
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 2gb
      --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  redis-data:
```

## 🔧 Production Configuration

### Environment Variables

Add to your `.env` file:

```env
# Redis Configuration
REDIS_URL=redis://:YOUR_PASSWORD@your-redis-host:6379
# OR for Redis Cloud/ElastiCache
REDIS_URL=rediss://:YOUR_PASSWORD@your-redis-host:6380
# OR for cluster mode
REDIS_CLUSTER=true
REDIS_CLUSTER_NODES=node1:6379,node2:6379,node3:6379
REDIS_PASSWORD=your_strong_password_here

# Redis Connection Settings (Optional - defaults are good)
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=50
```

### High Availability Setup

#### 1. Redis Sentinel (Recommended for Self-Hosted)

Redis Sentinel provides automatic failover. Setup:

```yaml
# docker-compose.sentinel.yml
version: '3.8'
services:
  redis-master:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"

  redis-replica1:
    image: redis:7-alpine
    command: redis-server --replicaof redis-master 6379 --masterauth ${REDIS_PASSWORD} --requirepass ${REDIS_PASSWORD}
    depends_on:
      - redis-master

  redis-replica2:
    image: redis:7-alpine
    command: redis-server --replicaof redis-master 6379 --masterauth ${REDIS_PASSWORD} --requirepass ${REDIS_PASSWORD}
    depends_on:
      - redis-master

  sentinel1:
    image: redis:7-alpine
    command: >
      redis-sentinel /etc/redis/sentinel.conf
      --sentinel monitor mymaster redis-master 6379 2
      --sentinel auth-pass mymaster ${REDIS_PASSWORD}
    depends_on:
      - redis-master
      - redis-replica1
      - redis-replica2
```

#### 2. Redis Cluster (For Very High Load)

For handling 10,000+ concurrent users:

```yaml
# docker-compose.cluster.yml
version: '3.8'
services:
  redis-node1:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    ports:
      - "7001:6379"
      - "17001:16379"

  redis-node2:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    ports:
      - "7002:6379"
      - "17002:16379"

  redis-node3:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    ports:
      - "7003:6379"
      - "17003:16379"
```

Then initialize cluster:
```bash
redis-cli --cluster create \
  redis-node1:6379 \
  redis-node2:6379 \
  redis-node3:6379 \
  --cluster-replicas 0
```

## 🔒 Security Best Practices

### 1. Use Strong Passwords

```env
REDIS_PASSWORD=$(openssl rand -base64 32)
```

### 2. Enable TLS/SSL

For managed services, use `rediss://` (with 's') instead of `redis://`:

```env
REDIS_URL=rediss://:PASSWORD@your-redis-host:6380
```

### 3. Network Security

- **Firewall Rules**: Only allow connections from your application servers
- **VPC/Private Network**: Use private networks for Redis (not public internet)
- **IP Whitelisting**: Whitelist your server IPs in managed Redis services

### 4. Disable Dangerous Commands

Add to Redis config:
```conf
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
rename-command SHUTDOWN SHUTDOWN_SECURE
```

## 📊 Performance Tuning

### Memory Configuration

```env
# Redis Memory Settings (in redis.conf or command)
MAXMEMORY=2gb
MAXMEMORY_POLICY=allkeys-lru  # Evict least recently used keys
```

### Connection Pooling

The current implementation uses ioredis which handles connection pooling automatically. For high load:

```typescript
// In server/config/redis.ts - already implemented
const redisConfig = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: false, // Don't queue when disconnected
  lazyConnect: false,
  connectTimeout: 10000,
  commandTimeout: 5000,
  // Connection pool settings
  keepAlive: 30000,
  family: 4, // IPv4
};
```

### Persistence Settings

For production, use AOF (Append Only File) for durability:

```conf
appendonly yes
appendfsync everysec  # Balance between performance and durability
```

## 🔍 Monitoring & Health Checks

### 1. Add Health Check Endpoint

Add to `server/routes.ts`:

```typescript
// Redis health check
app.get("/api/health/redis", async (req, res) => {
  try {
    const { isRedisAvailable, getRedisClient } = await import('./config/redis');
    const available = await isRedisAvailable();
    
    if (!available) {
      return res.status(503).json({
        status: 'unavailable',
        message: 'Redis is not available'
      });
    }

    const client = getRedisClient();
    const info = await client.info('server');
    const memory = await client.info('memory');
    
    res.json({
      status: 'healthy',
      available: true,
      info: {
        version: info.match(/redis_version:([^\r\n]+)/)?.[1],
        uptime: info.match(/uptime_in_seconds:([^\r\n]+)/)?.[1],
        memory: {
          used: memory.match(/used_memory_human:([^\r\n]+)/)?.[1],
          peak: memory.match(/used_memory_peak_human:([^\r\n]+)/)?.[1],
        }
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
```

### 2. Monitoring Tools

- **Redis Insight**: Free GUI tool from Redis Labs
- **Prometheus + Grafana**: For metrics
- **Datadog/New Relic**: APM tools with Redis monitoring

### 3. Key Metrics to Monitor

- Memory usage
- Connection count
- Command latency
- Cache hit rate
- Error rate

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] Redis instance provisioned (managed or self-hosted)
- [ ] Strong password set
- [ ] TLS/SSL enabled (if using managed service)
- [ ] Network security configured (firewall/VPC)
- [ ] Environment variables set in production
- [ ] Connection tested from application server

### Deployment Steps

1. **Set Environment Variables**:
   ```bash
   # In your production environment (Heroku, Railway, etc.)
   export REDIS_URL=rediss://:PASSWORD@your-redis-host:6380
   export REDIS_PASSWORD=your_password
   ```

2. **Test Connection**:
   ```bash
   # From your application server
   redis-cli -u $REDIS_URL ping
   # Should return: PONG
   ```

3. **Verify Application**:
   - Check `/api/health/redis` endpoint
   - Monitor application logs for Redis connection
   - Test a payment flow to ensure caching works

### Post-Deployment

- [ ] Monitor Redis metrics
- [ ] Set up alerts for high memory usage
- [ ] Set up alerts for connection failures
- [ ] Test failover (if using Sentinel/Cluster)
- [ ] Verify cache hit rates

## 🔄 Backup & Recovery

### Automated Backups

#### For Managed Services:
- Most managed Redis services provide automatic backups
- Configure backup frequency (daily recommended)
- Test restore process

#### For Self-Hosted:

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
redis-cli --rdb /backups/redis-$DATE.rdb
# Upload to S3/cloud storage
aws s3 cp /backups/redis-$DATE.rdb s3://your-bucket/redis-backups/
```

### Recovery Process

1. Stop application
2. Restore Redis data
3. Verify data integrity
4. Restart application

## 💰 Cost Optimization

### 1. Right-Size Your Instance

- Start with smallest instance that meets needs
- Monitor memory usage
- Scale up only when needed

### 2. Use Appropriate Eviction Policy

```conf
# For cache data (can be lost)
maxmemory-policy allkeys-lru

# For critical data (persist to database)
maxmemory-policy volatile-lru
```

### 3. Monitor and Clean Up

- Set appropriate TTLs on cache keys
- Monitor key count
- Clean up unused keys periodically

## 🐛 Troubleshooting

### Connection Issues

**Problem**: Cannot connect to Redis
```bash
# Test connection
redis-cli -u $REDIS_URL ping

# Check firewall
telnet your-redis-host 6379

# Check DNS
nslookup your-redis-host
```

### Memory Issues

**Problem**: Out of memory errors
```bash
# Check memory usage
redis-cli INFO memory

# Clear cache (if safe)
redis-cli FLUSHDB
```

### Performance Issues

**Problem**: Slow Redis operations
```bash
# Check slow log
redis-cli SLOWLOG GET 10

# Monitor commands
redis-cli MONITOR
```

## 📝 Production Environment Variables Template

```env
# Production Redis Configuration
REDIS_URL=rediss://:STRONG_PASSWORD_HERE@your-redis-host.redis.cloud:6380
REDIS_PASSWORD=STRONG_PASSWORD_HERE

# Optional: For cluster mode
# REDIS_CLUSTER=true
# REDIS_CLUSTER_NODES=node1:6379,node2:6379,node3:6379

# Optional: Connection tuning
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
REDIS_MAX_RETRIES=3
```

## 🎯 Recommended Setup by Scale

### Small Scale (100-500 concurrent users)
- **Option**: Managed Redis (Redis Cloud free tier or DigitalOcean $15/month)
- **Memory**: 256MB-1GB
- **Setup**: Single instance, no replication needed

### Medium Scale (500-2000 concurrent users)
- **Option**: Managed Redis (Redis Cloud $10-30/month or AWS ElastiCache)
- **Memory**: 1-4GB
- **Setup**: Single instance with backups

### Large Scale (2000+ concurrent users)
- **Option**: Managed Redis with replication or Redis Cluster
- **Memory**: 4GB+
- **Setup**: High availability with Sentinel or Cluster mode

## ✅ Quick Start for Production

1. **Choose a managed Redis service** (e.g., Redis Cloud)
2. **Create a database** and get connection URL
3. **Set environment variable**:
   ```bash
   export REDIS_URL=rediss://:PASSWORD@your-host:6380
   ```
4. **Deploy your application**
5. **Verify** with `/api/health/redis` endpoint

The application will automatically:
- Connect to Redis on startup
- Use Redis for caching
- Fall back to in-memory cache if Redis unavailable
- Handle reconnections automatically

## 🔗 Additional Resources

- [Redis Documentation](https://redis.io/docs/)
- [ioredis Documentation](https://github.com/redis/ioredis)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)

