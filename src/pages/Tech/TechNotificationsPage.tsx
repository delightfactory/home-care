// TechNotificationsPage - صفحة إشعارات الفني
import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, Trash2, RefreshCw } from 'lucide-react';
import TechLayout from '../../components/Layout/TechLayout';
import { NotificationsAPI } from '../../api/notifications';
import type { AppNotification, NotificationCategory } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import toast from 'react-hot-toast';

const CATEGORY_ICONS: Record<NotificationCategory, string> = {
    orders: '📦',
    expenses: '💰',
    routes: '🚗',
    teams: '👥',
    customers: '👤',
    system: '⚙️'
};

const CATEGORY_COLORS: Record<NotificationCategory, string> = {
    orders: 'bg-blue-100 text-blue-700',
    expenses: 'bg-green-100 text-green-700',
    routes: 'bg-purple-100 text-purple-700',
    teams: 'bg-orange-100 text-orange-700',
    customers: 'bg-pink-100 text-pink-700',
    system: 'bg-gray-100 text-gray-700'
};

const TechNotificationsPage: React.FC = () => {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        try {
            const [result, count] = await Promise.all([
                NotificationsAPI.getNotifications(1, 50),
                NotificationsAPI.getUnreadCount()
            ]);
            setNotifications(result.data);
            setUnreadCount(count);
        } catch (error) {
            console.error('Error fetching notifications:', error);
            toast.error('حدث خطأ في تحميل الإشعارات');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    const handleMarkAsRead = async (notificationId: string) => {
        const result = await NotificationsAPI.markAsRead(notificationId);
        if (result.success) {
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };

    const handleMarkAllAsRead = async () => {
        const result = await NotificationsAPI.markAllAsRead();
        if (result.success) {
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
            toast.success('تم تحديد الكل كمقروء');
        }
    };

    const handleDelete = async (notificationId: string) => {
        const notification = notifications.find(n => n.id === notificationId);
        const result = await NotificationsAPI.deleteNotification(notificationId);
        if (result.success) {
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
            if (notification && !notification.is_read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
            toast.success('تم حذف الإشعار');
        }
    };

    const getPriorityBorder = (priority: string) => {
        if (priority === 'urgent') return 'border-r-4 border-r-red-500';
        if (priority === 'high') return 'border-r-4 border-r-orange-500';
        return 'border-r-4 border-r-transparent';
    };

    return (
        <TechLayout onRefresh={handleRefresh}>
            <div className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Bell className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-800">الإشعارات</h1>
                            {unreadCount > 0 && (
                                <p className="text-sm text-blue-600">{unreadCount} غير مقروء</p>
                            )}
                        </div>
                    </div>

                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllAsRead}
                            className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                        >
                            <CheckCheck className="w-4 h-4" />
                            <span className="hidden sm:inline">قراءة الكل</span>
                        </button>
                    )}
                </div>

                {/* Notifications List */}
                <div className="space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="text-center">
                                <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
                                <p className="mt-3 text-gray-500">جاري التحميل...</p>
                            </div>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl shadow-sm">
                            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-1">لا توجد إشعارات</h3>
                            <p className="text-gray-500">ستظهر الإشعارات هنا عند وصولها</p>
                        </div>
                    ) : (
                        notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`
                                    bg-white rounded-xl shadow-sm p-4 transition-all
                                    ${!notification.is_read ? 'ring-2 ring-blue-100' : ''}
                                    ${getPriorityBorder(notification.priority)}
                                `}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Category Icon */}
                                    <div className={`
                                        w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0
                                        ${CATEGORY_COLORS[notification.category] || CATEGORY_COLORS.system}
                                    `}>
                                        {CATEGORY_ICONS[notification.category] || '🔔'}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className={`font-semibold text-base ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                                                        {notification.title}
                                                    </h4>
                                                    {!notification.is_read && (
                                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                                                    )}
                                                </div>
                                                <p className="text-gray-600 text-sm leading-relaxed">
                                                    {notification.message}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-2">
                                                    {formatDistanceToNow(new Date(notification.created_at), {
                                                        addSuffix: true,
                                                        locale: ar
                                                    })}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                                            {!notification.is_read && (
                                                <button
                                                    onClick={() => handleMarkAsRead(notification.id)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                                >
                                                    <Check className="w-4 h-4" />
                                                    تحديد كمقروء
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(notification.id)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                حذف
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Refresh Button */}
                {!loading && notifications.length > 0 && (
                    <div className="text-center pt-4">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                            تحديث الإشعارات
                        </button>
                    </div>
                )}
            </div>
        </TechLayout>
    );
};

export default TechNotificationsPage;
