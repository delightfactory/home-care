// VaultTransferModal - تحويل بين خزائن
import React, { useState } from 'react'
import { X, ArrowLeftRight, Loader2, AlertCircle } from 'lucide-react'
import { VaultsAPI } from '../../api/vaults'
import { Vault } from '../../types'
import toast from 'react-hot-toast'

interface VaultTransferModalProps {
    vaults: Vault[]
    performedBy: string
    onClose: () => void
    onSuccess: () => void
}

const VaultTransferModal: React.FC<VaultTransferModalProps> = ({
    vaults,
    performedBy,
    onClose,
    onSuccess
}) => {
    const [fromVault, setFromVault] = useState('')
    const [toVault, setToVault] = useState('')
    const [amount, setAmount] = useState('')
    const [notes, setNotes] = useState('')
    const [loading, setLoading] = useState(false)

    const selectedFrom = vaults.find(v => v.id === fromVault)

    const handleTransfer = async () => {
        if (!fromVault || !toVault || !amount || fromVault === toVault) return

        const numAmount = parseFloat(amount)
        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error('يرجى إدخال مبلغ صحيح')
            return
        }

        if (selectedFrom && numAmount > (selectedFrom.balance || 0)) {
            toast.error('المبلغ أكبر من رصيد الخزنة')
            return
        }

        setLoading(true)
        try {
            const result = await VaultsAPI.transferBetweenVaults(
                fromVault, toVault, numAmount, performedBy, notes || undefined
            )
            if (result.success) {
                toast.success('تم التحويل بنجاح')
                onSuccess()
            } else {
                toast.error(result.error || 'حدث خطأ في التحويل')
            }
        } catch {
            toast.error('حدث خطأ')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                            <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                        </div>
                        <h3 className="font-bold text-gray-800">تحويل بين خزائن</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-5 space-y-4">
                    {/* From Vault */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">من خزنة</label>
                        <select
                            value={fromVault}
                            onChange={(e) => setFromVault(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">اختر الخزنة</option>
                            {vaults.map(v => (
                                <option key={v.id} value={v.id} disabled={v.id === toVault}>
                                    {v.name_ar || v.name} ({(v.balance || 0).toLocaleString('ar-EG')} ج.م)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* To Vault */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">إلى خزنة</label>
                        <select
                            value={toVault}
                            onChange={(e) => setToVault(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">اختر الخزنة</option>
                            {vaults.map(v => (
                                <option key={v.id} value={v.id} disabled={v.id === fromVault}>
                                    {v.name_ar || v.name} ({(v.balance || 0).toLocaleString('ar-EG')} ج.م)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">المبلغ</label>
                        <div className="relative">
                            <input
                                type="number"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 py-2.5 px-3 pl-14 text-sm focus:ring-2 focus:ring-blue-500"
                                min="0"
                                step="0.01"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">ج.م</span>
                        </div>
                        {selectedFrom && (
                            <p className="text-xs text-gray-400 mt-1">
                                الرصيد المتاح: {(selectedFrom.balance || 0).toLocaleString('ar-EG')} ج.م
                            </p>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">ملاحظات (اختياري)</label>
                        <input
                            type="text"
                            placeholder="سبب التحويل"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Warning */}
                    {fromVault && toVault && fromVault === toVault && (
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
                            <AlertCircle className="w-4 h-4" />
                            لا يمكن التحويل لنفس الخزنة
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-200 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 text-sm transition-colors"
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={handleTransfer}
                        disabled={loading || !fromVault || !toVault || !amount || fromVault === toVault}
                        className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <ArrowLeftRight className="w-4 h-4" />
                                تحويل
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default VaultTransferModal
