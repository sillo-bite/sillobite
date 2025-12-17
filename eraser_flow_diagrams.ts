/**
 * KIT Dinez - Flow Diagrams for Eraser AI
 * 
 * This file contains code to generate comprehensive flow diagrams
 * using Eraser AI's diagram generation capabilities.
 * 
 * Usage: Copy and paste sections into Eraser AI to generate diagrams
 */

import { Diagram, Node, Edge, Group } from "@eraser/eraser";

// ============================================================================
// 1. APPLICATION ENTRY & AUTHENTICATION FLOW
// ============================================================================

export function applicationEntryFlow(): Diagram {
  return {
    title: "Application Entry & Authentication Flow",
    nodes: [
      { id: "start", label: "User Opens App", type: "start" },
      { id: "splash", label: "SplashScreen Component", type: "process" },
      { id: "checkPWA", label: "Check PWA Installation", type: "process" },
      { id: "loadSettings", label: "Load System Settings\n/api/system-settings/all-settings", type: "process" },
      { id: "checkAuth", label: "Check Authentication State\n(useAuth hook)", type: "process" },
      { id: "validateUser", label: "Validate User\n/api/users/{id}/validate", type: "process" },
      { id: "decision", label: "User Type Detection", type: "decision" },
      { id: "oldUser", label: "OLD USER\n(hasCachedUser)", type: "process" },
      { id: "checkRole", label: "Check User Role", type: "decision" },
      { id: "admin", label: "super_admin\n→ /admin", type: "end" },
      { id: "canteenOwner", label: "canteen_owner\n→ /app", type: "end" },
      { id: "regularUser", label: "regular user\n→ /app", type: "end" },
      { id: "newUser", label: "NEW USER\n→ /onboarding", type: "end" },
    ],
    edges: [
      { from: "start", to: "splash" },
      { from: "splash", to: "checkPWA" },
      { from: "checkPWA", to: "loadSettings" },
      { from: "loadSettings", to: "checkAuth" },
      { from: "checkAuth", to: "validateUser" },
      { from: "validateUser", to: "decision" },
      { from: "decision", to: "oldUser", label: "Has Cached User" },
      { from: "decision", to: "newUser", label: "No Cached User" },
      { from: "oldUser", to: "checkRole" },
      { from: "checkRole", to: "admin", label: "super_admin" },
      { from: "checkRole", to: "canteenOwner", label: "canteen_owner" },
      { from: "checkRole", to: "regularUser", label: "regular" },
    ],
  };
}

export function authenticationFlow(): Diagram {
  return {
    title: "Authentication Flow",
    nodes: [
      { id: "start", label: "/login route", type: "start" },
      { id: "loginScreen", label: "LoginScreen Component", type: "process" },
      { id: "checkOnboarding", label: "Check from onboarding", type: "decision" },
      { id: "redirectOnboarding", label: "Redirect to /onboarding", type: "process" },
      { id: "displayOptions", label: "Display Login Options", type: "process" },
      { id: "emailPassword", label: "Email/Password Auth", type: "process" },
      { id: "googleOAuth", label: "Google OAuth", type: "process" },
      { id: "qrScan", label: "QR Code Scan", type: "process" },
      { id: "validateEmail", label: "Validate Input\n/api/auth/login", type: "process" },
      { id: "checkUser", label: "Check User Exists\n/api/users/by-email", type: "process" },
      { id: "storeAuth", label: "Store Auth Token\nSave to localStorage", type: "process" },
      { id: "oauthCallback", label: "OAuth Callback\n/auth/callback", type: "process" },
      { id: "extractUser", label: "Extract User Info\nfrom Google", type: "process" },
      { id: "createUser", label: "Create User Account\n(if new)", type: "process" },
      { id: "checkQR", label: "Check Pending QR Data", type: "decision" },
      { id: "applyRestaurant", label: "Apply Restaurant Context", type: "process" },
      { id: "scanQR", label: "Scan QR Code", type: "process" },
      { id: "extractQR", label: "Extract Table/Restaurant Info", type: "process" },
      { id: "storeQR", label: "Store in sessionStorage", type: "process" },
      { id: "redirectApp", label: "Redirect to /app\nor /profile-setup", type: "end" },
    ],
    edges: [
      { from: "start", to: "loginScreen" },
      { from: "loginScreen", to: "checkOnboarding" },
      { from: "checkOnboarding", to: "redirectOnboarding", label: "Not from onboarding" },
      { from: "checkOnboarding", to: "displayOptions", label: "From onboarding" },
      { from: "displayOptions", to: "emailPassword" },
      { from: "displayOptions", to: "googleOAuth" },
      { from: "displayOptions", to: "qrScan" },
      { from: "emailPassword", to: "validateEmail" },
      { from: "validateEmail", to: "checkUser" },
      { from: "checkUser", to: "storeAuth" },
      { from: "storeAuth", to: "redirectApp" },
      { from: "googleOAuth", to: "oauthCallback" },
      { from: "oauthCallback", to: "extractUser" },
      { from: "extractUser", to: "checkUser" },
      { from: "checkUser", to: "createUser", label: "New User" },
      { from: "createUser", to: "checkQR" },
      { from: "checkUser", to: "checkQR", label: "Existing User" },
      { from: "checkQR", to: "applyRestaurant", label: "QR Data Exists" },
      { from: "applyRestaurant", to: "redirectApp" },
      { from: "checkQR", to: "redirectApp", label: "No QR Data" },
      { from: "qrScan", to: "scanQR" },
      { from: "scanQR", to: "extractQR" },
      { from: "extractQR", to: "storeQR" },
      { from: "storeQR", to: "redirectApp" },
    ],
  };
}

