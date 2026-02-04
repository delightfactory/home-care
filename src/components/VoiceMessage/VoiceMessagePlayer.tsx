/**
 * مكون تشغيل الرسالة الصوتية
 */

import React, { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'

interface VoiceMessagePlayerProps {
    audioUrl: string
    duration?: number
    isOwn?: boolean
}

const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
    audioUrl,
    duration: initialDuration = 0,
    isOwn = false
}) => {
    const audioRef = useRef<HTMLAudioElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(initialDuration)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // تحميل معلومات الصوت
    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        const handleLoadedMetadata = () => {
            console.log('🎵 Audio metadata loaded:', audio.duration)
            if (!isNaN(audio.duration) && audio.duration > 0) {
                setDuration(Math.floor(audio.duration))
            }
            setIsLoading(false)
            setError(null)
        }

        const handleCanPlay = () => {
            console.log('🎵 Audio can play')
            setIsLoading(false)
            setError(null)
        }

        const handleTimeUpdate = () => {
            setCurrentTime(Math.floor(audio.currentTime))
        }

        const handleEnded = () => {
            setIsPlaying(false)
            setCurrentTime(0)
        }

        const handleError = (e: Event) => {
            console.error('❌ Audio error:', e, audio.error)
            setIsLoading(false)
            setError('فشل تحميل الصوت')
        }

        audio.addEventListener('loadedmetadata', handleLoadedMetadata)
        audio.addEventListener('canplay', handleCanPlay)
        audio.addEventListener('timeupdate', handleTimeUpdate)
        audio.addEventListener('ended', handleEnded)
        audio.addEventListener('error', handleError)

        // محاولة تحميل الصوت
        audio.load()

        return () => {
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
            audio.removeEventListener('canplay', handleCanPlay)
            audio.removeEventListener('timeupdate', handleTimeUpdate)
            audio.removeEventListener('ended', handleEnded)
            audio.removeEventListener('error', handleError)
        }
    }, [audioUrl])

    // تشغيل/إيقاف
    const togglePlay = async () => {
        const audio = audioRef.current
        if (!audio) return

        try {
            if (isPlaying) {
                audio.pause()
                setIsPlaying(false)
            } else {
                console.log('▶️ Playing audio:', audioUrl)
                await audio.play()
                setIsPlaying(true)
            }
        } catch (err) {
            console.error('❌ Play error:', err)
            setError('فشل تشغيل الصوت')
        }
    }

    // تنسيق الوقت
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    // حساب نسبة التقدم
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0

    return (
        <div
            className={`
        flex items-center gap-3 px-3 py-2 rounded-2xl min-w-[200px] max-w-[280px]
        ${isOwn
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-800'
                }
      `}
            dir="rtl"
        >
            {/* زر التشغيل */}
            <button
                onClick={togglePlay}
                disabled={isLoading}
                className={`
          p-2 rounded-full transition-colors flex-shrink-0
          ${isOwn
                        ? 'bg-white/20 hover:bg-white/30'
                        : 'bg-gray-200 hover:bg-gray-300'
                    }
          ${isLoading ? 'opacity-50' : ''}
        `}
            >
                {isPlaying ? (
                    <Pause className="w-4 h-4" />
                ) : (
                    <Play className="w-4 h-4" />
                )}
            </button>

            {/* شريط التقدم */}
            <div className="flex-1 flex flex-col gap-1">
                <div className="relative h-1.5 rounded-full overflow-hidden bg-white/20">
                    <div
                        className={`absolute inset-y-0 right-0 rounded-full transition-all ${isOwn ? 'bg-white' : 'bg-blue-500'}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* الوقت */}
                <div className="flex justify-between text-xs opacity-70">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            {/* أيقونة الصوت */}
            <Volume2 className="w-4 h-4 opacity-60 flex-shrink-0" />

            {/* عنصر الصوت المخفي */}
            <audio
                ref={audioRef}
                src={audioUrl}
                preload="auto"
                crossOrigin="anonymous"
            />
        </div>
    )
}

export default VoiceMessagePlayer
