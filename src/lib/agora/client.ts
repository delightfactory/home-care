/**
 * عميل Agora للمكالمات الصوتية
 */

import type {
    IAgoraRTCClient,
    IMicrophoneAudioTrack,
    IAgoraRTCRemoteUser,
    IRemoteAudioTrack
} from 'agora-rtc-sdk-ng'
import { AGORA_CONFIG } from './config'

type AgoraRTCModule = typeof import('agora-rtc-sdk-ng')['default']

let agoraRTCModulePromise: Promise<AgoraRTCModule> | null = null

/**
 * تحميل SDK عند الحاجة فقط، مع إعادة استخدام نفس الطلب أثناء التحميل.
 */
const loadAgoraRTC = (): Promise<AgoraRTCModule> => {
    if (!agoraRTCModulePromise) {
        agoraRTCModulePromise = import('agora-rtc-sdk-ng')
            .then(({ default: AgoraRTC }) => {
                AgoraRTC.setLogLevel(3) // تقليل السجلات (0=debug, 3=warning)
                return AgoraRTC
            })
            .catch((error) => {
                // السماح بمحاولة جديدة إذا فشل التحميل مؤقتاً.
                agoraRTCModulePromise = null
                throw error
            })
    }

    return agoraRTCModulePromise
}

class AgoraClient {
    private client: IAgoraRTCClient | null = null
    private localAudioTrack: IMicrophoneAudioTrack | null = null
    private remoteAudioTracks: Map<string | number, IRemoteAudioTrack> = new Map()
    private isJoined = false

    /**
     * الحصول على عميل Agora (إنشاء إذا لم يكن موجوداً)
     */
    private async getClient(): Promise<IAgoraRTCClient> {
        if (!this.client) {
            const AgoraRTC = await loadAgoraRTC()
            this.client = AgoraRTC.createClient({
                mode: 'rtc',
                codec: 'vp8'
            })
        }
        return this.client
    }

    /**
     * بدء تحميل SDK مبكراً عند بدء المكالمة دون إدخاله في حزمة التطبيق الأساسية.
     */
    async preload(): Promise<void> {
        await loadAgoraRTC()
    }

    /**
     * الانضمام لقناة صوتية
     */
    async join(channelName: string, token: string | null, uid: string | number): Promise<void> {
        if (this.isJoined) {
            console.warn('⚠️ بالفعل متصل بقناة')
            return
        }

        try {
            const [client, AgoraRTC] = await Promise.all([
                this.getClient(),
                loadAgoraRTC()
            ])
            // الانضمام للقناة
            await client.join(AGORA_CONFIG.appId, channelName, token, uid)
            this.isJoined = true
            console.log('✅ تم الانضمام للقناة:', channelName)

            // إنشاء مسار الصوت المحلي
            this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
                AEC: AGORA_CONFIG.audio.AEC,
                ANS: AGORA_CONFIG.audio.ANS,
                AGC: AGORA_CONFIG.audio.AGC
            })

            // نشر الصوت
            await client.publish([this.localAudioTrack])
            console.log('🎤 تم نشر الصوت')

        } catch (error) {
            console.error('❌ فشل الانضمام:', error)
            this.isJoined = false
            throw error
        }
    }

    /**
     * مغادرة القناة
     */
    async leave(): Promise<void> {
        if (!this.isJoined) return

        try {
            // إيقاف وإغلاق مسار الصوت
            if (this.localAudioTrack) {
                this.localAudioTrack.stop()
                this.localAudioTrack.close()
                this.localAudioTrack = null
            }

            // إيقاف وتنظيف مسارات الصوت البعيدة
            this.remoteAudioTracks.forEach((track) => {
                try {
                    track.stop()
                } catch (e) {
                    console.warn('⚠️ فشل إيقاف مسار صوت بعيد:', e)
                }
            })
            this.remoteAudioTracks.clear()

            // مغادرة القناة
            await this.client?.leave()
            this.isJoined = false
            console.log('👋 تم مغادرة القناة')

        } catch (error) {
            console.error('❌ خطأ في المغادرة:', error)
            throw error
        }
    }

    /**
     * كتم/إلغاء كتم الميكروفون
     */
    async toggleMute(): Promise<boolean> {
        if (!this.localAudioTrack) return false

        const isMuted = !this.localAudioTrack.enabled
        await this.localAudioTrack.setEnabled(isMuted)

        console.log(isMuted ? '🔊 إلغاء الكتم' : '🔇 كتم الصوت')
        return !isMuted // إرجاع الحالة الجديدة
    }

    /**
     * الحصول على حالة الكتم
     */
    isMuted(): boolean {
        return this.localAudioTrack ? !this.localAudioTrack.enabled : false
    }

    /**
     * الاستماع لأحداث المستخدمين البعيدين
     */
    onRemoteUserJoined(callback: (user: IAgoraRTCRemoteUser) => void): void {
        this.client?.on('user-joined', callback)
    }

    onRemoteUserLeft(callback: (user: IAgoraRTCRemoteUser) => void): void {
        this.client?.on('user-left', (user) => {
            // إزالة مسار الصوت البعيد
            this.remoteAudioTracks.delete(user.uid)
            callback(user)
        })
    }

    onRemoteAudioPublished(callback: (user: IAgoraRTCRemoteUser) => void): void {
        this.client?.on('user-published', async (user, mediaType) => {
            if (mediaType === 'audio') {
                // الاشتراك في صوت المستخدم البعيد
                await this.client?.subscribe(user, mediaType)

                if (user.audioTrack) {
                    // حفظ مسار الصوت البعيد
                    this.remoteAudioTracks.set(user.uid, user.audioTrack)

                    // تشغيل الصوت
                    user.audioTrack.play()
                }

                callback(user)
            }
        })
    }

    onRemoteAudioUnpublished(callback: (user: IAgoraRTCRemoteUser) => void): void {
        this.client?.on('user-unpublished', (user, mediaType) => {
            if (mediaType === 'audio') {
                this.remoteAudioTracks.delete(user.uid)
                callback(user)
            }
        })
    }

    /**
     * إزالة كل المستمعين
     */
    removeAllListeners(): void {
        this.client?.removeAllListeners()
    }

    /**
     * هل متصل حالياً؟
     */
    get connected(): boolean {
        return this.isJoined
    }
}

// تصدير نسخة واحدة
export const agoraClient = new AgoraClient()