// ============================================================================
// 2. ORDER PLACEMENT FLOW
// ============================================================================

export function orderPlacementFlow(): Diagram {
  return {
    title: "Order Placement Flow",
    nodes: [
      { id: "start", label: "User Clicks\nProceed to Checkout", type: "start" },
      { id: "navigateCheckout", label: "Navigate to /checkout", type: "process" },
      { id: "validateCart", label: "Validate Cart", type: "decision" },
      { id: "redirectApp", label: "Redirect to /app", type: "end" },
      { id: "loadData", label: "Load Checkout Data", type: "process" },
      { id: "stockValidation", label: "Stock Validation\n/api/orders/validate-stock", type: "process" },
      { id: "calculateTotals", label: "Calculate Order Totals", type: "process" },
      { id: "applyCoupon", label: "Apply Coupon\n(optional)", type: "process" },
      { id: "selectPayment", label: "Select Payment Method", type: "decision" },
      { id: "onlinePayment", label: "Online Payment (UPI)", type: "process" },
      { id: "offlinePayment", label: "Offline Payment (Cash)", type: "process" },
      { id: "createOrder", label: "Create Order\nPOST /api/orders", type: "process" },
      { id: "initiatePayment", label: "Initiate Payment\n/api/payments/initiate", type: "process" },
      { id: "redirectGateway", label: "Redirect to\nPayment Gateway", type: "process" },
      { id: "userPays", label: "User Completes Payment", type: "process" },
      { id: "paymentCallback", label: "Payment Callback\n/payment-callback", type: "process" },
      { id: "verifyPayment", label: "Verify Payment\n/api/payments/verify", type: "process" },
      { id: "paymentSuccess", label: "Payment Success", type: "decision" },
      { id: "updateOrder", label: "Update Order Status\npending → pending", type: "process" },
      { id: "broadcastWS", label: "Broadcast WebSocket\npayment_confirmed", type: "process" },
      { id: "redirectStatus", label: "Redirect to\n/order-status/{orderNumber}", type: "end" },
      { id: "paymentFailed", label: "Payment Failed", type: "process" },
      { id: "redirectRetry", label: "Redirect to\n/retry-payment", type: "end" },
      { id: "createOfflineOrder", label: "Create Order\nStatus: pending", type: "process" },
      { id: "broadcastOffline", label: "Broadcast WebSocket\nnew_offline_order", type: "process" },
    ],
    edges: [
      { from: "start", to: "navigateCheckout" },
      { from: "navigateCheckout", to: "validateCart" },
      { from: "validateCart", to: "redirectApp", label: "Invalid" },
      { from: "validateCart", to: "loadData", label: "Valid" },
      { from: "loadData", to: "stockValidation" },
      { from: "stockValidation", to: "calculateTotals" },
      { from: "calculateTotals", to: "applyCoupon" },
      { from: "applyCoupon", to: "selectPayment" },
      { from: "selectPayment", to: "onlinePayment", label: "UPI" },
      { from: "selectPayment", to: "offlinePayment", label: "Cash" },
      { from: "onlinePayment", to: "createOrder" },
      { from: "createOrder", to: "initiatePayment" },
      { from: "initiatePayment", to: "redirectGateway" },
      { from: "redirectGateway", to: "userPays" },
      { from: "userPays", to: "paymentCallback" },
      { from: "paymentCallback", to: "verifyPayment" },
      { from: "verifyPayment", to: "paymentSuccess" },
      { from: "paymentSuccess", to: "updateOrder", label: "Success" },
      { from: "updateOrder", to: "broadcastWS" },
      { from: "broadcastWS", to: "redirectStatus" },
      { from: "paymentSuccess", to: "paymentFailed", label: "Failed" },
      { from: "paymentFailed", to: "redirectRetry" },
      { from: "offlinePayment", to: "createOfflineOrder" },
      { from: "createOfflineOrder", to: "broadcastOffline" },
      { from: "broadcastOffline", to: "redirectStatus" },
    ],
  };
}

