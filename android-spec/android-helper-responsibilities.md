# Android Helper App - Canteen Owner Dashboard

**Role**: Order Alert Companion  
**Platform**: Android Mobile Device  
**Target User**: Canteen Owners  
**Last Updated**: 2026-01-03

---

## What This App DOES

### 1. Alert You When New Orders Arrive

The app acts as your mobile alert system. When customers place orders:

- **Displays a notification** on your phone screen
- **Plays an alarm sound** that loops continuously until you acknowledge it
- **Shows the order count** - tells you how many urgent orders need attention
- **Works even when locked** - alerts you even if your phone screen is off

**Real-World Scenario**: You're in the kitchen preparing food, phone in your pocket. A customer places an order. Your phone vibrates, displays "1 critical order requires attention", and plays an alarm sound repeatedly. You pull out your phone and see the alert instantly.

### 2. Keep You Connected to Real-Time Order Updates

The app maintains a constant connection to your canteen's order system:

- **Receives instant updates** when order status changes
- **Syncs automatically** when you open the app
- **Reconnects itself** if internet drops temporarily
- **Joins your canteen's notification room** automatically

**Real-World Scenario**: You're away from your computer. A customer's order is ready for pickup. The app immediately notifies you so you can inform the counter staff.

### 3. Survive When Your Phone Is Busy

The app is designed to persist through normal phone usage:

- **Stays active when you switch apps** - checking WhatsApp won't stop alerts
- **Continues when screen is locked** - alerts work even when phone is sleeping
- **Restarts automatically** if Android kills it to save battery
- **Runs independently** - doesn't depend on keeping the app open on screen

**Real-World Scenario**: You're reading messages on WhatsApp. A new order comes in. The alarm plays even though the app isn't visible. You pull down the notification shade and see "2 critical orders require attention".

### 4. Provide Persistent Reminders

The app ensures you never miss critical orders:

- **Shows a permanent notification** while orders are pending
- **Keeps alarm playing** until you stop it manually
- **Updates the count** as new orders arrive or old ones are resolved
- **Dismisses automatically** when all critical orders are handled

**Real-World Scenario**: Three orders arrive within 2 minutes. The notification updates: "1 critical order" → "2 critical orders" → "3 critical orders". The alarm keeps playing. Once you process all three orders, the notification disappears and the alarm stops.

---

## What This App DOES NOT DO

### 1. ❌ Does NOT Replace Your Web Dashboard

The app is an **alert helper**, not a full management tool:

- **Cannot manage menus** - use the web dashboard to add/edit menu items
- **Cannot process payments** - handle payments through the web counter interface
- **Cannot view analytics** - revenue reports and charts are on the web dashboard
- **Cannot manage staff** - user management stays on the web dashboard
- **Cannot configure settings** - canteen settings must be changed on the web

**Why**: The app focuses solely on ensuring you never miss urgent orders. All business management stays on your computer's web dashboard.

### 2. ❌ Does NOT Process or Fulfill Orders

The app **notifies** but does not **execute**:

- **Cannot mark orders as ready** - counter staff use the web interface for this
- **Cannot assign delivery personnel** - done through the web dashboard
- **Cannot cancel orders** - cancellations happen on the web dashboard
- **Cannot communicate with customers** - customer communication is through other channels

**Why**: Order fulfillment requires full context (menu items, stock levels, counter assignments) which is better suited to the web dashboard's full-screen interface.

### 3. ❌ Does NOT Show Full Order Details

The app shows **alerts**, not **complete information**:

- **No customer names** shown in notifications - only order count
- **No item lists** displayed - what customer ordered stays on web dashboard
- **No order history** - past orders viewable only on web
- **No search functionality** - searching orders requires the web dashboard

**Why**: Notification space is limited. The app's job is to alert you immediately, then you use the web dashboard to see full details and take action.

### 4. ❌ Does NOT Work Offline

The app requires active internet connection:

- **No offline order queue** - orders received only when online
- **No cached order data** - doesn't store orders locally
- **No offline actions** - cannot process anything without internet
- **Reconnects automatically** when internet returns

**Why**: Real-time alerts depend on constant server connection. The app prioritizes instant notification over offline capability.

### 5. ❌ Does NOT Store Order Data

The app is **stateless** - it doesn't remember past orders:

- **No local database** - orders aren't saved on your phone
- **No order persistence** - closing the app clears notification state
- **No historical records** - order history lives on the server
- **Fetches fresh data** every time you open the app

**Why**: Your phone's storage is limited. All authoritative order data stays on the server, accessible through the web dashboard.

---

