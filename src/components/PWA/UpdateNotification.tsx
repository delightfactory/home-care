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
    if ('serviceWorker' in navigator) {
      // Check for service worker updates
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);
        
        // Check for updates every 30 seconds
        const checkForUpdates = () => {
          reg.update();
        };
        
        const updateInterval = setInterval(checkForUpdates, 30000);
        
        return () => clearInterval(updateInterval);
      });

      // Listen for service worker updates
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // New service worker has taken control
        if (!isUpdating) {
          window.location.reload();
        }
      });

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATE_AVAILABLE') {
          setShowUpdatePrompt(true);
        }
      });

      // Check if there's a waiting service worker
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && reg.waiting) {
          setShowUpdatePrompt(true);
        }
      });
    }
  }, [isUpdating]);

  const handleUpdate = async () => {
    if (!registration || !registration.waiting) return;

    setIsUpdating(true);
    
    try {
      // Tell the waiting service worker to skip waiting
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Wait for the new service worker to take control
      await new Promise<void>((resolve) => {
        const handleControllerChange = () => {
          navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
          resolve();
        };
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      });
      
      onUpdate?.();
      
      // Reload the page to get the latest version
      window.location.reload();
    } catch (error) {
      console.error('Error updating service worker:', error);
      setIsUpdating(false);
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
        if (registration && registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          
          // Wait for controller change
          await new Promise<void>((resolve) => {
            const handleControllerChange = () => {
              navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
              resolve();
            };
            navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
          });
          
          window.location.reload();
        }
      } catch (error) {
        console.error('Error updating app:', error);
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