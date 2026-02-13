// components/Notifications/PushNotificationPrompt.tsx
// مكون احترافي لطلب تفعيل إشعارات Push بنمط "Soft Ask"

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, Sparkles, Shield, Clock, CheckCircle2 } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import toast from 'react-hot-toast';

interface PushNotificationPromptProps {
    delay?: number; // تأخير قبل الظهور (بالمللي ثانية)
    variant?: 'banner' | 'modal' | 'floating';
}

const PushNotificationPrompt: React.FC<PushNotificationPromptProps> = ({
    delay = 5000,
    variant = 'floating'
}) => {
    const { shouldShowPrompt, subscribe, dismissPrompt, isLoading } = usePushNotifications();
    const [isVisible, setIsVisible] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isSubscribing, setIsSubscribing] = useState(false);

    // تأخير الظهور
    useEffect(() => {
        if (shouldShowPrompt) {
            const timer = setTimeout(() => {
                setIsVisible(true);
                setTimeout(() => setIsAnimating(true), 50);
            }, delay);
            return () => clearTimeout(timer);
        }
    }, [shouldShowPrompt, delay]);

    const handleSubscribe = async () => {
        setIsSubscribing(true);
        const result = await subscribe();
        setIsSubscribing(false);

        if (result.success) {
            toast.success('تم تفعيل الإشعارات بنجاح! 🎉', {
                duration: 3000,
                position: 'top-center',
            });
            handleClose();
        } else {
            // عرض رسالة خطأ محددة بناءً على نوع الخطأ
            const errorMessage = result.errorMessage || 'لم نتمكن من تفعيل الإشعارات';

            // استخدام toast مخصص للأخطاء المتعلقة بالإذن
            if (result.error === 'permission_blocked' || result.error === 'permission_denied') {
                toast.error(
                    (_t) => (
                        <div className="flex flex-col gap-1">
                            <span className="font-medium">⚠️ {result.error === 'permission_blocked' ? 'الإشعارات محظورة' : 'تم رفض الإشعارات'}</span>
                            <span className="text-sm opacity-90">{errorMessage}</span>
                        </div>
                    ),
                    { duration: 6000 }
                );
            } else {
                toast.error(errorMessage, { duration: 4000 });
            }

            // إغلاق الـ prompt في حالة الحظر (لأن المستخدم لن يتمكن من التفعيل)
            if (result.error === 'permission_blocked') {
                handleClose();
            }
        }
    };

    const handleClose = () => {
        setIsAnimating(false);
        setTimeout(() => {
            setIsVisible(false);
            dismissPrompt();
        }, 300);
    };

    if (!isVisible || isLoading) return null;

    // Floating variant (الافتراضي - يظهر في الزاوية)
    if (variant === 'floating') {
        return createPortal(
            <div
                className={`
                    fixed z-[100] transition-all duration-300 ease-out
                    bottom-20 right-4 left-4 sm:left-auto sm:w-[380px]
                    ${isAnimating
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-4'
                    }
                `}
            >
                <div className="relative overflow-hidden rounded-2xl shadow-2xl border border-white/20">
                    {/* Gradient Background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700" />

                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

                    {/* Content */}
                    <div className="relative p-5">
                        {/* Close Button */}
                        <button
                            onClick={handleClose}
                            className="absolute top-3 left-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                            aria-label="إغلاق"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Icon */}
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <div className="w-14 h-14 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                                    <Bell className="w-7 h-7 text-white animate-pulse" />
                                </div>
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-bold text-white mb-1">
                                    لا تفوت أي تحديث! 🔔
                                </h3>
                                <p className="text-white/80 text-sm leading-relaxed">
                                    فعّل الإشعارات لتبقى على اطلاع بآخر المستجدات لحظة بلحظة
                                </p>
                            </div>
                        </div>

                        {/* Benefits */}
                        <div className="mt-4 space-y-2">
                            <div className="flex items-center gap-2 text-white/90 text-sm">
                                <Sparkles className="w-4 h-4 text-yellow-300" />
                                <span>تنبيهات فورية للطلبات الجديدة</span>
                            </div>
                            <div className="flex items-center gap-2 text-white/90 text-sm">
                                <Clock className="w-4 h-4 text-green-300" />
                                <span>متابعة حالة المهام في الوقت الفعلي</span>
                            </div>
                            <div className="flex items-center gap-2 text-white/90 text-sm">
                                <Shield className="w-4 h-4 text-blue-300" />
                                <span>يمكنك إلغاء التفعيل في أي وقت</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-5 flex gap-3">
                            <button
                                onClick={handleSubscribe}
                                disabled={isSubscribing}
                                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-white text-indigo-700 font-semibold rounded-xl hover:bg-white/90 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isSubscribing ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                        <span>جاري التفعيل...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-5 h-5" />
                                        <span>تفعيل الإشعارات</span>
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handleClose}
                                className="px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors font-medium"
                            >
                                لاحقاً
                            </button>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    // Banner variant (شريط علوي)
    if (variant === 'banner') {
        return createPortal(
            <div
                className={`
                    fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ease-out
                    ${isAnimating
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 -translate-y-full'
                    }
                `}
            >
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-4 py-3 shadow-lg">
                    <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
                                <Bell className="w-5 h-5 animate-pulse" />
                            </div>
                            <div>
                                <p className="font-semibold text-sm sm:text-base">
                                    فعّل الإشعارات لتلقي التحديثات الفورية
                                </p>
                                <p className="text-white/70 text-xs sm:text-sm hidden sm:block">
                                    ابقَ على اطلاع بآخر المستجدات لحظة بلحظة
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSubscribe}
                                disabled={isSubscribing}
                                className="px-4 py-2 bg-white text-indigo-700 font-semibold rounded-lg hover:bg-white/90 transition-colors text-sm disabled:opacity-70"
                            >
                                {isSubscribing ? 'جاري التفعيل...' : 'تفعيل'}
                            </button>
                            <button
                                onClick={handleClose}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    // Modal variant (نافذة منبثقة مركزية)
    if (variant === 'modal') {
        return createPortal(
            <>
                {/* Overlay */}
                <div
                    className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'
                        }`}
                    onClick={handleClose}
                />

                {/* Modal */}
                <div
                    className={`
                        fixed z-[101] inset-0 flex items-center justify-center p-4
                        transition-all duration-300 ease-out
                        ${isAnimating
                            ? 'opacity-100 scale-100'
                            : 'opacity-0 scale-95'
                        }
                    `}
                >
                    <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
                        {/* Top Gradient */}
                        <div className="h-28 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 relative">
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                                    <Bell className="w-10 h-10 text-indigo-600" />
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="absolute top-4 left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 text-center">
                            <h2 className="text-xl font-bold text-gray-900 mb-2">
                                ابقَ على اتصال دائم! 🔔
                            </h2>
                            <p className="text-gray-600 mb-6">
                                فعّل الإشعارات لتلقي التنبيهات الفورية للطلبات والمهام والتحديثات المهمة
                            </p>

                            {/* Benefits */}
                            <div className="bg-gray-50 rounded-2xl p-4 mb-6 space-y-3 text-right">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                        <Sparkles className="w-4 h-4 text-green-600" />
                                    </div>
                                    <span className="text-gray-700 text-sm">إشعارات فورية للطلبات الجديدة</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <Clock className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <span className="text-gray-700 text-sm">متابعة المهام في الوقت الفعلي</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                        <Shield className="w-4 h-4 text-purple-600" />
                                    </div>
                                    <span className="text-gray-700 text-sm">يمكنك إلغاء التفعيل في أي وقت</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-3">
                                <button
                                    onClick={handleSubscribe}
                                    disabled={isSubscribing}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-70"
                                >
                                    {isSubscribing ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>جاري التفعيل...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-5 h-5" />
                                            <span>تفعيل الإشعارات</span>
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handleClose}
                                    className="w-full px-6 py-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                                >
                                    ليس الآن
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </>,
            document.body
        );
    }

    return null;
};

export default PushNotificationPrompt;
