// ExpenseDetailsModal - مودال تفاصيل المصروف للإدارة - تصميم محسّن
import React, { useState } from 'react'
import { X, User, Calendar, Tag, FileText, CheckCircle, XCircle, Clock, Users, MapPin, ExternalLink, ZoomIn, Receipt, Wallet } from 'lucide-react'
import SmartModal from '../UI/SmartModal'

interface ExpenseDetailsModalProps {
    isOpen: boolean
    onClose: () => void
    expense: any | null
}

const ExpenseDetailsModal: React.FC<ExpenseDetailsModalProps> = ({
    isOpen,
    onClose,
    expense
}) => {
    const [imageZoomed, setImageZoomed] = useState(false)

    if (!expense) return null

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'approved':
                return {
                    label: 'موافق عليه',
                    icon: CheckCircle,
                    gradient: 'from-green-500 to-emerald-600',
                    bgGradient: 'from-green-50 to-emerald-50',
                    textColor: 'text-green-700',
                    borderColor: 'border-green-200'
                }
            case 'rejected':
                return {
                    label: 'مرفوض',
                    icon: XCircle,
                    gradient: 'from-red-500 to-rose-600',
                    bgGradient: 'from-red-50 to-rose-50',
                    textColor: 'text-red-700',
                    borderColor: 'border-red-200'
                }
            default:
                return {
                    label: 'قيد المراجعة',
                    icon: Clock,
                    gradient: 'from-yellow-500 to-amber-600',
                    bgGradient: 'from-yellow-50 to-amber-50',
                    textColor: 'text-yellow-700',
                    borderColor: 'border-yellow-200'
                }
        }
    }

    const statusConfig = getStatusConfig(expense.status)
    const StatusIcon = statusConfig.icon

    const formatDate = (dateString: string) => {
        if (!dateString) return 'غير محدد'
        return new Date(dateString).toLocaleDateString('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    // Helper to get creator name - supporting multiple data structures
    const getCreatorName = () => {
        if (expense.created_by_user?.full_name) return expense.created_by_user.full_name
        if (typeof expense.created_by_user === 'string') return expense.created_by_user
        if (expense.creator?.full_name) return expense.creator.full_name
        return null
    }

    // Helper to get approver name
    const getApproverName = () => {
        if (expense.approved_by_user?.full_name) return expense.approved_by_user.full_name
        if (typeof expense.approved_by_user === 'string') return expense.approved_by_user
        if (expense.approver?.full_name) return expense.approver.full_name
        return null
    }

    const creatorName = getCreatorName()
    const approverName = getApproverName()

    return (
        <>
            <SmartModal
                isOpen={isOpen}
                onClose={onClose}
                title=""
            >
                <div className="space-y-5 -mt-4">
                    {/* Hero Section - Amount & Status */}
                    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${statusConfig.bgGradient} p-6 border ${statusConfig.borderColor}`}>
                        {/* Decorative circles */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
                        <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-white/30 rounded-full blur-xl"></div>

                        <div className="relative flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Wallet className="w-5 h-5 text-gray-600" />
                                    <span className="text-sm text-gray-600 font-medium">المبلغ المصروف</span>
                                </div>
                                <p className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                                    {expense.amount?.toFixed(2) || '0.00'}
                                    <span className="text-xl mr-1">ج.م</span>
                                </p>
                            </div>
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${statusConfig.gradient} text-white shadow-lg`}>
                                <StatusIcon className="w-4 h-4" />
                                <span className="font-semibold text-sm">{statusConfig.label}</span>
                            </div>
                        </div>

                        {/* Category Badge */}
                        {expense.category && (
                            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-white/60 backdrop-blur-sm rounded-full border border-white/40">
                                <Tag className="w-4 h-4 text-gray-600" />
                                <span className="text-sm font-medium text-gray-700">
                                    {expense.category.name_ar || expense.category.name}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Info Cards Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* التاريخ */}
                        <div className="bg-gradient-to-br from-slate-50 to-gray-100 rounded-xl p-4 border border-gray-200/60">
                            <div className="flex items-center gap-2 text-gray-500 mb-2">
                                <Calendar className="w-4 h-4" />
                                <span className="text-xs font-medium">التاريخ</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-800 leading-relaxed">
                                {formatDate(expense.created_at)}
                            </p>
                        </div>

                        {/* المُنشئ */}
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200/60">
                            <div className="flex items-center gap-2 text-blue-600 mb-2">
                                <User className="w-4 h-4" />
                                <span className="text-xs font-medium">أنشأه</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-800">
                                {creatorName || (
                                    <span className="text-gray-400 italic">غير محدد</span>
                                )}
                            </p>
                        </div>

                        {/* الفريق */}
                        {expense.team && (
                            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-4 border border-purple-200/60">
                                <div className="flex items-center gap-2 text-purple-600 mb-2">
                                    <Users className="w-4 h-4" />
                                    <span className="text-xs font-medium">الفريق</span>
                                </div>
                                <p className="text-sm font-semibold text-gray-800">
                                    {expense.team.name}
                                </p>
                            </div>
                        )}

                        {/* خط السير */}
                        {expense.route && (
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200/60">
                                <div className="flex items-center gap-2 text-orange-600 mb-2">
                                    <MapPin className="w-4 h-4" />
                                    <span className="text-xs font-medium">خط السير</span>
                                </div>
                                <p className="text-sm font-semibold text-gray-800">
                                    {expense.route.name}
                                </p>
                            </div>
                        )}

                        {/* الموافق */}
                        {expense.approved_by && (
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200/60">
                                <div className="flex items-center gap-2 text-green-600 mb-2">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="text-xs font-medium">وافق عليه</span>
                                </div>
                                <p className="text-sm font-semibold text-gray-800">
                                    {approverName || (
                                        <span className="text-gray-400 italic">غير محدد</span>
                                    )}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* الوصف */}
                    <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-xl p-4 border border-gray-200/60">
                        <div className="flex items-center gap-2 text-gray-600 mb-2">
                            <FileText className="w-4 h-4" />
                            <span className="text-xs font-medium">الوصف</span>
                        </div>
                        <p className="text-gray-800 leading-relaxed">
                            {expense.description || <span className="text-gray-400 italic">لا يوجد وصف</span>}
                        </p>
                    </div>

                    {/* سبب الرفض */}
                    {expense.status === 'rejected' && expense.rejection_reason && (
                        <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-red-600 mb-2">
                                <XCircle className="w-4 h-4" />
                                <span className="text-xs font-semibold">سبب الرفض</span>
                            </div>
                            <p className="text-red-700 text-sm">
                                {expense.rejection_reason}
                            </p>
                        </div>
                    )}

                    {/* صورة الإيصال */}
                    {expense.receipt_image_url && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Receipt className="w-4 h-4" />
                                    <span className="text-sm font-medium">صورة الإيصال</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setImageZoomed(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                    >
                                        <ZoomIn className="w-3.5 h-3.5" />
                                        تكبير
                                    </button>
                                    <a
                                        href={expense.receipt_image_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        فتح
                                    </a>
                                </div>
                            </div>
                            <div
                                className="relative rounded-xl overflow-hidden border-2 border-gray-200 cursor-pointer hover:border-blue-400 transition-all shadow-sm hover:shadow-md"
                                onClick={() => setImageZoomed(true)}
                            >
                                <img
                                    src={expense.receipt_image_url}
                                    alt="صورة الإيصال"
                                    className="w-full max-h-48 object-contain bg-gray-50"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect fill="%23f8fafc" width="200" height="120"/><text x="50%" y="50%" text-anchor="middle" fill="%2394a3b8" font-size="12">خطأ في تحميل الصورة</text></svg>'
                                    }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end justify-center pb-3">
                                    <span className="text-white text-xs font-medium bg-black/50 px-3 py-1 rounded-full">
                                        اضغط للتكبير
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex justify-end pt-2">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 font-medium rounded-xl transition-all shadow-sm hover:shadow"
                        >
                            إغلاق
                        </button>
                    </div>
                </div>
            </SmartModal>

            {/* Image Zoom Modal */}
            {imageZoomed && expense.receipt_image_url && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-fadeIn"
                    onClick={() => setImageZoomed(false)}
                >
                    <button
                        onClick={() => setImageZoomed(false)}
                        className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6 text-white" />
                    </button>
                    <img
                        src={expense.receipt_image_url}
                        alt="صورة الإيصال مكبرة"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    )
}

export default ExpenseDetailsModal
