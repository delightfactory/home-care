// Notifications API Layer
import { supabase, handleSupabaseError } from '../lib/supabase';
import type {
    AppNotification,
    NotificationPreferences,
    PaginatedResponse,
    ApiResponse
} from '../types';

export interface NotificationFilters {
    category?: string;
    is_read?: boolean;
    from_date?: string;
    to_date?: string;
}

export class NotificationsAPI {
    /**
     * جلب الإشعارات مع pagination
     */
    static async getNotifications(
        page = 1,
        limit = 20,
        filters?: NotificationFilters
    ): Promise<PaginatedResponse<AppNotification>> {
        try {
            let query = supabase
                .from('notifications')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false });

            if (filters?.category) {
                query = query.eq('category', filters.category);
            }
            if (filters?.is_read !== undefined) {
                query = query.eq('is_read', filters.is_read);
            }
            if (filters?.from_date) {
                query = query.gte('created_at', filters.from_date);
            }
            if (filters?.to_date) {
                query = query.lte('created_at', filters.to_date);
            }

            const from = (page - 1) * limit;
            const to = from + limit - 1;

            const { data, error, count } = await query.range(from, to);

            if (error) throw error;

            return {
                data: data || [],
                total: count || 0,
                page,
                limit,
                total_pages: Math.ceil((count || 0) / limit)
            };
        } catch (error) {
            console.error('Error getting notifications:', error);
            return {
                data: [],
                total: 0,
                page,
                limit,
                total_pages: 0
            };
        }
    }

    /**
     * جلب عدد الإشعارات غير المقروءة
     */
    static async getUnreadCount(): Promise<number> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return 0;

            const { data, error } = await supabase
                .rpc('get_unread_notifications_count', { p_user_id: user.id });

            if (error) {
                console.error('Error getting unread count:', error);
                return 0;
            }

            return data || 0;
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }

    /**
     * جلب الإشعارات غير المقروءة الأخيرة
     */
    static async getRecentUnread(limit = 5): Promise<AppNotification[]> {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('is_read', false)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting recent unread:', error);
            return [];
        }
    }

    /**
     * تحديد إشعار كمقروء
     */
    static async markAsRead(notificationId: string): Promise<ApiResponse<void>> {
        try {
            const { error } = await supabase
                .rpc('mark_notification_read', { p_notification_id: notificationId });

            if (error) {
                return { success: false, error: handleSupabaseError(error) };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: 'حدث خطأ أثناء تحديث الإشعار' };
        }
    }

    /**
     * تحديد كل الإشعارات كمقروءة
     */
    static async markAllAsRead(): Promise<ApiResponse<number>> {
        try {
            const { data, error } = await supabase.rpc('mark_all_notifications_read');

            if (error) {
                return { success: false, error: handleSupabaseError(error) };
            }

            return { success: true, data };
        } catch (error) {
            return { success: false, error: 'حدث خطأ أثناء تحديث الإشعارات' };
        }
    }

    /**
     * حذف إشعار
     */
    static async deleteNotification(notificationId: string): Promise<ApiResponse<void>> {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId);

            if (error) {
                return { success: false, error: handleSupabaseError(error) };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: 'حدث خطأ أثناء حذف الإشعار' };
        }
    }

    /**
     * حذف كل الإشعارات المقروءة
     */
    static async deleteAllRead(): Promise<ApiResponse<void>> {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('is_read', true);

            if (error) {
                return { success: false, error: handleSupabaseError(error) };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: 'حدث خطأ أثناء حذف الإشعارات' };
        }
    }

    // =============== التفضيلات ===============

    /**
     * جلب تفضيلات الإشعارات
     */
    static async getPreferences(): Promise<NotificationPreferences | null> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data, error } = await supabase
                .from('notification_preferences')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error getting preferences:', error);
            }

            // إرجاع تفضيلات افتراضية إذا لم توجد (الإشعارات مفعلة بشكل افتراضي)
            if (!data) {
                const now = new Date().toISOString();
                return {
                    id: 'default',
                    user_id: user.id,
                    in_app_enabled: true,
                    push_enabled: true,
                    email_enabled: false,
                    quiet_hours_enabled: false,
                    categories: {
                        orders: true,
                        expenses: true,
                        routes: true,
                        teams: true,
                        customers: true,
                        system: true
                    },
                    created_at: now,
                    updated_at: now
                } as NotificationPreferences;
            }

            return data;
        } catch (error) {
            console.error('Error getting preferences:', error);
            return null;
        }
    }

    /**
     * تحديث تفضيلات الإشعارات
     */
    static async updatePreferences(
        preferences: Partial<NotificationPreferences>
    ): Promise<ApiResponse<NotificationPreferences>> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return { success: false, error: 'المستخدم غير مسجل' };
            }

            const { data, error } = await supabase
                .from('notification_preferences')
                .upsert({
                    user_id: user.id,
                    ...preferences,
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                return { success: false, error: handleSupabaseError(error) };
            }

            return { success: true, data };
        } catch (error) {
            return { success: false, error: 'حدث خطأ أثناء تحديث التفضيلات' };
        }
    }

    // =============== Push Subscriptions ===============

    /**
     * حفظ اشتراك Push
     */
    static async savePushSubscription(
        subscription: PushSubscription,
        deviceInfo?: { name?: string; type?: string; browser?: string }
    ): Promise<ApiResponse<void>> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return { success: false, error: 'المستخدم غير مسجل' };
            }

            const keys = subscription.toJSON().keys;

            const { error } = await supabase
                .from('push_subscriptions')
                .upsert({
                    user_id: user.id,
                    endpoint: subscription.endpoint,
                    p256dh_key: keys?.p256dh || '',
                    auth_key: keys?.auth || '',
                    device_name: deviceInfo?.name,
                    device_type: deviceInfo?.type || detectDeviceType(),
                    browser: deviceInfo?.browser || detectBrowser(),
                    user_agent: navigator.userAgent,
                    is_active: true,
                    last_used_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,endpoint'
                });

            if (error) {
                return { success: false, error: handleSupabaseError(error) };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: 'حدث خطأ أثناء حفظ الاشتراك' };
        }
    }

    /**
     * إلغاء اشتراك Push
     */
    static async removePushSubscription(endpoint: string): Promise<ApiResponse<void>> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return { success: false, error: 'المستخدم غير مسجل' };
            }

            const { error } = await supabase
                .from('push_subscriptions')
                .delete()
                .eq('endpoint', endpoint)
                .eq('user_id', user.id);

            if (error) {
                return { success: false, error: handleSupabaseError(error) };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: 'حدث خطأ أثناء إلغاء الاشتراك' };
        }
    }

    /**
     * جلب اشتراكات Push للمستخدم
     */
    static async getPushSubscriptions(): Promise<{
        endpoint: string;
        device_name?: string;
        device_type?: string;
        browser?: string;
        is_active: boolean;
        created_at: string;
    }[]> {
        try {
            const { data, error } = await supabase
                .from('push_subscriptions')
                .select('endpoint, device_name, device_type, browser, is_active, created_at')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting push subscriptions:', error);
            return [];
        }
    }
}

// =============== Helper Functions ===============

function detectDeviceType(): string {
    const ua = navigator.userAgent;
    if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
    if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
    return 'desktop';
}

function detectBrowser(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('SamsungBrowser')) return 'Samsung';
    if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    return 'Unknown';
}

export default NotificationsAPI;
