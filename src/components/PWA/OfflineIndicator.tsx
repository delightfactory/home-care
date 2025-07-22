import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface OfflineIndicatorProps {
  onRetry?: () => void;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ onRetry }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);
  const [showOnlineMessage, setShowOnlineMessage] = useState(false);
  const [, setLastOnlineTime] = useState<Date | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineMessage(false);
      setShowOnlineMessage(true);
      setLastOnlineTime(new Date());
      
      // Hide online message after 3 seconds
      setTimeout(() => {
        setShowOnlineMessage(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
      setShowOnlineMessage(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
    // Force a network check
    if (navigator.onLine) {
      setIsOnline(true);
      setShowOfflineMessage(false);
    }
  };

  return (
    <>
      <StatusIndicator isOnline={isOnline} />
      <OfflineBanner 
        show={showOfflineMessage} 
        onRetry={handleRetry} 
      />
      <OnlineBanner show={showOnlineMessage} />
    </>
  );
};



// Enhanced hook for offline status with banner visibility
export const useOfflineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [showOnlineBanner, setShowOnlineBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineBanner(false);
      setShowOnlineBanner(true);
      
      // Hide online banner after 3 seconds
      setTimeout(() => {
        setShowOnlineBanner(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineBanner(true);
      setShowOnlineBanner(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Show offline banner if already offline
    if (!navigator.onLine) {
      setShowOfflineBanner(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, showOfflineBanner, showOnlineBanner };
};

// Export individual components
export const StatusIndicator: React.FC<{ isOnline: boolean }> = ({ isOnline }) => (
  <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
    isOnline 
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  }`}>
    {isOnline ? (
      <>
        <Wifi className="w-4 h-4" />
        <span>متصل</span>
      </>
    ) : (
      <>
        <WifiOff className="w-4 h-4" />
        <span>غير متصل</span>
      </>
    )}
  </div>
);

export const OfflineBanner: React.FC<{ show: boolean; onRetry: () => void }> = ({ show, onRetry }) => {
  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 shadow-lg">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <WifiOff className="w-5 h-5" />
          <div>
            <p className="font-medium">لا يوجد اتصال بالإنترنت</p>
            <p className="text-sm opacity-90">يتم العمل في الوضع غير المتصل. بعض الميزات قد لا تكون متاحة.</p>
          </div>
        </div>
        <button
          onClick={onRetry}
          className="flex items-center space-x-2 rtl:space-x-reverse bg-red-700 hover:bg-red-800 px-3 py-1 rounded text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>إعادة المحاولة</span>
        </button>
      </div>
    </div>
  );
};

export const OnlineBanner: React.FC<{ show: boolean }> = ({ show }) => {
  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-green-600 text-white px-4 py-3 shadow-lg">
      <div className="flex items-center justify-center max-w-7xl mx-auto">
        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <Wifi className="w-5 h-5" />
          <p className="font-medium">تم استعادة الاتصال بالإنترنت</p>
        </div>
      </div>
    </div>
  );
};

// Main Offline Manager Component
const OfflineManager: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
  const { showOfflineBanner, showOnlineBanner } = useOfflineStatus();

  return (
    <>
      {showOfflineBanner && <OfflineBanner show={showOfflineBanner} onRetry={onRetry || (() => {})} />}
      {showOnlineBanner && <OnlineBanner show={showOnlineBanner} />}
    </>
  );
};

export default OfflineManager;
export { OfflineIndicator };