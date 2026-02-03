// hooks/usePushNotifications.ts
// Hook لإدارة تسجيل إشعارات Push بشكل تلقائي

import { useState, useEffect, useCallback } from 'react';
import { NotificationsAPI } from '../api/notifications';
import { useAuth } from './useAuth';

// أنواع أخطاء الاشتراك
export type PushSubscriptionError =
    | 'not_supported'      // المتصفح لا يدعم
    | 'permission_denied'  // المستخدم رفض الإذن
    | 'permission_blocked' // المتصفح يمنع الإشعارات
    | 'service_worker'     // خطأ في Service Worker
    | 'vapid_key'          // مفتاح VAPID مفقود
    | 'save_failed'        // فشل حفظ الاشتراك
    | 'unknown';           // خطأ غير معروف

export interface SubscriptionResult {
    success: boolean;
    error?: PushSubscriptionError;
    errorMessage?: string;
}

interface UsePushNotificationsReturn {
    isSupported: boolean;
    isSubscribed: boolean;
    isLoading: boolean;
    permission: NotificationPermission | 'unsupported';
    promptDismissed: boolean;
    subscribe: () => Promise<SubscriptionResult>;
    unsubscribe: () => Promise<boolean>;
    dismissPrompt: () => void;
    shouldShowPrompt: boolean;
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const PROMPT_DISMISSED_KEY = 'push_notification_prompt_dismissed';
const PROMPT_DISMISSED_UNTIL_KEY = 'push_notification_prompt_dismissed_until';

export function usePushNotifications(): UsePushNotificationsReturn {
    const { user } = useAuth();
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
    const [promptDismissed, setPromptDismissed] = useState(false);

    // التحقق من دعم المتصفح
    const isSupported = 'Notification' in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window;

    // التحقق من حالة الإذن والاشتراك
    const checkSubscriptionStatus = useCallback(async () => {
        if (!isSupported || !user) {
            setIsLoading(false);
            setPermission('unsupported');
            return;
        }

        try {
            // التحقق من إذن الإشعارات
            setPermission(Notification.permission);

            // التحقق من الاشتراك الحالي
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            setIsSubscribed(!!subscription);

            // التحقق من حالة التجاهل
            const dismissedUntil = localStorage.getItem(PROMPT_DISMISSED_UNTIL_KEY);
            if (dismissedUntil) {
                const dismissedDate = new Date(dismissedUntil);
                if (dismissedDate > new Date()) {
                    setPromptDismissed(true);
                } else {
                    localStorage.removeItem(PROMPT_DISMISSED_UNTIL_KEY);
                    localStorage.removeItem(PROMPT_DISMISSED_KEY);
                }
            } else {
                setPromptDismissed(localStorage.getItem(PROMPT_DISMISSED_KEY) === 'true');
            }

        } catch (error) {
            console.error('Error checking push subscription:', error);
        } finally {
            setIsLoading(false);
        }
    }, [isSupported, user]);

    useEffect(() => {
        checkSubscriptionStatus();
    }, [checkSubscriptionStatus]);

    // الاشتراك في Push Notifications
    const subscribe = useCallback(async (): Promise<SubscriptionResult> => {
        console.log('[Push] Starting subscription...', { isSupported, hasUser: !!user });

        // التحقق من الدعم
        if (!isSupported) {
            console.log('[Push] Browser not supported');
            return {
                success: false,
                error: 'not_supported',
                errorMessage: 'متصفحك لا يدعم إشعارات Push. جرب Chrome أو Firefox أو Edge.'
            };
        }

        if (!user) {
            console.log('[Push] No user logged in');
            return {
                success: false,
                error: 'not_supported',
                errorMessage: 'يجب تسجيل الدخول أولاً'
            };
        }

        setIsLoading(true);
        try {
            // التحقق من حالة الإذن قبل الطلب
            if (Notification.permission === 'denied') {
                console.log('[Push] Permission already denied');
                return {
                    success: false,
                    error: 'permission_blocked',
                    errorMessage: 'الإشعارات محظورة في متصفحك. افتح إعدادات الموقع وغيّر إذن الإشعارات إلى "السماح".'
                };
            }

            // طلب إذن الإشعارات
            console.log('[Push] Requesting permission...');
            const permissionResult = await Notification.requestPermission();
            setPermission(permissionResult);
            console.log('[Push] Permission result:', permissionResult);

            if (permissionResult === 'denied') {
                console.log('[Push] Permission denied by user');
                return {
                    success: false,
                    error: 'permission_denied',
                    errorMessage: 'لقد رفضت الإشعارات. لتفعيلها لاحقاً، افتح إعدادات الموقع في المتصفح.'
                };
            }

            if (permissionResult !== 'granted') {
                console.log('[Push] Permission not granted');
                return {
                    success: false,
                    error: 'permission_denied',
                    errorMessage: 'لم يتم السماح بالإشعارات. حاول مرة أخرى.'
                };
            }

            // التسجيل في Service Worker
            console.log('[Push] Waiting for service worker...');
            let registration;
            try {
                registration = await navigator.serviceWorker.ready;
                console.log('[Push] Service worker ready:', registration.scope);
            } catch (swError) {
                console.error('[Push] Service worker error:', swError);
                return {
                    success: false,
                    error: 'service_worker',
                    errorMessage: 'حدث خطأ في تسجيل الخدمة. أعد تحميل الصفحة وحاول مرة أخرى.'
                };
            }

            // تحويل VAPID key إلى Uint8Array
            console.log('[Push] VAPID Key:', VAPID_PUBLIC_KEY ? 'exists' : 'MISSING!');
            if (!VAPID_PUBLIC_KEY) {
                console.error('[Push] VAPID_PUBLIC_KEY is not defined!');
                return {
                    success: false,
                    error: 'vapid_key',
                    errorMessage: 'خطأ في إعدادات النظام. تواصل مع الدعم الفني.'
                };
            }
            const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            console.log('[Push] Application server key generated');

            // إنشاء اشتراك Push
            console.log('[Push] Creating push subscription...');
            let subscription;
            try {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey.buffer as ArrayBuffer
                });
                console.log('[Push] Subscription created:', subscription.endpoint);
            } catch (subscribeError) {
                console.error('[Push] Push subscription error:', subscribeError);
                return {
                    success: false,
                    error: 'service_worker',
                    errorMessage: 'فشل إنشاء الاشتراك. تأكد أنك متصل بالإنترنت وحاول مرة أخرى.'
                };
            }

            // إرسال الاشتراك للخادم
            console.log('[Push] Saving subscription to server...');
            const result = await NotificationsAPI.savePushSubscription(subscription);
            console.log('[Push] Save result:', result);

            if (result.success) {
                setIsSubscribed(true);
                // إخفاء prompt بعد الاشتراك الناجح
                localStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
                setPromptDismissed(true);
                console.log('[Push] Subscription successful!');
                return { success: true };
            } else {
                console.error('[Push] Failed to save subscription:', result.error);
                return {
                    success: false,
                    error: 'save_failed',
                    errorMessage: result.error || 'فشل حفظ الاشتراك. حاول مرة أخرى.'
                };
            }

        } catch (error) {
            console.error('[Push] Error subscribing to push:', error);
            return {
                success: false,
                error: 'unknown',
                errorMessage: 'حدث خطأ غير متوقع. حاول مرة أخرى لاحقاً.'
            };
        } finally {
            setIsLoading(false);
        }
    }, [isSupported, user]);

    // إلغاء الاشتراك
    const unsubscribe = useCallback(async (): Promise<boolean> => {
        if (!isSupported) return false;

        setIsLoading(true);
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // إلغاء الاشتراك من المتصفح
                await subscription.unsubscribe();

                // إزالة من قاعدة البيانات
                await NotificationsAPI.removePushSubscription(subscription.endpoint);
            }

            setIsSubscribed(false);
            return true;

        } catch (error) {
            console.error('Error unsubscribing from push:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [isSupported]);

    // تجاهل الـ prompt
    const dismissPrompt = useCallback(() => {
        // تجاهل لمدة 7 أيام
        const dismissUntil = new Date();
        dismissUntil.setDate(dismissUntil.getDate() + 7);
        localStorage.setItem(PROMPT_DISMISSED_UNTIL_KEY, dismissUntil.toISOString());
        localStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
        setPromptDismissed(true);
    }, []);

    // هل يجب عرض الـ prompt؟
    const shouldShowPrompt = isSupported &&
        !isLoading &&
        !isSubscribed &&
        permission !== 'denied' &&
        !promptDismissed &&
        !!user;

    return {
        isSupported,
        isSubscribed,
        isLoading,
        permission,
        promptDismissed,
        subscribe,
        unsubscribe,
        dismissPrompt,
        shouldShowPrompt
    };
}

// تحويل VAPID key من Base64 URL إلى Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export default usePushNotifications;
