import type { Express, Request, Response } from "express";
import sharp from "sharp";
import fs from "fs";
import path from "path";

/**
 * Load splash logo SVG from client/public directory
 */
const SPLASH_LOGO_PATH = path.join(process.cwd(), "client", "public", "splash_logo.svg");

let cachedSVG: string | null = null;
let svgFileHash: string | null = null;

/**
 * Get file hash for cache invalidation
 */
function getFileHash(filePath: string): string {
  try {
    const stats = fs.statSync(filePath);
    return `${stats.mtime.getTime()}-${stats.size}`;
  } catch {
    return Date.now().toString();
  }
}

/**
 * Load SVG from file
 */
function loadSVG(): string {
  try {
    // Check if file exists and get its hash
    const currentHash = getFileHash(SPLASH_LOGO_PATH);
    
    // If file changed or not cached, reload
    if (!cachedSVG || svgFileHash !== currentHash) {
      console.log(`[IconGenerator] Loading SVG from: ${SPLASH_LOGO_PATH}`);
      cachedSVG = fs.readFileSync(SPLASH_LOGO_PATH, "utf-8");
      svgFileHash = currentHash;
      console.log(`[IconGenerator] SVG loaded successfully (${cachedSVG.length} chars)`);
    }
    
    return cachedSVG;
  } catch (error) {
    console.error("[IconGenerator] Error loading splash_logo.svg:", error);
    console.error("[IconGenerator] Attempted path:", SPLASH_LOGO_PATH);
    console.error("[IconGenerator] Current working directory:", process.cwd());
    // Fallback to a simple SVG if file not found
    return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 375 375"><rect width="375" height="375" fill="#6d47ff"/></svg>`;
  }
}

/**
 * Generate SVG at specific size (resize the loaded SVG)
 */
function generateSVG(size: number, color: string = "#6d47ff"): string {
  const svg = loadSVG();
  
  // Replace width and height attributes while preserving viewBox
  // The original SVG has viewBox="0 0 375 374.999991", so we'll keep that
  return svg
    .replace(/width="[^"]*"/, `width="${size}"`)
    .replace(/height="[^"]*"/, `height="${size}"`);
}

/**
 * Generate PNG from SVG (for PWA app icons)
 * Uses the splash_logo.svg file directly
 */
async function generatePNG(size: number, color: string = "#6d47ff"): Promise<Buffer> {
  const svg = loadSVG();
  const svgBuffer = Buffer.from(svg);
  
  // Sharp will automatically handle SVG resizing based on viewBox
  return await sharp(svgBuffer)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
    })
    .png()
    .toBuffer();
}

/**
 * Serve SVG icon dynamically
 */
export function registerIconRoutes(app: Express): void {
  // Serve SVG icon at any size
  app.get("/api/icon.svg", (req: Request, res: Response) => {
    const size = parseInt(req.query.size as string) || 512;
    const color = (req.query.color as string) || "#6d47ff";
    const svg = generateSVG(size, color);
    
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(svg);
  });

  // Serve PNG icon (for PWA app icons - generated from SVG code)
  app.get("/api/icon.png", async (req: Request, res: Response) => {
    try {
      const size = parseInt(req.query.size as string) || 512;
      const color = (req.query.color as string) || "#6d47ff";
      
      // Load SVG to get current hash
      loadSVG();
      
      // Generate ETag with file hash to invalidate cache when SVG changes
      const fileHash = svgFileHash || Date.now().toString();
      const etag = `"icon-${size}-${color}-${fileHash}"`;
      const ifNoneMatch = req.headers['if-none-match'];
      
      // Check if client has cached version
      if (ifNoneMatch === etag) {
        res.status(304).end(); // Not Modified
        return;
      }
      
      console.log(`[IconGenerator] Generating PNG icon: ${size}x${size} (hash: ${fileHash.substring(0, 8)})`);
      const png = await generatePNG(size, color);
      
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=3600, must-revalidate"); // Reduced cache time to 1 hour for easier updates
      res.setHeader("ETag", etag);
      res.setHeader("X-Icon-Version", fileHash); // Custom header for debugging
      res.send(png);
    } catch (error) {
      console.error("[IconGenerator] Error generating PNG icon:", error);
      res.status(500).json({ error: "Failed to generate icon" });
    }
  });

  // Serve SVG favicon
  app.get("/favicon.svg", (req: Request, res: Response) => {
    const svg = generateSVG(32, "#6d47ff");
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(svg);
  });

  // Serve PNG favicon (generated from SVG code)
  app.get("/favicon.png", async (req: Request, res: Response) => {
    try {
      const png = await generatePNG(32, "#6d47ff");
      
      // Generate ETag for better caching
      const etag = '"favicon-32"';
      const ifNoneMatch = req.headers['if-none-match'];
      
      // Check if client has cached version
      if (ifNoneMatch === etag) {
        res.status(304).end(); // Not Modified
        return;
      }
      
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("ETag", etag);
      res.send(png);
    } catch (error) {
      console.error("Error generating favicon PNG:", error);
      res.status(500).json({ error: "Failed to generate favicon" });
    }
  });
}


