// TechQuickActionsMenu - قائمة الإجراءات السريعة للفنى (قائد الفريق)
import React, { useState } from 'react'
import { X, Receipt, Plus } from 'lucide-react'
import TechExpenseForm from './TechExpenseForm'

interface TechQuickActionsMenuProps {
    isOpen: boolean
    onClose: () => void
}

const TechQuickActionsMenu: React.FC<TechQuickActionsMenuProps> = ({ isOpen, onClose }) => {
    const [showExpenseForm, setShowExpenseForm] = useState(false)

    const handleAction = (action: string) => {
        if (action === 'expense') {
            setShowExpenseForm(true)
        }
        onClose()
    }

    const handleExpenseSuccess = () => {
        setShowExpenseForm(false)
    }

    if (!isOpen && !showExpenseForm) return null

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
                    onClick={onClose}
                />
            )}

            {/* Bottom Sheet */}
            {isOpen && (
                <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 animate-slide-up safe-area-pb">
                    {/* Handle */}
                    <div className="flex justify-center pt-3 pb-2">
                        <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 pb-4 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800">الإجراءات السريعة</h3>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Actions List */}
                    <div className="p-4 space-y-3">
                        {/* تسجيل مصروف جديد */}
                        <button
                            onClick={() => handleAction('expense')}
                            className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 rounded-xl border border-green-200 transition-all active:scale-[0.98]"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                                <Receipt className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-right flex-1">
                                <h4 className="font-bold text-gray-800">تسجيل مصروف جديد</h4>
                                <p className="text-sm text-gray-500">سجل مصروفات الفريق اليومية</p>
                            </div>
                            <Plus className="w-5 h-5 text-green-600" />
                        </button>

                        {/* يمكن إضافة إجراءات أخرى هنا مستقبلاً */}
                    </div>

                    {/* Extra padding for safe area */}
                    <div className="h-4" />
                </div>
            )}

            {/* Expense Form Modal */}
            <TechExpenseForm
                isOpen={showExpenseForm}
                onClose={() => setShowExpenseForm(false)}
                onSuccess={handleExpenseSuccess}
            />

            {/* Animation Styles */}
            <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
        </>
    )
}

export default TechQuickActionsMenu
