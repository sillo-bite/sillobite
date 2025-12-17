# Feature Inventory

This document provides a comprehensive inventory of all features implemented in the codebase. The analysis was conducted by systematically examining the entire codebase, including the frontend, backend, and shared modules.

## Core Features

### 1. User Authentication & Profile Management

| Feature | Description | Purpose | Dependencies |
| :--- | :--- | :--- | :--- |
| **Email/Password Login** | Users can register and log in using their email and a password. | Standard user authentication. | `bcrypt` for password hashing. |
| **Google OAuth 2.0** | Users can sign up or log in using their Google account. | Provides a convenient and secure alternative to traditional login. | `google-auth-library`. |
| **Profile Setup** | New users are guided through a profile setup process after registration. | To collect essential user information. | User model. |
| **Profile Management** | Users can view and edit their profile information. | Allows users to keep their information up-to-date. | User model. |
| **Blocked User Screen** | Displays a message to users whose accounts have been blocked. | To inform users of their account status. | User model with `isBlocked` field. |
| **Temporary Guest Sessions** | Creates temporary, time-limited sessions for guests, likely for QR code-based ordering. | Enables users to place orders without creating a full account. | `uuid`, `TempUserSession` model. |

### 2. Menu & Ordering

| Feature | Description | Purpose | Dependencies |
| :--- | :--- | :--- | :--- |
| **Menu Listing** | Displays a list of available food items, likely categorized. | Allows users to browse the menu. | `MenuItemCard`, `MenuListingPage`. |
| **Dish Details** | Shows detailed information about a specific dish, including description, price, and images. | To provide users with more information before ordering. | `DishDetailPage`. |
| **Shopping Cart** | Users can add and remove items from their cart before checkout. | The central part of the ordering process. | `CartPage`. |
| **Order Placement** | Users can place an order from the items in their cart. | To finalize the order. | `CheckoutPage`. |
| **Order History** | Users can view their past orders. | For tracking and reordering. | `OrdersPage`. |
| **Reordering** | Allows users to quickly reorder from a previous order. | To streamline the ordering process for repeat customers. | `ReorderPage`. |
| **Favorites** | Users can mark items as favorites for quick access. | To personalize the user experience. | `FavoritesPage`. |
| **Quick Picks** | A curated list of popular or recommended items. | To help users make quick decisions. | `ViewAllQuickPicksPage`. |

### 3. Payment & Checkout

| Feature | Description | Purpose | Dependencies |
| :--- | :--- | :--- | :--- |
| **Payment Methods** | Supports multiple payment methods, likely including PhonePe. | To provide flexibility to the user. | `PaymentMethodsPage`, PhonePe integration. |
| **Coupon Application** | Users can apply discount coupons to their orders. | To provide discounts and promotions. | `CouponApplicator`. |
| **Payment Callback** | Handles the callback from the payment gateway to confirm payment status. | To finalize the order after payment. | `PaymentCallbackPage`. |
| **Retry Payment** | Allows users to retry a failed payment. | To handle payment failures gracefully. | `RetryPaymentPage`. |

### 4. Real-time & Notifications

| Feature | Description | Purpose | Dependencies |
| :--- | :--- | :--- | :--- |
| **Web Push Notifications** | The system can send push notifications to users. | To keep users informed about order status, promotions, etc. | `web-push`, `webPushService`. |
| **Real-time Order Updates** | Likely uses WebSockets to provide real-time updates on order status. | To provide a better user experience. | `socket.io`. |
| **Notification Panel** | A dedicated panel to display notifications to the user. | To provide a centralized place for all notifications. | `NotificationPanel`. |

### 5. Miscellaneous

| Feature | Description | Purpose | Dependencies |
| :--- | :--- | :--- | :--- |
| **PWA Installation** | The application can be installed as a Progressive Web App (PWA). | To provide a native-like experience on mobile devices. | `manifest.json`, service worker. |
| **Dark/Light Theme** | Users can switch between dark and light themes. | To enhance user experience and accessibility. | `ThemeToggle`. |
| **Sitemap & SEO** | The application generates a sitemap and has basic SEO features. | To improve search engine visibility. | `sitemap.ts`, `SEOHead`. |
| **Feedback System** | Users can submit feedback. | To gather user opinions and improve the service. | `FeedbackPage`. |
| **Help & Support** | A dedicated page for users to get help and support. | To provide assistance to users. | `HelpSupportPage`. |

## Administrative Features

### 1. Super Admin Dashboard

| Feature | Description | Purpose | Dependencies |
| :--- | :--- | :--- | :--- |
| **Comprehensive Dashboard** | A centralized dashboard for super admins to manage the entire system. | To provide a single point of control. | `SuperAdminDashboard`. |
| **User Management** | Manage all users, including adding, editing, and blocking users. | To control user access and information. | `AdminUserManagementPage`. |
| **Restaurant Management** | Full CRUD operations for restaurants. | To manage the list of available restaurants. | `RestaurantManagementPage`. |
| **College & Organization Management** | A highly detailed system for managing colleges and organizations, including their departments and user registration formats. | To support a multi-tenant or multi-organization setup. | `AdminCollegeManagementPage`, `AdminOrganizationManagementPage`. |
| **System Settings** | Configure various system-level settings, including maintenance mode, notifications, and app versioning. | To control the overall behavior of the application. | `AdminSystemSettingsPage`. |
| **Database Management** | View database stats, run maintenance tasks, and create backups. | To ensure the health and performance of the database. | `AdminDatabasePage`. |
| **Analytics & Reports** | View analytics and generate reports on various aspects of the system. | To gain insights into the system's performance and usage. | `AdminAnalyticsPage`, `AdminReportsPage`. |

### 2. Canteen Owner Dashboard

| Feature | Description | Purpose | Dependencies |
| :--- | :--- | :--- | :--- |
| **Canteen-Specific Dashboard** | A dedicated dashboard for canteen owners to manage their own canteen. | To provide a focused view for canteen owners. | `CanteenOwnerDashboard`. |
| **Menu Management** | Manage the menu for a specific canteen. | To allow canteen owners to control their offerings. | `CanteenAdminMenuManagementReal`. |
| **Order Management** | View and manage orders for a specific canteen. | To process and fulfill orders. | `CanteenAdminOrdersManagementReal`. |
| **Inventory Management** | Manage the inventory of ingredients and supplies. | To track stock levels and prevent shortages. | `InventoryManagement`. |
| **Payment Management** | View and manage payments for a specific canteen. | To track revenue and financial performance. | `CanteenAdminPaymentManagement`. |
| **Counter Management** | Manage the different counters within a canteen. | To organize the order fulfillment process. | `CanteenAdminCounterManagement`. |

This inventory provides a high-level overview of the features implemented in your application. For more detailed information, you can refer to the specific files and components mentioned in the "Dependencies" column.