/**
 * Hook لتسجيل الرسائل الصوتية
 */

import { useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface VoiceRecorderState {
    isRecording: boolean
    duration: number
    audioUrl: string | null
    audioBlob: Blob | null
    error: string | null
}

interface UseVoiceRecorderReturn extends VoiceRecorderState {
    startRecording: () => Promise<void>
    stopRecording: () => Promise<void>
    cancelRecording: () => void
    uploadVoiceMessage: () => Promise<string | null>
    reset: () => void
}

const MAX_DURATION = 60 // الحد الأقصى 60 ثانية

export function useVoiceRecorder(): UseVoiceRecorderReturn {
    const { user } = useAuth()

    const [state, setState] = useState<VoiceRecorderState>({
        isRecording: false,
        duration: 0,
        audioUrl: null,
        audioBlob: null,
        error: null
    })

    const mediaRecorder = useRef<MediaRecorder | null>(null)
    const audioChunks = useRef<Blob[]>([])
    const durationInterval = useRef<NodeJS.Timeout | null>(null)
    const startTime = useRef<number>(0)

    // بدء التسجيل
    const startRecording = useCallback(async () => {
        try {
            // طلب إذن الميكروفون
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            })

            // إنشاء MediaRecorder
            const mimeType = MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : 'audio/mp4'

            mediaRecorder.current = new MediaRecorder(stream, { mimeType })
            audioChunks.current = []

            mediaRecorder.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.current.push(event.data)
                }
            }

            mediaRecorder.current.onstop = () => {
                const audioBlob = new Blob(audioChunks.current, { type: mimeType })
                const audioUrl = URL.createObjectURL(audioBlob)

                setState(prev => ({
                    ...prev,
                    isRecording: false,
                    audioUrl,
                    audioBlob
                }))

                // إيقاف المسارات
                stream.getTracks().forEach(track => track.stop())
            }

            // بدء التسجيل
            mediaRecorder.current.start(100) // تقطيع كل 100ms
            startTime.current = Date.now()

            setState(prev => ({
                ...prev,
                isRecording: true,
                duration: 0,
                audioUrl: null,
                audioBlob: null,
                error: null
            }))

            // عداد المدة
            durationInterval.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime.current) / 1000)
                setState(prev => ({ ...prev, duration: elapsed }))

                // إيقاف تلقائي عند الحد الأقصى
                if (elapsed >= MAX_DURATION) {
                    stopRecording()
                }
            }, 100)

        } catch (error) {
            console.error('❌ فشل بدء التسجيل:', error)
            setState(prev => ({
                ...prev,
                error: 'فشل الوصول للميكروفون. تأكد من السماح بالوصول.'
            }))
        }
    }, [])

    // إيقاف التسجيل
    const stopRecording = useCallback(async () => {
        if (durationInterval.current) {
            clearInterval(durationInterval.current)
            durationInterval.current = null
        }

        if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
            mediaRecorder.current.stop()
        }
    }, [])

    // إلغاء التسجيل
    const cancelRecording = useCallback(() => {
        if (durationInterval.current) {
            clearInterval(durationInterval.current)
            durationInterval.current = null
        }

        if (mediaRecorder.current) {
            if (mediaRecorder.current.state === 'recording') {
                mediaRecorder.current.stop()
            }
            mediaRecorder.current = null
        }

        // تحرير URL
        if (state.audioUrl) {
            URL.revokeObjectURL(state.audioUrl)
        }

        setState({
            isRecording: false,
            duration: 0,
            audioUrl: null,
            audioBlob: null,
            error: null
        })
    }, [state.audioUrl])

    // رفع الرسالة الصوتية
    const uploadVoiceMessage = useCallback(async (): Promise<string | null> => {
        if (!state.audioBlob || !user?.id) return null

        try {
            const fileName = `${user.id}/${Date.now()}.webm`

            const { data, error } = await supabase.storage
                .from('voice_messages')
                .upload(fileName, state.audioBlob, {
                    contentType: 'audio/webm',
                    cacheControl: '604800' // أسبوع
                })

            if (error) throw error

            // الحصول على الرابط العام
            const { data: urlData } = supabase.storage
                .from('voice_messages')
                .getPublicUrl(data.path)

            return urlData.publicUrl

        } catch (error) {
            console.error('❌ فشل رفع الرسالة الصوتية:', error)
            setState(prev => ({
                ...prev,
                error: 'فشل رفع الرسالة الصوتية'
            }))
            return null
        }
    }, [state.audioBlob, user?.id])

    // إعادة تعيين
    const reset = useCallback(() => {
        if (state.audioUrl) {
            URL.revokeObjectURL(state.audioUrl)
        }

        setState({
            isRecording: false,
            duration: 0,
            audioUrl: null,
            audioBlob: null,
            error: null
        })
    }, [state.audioUrl])

    return {
        ...state,
        startRecording,
        stopRecording,
        cancelRecording,
        uploadVoiceMessage,
        reset
    }
}
