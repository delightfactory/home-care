/**
 * Toast للإشعارات المتعلقة بالمكالمات
 * يعرض إشعارات مؤقتة للمستخدم
 */

import React, { useEffect } from 'react'
import { PhoneMissed, PhoneOff, AlertCircle, CheckCircle, X } from 'lucide-react'

export type CallToastType = 'missed' | 'rejected' | 'busy' | 'error' | 'success'

interface CallToastProps {
    isVisible: boolean
    type: CallToastType
    message: string
    callerName?: string
    onClose: () => void
    duration?: number // مدة العرض بالميلي ثانية
}

const toastConfig = {
    missed: {
        icon: PhoneMissed,
        bgColor: 'bg-orange-500',
        textColor: 'text-white',
        borderColor: 'border-orange-600'
    },
    rejected: {
        icon: PhoneOff,
        bgColor: 'bg-red-500',
        textColor: 'text-white',
        borderColor: 'border-red-600'
    },
    busy: {
        icon: PhoneOff,
        bgColor: 'bg-yellow-500',
        textColor: 'text-white',
        borderColor: 'border-yellow-600'
    },
    error: {
        icon: AlertCircle,
        bgColor: 'bg-red-500',
        textColor: 'text-white',
        borderColor: 'border-red-600'
    },
    success: {
        icon: CheckCircle,
        bgColor: 'bg-emerald-500',
        textColor: 'text-white',
        borderColor: 'border-emerald-600'
    }
}

const CallToast: React.FC<CallToastProps> = ({
    isVisible,
    type,
    message,
    callerName,
    onClose,
    duration = 4000
}) => {
    // إخفاء تلقائي
    useEffect(() => {
        if (!isVisible) return

        const timer = setTimeout(() => {
            onClose()
        }, duration)

        return () => clearTimeout(timer)
    }, [isVisible, duration, onClose])

    if (!isVisible) return null

    const config = toastConfig[type]
    const Icon = config.icon

    return (
        <div
            className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-[200] animate-slide-in"
            dir="rtl"
        >
            <div className={`${config.bgColor} rounded-2xl shadow-2xl overflow-hidden border ${config.borderColor}`}>
                <div className="flex items-center gap-3 p-4">
                    {/* الأيقونة */}
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                        <Icon className={`w-5 h-5 ${config.textColor}`} />
                    </div>

                    {/* المحتوى */}
                    <div className="flex-1 min-w-0">
                        {callerName && (
                            <p className={`font-semibold text-sm ${config.textColor} truncate`}>
                                {callerName}
                            </p>
                        )}
                        <p className={`text-sm ${config.textColor} opacity-90`}>
                            {message}
                        </p>
                    </div>

                    {/* زر الإغلاق */}
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-white/20 transition-colors flex-shrink-0"
                    >
                        <X className={`w-4 h-4 ${config.textColor}`} />
                    </button>
                </div>

                {/* شريط التقدم */}
                <div className="h-1 bg-white/20">
                    <div
                        className="h-full bg-white/40 animate-progress"
                        style={{
                            animationDuration: `${duration}ms`,
                            transformOrigin: 'right'
                        }}
                    />
                </div>
            </div>
        </div>
    )
}

export default CallToast
