# WebSocket Cloudflare Fix - Step by Step Guide

## Problem
WebSocket connections are failing in production because Cloudflare proxy interferes with WebSocket upgrade requests.

## Solution: Create Dedicated WebSocket Subdomain

### Step 1: Configure Cloudflare DNS

1. Go to your Cloudflare Dashboard
2. Select your domain: `sillobite.in`
3. Go to **DNS** → **Records**
4. Click **Add record**
5. Configure:
   - **Type**: `CNAME`
   - **Name**: `ws`
   - **Target**: `your-railway-app.up.railway.app` (get this from Railway dashboard)
   - **Proxy status**: Click the **orange cloud** to make it **gray** (DNS only)
   - **TTL**: Auto

**Critical**: The cloud MUST be gray (DNS only), not orange (proxied)!

### Step 2: Configure Railway Environment Variables

Add this environment variable in your Railway project:

```
VITE_WS_BASE_URL=wss://ws.sillobite.in
```

To add it:
1. Go to Railway Dashboard
2. Select your project
3. Go to **Variables** tab
4. Click **New Variable**
5. Add: `VITE_WS_BASE_URL` = `wss://ws.sillobite.in`
6. Click **Deploy** to restart with new variables

### Step 3: Update CLIENT_URL (Optional but Recommended)

Also set this in Railway if not already set:

```
CLIENT_URL=https://sillobite.in
```

### Step 4: Deploy Changes

The server code has been updated to allow CORS from:
- `https://sillobite.in` (your main domain)
- `https://ws.sillobite.in` (your WebSocket subdomain)

After adding the environment variables, Railway will automatically redeploy.

### Step 5: Verify

1. Wait for Railway deployment to complete (2-3 minutes)
2. Wait for DNS propagation (can take 5-15 minutes)
3. Test your app at `https://sillobite.in`
4. Check browser console - you should see:
   - `✅ Notification WebSocket connected`
   - No more "offline" status

## How to Get Your Railway Domain

1. Go to Railway Dashboard
2. Select your project
3. Go to **Settings** → **Domains**
4. Copy the domain that looks like: `yourapp-production-xxxx.up.railway.app`

## Troubleshooting

### DNS Not Resolving
Check DNS propagation: https://dnschecker.org/#CNAME/ws.sillobite.in

### Still Showing Offline
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Check Railway logs for WebSocket connection attempts
4. Verify environment variable is set correctly

### CORS Errors
Make sure `CLIENT_URL` environment variable is set to `https://sillobite.in`

## Why This Works

- **Main domain** (`sillobite.in`): Proxied through Cloudflare (orange cloud) - gets CDN, DDoS protection
- **WebSocket subdomain** (`ws.sillobite.in`): Direct to Railway (gray cloud) - bypasses Cloudflare proxy
- Your app connects to main domain for HTTP requests
- Your app connects to WebSocket subdomain for real-time updates

## Code Changes Made

Updated `server/websocket.ts` to allow CORS from both domains:
- `https://sillobite.in`
- `https://ws.sillobite.in`