// ============================================================================
// 3. ORDER STATUS UPDATE FLOW
// ============================================================================

export function orderStatusUpdateFlow(): Diagram {
  return {
    title: "Order Status Update Flow",
    nodes: [
      { id: "start", label: "Canteen Owner\nUpdates Order Status", type: "start" },
      { id: "counterInterface", label: "Counter Interface", type: "process" },
      { id: "clickAction", label: "Click Status Update\n(Accept/Ready/Complete)", type: "process" },
      { id: "apiCall", label: "POST /api/orders/{id}/update-status", type: "process" },
      { id: "validateRequest", label: "Validate Request", type: "decision" },
      { id: "updateDB", label: "Update Database", type: "process" },
      { id: "broadcastWS", label: "Broadcast WebSocket\norder_status_changed", type: "process" },
      { id: "canteenRoom", label: "Send to Canteen Room", type: "process" },
      { id: "counterRoom", label: "Send to Counter Room", type: "process" },
      { id: "pushNotification", label: "Send Push Notification", type: "process" },
      { id: "clientReceives", label: "Client Receives Update\n(useWebSocket Hook)", type: "process" },
      { id: "updateState", label: "Update React State", type: "process" },
      { id: "rerenderUI", label: "Re-render UI", type: "process" },
      { id: "showToast", label: "Show Status Update Toast", type: "end" },
      { id: "orderStatusPage", label: "OrderStatusPage\nUpdates Timeline", type: "end" },
      { id: "homeScreen", label: "HomeScreen\nUpdates Order Card", type: "end" },
      { id: "counterQueue", label: "Counter Interface\nUpdates Queue", type: "end" },
    ],
    edges: [
      { from: "start", to: "counterInterface" },
      { from: "counterInterface", to: "clickAction" },
      { from: "clickAction", to: "apiCall" },
      { from: "apiCall", to: "validateRequest" },
      { from: "validateRequest", to: "updateDB", label: "Valid" },
      { from: "updateDB", to: "broadcastWS" },
      { from: "broadcastWS", to: "canteenRoom" },
      { from: "broadcastWS", to: "counterRoom" },
      { from: "canteenRoom", to: "pushNotification" },
      { from: "counterRoom", to: "pushNotification" },
      { from: "pushNotification", to: "clientReceives" },
      { from: "clientReceives", to: "updateState" },
      { from: "updateState", to: "rerenderUI" },
      { from: "rerenderUI", to: "showToast" },
      { from: "rerenderUI", to: "orderStatusPage" },
      { from: "rerenderUI", to: "homeScreen" },
      { from: "rerenderUI", to: "counterQueue" },
    ],
  };
}

// ============================================================================
// 4. WEBSOCKET REAL-TIME UPDATE FLOW
// ============================================================================

