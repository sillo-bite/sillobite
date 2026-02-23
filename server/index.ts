import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { performStartupCheck } from "./startup-check";
import { performStartupSchemaCheck } from "./startup-schema-check";
import { initializeWebSocket } from "./websocket";
import { sessionCleanupService } from "./services/sessionCleanupService";
import { isRedisAvailable } from "./config/redis";
import { addPerformanceIndexes } from "./migrations/add-performance-indexes";
import { printAgentService } from "./services/printAgentService";

const app = express();

// Trust proxy - required for HTTPS detection behind reverse proxies (Render, etc.)
app.set('trust proxy', 1);

// Session configuration for OAuth — uses MongoDB store to prevent
// session race conditions that occur with the default in-memory store
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI!,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60, // 1 day in seconds (matches cookie maxAge)
    autoRemove: 'native',
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

// Skip JSON parsing for file upload routes
app.use((req, res, next) => {
  if (req.path.includes('/image') && req.method === 'POST') {
    return next();
  }
  // Increase JSON body parser limit to 10MB to handle larger payloads
  express.json({ limit: '10mb' })(req, res, next);
});

app.use(express.urlencoded({ extended: false }));

// TEMPORARY: Android request logging middleware
// DO NOT CHANGE EXISTING LOGIC - ONLY LOG
app.use((req, res, next) => {
  // Only log API requests
  if (req.path.startsWith("/api")) {
    const method = req.method;
    const path = req.path;
    const hasAuth = !!req.headers.authorization;
    const userAgent = req.headers['user-agent'] || '';
    const isAndroid = userAgent.toLowerCase().includes('android');

    // Extract user role if authenticated (from session or request)
    let userRole = 'unauthenticated';
    if ((req as any).session?.user) {
      userRole = (req as any).session.user.role || 'unknown';
    } else if ((req as any).user?.role) {
      userRole = (req as any).user.role;
    }

    // Build log line
    const parts = [
      `[${isAndroid ? 'ANDROID' : 'WEB'}]`,
      method,
      path,
      hasAuth ? '🔑' : '🔓',
      `role:${userRole}`
    ];

    console.log(`🔍 ${parts.join(' ')}`);
  }

  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Perform startup health check
  const healthCheckPassed = await performStartupCheck();
  if (!healthCheckPassed) {
    console.error("❌ Server startup aborted due to failed health check");
    process.exit(1);
  }

  // Perform database schema validation and migration
  await performStartupSchemaCheck();

  // SCALABILITY FIX: Add performance indexes
  try {
    await addPerformanceIndexes();
    log('✅ Performance indexes added');
  } catch (error) {
    console.warn('⚠️ Could not add performance indexes:', error);
  }

  // SCALABILITY FIX: Check Redis availability
  try {
    const redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      log('✅ Redis cache available');
    } else {
      log('⚠️ Redis not available, using in-memory cache fallback');
    }
  } catch (error) {
    console.warn('⚠️ Redis check failed:', error);
  }

  const server = await registerRoutes(app);

  // Initialize WebSocket server
  initializeWebSocket(server, app);

  // Initialize Print Agent WebSocket server
  printAgentService.initialize(server);
  log('🖨️ Print Agent service initialized');

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  const host = "0.0.0.0";

  server.listen({
    port,
    host,
    reusePort: process.platform !== 'win32', // Windows doesn't support reusePort
  }, () => {
    log(`serving on port ${port} (${host})`);

    // Start session cleanup service
    sessionCleanupService.start();
    log('🔄 Session cleanup service started');
  });
})();
