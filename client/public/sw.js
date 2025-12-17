// Service Worker for Sillobyte Canteen PWA
const CACHE_NAME = 'sillobyte-canteen-v4'; // Incremented to force cache clear for PWA splash fix
const CACHE_VERSION = 'cache-v' + Date.now(); // Dynamic cache version
const APP_VERSION = '2.1.0'; // App version updated for PWA splash screen fix
const STATIC_CACHE_URLS = [
  '/',
  '/splashscreen',
  '/manifest.json'
  // Removed /splash_logo.svg - favicon is now a data URI, no external file needed
];

// Install event - cache static resources
self.addEventListener('install', event => {
  console.log('Service Worker: Installing');
  
  // Force immediate update for icon changes
  console.log('🔧 Force updating service worker for icon changes');
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .catch(err => {
        console.log('Service Worker: Cache failed', err);
      })
  );
});

// Activate event - clean up old caches with version checking
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            // Delete old caches or caches with different versions
            if (cache !== CACHE_NAME || !cache.includes(CACHE_VERSION)) {
              console.log('Service Worker: Deleting old cache', cache);
              return caches.delete(cache);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Claiming clients');
        return self.clients.claim();
      })
  );
});

// Handle messages from main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Service Worker: Skipping waiting...');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    // Send version info back to client
    event.ports[0].postMessage({
      version: APP_VERSION,
      cacheVersion: CACHE_VERSION
    });
  }
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip requests to external domains
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);
  
  // CRITICAL: Use Network First for HTML documents to ensure latest version is always loaded
  if (event.request.destination === 'document' || 
      url.pathname === '/' || 
      url.pathname.endsWith('.html') ||
      url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request)
        .then(fetchResponse => {
          // Cache the fresh HTML
          if (fetchResponse.ok) {
            const responseToCache = fetchResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
          }
          return fetchResponse;
        })
        .catch(() => {
          // Fallback to cache only if network fails (offline)
          return caches.match(event.request)
            .then(response => response || caches.match('/'))
            .then(response => response || new Response('Offline - Please check your connection', { 
              status: 503,
              headers: { 'Content-Type': 'text/html' }
            }));
        })
    );
    return;
  }
  
  // Use Network First strategy for JS/CSS assets to ensure updates are loaded
  if (url.pathname.includes('/assets/') && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
    event.respondWith(
      fetch(event.request)
        .then(fetchResponse => {
          // Cache the fresh response
          if (fetchResponse.ok) {
            const responseToCache = fetchResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
          }
          return fetchResponse;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request)
            .then(response => response || new Response('Offline', { status: 503 }));
        })
    );
    return;
  }

  // Use Cache First strategy for other static assets (images, fonts, etc)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request)
          .then(fetchResponse => {
            // Don't cache API calls or non-successful responses
            if (!fetchResponse.ok || event.request.url.includes('/api/')) {
              return fetchResponse;
            }

            // Clone the response before caching
            const responseToCache = fetchResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return fetchResponse;
          })
          .catch(() => {
            // If both cache and network fail, show offline page for navigations
            if (event.request.destination === 'document') {
              return caches.match('/');
            }
            return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
          });
      })
  );
});

// Handle background sync (optional)
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync', event.tag);
  // Add background sync logic here if needed
});

// Handle push notifications
self.addEventListener('push', event => {
  console.log('Service Worker: Push notification received', event);

  let notificationData = {
    title: 'Canteen App',
    body: 'You have a new notification!',
    icon: '/api/icon.png?size=192',
    badge: '/api/icon.png?size=192',
    data: {},
    actions: [],
    requireInteraction: false,
    silent: false,
    tag: 'default',
    timestamp: Date.now(),
    // Android-specific settings for heads-up notifications
    priority: 'high',
    urgency: 'high',
    vibrate: [200, 100, 200],
  };

  // Parse notification data from server
  if (event.data) {
    try {
      const serverData = event.data.json();
      notificationData = {
        ...notificationData,
        ...serverData,
      };
    } catch (error) {
      console.error('Failed to parse push notification data:', error);
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  // Add default actions for order-related notifications
  if (notificationData.data?.type === 'order_update' || notificationData.data?.type === 'new_order') {
    notificationData.actions = [
      {
        action: 'view',
        title: 'View Order',
        icon: '/api/icon.png?size=192'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/api/icon.png?size=192'
      }
    ];
    notificationData.requireInteraction = true;
    // High priority for order updates to ensure heads-up display
    notificationData.priority = 'high';
    notificationData.urgency = 'high';
  }

  // Maximum Android heads-up notification settings
  const androidNotificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    data: notificationData.data,
    actions: notificationData.actions,
    // Force heads-up display on Android
    requireInteraction: true,
    silent: false,
    tag: notificationData.tag,
    timestamp: notificationData.timestamp,
    vibrate: [300, 200, 300, 200, 300],
    // Maximum priority settings for Android heads-up
    renotify: true,
    sticky: true,
    // Enhanced visual settings
    image: notificationData.image,
    dir: 'ltr',
    lang: 'en',
  };

  // Show notification and send to in-app notification panel
  event.waitUntil(
    Promise.all([
      // Show browser notification with enhanced Android options
      self.registration.showNotification(notificationData.title, androidNotificationOptions),
      // Send to all clients for in-app notification panel
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'push_notification',
            notification: {
              title: notificationData.title,
              message: notificationData.body,
              type: notificationData.data?.notificationType || 'confirmed',
              orderNumber: notificationData.data?.orderNumber,
              timestamp: new Date(notificationData.timestamp)
            }
          });
        });
      })
    ])
  );
});

// Handle notification click events
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked', event);

  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  // Handle different actions
  if (action === 'close') {
    return;
  }

  // Determine URL to open
  let urlToOpen = '/';

  if (data.url) {
    urlToOpen = data.url;
  } else if (data.type === 'order_update' && data.orderNumber) {
    urlToOpen = `/orders/${data.orderNumber}`;
  } else if (data.type === 'new_order' && data.orderNumber) {
    urlToOpen = `/admin/orders/${data.orderNumber}`;
  } else if (data.type === 'payment_confirmation' && data.orderNumber) {
    urlToOpen = `/orders/${data.orderNumber}`;
  }

  // Open or focus app window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Try to find existing window and focus it
        for (const client of clientList) {
          if (client.url === self.location.origin + urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }

        // If no existing window found, open new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});