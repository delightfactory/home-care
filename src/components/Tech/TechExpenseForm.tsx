// TechExpenseForm - نموذج تسجيل مصروف مبسط للفنى
import React, { useState, useEffect, useRef } from 'react'
import { X, Receipt, Camera, Image as ImageIcon, Loader2, Check, Tag } from 'lucide-react'
import { ExpensesAPI } from '../../api'
import EnhancedAPI from '../../api/enhanced-api'
import { useAuth } from '../../contexts/AuthContext'
import { useTechnicianData } from '../../hooks/useTechnicianData'
import { ExpenseCategory } from '../../types'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface TechExpenseFormProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

const TechExpenseForm: React.FC<TechExpenseFormProps> = ({ isOpen, onClose, onSuccess }) => {
    const { user } = useAuth()
    const { status } = useTechnicianData()

    const [categories, setCategories] = useState<ExpenseCategory[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingCategories, setLoadingCategories] = useState(true)
    const [uploadingImage, setUploadingImage] = useState(false)

    // Form state
    const [categoryId, setCategoryId] = useState('')
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')
    const [imageUrl, setImageUrl] = useState('')
    const [imagePreview, setImagePreview] = useState('')

    const cameraInputRef = useRef<HTMLInputElement>(null)
    const galleryInputRef = useRef<HTMLInputElement>(null)

    // تحميل التصنيفات
    useEffect(() => {
        if (isOpen) {
            fetchCategories()
        }
    }, [isOpen])

    const fetchCategories = async () => {
        setLoadingCategories(true)
        try {
            const data = await ExpensesAPI.getExpenseCategories()
            setCategories(data.filter(c => c.is_active))
        } catch (error) {
            console.error('Error loading categories:', error)
            toast.error('فشل في تحميل التصنيفات')
        } finally {
            setLoadingCategories(false)
        }
    }

    // رفع الصورة
    const handleImageUpload = async (file: File) => {
        if (!file) return

        // التحقق من حجم الملف (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('حجم الصورة يجب أن لا يتجاوز 5MB')
            return
        }

        setUploadingImage(true)
        try {
            // إنشاء اسم فريد للملف
            const fileExt = file.name.split('.').pop()
            const fileName = `expense_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
            const filePath = fileName

            // رفع الصورة
            const { error: uploadError } = await supabase.storage
                .from('receipts')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                })

            if (uploadError) throw uploadError

            // الحصول على رابط الصورة
            const { data: { publicUrl } } = supabase.storage
                .from('receipts')
                .getPublicUrl(filePath)

            setImageUrl(publicUrl)
            setImagePreview(URL.createObjectURL(file))
            toast.success('تم رفع الصورة بنجاح')
        } catch (error) {
            console.error('Error uploading image:', error)
            toast.error('فشل في رفع الصورة')
        } finally {
            setUploadingImage(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            handleImageUpload(file)
        }
    }

    const removeImage = () => {
        setImageUrl('')
        setImagePreview('')
    }

    // إرسال النموذج
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!categoryId) {
            toast.error('يرجى اختيار التصنيف')
            return
        }

        if (!amount || parseFloat(amount) <= 0) {
            toast.error('يرجى إدخال مبلغ صحيح')
            return
        }

        if (!description.trim()) {
            toast.error('يرجى إدخال وصف المصروف')
            return
        }

        setLoading(true)
        try {
            const expenseData = {
                category_id: categoryId,
                amount: parseFloat(amount),
                description: description.trim(),
                team_id: status?.teamId || null,
                receipt_image_url: imageUrl || null,
                created_by: user?.id
            }

            const res = await EnhancedAPI.createExpense(expenseData)

            if (!res.success) {
                throw new Error(res.error || 'فشل في إنشاء المصروف')
            }

            toast.success('تم تسجيل المصروف بنجاح! 🎉')

            // إعادة تعيين النموذج
            setCategoryId('')
            setAmount('')
            setDescription('')
            setImageUrl('')
            setImagePreview('')

            onSuccess()
            onClose()
        } catch (error) {
            console.error('Error creating expense:', error)
            toast.error('فشل في تسجيل المصروف')
        } finally {
            setLoading(false)
        }
    }

    // أيقونات التصنيفات الشائعة
    const getCategoryIcon = (name: string) => {
        const iconMap: Record<string, string> = {
            'fuel': '⛽',
            'transport': '🚗',
            'food': '🍔',
            'materials': '🧹',
            'tools': '🔧',
            'maintenance': '🔨',
            'default': '💰'
        }
        const key = Object.keys(iconMap).find(k => name.toLowerCase().includes(k))
        return iconMap[key || 'default']
    }

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 z-[60]"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-[60] max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                <Receipt className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">تسجيل مصروف</h2>
                                <p className="text-xs text-white/80">سجل مصروفات الفريق</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[calc(90vh-140px)] overflow-y-auto">
                    {/* التصنيف */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            <Tag className="w-4 h-4 inline ml-1" />
                            نوع المصروف *
                        </label>
                        {loadingCategories ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setCategoryId(cat.id)}
                                        className={`p-3 rounded-xl border-2 text-right transition-all ${categoryId === cat.id
                                            ? 'border-green-500 bg-green-50 text-green-700'
                                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                            }`}
                                    >
                                        <span className="text-xl ml-2">{getCategoryIcon(cat.name)}</span>
                                        <span className="font-medium text-sm">{cat.name_ar}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* المبلغ */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            المبلغ (ج.م) *
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                inputMode="decimal"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-4 py-4 text-2xl font-bold text-center border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-0 transition-colors"
                                min="0"
                                step="0.01"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                                ج.م
                            </span>
                        </div>
                    </div>

                    {/* الوصف */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            وصف المصروف *
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="مثال: بنزين للسيارة..."
                            rows={2}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-0 transition-colors resize-none"
                        />
                    </div>

                    {/* صورة الإيصال */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            صورة الإيصال (اختياري)
                        </label>

                        {imagePreview ? (
                            <div className="relative">
                                <img
                                    src={imagePreview}
                                    alt="Receipt"
                                    className="w-full h-32 object-cover rounded-xl border-2 border-gray-200"
                                />
                                <button
                                    type="button"
                                    onClick={removeImage}
                                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                {/* Camera Button */}
                                <button
                                    type="button"
                                    onClick={() => cameraInputRef.current?.click()}
                                    disabled={uploadingImage}
                                    className="flex-1 flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-green-400 hover:bg-green-50 transition-colors disabled:opacity-50"
                                >
                                    {uploadingImage ? (
                                        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                                    ) : (
                                        <Camera className="w-6 h-6 text-gray-500" />
                                    )}
                                    <span className="text-xs text-gray-500">كاميرا</span>
                                </button>

                                {/* Gallery Button */}
                                <button
                                    type="button"
                                    onClick={() => galleryInputRef.current?.click()}
                                    disabled={uploadingImage}
                                    className="flex-1 flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-green-400 hover:bg-green-50 transition-colors disabled:opacity-50"
                                >
                                    {uploadingImage ? (
                                        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                                    ) : (
                                        <ImageIcon className="w-6 h-6 text-gray-500" />
                                    )}
                                    <span className="text-xs text-gray-500">معرض</span>
                                </button>
                            </div>
                        )}

                        {/* Hidden File Inputs */}
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
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading || !categoryId || !amount || !description.trim()}
                        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                جاري التسجيل...
                            </>
                        ) : (
                            <>
                                <Check className="w-5 h-5" />
                                تسجيل المصروف
                            </>
                        )}
                    </button>
                </form>
            </div>
        </>
    )
}

export default TechExpenseForm