export function websocketFlow(): Diagram {
  return {
    title: "WebSocket Real-time Update Flow",
    nodes: [
      { id: "start", label: "WebSocket Connection\nEstablished", type: "start" },
      { id: "joinCanteen", label: "Client Joins\nCanteen Room", type: "process" },
      { id: "socketEvent", label: "Socket Event:\njoinCanteenRooms", type: "process" },
      { id: "serverAdds", label: "Server Adds Socket\nto Room", type: "process" },
      { id: "serverConfirms", label: "Server Confirms:\nroomJoined", type: "process" },
      { id: "orderUpdate", label: "Order Status Update\nOccurs (Backend)", type: "process" },
      { id: "serverBroadcasts", label: "Server Broadcasts\nto Room", type: "process" },
      { id: "eventOrderUpdate", label: "Event: orderUpdate\nType: order_status_changed", type: "process" },
      { id: "clientReceives", label: "Client Receives Update", type: "process" },
      { id: "useWebSocket", label: "useWebSocket Hook\nProcesses Event", type: "process" },
      { id: "callback", label: "Calls onOrderStatusChange\nCallback", type: "process" },
      { id: "updateState", label: "Updates React State", type: "process" },
      { id: "triggerRerender", label: "Triggers UI Re-render", type: "process" },
      { id: "showNotification", label: "Shows Notification Toast", type: "end" },
      { id: "autoReconnect", label: "Auto-reconnect\non Disconnect", type: "process" },
      { id: "rejoinRooms", label: "Rejoin Rooms\non Reconnect", type: "process" },
      { id: "cleanup", label: "Cleanup on\nComponent Unmount", type: "end" },
    ],
    edges: [
      { from: "start", to: "joinCanteen" },
      { from: "joinCanteen", to: "socketEvent" },
      { from: "socketEvent", to: "serverAdds" },
      { from: "serverAdds", to: "serverConfirms" },
      { from: "serverConfirms", to: "orderUpdate" },
      { from: "orderUpdate", to: "serverBroadcasts" },
      { from: "serverBroadcasts", to: "eventOrderUpdate" },
      { from: "eventOrderUpdate", to: "clientReceives" },
      { from: "clientReceives", to: "useWebSocket" },
      { from: "useWebSocket", to: "callback" },
      { from: "callback", to: "updateState" },
      { from: "updateState", to: "triggerRerender" },
      { from: "triggerRerender", to: "showNotification" },
      { from: "triggerRerender", to: "autoReconnect" },
      { from: "autoReconnect", to: "rejoinRooms" },
      { from: "rejoinRooms", to: "cleanup" },
    ],
  };
}

// ============================================================================
// 5. CANTEEN OWNER WORKFLOW
// ============================================================================

export function canteenOwnerWorkflow(): Diagram {
  return {
    title: "Canteen Owner Workflow",
    nodes: [
      { id: "start", label: "Canteen Owner\nLogs In", type: "start" },
      { id: "roleCheck", label: "Role Check:\ncanteen_owner", type: "decision" },
      { id: "redirectDashboard", label: "Redirect to\n/canteen-owner-dashboard", type: "process" },
      { id: "loadCanteen", label: "Load Canteen Information\n/api/canteens/{canteenId}", type: "process" },
      { id: "loadStats", label: "Load Dashboard Statistics", type: "process" },
      { id: "displayCounters", label: "Display Counter Selection", type: "process" },
      { id: "selectCounter", label: "User Selects Counter", type: "process" },
      { id: "navigateCounter", label: "Navigate to\n/counter/{counterId}", type: "process" },
      { id: "loadCounter", label: "Load Counter Information\n/api/counters/{counterId}", type: "process" },
      { id: "initWS", label: "Initialize WebSocket\nConnection", type: "process" },
      { id: "joinCounterRoom", label: "Join Counter Room", type: "process" },
      { id: "loadOrders", label: "Load Orders for Counter\n/api/orders/counter/{id}/active", type: "process" },
      { id: "displayQueue", label: "Display Order Queue", type: "process" },
      { id: "newOrder", label: "New Order Arrives\n(WebSocket)", type: "process" },
      { id: "addToQueue", label: "Add to Queue", type: "process" },
      { id: "showNotification", label: "Show Notification", type: "end" },
      { id: "reviewOrder", label: "Review Order", type: "process" },
      { id: "acceptReject", label: "Accept or Reject", type: "decision" },
      { id: "acceptOrder", label: "Accept Order\nStatus: preparing", type: "process" },
      { id: "rejectOrder", label: "Reject Order\nStatus: cancelled", type: "process" },
      { id: "prepareOrder", label: "Prepare Order", type: "process" },
      { id: "markReady", label: "Mark Ready\nStatus: ready", type: "process" },
      { id: "completeOrder", label: "Complete Order\nStatus: delivered", type: "process" },
    ],
    edges: [
      { from: "start", to: "roleCheck" },
      { from: "roleCheck", to: "redirectDashboard", label: "canteen_owner" },
      { from: "redirectDashboard", to: "loadCanteen" },
      { from: "loadCanteen", to: "loadStats" },
      { from: "loadStats", to: "displayCounters" },
      { from: "displayCounters", to: "selectCounter" },
      { from: "selectCounter", to: "navigateCounter" },
      { from: "navigateCounter", to: "loadCounter" },
      { from: "loadCounter", to: "initWS" },
      { from: "initWS", to: "joinCounterRoom" },
      { from: "joinCounterRoom", to: "loadOrders" },
      { from: "loadOrders", to: "displayQueue" },
      { from: "displayQueue", to: "newOrder" },
      { from: "newOrder", to: "addToQueue" },
      { from: "addToQueue", to: "showNotification" },
      { from: "displayQueue", to: "reviewOrder" },
      { from: "reviewOrder", to: "acceptReject" },
      { from: "acceptReject", to: "acceptOrder", label: "Accept" },
      { from: "acceptReject", to: "rejectOrder", label: "Reject" },
      { from: "acceptOrder", to: "prepareOrder" },
      { from: "prepareOrder", to: "markReady" },
      { from: "markReady", to: "completeOrder" },
    ],
  };
}

