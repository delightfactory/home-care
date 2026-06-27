/**
 * Hook لإدارة المكالمات الصوتية
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { agoraClient, CallStatus, CallInfo, AGORA_CONFIG } from '../lib/agora'
import { useAuth } from '../contexts/AuthContext'

interface VoiceCallState {
    status: CallStatus
    callInfo: CallInfo | null
    isMuted: boolean
    duration: number
    error: string | null
}

interface UseVoiceCallReturn extends VoiceCallState {
    // إجراءات المكالمات
    startCall: (calleeId: string, calleeName: string) => Promise<void>
    acceptCall: () => Promise<void>
    rejectCall: () => Promise<void>
    endCall: () => Promise<void>
    toggleMute: () => Promise<void>

    // معلومات إضافية
    isInCall: boolean
    canStartCall: boolean
}

export function useVoiceCall(): UseVoiceCallReturn {
    const { user } = useAuth()

    const [state, setState] = useState<VoiceCallState>({
        status: 'idle',
        callInfo: null,
        isMuted: false,
        duration: 0,
        error: null
    })

    const durationInterval = useRef<NodeJS.Timeout | null>(null)
    const ringTimeout = useRef<NodeJS.Timeout | null>(null)
    const statusRef = useRef<CallStatus>('idle') // Ref لتجنب stale closure

    // تحديث Ref عند تغيير الحالة
    useEffect(() => {
        statusRef.current = state.status
    }, [state.status])

    // تنظيف عند الخروج
    useEffect(() => {
        return () => {
            if (durationInterval.current) clearInterval(durationInterval.current)
            if (ringTimeout.current) clearTimeout(ringTimeout.current)
            agoraClient.removeAllListeners()
        }
    }, [])

    // الاستماع للمكالمات الواردة
    useEffect(() => {
        if (!user?.id) return

        const channel = supabase
            .channel('voice-calls')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'voice_calls',
                    filter: `callee_id=eq.${user.id}`
                },
                (payload) => {
                    const call = payload.new as any
                    if (call.status === 'ringing') {
                        handleIncomingCall(call)
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'voice_calls'
                },
                (payload) => {
                    const call = payload.new as any
                    handleCallUpdate(call)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user?.id])

    // معالجة مكالمة واردة
    const handleIncomingCall = useCallback(async (call: any) => {
        if (statusRef.current !== 'idle') {
            // مشغول، رفض تلقائي
            rejectCall()
            return
        }

        // جلب اسم المتصل من جدول users
        let callerName = 'مستخدم'
        try {
            const { data: callerData } = await supabase
                .from('users')
                .select('full_name')
                .eq('id', call.caller_id)
                .single()

            if (callerData?.full_name) {
                callerName = callerData.full_name
            }
        } catch (error) {
            console.warn('فشل جلب اسم المتصل:', error)
        }

        setState(prev => ({
            ...prev,
            status: 'ringing',
            callInfo: {
                id: call.id,
                channelName: call.channel_name,
                callerId: call.caller_id,
                callerName,
                calleeId: call.callee_id,
                calleeName: '',
                status: 'ringing'
            }
        }))

        // مهلة الرنين
        ringTimeout.current = setTimeout(() => {
            if (statusRef.current === 'ringing') {
                handleMissedCall()
            }
        }, AGORA_CONFIG.call.ringTimeout)
    }, [])

    // معالجة تحديث المكالمة
    const handleCallUpdate = useCallback((call: any) => {
        if (!state.callInfo || state.callInfo.id !== call.id) return

        if (call.status === 'ended' || call.status === 'rejected' || call.status === 'missed') {
            handleCallEnded()
        } else if (call.status === 'connected' && state.status === 'calling') {
            // الطرف الآخر رد
            joinAgoraChannel()
        }
    }, [state.callInfo, state.status])

    // طلب توكن من الخادم
    const getToken = async (channelName: string): Promise<{ token: string | null; uid: number }> => {
        const { data, error } = await supabase.functions.invoke('generate_agora_token', {
            body: { channelName, role: 'publisher' }
        })

        if (error || !data.success) {
            console.error('❌ خطأ في الحصول على التوكن:', data?.error || error)
            throw new Error(data?.error || 'فشل في الحصول على التوكن')
        }

        console.log('✅ تم الحصول على توكن Agora:', { uid: data.uid })
        return { token: data.token, uid: data.uid }
    }

    // الانضمام لقناة Agora
    const joinAgoraChannel = async () => {
        if (!state.callInfo) return

        try {
            setState(prev => ({ ...prev, status: 'connecting' }))

            const [{ token, uid }] = await Promise.all([
                getToken(state.callInfo.channelName),
                agoraClient.preload()
            ])
            await agoraClient.join(state.callInfo.channelName, token, uid)

            // الاستماع للمستخدم البعيد
            agoraClient.onRemoteAudioPublished(() => {
                console.log('🔊 الطرف الآخر متصل')
            })

            agoraClient.onRemoteUserLeft(() => {
                console.log('👋 الطرف الآخر غادر')
                handleCallEnded()
            })

            setState(prev => ({
                ...prev,
                status: 'connected',
                callInfo: prev.callInfo ? {
                    ...prev.callInfo,
                    answeredAt: new Date()
                } : null
            }))

            // بدء عداد المدة
            startDurationCounter()

        } catch (error) {
            console.error('❌ خطأ في الاتصال:', error)
            setState(prev => ({
                ...prev,
                status: 'failed',
                error: 'فشل الاتصال بالخادم'
            }))
        }
    }

    // بدء عداد المدة
    const startDurationCounter = () => {
        durationInterval.current = setInterval(() => {
            setState(prev => ({
                ...prev,
                duration: prev.duration + 1
            }))
        }, 1000)
    }

    // معالجة انتهاء المكالمة
    const handleCallEnded = useCallback(async () => {
        if (durationInterval.current) clearInterval(durationInterval.current)
        if (ringTimeout.current) clearTimeout(ringTimeout.current)

        await agoraClient.leave()
        agoraClient.removeAllListeners()

        setState({
            status: 'idle',
            callInfo: null,
            isMuted: false,
            duration: 0,
            error: null
        })
    }, [])

    // معالجة المكالمة الفائتة
    const handleMissedCall = async () => {
        if (!state.callInfo) return

        await supabase
            .from('voice_calls')
            .update({ status: 'missed', ended_at: new Date().toISOString() })
            .eq('id', state.callInfo.id)

        handleCallEnded()
    }

    // بدء مكالمة جديدة
    const startCall = async (calleeId: string, calleeName: string) => {
        if (!user?.id || state.status !== 'idle') return

        const channelName = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        setState(prev => ({
            ...prev,
            status: 'calling',
            callInfo: {
                id: '',
                channelName,
                callerId: user.id,
                callerName: (user as any).full_name || 'مستخدم',
                calleeId,
                calleeName,
                status: 'calling'
            }
        }))

        try {
            // إنشاء سجل المكالمة
            const { data: call, error } = await supabase
                .from('voice_calls')
                .insert({
                    channel_name: channelName,
                    caller_id: user.id,
                    callee_id: calleeId,
                    status: 'ringing'
                })
                .select()
                .single()

            if (error) throw error

            setState(prev => ({
                ...prev,
                callInfo: prev.callInfo ? { ...prev.callInfo, id: call.id } : null
            }))

            // الانضمام للقناة
            const [{ token, uid }] = await Promise.all([
                getToken(channelName),
                agoraClient.preload()
            ])
            await agoraClient.join(channelName, token, uid)

            // الاستماع للمستخدم البعيد
            agoraClient.onRemoteAudioPublished(() => {
                setState(prev => ({ ...prev, status: 'connected' }))
                startDurationCounter()

                // تحديث حالة المكالمة
                supabase
                    .from('voice_calls')
                    .update({ status: 'connected', answered_at: new Date().toISOString() })
                    .eq('id', call.id)
            })

            agoraClient.onRemoteUserLeft(() => {
                handleCallEnded()
            })

            // مهلة الرنين
            ringTimeout.current = setTimeout(() => {
                if (statusRef.current === 'calling') {
                    endCall()
                }
            }, AGORA_CONFIG.call.ringTimeout)

        } catch (error) {
            console.error('❌ فشل بدء المكالمة:', error)
            setState(prev => ({
                ...prev,
                status: 'failed',
                error: 'فشل بدء المكالمة'
            }))
        }
    }

    // قبول المكالمة
    const acceptCall = async () => {
        if (!state.callInfo || state.status !== 'ringing') return

        if (ringTimeout.current) clearTimeout(ringTimeout.current)

        await supabase
            .from('voice_calls')
            .update({ status: 'connecting' })
            .eq('id', state.callInfo.id)

        await joinAgoraChannel()
    }

    // رفض المكالمة
    const rejectCall = async () => {
        if (!state.callInfo) return

        if (ringTimeout.current) clearTimeout(ringTimeout.current)

        await supabase
            .from('voice_calls')
            .update({ status: 'rejected', ended_at: new Date().toISOString() })
            .eq('id', state.callInfo.id)

        handleCallEnded()
    }

    // إنهاء المكالمة
    const endCall = async () => {
        if (!state.callInfo) return

        if (durationInterval.current) clearInterval(durationInterval.current)
        if (ringTimeout.current) clearTimeout(ringTimeout.current)

        // تسجيل المكالمة
        await supabase.rpc('log_completed_call', {
            p_call_id: state.callInfo.id,
            p_status: state.duration > 0 ? 'completed' : 'missed'
        })

        await agoraClient.leave()
        handleCallEnded()
    }

    // كتم/إلغاء كتم
    const toggleMute = async () => {
        const newMutedState = await agoraClient.toggleMute()
        setState(prev => ({ ...prev, isMuted: newMutedState }))
    }

    return {
        ...state,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        isInCall: ['calling', 'ringing', 'connecting', 'connected'].includes(state.status),
        canStartCall: state.status === 'idle' && !!user?.id
    }
}
