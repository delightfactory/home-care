import { useState, useEffect, useCallback } from 'react';
import { isPWAInstalled, isPWASupported, canInstallPWA } from '../components/PWA';

export interface PWAState {
  isSupported: boolean;
  isInstalled: boolean;
  canInstall: boolean;
  isOnline: boolean;
  updateAvailable: boolean;
  installing: boolean;
}

export interface PWAActions {
  install: () => Promise<boolean>;
  update: () => Promise<void>;
  share: (data: ShareData) => Promise<boolean>;
  requestNotificationPermission: () => Promise<NotificationPermission>;
  subscribeToNotifications: () => Promise<PushSubscription | null>;
  unsubscribeFromNotifications: () => Promise<boolean>;
}

export interface UsePWAReturn {
  state: PWAState;
  actions: PWAActions;
}

export const usePWA = (): UsePWAReturn => {
  const [state, setState] = useState<PWAState>({
    isSupported: false,
    isInstalled: false,
    canInstall: false,
    isOnline: navigator.onLine,
    updateAvailable: false,
    installing: false,
  });

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Initialize PWA state
  useEffect(() => {
    const initializePWA = async () => {
      const isSupported = isPWASupported();
      const isInstalled = isPWAInstalled();
      const canInstall = canInstallPWA();

      setState(prev => ({
        ...prev,
        isSupported,
        isInstalled,
        canInstall,
      }));

      // Register service worker
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js');
          setRegistration(reg);

          // Check for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setState(prev => ({ ...prev, updateAvailable: true }));
                }
              });
            }
          });
        } catch (error) {
          console.error('Service Worker registration failed:', error);
        }
      }
    };

    initializePWA();
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setState(prev => ({ ...prev, canInstall: true }));
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setState(prev => ({
        ...prev,
        isInstalled: true,
        canInstall: false,
        installing: false,
      }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Install PWA
  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    setState(prev => ({ ...prev, installing: true }));

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
        setState(prev => ({
          ...prev,
          canInstall: false,
          installing: false,
        }));
        return true;
      } else {
        setState(prev => ({ ...prev, installing: false }));
        return false;
      }
    } catch (error) {
      console.error('Installation failed:', error);
      setState(prev => ({ ...prev, installing: false }));
      return false;
    }
  }, [deferredPrompt]);

  // Update PWA
  const update = useCallback(async (): Promise<void> => {
    if (!registration) return;

    try {
      await registration.update();
      
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        
        // Reload the page to apply the update
        window.location.reload();
      }
    } catch (error) {
      console.error('Update failed:', error);
    }
  }, [registration]);

  // Share content
  const share = useCallback(async (data: ShareData): Promise<boolean> => {
    if (!navigator.share) {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(data.url || data.text || '');
        return true;
      } catch {
        return false;
      }
    }

    try {
      await navigator.share(data);
      return true;
    } catch (error) {
      console.error('Sharing failed:', error);
      return false;
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (error) {
      console.error('Notification permission request failed:', error);
      return 'denied';
    }
  }, []);

  // Subscribe to push notifications
  const subscribeToNotifications = useCallback(async (): Promise<PushSubscription | null> => {
    if (!registration || !('PushManager' in window)) {
      return null;
    }

    try {
      const permission = await requestNotificationPermission();
      if (permission !== 'granted') {
        return null;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.VITE_VAPID_PUBLIC_KEY,
      });

      return subscription;
    } catch (error) {
      console.error('Push subscription failed:', error);
      return null;
    }
  }, [registration, requestNotificationPermission]);

  // Unsubscribe from push notifications
  const unsubscribeFromNotifications = useCallback(async (): Promise<boolean> => {
    if (!registration) {
      return false;
    }

    try {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Push unsubscription failed:', error);
      return false;
    }
  }, [registration]);

  const actions: PWAActions = {
    install,
    update,
    share,
    requestNotificationPermission,
    subscribeToNotifications,
    unsubscribeFromNotifications,
  };

  return { state, actions };
};

export default usePWA;