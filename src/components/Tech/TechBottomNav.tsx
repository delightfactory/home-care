// TechBottomNav - شريط تنقل سفلى بتصميم iOS-like
import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Clock, UserCircle, Wallet, Plus } from 'lucide-react'
import TechQuickActionsMenu from './TechQuickActionsMenu'

interface TechBottomNavProps {
    isLeader: boolean
}

const TechBottomNav: React.FC<TechBottomNavProps> = ({ isLeader }) => {
    const navigate = useNavigate()
    const location = useLocation()
    const [showQuickActions, setShowQuickActions] = useState(false)

    const navItems = [
        { path: '/tech', icon: Home, label: 'الرئيسية' },
        { path: '/tech/attendance', icon: Clock, label: 'الحضور' },
        ...(isLeader ? [{ path: 'quick-action', icon: Plus, label: 'إجراء', isAction: true }] : []),
        ...(isLeader ? [{ path: '/tech/custody', icon: Wallet, label: 'العُهدة' }] : []),
        { path: '/tech/profile', icon: UserCircle, label: 'حسابى' },
    ]

    const handleNavClick = (item: any) => {
        if (item.isAction) {
            setShowQuickActions(true)
        } else {
            navigate(item.path)
        }
    }

    const isActive = (path: string) => {
        if (path === '/tech') return location.pathname === '/tech'
        return location.pathname.startsWith(path)
    }

    return (
        <>
            <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200/80 z-50 safe-area-pb">
                <div className="flex items-center justify-around h-16 px-1 max-w-lg mx-auto">
                    {navItems.map((item, index) => {
                        const Icon = item.icon
                        const active = !item.isAction && isActive(item.path)

                        // FAB — زر الإجراءات السريعة
                        if (item.isAction) {
                            return (
                                <button
                                    key={index}
                                    onClick={() => handleNavClick(item)}
                                    className="relative -top-3 flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg shadow-blue-500/30 hover:shadow-xl active:scale-95 transition-all duration-200"
                                >
                                    <Icon className="w-6 h-6 text-white" />
                                </button>
                            )
                        }

                        return (
                            <button
                                key={index}
                                onClick={() => handleNavClick(item)}
                                className="relative flex flex-col items-center justify-center flex-1 py-1.5 transition-all duration-200"
                            >
                                <div className={`p-1 rounded-xl transition-all duration-200 ${active ? 'bg-blue-50' : ''
                                    }`}>
                                    <Icon className={`w-5 h-5 transition-colors duration-200 ${active ? 'text-blue-600' : 'text-gray-400'
                                        }`} />
                                </div>
                                <span className={`text-[10px] mt-0.5 transition-all duration-200 ${active ? 'font-bold text-blue-600' : 'text-gray-400'
                                    }`}>
                                    {item.label}
                                </span>
                                {active && (
                                    <div className="absolute -bottom-0.5 w-5 h-[3px] bg-blue-600 rounded-full" />
                                )}
                            </button>
                        )
                    })}
                </div>
            </nav>

            <TechQuickActionsMenu
                isOpen={showQuickActions}
                onClose={() => setShowQuickActions(false)}
            />
        </>
    )
}

export default TechBottomNav
