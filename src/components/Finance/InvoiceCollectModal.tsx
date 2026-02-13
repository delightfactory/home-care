// InvoiceCollectModal - تحصيل فاتورة إدارياً
// يدعم: نقدى → عهدة قائد | إلكتروني (instapay/bank) → خزنة
import React, { useState, useEffect, useCallback } from 'react'
import {
    X, Loader2, Banknote, CreditCard, Landmark, Wallet,
    Upload, CheckCircle, AlertCircle
} from 'lucide-react'
import { InvoicesAPI } from '../../api/invoices'
import { VaultsAPI } from '../../api/vaults'
import { CustodyAPI } from '../../api/custody'
import { InvoiceWithDetails, Vault, CustodyAccountWithDetails } from '../../types'
import { getUserNameFromRelation } from '../../api'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface InvoiceCollectModalProps {
    invoice: InvoiceWithDetails
    onClose: () => void
    onSuccess: () => void
}

type PaymentMethod = 'cash' | 'instapay' | 'bank_transfer'

const InvoiceCollectModal: React.FC<InvoiceCollectModalProps> = ({
    invoice,
    onClose,
    onSuccess
}) => {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [dataLoading, setDataLoading] = useState(true)

    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
    const [vaults, setVaults] = useState<Vault[]>([])
    const [custodyAccounts, setCustodyAccounts] = useState<CustodyAccountWithDetails[]>([])
    const [selectedVaultId, setSelectedVaultId] = useState('')
    const [selectedCustodyId, setSelectedCustodyId] = useState('')
    const [proofFile, setProofFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)

    const amountDue = (invoice.total_amount || 0) - (invoice.paid_amount || 0)

    const loadData = useCallback(async () => {
        setDataLoading(true)
        try {
            const [vaultsData, custodyData] = await Promise.all([
                VaultsAPI.getVaults(true),
                CustodyAPI.getCustodyAccounts(true)
            ])
            setVaults(vaultsData)
            setCustodyAccounts(custodyData)

            // Auto-select first vault/custody
            if (vaultsData.length > 0) setSelectedVaultId(vaultsData[0].id)
            if (custodyData.length > 0) setSelectedCustodyId(custodyData[0].id)
        } catch (err) {
            console.error(err)
            toast.error('خطأ في تحميل البيانات')
        } finally {
            setDataLoading(false)
        }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    const uploadProofFile = async (): Promise<string | null> => {
        if (!proofFile) return null

        setUploading(true)
        try {
            const ext = proofFile.name.split('.').pop()
            const fileName = `invoice_${invoice.id}_${Date.now()}.${ext}`
            const { error } = await supabase.storage
                .from('receipts')
                .upload(fileName, proofFile)

            if (error) throw error

            const { data: urlData } = supabase.storage
                .from('receipts')
                .getPublicUrl(fileName)

            return urlData.publicUrl
        } catch (err) {
            console.error(err)
            toast.error('خطأ في رفع إثبات الدفع')
            return null
        } finally {
            setUploading(false)
        }
    }

    const handleCollect = async () => {
        if (!user?.id) {
            toast.error('خطأ في تحديد المستخدم')
            return
        }

        setLoading(true)
        try {
            if (paymentMethod === 'cash') {
                // Cash → Custody
                if (!selectedCustodyId) {
                    toast.error('يرجى اختيار حساب العهدة')
                    setLoading(false)
                    return
                }

                const result = await InvoicesAPI.collectCash(
                    invoice.id,
                    selectedCustodyId,
                    user.id
                )

                if (result.success) {
                    toast.success(`تم التحصيل النقدى — ${amountDue.toLocaleString('ar-EG')} ج.م`)
                    onSuccess()
                } else {
                    toast.error(result.error || 'خطأ في التحصيل')
                }

            } else {
                // Instapay / Bank Transfer → Vault
                if (!selectedVaultId) {
                    toast.error('يرجى اختيار الخزنة')
                    setLoading(false)
                    return
                }

                // Upload proof if exists
                let proofUrl = ''
                if (proofFile) {
                    const url = await uploadProofFile()
                    if (!url) {
                        setLoading(false)
                        return
                    }
                    proofUrl = url
                }

                const result = await InvoicesAPI.collectAdmin(
                    invoice.id,
                    selectedVaultId,
                    paymentMethod,
                    proofUrl,
                    user.id
                )

                if (result.success) {
                    toast.success(`تم التحصيل — ${amountDue.toLocaleString('ar-EG')} ج.م`)
                    onSuccess()
                } else {
                    toast.error(result.error || 'خطأ في التحصيل')
                }
            }
        } catch (err) {
            console.error(err)
            toast.error('حدث خطأ غير متوقع')
        } finally {
            setLoading(false)
        }
    }

    const getUserName = (acc: CustodyAccountWithDetails): string => {
        return getUserNameFromRelation(acc.user)
    }

    if (dataLoading) {
        return (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <span className="text-sm text-gray-500">جارٍ تحميل البيانات...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-l from-emerald-50 to-white rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-xl">
                            <Banknote className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">تحصيل فاتورة</h2>
                            <p className="text-xs text-gray-500">{invoice.invoice_number}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Invoice summary */}
                    <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">العميل</span>
                            <span className="font-medium">{invoice.customer?.name || '—'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">المبلغ الإجمالي</span>
                            <span className="font-medium">{(invoice.total_amount || 0).toLocaleString('ar-EG')} ج.م</span>
                        </div>
                        {(invoice.paid_amount || 0) > 0 && (
                            <div className="flex justify-between text-sm text-emerald-600">
                                <span>المدفوع</span>
                                <span className="font-medium">{(invoice.paid_amount || 0).toLocaleString('ar-EG')} ج.م</span>
                            </div>
                        )}
                        <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                            <span>المطلوب تحصيله</span>
                            <span className="text-emerald-700">{amountDue.toLocaleString('ar-EG')} ج.م</span>
                        </div>
                    </div>

                    {/* Payment method selector */}
                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-2 block">طريقة الدفع</label>
                        <div className="grid grid-cols-3 gap-2">
                            {([
                                { id: 'cash' as const, label: 'نقدى', icon: Banknote, color: 'emerald' },
                                { id: 'instapay' as const, label: 'انستاباي', icon: CreditCard, color: 'purple' },
                                { id: 'bank_transfer' as const, label: 'تحويل بنكي', icon: Landmark, color: 'blue' },
                            ]).map(method => (
                                <button
                                    key={method.id}
                                    onClick={() => setPaymentMethod(method.id)}
                                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-medium ${paymentMethod === method.id
                                        ? `border-${method.color}-500 bg-${method.color}-50 text-${method.color}-700`
                                        : 'border-gray-200 hover:border-gray-300 text-gray-500'
                                        }`}
                                >
                                    <method.icon className="h-5 w-5" />
                                    {method.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Cash: select custody account */}
                    {paymentMethod === 'cash' && (
                        <div>
                            <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5">
                                <Wallet className="h-4 w-4 text-amber-500" />
                                حساب العهدة
                            </label>
                            {custodyAccounts.length === 0 ? (
                                <div className="flex items-center gap-2 bg-amber-50 text-amber-700 text-sm p-3 rounded-xl">
                                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                    <span>لا توجد حسابات عهدة نشطة</span>
                                </div>
                            ) : (
                                <select
                                    value={selectedCustodyId}
                                    onChange={(e) => setSelectedCustodyId(e.target.value)}
                                    className="input w-full"
                                >
                                    {custodyAccounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>
                                            {getUserName(acc)} — رصيد: {(acc.balance || 0).toLocaleString('ar-EG')} ج.م
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    {/* Digital: select vault + upload proof */}
                    {paymentMethod !== 'cash' && (
                        <>
                            <div>
                                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5">
                                    <Landmark className="h-4 w-4 text-blue-500" />
                                    الخزنة المستهدفة
                                </label>
                                <select
                                    value={selectedVaultId}
                                    onChange={(e) => setSelectedVaultId(e.target.value)}
                                    className="input w-full"
                                >
                                    {vaults.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.name_ar} — رصيد: {(v.balance || 0).toLocaleString('ar-EG')} ج.م
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-1.5">
                                    <Upload className="h-4 w-4 text-gray-500" />
                                    إثبات الدفع (اختياري)
                                </label>
                                <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                                    className="input w-full text-sm"
                                />
                                {proofFile && (
                                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                                        <CheckCircle className="h-3 w-3" />
                                        {proofFile.name}
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 p-4 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                        disabled={loading}
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={handleCollect}
                        disabled={loading || uploading || amountDue <= 0 ||
                            (paymentMethod === 'cash' && !selectedCustodyId) ||
                            (paymentMethod !== 'cash' && !selectedVaultId)
                        }
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                        {loading || uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <CheckCircle className="h-4 w-4" />
                        )}
                        تأكيد التحصيل
                    </button>
                </div>
            </div>
        </div>
    )
}

export default InvoiceCollectModal
