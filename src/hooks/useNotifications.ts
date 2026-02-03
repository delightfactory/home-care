import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { NotificationsAPI } from '../api/notifications';
import type { AppNotification } from '../types';
import { useAuth } from './useAuth';

interface UseNotificationsReturn {
    notifications: AppNotification[];
    unreadCount: number;
    isLoading: boolean;
    error: string | null;
    // Actions
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (notificationId: string) => Promise<void>;
    refresh: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    // Fetch initial notifications
    const fetchNotifications = useCallback(async () => {
        if (!user) return;

        setIsLoading(true);
        setError(null);

        try {
            const [notificationsResult, count] = await Promise.all([
                NotificationsAPI.getNotifications(1, 50),
                NotificationsAPI.getUnreadCount()
            ]);

            setNotifications(notificationsResult.data);
            setUnreadCount(count);
        } catch (err) {
            setError('حدث خطأ أثناء جلب الإشعارات');
            console.error('Error fetching notifications:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    // Subscribe to realtime updates
    useEffect(() => {
        if (!user) return;

        // Initial fetch
        fetchNotifications();

        // Subscribe to realtime changes
        const channel = supabase
            .channel('notifications_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    const newNotification = payload.new as AppNotification;
                    setNotifications(prev => [newNotification, ...prev]);
                    setUnreadCount(prev => prev + 1);

                    // Show browser notification if permission granted
                    if ('Notification' in window && Notification.permission === 'granted') {
                        try {
                            new Notification(newNotification.title, {
                                body: newNotification.message,
                                icon: '/icons/icon-192x192.png',
                                badge: '/icons/favicon-32x32.png',
                                dir: 'rtl',
                                lang: 'ar',
                                tag: newNotification.id
                            });
                        } catch (e) {
                            console.warn('Browser notification failed:', e);
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    const updatedNotification = payload.new as AppNotification;
                    setNotifications(prev =>
                        prev.map(n => n.id === updatedNotification.id ? updatedNotification : n)
                    );
                    // Update unread count if needed
                    if (updatedNotification.is_read) {
                        setUnreadCount(prev => Math.max(0, prev - 1));
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    const deletedId = (payload.old as { id: string }).id;
                    setNotifications(prev => {
                        const deleted = prev.find(n => n.id === deletedId);
                        if (deleted && !deleted.is_read) {
                            setUnreadCount(c => Math.max(0, c - 1));
                        }
                        return prev.filter(n => n.id !== deletedId);
                    });
                }
            )
            .subscribe();

        subscriptionRef.current = channel;

        return () => {
            if (subscriptionRef.current) {
                supabase.removeChannel(subscriptionRef.current);
            }
        };
    }, [user, fetchNotifications]);

    // Mark notification as read
    const markAsRead = useCallback(async (notificationId: string) => {
        const result = await NotificationsAPI.markAsRead(notificationId);
        if (result.success) {
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    }, []);

    // Mark all as read
    const markAllAsRead = useCallback(async () => {
        const result = await NotificationsAPI.markAllAsRead();
        if (result.success) {
            setNotifications(prev =>
                prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
            );
            setUnreadCount(0);
        }
    }, []);

    // Delete notification
    const deleteNotification = useCallback(async (notificationId: string) => {
        const notification = notifications.find(n => n.id === notificationId);
        const result = await NotificationsAPI.deleteNotification(notificationId);
        if (result.success) {
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
            if (notification && !notification.is_read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        }
    }, [notifications]);

    // Refresh
    const refresh = useCallback(async () => {
        await fetchNotifications();
    }, [fetchNotifications]);

    return {
        notifications,
        unreadCount,
        isLoading,
        error,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refresh
    };
}

export default useNotifications;
