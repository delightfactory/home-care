// TechCustodyPage - صفحة عهدة الفني (رصيد + حركات اليوم + مصروفات)
import React, { useState, useEffect, useCallback } from 'react'
import {
    Wallet, ArrowDownCircle, ArrowUpCircle, RefreshCw, Loader2,
    Receipt, Clock, CheckCircle, XCircle, TrendingUp, TrendingDown,
    ArrowLeftRight
} from 'lucide-react'
import TechLayout from '../../components/Layout/TechLayout'
import TechExpenseForm from '../../components/Tech/TechExpenseForm'
import { CustodyAPI } from '../../api/custody'
import EnhancedAPI from '../../api/enhanced-api'
import { useAuth } from '../../contexts/AuthContext'
import { useTechnicianData } from '../../hooks/useTechnicianData'
import { CustodyAccountWithDetails, CustodyTransaction, ExpenseWithDetails } from '../../types'

type TabType = 'transactions' | 'expenses'

const TechCustodyPage: React.FC = () => {
    const { user } = useAuth()
    const { status, refresh } = useTechnicianData()

    const [custody, setCustody] = useState<CustodyAccountWithDetails | null>(null)
    const [transactions, setTransactions] = useState<CustodyTransaction[]>([])
    const [expenses, setExpenses] = useState<ExpenseWithDetails[]>([])
    const [activeTab, setActiveTab] = useState<TabType>('transactions')
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [showExpenseForm, setShowExpenseForm] = useState(false)

    const today = new Date().toISOString().split('T')[0]
    const todayEnd = today + 'T23:59:59'

    const fetchCustody = useCallback(async () => {
        if (!user?.id) return
        try {
            const data = await CustodyAPI.getCustodyByUserId(user.id)
            setCustody(data)
            return data
        } catch (error) {
            console.error('Error fetching custody:', error)
            return null
        }
    }, [user?.id])

    const fetchTransactions = useCallback(async (custodyId: string) => {
        try {
            const result = await CustodyAPI.getCustodyTransactions(
                custodyId,
                { date_from: today, date_to: todayEnd },
                1,
                50
            )
            setTransactions(result.data || [])
        } catch (error) {
            console.error('Error fetching transactions:', error)
        }
    }, [today])

    const fetchExpenses = useCallback(async () => {
        if (!status?.teamId) return
        try {
            const response = await EnhancedAPI.getExpenses({
                team_id: status.teamId,
                date_from: today,
                date_to: todayEnd
            }, 1, 50, true)

            const data = 'success' in response
                ? (response as any).data?.data || []
                : response.data || []
            setExpenses(data)
        } catch (error) {
            console.error('Error fetching expenses:', error)
        }
    }, [status?.teamId, today])

    const loadAll = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true)
        else setLoading(true)

        try {
            const custodyData = await fetchCustody()
            const promises: Promise<void>[] = [fetchExpenses()]
            if (custodyData?.id) {
                promises.push(fetchTransactions(custodyData.id))
            }
            await Promise.all(promises)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [fetchCustody, fetchTransactions, fetchExpenses])

    useEffect(() => {
        loadAll()
    }, [loadAll])

    // === Helper functions ===
    const getTransactionTypeLabel = (type: string) => {
        const map: Record<string, string> = {
            add: 'إيداع',
            withdraw: 'سحب',
            collection: 'تحصيل فاتورة',
            settlement_out: 'تسوية صادرة',
            settlement_in: 'تسوية واردة',
            reset: 'تصفير',
            refund: 'استرداد',
            expense: 'مصروف'
        }
        return map[type] || type
    }

    const getTransactionIcon = (type: string) => {
        switch (type) {
            case 'add': case 'collection': case 'settlement_in': case 'refund':
                return <ArrowDownCircle className="w-4 h-4 text-green-500" />
            case 'withdraw': case 'settlement_out': case 'expense': case 'reset':
                return <ArrowUpCircle className="w-4 h-4 text-red-500" />
            default:
                return <ArrowLeftRight className="w-4 h-4 text-gray-500" />
        }
    }

    const isCredit = (type: string) =>
        ['add', 'collection', 'settlement_in', 'refund'].includes(type)

    const getExpenseStatusBadge = (expenseStatus: string) => {
        switch (expenseStatus) {
            case 'approved':
                return (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        <CheckCircle className="w-3 h-3" /> موافق
                    </span>
                )
            case 'rejected':
                return (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                        <XCircle className="w-3 h-3" /> مرفوض
                    </span>
                )
            default:
                return (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                        <Clock className="w-3 h-3" /> معلق
                    </span>
                )
        }
    }

    const formatTime = (date: string) =>
        new Date(date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })

    // === Computed values ===
    const todayIn = transactions.filter(t => isCredit(t.type)).reduce((s, t) => s + Number(t.amount), 0)
    const todayOut = transactions.filter(t => !isCredit(t.type)).reduce((s, t) => s + Number(t.amount), 0)

    if (loading) {
        return (
            <TechLayout onRefresh={refresh} isLeader={status?.isLeader || false}>
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            </TechLayout>
        )
    }

    return (
        <TechLayout onRefresh={refresh} isLeader={status?.isLeader || false}>
            <div className="p-4 pb-24 space-y-4">
                {/* Balance Card */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Wallet className="w-5 h-5" />
                            <span className="text-sm opacity-90">رصيد العُهدة</span>
                        </div>
                        <button
                            onClick={() => loadAll(true)}
                            disabled={refreshing}
                            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {custody ? (
                        <>
                            <div className="text-3xl font-bold mb-4">
                                {Number(custody.balance).toLocaleString('ar-EG')} <span className="text-lg opacity-80">ج.م</span>
                            </div>

                            {/* Today's summary */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/15 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <TrendingUp className="w-3.5 h-3.5 text-green-300" />
                                        <span className="text-xs opacity-80">وارد اليوم</span>
                                    </div>
                                    <span className="text-lg font-bold">{todayIn.toLocaleString('ar-EG')}</span>
                                </div>
                                <div className="bg-white/15 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <TrendingDown className="w-3.5 h-3.5 text-red-300" />
                                        <span className="text-xs opacity-80">صادر اليوم</span>
                                    </div>
                                    <span className="text-lg font-bold">{todayOut.toLocaleString('ar-EG')}</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-4 opacity-80">
                            <p className="text-sm">لا توجد عهدة مسجلة لحسابك</p>
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-100 rounded-xl p-1">
                    <button
                        onClick={() => setActiveTab('transactions')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'transactions'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <ArrowLeftRight className="w-4 h-4" />
                        الحركات
                    </button>
                    <button
                        onClick={() => setActiveTab('expenses')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'expenses'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Receipt className="w-4 h-4" />
                        المصروفات
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'transactions' ? (
                    <>
                        {/* Transactions List */}
                        {!custody ? (
                            <div className="text-center py-12 text-gray-500">
                                <Wallet className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                <p className="font-medium">لا توجد عهدة</p>
                            </div>
                        ) : transactions.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <ArrowLeftRight className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                <p className="font-medium">لا توجد حركات اليوم</p>
                                <p className="text-sm mt-1">لم يتم تسجيل أي حركات على العهدة اليوم</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-xs text-gray-400 px-1">{transactions.length} حركة اليوم</p>
                                {transactions.map(tx => (
                                    <div key={tx.id} className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                                                {getTransactionIcon(tx.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="text-sm font-medium text-gray-800">
                                                        {getTransactionTypeLabel(tx.type)}
                                                    </span>
                                                    <span className={`text-sm font-bold ${isCredit(tx.type) ? 'text-green-600' : 'text-red-600'}`}>
                                                        {isCredit(tx.type) ? '+' : '-'}{Number(tx.amount).toLocaleString('ar-EG')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-gray-400 truncate max-w-[60%]">
                                                        {tx.notes || '-'}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        {formatTime(tx.created_at)} • رصيد: {Number(tx.balance_after).toLocaleString('ar-EG')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {/* Expenses Header + Add Button */}
                        {status?.isLeader && (
                            <button
                                onClick={() => setShowExpenseForm(true)}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
                            >
                                <Receipt className="w-4 h-4" />
                                تسجيل مصروف جديد
                            </button>
                        )}

                        {/* Expenses List */}
                        {expenses.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <Receipt className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                <p className="font-medium">لا توجد مصروفات اليوم</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-xs text-gray-400 px-1">{expenses.length} مصروف اليوم</p>
                                {expenses.map(expense => (
                                    <div key={expense.id} className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-sm">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-gray-800">
                                                        {expense.amount.toFixed(2)} ج.م
                                                    </span>
                                                    {getExpenseStatusBadge(expense.status)}
                                                </div>
                                                <p className="text-sm text-gray-600 mb-1 truncate">{expense.description}</p>
                                                <div className="flex items-center gap-3 text-xs text-gray-400">
                                                    <span>{expense.category?.name_ar || 'غير محدد'}</span>
                                                    <span>•</span>
                                                    <span>{formatTime(expense.created_at)}</span>
                                                </div>
                                            </div>
                                            {expense.receipt_image_url && (
                                                <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 mr-3 flex-shrink-0">
                                                    <img
                                                        src={expense.receipt_image_url}
                                                        alt="إيصال"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        {expense.status === 'rejected' && expense.rejection_reason && (
                                            <div className="mt-2 p-2 bg-red-50 rounded-lg">
                                                <p className="text-xs text-red-600">
                                                    <strong>سبب الرفض:</strong> {expense.rejection_reason}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Total Summary */}
                                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-700">إجمالي مصروفات اليوم</span>
                                        <span className="text-lg font-bold text-blue-600">
                                            {expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)} ج.م
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Expense Form Modal */}
            <TechExpenseForm
                isOpen={showExpenseForm}
                onClose={() => setShowExpenseForm(false)}
                onSuccess={() => {
                    loadAll(true)
                    setActiveTab('expenses')
                }}
            />
        </TechLayout>
    )
}

export default TechCustodyPage
