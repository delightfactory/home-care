import React, { useState } from 'react'
import { X, ArrowDownCircle, ArrowUpCircle, Wallet, AlertTriangle } from 'lucide-react'
import { VaultsAPI } from '../../api/vaults'
import { Vault } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency } from '../../api'
import toast from 'react-hot-toast'

interface VaultAdjustmentModalProps {
    vault: Vault
    onClose: () => void
    onSuccess: () => void
}

const VaultAdjustmentModal: React.FC<VaultAdjustmentModalProps> = ({
    vault,
    onClose,
    onSuccess,
}) => {
    const { user } = useAuth()
    const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit')
    const [amount, setAmount] = useState('')
    const [notes, setNotes] = useState('')
    const [loading, setLoading] = useState(false)

    const numericAmount = parseFloat(amount) || 0
    const isWithdrawal = type === 'withdrawal'
    const insufficientBalance = isWithdrawal && numericAmount > (vault.balance || 0)
    const canSubmit = numericAmount > 0 && notes.trim().length > 0 && !insufficientBalance && !loading

    const handleSubmit = async () => {
        if (!canSubmit || !user?.id) return

        setLoading(true)
        try {
            const result = await VaultsAPI.manualAdjustment(
                vault.id,
                numericAmount,
                type,
                user.id,
                notes.trim()
            )

            if (result.success) {
                toast.success(
                    type === 'deposit'
                        ? `تم إيداع ${formatCurrency(numericAmount)} ج.م بنجاح`
                        : `تم سحب ${formatCurrency(numericAmount)} ج.م بنجاح`
                )
                onSuccess()
                onClose()
            } else {
                toast.error(result.error || 'حدث خطأ أثناء العملية')
            }
        } catch (error) {
            toast.error('حدث خطأ غير متوقع')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                {/* Header */}
                <div className={`px-6 py-4 ${type === 'deposit'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-700'
                        : 'bg-gradient-to-r from-red-600 to-rose-700'
                    }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/15 rounded-xl">
                                <Wallet className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">تعديل رصيد الخزنة</h3>
                                <p className="text-sm text-white/80">{vault.name_ar}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* Current Balance */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <span className="text-sm text-gray-600">الرصيد الحالي</span>
                        <span className="text-lg font-bold text-gray-900">
                            {formatCurrency(vault.balance || 0)} ج.م
                        </span>
                    </div>

                    {/* Type Toggle */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">نوع العملية</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setType('deposit')}
                                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 border-2 ${type === 'deposit'
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                                    }`}
                            >
                                <ArrowDownCircle className="w-5 h-5" />
                                إيداع
                            </button>
                            <button
                                onClick={() => setType('withdrawal')}
                                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 border-2 ${type === 'withdrawal'
                                        ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                                    }`}
                            >
                                <ArrowUpCircle className="w-5 h-5" />
                                سحب
                            </button>
                        </div>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">المبلغ (ج.م)</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            className={`w-full px-4 py-3 text-lg font-semibold rounded-xl border-2 transition-colors focus:outline-none ${insufficientBalance
                                    ? 'border-red-300 bg-red-50 focus:border-red-500'
                                    : 'border-gray-200 focus:border-blue-500'
                                }`}
                            dir="ltr"
                        />
                        {insufficientBalance && (
                            <p className="flex items-center gap-1.5 mt-2 text-sm text-red-600">
                                <AlertTriangle className="w-4 h-4" />
                                الرصيد غير كافٍ للسحب
                            </p>
                        )}
                        {numericAmount > 0 && !insufficientBalance && (
                            <p className="mt-2 text-sm text-gray-500">
                                الرصيد بعد العملية:{' '}
                                <span className="font-semibold text-gray-700">
                                    {formatCurrency(
                                        type === 'deposit'
                                            ? (vault.balance || 0) + numericAmount
                                            : (vault.balance || 0) - numericAmount
                                    )}{' '}
                                    ج.م
                                </span>
                            </p>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            السبب / الملاحظات <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="مثال: تعديل رصيد افتتاحي، إيداع نقدي من المالك..."
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none resize-none text-sm"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-white transition-all ${canSubmit
                                ? type === 'deposit'
                                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-sm'
                                    : 'bg-red-600 hover:bg-red-700 shadow-sm'
                                : 'bg-gray-300 cursor-not-allowed'
                            }`}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                جاري التنفيذ...
                            </span>
                        ) : type === 'deposit' ? (
                            `إيداع ${numericAmount > 0 ? formatCurrency(numericAmount) + ' ج.م' : ''}`
                        ) : (
                            `سحب ${numericAmount > 0 ? formatCurrency(numericAmount) + ' ج.م' : ''}`
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default VaultAdjustmentModal
