// Service Worker for Home Cleaning Management PWA
const CACHE_NAME = 'home-cleaning-v1.0.0';
const STATIC_CACHE_NAME = 'static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'dynamic-v1.0.0';

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/favicon-32x32.png',
  '/icons/apple-touch-icon.png'
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /\/api\//,
  /supabase/
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Static files cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Error caching static files:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated successfully');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Bypass cross-origin requests (e.g., Supabase REST calls)
  // These requests should go straight to the network and are not cached.
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache the response
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE_NAME)
            .then((cache) => {
              cache.put(request, responseClone);
            });
          return response;
        })
        .catch(() => {
          // Serve cached version or offline page
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Return offline page
              return caches.match('/index.html');
            });
        })
    );
    return;
  }
  
  // Handle API requests
  if (API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseClone);
              });
          }
          return response;
        })
        .catch(() => {
          // Serve cached API response if available
          return caches.match(request);
        })
    );
    return;
  }
  
  // Handle static assets
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone and cache the response
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseClone);
              });
            
            return response;
          });
      })
  );
});

// Handle background sync
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle offline data synchronization
      syncOfflineData()
    );
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'إشعار جديد من نظام HOME CARE',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/favicon-32x32.png',
    vibrate: [200, 100, 200],
    dir: 'rtl',
    lang: 'ar',
    tag: 'home-cleaning-notification',
    requireInteraction: true,
    actions: [
      {
        action: 'view',
        title: 'عرض',
        icon: '/icons/favicon-32x32.png'
      },
      {
        action: 'close',
        title: 'إغلاق',
        icon: '/icons/favicon-32x32.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('نظام HOME CARE المنزلي', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Utility function to sync offline data
async function syncOfflineData() {
  try {
    // Get offline data from IndexedDB or localStorage
    const offlineData = await getOfflineData();
    
    if (offlineData && offlineData.length > 0) {
      // Sync data with server
      for (const data of offlineData) {
        try {
          await fetch(data.endpoint, {
            method: data.method,
            headers: data.headers,
            body: data.body
          });
          
          // Remove synced data from offline storage
          await removeOfflineData(data.id);
        } catch (error) {
          console.error('Service Worker: Error syncing data:', error);
        }
      }
    }
  } catch (error) {
    console.error('Service Worker: Error in background sync:', error);
  }
}

// Utility functions for offline data management
async function getOfflineData() {
  // Implementation depends on your offline storage strategy
  return [];
}

async function removeOfflineData(id) {
  // Implementation depends on your offline storage strategy
  console.log('Removing offline data:', id);
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});