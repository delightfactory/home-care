/**
 * مكون تسجيل الرسالة الصوتية
 */

import React, { useEffect } from 'react'
import { Mic, Square, Send, X, Loader2 } from 'lucide-react'
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder'

interface VoiceRecordButtonProps {
    onSend: (audioUrl: string, duration: number) => void
    disabled?: boolean
}

// تنسيق المدة
const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

const VoiceRecordButton: React.FC<VoiceRecordButtonProps> = ({
    onSend,
    disabled = false
}) => {
    const {
        isRecording,
        duration,
        audioUrl,
        audioBlob,
        error,
        startRecording,
        stopRecording,
        cancelRecording,
        uploadVoiceMessage,
        reset
    } = useVoiceRecorder()

    const [isUploading, setIsUploading] = React.useState(false)

    // عرض الخطأ
    useEffect(() => {
        if (error) {
            console.error(error)
        }
    }, [error])

    // بدء/إيقاف التسجيل
    const handleRecordToggle = async () => {
        if (isRecording) {
            await stopRecording()
        } else {
            await startRecording()
        }
    }

    // إرسال الرسالة
    const handleSend = async () => {
        if (!audioBlob) return

        setIsUploading(true)
        const url = await uploadVoiceMessage()
        setIsUploading(false)

        if (url) {
            onSend(url, duration)
            reset()
        }
    }

    // إذا لم يبدأ التسجيل بعد
    if (!isRecording && !audioUrl) {
        return (
            <button
                onClick={handleRecordToggle}
                disabled={disabled}
                className="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
                title="تسجيل رسالة صوتية"
            >
                <Mic className="w-5 h-5" />
            </button>
        )
    }

    // أثناء التسجيل
    if (isRecording) {
        return (
            <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-full" dir="rtl">
                {/* مؤشر التسجيل */}
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />

                {/* المدة */}
                <span className="text-red-600 font-mono text-sm min-w-[40px]">
                    {formatDuration(duration)}
                </span>

                {/* إيقاف */}
                <button
                    onClick={stopRecording}
                    className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                    title="إيقاف التسجيل"
                >
                    <Square className="w-4 h-4" />
                </button>

                {/* إلغاء */}
                <button
                    onClick={cancelRecording}
                    className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                    title="إلغاء"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        )
    }

    // بعد التسجيل (معاينة)
    return (
        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full" dir="rtl">
            {/* تشغيل المعاينة */}
            <audio src={audioUrl!} controls className="h-8 max-w-[120px]" />

            {/* المدة */}
            <span className="text-gray-600 text-sm">
                {formatDuration(duration)}
            </span>

            {/* إرسال */}
            <button
                onClick={handleSend}
                disabled={isUploading}
                className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors disabled:opacity-50"
                title="إرسال"
            >
                {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Send className="w-4 h-4" />
                )}
            </button>

            {/* إلغاء */}
            <button
                onClick={reset}
                disabled={isUploading}
                className="p-1 text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"
                title="إلغاء"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    )
}

export default VoiceRecordButton
