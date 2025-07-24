import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import usePWA from '../../hooks/usePWA';

interface InstallPromptProps {
  onInstall?: () => void;
  onDismiss?: () => void;
}

const InstallPrompt: React.FC<InstallPromptProps> = ({ onInstall, onDismiss }) => {
  const { state, actions } = usePWA();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if iOS
    const checkIfIOS = () => {
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
      setIsIOS(isIOSDevice);
    };

    checkIfIOS();

    // Show prompt after a delay if can install and not already installed
    if (state.canInstall && !state.isInstalled) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [state.canInstall, state.isInstalled]);

  const handleInstallClick = async () => {
    try {
      const success = await actions.install();
      if (success) {
        onInstall?.();
      }
      setShowPrompt(false);
    } catch (error) {
      console.error('Error during installation:', error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    onDismiss?.();
    
    // Don't show again for this session
    sessionStorage.setItem('installPromptDismissed', 'true');
  };

  // Don't show if already installed or dismissed this session
  if (state.isInstalled || sessionStorage.getItem('installPromptDismissed')) {
    return null;
  }

  // iOS installation instructions
  if (isIOS && showPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 space-x-reverse">
            <div className="flex-shrink-0">
              <Smartphone className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900">
                تثبيت التطبيق على جهازك
              </h3>
              <div className="mt-2 text-sm text-gray-600">
                <p className="mb-2">لتثبيت هذا التطبيق على جهاز iOS:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>اضغط على زر المشاركة في Safari</li>
                  <li>اختر "إضافة إلى الشاشة الرئيسية"</li>
                  <li>اضغط "إضافة" للتأكيد</li>
                </ol>
              </div>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  // Standard installation prompt
  if (showPrompt && state.canInstall) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="flex-shrink-0">
              <Download className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900">
                تثبيت التطبيق
              </h3>
              <p className="text-sm text-gray-600">
                احصل على تجربة أفضل وأسرع مع التطبيق المثبت
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <button
              onClick={handleDismiss}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
            >
              لاحقاً
            </button>
            <button
              onClick={handleInstallClick}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              تثبيت
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default InstallPrompt;