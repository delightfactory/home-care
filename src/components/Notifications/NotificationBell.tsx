import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, CheckCheck, Trash2, ExternalLink, X } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useNavigate, useLocation } from 'react-router-dom';
import type { AppNotification, NotificationCategory } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

// =============== Notification Item Component ===============
interface NotificationItemProps {
    notification: AppNotification;
    onMarkAsRead: (id: string) => void;
    onDelete: (id: string) => void;
    onClick: (notification: AppNotification) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
    notification,
    onMarkAsRead,
    onDelete,
    onClick
}) => {
    const getCategoryIcon = (category: NotificationCategory) => {
        const icons: Record<NotificationCategory, string> = {
            orders: '📦',
            expenses: '💰',
            routes: '🚗',
            teams: '👥',
            customers: '👤',
            system: '⚙️'
        };
        return icons[category] || '🔔';
    };

    const getCategoryColor = (category: NotificationCategory) => {
        const colors: Record<NotificationCategory, string> = {
            orders: 'bg-blue-100 border-blue-300',
            expenses: 'bg-green-100 border-green-300',
            routes: 'bg-purple-100 border-purple-300',
            teams: 'bg-orange-100 border-orange-300',
            customers: 'bg-pink-100 border-pink-300',
            system: 'bg-gray-100 border-gray-300'
        };
        return colors[category] || 'bg-gray-100 border-gray-300';
    };

    const getPriorityIndicator = (priority: string) => {
        if (priority === 'urgent') return 'border-r-4 border-r-red-500';
        if (priority === 'high') return 'border-r-4 border-r-orange-500';
        return '';
    };

    const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
        addSuffix: true,
        locale: ar
    });

    return (
        <div
            className={`
        p-3 cursor-pointer transition-all duration-200 border-b border-gray-100
        ${notification.is_read ? 'bg-white' : 'bg-blue-50/50'}
        ${getPriorityIndicator(notification.priority)}
        hover:bg-gray-50
      `}
            onClick={() => onClick(notification)}
        >
            <div className="flex items-start gap-3">
                {/* Category Icon */}
                <div className={`
          w-10 h-10 rounded-full flex items-center justify-center text-lg
          ${getCategoryColor(notification.category)}
        `}>
                    {getCategoryIcon(notification.category)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h4 className={`text-sm font-medium truncate ${notification.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                            {notification.title}
                        </h4>
                        {!notification.is_read && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                        {notification.message}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">{timeAgo}</span>
                        <div className="flex items-center gap-1">
                            {!notification.is_read && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMarkAsRead(notification.id);
                                    }}
                                    className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                    title="تحديد كمقروء"
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(notification.id);
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="حذف"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// =============== Notifications Panel Component ===============
interface NotificationsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ isOpen, onClose }) => {
    const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
    const navigate = useNavigate();
    const location = useLocation();
    const panelRef = useRef<HTMLDivElement>(null);

    // Detect if in technician app
    const isTechApp = location.pathname.startsWith('/tech');

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    const handleNotificationClick = async (notification: AppNotification) => {
        if (!notification.is_read) {
            await markAsRead(notification.id);
        }
        if (notification.action_url) {
            let targetUrl = notification.action_url;

            // ⚠️ CRITICAL: Transform URLs for tech app to prevent navigation to main app
            if (isTechApp && !targetUrl.startsWith('/tech')) {
                // Map main app routes to tech app equivalents
                if (targetUrl.startsWith('/messages')) {
                    targetUrl = targetUrl.replace('/messages', '/tech/messages');
                } else if (targetUrl.startsWith('/notifications')) {
                    targetUrl = targetUrl.replace('/notifications', '/tech/notifications');
                } else {
                    // For other routes (orders, expenses, etc.) that don't have tech equivalents,
                    // redirect to tech dashboard instead of breaking security
                    console.warn(`[TechApp] Blocked navigation to non-tech route: ${targetUrl}`);
                    targetUrl = '/tech';
                }
            }

            navigate(targetUrl);
            onClose();
        }
    };

    if (!isOpen) return null;

    // Use Portal to render outside the DOM hierarchy - fixes positioning issues in main app
    return createPortal(
        <>
            {/* Mobile Overlay - z-[60] to be above header (z-40) and sidebar overlay (z-40) */}
            <div
                className="fixed inset-0 bg-black/40 z-[60] sm:hidden backdrop-blur-sm"
                onClick={onClose}
            />

            <div
                ref={panelRef}
                className="
                    fixed sm:absolute z-[70]
                    inset-x-0 bottom-0 sm:inset-auto sm:top-full sm:right-0
                    sm:mt-2 sm:w-96 sm:max-w-[calc(100vw-1rem)]
                    bg-white sm:rounded-xl rounded-t-3xl
                    shadow-2xl sm:border border-t border-gray-200
                    flex flex-col
                    max-h-[75vh] sm:max-h-[70vh]
                "
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
                {/* Drag Handle - Mobile Only */}
                <div className="sm:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
                    <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                {/* Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white sm:rounded-t-xl flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bell className="w-5 h-5" />
                            <h3 className="font-semibold text-base">الإشعارات</h3>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">
                                    {unreadCount} جديد
                                </span>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Actions Bar */}
                {unreadCount > 0 && (
                    <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/80 flex-shrink-0">
                        <button
                            onClick={markAllAsRead}
                            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 transition-colors"
                        >
                            <CheckCheck className="w-4 h-4" />
                            تحديد الكل كمقروء
                        </button>
                    </div>
                )}

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
                    {isLoading ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
                            <p className="mt-3 text-gray-500 text-sm">جاري التحميل...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="p-10 text-center">
                            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Bell className="w-7 h-7 text-gray-400" />
                            </div>
                            <p className="text-gray-600 font-medium">لا توجد إشعارات</p>
                            <p className="text-gray-400 text-sm mt-1">ستظهر هنا عند وصولها</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {notifications.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onMarkAsRead={markAsRead}
                                    onDelete={deleteNotification}
                                    onClick={handleNotificationClick}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/80 flex-shrink-0">
                        <button
                            onClick={() => {
                                navigate(isTechApp ? '/tech/notifications' : '/notifications');
                                onClose();
                            }}
                            className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                            عرض كل الإشعارات
                            <ExternalLink className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </>,
        document.body
    );
};

// =============== Notification Bell Component ===============
const NotificationBell: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { unreadCount } = useNotifications();

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
            >
                <Bell className="h-6 w-6" />
            </button>

            {/* Badge */}
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}

            {/* Panel */}
            <NotificationsPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </div>
    );
};

export default NotificationBell;
export { NotificationsPanel, NotificationItem };
