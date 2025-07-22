import React, { useState } from 'react';
import { 
  Smartphone, 
  Download, 
  RefreshCw, 
  Bell, 
  BellOff, 
  Share2, 
  Wifi, 
  WifiOff,
  Info,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';
import toast from 'react-hot-toast';

interface PWASettingsProps {
  className?: string;
}

const PWASettings: React.FC<PWASettingsProps> = ({ className = '' }) => {
  const { state, actions } = usePWA();
  const [isLoading, setIsLoading] = useState({
    install: false,
    update: false,
    notifications: false,
  });

  const handleInstall = async () => {
    setIsLoading(prev => ({ ...prev, install: true }));
    try {
      const success = await actions.install();
      if (success) {
        toast.success('تم تثبيت التطبيق بنجاح!');
      } else {
        toast.error('فشل في تثبيت التطبيق');
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء التثبيت');
    } finally {
      setIsLoading(prev => ({ ...prev, install: false }));
    }
  };

  const handleUpdate = async () => {
    setIsLoading(prev => ({ ...prev, update: true }));
    try {
      await actions.update();
      toast.success('تم تحديث التطبيق بنجاح!');
    } catch (error) {
      toast.error('فشل في تحديث التطبيق');
    } finally {
      setIsLoading(prev => ({ ...prev, update: false }));
    }
  };

  const handleNotificationToggle = async () => {
    setIsLoading(prev => ({ ...prev, notifications: true }));
    try {
      const permission = await actions.requestNotificationPermission();
      if (permission === 'granted') {
        const subscription = await actions.subscribeToNotifications();
        if (subscription) {
          toast.success('تم تفعيل الإشعارات بنجاح!');
        } else {
          toast.error('فشل في تفعيل الإشعارات');
        }
      } else {
        toast.error('تم رفض إذن الإشعارات');
      }
    } catch (error) {
      toast.error('حدث خطأ في إعدادات الإشعارات');
    } finally {
      setIsLoading(prev => ({ ...prev, notifications: false }));
    }
  };

  const handleShare = async () => {
    try {
      const success = await actions.share({
        title: 'نظام إدارة الرعاية المنزلية',
        text: 'تطبيق شامل لإدارة خدمات الرعاية المنزلية',
        url: window.location.origin,
      });
      if (success) {
        toast.success('تم مشاركة التطبيق بنجاح!');
      }
    } catch (error) {
      toast.error('فشل في مشاركة التطبيق');
    }
  };

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    );
  };

  const getStatusText = (status: boolean) => {
    return status ? 'مفعل' : 'غير مفعل';
  };

  const getStatusColor = (status: boolean) => {
    return status ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Smartphone className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">إعدادات تطبيق الويب</h3>
            <p className="text-sm text-gray-600">إدارة إعدادات PWA والميزات المتقدمة</p>
          </div>
        </div>

        {/* PWA Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">دعم PWA</span>
              {getStatusIcon(state.isSupported)}
            </div>
            <span className={`text-xs ${getStatusColor(state.isSupported)}`}>
              {getStatusText(state.isSupported)}
            </span>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">حالة التثبيت</span>
              {getStatusIcon(state.isInstalled)}
            </div>
            <span className={`text-xs ${getStatusColor(state.isInstalled)}`}>
              {state.isInstalled ? 'مثبت' : 'غير مثبت'}
            </span>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">الاتصال</span>
              {state.isOnline ? (
                <Wifi className="w-5 h-5 text-green-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-500" />
              )}
            </div>
            <span className={`text-xs ${state.isOnline ? 'text-green-600' : 'text-red-600'}`}>
              {state.isOnline ? 'متصل' : 'غير متصل'}
            </span>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">التحديثات</span>
              {state.updateAvailable ? (
                <AlertCircle className="w-5 h-5 text-orange-500" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
            </div>
            <span className={`text-xs ${state.updateAvailable ? 'text-orange-600' : 'text-green-600'}`}>
              {state.updateAvailable ? 'تحديث متاح' : 'محدث'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          {/* Install App */}
          {state.canInstall && !state.isInstalled && (
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-blue-600" />
                <div>
                  <h4 className="font-medium text-blue-900">تثبيت التطبيق</h4>
                  <p className="text-sm text-blue-700">ثبت التطبيق على جهازك للوصول السريع</p>
                </div>
              </div>
              <button
                onClick={handleInstall}
                disabled={isLoading.install}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading.install ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                تثبيت
              </button>
            </div>
          )}

          {/* Update App */}
          {state.updateAvailable && (
            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-orange-600" />
                <div>
                  <h4 className="font-medium text-orange-900">تحديث متاح</h4>
                  <p className="text-sm text-orange-700">يتوفر إصدار جديد من التطبيق</p>
                </div>
              </div>
              <button
                onClick={handleUpdate}
                disabled={isLoading.update}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading.update ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                تحديث
              </button>
            </div>
          )}

          {/* Notifications */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-gray-600" />
              <div>
                <h4 className="font-medium text-gray-900">الإشعارات</h4>
                <p className="text-sm text-gray-600">تفعيل إشعارات التطبيق</p>
              </div>
            </div>
            <button
              onClick={handleNotificationToggle}
              disabled={isLoading.notifications}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading.notifications ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : Notification.permission === 'granted' ? (
                <BellOff className="w-4 h-4" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
              {Notification.permission === 'granted' ? 'إلغاء' : 'تفعيل'}
            </button>
          </div>

          {/* Share App */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Share2 className="w-5 h-5 text-gray-600" />
              <div>
                <h4 className="font-medium text-gray-900">مشاركة التطبيق</h4>
                <p className="text-sm text-gray-600">شارك التطبيق مع الآخرين</p>
              </div>
            </div>
            <button
              onClick={handleShare}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              مشاركة
            </button>
          </div>
        </div>

        {/* PWA Info */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">حول تطبيقات الويب التقدمية (PWA)</h4>
              <p className="text-sm text-blue-700 leading-relaxed">
                تطبيقات الويب التقدمية توفر تجربة مشابهة للتطبيقات الأصلية مع إمكانية العمل دون اتصال بالإنترنت، 
                الإشعارات الفورية، والتثبيت على الجهاز للوصول السريع.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWASettings;