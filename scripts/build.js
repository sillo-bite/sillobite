// Cross-platform build script

/**
 * Build script that ensures Firebase environment variables are available during Vite build
 * Loads environment variables from .env file for production builds
 */

import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { createHash, randomBytes } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Generate version hash for cache invalidation
const generateVersion = () => {
  const timestamp = Date.now().toString();
  const random = randomBytes(8).toString('hex');
  return `v${timestamp}-${random}`;
};

const version = generateVersion();
const buildTimestamp = Date.now().toString();
const cacheVersion = `cache-${version}`;

console.log(`📦 Version: ${version}`);
console.log(`🕐 Build timestamp: ${buildTimestamp}`);

// Load environment variables from .env file
const envPath = join(rootDir, '.env');
if (existsSync(envPath)) {
  console.log('📋 Loading environment variables from .env file...');
  config({ path: envPath });
} else {
  console.log('⚠️  No .env file found, using system environment variables');
}

// Inject version information into files
console.log('🔧 Injecting version information...');

const filesToProcess = [
  {
    path: join(rootDir, 'client/src/utils/cacheManager.ts'),
    replacements: [
      { placeholder: '__APP_VERSION__', value: version },
      { placeholder: '__BUILD_TIMESTAMP__', value: buildTimestamp }
    ]
  },
  {
    path: join(rootDir, 'client/public/sw.js'),
    replacements: [
      { placeholder: '__CACHE_VERSION__', value: cacheVersion }
    ]
  }
];

// Process each file
filesToProcess.forEach(({ path: filePath, replacements }) => {
  try {
    if (!existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${filePath}`);
      return;
    }

    let content = readFileSync(filePath, 'utf8');
    
    // Apply all replacements
    replacements.forEach(({ placeholder, value }) => {
      const regex = new RegExp(placeholder, 'g');
      const matches = content.match(regex);
      
      if (matches) {
        content = content.replace(regex, value);
        console.log(`✅ Replaced ${matches.length} instances of ${placeholder} in ${filePath.split('/').pop()}`);
      }
    });
    
    // Write the updated content back
    writeFileSync(filePath, content);
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
});

// Create version info file for reference
const versionInfo = {
  version,
  buildTimestamp,
  cacheVersion,
  buildDate: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'production'
};

try {
  writeFileSync(join(rootDir, 'version.json'), JSON.stringify(versionInfo, null, 2));
  console.log('📋 Version info saved to version.json');
} catch (error) {
  console.error('❌ Error creating version.json:', error.message);
}

// Required Google OAuth environment variables
const requiredGoogleOAuthVars = [
  'VITE_GOOGLE_CLIENT_ID'
];

console.log('🔥 Starting production build process...');

// Check if Google OAuth environment variables are available
console.log('🔍 Checking Google OAuth environment variables...');
const missingVars = [];

for (const varName of requiredGoogleOAuthVars) {
  if (!process.env[varName]) {
    missingVars.push(varName);
  } else {
    console.log(`✅ ${varName} is available`);
  }
}

if (missingVars.length > 0) {
  console.error('❌ Missing Google OAuth environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n💡 Add these variables to your .env file:');
  missingVars.forEach(varName => {
    console.error(`   ${varName}=your_${varName.toLowerCase().replace('vite_google_', '')}_here`);
  });
  console.error('\n📋 Example .env file content:');
  console.error('   VITE_GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com');
  console.error('   GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnop');
  console.error('   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback');
  process.exit(1);
}

try {
  console.log('📦 Building frontend with Vite...');
  
  // Build the frontend
  execSync('npx vite build', {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });
  
  console.log('🖥️  Building backend with esbuild...');
  
  // Build the backend
  execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', {
    cwd: rootDir,
    stdio: 'inherit'
  });
  
  console.log('✅ Build completed successfully!');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}