// ============================================================================
// 6. COMPLETE ORDER LIFECYCLE
// ============================================================================

export function orderLifecycleFlow(): Diagram {
  return {
    title: "Complete Order Lifecycle",
    nodes: [
      { id: "start", label: "User Places Order", type: "start" },
      { id: "orderCreated", label: "Order Created\nStatus: pending_payment\nor pending", type: "process" },
      { id: "savedDB", label: "Order Saved\nto Database", type: "process" },
      { id: "broadcastNew", label: "WebSocket:\nnew_order broadcast", type: "process" },
      { id: "paymentMethod", label: "Payment Method?", type: "decision" },
      { id: "onlinePayment", label: "Online Payment", type: "process" },
      { id: "redirectGateway", label: "Redirect to\nPayment Gateway", type: "process" },
      { id: "paymentSuccess", label: "Payment Success?", type: "decision" },
      { id: "updatePending", label: "Status: pending\nPayment: paid", type: "process" },
      { id: "broadcastPayment", label: "WebSocket:\npayment_confirmed", type: "process" },
      { id: "paymentFailed", label: "Payment Failed\nStatus: pending_payment", type: "process" },
      { id: "redirectRetry", label: "Redirect to\n/retry-payment", type: "end" },
      { id: "offlinePayment", label: "Offline Payment\nStatus: pending", type: "process" },
      { id: "ownerReviews", label: "Canteen Owner\nReviews Order", type: "process" },
      { id: "acceptReject", label: "Accept or Reject?", type: "decision" },
      { id: "accept", label: "Accept Order\nStatus: preparing", type: "process" },
      { id: "reject", label: "Reject Order\nStatus: cancelled", type: "process" },
      { id: "refund", label: "Refund Payment\n(if paid)", type: "process" },
      { id: "preparing", label: "Order Preparation\nStatus: preparing", type: "process" },
      { id: "ready", label: "Order Ready\nStatus: ready", type: "process" },
      { id: "pushReady", label: "Push Notification\nto User", type: "process" },
      { id: "delivered", label: "Order Delivered\nStatus: delivered", type: "process" },
      { id: "pushDelivered", label: "Push Notification\nto User", type: "process" },
      { id: "completed", label: "Order Completed\nStatus: completed", type: "process" },
      { id: "updateStats", label: "Update Statistics", type: "process" },
      { id: "promptReview", label: "Prompt for Review", type: "process" },
      { id: "archived", label: "Order Archived", type: "end" },
    ],
    edges: [
      { from: "start", to: "orderCreated" },
      { from: "orderCreated", to: "savedDB" },
      { from: "savedDB", to: "broadcastNew" },
      { from: "broadcastNew", to: "paymentMethod" },
      { from: "paymentMethod", to: "onlinePayment", label: "Online" },
      { from: "paymentMethod", to: "offlinePayment", label: "Offline" },
      { from: "onlinePayment", to: "redirectGateway" },
      { from: "redirectGateway", to: "paymentSuccess" },
      { from: "paymentSuccess", to: "updatePending", label: "Success" },
      { from: "updatePending", to: "broadcastPayment" },
      { from: "broadcastPayment", to: "ownerReviews" },
      { from: "paymentSuccess", to: "paymentFailed", label: "Failed" },
      { from: "paymentFailed", to: "redirectRetry" },
      { from: "offlinePayment", to: "ownerReviews" },
      { from: "ownerReviews", to: "acceptReject" },
      { from: "acceptReject", to: "accept", label: "Accept" },
      { from: "acceptReject", to: "reject", label: "Reject" },
      { from: "reject", to: "refund" },
      { from: "refund", to: "archived" },
      { from: "accept", to: "preparing" },
      { from: "preparing", to: "ready" },
      { from: "ready", to: "pushReady" },
      { from: "pushReady", to: "delivered" },
      { from: "delivered", to: "pushDelivered" },
      { from: "pushDelivered", to: "completed" },
      { from: "completed", to: "updateStats" },
      { from: "updateStats", to: "promptReview" },
      { from: "promptReview", to: "archived" },
    ],
  };
}

// ============================================================================
// 7. FEATURE INTERCONNECTION MAP
// ============================================================================

