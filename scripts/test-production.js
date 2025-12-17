// Cross-platform production test script

/**
 * Simple test server for production build
 */

import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const app = express();
const port = 3001;

// Serve static files from dist/public
app.use(express.static(join(rootDir, 'dist', 'public')));

// Catch all handler for SPA routing
app.get('*', (req, res) => {
  res.sendFile(join(rootDir, 'dist', 'public', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Production test server running at http://0.0.0.0:${port}`);
  console.log('   Environment variables check:');
  console.log(`   - VITE_FIREBASE_API_KEY: ${process.env.VITE_FIREBASE_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - VITE_FIREBASE_PROJECT_ID: ${process.env.VITE_FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing'}`);  
  console.log(`   - VITE_FIREBASE_APP_ID: ${process.env.VITE_FIREBASE_APP_ID ? '✅ Set' : '❌ Missing'}`);
});