import express, { type Express } from "express";
import fs from "fs";
import * as pathModule from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = pathModule.dirname(__filename);

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Configure HMR with explicit port and host
  // The server will listen on port 5000, so we configure HMR to use the same port
  const port = 5000;
  const host = 'localhost'; // Always use localhost for HMR client connection

  const serverOptions = {
    middlewareMode: true,
    hmr: {
      server,
      port: port,
      host: host,
      clientPort: port,
    },
    allowedHosts: true as true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // Serve static files from public folder directly before Vite middleware
  // This prevents esbuild conflicts when multiple components request the same static file
  const publicPath = pathModule.resolve(__dirname, "..", "client", "public");
  app.use((req, res, next) => {
    const requestPath = req.path || (req.originalUrl ? req.originalUrl.split('?')[0] : '');

    // Check if it's a static file request
    const staticFileExtensions = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.json', '.xml', '.txt'];
    const isStaticFile = staticFileExtensions.some(ext => requestPath.toLowerCase().endsWith(ext));

    if (isStaticFile && !requestPath.startsWith('/api/')) {
      const filePath = pathModule.join(publicPath, requestPath);
      // Check if file exists and serve it directly - don't pass to Vite middleware
      if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
      }
    }
    next();
  });

  // Vite middleware - skip API routes and static files
  // IMPORTANT: API routes must be registered BEFORE this middleware
  app.use((req, res, next) => {
    // Get the path from multiple sources to be sure
    const requestPath = req.path || req.route?.path || (req.originalUrl ? req.originalUrl.split('?')[0] : '') || req.url?.split('?')[0] || '';

    // Skip Vite middleware for ALL API routes
    if (requestPath && (requestPath.startsWith('/api/') || requestPath === '/api')) {
      return next(); // Skip to API route handler - don't call vite.middlewares at all
    }

    // Skip Vite middleware for static files - they're already served by the previous middleware
    // This prevents esbuild conflicts when processing static assets
    const staticFileExtensions = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.json', '.xml', '.txt', '.css', '.js', '.map'];
    const isStaticFile = staticFileExtensions.some(ext => requestPath.toLowerCase().endsWith(ext));

    if (isStaticFile) {
      // Static files are already handled by the previous middleware
      // If we reach here, the file doesn't exist, so let Vite handle it (404)
      return vite.middlewares(req, res, next);
    }

    // For all non-API, non-static routes, use Vite middleware
    return vite.middlewares(req, res, next);
  });

  app.use("*", async (req, res, next) => {
    // Skip catch-all for API routes
    const requestPath = req.path || (req.originalUrl ? req.originalUrl.split('?')[0] : '');
    if (requestPath && requestPath.startsWith('/api/')) {
      return next();
    }

    const url = req.originalUrl;

    try {
      const clientTemplate = pathModule.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      const error = e as Error;
      viteLogger.error(`Error transforming HTML: ${error.message}`, { error });
      vite.ssrFixStacktrace(error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = pathModule.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  // Skip catch-all for API routes
  app.use("*", (req, res, next) => {
    // Skip catch-all for API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(pathModule.resolve(distPath, "index.html"));
  });
}