## Background Behavior Rules

### When the App Works in Background

The app **continues to receive alerts** in these situations:

✅ **Screen is locked** - notifications and alarm work normally  
✅ **App is not visible** - switched to another app (WhatsApp, browser, etc.)  
✅ **Phone is in pocket** - device doesn't need to be actively used  
✅ **During phone calls** - alerts may still arrive (alarm respects call audio)  
✅ **When phone is idle** - sitting unused on a counter or table  

### When the App Stops Working

The app **stops alerting** in these situations:

❌ **App is force-closed** - swiping away from recent apps kills the service  
❌ **Internet connection lost** - no connection means no alerts (reconnects automatically when back online)  
❌ **Battery saver mode** - aggressive power saving may kill background processes  
❌ **Manufacturer restrictions** - some phone brands (Xiaomi, Oppo, Vivo) aggressively kill background apps  
❌ **App permissions revoked** - removing notification permission stops alerts  

### Android System Behavior

**What happens when Android kills the app**:

- **Automatic restart** - Android restarts the app service within seconds (for critical alerts)
- **Re-establishes connection** - reconnects to order notification system automatically
- **Resumes monitoring** - starts listening for new orders again
- **No manual action needed** - happens silently in the background

**Battery optimization conflict**:

- Some phones optimize battery by killing background apps aggressively
- If your phone brand is Xiaomi, Oppo, Vivo, Realme, or similar, you may need to:
  - Add the app to battery whitelist
  - Disable battery optimization for this app
  - Allow "Autostart" permission
- The app will show instructions if it detects aggressive battery management

---

## Sound Behavior Rules

### When Sound Plays

The alarm **plays continuously** when:

- ✅ A new critical order arrives (status: `pending` or `preparing`)
- ✅ Multiple orders are pending (sound loops until acknowledged)
- ✅ App is running in background (alarm works even when not visible)
- ✅ Screen is locked (bypasses screen lock to alert you)

### When Sound Stops

The alarm **automatically stops** when:

- ✅ All critical orders are resolved (processed on web dashboard)
- ✅ You manually stop the foreground service (swipe notification and tap "Stop")
- ✅ App is force-closed (removed from recent apps)

### Sound Settings

**Volume**:
- Uses **notification volume** - controlled by your phone's notification volume slider
- Not affected by ringer volume or media volume
- Respects Do Not Disturb mode (may be silenced if DND is active)

**Sound file**:
- Default: System notification sound
- Custom: `order_alarm.mp3` (if placed in `res/raw/` folder)
- Fallback: If custom sound fails, uses system default

**Behavior during calls**:
- Alarm **pauses** during active phone calls
- Resumes after call ends
- Prevents interrupting customer/staff communication

**Loop behavior**:
- Sound repeats **continuously** every 3-5 seconds
- Does **not** stop automatically after X repetitions
- Only stops when all critical orders handled or service manually stopped

---

## Notification Behavior Rules

### What You See

**Persistent notification** while critical orders active:

```
🔔 New Order Received
1 critical order requires attention

[Tap to open app]
```

**Updates in real-time**:

```
🔔 New Order Received
3 critical orders require attention

[Tap to open app]
```

### Notification Characteristics

