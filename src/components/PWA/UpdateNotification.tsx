import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, X } from 'lucide-react';

interface UpdateNotificationProps {
  onUpdate?: () => void;
  onDismiss?: () => void;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onUpdate, onDismiss }) => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let updateCheckInterval: NodeJS.Timeout;

    const setupUpdateListener = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        setRegistration(reg);

        // تحقق فوري إذا كان هناك SW منتظر
        if (reg.waiting) {
          console.log('UpdateNotification: Found waiting SW on load');
          setShowUpdatePrompt(true);
        }

        // الاستماع لأحداث التحديث (updatefound)
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          console.log('UpdateNotification: New SW installing...');

          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              // عندما يصبح SW الجديد في حالة 'installed' وهناك controller حالي
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('UpdateNotification: New SW installed and waiting');
                setShowUpdatePrompt(true);
              }
            });
          }
        });

        // تحقق فوري عند بدء التطبيق
        reg.update();

        // تحقق دوري كل 5 دقائق (بدلاً من 30 ثانية)
        updateCheckInterval = setInterval(() => {
          console.log('UpdateNotification: Periodic update check');
          reg.update();
        }, 5 * 60 * 1000); // 5 دقائق
      } catch (error) {
        console.error('UpdateNotification: Error setting up update listener:', error);
      }
    };

    setupUpdateListener();

    // الاستماع لتغيير الـ controller - لكن لا نُعيد التحميل تلقائياً
    const handleControllerChange = () => {
      console.log('UpdateNotification: Controller changed');
      // نُعيد التحميل فقط إذا كان المستخدم قد ضغط "تحديث الآن"
      if (isUpdating) {
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      if (updateCheckInterval) clearInterval(updateCheckInterval);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [isUpdating]);

  const handleUpdate = async () => {
    if (!registration) return;

    // حتى لو لم يكن هناك waiting، نحاول إعادة التحميل
    if (!registration.waiting) {
      console.log('UpdateNotification: No waiting SW, forcing reload');
      window.location.reload();
      return;
    }

    setIsUpdating(true);

    try {
      // Tell the waiting service worker to skip waiting
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });

      // Wait for the new service worker to take control (with timeout)
      const controllerChanged = await Promise.race([
        new Promise<boolean>((resolve) => {
          const handleControllerChange = () => {
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
            resolve(true);
          };
          navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
        }),
        // Timeout after 3 seconds
        new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(false), 3000);
        })
      ]);

      onUpdate?.();

      // Reload regardless of whether controllerchange happened
      console.log('UpdateNotification: Reloading...', controllerChanged ? 'after controller change' : 'after timeout');
      window.location.reload();
    } catch (error) {
      console.error('Error updating service worker:', error);
      // Force reload even on error
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setShowUpdatePrompt(false);
    onDismiss?.();
  };

  if (!showUpdatePrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-blue-600 text-white rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="flex-shrink-0">
            {isUpdating ? (
              <RefreshCw className="h-6 w-6 animate-spin" />
            ) : (
              <Download className="h-6 w-6" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium">
              {isUpdating ? 'جاري التحديث...' : 'تحديث متوفر'}
            </h3>
            <p className="text-sm text-blue-100">
              {isUpdating
                ? 'يرجى الانتظار أثناء تحديث التطبيق'
                : 'إصدار جديد من التطبيق متوفر الآن'
              }
            </p>
          </div>
        </div>
        {!isUpdating && (
          <div className="flex items-center space-x-2 space-x-reverse">
            <button
              onClick={handleDismiss}
              className="px-3 py-1 text-sm text-blue-100 hover:text-white"
            >
              لاحقاً
            </button>
            <button
              onClick={handleUpdate}
              className="px-4 py-2 bg-white text-blue-600 text-sm rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
            >
              تحديث الآن
            </button>
          </div>
        )}
        {!isUpdating && (
          <button
            onClick={handleDismiss}
            className="ml-2 flex-shrink-0 text-blue-100 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
};

// Hook for managing app updates
export const useAppUpdate = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });

        // Check if there's already a waiting worker
        if (registration.waiting) {
          setUpdateAvailable(true);
        }
      });
    }
  }, []);

  const updateApp = async () => {
    if ('serviceWorker' in navigator) {
      setIsUpdating(true);

      try {
        const registration = await navigator.serviceWorker.getRegistration();

        if (!registration) {
          window.location.reload();
          return;
        }

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // Wait for controller change with timeout
        await Promise.race([
          new Promise<void>((resolve) => {
            const handleControllerChange = () => {
              navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
              resolve();
            };
            navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
          }),
          // Timeout after 3 seconds
          new Promise<void>((resolve) => {
            setTimeout(() => resolve(), 3000);
          })
        ]);

        window.location.reload();
      } catch (error) {
        console.error('Error updating app:', error);
        // Force reload even on error
        window.location.reload();
        setIsUpdating(false);
      }
    }
  };

  return {
    updateAvailable,
    isUpdating,
    updateApp
  };
};

export default UpdateNotification;