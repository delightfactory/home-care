// AdjustmentsTab — تبويب التسويات اليدوية (خصومات، جزاءات، مكافآت)
import React, { useState, useEffect, useCallback } from 'react'
import {
    Plus, RefreshCw, Loader2, Settings2,
    X, Trash2, Edit2, TrendingDown, TrendingUp, AlertOctagon,
} from 'lucide-react'
import { AdjustmentsAPI } from '../../api/hr'
import type {
    HrAdjustmentWithWorker,
    AdjustmentType,
} from '../../types/hr.types'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

const typeConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
    bonus: { label: 'مكافأة', color: 'text-green-700', bg: 'bg-green-100', icon: TrendingUp },
    deduction: { label: 'خصم', color: 'text-red-700', bg: 'bg-red-100', icon: TrendingDown },
    penalty: { label: 'جزاء', color: 'text-orange-700', bg: 'bg-orange-100', icon: AlertOctagon },
}

const AdjustmentsTab: React.FC = () => {
    const { user } = useAuth()
    const [adjustments, setAdjustments] = useState<HrAdjustmentWithWorker[]>([])
    const [loading, setLoading] = useState(true)
    const [filterType, setFilterType] = useState<string>('')

    const [showModal, setShowModal] = useState(false)
    const [editId, setEditId] = useState<string | null>(null)
    const [workers, setWorkers] = useState<{ id: string; name: string }[]>([])
    const [submitting, setSubmitting] = useState(false)

    const [formWorkerId, setFormWorkerId] = useState('')
    const [formType, setFormType] = useState<AdjustmentType>('bonus' as AdjustmentType)
    const [formAmount, setFormAmount] = useState('')
    const [formReason, setFormReason] = useState('')
    const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const data = await AdjustmentsAPI.getAdjustments({
                type: filterType ? [filterType as AdjustmentType] : undefined,
            })
            setAdjustments(data)
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ')
        } finally {
            setLoading(false)
        }
    }, [filterType])

    useEffect(() => {
        loadData()
    }, [loadData])

    useEffect(() => {
        const loadWorkers = async () => {
            const { data } = await supabase
                .from('workers')
                .select('id, name')
                .eq('status', 'active')
                .order('name')
            setWorkers(data || [])
        }
        loadWorkers()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const amount = parseFloat(formAmount)
        if (!formWorkerId || !amount || !formReason) {
            toast.error('أكمل جميع البيانات المطلوبة')
            return
        }

        setSubmitting(true)
        try {
            if (editId) {
                const result = await AdjustmentsAPI.updateAdjustment(editId, {
                    type: formType,
                    amount,
                    reason: formReason,
                    date: formDate,
                })
                if (result.success) {
                    toast.success('تم التحديث بنجاح')
                } else {
                    toast.error(result.error || 'حدث خطأ')
                }
            } else {
                const result = await AdjustmentsAPI.createAdjustment({
                    worker_id: formWorkerId,
                    type: formType,
                    amount,
                    reason: formReason,
                    date: formDate,
                    created_by: user?.id,
                })
                if (result.success) {
                    toast.success(result.message || 'تم الإضافة بنجاح')
                } else {
                    toast.error(result.error || 'حدث خطأ')
                }
            }

            setShowModal(false)
            resetForm()
            loadData()
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ')
        } finally {
            setSubmitting(false)
        }
    }

    const handleEdit = (adj: HrAdjustmentWithWorker) => {
        if (adj.is_processed) {
            toast.error('لا يمكن تعديل تسوية تمت معالجتها')
            return
        }
        setEditId(adj.id)
        setFormWorkerId(adj.worker_id)
        setFormType(adj.type)
        setFormAmount(adj.amount.toString())
        setFormReason(adj.reason)
        setFormDate(adj.date)
        setShowModal(true)
    }

    const handleDelete = async (id: string, isProcessed: boolean) => {
        if (isProcessed) {
            toast.error('لا يمكن حذف تسوية تمت معالجتها')
            return
        }
        if (!confirm('هل تريد حذف هذه التسوية؟')) return

        const result = await AdjustmentsAPI.deleteAdjustment(id)
        if (result.success) {
            toast.success('تم الحذف')
            loadData()
        } else {
            toast.error(result.error || 'حدث خطأ')
        }
    }

    const resetForm = () => {
        setEditId(null)
        setFormWorkerId('')
        setFormType('bonus' as AdjustmentType)
        setFormAmount('')
        setFormReason('')
        setFormDate(new Date().toISOString().split('T')[0])
    }

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

    // إحصائيات
    const totalBonuses = adjustments.filter(a => a.type === 'bonus' && !a.is_processed).reduce((s, a) => s + a.amount, 0)
    const totalDeductions = adjustments.filter(a => (a.type === 'deduction' || a.type === 'penalty') && !a.is_processed).reduce((s, a) => s + a.amount, 0)

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex gap-3 items-center flex-wrap">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="">كل الأنواع</option>
                        <option value="bonus">مكافآت</option>
                        <option value="deduction">خصومات</option>
                        <option value="penalty">جزاءات</option>
                    </select>
                    <div className="flex gap-3 text-sm text-gray-500">
                        <span>مكافآت معلقة: <span className="font-semibold text-green-600">{formatCurrency(totalBonuses)}</span></span>
                        <span>خصومات معلقة: <span className="font-semibold text-red-600">{formatCurrency(totalDeductions)}</span></span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={loadData}
                        className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => { resetForm(); setShowModal(true) }}
                        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span>تسوية جديدة</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
            ) : adjustments.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <Settings2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>لا توجد تسويات مسجلة</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-right py-3 px-3 font-medium text-gray-600">العامل</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600">النوع</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600">المبلغ</th>
                                <th className="text-right py-3 px-3 font-medium text-gray-600 hidden sm:table-cell">السبب</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600 hidden md:table-cell">التاريخ</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600">الحالة</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {adjustments.map((adj) => {
                                const config = typeConfig[adj.type] || typeConfig.bonus
                                const TypeIcon = config.icon
                                return (
                                    <tr key={adj.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-3 px-3 font-medium text-gray-900">
                                            {(adj.worker as any)?.name || '—'}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                                                <TypeIcon className="w-3 h-3" />
                                                {config.label}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-center font-semibold">
                                            <span className={adj.type === 'bonus' ? 'text-green-600' : 'text-red-600'}>
                                                {adj.type === 'bonus' ? '+' : '-'}{formatCurrency(adj.amount)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-gray-600 hidden sm:table-cell truncate max-w-[200px]">
                                            {adj.reason}
                                        </td>
                                        <td className="py-3 px-3 text-center text-gray-500 hidden md:table-cell">
                                            {new Date(adj.date).toLocaleDateString('ar-EG')}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${adj.is_processed
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {adj.is_processed ? 'تمت المعالجة' : 'معلقة'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            {!adj.is_processed && (
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => handleEdit(adj)}
                                                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="تعديل"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(adj.id, adj.is_processed)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="حذف"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editId ? 'تعديل التسوية' : 'تسوية جديدة'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">العامل *</label>
                                <select
                                    value={formWorkerId}
                                    onChange={(e) => setFormWorkerId(e.target.value)}
                                    required
                                    disabled={!!editId}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                                >
                                    <option value="">اختر العامل</option>
                                    {workers.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">النوع</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {Object.entries(typeConfig).map(([key, config]) => {
                                        const Icon = config.icon
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setFormType(key as AdjustmentType)}
                                                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${formType === key
                                                        ? `${config.bg} ${config.color} border-current`
                                                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <Icon className="w-3.5 h-3.5" />
                                                {config.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ *</label>
                                <input
                                    type="number"
                                    value={formAmount}
                                    onChange={(e) => setFormAmount(e.target.value)}
                                    min="0.01"
                                    step="0.01"
                                    required
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500"
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>
                                <input
                                    type="date"
                                    value={formDate}
                                    onChange={(e) => setFormDate(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">السبب *</label>
                                <textarea
                                    value={formReason}
                                    onChange={(e) => setFormReason(e.target.value)}
                                    rows={2}
                                    required
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 resize-none"
                                    placeholder="سبب التسوية..."
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 bg-purple-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {submitting ? 'جارِ الحفظ...' : editId ? 'تحديث' : 'إضافة'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AdjustmentsTab
