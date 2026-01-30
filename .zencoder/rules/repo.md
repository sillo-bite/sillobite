---
description: Repository Information Overview
alwaysApply: true
---

# SilloBite Canteen - Repository Information

## Repository Summary

**SilloBite Canteen** is a full-stack college canteen food ordering platform with a monorepo architecture. It consists of a React web frontend, Express.js backend, Android mobile app wrapper (via Capacitor), and shared utilities. The system supports real-time order tracking, payment processing (Razorpay), role-based access control (students, staff, employees, guests), and multi-canteen management.

## Repository Structure

- **client/** - React 18 frontend application with Vite build tooling
- **server/** - Express.js backend API server with WebSocket support
- **shared/** - Shared TypeScript utilities, types, and payment integrations
- **android/** - Capacitor/Gradle Android app wrapper
- **prisma/** - Prisma ORM schema (PostgreSQL migrations)
- **scripts/** - Build optimization and production startup scripts

## Main Repository Components

- **Web Application**: React + TypeScript frontend with real-time features (Socket.IO, WebPush notifications)
- **API Server**: Express.js Node.js server with RESTful and WebSocket APIs
- **Mobile App**: Capacitor-wrapped Android application using the same web codebase
- **Database Layer**: PostgreSQL (Prisma) + MongoDB (Mongoose) hybrid architecture
- **Authentication**: Google OAuth 2.0, email/password with bcrypt hashing
- **Payment Integration**: Razorpay payment gateway with session management
- **File Storage**: Cloudinary integration for image uploads
- **Real-time Features**: Socket.IO for live order updates, WebPush notifications

## Projects

### Web Application (Full-Stack)

**Technology Stack**: TypeScript, React 18, Express.js, Node.js  
**Entry Points**: `client/src/main.tsx` (frontend), `server/index.ts` (backend)

#### Language & Runtime

**Language**: TypeScript 5.6.3  
**Node.js Version**: 20.16.11  
**Module System**: ESNext (ES Modules)  
**Build Tool**: Vite 5.4.14 + esbuild 0.25.0

#### Dependencies - Core Frameworks

**Frontend Frameworks**:
- react@18.3.1, react-dom@18.3.1
- @vitejs/plugin-react@4.3.2
- wouter@3.3.5 (lightweight router)
- @tanstack/react-query@5.60.5 (data fetching)

**Backend Frameworks**:
- express@4.21.2
- typescript@5.6.3

**UI Components & Styling**:
- @radix-ui/* (full component library)
- tailwindcss@3.4.17, tailwind-merge@2.6.0
- lucide-react@0.453.0 (icons)
- sonner@2.0.6 (notifications)
- framer-motion@11.18.2 (animations)

**Database & ORM**:
- @prisma/client@6.16.2 (PostgreSQL)
- mongoose@8.16.0 (MongoDB)
- mongodb@6.18.0

**Real-Time & WebSocket**:
- socket.io@4.8.1, socket.io-client@4.8.1
- ws@8.18.0

**Authentication & Security**:
- google-auth-library@10.3.0
- bcrypt@6.0.0
- express-session@1.18.1

**Payment & Business Logic**:
- razorpay@2.9.6
- cloudinary@2.7.0
- qrcode@1.5.4, jsbarcode@3.12.1
- receiptline@3.0.0

**State & Validation**:
- react-hook-form@7.55.0
- @hookform/resolvers@3.10.0
- zod@3.24.2, zod-validation-error@3.4.0

**Other Key Dependencies**:
- axios@1.11.0 (HTTP client)
- date-fns@3.6.0 (date utilities)
- sharp@0.34.4 (image processing)
- bullmq@5.65.0 (job queue)
- ioredis@5.8.2, redis@4.7.1 (caching/queue)
- firebase@12.0.0 (optional features)
- web-push@3.6.7 (PWA notifications)
- uuid@13.0.0, dotenv@17.2.1

**Build & Development**:
- esbuild@0.25.0, tsx@4.20.4
- autoprefixer@10.4.20, postcss@8.4.47
- @types/* (TypeScript definitions)
- cross-env@7.0.3 (environment management)

#### Build & Installation

```bash
npm install

npm run dev                 # Development with HMR on port 5000

npm run build              # Build frontend + bundle backend

npm run check              # TypeScript type checking

npm run optimize:production # Production optimization

npm run build:production   # Full production build

npm run start              # Run production server
```

**Database Migrations**:
```bash
npm run db:push            # Push Prisma schema to PostgreSQL
```

**Mobile Build**:
```bash
npm run build:mobile       # Build web assets for Capacitor

npm run cap:sync           # Sync native projects

npm run cap:run:android    # Build and open in Android
```

#### Configuration Files

- `tsconfig.json` - TypeScript compiler configuration (strict mode enabled)
- `vite.config.ts` - Vite build config with manual chunk splitting for performance
- `tailwind.config.ts` - Tailwind CSS theming system with custom animations
- `capacitor.config.ts` - Capacitor native app configuration
- `.env` - Environment variables (database URLs, API keys, payment credentials)

#### Prisma Schema

**PostgreSQL** (via Prisma):
- `User` model - Authentication, role-based access (student/staff/employee/guest)
- `DeliveryPerson` model - Delivery personnel management

**MongoDB** (via Mongoose):
- All other business models (orders, menus, canteens, etc.)

#### Port Configuration

**Development**: 5000 (both API and frontend proxy via Vite)  
**Production**: 5000 (single unified port)

#### Key Services

- `server/websocket.ts` - Real-time order updates via Socket.IO
- `server/checkout-session-service.ts` - Payment session management
- `server/delivery-assignment-service.ts` - Delivery route optimization
- `server/stock-service.ts` - Inventory management
- `server/services/printAgentService.ts` - Print agent WebSocket service
- `server/services/sessionCleanupService.ts` - Session lifecycle management

---

### Android Mobile App

**Type**: Native Android application (Capacitor wrapper)

#### Language & Runtime

**Language**: Java/Kotlin (Android native layer)  
**Build System**: Gradle 8.0.0  
**Min SDK**: Configured in variables.gradle  
**Target SDK**: Latest stable Android

#### Build Configuration

**Main Build Files**:
- `android/build.gradle` - Top-level Gradle configuration
- `android/app/build.gradle` - App module configuration
- `android/gradle.properties` - Gradle properties (JVM args: -Xmx1536m)
- `android/variables.gradle` - Version variables

**Application ID**: `com.sillobite.canteen`  
**Namespace**: `com.sillobite.canteen`

#### Key Dependencies

**Core**:
- Capacitor 5.7.8 with plugins (core, app, network, keyboard, status-bar)
- Capacitor Barcode Scanner 4.0.1
- Capacitor Splash Screen with custom branding

**Testing**:
- JUnit 4
- AndroidX Test (androidx.test.espresso)

#### Build & Deployment

```bash
npm run cap:init           # Initialize Capacitor

npm run cap:open:android   # Open Android Studio project

npm run cap:run:android    # Build and deploy to emulator/device
```

**Build Process**:
1. `npm run build:mobile` - Build web assets to dist/public
2. `npm run cap:sync` - Sync web assets to Android webDir
3. `cap open android` - Open in Android Studio for signing and release build

#### Capacitor Configuration

**WebDir**: `dist/public`  
**AppID**: `com.sillobite.canteen`  
**AppName**: SilloBite Canteen  

**Splash Screen**: 2000ms display, purple theme (#6d47ff), centered crop  
**Status Bar**: Light style with purple background (#6d47ff)  
**Development Note**: Android emulator uses `http://10.0.2.2:5000` to access host machine

---

## Database Architecture

**Hybrid Approach**:
- **PostgreSQL** (via Prisma) - User authentication, delivery personnel records
- **MongoDB** (via Mongoose) - Orders, menus, canteens, inventory, payments, sessions

**Connection Details**:
- PostgreSQL: Neon serverless database (production URL in .env)
- MongoDB: Atlas cloud deployment (production credentials in .env)

**Key Migrations**:
- Performance index optimization for MongoDB queries
- Payment session duplicate prevention
- Canteen ID migration tracking

---

## Environment Configuration

**Critical Variables** (see .env):
- `DATABASE_URL` - PostgreSQL connection string (Neon)
- `MONGODB_URI` - MongoDB Atlas connection
- `VITE_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - OAuth
- `CLOUDINARY_*` - Image upload service credentials
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` - Payment
- `VAPID_*` - Push notification keys (Web Push)
- `VITE_API_BASE_URL` - Frontend API target URL

---

## Build & Optimization

**Build Artifacts**:
- Frontend: `dist/public/` (Vite-built SPA)
- Backend: `dist/index.js` (esbuild-bundled Node.js)

**Optimization Scripts**:
- `scripts/production-optimization.js` - Compression, minification
- `scripts/build.js` - Complete build pipeline
- `scripts/start-production.js` - Production server startup with health checks

**Vite Chunk Strategy**:
- Vendor chunks: react, router, query, UI libraries
- Feature chunks: home, menu, cart components
- Context chunks: state management (Cart, Favorites, Canteen, Theme)
- Hook chunks: custom hooks library

**Performance Targets**:
- Chunk size warning limit: 1000 KB
- Source maps enabled only in development
- Redis caching with in-memory fallback

---

## Testing & Validation

**Test Framework**: No explicit test runner configured in package.json  
**Test File Location**: `client/src/__tests__/` (naming convention: `*.test.tsx`)  
**Type Checking**: TypeScript strict mode with `npm run check`

**Code Quality**:
- ESLint configuration (implicit, via TypeScript strict mode)
- Type safety: strict TypeScript configuration
- Validation: Zod schema validation for API contracts

---

## Deployment & Operations

**Hosting**: Render.com (production URL: https://sillobite.onrender.com)  
**Port**: 5000 (single unified port for API + frontend)  
**Session Management**: Express session with automated cleanup service  
**Health Checks**: Startup verification for database connectivity and schema validation

**Production Commands**:
```bash
npm run build:production    # Optimize and prepare for deployment

npm run start:production    # Start with health checks and monitoring
```

**WebSocket Setup**: Socket.IO server on same port for real-time features  
**Reverse Proxy**: Compatible with standard Node.js reverse proxy configurations

---

## Key Features & Services

- **Real-time Updates**: Socket.IO-powered live order tracking
- **PWA Support**: Service Worker, offline-first capability, installable
- **Mobile Integration**: Capacitor for iOS/Android native wrappers
- **Print Agent**: Dedicated WebSocket service for restaurant receipt printing
- **Payment Processing**: Razorpay integration with session management
- **Image Management**: Cloudinary integration for menu/product images
- **Role-Based Access**: Student, staff, employee, guest permission levels
- **Job Queue**: BullMQ with Redis for async tasks and print jobs
- **Notification System**: Web Push (VAPID) for order updates
