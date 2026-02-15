// TechLayout - تخطيط مبسط للموبايل خاص بالفنى
// تم نقل الرسائل والاتصالات للهيدر + زر اتصال عائم
import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Home, LogOut, RefreshCw, MapPin, MessageSquare, Phone } from 'lucide-react'
import TechBottomNav from '../Tech/TechBottomNav'
import NotificationBell from '../Notifications/NotificationBell'
import { PushNotificationPrompt } from '../Notifications'
import { CallsModal } from '../VoiceCall'

interface TechLayoutProps {
    children: React.ReactNode
    onRefresh?: () => void
    isLeader?: boolean
    routeName?: string  // اسم خط السير
}

export const TechLayout: React.FC<TechLayoutProps> = ({ children, onRefresh, isLeader = false, routeName }) => {
    const { user, signOut } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [showCallsModal, setShowCallsModal] = useState(false)

    const today = new Date().toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    const isMessagesActive = location.pathname.startsWith('/tech/messages')

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
            {/* Header */}
            <header className="bg-white shadow-md sticky top-0 z-40">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                        {/* Logo & Title */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                                <Home className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-gray-800">HOME CARE</h1>
                                <p className="text-xs text-gray-500">تطبيق الفنى</p>
                            </div>
                        </div>

                        {/* Actions — الإشعارات + الرسائل + التحديث + الخروج */}
                        <div className="flex items-center gap-1.5">
                            {/* Messages — منقول من النافبار */}
                            <button
                                onClick={() => navigate('/tech/messages')}
                                className={`p-2 rounded-lg transition-colors relative ${isMessagesActive
                                    ? 'bg-blue-100 text-blue-600'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                    }`}
                                title="الرسائل"
                            >
                                <MessageSquare className="w-5 h-5" />
                            </button>

                            {/* Notification Bell */}
                            <NotificationBell />

                            {onRefresh && (
                                <button
                                    onClick={onRefresh}
                                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                                    title="تحديث"
                                >
                                    <RefreshCw className="w-5 h-5 text-gray-600" />
                                </button>
                            )}
                            <button
                                onClick={handleSignOut}
                                className="p-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
                                title="تسجيل الخروج"
                            >
                                <LogOut className="w-5 h-5 text-red-600" />
                            </button>
                        </div>
                    </div>

                    {/* Date & User Info */}
                    <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-gray-600">{today}</span>
                        <span className="text-blue-600 font-medium">{user?.full_name || 'الفنى'}</span>
                    </div>

                    {/* Route Name Banner */}
                    {routeName && (
                        <div className="mt-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg px-3 py-2 border border-blue-100">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-500" />
                                <span className="text-sm font-medium text-blue-700">
                                    خط السير: {routeName}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content - with bottom padding for nav bar */}
            <main className="flex-1 overflow-y-auto pb-24">
                {children}
            </main>

            {/* Floating Call Button — زر اتصال عائم */}
            <button
                onClick={() => setShowCallsModal(true)}
                className="fixed left-4 bottom-20 z-40 w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full shadow-lg shadow-emerald-500/30 flex items-center justify-center hover:shadow-xl hover:scale-105 transition-all duration-200 active:scale-95"
                title="اتصال"
            >
                <Phone className="w-5 h-5 text-white" />
            </button>

            {/* Bottom Navigation */}
            <TechBottomNav isLeader={isLeader} />

            {/* Calls Modal */}
            <CallsModal
                isOpen={showCallsModal}
                onClose={() => setShowCallsModal(false)}
            />

            {/* Push Notification Prompt - للفنيين */}
            <PushNotificationPrompt delay={3000} variant="floating" />
        </div>
    )
}

export default TechLayout
