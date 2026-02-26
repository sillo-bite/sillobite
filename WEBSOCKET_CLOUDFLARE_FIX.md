# WebSocket Cloudflare Fix - Step by Step Guide

## Problem
WebSocket connections are failing in production because:
1. Cloudflare proxy can interfere with WebSocket connections
2. Railway free tier only allows ONE custom domain

## Solution: Enable WebSocket Through Cloudflare (Same Domain)

Since Railway free tier only allows one custom domain, we'll use `sillobite.in` for both HTTP and WebSocket, but configure Cloudflare properly.

### Step 1: Configure Cloudflare for WebSockets

1. Go to your Cloudflare Dashboard
2. Select your domain: `sillobite.in`
3. Go to **Network** tab
4. Ensure **WebSockets** is **ON** (it should be enabled by default)

### Step 2: Disable Cloudflare Features That Break WebSockets

1. Go to **Speed** → **Optimization**
2. **Disable** or check these settings:
   - **Rocket Loader**: Turn OFF (breaks WebSockets)
   - **Auto Minify**: Uncheck JavaScript if enabled
   
3. Go to **SSL/TLS** → **Edge Certificates**
4. Ensure **Always Use HTTPS** is ON
5. **Minimum TLS Version**: TLS 1.2 or higher

### Step 3: Configure Railway Environment Variables

Remove the `VITE_WS_BASE_URL` variable (or set it to use same domain):

**Option A: Remove the variable** (recommended)
- Delete `VITE_WS_BASE_URL` from Railway Variables
- The app will automatically use `wss://sillobite.in`

**Option B: Set it explicitly**
```
VITE_WS_BASE_URL=wss://sillobite.in
```

Also ensure:
```
CLIENT_URL=https://sillobite.in
```

### Step 4: Update Server CORS

The server code has been updated to allow CORS from:
- `https://sillobite.in`
- `https://ws.sillobite.in` (for future use if you upgrade Railway)

### Step 5: Deploy and Test

1. Commit and push code changes
2. Railway will automatically redeploy
3. Wait 2-3 minutes for deployment
4. Test at `https://sillobite.in`
5. Check browser console for:
   - `✅ Notification WebSocket connected`
   - No "offline" status

## Alternative: Use Railway's Default Domain (Bypass Cloudflare)

If Cloudflare still causes issues, use Railway's domain directly for WebSockets:

### Get Railway Domain
1. Go to Railway Dashboard → Settings → Domains
2. Copy domain like: `sillobite-production-f94d.up.railway.app`

### Set Environment Variable
```
VITE_WS_BASE_URL=wss://sillobite-production-f94d.up.railway.app
```

### Update CORS
The server already allows Railway domains, so this should work immediately.

**Pros**: Bypasses Cloudflare completely for WebSockets
**Cons**: WebSocket traffic doesn't get Cloudflare protection

## Troubleshooting

### WebSocket Still Failing
1. Check Cloudflare → Network → WebSockets is ON
2. Disable Rocket Loader in Speed → Optimization
3. Try using Railway's default domain for WebSockets
4. Check Railway logs for connection attempts

### CORS Errors
Ensure `CLIENT_URL=https://sillobite.in` is set in Railway

### Connection Timeout
- Cloudflare has a 100-second timeout for WebSocket connections
- Your server pings every 25 seconds, so this should be fine
- If issues persist, use Railway's default domain

## Recommended Approach

**For Railway Free Tier:**
Use Railway's default domain for WebSockets:
```
VITE_WS_BASE_URL=wss://your-app.up.railway.app
```

This bypasses Cloudflare entirely for WebSocket traffic while keeping your main site behind Cloudflare.

## Code Changes Made

Updated `server/websocket.ts` to allow CORS from:
- `https://sillobite.in`
- `https://ws.sillobite.in`
- Railway default domains (automatically allowed)
