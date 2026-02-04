/**
 * مودال الاتصالات الكامل
 * تصميم احترافي مثل Samsung One UI / iOS
 */

import React, { useState, useEffect, useMemo } from 'react'
import {
    X,
    Phone,
    PhoneMissed,
    PhoneOff,

    User,
    Search,
    Loader2,
    PhoneOutgoing,
    PhoneIncoming,
    Users,
    History
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useVoiceCallContext } from '../VoiceCallProvider'
import { formatDistanceToNow } from 'date-fns'
import { ar } from 'date-fns/locale'

interface CallsModalProps {
    isOpen: boolean
    onClose: () => void
}

interface CallLog {
    id: string
    caller_id: string
    callee_id: string
    caller_name: string
    callee_name: string
    duration_seconds: number
    status: 'completed' | 'missed' | 'rejected'
    created_at: string
}

interface UserItem {
    id: string
    full_name: string
    phone: string | null
    role_name?: string
}

// ألوان الـ Avatar العشوائية
const avatarColors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-orange-500 to-amber-500',
    'from-pink-500 to-rose-500',
    'from-indigo-500 to-blue-500',
]

const getAvatarColor = (id: string) => {
    const index = id.charCodeAt(0) % avatarColors.length
    return avatarColors[index]
}

const CallsModal: React.FC<CallsModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth()
    const { startCall, canStartCall } = useVoiceCallContext()
    const [activeTab, setActiveTab] = useState<'history' | 'new'>('history')
    const [callLogs, setCallLogs] = useState<CallLog[]>([])
    const [users, setUsers] = useState<UserItem[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isLoadingUsers, setIsLoadingUsers] = useState(false)

    // جلب سجل المكالمات
    useEffect(() => {
        if (!isOpen || !user?.id) return

        const fetchCallLogs = async () => {
            setIsLoading(true)
            try {
                const { data, error } = await supabase
                    .from('call_logs')
                    .select('*')
                    .or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`)
                    .order('created_at', { ascending: false })
                    .limit(50)

                if (error) throw error
                setCallLogs(data || [])
            } catch (error) {
                console.error('Error fetching call logs:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchCallLogs()
    }, [isOpen, user?.id])

    // جلب قائمة المستخدمين
    useEffect(() => {
        if (!isOpen || activeTab !== 'new') return

        const fetchUsers = async () => {
            setIsLoadingUsers(true)
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select(`
                        id,
                        full_name,
                        phone,
                        role:roles(name)
                    `)
                    .neq('id', user?.id)
                    .eq('is_active', true)
                    .order('full_name')

                if (error) throw error
                setUsers(data?.map(u => ({
                    id: u.id,
                    full_name: u.full_name,
                    phone: u.phone,
                    role_name: (u.role as any)?.name
                })) || [])
            } catch (error) {
                console.error('Error fetching users:', error)
            } finally {
                setIsLoadingUsers(false)
            }
        }

        fetchUsers()
    }, [isOpen, activeTab, user?.id])

    // تصفية المستخدمين حسب البحث
    const filteredUsers = useMemo(() => {
        if (!searchQuery.trim()) return users
        const query = searchQuery.toLowerCase()
        return users.filter(u =>
            u.full_name.toLowerCase().includes(query) ||
            u.phone?.includes(query)
        )
    }, [users, searchQuery])

    // عدد المكالمات الفائتة
    const missedCount = useMemo(() => {
        return callLogs.filter(log =>
            log.status === 'missed' && log.callee_id === user?.id
        ).length
    }, [callLogs, user?.id])

    // تنسيق مدة المكالمة
    const formatDuration = (seconds: number): string => {
        if (seconds < 60) return `${seconds} ث`
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        if (mins < 60) return `${mins}:${secs.toString().padStart(2, '0')}`
        const hours = Math.floor(mins / 60)
        return `${hours}:${(mins % 60).toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    // تنسيق التاريخ
    const formatDate = (dateStr: string): string => {
        try {
            return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ar })
        } catch {
            return ''
        }
    }

    // أيقونة حالة المكالمة
    const getCallStatusIcon = (log: CallLog) => {
        const isOutgoing = log.caller_id === user?.id

        if (log.status === 'completed') {
            return isOutgoing ? (
                <PhoneOutgoing className="w-4 h-4 text-emerald-500" />
            ) : (
                <PhoneIncoming className="w-4 h-4 text-blue-500" />
            )
        }
        if (log.status === 'missed') {
            return <PhoneMissed className="w-4 h-4 text-red-500" />
        }
        return <PhoneOff className="w-4 h-4 text-gray-400" />
    }

    // اسم الطرف الآخر
    const getOtherPartyName = (log: CallLog): string => {
        return log.caller_id === user?.id ? log.callee_name : log.caller_name
    }

    // بدء مكالمة جديدة
    const handleStartCall = (targetUser: UserItem) => {
        startCall(targetUser.id, targetUser.full_name)
        onClose()
    }

    // إعادة الاتصال من السجل
    const handleCallBack = (log: CallLog) => {
        const otherId = log.caller_id === user?.id ? log.callee_id : log.caller_id
        const otherName = getOtherPartyName(log)
        startCall(otherId, otherName)
        onClose()
    }

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop with blur */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className="fixed inset-x-0 bottom-0 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-auto sm:top-[8%] sm:w-full sm:max-w-md z-50"
                style={{ maxHeight: '85vh' }}
            >
                <div className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden h-[85vh] sm:h-auto sm:max-h-[80vh]">

                    {/* Header - Glassmorphism style */}
                    <div className="relative overflow-hidden">
                        {/* Background gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600" />

                        {/* Decorative circles */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                        <div className="absolute -bottom-5 -left-5 w-24 h-24 bg-white/10 rounded-full blur-xl" />

                        {/* Content */}
                        <div className="relative px-5 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                        <Phone className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">المكالمات</h2>
                                        <p className="text-white/70 text-xs">
                                            {callLogs.length > 0 ? `${callLogs.length} مكالمة` : 'لا توجد مكالمات'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white transition-all active:scale-95"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tabs - Pill style */}
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex gap-2 p-1 bg-gray-200/70 dark:bg-gray-700/50 rounded-2xl">
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'history'
                                    ? 'bg-white dark:bg-gray-800 text-emerald-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <History className="w-4 h-4" />
                                السجل
                                {missedCount > 0 && (
                                    <span className="px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full min-w-[18px]">
                                        {missedCount}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('new')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'new'
                                    ? 'bg-white dark:bg-gray-800 text-emerald-600 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Users className="w-4 h-4" />
                                اتصال جديد
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                        {/* Tab: History */}
                        {activeTab === 'history' && (
                            <div className="p-3">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-16">
                                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                                            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                                        </div>
                                        <p className="text-gray-400 text-sm">جاري التحميل...</p>
                                    </div>
                                ) : callLogs.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16">
                                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mb-4">
                                            <Phone className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <h3 className="text-gray-600 font-medium mb-1">لا توجد مكالمات</h3>
                                        <p className="text-gray-400 text-sm text-center">
                                            ابدأ مكالمة جديدة من تبويب<br />"اتصال جديد"
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {callLogs.map(log => (
                                            <div
                                                key={log.id}
                                                className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all group cursor-pointer"
                                                onClick={() => canStartCall && handleCallBack(log)}
                                            >
                                                {/* Avatar */}
                                                <div className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(log.id)} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                                                    {getOtherPartyName(log).charAt(0)}
                                                    {/* Status indicator */}
                                                    <div className="absolute -bottom-0.5 -right-0.5 p-1 bg-white rounded-full shadow">
                                                        {getCallStatusIcon(log)}
                                                    </div>
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                                                        {getOtherPartyName(log)}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <span>{formatDate(log.created_at)}</span>
                                                        {log.status === 'completed' && (
                                                            <>
                                                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                                                <span className="text-emerald-600">{formatDuration(log.duration_seconds)}</span>
                                                            </>
                                                        )}
                                                        {log.status === 'missed' && log.callee_id === user?.id && (
                                                            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px] font-medium">
                                                                فائتة
                                                            </span>
                                                        )}
                                                        {log.status === 'rejected' && (
                                                            <span className="text-gray-400">مرفوضة</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Call Back Button */}
                                                {canStartCall && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleCallBack(log)
                                                        }}
                                                        className="p-2.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/30 opacity-0 group-hover:opacity-100 active:scale-95"
                                                        title="إعادة الاتصال"
                                                    >
                                                        <Phone className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab: New Call */}
                        {activeTab === 'new' && (
                            <div className="flex flex-col h-full">
                                {/* Search */}
                                <div className="p-3 sticky top-0 bg-white dark:bg-gray-900 z-10">
                                    <div className="relative">
                                        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="بحث بالاسم أو رقم الهاتف..."
                                            className="w-full pr-11 pl-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:bg-white dark:focus:bg-gray-700 border border-transparent focus:border-emerald-200 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Users List */}
                                <div className="flex-1 overflow-y-auto p-3 pt-0">
                                    {isLoadingUsers ? (
                                        <div className="flex flex-col items-center justify-center py-16">
                                            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                                                <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                                            </div>
                                            <p className="text-gray-400 text-sm">جاري تحميل المستخدمين...</p>
                                        </div>
                                    ) : filteredUsers.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16">
                                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mb-4">
                                                <User className="w-8 h-8 text-gray-400" />
                                            </div>
                                            <h3 className="text-gray-600 font-medium mb-1">
                                                {searchQuery ? 'لا توجد نتائج' : 'لا يوجد مستخدمين'}
                                            </h3>
                                            <p className="text-gray-400 text-sm">
                                                {searchQuery ? 'جرب البحث بكلمة أخرى' : ''}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {filteredUsers.map(u => (
                                                <div
                                                    key={u.id}
                                                    className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all group"
                                                >
                                                    {/* Avatar */}
                                                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(u.id)} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                                                        {u.full_name.charAt(0)}
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                                                            {u.full_name}
                                                        </p>
                                                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                                            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-medium">
                                                                {u.role_name || 'مستخدم'}
                                                            </span>
                                                            {u.phone && (
                                                                <>
                                                                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                                                                    <span dir="ltr">{u.phone}</span>
                                                                </>
                                                            )}
                                                        </p>
                                                    </div>

                                                    {/* Call Button */}
                                                    {canStartCall && (
                                                        <button
                                                            onClick={() => handleStartCall(u)}
                                                            className="p-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-500/30 active:scale-95"
                                                            title={`اتصال بـ ${u.full_name}`}
                                                        >
                                                            <Phone className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}

export default CallsModal