export function featureInterconnectionMap(): Diagram {
  return {
    title: "Feature Interconnection Map",
    nodes: [
      { id: "auth", label: "AUTH", type: "process" },
      { id: "canteen", label: "CANTEEN\nSELECT", type: "process" },
      { id: "menu", label: "MENU", type: "process" },
      { id: "cart", label: "CART", type: "process" },
      { id: "checkout", label: "CHECKOUT", type: "process" },
      { id: "payment", label: "PAYMENT", type: "process" },
      { id: "order", label: "ORDER", type: "process" },
      { id: "coupon", label: "COUPON", type: "process" },
      { id: "websocket", label: "WEBSOCKET", type: "process" },
      { id: "notify", label: "NOTIFY", type: "process" },
      { id: "status", label: "STATUS\nTRACK", type: "process" },
      { id: "counter", label: "COUNTER\nINTERFACE", type: "process" },
      { id: "admin", label: "ADMIN\nPANEL", type: "process" },
    ],
    edges: [
      { from: "auth", to: "canteen" },
      { from: "canteen", to: "menu" },
      { from: "menu", to: "cart" },
      { from: "cart", to: "checkout" },
      { from: "checkout", to: "payment" },
      { from: "checkout", to: "coupon" },
      { from: "coupon", to: "order" },
      { from: "payment", to: "order" },
      { from: "order", to: "websocket" },
      { from: "websocket", to: "notify" },
      { from: "websocket", to: "status" },
      { from: "websocket", to: "counter" },
      { from: "order", to: "notify" },
      { from: "order", to: "status" },
      { from: "order", to: "counter" },
      { from: "admin", to: "auth" },
      { from: "admin", to: "canteen" },
      { from: "admin", to: "menu" },
      { from: "admin", to: "order" },
      { from: "admin", to: "payment" },
      { from: "admin", to: "notify" },
      { from: "admin", to: "coupon" },
    ],
  };
}

// ============================================================================
// 8. SYSTEM ARCHITECTURE LAYERS
// ============================================================================

export function systemArchitectureLayers(): Diagram {
  return {
    title: "System Architecture Layers",
    nodes: [
      { id: "ui", label: "USER INTERFACE LAYER\n(React Components, Pages,\nNavigation, UI Components)", type: "process" },
      { id: "state", label: "STATE MANAGEMENT LAYER\n(Context API, React Query,\nLocal Storage, State Hooks)", type: "process" },
      { id: "api", label: "API COMMUNICATION LAYER\n(API Requests, WebSocket,\nFetch, Query Client)", type: "process" },
      { id: "backend", label: "BACKEND API LAYER\n(Express Routes, Middleware,\nValidation, Business Logic)", type: "process" },
      { id: "db", label: "DATABASE LAYER\n(PostgreSQL, MongoDB)", type: "process" },
      { id: "ws", label: "WEBSOCKET SERVER\n(Socket.IO, Room Mgmt,\nBroadcasting)", type: "process" },
      { id: "external", label: "EXTERNAL SERVICES\n(PhonePe, Google OAuth,\nPush API)", type: "process" },
    ],
    edges: [
      { from: "ui", to: "state" },
      { from: "state", to: "api" },
      { from: "api", to: "backend" },
      { from: "backend", to: "db" },
      { from: "backend", to: "ws" },
      { from: "backend", to: "external" },
    ],
  };
}

// ============================================================================
// 9. MENU TO CART TO ORDER FLOW
// ============================================================================

