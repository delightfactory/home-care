// TechExpensesList - قائمة مصروفات الفريق لليوم
import React, { useState, useEffect } from 'react'
import { Receipt, Clock, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react'
import EnhancedAPI from '../../api/enhanced-api'
import { useTechnicianData } from '../../hooks/useTechnicianData'
import { ExpenseWithDetails } from '../../types'

const TechExpensesList: React.FC = () => {
    const { status } = useTechnicianData()
    const [expenses, setExpenses] = useState<ExpenseWithDetails[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const today = new Date().toISOString().split('T')[0]

    useEffect(() => {
        if (status?.teamId) {
            fetchExpenses()
        }
    }, [status?.teamId])

    const fetchExpenses = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true)
        else setLoading(true)

        try {
            const response = await EnhancedAPI.getExpenses({
                team_id: status?.teamId || undefined,
                date_from: today,
                date_to: today
            }, 1, 50, true)

            // Handle both success-wrapped and direct response
            const data = 'success' in response
                ? (response as any).data?.data || []
                : response.data || []
            setExpenses(data)
        } catch (error) {
            console.error('Error fetching expenses:', error)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return (
                    <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        موافق
                    </span>
                )
            case 'rejected':
                return (
                    <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                        <XCircle className="w-3 h-3" />
                        مرفوض
                    </span>
                )
            default:
                return (
                    <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                        <Clock className="w-3 h-3" />
                        معلق
                    </span>
                )
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        )
    }

    return (
        <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-800">مصروفات اليوم</h2>
                    <p className="text-sm text-gray-500">{expenses.length} مصروف مسجل</p>
                </div>
                <button
                    onClick={() => fetchExpenses(true)}
                    disabled={refreshing}
                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Empty State */}
            {expenses.length === 0 ? (
                <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Receipt className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="font-semibold text-gray-700 mb-1">لا توجد مصروفات</h3>
                    <p className="text-sm text-gray-500">لم يتم تسجيل أي مصروفات لليوم</p>
                </div>
            ) : (
                /* Expenses List */
                <div className="space-y-3">
                    {expenses.map(expense => (
                        <div
                            key={expense.id}
                            className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-gray-800">
                                            {expense.amount.toFixed(2)} ج.م
                                        </span>
                                        {getStatusBadge(expense.status)}
                                    </div>
                                    <p className="text-sm text-gray-600 mb-1">{expense.description}</p>
                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                        <span>{expense.category?.name_ar || 'غير محدد'}</span>
                                        <span>•</span>
                                        <span>{new Date(expense.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>

                                {/* Receipt Image Thumbnail */}
                                {expense.receipt_image_url && (
                                    <div className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 ml-3 flex-shrink-0">
                                        <img
                                            src={expense.receipt_image_url}
                                            alt="Receipt"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Rejection Reason */}
                            {expense.status === 'rejected' && expense.rejection_reason && (
                                <div className="mt-2 p-2 bg-red-50 rounded-lg">
                                    <p className="text-xs text-red-600">
                                        <strong>سبب الرفض:</strong> {expense.rejection_reason}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Total Summary */}
            {expenses.length > 0 && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">إجمالي مصروفات اليوم</span>
                        <span className="text-lg font-bold text-blue-600">
                            {expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)} ج.م
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}

export default TechExpensesList
