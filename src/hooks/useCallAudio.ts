/**
 * Hook لإدارة أصوات وإشعارات المكالمات
 * يتحكم في صوت الرنين، الاهتزاز، وإشعارات Toast
 */

import { useRef, useCallback, useEffect } from 'react'

// أنواع الأصوات
type SoundType = 'ringtone' | 'dialtone' | 'hangup' | 'busy'

// إعدادات الاهتزاز
const VIBRATION_PATTERNS = {
    ringtone: [200, 100, 200, 100, 200, 500], // نمط الرنين
    notification: [100, 50, 100],              // إشعار قصير
    hangup: [300]                              // إنهاء المكالمة
}

export function useCallAudio() {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const isPlayingRef = useRef(false)
    const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null)

    // تنظيف عند الخروج
    useEffect(() => {
        return () => {
            stopAllSounds()
        }
    }, [])

    // تشغيل صوت
    const playSound = useCallback((type: SoundType, loop: boolean = false) => {
        try {
            // إيقاف أي صوت سابق
            stopSound()

            // إنشاء عنصر صوت جديد
            const audio = new Audio()

            // تحديد اسم الملف (بدون امتداد)
            const fileName = type === 'ringtone' ? 'ringtone' :
                type === 'dialtone' ? 'dialtone' :
                    type === 'hangup' ? 'hangup' : 'busy'

            // محاولة MP3 أولاً (أصغر حجماً)، ثم WAV
            audio.src = `/sounds/${fileName}.mp3`

            // fallback إلى WAV إذا فشل MP3
            audio.onerror = () => {
                audio.src = `/sounds/${fileName}.wav`
            }

            audio.loop = loop
            audio.volume = 0.7
            audioRef.current = audio

            audio.play()
                .then(() => {
                    isPlayingRef.current = true
                })
                .catch((error) => {
                    console.warn('⚠️ فشل تشغيل الصوت:', error.message)
                    // المتصفح قد يمنع التشغيل التلقائي
                })
        } catch (error) {
            console.error('❌ خطأ في تشغيل الصوت:', error)
        }
    }, [])

    // إيقاف الصوت
    const stopSound = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
            audioRef.current = null
            isPlayingRef.current = false
        }
    }, [])

    // تشغيل الاهتزاز
    const vibrate = useCallback((pattern: keyof typeof VIBRATION_PATTERNS = 'notification') => {
        try {
            // التحقق من دعم المتصفح
            if ('vibrate' in navigator) {
                navigator.vibrate(VIBRATION_PATTERNS[pattern])
            }
        } catch (error) {
            console.warn('⚠️ Vibration API غير مدعوم')
        }
    }, [])

    // تشغيل اهتزاز متكرر (للرنين)
    const startContinuousVibration = useCallback(() => {
        // إيقاف أي اهتزاز سابق
        stopVibration()

        // بدء الاهتزاز المتكرر
        vibrate('ringtone')
        vibrationIntervalRef.current = setInterval(() => {
            vibrate('ringtone')
        }, 1500) // تكرار كل 1.5 ثانية
    }, [vibrate])

    // إيقاف الاهتزاز
    const stopVibration = useCallback(() => {
        if (vibrationIntervalRef.current) {
            clearInterval(vibrationIntervalRef.current)
            vibrationIntervalRef.current = null
        }
        // إيقاف فوري
        if ('vibrate' in navigator) {
            navigator.vibrate(0)
        }
    }, [])

    // إيقاف كل الأصوات والاهتزاز
    const stopAllSounds = useCallback(() => {
        stopSound()
        stopVibration()
    }, [stopSound, stopVibration])

    // تشغيل نغمة الرنين (صوت + اهتزاز)
    const startRingtone = useCallback(() => {
        playSound('ringtone', true)
        startContinuousVibration()
    }, [playSound, startContinuousVibration])

    // تشغيل نغمة الاتصال
    const startDialtone = useCallback(() => {
        playSound('dialtone', true)
    }, [playSound])

    // تشغيل صوت الإنهاء
    const playHangup = useCallback(() => {
        playSound('hangup', false)
        vibrate('hangup')
    }, [playSound, vibrate])

    // تشغيل صوت المشغول
    const playBusy = useCallback(() => {
        playSound('busy', false)
    }, [playSound])

    return {
        // أصوات المكالمات
        startRingtone,
        startDialtone,
        playHangup,
        playBusy,
        stopAllSounds,

        // اهتزاز
        vibrate,
        stopVibration,

        // التحكم الأساسي
        playSound,
        stopSound
    }
}
