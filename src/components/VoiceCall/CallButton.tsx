/**
 * زر بدء مكالمة صوتية
 */

import React from 'react'
import { Phone } from 'lucide-react'

interface CallButtonProps {
    userId: string
    userName: string
    onCall: (userId: string, userName: string) => void
    disabled?: boolean
    size?: 'sm' | 'md' | 'lg'
    className?: string
}

const CallButton: React.FC<CallButtonProps> = ({
    userId,
    userName,
    onCall,
    disabled = false,
    size = 'md',
    className = ''
}) => {
    const sizeClasses = {
        sm: 'p-2',
        md: 'p-2.5',
        lg: 'p-3'
    }

    const iconSizes = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6'
    }

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!disabled) {
            onCall(userId, userName)
        }
    }

    return (
        <button
            onClick={handleClick}
            disabled={disabled}
            title={`اتصال بـ ${userName}`}
            className={`
        ${sizeClasses[size]}
        bg-gradient-to-r from-emerald-500 to-emerald-600 
        text-white rounded-xl 
        hover:from-emerald-600 hover:to-emerald-700 
        transition-all shadow-lg shadow-emerald-500/30 
        active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${className}
      `}
        >
            <Phone className={iconSizes[size]} />
        </button>
    )
}

export default CallButton
