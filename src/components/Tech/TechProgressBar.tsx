// TechProgressBar - شريط تقدم الفنى
import React from 'react'
import { CheckCircle, Clock } from 'lucide-react'
import { TechnicianProgress } from '../../api/technician'

interface TechProgressBarProps {
    progress: TechnicianProgress
}

export const TechProgressBar: React.FC<TechProgressBarProps> = ({ progress }) => {
    const { completed, total, percentage } = progress

    if (total === 0) {
        return (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-center gap-2 text-gray-500">
                    <Clock className="w-5 h-5" />
                    <span>لا توجد طلبات لهذا اليوم</span>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="font-semibold text-gray-700">تقدم اليوم</span>
                </div>
                <div className="text-lg font-bold text-blue-600">
                    {completed} / {total}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className="absolute inset-y-0 right-0 bg-gradient-to-l from-green-400 to-green-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${percentage}%` }}
                />
                {/* Animated shine effect */}
                <div
                    className="absolute inset-y-0 right-0 bg-gradient-to-l from-white/30 to-transparent rounded-full"
                    style={{ width: `${percentage}%` }}
                />
            </div>

            {/* Percentage */}
            <div className="mt-2 text-center">
                <span className="text-sm text-gray-500">
                    {percentage === 100 ? (
                        <span className="text-green-600 font-bold">🎉 أنهيت جميع الطلبات!</span>
                    ) : (
                        <>أكملت <span className="font-bold text-blue-600">{percentage}%</span> من طلبات اليوم</>
                    )}
                </span>
            </div>
        </div>
    )
}

export default TechProgressBar
