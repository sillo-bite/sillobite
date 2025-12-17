#!/usr/bin/env node

/**
 * Production Optimization Script
 * 
 * This script optimizes the application for production deployment by:
 * 1. Enabling production environment variables
 * 2. Optimizing SSE connection settings
 * 3. Configuring payment processing timeouts
 * 4. Setting up performance monitoring
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('🚀 Starting production optimization...');

// Production environment variables
const productionEnvVars = {
  NODE_ENV: 'production',
  VITE_NODE_ENV: 'production',
  
  // SSE optimizations
  VITE_SSE_RECONNECT_ATTEMPTS: '5',
  VITE_SSE_RECONNECT_DELAY: '1000',
  VITE_SSE_MAX_DELAY: '30000',
  
  // Payment processing optimizations
  VITE_PAYMENT_TIMEOUT: '15000',
  VITE_PAYMENT_RETRY_ATTEMPTS: '3',
  
  // Performance monitoring
  VITE_ENABLE_PERFORMANCE_LOGGING: 'true',
  
  // Cache control
  VITE_CACHE_CONTROL_MAX_AGE: '86400', // 24 hours
  
  // PhonePe production settings (if using production gateway)
  // PHONEPE_BASE_URL: 'https://api.phonepe.com/apis/hermes',
  
  // MongoDB connection optimizations
  MONGODB_MAX_POOL_SIZE: '10',
  MONGODB_MIN_POOL_SIZE: '2',
  MONGODB_MAX_IDLE_TIME_MS: '30000',
  
  // PostgreSQL connection optimizations
  POSTGRES_MAX_CONNECTIONS: '20',
  POSTGRES_IDLE_TIMEOUT: '30000'
};

// Update .env file with production optimizations
function updateEnvFile() {
  const envPath = path.join(rootDir, '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }
  
  // Add production optimizations if not already present
  Object.entries(productionEnvVars).forEach(([key, value]) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      console.log(`📝 Updating ${key} in .env`);
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      console.log(`➕ Adding ${key} to .env`);
      envContent += `\n${key}=${value}`;
    }
  });
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Environment variables updated for production');
}

// Create production performance monitoring configuration
function createPerformanceConfig() {
  const configPath = path.join(rootDir, 'performance.config.json');
  
  const performanceConfig = {
    monitoring: {
      enabled: true,
      logLevel: 'info',
      metricsEndpoint: '/api/metrics',
      sampleRate: 0.1 // Sample 10% of requests
    },
    sse: {
      heartbeatInterval: 30000,
      maxConnections: 100,
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      maxReconnectDelay: 30000
    },
    payment: {
      timeout: 15000,
      retryAttempts: 3,
      retryDelay: 2000
    },
    database: {
      mongodb: {
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000
      },
      postgres: {
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      }
    },
    cache: {
      maxAge: 86400, // 24 hours
      staleWhileRevalidate: 3600, // 1 hour
      enableCompression: true
    }
  };
  
  fs.writeFileSync(configPath, JSON.stringify(performanceConfig, null, 2));
  console.log('✅ Performance configuration created');
}

// Create production startup script
function createProductionStartScript() {
  const scriptPath = path.join(rootDir, 'scripts/start-production.js');
  
  const startScript = `#!/usr/bin/env node

/**
 * Production Startup Script
 * Optimized startup process for production environment
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Starting application in production mode...');

// Verify build exists
const distPath = path.resolve(process.cwd(), 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ Build not found. Run "node scripts/build.js" first.');
  process.exit(1);
}

// Set production environment
process.env.NODE_ENV = 'production';
process.env.VITE_NODE_ENV = 'production';

// Start the server with optimizations
const server = spawn('node', ['dist/server/index.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    // Production optimizations
    UV_THREADPOOL_SIZE: '8', // Increase thread pool for better I/O performance
    NODE_OPTIONS: '--max-old-space-size=1024', // Limit memory usage
  }
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(\`🔄 Server exited with code \${code}\`);
  if (code !== 0) {
    process.exit(code);
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully...');
  server.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('📴 Received SIGINT, shutting down gracefully...');
  server.kill('SIGINT');
});
`;
  
  fs.writeFileSync(scriptPath, startScript);
  // Make script executable (Unix/Linux only)
  if (process.platform !== 'win32') {
    fs.chmodSync(scriptPath, '755');
  }
  console.log('✅ Production start script created');
}

// Update package.json with production scripts
function updatePackageJson() {
  const packagePath = path.join(rootDir, 'package.json');
  
  if (!fs.existsSync(packagePath)) {
    console.warn('⚠️ package.json not found, skipping script updates');
    return;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  
  // Add production scripts
  packageJson.scripts = {
    ...packageJson.scripts,
    'optimize:production': 'node scripts/production-optimization.js',
    'start:production': 'node scripts/start-production.js',
    'build:production': 'node scripts/build.js && node scripts/production-optimization.js'
  };
  
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Package.json updated with production scripts');
}

// Main execution
async function main() {
  try {
    updateEnvFile();
    createPerformanceConfig();
    createProductionStartScript();
    updatePackageJson();
    
    console.log('🎉 Production optimization completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('  1. Run "npm run build:production" to build with optimizations');
    console.log('  2. Run "npm run start:production" to start in production mode');
    console.log('  3. Monitor performance logs for optimization opportunities');
    
  } catch (error) {
    console.error('❌ Production optimization failed:', error);
    process.exit(1);
  }
}

main();