// PWA Components
export { default as InstallPrompt } from './InstallPrompt';
export { default as OfflineManager } from './OfflineIndicator';
export { StatusIndicator, OfflineBanner, OnlineBanner, useOfflineStatus } from './OfflineIndicator';
export { default as UpdateNotification } from './UpdateNotification';

// PWA Types
export interface PWAConfig {
  enableInstallPrompt?: boolean;
  enableOfflineMode?: boolean;
  enablePushNotifications?: boolean;
  enableBackgroundSync?: boolean;
  cacheStrategy?: 'cacheFirst' | 'networkFirst' | 'staleWhileRevalidate';
  cacheDuration?: number;
  notificationIcon?: string;
  notificationBadge?: string;
}

// PWA Utilities
export const isPWAInstalled = (): boolean => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true ||
         document.referrer.includes('android-app://');
};

export const isPWASupported = (): boolean => {
  return 'serviceWorker' in navigator && 'PushManager' in window;
};

export const isIOSDevice = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const canInstallPWA = (): boolean => {
  return !isPWAInstalled() && isPWASupported();
};

// PWA Event Handlers
export const registerPWAEventListeners = (): void => {
  // Handle app installed event
  window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    // Track installation
    if (typeof (window as any).gtag !== 'undefined') {
      (window as any).gtag('event', 'pwa_install', {
        event_category: 'PWA',
        event_label: 'App Installed'
      });
    }
  });

  // Handle before install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    console.log('PWA install prompt available');
  });

  // Handle visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('PWA became visible');
    }
  });
};

// PWA Performance Monitoring
export const trackPWAPerformance = (): void => {
  // Track loading performance
  window.addEventListener('load', () => {
    const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (typeof (window as any).gtag !== 'undefined') {
      (window as any).gtag('event', 'pwa_performance', {
        event_category: 'PWA',
        custom_map: {
          'metric1': 'load_time',
          'metric2': 'dom_content_loaded'
        },
        metric1: Math.round(perfData.loadEventEnd - perfData.loadEventStart),
        metric2: Math.round(perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart)
      });
    }
  });

  // Track service worker performance
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(() => {
      console.log('Service Worker is ready');
    });
  }
};

// PWA Cache Management
export const clearPWACache = async (): Promise<void> => {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('PWA cache cleared');
  }
};

export const updatePWACache = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
      console.log('PWA cache updated');
    }
  }
};

// PWA Notification Helpers
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  const permission = await Notification.requestPermission();
  return permission;
};

export const showPWANotification = (title: string, options?: NotificationOptions): void => {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      ...options
    });
  }
};

// PWA Storage Helpers
export const setPWAData = (key: string, value: any): void => {
  try {
    localStorage.setItem(`pwa_${key}`, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to save PWA data:', error);
  }
};

export const getPWAData = (key: string): any => {
  try {
    const data = localStorage.getItem(`pwa_${key}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get PWA data:', error);
    return null;
  }
};

export const removePWAData = (key: string): void => {
  try {
    localStorage.removeItem(`pwa_${key}`);
  } catch (error) {
    console.error('Failed to remove PWA data:', error);
  }
};