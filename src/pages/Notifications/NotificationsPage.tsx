import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Filter, CheckCheck, Trash2, Search, ChevronRight, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NotificationsAPI } from '../../api/notifications';
import type { AppNotification, NotificationCategory } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import toast from 'react-hot-toast';

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
    orders: 'الطلبات',
    expenses: 'المصروفات',
    routes: 'المسارات',
    teams: 'الفرق',
    customers: 'العملاء',
    system: 'النظام'
};

const CATEGORY_COLORS: Record<NotificationCategory, string> = {
    orders: 'bg-blue-100 text-blue-700',
    expenses: 'bg-green-100 text-green-700',
    routes: 'bg-orange-100 text-orange-700',
    teams: 'bg-purple-100 text-purple-700',
    customers: 'bg-pink-100 text-pink-700',
    system: 'bg-gray-100 text-gray-700'
};

const NotificationsPage: React.FC = () => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [unreadCount, setUnreadCount] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | 'all'>('all');
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchNotifications = useCallback(async (pageNum = 1, append = false) => {
        if (pageNum === 1) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }

        try {
            const activeFilters: { category?: string; is_read?: boolean } = {};
            if (selectedCategory !== 'all') {
                activeFilters.category = selectedCategory;
            }
            if (showUnreadOnly) {
                activeFilters.is_read = false;
            }

            const [result, count] = await Promise.all([
                NotificationsAPI.getNotifications(pageNum, 20, activeFilters),
                NotificationsAPI.getUnreadCount()
            ]);

            if (append) {
                setNotifications(prev => [...prev, ...result.data]);
            } else {
                setNotifications(result.data);
            }
            setTotalPages(result.total_pages);
            setUnreadCount(count);
        } catch (error) {
            console.error('Error fetching notifications:', error);
            toast.error('حدث خطأ في تحميل الإشعارات');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [selectedCategory, showUnreadOnly]);

    useEffect(() => {
        fetchNotifications(1);
        setPage(1);
    }, [selectedCategory, showUnreadOnly]);

    const handleLoadMore = () => {
        if (page < totalPages) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchNotifications(nextPage, true);
        }
    };

    const handleMarkAsRead = async (notification: AppNotification) => {
        if (notification.is_read) return;

        const result = await NotificationsAPI.markAsRead(notification.id);
        if (result.success) {
            setNotifications(prev =>
                prev.map(n => n.id === notification.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };

    const handleNotificationClick = async (notification: AppNotification) => {
        await handleMarkAsRead(notification);
        if (notification.action_url) {
            navigate(notification.action_url);
        }
    };

    const handleMarkAllAsRead = async () => {
        const result = await NotificationsAPI.markAllAsRead();
        if (result.success) {
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
            setUnreadCount(0);
            toast.success(`تم تحديث ${result.data || 0} إشعارات كمقروءة`);
        }
    };

    const handleDeleteNotification = async (notificationId: string) => {
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

    const handleDeleteAllRead = async () => {
        const result = await NotificationsAPI.deleteAllRead();
        if (result.success) {
            setNotifications(prev => prev.filter(n => !n.is_read));
            toast.success('تم حذف الإشعارات المقروءة');
        }
    };

    const filteredNotifications = searchQuery
        ? notifications.filter(n =>
            n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.message.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : notifications;

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'border-r-4 border-r-red-500';
            case 'high': return 'border-r-4 border-r-orange-500';
            case 'medium': return 'border-r-4 border-r-yellow-500';
            default: return 'border-r-4 border-r-gray-300';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Bell className="w-7 h-7 text-primary-600" />
                        الإشعارات
                        {unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-sm px-2 py-0.5 rounded-full">
                                {unreadCount} غير مقروء
                            </span>
                        )}
                    </h1>
                    <p className="text-gray-600 mt-1">إدارة ومتابعة جميع الإشعارات</p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchNotifications(1)}
                        className="btn-secondary"
                        title="تحديث"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAllAsRead}
                            className="btn-secondary"
                        >
                            <CheckCheck className="w-4 h-4 ml-1" />
                            تحديد الكل كمقروء
                        </button>
                    )}
                    <button
                        onClick={handleDeleteAllRead}
                        className="btn-secondary text-red-600 hover:bg-red-50"
                    >
                        <Trash2 className="w-4 h-4 ml-1" />
                        حذف المقروءة
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="بحث في الإشعارات..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input pr-10"
                        />
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-gray-500" />
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value as NotificationCategory | 'all')}
                            className="input"
                        >
                            <option value="all">كل الفئات</option>
                            {(Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map(cat => (
                                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                            ))}
                        </select>
                    </div>

                    {/* Unread Only Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showUnreadOnly}
                            onChange={(e) => setShowUnreadOnly(e.target.checked)}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-gray-700">غير المقروءة فقط</span>
                    </label>
                </div>
            </div>

            {/* Notifications List */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <LoadingSpinner size="large" text="جاري تحميل الإشعارات..." />
                </div>
            ) : filteredNotifications.length === 0 ? (
                <div className="card text-center py-12">
                    <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">لا توجد إشعارات</h3>
                    <p className="text-gray-500">
                        {showUnreadOnly ? 'لا توجد إشعارات غير مقروءة' : 'ستظهر الإشعارات هنا عند وصولها'}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredNotifications.map((notification) => (
                        <div
                            key={notification.id}
                            className={`card p-4 cursor-pointer hover:shadow-md transition-all ${!notification.is_read ? 'bg-blue-50/50' : ''
                                } ${getPriorityColor(notification.priority)}`}
                            onClick={() => handleNotificationClick(notification)}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[notification.category as NotificationCategory] || CATEGORY_COLORS.system
                                            }`}>
                                            {CATEGORY_LABELS[notification.category as NotificationCategory] || notification.category}
                                        </span>
                                        {!notification.is_read && (
                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        )}
                                        <span className="text-xs text-gray-500">
                                            {formatDistanceToNow(new Date(notification.created_at), {
                                                addSuffix: true,
                                                locale: ar
                                            })}
                                        </span>
                                    </div>
                                    <h4 className={`font-medium ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                                        {notification.title}
                                    </h4>
                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                        {notification.message}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    {notification.action_url && (
                                        <ChevronRight className="w-5 h-5 text-gray-400" />
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteNotification(notification.id);
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        title="حذف"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Load More */}
                    {page < totalPages && (
                        <div className="text-center pt-4">
                            <button
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                                className="btn-secondary"
                            >
                                {loadingMore ? (
                                    <LoadingSpinner size="small" />
                                ) : (
                                    'تحميل المزيد'
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationsPage;
