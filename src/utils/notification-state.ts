// مصدر الإشعارات المشترك لمستخدم واحد: قراءة أولية واحدة، اشتراك Realtime واحد،
// ومصالحة موثوقة للعدد من الخادم بدلاً من الزيادة/النقصان المحلي المتراكم.
import { supabase } from '../lib/supabase';
import { NotificationsAPI, InboxIdentityChangedError } from '../api/notifications';
import type { AppNotification } from '../types';

export interface NotificationInboxState {
    userId: string;
    notifications: AppNotification[];
    unreadCount: number;
    isLoading: boolean;
    error: string | null;
}

const PAGE_SIZE = 50;
const RECONCILE_DELAY_MS = 250;
const FETCH_ERROR = 'حدث خطأ أثناء جلب الإشعارات';

// إشعارات المتصفح المعروضة في هذه الجلسة (محدودة الحجم) لمنع التكرار
const MAX_SHOWN_BROWSER_NOTIFICATIONS = 200;
const shownBrowserNotifications = new Set<string>();

const isExpired = (n: AppNotification) => Boolean(n.expires_at && Date.parse(n.expires_at) <= Date.now());
const countsAsUnread = (n: AppNotification) => !n.is_read && !isExpired(n);

function showBrowserNotification(notification: AppNotification) {
    if (shownBrowserNotifications.has(notification.id) || !countsAsUnread(notification)) return;
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;

    shownBrowserNotifications.add(notification.id);
    if (shownBrowserNotifications.size > MAX_SHOWN_BROWSER_NOTIFICATIONS) {
        shownBrowserNotifications.delete(shownBrowserNotifications.values().next().value as string);
    }
    try {
        new Notification(notification.title, {
            body: notification.message,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/favicon-32x32.png',
            dir: 'rtl',
            lang: 'ar',
            tag: notification.id
        });
    } catch (e) {
        console.warn('Browser notification failed:', e);
    }
}

export class NotificationInbox {
    private state: NotificationInboxState;
    private disposed = false;
    private inFlight: Promise<void> | null = null;
    private dirty = false;
    private reconcileTimer: ReturnType<typeof setTimeout> | null = null;
    private channel: ReturnType<typeof supabase.channel> | null = null;

    constructor(
        private readonly userId: string,
        private readonly onChange: (state: NotificationInboxState) => void
    ) {
        this.state = { userId, notifications: [], unreadCount: 0, isLoading: true, error: null };
    }

    start() {
        const filter = `user_id=eq.${this.userId}`;
        const table = { schema: 'public', table: 'notifications', filter };
        // اسم قناة فريد لكل مصدر حتى لا تعيد Realtime استخدام قناة مستهلك آخر أو تحذفها
        this.channel = supabase
            .channel(`notifications:${this.userId}:${Math.random().toString(36).slice(2)}`)
            .on('postgres_changes', { event: 'INSERT', ...table }, payload => this.onInsert(payload.new as AppNotification))
            .on('postgres_changes', { event: 'UPDATE', ...table }, payload => this.onUpdate(payload.new as AppNotification))
            .on('postgres_changes', { event: 'DELETE', ...table }, payload => this.onDelete((payload.old as { id?: string }).id))
            // كل اشتراك (أولي أو بعد إعادة الاتصال) قد يكون فاته أحداث: نصالح من الخادم
            .subscribe(status => { if (status === 'SUBSCRIBED') void this.reload(); });

        window.addEventListener('online', this.handleOnline);
        void this.reload();
    }

    dispose() {
        this.disposed = true;
        if (this.reconcileTimer) clearTimeout(this.reconcileTimer);
        this.reconcileTimer = null;
        window.removeEventListener('online', this.handleOnline);
        if (this.channel) void supabase.removeChannel(this.channel);
        this.channel = null;
    }

    // قراءة واحدة في كل مرة؛ أي حدث/تعديل أثناء القراءة يُسقط نتيجتها ويطلب قراءة لاحقة
    reload(): Promise<void> {
        if (this.disposed) return Promise.resolve();
        if (this.reconcileTimer) clearTimeout(this.reconcileTimer);
        this.reconcileTimer = null;
        if (this.inFlight) {
            this.dirty = true;
            return this.inFlight;
        }
        this.inFlight = this.readUntilClean().finally(() => { this.inFlight = null; });
        return this.inFlight;
    }