export function menuToCartToOrderFlow(): Diagram {
  return {
    title: "Menu to Cart to Order Flow",
    nodes: [
      { id: "start", label: "User Views Menu Items", type: "start" },
      { id: "homeScreen", label: "Home Screen\n(Featured Items)", type: "process" },
      { id: "menuTab", label: "Menu Tab\n(Full Menu)", type: "process" },
      { id: "searchResults", label: "Search Results", type: "process" },
      { id: "clickItem", label: "User Clicks Item", type: "process" },
      { id: "dishDetail", label: "Navigate to\nDish Detail Page", type: "process" },
      { id: "viewDetails", label: "View Full Details", type: "process" },
      { id: "selectCustom", label: "Select Customizations", type: "process" },
      { id: "adjustQty", label: "Adjust Quantity", type: "process" },
      { id: "addToCart", label: "Click Add to Cart", type: "process" },
      { id: "validateCanteen", label: "Validate Canteen Match", type: "decision" },
      { id: "addCartContext", label: "Add to CartContext", type: "process" },
      { id: "updateBadge", label: "Update Cart Badge", type: "process" },
      { id: "viewCart", label: "User Views Cart", type: "process" },
      { id: "reviewItems", label: "Review Items", type: "process" },
      { id: "adjustQuantities", label: "Adjust Quantities", type: "process" },
      { id: "removeItems", label: "Remove Items", type: "process" },
      { id: "applyCoupon", label: "Apply Coupon\n(optional)", type: "process" },
      { id: "proceedCheckout", label: "Proceed to Checkout", type: "process" },
      { id: "validateCart", label: "Validate Cart", type: "process" },
      { id: "stockCheck", label: "Stock Check", type: "process" },
      { id: "selectPayment", label: "Select Payment Method", type: "process" },
      { id: "placeOrder", label: "Place Order", type: "process" },
      { id: "createOrder", label: "Create Order", type: "process" },
      { id: "payment", label: "Payment", type: "process" },
      { id: "tracking", label: "Tracking", type: "end" },
    ],
    edges: [
      { from: "start", to: "homeScreen" },
      { from: "start", to: "menuTab" },
      { from: "start", to: "searchResults" },
      { from: "homeScreen", to: "clickItem" },
      { from: "menuTab", to: "clickItem" },
      { from: "searchResults", to: "clickItem" },
      { from: "clickItem", to: "dishDetail" },
      { from: "dishDetail", to: "viewDetails" },
      { from: "viewDetails", to: "selectCustom" },
      { from: "selectCustom", to: "adjustQty" },
      { from: "adjustQty", to: "addToCart" },
      { from: "addToCart", to: "validateCanteen" },
      { from: "validateCanteen", to: "addCartContext", label: "Match" },
      { from: "addCartContext", to: "updateBadge" },
      { from: "updateBadge", to: "viewCart" },
      { from: "viewCart", to: "reviewItems" },
      { from: "reviewItems", to: "adjustQuantities" },
      { from: "adjustQuantities", to: "removeItems" },
      { from: "removeItems", to: "applyCoupon" },
      { from: "applyCoupon", to: "proceedCheckout" },
      { from: "proceedCheckout", to: "validateCart" },
      { from: "validateCart", to: "stockCheck" },
      { from: "stockCheck", to: "selectPayment" },
      { from: "selectPayment", to: "placeOrder" },
      { from: "placeOrder", to: "createOrder" },
      { from: "createOrder", to: "payment" },
      { from: "payment", to: "tracking" },
    ],
  };
}

// ============================================================================
// 10. PAYMENT FLOW DETAILS
// ============================================================================

