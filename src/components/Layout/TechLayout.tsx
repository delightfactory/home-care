// TechLayout - تخطيط موبايل احترافى خاص بالفنى
import React, { useState } from 'react'

import { useAuth } from '../../contexts/AuthContext'
import { Home, MapPin, Phone } from 'lucide-react'
import TechBottomNav from '../Tech/TechBottomNav'
import NotificationBell from '../Notifications/NotificationBell'
import { PushNotificationPrompt } from '../Notifications'
import { CallsModal } from '../VoiceCall'
import { formatDateFull } from '../../utils/formatters'

interface TechLayoutProps {
    children: React.ReactNode
    onRefresh?: () => void
    isLeader?: boolean
    routeName?: string
}

export const TechLayout: React.FC<TechLayoutProps> = ({ children, isLeader = false, routeName }) => {
    const { user } = useAuth()

    const [showCallsModal, setShowCallsModal] = useState(false)

    const today = formatDateFull()

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header — مبسط */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                        {/* Logo & Title */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <Home className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-base font-bold text-gray-800 leading-tight">HOME CARE</h1>
                                <p className="text-[11px] text-gray-400">{user?.full_name || 'الفنى'}</p>
                            </div>
                        </div>

                        {/* Actions — إشعارات فقط */}
                        <div className="flex items-center gap-1">
                            <NotificationBell />
                        </div>
                    </div>

                    {/* Date */}
                    <p className="text-xs text-gray-400 mt-1.5">{today}</p>

                    {/* Route Name Banner */}
                    {routeName && (
                        <div className="mt-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl px-3 py-2 border border-blue-100/80">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                                <span className="text-xs font-medium text-blue-700">
                                    {routeName}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto pb-24">
                {children}
            </main>

            {/* Floating Call Button */}
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

            {/* Push Notification Prompt */}
            <PushNotificationPrompt delay={3000} variant="floating" />
        </div>
    )
}

export default TechLayout
