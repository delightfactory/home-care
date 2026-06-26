// Service Worker for Home Cleaning Management PWA
// v2 — Healing release: fixes stale SW / stale cache loading failure
// __BUILD_TIMESTAMP__ سيتم استبداله تلقائياً عند البناء
const BUILD_VERSION = '__BUILD_TIMESTAMP__';
const CACHE_NAME = `home-cleaning-${BUILD_VERSION}`;
const STATIC_CACHE_NAME = `static-${BUILD_VERSION}`;
const DYNAMIC_CACHE_NAME = `dynamic-${BUILD_VERSION}`;

// Prefixes that belong to THIS app's caches — used for safe cleanup
const APP_CACHE_PREFIXES = ['home-cleaning-', 'static-', 'dynamic-'];

// Only truly static files that will NEVER change path between builds.
// Do NOT add hashed /assets/*.js or /assets/*.css here — they change every build
// and will break cache.addAll() all-or-nothing behaviour.
const CORE_STATIC_FILES = [
  '/index.html',
  '/manifest.json'
];

// Optional files: cached individually, failure doesn't abort install
const OPTIONAL_STATIC_FILES = [
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/favicon-32x32.png',
  '/icons/apple-touch-icon.png'
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if cacheName belongs to this application.
 * Protects against accidentally deleting caches owned by other origins/apps.
 */
function isAppCache(cacheName) {
  return APP_CACHE_PREFIXES.some(prefix => cacheName.startsWith(prefix));
}

/**
 * Wraps fetch with a hard timeout so a stalled network never hangs a FetchEvent.
 * @param {Request|string} request
 * @param {number} timeoutMs – default 8 seconds
 */
function fetchWithTimeout(request, timeoutMs) {
  timeoutMs = timeoutMs || 8000;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SW fetch timeout')), timeoutMs);
    fetch(request).then(
      (response) => { clearTimeout(timer); resolve(response); },
      (err)      => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * Safely stores a response clone in a named cache.
 * Silently ignores any error so a cache write failure never kills the fetch handler.
 * @param {string} cacheName
 * @param {Request|string} requestOrUrl
 * @param {Response} response  – must be a FRESH response (not yet consumed)
 */
function cachePutSafe(cacheName, requestOrUrl, response) {
  try {
    const clone = response.clone();
    caches.open(cacheName).then(cache => cache.put(requestOrUrl, clone)).catch(() => {});
  } catch (_) {
    // never throw
  }
}

// ---------------------------------------------------------------------------
// Install — cache core files, skip optional failures, force takeover
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', BUILD_VERSION);

  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE_NAME);

      // Core files: /index.html and /manifest.json
      // addAll() is all-or-nothing — only use it for files we are certain exist
      try {
        await cache.addAll(CORE_STATIC_FILES);
        console.log('[SW] Core static files cached');
      } catch (err) {
        console.error('[SW] Failed to cache core static files:', err);
        // Do NOT re-throw — we still want SW to install even if the network hiccups
      }

      // Optional files: cache each individually so one missing icon doesn't abort install
      await Promise.allSettled(
        OPTIONAL_STATIC_FILES.map(async (url) => {
          try {
            const response = await fetchWithTimeout(url, 5000);
            if (response && response.status === 200) {
              await cache.put(url, response);
            }
          } catch (_) {
            console.warn('[SW] Optional file not cached (non-fatal):', url);
          }
        })
      );

      // *** HEALING RELEASE ***
      // skipWaiting() forces this new SW to replace the stale one immediately,
      // solving the "Failed to fetch" loop caused by the old SW serving
      // index.html that references hashed assets that no longer exist.
      // After this healing deploy has reached all users we can revert to
      // waiting for the user's explicit "Update now" action.
      console.log('[SW] Calling skipWaiting() — healing release');
      self.skipWaiting();
    })()
  );
});

// ---------------------------------------------------------------------------
// Activate — clean up ALL old app caches, then claim all clients
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version:', BUILD_VERSION);

  event.waitUntil(
    (async () => {
      const allCacheNames = await caches.keys();
      await Promise.all(
        allCacheNames.map((cacheName) => {
          // Only touch caches that belong to this app
          if (!isAppCache(cacheName)) return;
          // Keep the two caches for the current build version
          if (cacheName === STATIC_CACHE_NAME || cacheName === DYNAMIC_CACHE_NAME) return;
          // Delete every other app cache (old versions)
          console.log('[SW] Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );

      console.log('[SW] Activated — claiming all clients');
      return self.clients.claim();
    })()
  );
});

// ---------------------------------------------------------------------------
// Fetch — the core routing logic
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET — pass through unchanged
  if (request.method !== 'GET') return;

  // 2. Skip cross-origin — Supabase, Google Fonts, CDNs, etc.
  //    (Supabase REST/Auth calls are cross-origin by definition, so already bypassed here)
  if (url.origin !== self.location.origin) return;

  // 3. Skip Vite dev-server internals — prevents HMR breakage in local dev
  if (
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.includes('.vite/') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.jsx') ||
    url.searchParams.has('v') ||
    url.searchParams.has('t')
  ) {
    return;
  }

  // 4. Skip any same-origin paths that look like API/Supabase proxies
  //    (belt-and-suspenders: they should already be cross-origin, but just in case)
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/supabase/')
  ) {
    return;
  }

  // ---------------------------------------------------------------------------
  // NAVIGATION requests  (HTML page loads: /login, /dashboard, /, etc.)
  // Strategy: Network-first. Cache ONLY /index.html, not the specific URL.
  // This prevents stale /login or /dashboard entries from serving old HTML.
  // ---------------------------------------------------------------------------
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // ---------------------------------------------------------------------------
  // HASHED ASSETS  (/assets/index-AbCd1234.js, /assets/vendor-XxXx.css, …)
  // Strategy: Cache-first — these files are content-addressed and immutable.
  // ---------------------------------------------------------------------------
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(handleHashedAsset(request));
    return;
  }

  // ---------------------------------------------------------------------------
  // EVERYTHING ELSE  (icons, manifest, fonts, robots.txt, etc.)
  // Strategy: Network-first with cache fallback.
  // ---------------------------------------------------------------------------
  event.respondWith(handleStaticResource(request));
});