    async markAsRead(notificationId: string) {
        const result = await NotificationsAPI.markAsRead(notificationId);
        if (!result.success || this.disposed) return;
        const readAt = new Date().toISOString();
        this.patch(list => list.map(n => n.id === notificationId && !n.is_read ? { ...n, is_read: true, read_at: readAt } : n));
        this.requestReconcile();
    }

    async markAllAsRead() {
        const result = await NotificationsAPI.markAllAsRead();
        if (!result.success || this.disposed) return;
        const readAt = new Date().toISOString();
        this.patch(list => list.map(n => n.is_read ? n : { ...n, is_read: true, read_at: readAt }));
        this.requestReconcile();
    }

    async deleteNotification(notificationId: string) {
        const result = await NotificationsAPI.deleteNotification(notificationId);
        if (!result.success || this.disposed) return;
        this.patch(list => list.filter(n => n.id !== notificationId));
        this.requestReconcile();
    }

    private handleOnline = () => { void this.reload(); };

    private async readUntilClean() {
        do {
            this.dirty = false;
            try {
                const snapshot = await NotificationsAPI.getInboxSnapshot(this.userId, PAGE_SIZE);
                if (this.disposed) return;
                if (this.dirty) continue;
                this.set({ notifications: snapshot.notifications, unreadCount: snapshot.unreadCount, isLoading: false, error: null });
            } catch (err) {
                if (this.disposed) return;
                if (err instanceof InboxIdentityChangedError) {
                    console.warn('Notifications read skipped: user changed');
                    return;
                }
                console.error('Error fetching notifications:', err);
                // لا نحوّل الفشل إلى صفر: نُبقي آخر بيانات ناجحة ونُظهر الخطأ
                if (!this.dirty) this.set({ isLoading: false, error: FETCH_ERROR });
            }
        } while (this.dirty && !this.disposed);
    }

    private onInsert(notification: AppNotification) {
        if (this.disposed || notification.user_id !== this.userId) return;
        this.patch(list => list.some(n => n.id === notification.id) ? list : [notification, ...list]);
        showBrowserNotification(notification);
        this.requestReconcile();
    }

    private onUpdate(notification: AppNotification) {
        if (this.disposed || notification.user_id !== this.userId) return;
        this.patch(list => list.map(n => n.id === notification.id ? notification : n));
        this.requestReconcile();
    }

    private onDelete(notificationId: string | undefined) {
        if (this.disposed || !notificationId) return;
        this.patch(list => list.filter(n => n.id !== notificationId));
        this.requestReconcile();
    }

    // تحديث محلي فوري؛ يتغير العدد فقط بقدر انتقالات العناصر الموجودة فعلاً في القائمة
    // (فلا يُحسب الحدث والتعديل المتزامنان مرتين)، ثم تصحّحه المصالحة من الخادم.
    private patch(update: (list: AppNotification[]) => AppNotification[]) {
        const prev = this.state.notifications;
        const next = update(prev);
        if (next === prev) return;
        const unread = (list: AppNotification[]) => list.reduce((sum, n) => sum + (countsAsUnread(n) ? 1 : 0), 0);
        const unreadCount = Math.max(0, this.state.unreadCount + unread(next) - unread(prev));
        this.set({ notifications: next, unreadCount });
    }

    private requestReconcile() {
        if (this.disposed) return;
        if (this.inFlight) {
            this.dirty = true;
            return;
        }
        // دمج دفعات الأحداث المتتالية في قراءة واحدة دون تأجيلها إلى ما لا نهاية
        if (!this.reconcileTimer) {
            this.reconcileTimer = setTimeout(() => {
                this.reconcileTimer = null;
                void this.reload();
            }, RECONCILE_DELAY_MS);
        }
    }

    private set(partial: Partial<NotificationInboxState>) {
        if (this.disposed) return;
        this.state = { ...this.state, ...partial };
        this.onChange(this.state);
    }
}