**Type**: Foreground Service Notification  
**Channel**: "Critical Order Alerts"  
**Priority**: HIGH  
**Dismissible**: No (swipe won't remove it - this is intentional)  
**Persistent**: Yes (stays until all orders handled)  
**Vibration**: Yes (200ms, 100ms pause, 200ms)  
**LED Light**: Yes (if your phone supports notification LED)  

### How Notifications Behave

**When app is in foreground** (visible on screen):
- Notification **still shows** in notification shade
- Alarm **still plays** (doesn't rely on app being visible)
- Tapping notification **brings app to front** (if backgrounded)

**When app is in background** (not visible):
- Notification **displays on lock screen** (Android 5.0+)
- Alarm **plays at full volume** (notification volume)
- Notification **cannot be dismissed** by swiping (prevents accidental dismissal)

**When multiple orders arrive**:
- **Single notification updates** count (doesn't spam multiple notifications)
- Shows: "X critical orders require attention"
- Alarm **continues looping** until all resolved

**When orders are handled**:
- Notification **disappears automatically**
- Alarm **stops playing**
- Service **shuts down** (no lingering processes)

### Notification Actions

**Tap notification**:
- Opens app to main screen
- Notification **remains visible** (until orders handled)
- Alarm **keeps playing**

**Swipe notification** (attempt to dismiss):
- **Does nothing** - notification persists
- This is intentional design to prevent missing critical orders

**Force stop app** (from recent apps):
- Notification **disappears**
- Alarm **stops**
- Service **terminated** (must reopen app to resume monitoring)

---

## Android Version Requirements

**Minimum Android Version**: Android 8.0 (API 26) - Oreo  
**Target Android Version**: Android 14 (API 34)  
**Notification Channels**: Required (Android 8.0+)  
**Foreground Service**: Required (Android 8.0+)  
**Runtime Permissions**: POST_NOTIFICATIONS (Android 13+)  

### Permission Requirements

**Must be granted**:
- ✅ **Notifications** (Android 13+) - Required to show order alerts
- ✅ **Internet Access** - Required to receive real-time updates

**Optional but recommended**:
- 🔔 **Battery Optimization Exemption** - Prevents system from killing the app
- 🔔 **Autostart** (manufacturer-specific) - Allows app to restart after phone reboot

---

## When to Use This App

### ✅ Use the App When:

- You need to **stay aware of incoming orders** while away from computer
- You're **multitasking** - managing kitchen, handling staff, serving customers
- You want **instant alerts** the moment orders arrive
- Your **computer is off** or not easily accessible
- You're **on the move** within the canteen premises

### ⚠️ Don't Rely on the App For:

- **Managing your entire canteen** - use the web dashboard
- **Processing payments** - use web counter interface
- **Updating menus** - use web dashboard menu management
- **Viewing detailed analytics** - use web dashboard analytics page
- **Training new staff** - web dashboard has full feature set

---

## Expected User Experience

### Normal Day Scenario

**Morning Setup (9:00 AM)**:
1. Open the app once on your Android phone
2. App connects to your canteen's order system
3. Put phone in pocket, continue your morning routine

**During Service (12:00 PM - 2:00 PM)**:
- Phone vibrates → Check notification → See "1 critical order requires attention"
- Alarm plays continuously → Open web dashboard on computer → Process order
- Alarm stops automatically once order handled
- Phone alerts you again when next order arrives

**Evening Shutdown (7:00 PM)**:
- Force close app (swipe from recent apps)
- Or just leave it running (uses minimal battery when no orders active)

### Edge Case Scenarios

**Internet drops temporarily**:
- App shows "Disconnected" status
- Reconnects automatically when WiFi/mobile data returns
- You may miss orders placed during disconnection (check web dashboard)

**Phone battery dies**:
- App stops working (obviously)
- Orders still visible on web dashboard
- Recharge phone and reopen app to resume monitoring

**App crashes or is killed by system**:
- Android restarts the service automatically
- Reconnects within seconds
- May show brief "Reconnecting..." status

**Multiple devices**:
- You can run the app on multiple phones (you + staff)
- All devices receive the same alerts
- Any device can be used to acknowledge orders (via web dashboard)

---

## Technical Limitations (Non-Technical Explanation)

### Why These Limitations Exist

**No offline queue**: Real-time alerts require constant internet connection. Without internet, the app cannot communicate with the server. This is like a radio - if you turn it off, you miss the broadcast.

**No order storage**: Your phone has limited storage. Storing thousands of past orders would slow down your device. The server (computer) is the single source of truth.

**No order fulfillment**: Fulfilling orders requires full context (inventory, counter assignments, payment status). Showing all this on a small phone screen would be cluttered and error-prone. The web dashboard's large screen is better suited for complex operations.

**Battery impact**: The app uses a persistent background service. This consumes battery to keep the connection alive. Modern Android optimizations minimize this impact, but some battery drain is unavoidable for instant alerts.

**Manufacturer restrictions**: Phone brands like Xiaomi, Oppo, Vivo are known for aggressively killing background apps to save battery. This is beyond the app's control. You may need to manually whitelist the app in battery settings.

---

## Summary

**This app is a dedicated alert system**:
- ✅ Alerts you instantly when orders arrive
- ✅ Works in background, even when screen is locked
- ✅ Plays alarm sound until orders are acknowledged
- ✅ Reconnects automatically if connection drops

**This app is NOT a full management tool**:
- ❌ Does not replace the web dashboard
- ❌ Does not process or fulfill orders
- ❌ Does not store order history
- ❌ Does not work offline

**Think of it like**:
- A **doorbell** for your canteen - alerts you when someone "rings" (places an order)
- A **pager** used in restaurants - notifies staff when orders are ready
- A **smoke alarm** - persistent, loud, and impossible to ignore until you address the issue

**Bottom line**: Open the app once in the morning, leave it running, and let it alert you when orders need attention. Do all actual order management on your web dashboard (computer).

---

**End of Document**
