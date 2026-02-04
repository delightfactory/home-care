/**
 * مودال المكالمة الواردة
 * تصميم احترافي full-screen مثل iOS / Samsung
 */

import React, { useEffect, useState } from 'react'
import { Phone, PhoneOff, PhoneIncoming } from 'lucide-react'

interface IncomingCallModalProps {
    isOpen: boolean
    callerName: string
    onAccept: () => void
    onReject: () => void
}

const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
    isOpen,
    callerName,
    onAccept,
    onReject
}) => {
    const [pulseIndex, setPulseIndex] = useState(0)

    // تأثير الرنين المتدرج
    useEffect(() => {
        if (!isOpen) return

        const interval = setInterval(() => {
            setPulseIndex(prev => (prev + 1) % 4)
        }, 400)

        // تشغيل صوت الرنين (اختياري)
        // const audio = new Audio('/sounds/ringtone.mp3')
        // audio.loop = true
        // audio.play()

        return () => {
            clearInterval(interval)
            // audio.pause()
        }
    }, [isOpen])

    if (!isOpen) return null

    // الحرف الأول للاسم
    const initial = callerName.charAt(0).toUpperCase()

    return (
        <div
            className="fixed inset-0 z-[100] flex flex-col"
            dir="rtl"
        >
            {/* خلفية متدرجة ديناميكية */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                {/* حلقات الرنين الخلفية */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`absolute w-[400px] h-[400px] rounded-full transition-all duration-700 ${pulseIndex === 0 ? 'bg-emerald-500/5 scale-100' : 'bg-transparent scale-150'
                        }`} />
                    <div className={`absolute w-[300px] h-[300px] rounded-full transition-all duration-700 ${pulseIndex === 1 ? 'bg-emerald-500/10 scale-100' : 'bg-transparent scale-125'
                        }`} />
                    <div className={`absolute w-[200px] h-[200px] rounded-full transition-all duration-700 ${pulseIndex === 2 ? 'bg-emerald-500/15 scale-100' : 'bg-transparent scale-110'
                        }`} />
                </div>

                {/* decorative elements */}
                <div className="absolute top-20 right-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-40 left-10 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl" />
            </div>

            {/* المحتوى */}
            <div className="relative flex-1 flex flex-col items-center justify-center px-8">
                {/* رمز المكالمة الواردة */}
                <div className="flex items-center gap-2 mb-6">
                    <PhoneIncoming className="w-5 h-5 text-emerald-400 animate-pulse" />
                    <span className="text-emerald-400 text-sm font-medium tracking-wide">
                        مكالمة واردة
                    </span>
                </div>

                {/* الصورة الرمزية مع تأثير الرنين */}
                <div className="relative mb-8">
                    {/* حلقات الرنين */}
                    <div className={`absolute inset-0 rounded-full border-2 border-emerald-500/30 transition-all duration-500 ${pulseIndex === 3 ? 'scale-100 opacity-100' : 'scale-150 opacity-0'
                        }`} style={{ width: '160px', height: '160px', margin: '-20px' }} />
                    <div className={`absolute inset-0 rounded-full border-2 border-emerald-500/20 transition-all duration-500 ${pulseIndex === 2 ? 'scale-100 opacity-100' : 'scale-175 opacity-0'
                        }`} style={{ width: '200px', height: '200px', margin: '-40px' }} />

                    {/* Avatar */}
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30 ring-4 ring-white/10">
                        <span className="text-white text-5xl font-bold">{initial}</span>
                    </div>
                </div>

                {/* اسم المتصل */}
                <h2 className="text-3xl font-bold text-white mb-2 tracking-wide">
                    {callerName}
                </h2>
                <p className="text-gray-400 text-sm mb-2">
                    مكالمة صوتية
                </p>
            </div>

            {/* أزرار التحكم السفلية */}
            <div className="relative pb-16 pt-8 px-8">
                <div className="flex items-center justify-center gap-16">
                    {/* زر الرفض */}
                    <button
                        onClick={onReject}
                        className="group flex flex-col items-center gap-3"
                    >
                        <div className="relative">
                            {/* خلفية متوهجة */}
                            <div className="absolute inset-0 bg-red-500/30 rounded-full blur-xl group-hover:bg-red-500/50 transition-all" />

                            {/* الزر */}
                            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-xl shadow-red-500/30 group-hover:scale-110 group-active:scale-95 transition-all">
                                <PhoneOff className="w-7 h-7 text-white" />
                            </div>
                        </div>
                        <span className="text-gray-400 text-sm font-medium">رفض</span>
                    </button>

                    {/* زر القبول */}
                    <button
                        onClick={onAccept}
                        className="group flex flex-col items-center gap-3"
                    >
                        <div className="relative">
                            {/* خلفية متوهجة ونابضة */}
                            <div className="absolute inset-0 bg-emerald-500/40 rounded-full blur-xl animate-pulse" />

                            {/* الزر */}
                            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/40 group-hover:scale-110 group-active:scale-95 transition-all animate-bounce">
                                <Phone className="w-7 h-7 text-white" />
                            </div>
                        </div>
                        <span className="text-emerald-400 text-sm font-medium">قبول</span>
                    </button>
                </div>

                {/* إرشادات */}
                <p className="text-center text-gray-500 text-xs mt-8">
                    اسحب للأعلى للرد على المكالمة
                </p>
            </div>
        </div>
    )
}

export default IncomingCallModal