// ---------------------------------------------------------------------------
// Navigation handler
// ---------------------------------------------------------------------------
async function handleNavigation(request) {
  try {
    const response = await fetchWithTimeout(request);

    // Only cache if we got a real HTML response (not an error page)
    if (
      response &&
      response.status === 200 &&
      (response.headers.get('content-type') || '').includes('text/html')
    ) {
      // Cache under the canonical /index.html key, NOT the request URL (/login etc.)
      // This prevents per-route stale entries accumulating in DYNAMIC_CACHE_NAME.
      cachePutSafe(STATIC_CACHE_NAME, '/index.html', response);
    }

    return response;
  } catch (_) {
    // Network failed — serve cached /index.html so the SPA can render offline
    const cached = await caches.match('/index.html');
    if (cached) return cached;

    // Absolute fallback: a minimal HTML shell that tells the user to reconnect
    return new Response(
      `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><title>HOME CARE — غير متصل</title></head>
<body style="font-family:sans-serif;text-align:center;padding:60px 20px;direction:rtl">
  <h1>لا يوجد اتصال بالإنترنت</h1>
  <p>يرجى التحقق من الاتصال ثم إعادة تحميل الصفحة.</p>
  <button onclick="location.reload()" style="padding:12px 24px;font-size:16px;cursor:pointer">
    إعادة المحاولة
  </button>
</body>
</html>`,
      {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    );
  }
}

// ---------------------------------------------------------------------------
// Hashed asset handler — Cache-first, safe 404 pass-through
// ---------------------------------------------------------------------------
async function handleHashedAsset(request) {
  // Check cache first
  const cached = await caches.match(request);
  if (cached) return cached;

  // Cache miss — fetch from network
  try {
    const response = await fetchWithTimeout(request);

    if (!response) {
      return new Response('Asset not found', { status: 404 });
    }

    // Only cache a genuine successful same-origin response
    // Do NOT cache 404s — they must not masquerade as JS/CSS modules
    if (response.status === 200 && response.type === 'basic') {
      cachePutSafe(DYNAMIC_CACHE_NAME, request, response);
    }

    return response;
  } catch (err) {
    console.error('[SW] Failed to fetch hashed asset:', request.url, err);
    // Return a proper network-error response so the browser surfaces it correctly
    return new Response('Network error: ' + err.message, { status: 503 });
  }
}

// ---------------------------------------------------------------------------
// Generic static resource handler — Network-first, cache fallback
// ---------------------------------------------------------------------------
async function handleStaticResource(request) {
  try {
    const response = await fetchWithTimeout(request);

    if (response && response.status === 200 && response.type === 'basic') {
      cachePutSafe(DYNAMIC_CACHE_NAME, request, response);
    }

    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Nothing in cache and network failed — return transparent 503
    return new Response('Unavailable offline', { status: 503 });
  }
}

// ---------------------------------------------------------------------------
// Background Sync
// ---------------------------------------------------------------------------
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'background-sync') {
    event.waitUntil(syncOfflineData());
  }
});

// ---------------------------------------------------------------------------
// Push Notifications
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

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

// ---------------------------------------------------------------------------
// Notification Clicks
// ---------------------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

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

// ---------------------------------------------------------------------------
// Messages from main thread
// ---------------------------------------------------------------------------
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// ---------------------------------------------------------------------------
// Offline data sync utilities (stubs — implement as needed)
// ---------------------------------------------------------------------------
async function syncOfflineData() {
  try {
    const offlineData = await getOfflineData();

    if (offlineData && offlineData.length > 0) {
      for (const data of offlineData) {
        try {
          await fetch(data.endpoint, {
            method: data.method,
            headers: data.headers,
            body: data.body
          });
          await removeOfflineData(data.id);
        } catch (error) {
          console.error('[SW] Error syncing data:', error);
        }
      }
    }
  } catch (error) {
    console.error('[SW] Error in background sync:', error);
  }
}

async function getOfflineData() {
  return [];
}

async function removeOfflineData(id) {
  console.log('[SW] Removing offline data:', id);
}