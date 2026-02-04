/**
 * شريط المكالمة النشطة
 * تصميم احترافي مع تأثيرات بصرية
 */

import React, { useState, useEffect } from 'react'
import { PhoneOff, Mic, MicOff, Volume2 } from 'lucide-react'

interface ActiveCallOverlayProps {
    isVisible: boolean
    remoteName: string
    duration: number
    isMuted: boolean
    isConnecting?: boolean
    isCalling?: boolean
    onToggleMute: () => void
    onEndCall: () => void
}

// تنسيق المدة
const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const ActiveCallOverlay: React.FC<ActiveCallOverlayProps> = ({
    isVisible,
    remoteName,
    duration,
    isMuted,
    isConnecting = false,
    isCalling = false,
    onToggleMute,
    onEndCall
}) => {
    const [waveIndex, setWaveIndex] = useState(0)

    // تأثير موجة الصوت
    useEffect(() => {
        if (!isVisible || isCalling || isConnecting) return

        const interval = setInterval(() => {
            setWaveIndex(prev => (prev + 1) % 4)
        }, 300)

        return () => clearInterval(interval)
    }, [isVisible, isCalling, isConnecting])

    if (!isVisible) return null

    const getStatusText = () => {
        if (isCalling) return 'جاري الاتصال...'
        if (isConnecting) return 'جاري التوصيل...'
        return formatDuration(duration)
    }

    // الحرف الأول للاسم
    const initial = remoteName.charAt(0).toUpperCase()

    return (
        <div className="fixed top-0 left-0 right-0 z-[90] safe-area-top" dir="rtl">
            {/* الشريط الرئيسي */}
            <div className="relative overflow-hidden">
                {/* خلفية متدرجة */}
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500" />

                {/* تأثير shimmer */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer" />

                {/* المحتوى */}
                <div className="relative max-w-lg mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        {/* معلومات المكالمة */}
                        <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div className="relative">
                                <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold ring-2 ring-white/30">
                                    {initial}
                                </div>

                                {/* مؤشر الصوت */}
                                {!isCalling && !isConnecting && !isMuted && (
                                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center">
                                        <Volume2 className="w-2.5 h-2.5 text-emerald-600 animate-pulse" />
                                    </div>
                                )}
                            </div>

                            {/* النص */}
                            <div>
                                <p className="text-white font-semibold text-sm">{remoteName}</p>
                                <div className="flex items-center gap-1.5">
                                    {/* مؤشر الحالة */}
                                    {(isCalling || isConnecting) && (
                                        <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse" />
                                    )}

                                    {/* نقاط موجة الصوت */}
                                    {!isCalling && !isConnecting && (
                                        <div className="flex items-center gap-0.5">
                                            {[0, 1, 2, 3].map(i => (
                                                <span
                                                    key={i}
                                                    className={`w-0.5 rounded-full bg-white/80 transition-all duration-150 ${waveIndex === i ? 'h-3' : 'h-1.5'
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    <span className="text-white/80 text-xs font-medium">
                                        {getStatusText()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* أزرار التحكم */}
                        <div className="flex items-center gap-2">
                            {/* كتم */}
                            <button
                                onClick={onToggleMute}
                                className={`p-2.5 rounded-full transition-all active:scale-95 ${isMuted
                                    ? 'bg-white text-emerald-600'
                                    : 'bg-white/20 text-white hover:bg-white/30'
                                    }`}
                                title={isMuted ? 'إلغاء الكتم' : 'كتم'}
                            >
                                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </button>

                            {/* إنهاء */}
                            <button
                                onClick={onEndCall}
                                className="p-2.5 bg-red-500 hover:bg-red-600 rounded-full transition-all shadow-lg shadow-red-500/30 active:scale-95"
                                title="إنهاء المكالمة"
                            >
                                <PhoneOff className="w-5 h-5 text-white" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ActiveCallOverlay

