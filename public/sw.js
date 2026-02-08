// Service Worker for Home Cleaning Management PWA
// __BUILD_TIMESTAMP__ سيتم استبداله تلقائياً عند البناء
const BUILD_VERSION = '__BUILD_TIMESTAMP__';
const CACHE_NAME = `home-cleaning-${BUILD_VERSION}`;
const STATIC_CACHE_NAME = `static-${BUILD_VERSION}`;
const DYNAMIC_CACHE_NAME = `dynamic-${BUILD_VERSION}`;

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
  console.log('Service Worker: Installing new version...');

  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Static files cached. Waiting for activation...');
        // لا نستدعي skipWaiting() تلقائياً
        // ننتظر رسالة SKIP_WAITING من التطبيق بعد موافقة المستخدم
        // هذا يسمح للتطبيق بإظهار إشعار التحديث للمستخدم
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

  let notificationData = {
    title: 'نظام HOME CARE',
    body: 'إشعار جديد من نظام HOME CARE',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/favicon-32x32.png',
    data: {}
  };

  // Try to parse JSON payload from Edge Function
  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || payload.message || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        data: payload.data || {}
      };
    } catch (e) {
      // Fallback to text if not JSON
      notificationData.body = event.data.text();
    }
  }

  // تحديد نوع الإشعار
  const isIncomingCall = notificationData.data?.type === 'incoming_call';

  // إعدادات مختلفة للمكالمات
  let options;
  if (isIncomingCall) {
    options = {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      vibrate: [500, 200, 500, 200, 500, 200, 500], // نمط اهتزاز طويل للمكالمات
      dir: 'rtl',
      lang: 'ar',
      tag: 'incoming-call-' + (notificationData.data.call_id || Date.now()),
      requireInteraction: true, // يبقى حتى التفاعل
      renotify: true, // إعادة الإشعار حتى لو نفس الـ tag
      silent: false, // لا يكون صامت
      data: notificationData.data,
      actions: [
        {
          action: 'answer',
          title: 'رد 📞',
          icon: '/icons/favicon-32x32.png'
        },
        {
          action: 'decline',
          title: 'رفض',
          icon: '/icons/favicon-32x32.png'
        }
      ]
    };
  } else {
    options = {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      vibrate: [200, 100, 200],
      dir: 'rtl',
      lang: 'ar',
      tag: 'home-care-notification-' + Date.now(),
      requireInteraction: true,
      data: notificationData.data,
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
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked:', event.action);

  const notificationData = event.notification.data || {};
  const isIncomingCall = notificationData.type === 'incoming_call';

  event.notification.close();

  // معالجة إجراءات المكالمات
  if (isIncomingCall) {
    if (event.action === 'answer' || event.action === '') {
      // فتح التطبيق للرد على المكالمة
      event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
          for (const client of clientList) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              // إرسال رسالة للتطبيق للرد على المكالمة
              client.postMessage({
                type: 'INCOMING_CALL_ACTION',
                action: 'answer',
                callId: notificationData.call_id,
                callerId: notificationData.caller_id,
                callerName: notificationData.caller_name,
                channelName: notificationData.channel_name
              });
              return client.focus();
            }
          }
          // فتح نافذة جديدة إذا التطبيق مغلق
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
      );
    } else if (event.action === 'decline') {
      // إرسال رسالة لرفض المكالمة
      event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
          for (const client of clientList) {
            if (client.url.includes(self.location.origin)) {
              client.postMessage({
                type: 'INCOMING_CALL_ACTION',
                action: 'decline',
                callId: notificationData.call_id
              });
              return;
            }
          }
        })
      );
    }
    return;
  }

  // معالجة الإشعارات العادية
  const targetUrl = notificationData.url || '/';

  if (event.action === 'view' || event.action === '') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
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