import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import rateLimit from "express-rate-limit";
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

// ── Session secret guard ──────────────────────────────────────────────────────
// Fail fast in production if SESSION_SECRET is not set to a real value.
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET === 'your-secret-key-change-in-production') {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ FATAL: SESSION_SECRET env var is not set or uses the default placeholder. Set a strong random secret before deploying.');
    process.exit(1);
  } else {
    console.warn('⚠️  SESSION_SECRET is not set — using insecure default for development only.');
  }
}

// Trust proxy - required for HTTPS detection behind reverse proxies (Render, etc.)
app.set('trust proxy', 1);

// ── Global API rate limiter ───────────────────────────────────────────────────
// Applies to all /api/* routes. Generous limit — tighter per-route limits
// (e.g. coupon validation, polling) are layered on top in routes.ts.
const globalApiRateLimit = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 300,                    // 300 requests per IP per minute (~5 req/s burst)
  standardHeaders: true,       // Return RateLimit-* headers
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
  skip: (req) => {
    // Skip rate limiting for Razorpay webhook (it uses HMAC signature verification instead)
    return req.path === '/api/payments/webhook' || req.path === '/api/webhooks/razorpay';
  },
});
app.use('/api/', globalApiRateLimit);

// ── CORS ─────────────────────────────────────────────────────────────────────
// Client and API are served from the same Express process on the same origin,
// so same-origin requests work without CORS headers. This block adds explicit
// CORS support for any additional allowed origins (e.g. a separate mobile build
// domain) configured via the ALLOWED_ORIGINS env var.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

if (ALLOWED_ORIGINS.length > 0) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
    }
    next();
  });
}

// Session configuration for OAuth — uses MongoDB store to prevent
// session race conditions that occur with the default in-memory store
app.use(session({
  secret: SESSION_SECRET || 'dev-only-insecure-secret',
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

  // Cleanup expired connection codes every 5 minutes
  setInterval(async () => {
    try {
      const { connectionCodeService } = await import('./services/connectionCodeService');
      await connectionCodeService.cleanExpired();
      log('🧹 Cleaned expired connection codes');
    } catch (error) {
      console.error('❌ Error cleaning expired connection codes:', error);
    }
  }, 5 * 60 * 1000);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    }
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
