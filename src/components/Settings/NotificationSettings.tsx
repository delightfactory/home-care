import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Smartphone, Monitor, Trash2, CheckCircle, XCircle, Volume2, VolumeX } from 'lucide-react';
import { NotificationsAPI } from '../../api/notifications';
import { usePWA } from '../../hooks/usePWA';
import type { NotificationPreferences, NotificationCategory } from '../../types';
import toast from 'react-hot-toast';
import LoadingSpinner from '../UI/LoadingSpinner';

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
    orders: 'الطلبات',
    expenses: 'المصروفات',
    routes: 'المسارات والرحلات',
    teams: 'الفرق والعمال',
    customers: 'العملاء',
    system: 'إشعارات النظام'
};

const NotificationSettings: React.FC = () => {
    const { state: pwaState, actions: pwaActions } = usePWA();
    const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
    const [subscriptions, setSubscriptions] = useState<{
        endpoint: string;
        device_name?: string;
        device_type?: string;
        browser?: string;
        is_active: boolean;
        created_at: string;
    }[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [enablingPush, setEnablingPush] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [prefs, subs] = await Promise.all([
                NotificationsAPI.getPreferences(),
                NotificationsAPI.getPushSubscriptions()
            ]);
            setPreferences(prefs);
            setSubscriptions(subs);
        } catch (error) {
            console.error('Error fetching notification settings:', error);
            toast.error('حدث خطأ في تحميل إعدادات الإشعارات');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleInApp = async (enabled: boolean) => {
        setSaving(true);
        try {
            const result = await NotificationsAPI.updatePreferences({ in_app_enabled: enabled });
            if (result.success && result.data) {
                setPreferences(result.data);
                toast.success(enabled ? 'تم تفعيل الإشعارات داخل التطبيق' : 'تم إيقاف الإشعارات داخل التطبيق');
            }
        } catch (error) {
            toast.error('حدث خطأ');
        } finally {
            setSaving(false);
        }
    };

    const handleTogglePush = async (enabled: boolean) => {
        setSaving(true);
        try {
            const result = await NotificationsAPI.updatePreferences({ push_enabled: enabled });
            if (result.success && result.data) {
                setPreferences(result.data);
                toast.success(enabled ? 'تم تفعيل إشعارات Push' : 'تم إيقاف إشعارات Push');
            }
        } catch (error) {
            toast.error('حدث خطأ');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleCategory = async (category: NotificationCategory, enabled: boolean) => {
        if (!preferences) return;

        setSaving(true);
        try {
            const newCategories = {
                ...preferences.categories,
                [category]: enabled
            };
            const result = await NotificationsAPI.updatePreferences({ categories: newCategories });
            if (result.success && result.data) {
                setPreferences(result.data);
                toast.success(`تم ${enabled ? 'تفعيل' : 'إيقاف'} إشعارات ${CATEGORY_LABELS[category]}`);
            }
        } catch (error) {
            toast.error('حدث خطأ');
        } finally {
            setSaving(false);
        }
    };

    const handleEnablePush = async () => {
        setEnablingPush(true);
        try {
            const permission = await pwaActions.requestNotificationPermission();
            if (permission !== 'granted') {
                toast.error('تم رفض إذن الإشعارات. يرجى تفعيلها من إعدادات المتصفح');
                return;
            }

            const subscription = await pwaActions.subscribeToNotifications();
            if (subscription) {
                const result = await NotificationsAPI.savePushSubscription(subscription);
                if (result.success) {
                    toast.success('تم تفعيل إشعارات Push بنجاح!');
                    await fetchData();
                } else {
                    toast.error(result.error || 'حدث خطأ في حفظ الاشتراك');
                }
            } else {
                toast.error('فشل في الاشتراك في الإشعارات');
            }
        } catch (error) {
            console.error('Error enabling push:', error);
            toast.error('حدث خطأ في تفعيل الإشعارات');
        } finally {
            setEnablingPush(false);
        }
    };

    const handleRemoveSubscription = async (endpoint: string) => {
        try {
            const result = await NotificationsAPI.removePushSubscription(endpoint);
            if (result.success) {
                setSubscriptions(prev => prev.filter(s => s.endpoint !== endpoint));
                toast.success('تم إزالة الجهاز');
            }
        } catch (error) {
            toast.error('حدث خطأ');
        }
    };

    const getDeviceIcon = (type?: string) => {
        if (type === 'mobile') return <Smartphone className="w-5 h-5" />;
        return <Monitor className="w-5 h-5" />;
    };

    if (loading) {
        return (
            <div className="card">
                <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="medium" text="جاري تحميل إعدادات الإشعارات..." />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Main Toggle Card */}
            <div className="card">
                <div className="card-header">
                    <div className="flex items-center">
                        <Bell className="h-6 w-6 text-primary-600 ml-2" />
                        <h3 className="card-title">إعدادات الإشعارات</h3>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* In-App Notifications */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            {preferences?.in_app_enabled ? (
                                <Bell className="w-5 h-5 text-primary-600" />
                            ) : (
                                <BellOff className="w-5 h-5 text-gray-400" />
                            )}
                            <div>
                                <p className="font-medium text-gray-900">الإشعارات داخل التطبيق</p>
                                <p className="text-sm text-gray-500">عرض الإشعارات في جرس الإشعارات</p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleToggleInApp(!preferences?.in_app_enabled)}
                            disabled={saving}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${preferences?.in_app_enabled ? 'bg-primary-600' : 'bg-gray-300'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${preferences?.in_app_enabled ? 'translate-x-1' : 'translate-x-6'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Push Notifications */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            {preferences?.push_enabled ? (
                                <Volume2 className="w-5 h-5 text-green-600" />
                            ) : (
                                <VolumeX className="w-5 h-5 text-gray-400" />
                            )}
                            <div>
                                <p className="font-medium text-gray-900">إشعارات Push</p>
                                <p className="text-sm text-gray-500">استلام إشعارات حتى عند إغلاق التطبيق</p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleTogglePush(!preferences?.push_enabled)}
                            disabled={saving}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${preferences?.push_enabled ? 'bg-green-600' : 'bg-gray-300'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${preferences?.push_enabled ? 'translate-x-1' : 'translate-x-6'
                                    }`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* Category Preferences */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">إشعارات حسب الفئة</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map((category) => (
                        <div
                            key={category}
                            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <span className="text-gray-700">{CATEGORY_LABELS[category]}</span>
                            <button
                                onClick={() => handleToggleCategory(category, !preferences?.categories?.[category])}
                                disabled={saving}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${preferences?.categories?.[category] !== false ? 'bg-primary-600' : 'bg-gray-300'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${preferences?.categories?.[category] !== false ? 'translate-x-1' : 'translate-x-5'
                                        }`}
                                />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Push Subscription Management */}
            <div className="card">
                <div className="card-header">
                    <div className="flex items-center justify-between">
                        <h3 className="card-title">الأجهزة المسجلة للإشعارات</h3>
                        {pwaState.isSupported && (
                            <button
                                onClick={handleEnablePush}
                                disabled={enablingPush}
                                className="btn-primary text-sm"
                            >
                                {enablingPush ? (
                                    <LoadingSpinner size="small" />
                                ) : (
                                    <>
                                        <Smartphone className="w-4 h-4 ml-1" />
                                        تفعيل على هذا الجهاز
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {subscriptions.length === 0 ? (
                    <div className="text-center py-8">
                        <Smartphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">لا توجد أجهزة مسجلة</p>
                        <p className="text-sm text-gray-400 mt-1">اضغط على "تفعيل على هذا الجهاز" لاستلام الإشعارات</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {subscriptions.map((sub, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    {getDeviceIcon(sub.device_type)}
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            {sub.device_name || sub.browser || 'جهاز غير معروف'}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {sub.device_type === 'mobile' ? 'هاتف' : 'كمبيوتر'} • {sub.browser}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {sub.is_active ? (
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-red-500" />
                                    )}
                                    <button
                                        onClick={() => handleRemoveSubscription(sub.endpoint)}
                                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        title="إزالة"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!pwaState.isSupported && (
                    <div className="mt-4 p-3 bg-yellow-50 text-yellow-700 rounded-lg text-sm">
                        ⚠️ متصفحك لا يدعم إشعارات Push. جرب استخدام Chrome أو Firefox أو Edge.
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationSettings;
