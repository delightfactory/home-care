// TechCustodyPage - صفحة عهدة الفنى (رصيد + حركات اليوم + مصروفات)
import React, { useState, useEffect, useCallback } from 'react'
import {
    Wallet, ArrowDownCircle, ArrowUpCircle, RefreshCw, Loader2,
    Receipt, Clock, CheckCircle, XCircle, TrendingUp, TrendingDown,
    ArrowLeftRight, Plus
} from 'lucide-react'
import TechLayout from '../../components/Layout/TechLayout'
import TechExpenseForm from '../../components/Tech/TechExpenseForm'
import { CustodyAPI } from '../../api/custody'
import EnhancedAPI from '../../api/enhanced-api'
import { useAuth } from '../../contexts/AuthContext'
import { useTechnicianData } from '../../hooks/useTechnicianData'
import { CustodyAccountWithDetails, CustodyTransaction, ExpenseWithDetails } from '../../types'
import { formatAmount, formatTime as fmtTime, formatNumber } from '../../utils/formatters'

type TabType = 'transactions' | 'expenses'

const TechCustodyPage: React.FC = () => {
    const { user } = useAuth()
    const { status } = useTechnicianData()

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

    // === Helpers ===
    const txTypeLabel: Record<string, string> = {
        add: 'إيداع',
        withdraw: 'سحب',
        collection: 'تحصيل فاتورة',
        settlement_out: 'تسوية صادرة',
        settlement_in: 'تسوية واردة',
        reset: 'تصفير',
        refund: 'استرداد',
        expense: 'مصروف'
    }
    const getTxIcon = (type: string) => {
        switch (type) {
            case 'add': case 'collection': case 'settlement_in': case 'refund':
                return <ArrowDownCircle className="w-4 h-4 text-green-500" />
            case 'withdraw': case 'settlement_out': case 'expense': case 'reset':
                return <ArrowUpCircle className="w-4 h-4 text-red-500" />
            default:
                return <ArrowLeftRight className="w-4 h-4 text-gray-400" />
        }
    }
    const isCredit = (type: string) =>
        ['add', 'collection', 'settlement_in', 'refund'].includes(type)

    const expenseStatusBadge = (s: string) => {
        const map: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
            approved: { icon: <CheckCircle className="w-3 h-3" />, cls: 'bg-green-100 text-green-700', label: 'موافق' },
            rejected: { icon: <XCircle className="w-3 h-3" />, cls: 'bg-red-100 text-red-700', label: 'مرفوض' },
        }
        const info = map[s] || { icon: <Clock className="w-3 h-3" />, cls: 'bg-amber-100 text-amber-700', label: 'معلّق' }
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${info.cls}`}>
                {info.icon} {info.label}
            </span>
        )
    }

    // === Computed ===
    const todayIn = transactions.filter(t => isCredit(t.type)).reduce((s, t) => s + Number(t.amount), 0)
    const todayOut = transactions.filter(t => !isCredit(t.type)).reduce((s, t) => s + Number(t.amount), 0)

    // === Loading ===
    if (loading) {
        return (
            <TechLayout isLeader={status?.isLeader || false}>
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                    <p className="text-gray-400 text-sm">بنحمّل بيانات العُهدة...</p>
                </div>
            </TechLayout>
        )
    }

    return (
        <TechLayout isLeader={status?.isLeader || false}>
            <div className="p-4 pb-24 space-y-4">

                {/* ─── بطاقة الرصيد ─── */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-5 text-white shadow-xl shadow-blue-600/20">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                                <Wallet className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-medium opacity-90">رصيد العُهدة</span>
                        </div>
                        <button
                            onClick={() => loadAll(true)}
                            disabled={refreshing}
                            className="p-2 bg-white/15 rounded-xl hover:bg-white/25 transition-colors disabled:opacity-50 active:scale-95"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {custody ? (
                        <>
                            <div className="text-3xl font-bold mb-4 tracking-tight">
                                {formatAmount(Number(custody.balance))} <span className="text-lg opacity-70">ج.م</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/15 rounded-2xl p-3">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <TrendingUp className="w-3.5 h-3.5 text-green-300" />
                                        <span className="text-[11px] opacity-80">وارد النهاردة</span>
                                    </div>
                                    <span className="text-lg font-bold">{formatAmount(todayIn)}</span>
                                </div>
                                <div className="bg-white/15 rounded-2xl p-3">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <TrendingDown className="w-3.5 h-3.5 text-red-300" />
                                        <span className="text-[11px] opacity-80">صادر النهاردة</span>
                                    </div>
                                    <span className="text-lg font-bold">{formatAmount(todayOut)}</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-4 opacity-80">
                            <p className="text-sm">مفيش عُهدة مسجّلة لحسابك</p>
                        </div>
                    )}
                </div>

                {/* ─── Tabs ─── */}
                <div className="flex bg-gray-100 rounded-2xl p-1">
                    {[
                        { key: 'transactions' as TabType, icon: ArrowLeftRight, label: 'الحركات' },
                        { key: 'expenses' as TabType, icon: Receipt, label: 'المصروفات' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === tab.key
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-gray-400'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ─── محتوى التاب ─── */}
                {activeTab === 'transactions' ? (
                    <>
                        {!custody ? (
                            <EmptyState icon={Wallet} title="مفيش عُهدة" subtitle="تواصل مع المشرف لفتح عُهدة" />
                        ) : transactions.length === 0 ? (
                            <EmptyState icon={ArrowLeftRight} title="مفيش حركات النهاردة" subtitle="لسه ما اتسجلتش أى حركة على العُهدة" />
                        ) : (
                            <div className="space-y-2">
                                <p className="text-xs text-gray-400 px-1">{formatNumber(transactions.length)} حركة النهاردة</p>
                                {transactions.map(tx => (
                                    <div key={tx.id} className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                                                {getTxIcon(tx.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="text-sm font-semibold text-gray-800">
                                                        {txTypeLabel[tx.type] || tx.type}
                                                    </span>
                                                    <span className={`text-sm font-bold ${isCredit(tx.type) ? 'text-green-600' : 'text-red-600'}`}>
                                                        {isCredit(tx.type) ? '+' : '-'}{formatAmount(Number(tx.amount))}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[11px] text-gray-400 truncate max-w-[55%]">
                                                        {tx.notes || '—'}
                                                    </span>
                                                    <span className="text-[11px] text-gray-400">
                                                        {fmtTime(tx.created_at)} • رصيد: {formatAmount(Number(tx.balance_after))}
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
                        {/* زر إضافة مصروف — للقائد فقط */}
                        {status?.isLeader && (
                            <button
                                onClick={() => setShowExpenseForm(true)}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-bold rounded-2xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
                            >
                                <Plus className="w-5 h-5" />
                                سجّل مصروف جديد
                            </button>
                        )}

                        {expenses.length === 0 ? (
                            <EmptyState icon={Receipt} title="مفيش مصروفات النهاردة" subtitle="لسه ما اتسجّلش أى مصروف" />
                        ) : (
                            <div className="space-y-2">
                                <p className="text-xs text-gray-400 px-1">{formatNumber(expenses.length)} مصروف النهاردة</p>
                                {expenses.map(expense => (
                                    <div key={expense.id} className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-gray-800">
                                                        {formatAmount(expense.amount)} ج.م
                                                    </span>
                                                    {expenseStatusBadge(expense.status)}
                                                </div>
                                                <p className="text-sm text-gray-600 mb-1 truncate">{expense.description}</p>
                                                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                                                    <span>{expense.category?.name_ar || 'غير محدد'}</span>
                                                    <span>•</span>
                                                    <span>{fmtTime(expense.created_at)}</span>
                                                </div>
                                            </div>
                                            {expense.receipt_image_url && (
                                                <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-200 mr-3 flex-shrink-0">
                                                    <img
                                                        src={expense.receipt_image_url}
                                                        alt="إيصال"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        {expense.status === 'rejected' && expense.rejection_reason && (
                                            <div className="mt-2 p-2.5 bg-red-50 rounded-xl">
                                                <p className="text-xs text-red-600">
                                                    <strong>سبب الرفض:</strong> {expense.rejection_reason}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* إجمالى */}
                                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-600">إجمالى مصروفات النهاردة</span>
                                        <span className="text-lg font-bold text-blue-600">
                                            {formatAmount(expenses.reduce((sum, e) => sum + e.amount, 0))} ج.م
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

// مكون حالة فارغة مشترك
const EmptyState: React.FC<{ icon: React.ElementType; title: string; subtitle: string }> = ({ icon: Icon, title, subtitle }) => (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="w-16 h-16 bg-gray-100 rounded-3xl flex items-center justify-center">
            <Icon className="w-8 h-8 text-gray-300" />
        </div>
        <h3 className="text-sm font-bold text-gray-600">{title}</h3>
        <p className="text-xs text-gray-400">{subtitle}</p>
    </div>
)

export default TechCustodyPage
