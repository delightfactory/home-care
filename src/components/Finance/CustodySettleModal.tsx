// CustodySettleModal - تسوية عهدة
import React, { useState } from 'react'
import { X, Banknote, Loader2, AlertCircle, Landmark, Wallet } from 'lucide-react'
import { CustodyAPI } from '../../api/custody'
import { CustodyAccountWithDetails, Vault } from '../../types'
import { getUserNameFromRelation } from '../../api'
import toast from 'react-hot-toast'
import { usePermissions } from '../../hooks/usePermissions'

interface CustodySettleModalProps {
    account: CustodyAccountWithDetails
    accounts: CustodyAccountWithDetails[]
    vaults: Vault[]
    performedBy: string
    onClose: () => void
    onSuccess: () => void
}

const CustodySettleModal: React.FC<CustodySettleModalProps> = ({
    account,
    accounts,
    vaults,
    performedBy,
    onClose,
    onSuccess
}) => {
    const [target, setTarget] = useState<'vault' | 'custody'>('vault')
    const [targetId, setTargetId] = useState('')
    const [amount, setAmount] = useState('')
    const [loading, setLoading] = useState(false)
    const { hasRole } = usePermissions()
    const isSupervisor = hasRole('operations_supervisor')

    // Supervisor: force custody target and auto-select their own account
    const supervisorCustody = isSupervisor
        ? accounts.find(a => a.user_id === performedBy && a.is_active)
        : null

    const effectiveTarget = isSupervisor ? 'custody' : target
    const effectiveTargetId = isSupervisor ? (supervisorCustody?.id || '') : targetId

    // Helper: get user name from Supabase joined array
    const getUserName = (acc: CustodyAccountWithDetails): string => {
        return getUserNameFromRelation(acc.user)
    }

    const handleSettle = async () => {
        if (!effectiveTargetId || !amount) return

        const numAmount = parseFloat(amount)
        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error('يرجى إدخال مبلغ صحيح')
            return
        }

        if (numAmount > (account.balance || 0)) {
            toast.error('المبلغ أكبر من رصيد العهدة')
            return
        }

        setLoading(true)
        try {
            let result
            if (effectiveTarget === 'vault') {
                result = await CustodyAPI.settleCustodyToVault(account.id, effectiveTargetId, numAmount, performedBy)
            } else {
                result = await CustodyAPI.settleCustodyToCustody(account.id, effectiveTargetId, numAmount, performedBy)
            }

            if (result.success) {
                toast.success(effectiveTarget === 'vault' ? 'تم الإيداع في الخزنة بنجاح' : 'تم تسوية العهدة بنجاح')
                onSuccess()
            } else {
                toast.error(result.error || 'حدث خطأ في التسوية')
            }
        } catch {
            toast.error('حدث خطأ')
        } finally {
            setLoading(false)
        }
    }

    const handleFullAmount = () => {
        setAmount(String(account.balance || 0))
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
                        <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                            <Banknote className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800">تسوية عهدة</h3>
                            <p className="text-xs text-gray-500">{getUserName(account)} — رصيد: {(account.balance || 0).toLocaleString('en-US')} ج.م</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-5 space-y-4">
                    {/* Target Type — hidden for supervisor (forced to custody) */}
                    {!isSupervisor && (
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">تسوية إلى</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => { setTarget('vault'); setTargetId('') }}
                                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${target === 'vault'
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <Landmark className="w-4 h-4" />
                                    خزنة
                                </button>
                                <button
                                    onClick={() => { setTarget('custody'); setTargetId('') }}
                                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${target === 'custody'
                                        ? 'bg-purple-50 border-purple-300 text-purple-700'
                                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <Wallet className="w-4 h-4" />
                                    عهدة أخرى
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Supervisor notice */}
                    {isSupervisor && (
                        <div className="flex items-start gap-2 text-xs text-purple-700 bg-purple-50 rounded-lg p-3">
                            <Wallet className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>سيتم تسوية المبلغ إلى عهدتك مباشرة</span>
                        </div>
                    )}

                    {/* Target Select — hidden for supervisor (auto-settles to own custody) */}
                    {!isSupervisor && (
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                                {effectiveTarget === 'vault' ? 'الخزنة' : 'حساب العهدة'}
                            </label>
                            <select
                                value={targetId}
                                onChange={(e) => setTargetId(e.target.value)}
                                className="w-full rounded-xl border border-gray-200 py-2.5 px-3 text-sm focus:ring-2 focus:ring-orange-500"
                            >
                                <option value="">اختر...</option>
                                {effectiveTarget === 'vault' ? (
                                    vaults.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.name_ar || v.name} ({(v.balance || 0).toLocaleString('en-US')} ج.م)
                                        </option>
                                    ))
                                ) : (
                                    accounts
                                        .filter(a => a.id !== account.id && a.holder_type === 'supervisor')
                                        .map(a => (
                                            <option key={a.id} value={a.id}>
                                                {getUserName(a)} (مشرف)
                                            </option>
                                        ))
                                )}
                            </select>
                        </div>
                    )}

                    {/* Amount */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">المبلغ</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full rounded-xl border border-gray-200 py-2.5 px-3 pl-14 text-sm focus:ring-2 focus:ring-orange-500"
                                min="0"
                                step="0.01"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">ج.م</span>
                        </div>
                        <button
                            onClick={handleFullAmount}
                            className="mt-1.5 text-xs text-orange-600 hover:text-orange-700 font-medium"
                        >
                            تسوية كامل المبلغ ({(account.balance || 0).toLocaleString('en-US')} ج.م)
                        </button>
                    </div>

                    {/* Warning for custody-to-custody */}
                    {!isSupervisor && effectiveTarget === 'custody' && (
                        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-3">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>التسوية بين العهد مسموحة فقط من قائد فريق إلى مشرف</span>
                        </div>
                    )}

                    {/* Warning for Supervisor with no custody */}
                    {isSupervisor && !supervisorCustody && (
                        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded-lg p-3">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>لا يوجد لديك حساب عهدة نشط لإتمام التسوية</span>
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
                        onClick={handleSettle}
                        disabled={loading || (!isSupervisor && (!targetId || !amount)) || (isSupervisor && !amount)}
                        className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <Banknote className="w-4 h-4" />
                                تسوية
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default CustodySettleModal
