// TechCollectionSheet - bottom sheet لتحصيل الفاتورة
// نقدي → مباشرة إلى عهدة القائد
// instapay/bank → رفع إثبات → حالة معلق للمراجعة
import React, { useState, useRef } from 'react'
import {
    X, Banknote, Smartphone, Upload, CheckCircle,
    Loader2, Camera, AlertCircle, Landmark
} from 'lucide-react'
import { InvoicesAPI } from '../../api/invoices'
import { CustodyAPI } from '../../api/custody'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

interface TechCollectionSheetProps {
    isOpen: boolean
    onClose: () => void
    invoiceId: string | null
    orderId: string
    amount: number
    onSuccess: () => void
}

type PaymentMethod = 'cash' | 'instapay' | 'bank_transfer'
type Step = 'select' | 'confirm' | 'uploading' | 'success'

const TechCollectionSheet: React.FC<TechCollectionSheetProps> = ({
    isOpen,
    onClose,
    invoiceId,
    orderId,
    amount,
    onSuccess
}) => {
    const { user } = useAuth()
    const [step, setStep] = useState<Step>('select')
    const [method, setMethod] = useState<PaymentMethod | null>(null)
    const [proofFile, setProofFile] = useState<File | null>(null)
    const [proofPreview, setProofPreview] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleMethodSelect = (m: PaymentMethod) => {
        setMethod(m)
        if (m === 'cash') {
            setStep('confirm')
        } else {
            setStep('uploading')
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            toast.error('يرجى اختيار صورة (JPG, PNG, WebP)')
            return
        }
        if (file.size > 3 * 1024 * 1024) {
            toast.error('حجم الصورة كبير — الحد الأقصى 3MB')
            return
        }

        setProofFile(file)
        const reader = new FileReader()
        reader.onload = (ev) => setProofPreview(ev.target?.result as string)
        reader.readAsDataURL(file)
    }

    const uploadProof = async (file: File): Promise<string> => {
        const ext = file.name.split('.').pop()
        const fileName = `payment-proofs/${orderId}_${Date.now()}.${ext}`
        const { error } = await supabase.storage
            .from('receipts')
            .upload(fileName, file, { upsert: true })
        if (error) throw error
        const { data } = supabase.storage.from('receipts').getPublicUrl(fileName)
        return data.publicUrl
    }

    const handleCollect = async () => {
        if (!user?.id || !method) return

        setLoading(true)
        try {
            if (method === 'cash') {
                // جلب عهدة القائد — أو إنشاؤها تلقائياً إن لم تكن موجودة
                let custody = await CustodyAPI.getCustodyByUserId(user.id)
                if (!custody) {
                    // إنشاء عهدة تلقائية للقائد الحالي
                    try {
                        const { data: worker } = await supabase
                            .from('workers')
                            .select('id')
                            .eq('user_id', user.id)
                            .maybeSingle()

                        if (worker) {
                            const { data: team } = await supabase
                                .from('teams')
                                .select('id')
                                .eq('leader_id', worker.id)
                                .eq('is_active', true)
                                .maybeSingle()

                            if (team) {
                                const { data: newCustody } = await supabase
                                    .from('custody_accounts')
                                    .insert({
                                        user_id: user.id,
                                        holder_type: 'team_leader',
                                        team_id: team.id,
                                        is_active: true
                                    })
                                    .select('*')
                                    .single()

                                custody = newCustody
                            }
                        }
                    } catch (err) {
                        console.error('Auto-create custody error:', err)
                    }

                    if (!custody) {
                        toast.error('لا توجد عهدة مرتبطة بحسابك — تواصل مع الإدارة')
                        setLoading(false)
                        return
                    }
                }

                if (invoiceId) {
                    const result = await InvoicesAPI.collectCash(
                        invoiceId, custody.id, user.id
                    )
                    if (!result.success) {
                        toast.error(result.error || 'حدث خطأ في التحصيل')
                        setLoading(false)
                        return
                    }
                }
                setStep('success')
                toast.success('تم التحصيل النقدي بنجاح')
            } else {
                // instapay أو bank_transfer
                // الفني يرفع الإثبات → الأدمن يؤكد ويحدد الخزنة
                if (!proofFile) {
                    toast.error('يرجى رفع إثبات الدفع')
                    setLoading(false)
                    return
                }

                const proofUrl = await uploadProof(proofFile)

                if (invoiceId) {
                    // تحديث الفاتورة بطريقة الدفع وإثبات الدفع فقط
                    // الأدمن سيؤكد ويختار الخزنة لاحقاً في PaymentsTab
                    const result = await InvoicesAPI.updateInvoice(invoiceId, {
                        payment_method: method,
                        payment_proof_url: proofUrl,
                        collected_by: user.id,
                        collected_at: new Date().toISOString()
                    })
                    if (!result.success) {
                        toast.error(result.error || 'حدث خطأ')
                        setLoading(false)
                        return
                    }
                }
                setStep('success')
                toast.success('تم إرسال إثبات الدفع — في انتظار مراجعة الإدارة')
            }

            setTimeout(() => {
                onSuccess()
                handleClose()
            }, 2000)
        } catch (err) {
            console.error('Collection error:', err)
            toast.error('حدث خطأ أثناء التحصيل')
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        setStep('select')
        setMethod(null)
        setProofFile(null)
        setProofPreview(null)
        setLoading(false)
        onClose()
    }

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-[60] animate-fade-in"
                onClick={handleClose}
            />

            {/* Bottom Sheet */}
            <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[60] animate-slide-up safe-area-pb max-h-[85vh] overflow-y-auto">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-2 sticky top-0 bg-white rounded-t-3xl">
                    <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800">
                        {step === 'success' ? 'تم بنجاح' : 'تحصيل المبلغ'}
                    </h3>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Amount Display */}
                {step !== 'success' && (
                    <div className="mx-5 mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                        <p className="text-xs text-blue-500 mb-1">المبلغ المطلوب تحصيله</p>
                        <p className="text-2xl font-bold text-blue-700">
                            {amount.toLocaleString('ar-EG')} <span className="text-sm font-normal">ج.م</span>
                        </p>
                    </div>
                )}

                {/* Step: Select Method */}
                {step === 'select' && (
                    <div className="p-5 space-y-3">
                        <p className="text-sm text-gray-600 mb-2">اختر طريقة الدفع:</p>

                        {/* Cash */}
                        <button
                            onClick={() => handleMethodSelect('cash')}
                            className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 rounded-xl border border-green-200 transition-all active:scale-[0.98]"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                                <Banknote className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-right flex-1">
                                <h4 className="font-bold text-gray-800">نقدي</h4>
                                <p className="text-xs text-gray-500">المبلغ يُضاف تلقائياً لعهدتك</p>
                            </div>
                        </button>

                        {/* Instapay */}
                        <button
                            onClick={() => handleMethodSelect('instapay')}
                            className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 rounded-xl border border-purple-200 transition-all active:scale-[0.98]"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-md">
                                <Smartphone className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-right flex-1">
                                <h4 className="font-bold text-gray-800">Instapay</h4>
                                <p className="text-xs text-gray-500">يتطلب رفع إثبات — تتم المراجعة من الإدارة</p>
                            </div>
                        </button>

                        {/* Bank Transfer */}
                        <button
                            onClick={() => handleMethodSelect('bank_transfer')}
                            className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 rounded-xl border border-blue-200 transition-all active:scale-[0.98]"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-md">
                                <Landmark className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-right flex-1">
                                <h4 className="font-bold text-gray-800">تحويل بنكي</h4>
                                <p className="text-xs text-gray-500">يتطلب رفع إثبات — تتم المراجعة من الإدارة</p>
                            </div>
                        </button>
                    </div>
                )}

                {/* Step: Confirm Cash */}
                {step === 'confirm' && method === 'cash' && (
                    <div className="p-5 space-y-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-amber-800">تأكيد التحصيل النقدي</p>
                                    <p className="text-xs text-amber-600 mt-1">
                                        سيتم إضافة مبلغ <strong>{amount.toLocaleString('ar-EG')} ج.م</strong> إلى عهدتك تلقائياً
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setStep('select'); setMethod(null) }}
                                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                            >
                                رجوع
                            </button>
                            <button
                                onClick={handleCollect}
                                disabled={loading}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold shadow-lg hover:shadow-xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Banknote className="w-5 h-5" />
                                        تأكيد التحصيل
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step: Upload Proof */}
                {step === 'uploading' && (
                    <div className="p-5 space-y-4">
                        <p className="text-sm text-gray-600">ارفع صورة إثبات الدفع:</p>

                        {/* Upload Area */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${proofPreview
                                ? 'border-green-300 bg-green-50'
                                : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
                                }`}
                        >
                            {proofPreview ? (
                                <div className="space-y-3">
                                    <img
                                        src={proofPreview}
                                        alt="إثبات الدفع"
                                        className="max-h-40 mx-auto rounded-lg shadow-md"
                                    />
                                    <p className="text-xs text-green-600 font-medium">✅ تم اختيار الصورة — اضغط لتغييرها</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="w-14 h-14 mx-auto bg-gray-200 rounded-full flex items-center justify-center">
                                        <Camera className="w-7 h-7 text-gray-500" />
                                    </div>
                                    <p className="text-sm text-gray-600 font-medium">اضغط لرفع الصورة</p>
                                    <p className="text-xs text-gray-400">JPG, PNG — الحد الأقصى 3MB</p>
                                </div>
                            )}
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setStep('select')
                                    setMethod(null)
                                    setProofFile(null)
                                    setProofPreview(null)
                                }}
                                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                            >
                                رجوع
                            </button>
                            <button
                                onClick={handleCollect}
                                disabled={loading || !proofFile}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 text-white font-bold shadow-lg hover:shadow-xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Upload className="w-5 h-5" />
                                        إرسال الإثبات
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step: Success */}
                {step === 'success' && (
                    <div className="p-8 text-center space-y-4">
                        <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center animate-bounce-in">
                            <CheckCircle className="w-10 h-10 text-green-600" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-800">تم بنجاح!</h4>
                        <p className="text-sm text-gray-500">
                            {method === 'cash'
                                ? 'تم تحصيل المبلغ نقدياً وإضافته لعهدتك'
                                : 'تم إرسال إثبات الدفع — في انتظار تأكيد الإدارة'
                            }
                        </p>
                    </div>
                )}

                {/* Extra padding — يضمن عدم اختفاء الأزرار خلف الناف بار */}
                <div className="h-20" />
            </div>

            {/* Animations */}
            <style>{`
                @keyframes bounce-in {
                    0% { transform: scale(0); opacity: 0; }
                    50% { transform: scale(1.2); }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-bounce-in { animation: bounce-in 0.5s ease-out; }
                @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
                @keyframes slide-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
                .animate-fade-in { animation: fade-in 0.2s ease-out; }
                .animate-slide-up { animation: slide-up 0.3s ease-out; }
            `}</style>
        </>
    )
}

export default TechCollectionSheet
