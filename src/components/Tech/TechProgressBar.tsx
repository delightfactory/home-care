// TechProgressBar - شريط تقدم الفنى بتصميم stepper
import React from 'react'
import { TechnicianProgress } from '../../api/technician'

interface TechProgressBarProps {
    progress: TechnicianProgress
}

export const TechProgressBar: React.FC<TechProgressBarProps> = ({ progress }) => {
    const { completed, total, percentage } = progress

    if (total === 0) return null

    const isAllDone = completed === total

    return (
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">
                    {isAllDone ? 'خلّصت كل الطلبات 🎉' : 'تقدم اليوم'}
                </span>
                <span className={`text-sm font-bold ${isAllDone ? 'text-green-600' : 'text-blue-600'}`}>
                    {completed} / {total}
                </span>
            </div>

            {/* Progress Bar */}
            <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className={`absolute inset-y-0 right-0 rounded-full transition-all duration-700 ease-out ${isAllDone
                            ? 'bg-gradient-to-l from-green-400 to-emerald-500'
                            : 'bg-gradient-to-l from-blue-400 to-blue-500'
                        }`}
                    style={{ width: `${Math.max(percentage, 3)}%` }}
                />
            </div>

            {/* Stepper dots */}
            {total <= 10 && (
                <div className="flex items-center justify-between mt-2 px-0.5">
                    {Array.from({ length: total }, (_, i) => (
                        <div
                            key={i}
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${i < completed
                                    ? isAllDone ? 'bg-green-500' : 'bg-blue-500'
                                    : 'bg-gray-200'
                                }`}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export default TechProgressBar
