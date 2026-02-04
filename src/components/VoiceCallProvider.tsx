/**
 * مزود سياق المكالمات الصوتية للتطبيق
 * يُستخدم لعرض واجهات المكالمات بشكل عام في التطبيق
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useVoiceCall } from '../hooks/useVoiceCall'
import { useCallAudio } from '../hooks/useCallAudio'
import { IncomingCallModal, ActiveCallOverlay, CallToast, type CallToastType } from './VoiceCall'

// نوع السياق
interface VoiceCallContextType {
    startCall: (calleeId: string, calleeName: string) => Promise<void>
    isInCall: boolean
    canStartCall: boolean
}

const VoiceCallContext = createContext<VoiceCallContextType | null>(null)

// Hook للوصول للسياق
export function useVoiceCallContext() {
    const context = useContext(VoiceCallContext)
    if (!context) {
        throw new Error('useVoiceCallContext must be used within VoiceCallProvider')
    }
    return context
}

interface VoiceCallProviderProps {
    children: ReactNode
}

// حالة Toast
interface ToastState {
    isVisible: boolean
    type: CallToastType
    message: string
    callerName?: string
}

export function VoiceCallProvider({ children }: VoiceCallProviderProps) {
    const {
        status,
        callInfo,
        isMuted,
        duration,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        isInCall,
        canStartCall
    } = useVoiceCall()

    const {
        startRingtone,
        startDialtone,
        playHangup,
        stopAllSounds
    } = useCallAudio()

    // حالة Toast
    const [toast, setToast] = useState<ToastState>({
        isVisible: false,
        type: 'missed',
        message: '',
        callerName: undefined
    })

    // عرض Toast
    const showToast = useCallback((type: CallToastType, message: string, callerName?: string) => {
        setToast({
            isVisible: true,
            type,
            message,
            callerName
        })
    }, [])

    // إخفاء Toast
    const hideToast = useCallback(() => {
        setToast(prev => ({ ...prev, isVisible: false }))
    }, [])

    // الحالة السابقة للمكالمة
    const [prevStatus, setPrevStatus] = useState(status)

    // الاستماع لتغييرات حالة المكالمة
    useEffect(() => {
        // تجنب التشغيل عند البداية
        if (prevStatus === status) return

        // بدء المكالمة (المتصل)
        if (status === 'calling') {
            startDialtone()
        }

        // رنين (المستقبل)
        if (status === 'ringing') {
            startRingtone()
        }

        // الاتصال أو متصل - إيقاف الأصوات
        if (status === 'connecting' || status === 'connected') {
            stopAllSounds()
        }

        // انتهاء المكالمة
        if (prevStatus !== 'idle' && status === 'idle') {
            stopAllSounds()

            // تحديد نوع الإشعار
            if (prevStatus === 'ringing') {
                // لم يرد (فائتة من جهة المستقبل) - لا نعرض toast للمستقبل
                // الإشعار للمتصل يُعالج من جهته
            } else if (prevStatus === 'calling') {
                // المتصل: المكالمة رُفضت أو فائتة
                if (callInfo) {
                    showToast('rejected', 'لم يتم الرد على المكالمة', callInfo.calleeName)
                }
            } else if (prevStatus === 'connected' && duration > 0) {
                // مكالمة انتهت بشكل طبيعي
                playHangup()
            }
        }

        // فشل المكالمة
        if (status === 'failed') {
            stopAllSounds()
            showToast('error', 'فشل الاتصال، يرجى المحاولة لاحقاً')
        }

        setPrevStatus(status)
    }, [status, prevStatus, callInfo, duration, startDialtone, startRingtone, stopAllSounds, playHangup, showToast])

    // تنظيف عند الخروج
    useEffect(() => {
        return () => {
            stopAllSounds()
        }
    }, [stopAllSounds])

    // تحديد اسم الطرف الآخر
    const getRemoteName = () => {
        if (!callInfo) return ''
        // إذا كنا المتصل، نعرض اسم المستقبل والعكس
        return callInfo.callerName || callInfo.calleeName || 'مستخدم'
    }

    return (
        <VoiceCallContext.Provider value={{ startCall, isInCall, canStartCall }}>
            {children}

            {/* مودال المكالمة الواردة */}
            <IncomingCallModal
                isOpen={status === 'ringing'}
                callerName={callInfo?.callerName || 'مستخدم'}
                onAccept={acceptCall}
                onReject={rejectCall}
            />

            {/* شريط المكالمة النشطة */}
            <ActiveCallOverlay
                isVisible={['calling', 'connecting', 'connected'].includes(status)}
                remoteName={getRemoteName()}
                duration={duration}
                isMuted={isMuted}
                isCalling={status === 'calling'}
                isConnecting={status === 'connecting'}
                onToggleMute={toggleMute}
                onEndCall={endCall}
            />

            {/* Toast للإشعارات */}
            <CallToast
                isVisible={toast.isVisible}
                type={toast.type}
                message={toast.message}
                callerName={toast.callerName}
                onClose={hideToast}
            />
        </VoiceCallContext.Provider>
    )
}

