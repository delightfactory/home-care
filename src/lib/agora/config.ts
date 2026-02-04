/**
 * إعدادات Agora للمكالمات الصوتية
 */

export const AGORA_CONFIG = {
    appId: import.meta.env.VITE_AGORA_APP_ID || '',

    // إعدادات الصوت
    audio: {
        AEC: true,  // إلغاء الصدى
        ANS: true,  // إلغاء الضوضاء
        AGC: true   // التحكم التلقائي بالصوت
    },

    // إعدادات المكالمة
    call: {
        ringTimeout: 30000,     // مهلة الرنين: 30 ثانية
        tokenExpiry: 3600,      // صلاحية التوكن: 1 ساعة
        reconnectAttempts: 3    // محاولات إعادة الاتصال
    }
}

// أنواع حالات المكالمة
export type CallStatus =
    | 'idle'        // خامل
    | 'calling'     // يتصل
    | 'ringing'     // يرن
    | 'connecting'  // يتصل بـ Agora
    | 'connected'   // متصل
    | 'ended'       // انتهت
    | 'failed'      // فشلت
    | 'rejected'    // رُفضت
    | 'missed'      // فائتة

// واجهة معلومات المكالمة
export interface CallInfo {
    id: string
    channelName: string
    callerId: string
    callerName: string
    calleeId: string
    calleeName: string
    status: CallStatus
    startedAt?: Date
    answeredAt?: Date
    endedAt?: Date
}

// واجهة المستخدم البعيد
export interface RemoteUser {
    uid: string | number
    hasAudio: boolean
}
