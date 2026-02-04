// TechBottomNav - شريط التنقل السفلي لتطبيق الفنى
import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Plus, Receipt, MessageSquare, Phone } from 'lucide-react'
import TechQuickActionsMenu from './TechQuickActionsMenu'
import { CallsModal } from '../VoiceCall'

interface TechBottomNavProps {
    isLeader: boolean
}

const TechBottomNav: React.FC<TechBottomNavProps> = ({ isLeader }) => {
    const navigate = useNavigate()
    const location = useLocation()
    const [showQuickActions, setShowQuickActions] = useState(false)
    const [showCallsModal, setShowCallsModal] = useState(false)

    // فقط المسارات المتاحة حالياً في تطبيق الفنى
    // ⚠️ لا تُضف أي مسار خارج /tech/* لمنع الوصول للتطبيق الإداري
    const navItems = [
        { path: '/tech', icon: Home, label: 'الرئيسية' },
        { path: '/tech/messages', icon: MessageSquare, label: 'الرسائل' },
        // زر الاتصالات
        { path: 'calls', icon: Phone, label: 'اتصال', isCallAction: true },
        // زر الإجراءات السريعة (للقائد فقط)
        ...(isLeader ? [{ path: 'quick-action', icon: Plus, label: 'إجراء', isAction: true }] : []),
        ...(isLeader ? [{ path: '/tech/expenses', icon: Receipt, label: 'مصروفات' }] : []),
    ]

    const handleNavClick = (item: any) => {
        if (item.isAction) {
            setShowQuickActions(true)
        } else if (item.isCallAction) {
            setShowCallsModal(true)
        } else {
            navigate(item.path)
        }
    }

    const isActive = (path: string) => {
        if (path === '/tech') {
            return location.pathname === '/tech'
        }
        return location.pathname.startsWith(path)
    }

    return (
        <>
            {/* Bottom Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 safe-area-pb">
                <div className="flex items-center justify-around h-16 px-2">
                    {navItems.map((item, index) => {
                        const Icon = item.icon
                        const active = !item.isAction && isActive(item.path)

                        // زر الإجراءات السريعة - تصميم مميز
                        if (item.isAction) {
                            return (
                                <button
                                    key={index}
                                    onClick={() => handleNavClick(item)}
                                    className="relative -top-4 flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                                >
                                    <Icon className="w-7 h-7 text-white" />
                                </button>
                            )
                        }

                        // زر الاتصالات - تصميم أخضر مميز
                        if (item.isCallAction) {
                            return (
                                <button
                                    key={index}
                                    onClick={() => handleNavClick(item)}
                                    className="flex flex-col items-center justify-center flex-1 py-2 transition-colors text-emerald-600 hover:text-emerald-700"
                                >
                                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center shadow-md shadow-emerald-500/30">
                                        <Icon className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="text-xs mt-1 font-medium">
                                        {item.label}
                                    </span>
                                </button>
                            )
                        }

                        return (
                            <button
                                key={index}
                                onClick={() => handleNavClick(item)}
                                className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors ${active
                                    ? 'text-blue-600'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <Icon className={`w-6 h-6 ${active ? 'text-blue-600' : ''}`} />
                                <span className={`text-xs mt-1 ${active ? 'font-semibold' : ''}`}>
                                    {item.label}
                                </span>
                                {active && (
                                    <div className="absolute bottom-0 w-8 h-1 bg-blue-600 rounded-t-full" />
                                )}
                            </button>
                        )
                    })}
                </div>
            </nav>

            {/* Quick Actions Menu */}
            <TechQuickActionsMenu
                isOpen={showQuickActions}
                onClose={() => setShowQuickActions(false)}
            />

            {/* Calls Modal */}
            <CallsModal
                isOpen={showCallsModal}
                onClose={() => setShowCallsModal(false)}
            />
        </>
    )
}

export default TechBottomNav
