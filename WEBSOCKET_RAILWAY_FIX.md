# WebSocket Fix for Railway Free Tier

## The Problem
- Railway free tier only allows ONE custom domain
- You're using `sillobite.in` for your main site
- WebSocket connections are failing

## The Solution
Use Railway's default domain for WebSocket connections (bypasses Cloudflare)

### Step 1: Get Your Railway Domain

1. Go to Railway Dashboard
2. Select your project
3. Go to **Settings** → **Domains**
4. Copy the Railway domain (looks like: `sillobite-production-f94d.up.railway.app`)

### Step 2: Set Environment Variable in Railway

1. Go to **Variables** tab in Railway
2. Add or update:
   ```
   VITE_WS_BASE_URL=wss://sillobite-production-f94d.up.railway.app
   ```
   (Replace with YOUR actual Railway domain)

3. Also ensure:
   ```
   CLIENT_URL=https://sillobite.in
   ```

### Step 3: Deploy

1. Commit and push the code changes (CORS updated to allow Railway domains)
2. Railway will automatically redeploy
3. Wait 2-3 minutes

### Step 4: Test

1. Go to `https://sillobite.in`
2. Open browser console (F12)
3. Look for:
   - `✅ Notification WebSocket connected`
   - No more "offline" status or connection errors

## Why This Works

- **Main site** (`sillobite.in`): Goes through Cloudflare → gets CDN, DDoS protection
- **WebSocket** (`your-app.up.railway.app`): Direct to Railway → bypasses Cloudflare
- Your app makes HTTP requests to `sillobite.in`
- Your app makes WebSocket connections to `your-app.up.railway.app`

## Code Changes Made

Updated `server/websocket.ts` CORS to allow:
- `https://sillobite.in`
- `https://ws.sillobite.in` (for future use)
- All Railway domains (`*.railway.app` and `*.up.railway.app`)

## Alternative: Enable WebSocket Through Cloudflare

If you want everything through one domain:

1. In Cloudflare → **Network** → Enable **WebSockets**
2. In Cloudflare → **Speed** → **Optimization** → Disable **Rocket Loader**
3. Remove `VITE_WS_BASE_URL` from Railway (will use same domain)

**Note**: This may still have issues with Cloudflare's 100-second WebSocket timeout.

## Recommended Approach

**Use Railway's default domain for WebSockets** - it's more reliable and bypasses Cloudflare entirely for real-time connections.
