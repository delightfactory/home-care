// TechCollectionSheet - bottom sheet لتحصيل الفاتورة
// نقدي → مباشرة إلى عهدة القائد
// instapay/bank → رفع إثبات → حالة معلق للمراجعة
import React, { useState, useRef } from 'react'
import {
    X, Banknote, Smartphone, Upload, CheckCircle,
    Loader2, Camera, AlertCircle, Landmark, ImageIcon
} from 'lucide-react'
import { InvoicesAPI } from '../../api/invoices'
import { CustodyAPI } from '../../api/custody'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatAmount, compressImage } from '../../utils/formatters'
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
    const cameraInputRef = useRef<HTMLInputElement>(null)
    const galleryInputRef = useRef<HTMLInputElement>(null)

    const handleMethodSelect = (m: PaymentMethod) => {
        setMethod(m)
        if (m === 'cash') {
            setStep('confirm')
        } else {
            setStep('uploading')
        }
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            toast.error('اختار صورة (JPG, PNG, WebP)')
            return
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error('الصورة كبيرة أوى — الحد الأقصى 10MB')
            return
        }

        try {
            // ضغط الصورة تلقائياً
            const compressed = await compressImage(file, 1200, 0.7)
            setProofFile(compressed)

            const reader = new FileReader()
            reader.onload = (ev) => setProofPreview(ev.target?.result as string)
            reader.readAsDataURL(compressed)
        } catch {
            toast.error('مشكلة فى تجهيز الصورة — جرّب تانى')
        }

        // Reset input لإتاحة اختيار نفس الملف مرة أخرى
        e.target.value = ''
    }

    const uploadProof = async (file: File): Promise<string> => {
        const ext = file.name.split('.').pop() || 'jpg'
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
                        toast.error('مفيش عهدة مربوطة بحسابك — كلّم الإدارة')
                        setLoading(false)
                        return
                    }
                }

                if (invoiceId) {
                    const result = await InvoicesAPI.collectCash(
                        invoiceId, custody.id, user.id
                    )
                    if (!result.success) {
                        toast.error(result.error || 'حصل مشكلة فى التحصيل')
                        setLoading(false)
                        return
                    }
                }
                setStep('success')
                toast.success('تمام، الفلوس اتسلمت ✅')
            } else {
                // instapay أو bank_transfer
                if (!proofFile) {
                    toast.error('ارفع صورة إثبات الدفع الأول')
                    setLoading(false)
                    return
                }

                const proofUrl = await uploadProof(proofFile)

                if (invoiceId) {
                    const result = await InvoicesAPI.updateInvoice(invoiceId, {
                        payment_method: method,
                        payment_proof_url: proofUrl,
                        collected_by: user.id,
                        collected_at: new Date().toISOString()
                    })
                    if (!result.success) {
                        toast.error(result.error || 'حصل مشكلة')
                        setLoading(false)
                        return
                    }
                }
                setStep('success')
                toast.success('تم إرسال الإثبات — الإدارة هتراجعه 👍')
            }

            setTimeout(() => {
                onSuccess()
                handleClose()
            }, 2000)
        } catch (err) {
            console.error('Collection error:', err)
            toast.error('حصل مشكلة أثناء التحصيل — جرّب تانى')
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
                className="fixed inset-0 bg-black/50 z-[60]"
                onClick={handleClose}
                style={{ animation: 'fadeIn 0.2s ease-out' }}
            />

            {/* Bottom Sheet */}
            <div
                className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[60] safe-area-pb max-h-[85vh] overflow-y-auto"
                style={{ animation: 'slideUp 0.3s ease-out' }}
            >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-2 sticky top-0 bg-white rounded-t-3xl z-10">
                    <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800">
                        {step === 'success' ? 'تم بنجاح ✅' : 'تحصيل المبلغ'}
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
                    <div className="mx-5 mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
                        <p className="text-xs text-blue-500 mb-1">المبلغ المطلوب تحصيله</p>
                        <p className="text-2xl font-bold text-blue-700">
                            {formatAmount(amount)} <span className="text-sm font-normal">ج.م</span>
                        </p>
                    </div>
                )}

                {/* Step: Select Method */}
                {step === 'select' && (
                    <div className="p-5 space-y-3">
                        <p className="text-sm text-gray-600 mb-2">اختار طريقة الدفع:</p>

                        {/* Cash */}
                        <button
                            onClick={() => handleMethodSelect('cash')}
                            className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 rounded-2xl border border-green-200 transition-all active:scale-[0.98]"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-md">
                                <Banknote className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-right flex-1">
                                <h4 className="font-bold text-gray-800">نقدى (كاش)</h4>
                                <p className="text-xs text-gray-500">المبلغ هيتضاف لعهدتك تلقائى</p>
                            </div>
                        </button>

                        {/* Instapay */}
                        <button
                            onClick={() => handleMethodSelect('instapay')}
                            className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 rounded-2xl border border-purple-200 transition-all active:scale-[0.98]"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-md">
                                <Smartphone className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-right flex-1">
                                <h4 className="font-bold text-gray-800">Instapay</h4>
                                <p className="text-xs text-gray-500">ارفع الإثبات والإدارة هتراجعه</p>
                            </div>
                        </button>

                        {/* Bank Transfer */}
                        <button
                            onClick={() => handleMethodSelect('bank_transfer')}
                            className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 rounded-2xl border border-blue-200 transition-all active:scale-[0.98]"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-md">
                                <Landmark className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-right flex-1">
                                <h4 className="font-bold text-gray-800">تحويل بنكى</h4>
                                <p className="text-xs text-gray-500">ارفع الإثبات والإدارة هتراجعه</p>
                            </div>
                        </button>
                    </div>
                )}

                {/* Step: Confirm Cash */}
                {step === 'confirm' && method === 'cash' && (
                    <div className="p-5 space-y-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-amber-800">تأكيد التحصيل النقدى</p>
                                    <p className="text-xs text-amber-600 mt-1">
                                        هيتضاف مبلغ <strong>{formatAmount(amount)} ج.م</strong> لعهدتك تلقائى
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setStep('select'); setMethod(null) }}
                                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors active:scale-[0.98]"
                            >
                                رجوع
                            </button>
                            <button
                                onClick={handleCollect}
                                disabled={loading}
                                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold shadow-lg hover:shadow-xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
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

                        {/* Preview */}
                        {proofPreview && (
                            <div className="border-2 border-green-300 bg-green-50 rounded-2xl p-3 text-center">
                                <img
                                    src={proofPreview}
                                    alt="إثبات الدفع"
                                    className="max-h-48 mx-auto rounded-xl shadow-md"
                                />
                                <p className="text-xs text-green-600 font-medium mt-2">✅ الصورة جاهزة</p>
                            </div>
                        )}

                        {/* Upload Buttons — كاميرا + معرض */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => cameraInputRef.current?.click()}
                                className="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-2xl border-2 border-dashed border-blue-300 transition-all active:scale-[0.97]"
                            >
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Camera className="w-6 h-6 text-blue-600" />
                                </div>
                                <span className="text-sm font-medium text-blue-700">كاميرا</span>
                            </button>

                            <button
                                onClick={() => galleryInputRef.current?.click()}
                                className="flex flex-col items-center gap-2 p-4 bg-purple-50 hover:bg-purple-100 rounded-2xl border-2 border-dashed border-purple-300 transition-all active:scale-[0.97]"
                            >
                                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                    <ImageIcon className="w-6 h-6 text-purple-600" />
                                </div>
                                <span className="text-sm font-medium text-purple-700">معرض الصور</span>
                            </button>
                        </div>

                        {/* Hidden file inputs */}
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <input
                            ref={galleryInputRef}
                            type="file"
                            accept="image/*"
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
                                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors active:scale-[0.98]"
                            >
                                رجوع
                            </button>
                            <button
                                onClick={handleCollect}
                                disabled={loading || !proofFile}
                                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 text-white font-bold shadow-lg hover:shadow-xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2"
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
                        <div
                            className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center"
                            style={{ animation: 'bounceIn 0.5s ease-out' }}
                        >
                            <CheckCircle className="w-10 h-10 text-green-600" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-800">تمام كده! 🎉</h4>
                        <p className="text-sm text-gray-500">
                            {method === 'cash'
                                ? 'الفلوس اتسلمت واتضافت لعهدتك'
                                : 'الإثبات اتبعت — الإدارة هتراجعه وتأكده'
                            }
                        </p>
                    </div>
                )}

                {/* Extra padding */}
                <div className="h-20" />
            </div>

            {/* Animations */}
            <style>{`
                @keyframes bounceIn {
                    0% { transform: scale(0); opacity: 0; }
                    50% { transform: scale(1.2); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
                @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
            `}</style>
        </>
    )
}

export default TechCollectionSheet
