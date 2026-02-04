/**
 * زر الاتصالات العائم للتطبيق العام
 * يظهر في جميع الصفحات ويفتح مودال الاتصالات
 */

import React, { useState } from 'react'
import { Phone } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import CallsModal from '../VoiceCall/CallsModal'

interface FloatingCallButtonProps {
    className?: string
}

const FloatingCallButton: React.FC<FloatingCallButtonProps> = ({ className = '' }) => {
    const [showModal, setShowModal] = useState(false)
    const [showTooltip, setShowTooltip] = useState(false)
    const location = useLocation()

    // إخفاء الزر في صفحات معينة
    const hiddenPaths = ['/login', '/signup', '/tech']
    if (hiddenPaths.some(path => location.pathname.startsWith(path))) {
        return null
    }

    return (
        <>
            {/* Floating Button */}
            <div className="fixed bottom-24 right-4 z-40">
                <div className="relative">
                    {/* Tooltip */}
                    {showTooltip && (
                        <div className="absolute bottom-12 right-0 bg-gray-900/95 backdrop-blur-sm text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-xl border border-gray-700">
                            <div className="font-medium">المكالمات</div>
                            <div className="absolute -bottom-1 right-3 w-1.5 h-1.5 bg-gray-900 transform rotate-45 border-r border-b border-gray-700" />
                        </div>
                    )}

                    <button
                        onClick={() => setShowModal(true)}
                        onMouseEnter={() => setShowTooltip(true)}
                        onMouseLeave={() => setShowTooltip(false)}
                        className={`
                            relative
                            w-10 h-10 
                            bg-gradient-to-br from-emerald-500 to-emerald-600 
                            hover:from-emerald-600 hover:to-emerald-700 
                            text-white 
                            rounded-full 
                            shadow-lg shadow-emerald-500/30
                            hover:shadow-xl hover:shadow-emerald-500/40
                            transition-all duration-200 
                            transform hover:scale-105 
                            flex items-center justify-center
                            group
                            border border-white/20
                            ${className}
                        `}
                        title="المكالمات"
                        aria-label="فتح المكالمات"
                    >
                        <Phone className="h-4 w-4" />

                        {/* Pulse animation */}
                        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 border border-white"></span>
                        </span>
                    </button>
                </div>
            </div>

            {/* Calls Modal */}
            <CallsModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
            />
        </>
    )
}

export default FloatingCallButton