export function paymentFlowDetails(): Diagram {
  return {
    title: "Payment Flow Details",
    nodes: [
      { id: "start", label: "User Initiates\nOnline Payment", type: "start" },
      { id: "createOrder", label: "Create Order\nStatus: pending_payment", type: "process" },
      { id: "initiatePayment", label: "Call /api/payments/initiate", type: "process" },
      { id: "generateRequest", label: "Generate Payment Request", type: "process" },
      { id: "createTransaction", label: "Create PhonePe Transaction", type: "process" },
      { id: "generateURL", label: "Generate Payment URL", type: "process" },
      { id: "storeTransaction", label: "Store Transaction ID", type: "process" },
      { id: "returnURL", label: "Return Payment URL", type: "process" },
      { id: "redirectPhonePe", label: "Redirect User\nto PhonePe", type: "process" },
      { id: "userCompletes", label: "User Completes Payment", type: "process" },
      { id: "enterUPI", label: "Enter UPI ID", type: "process" },
      { id: "authorize", label: "Authorize Payment", type: "process" },
      { id: "paymentProcessed", label: "Payment Processed", type: "process" },
      { id: "phonePeRedirects", label: "PhonePe Redirects\nto Callback URL", type: "process" },
      { id: "callbackURL", label: "/payment-callback\n?transactionId={id}\n&status={status}", type: "process" },
      { id: "callbackHandler", label: "Payment Callback Handler", type: "process" },
      { id: "extractTransaction", label: "Extract Transaction ID", type: "process" },
      { id: "verifyPayment", label: "Call /api/payments/verify", type: "process" },
      { id: "verifyPhonePe", label: "Verify with PhonePe API", type: "process" },
      { id: "checkStatus", label: "Check Transaction Status", type: "process" },
      { id: "validateAmount", label: "Validate Amount", type: "process" },
      { id: "paymentStatus", label: "Payment Status?", type: "decision" },
      { id: "paymentSuccess", label: "PAYMENT SUCCESS", type: "process" },
      { id: "updatePending", label: "Update Order Status:\npending", type: "process" },
      { id: "updatePaid", label: "Update Payment Status:\npaid", type: "process" },
      { id: "updatePaymentRecord", label: "Update Payment Record", type: "process" },
      { id: "broadcastWS", label: "Broadcast WebSocket Event", type: "process" },
      { id: "paymentConfirmed", label: "payment_confirmed\nto canteen room", type: "process" },
      { id: "newOrder", label: "new_order\nto counter rooms", type: "process" },
      { id: "pushNotification", label: "Send Push Notification", type: "process" },
      { id: "redirectStatus", label: "Redirect to\n/order-status/{orderNumber}", type: "end" },
      { id: "paymentFailure", label: "PAYMENT FAILURE", type: "process" },
      { id: "keepPending", label: "Keep Order Status:\npending_payment", type: "process" },
      { id: "logFailure", label: "Log Payment Failure", type: "process" },
      { id: "showError", label: "Show Error Message", type: "process" },
      { id: "redirectRetry", label: "Redirect to\n/retry-payment", type: "end" },
    ],
    edges: [
      { from: "start", to: "createOrder" },
      { from: "createOrder", to: "initiatePayment" },
      { from: "initiatePayment", to: "generateRequest" },
      { from: "generateRequest", to: "createTransaction" },
      { from: "createTransaction", to: "generateURL" },
      { from: "generateURL", to: "storeTransaction" },
      { from: "storeTransaction", to: "returnURL" },
      { from: "returnURL", to: "redirectPhonePe" },
      { from: "redirectPhonePe", to: "userCompletes" },
      { from: "userCompletes", to: "enterUPI" },
      { from: "enterUPI", to: "authorize" },
      { from: "authorize", to: "paymentProcessed" },
      { from: "paymentProcessed", to: "phonePeRedirects" },
      { from: "phonePeRedirects", to: "callbackURL" },
      { from: "callbackURL", to: "callbackHandler" },
      { from: "callbackHandler", to: "extractTransaction" },
      { from: "extractTransaction", to: "verifyPayment" },
      { from: "verifyPayment", to: "verifyPhonePe" },
      { from: "verifyPhonePe", to: "checkStatus" },
      { from: "checkStatus", to: "validateAmount" },
      { from: "validateAmount", to: "paymentStatus" },
      { from: "paymentStatus", to: "paymentSuccess", label: "Success" },
      { from: "paymentSuccess", to: "updatePending" },
      { from: "updatePending", to: "updatePaid" },
      { from: "updatePaid", to: "updatePaymentRecord" },
      { from: "updatePaymentRecord", to: "broadcastWS" },
      { from: "broadcastWS", to: "paymentConfirmed" },
      { from: "broadcastWS", to: "newOrder" },
      { from: "paymentConfirmed", to: "pushNotification" },
      { from: "newOrder", to: "pushNotification" },
      { from: "pushNotification", to: "redirectStatus" },
      { from: "paymentStatus", to: "paymentFailure", label: "Failure" },
      { from: "paymentFailure", to: "keepPending" },
      { from: "keepPending", to: "logFailure" },
      { from: "logFailure", to: "showError" },
      { from: "showError", to: "redirectRetry" },
    ],
  };
}

// ============================================================================
// MAIN EXPORT - All Diagrams
// ============================================================================

export const allFlowDiagrams = {
  applicationEntryFlow,
  authenticationFlow,
  orderPlacementFlow,
  orderStatusUpdateFlow,
  websocketFlow,
  canteenOwnerWorkflow,
  orderLifecycleFlow,
  featureInterconnectionMap,
  systemArchitectureLayers,
  menuToCartToOrderFlow,
  paymentFlowDetails,
};

/**
 * Usage Instructions:
 * 
 * 1. Open Eraser AI (https://eraser.io)
 * 2. Create a new document
 * 3. Copy and paste individual diagram functions or import this file
 * 4. Call the functions to generate diagrams
 * 
 * Example:
 * ```typescript
 * import { applicationEntryFlow } from './eraser_flow_diagrams';
 * 
 * const diagram = applicationEntryFlow();
 * // Diagram will be rendered in Eraser AI
 * ```
 * 
 * Or use the allFlowDiagrams object to access all diagrams:
 * ```typescript
 * import { allFlowDiagrams } from './eraser_flow_diagrams';
 * 
 * const entryFlow = allFlowDiagrams.applicationEntryFlow();
 * const authFlow = allFlowDiagrams.authenticationFlow();
 * // etc.
 * ```
 */







