// CustodyTab - تبويب حسابات العهدة
import React, { useState, useEffect, useCallback } from 'react'
import {
    Wallet, Loader2, UserCheck, Users2, TrendingUp, TrendingDown,
    Eye, RefreshCw, ChevronLeft, ChevronRight, Banknote, Snowflake, Plus
} from 'lucide-react'
import { CustodyAPI } from '../../api/custody'
import { VaultsAPI } from '../../api/vaults'
import CustodySettleModal from './CustodySettleModal'
import CustodyCreateModal from './CustodyCreateModal'
import { CustodyAccountWithDetails, CustodyTransaction, Vault } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { getUserNameFromRelation } from '../../api'
import toast from 'react-hot-toast'

const CustodyTab: React.FC = () => {
    const { user } = useAuth()
    const [accounts, setAccounts] = useState<CustodyAccountWithDetails[]>([])
    const [vaults, setVaults] = useState<Vault[]>([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        total_balance: 0, active_balance: 0, frozen_balance: 0,
        active_count: 0, frozen_count: 0, total_count: 0
    })
    const [expandedAccount, setExpandedAccount] = useState<string | null>(null)
    const [transactions, setTransactions] = useState<CustodyTransaction[]>([])
    const [txLoading, setTxLoading] = useState(false)
    const [txPage, setTxPage] = useState(1)
    const [txTotal, setTxTotal] = useState(0)
    const [settleAccount, setSettleAccount] = useState<CustodyAccountWithDetails | null>(null)
    const [showCreateCustody, setShowCreateCustody] = useState(false)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const [accountsData, summary, vaultsData] = await Promise.all([
                CustodyAPI.getCustodyAccounts(),
                CustodyAPI.getCustodySummary(),
                VaultsAPI.getVaults(true)
            ])
            setAccounts(accountsData)
            setVaults(vaultsData)
            setStats({
                total_balance: summary.total_balance,
                active_balance: summary.active_balance,
                frozen_balance: summary.frozen_balance,
                active_count: summary.active_count,
                frozen_count: summary.frozen_count,
                total_count: summary.total_count
            })
        } catch (err) {
            console.error(err)
            toast.error('خطأ في جلب بيانات العهد')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const fetchTransactions = useCallback(async (custodyId: string, page: number = 1) => {
        setTxLoading(true)
        try {
            const result = await CustodyAPI.getCustodyTransactions(custodyId, undefined, page, 10)
            setTransactions(result.data || [])
            setTxTotal(result.total || 0)
        } catch (err) {
            console.error(err)
        } finally {
            setTxLoading(false)
        }
    }, [])

    const handleExpand = (accountId: string) => {
        if (expandedAccount === accountId) {
            setExpandedAccount(null)
            setTransactions([])
        } else {
            setExpandedAccount(accountId)
            setTxPage(1)
            fetchTransactions(accountId, 1)
        }
    }

    // Helper: get user name from Supabase joined array
    const getUserName = (account: CustodyAccountWithDetails): string => {
        return getUserNameFromRelation(account.user)
    }

    const getTeamName = (account: CustodyAccountWithDetails): string => {
        const t = account.team as any
        if (Array.isArray(t) && t.length > 0) return t[0].name || '-'
        if (t && typeof t === 'object' && 'name' in t) return t.name || '-'
        return '-'
    }

    const isFrozen = (account: CustodyAccountWithDetails) => !account.is_active && (account.balance || 0) > 0

    const formatDate = (date: string) => new Date(date).toLocaleDateString('ar-EG', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })

    const isPositiveTx = (type: string) =>
        type === 'add' || type === 'collection' || type === 'settlement_in'

    const txTotalPages = Math.ceil(txTotal / 10)

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 text-center">
                    <p className="text-2xl font-bold text-gray-800">{stats.total_count}</p>
                    <p className="text-xs text-gray-500 mt-1">إجمالي الحسابات</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{stats.active_count}</p>
                    <p className="text-xs text-gray-500 mt-1">حسابات نشطة</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{stats.frozen_count}</p>
                    <p className="text-xs text-gray-500 mt-1">حسابات مجمّدة</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 text-center">
                    <p className="text-2xl font-bold text-gray-800">
                        {stats.total_balance.toLocaleString('ar-EG')} <span className="text-sm text-gray-400">ج.م</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">إجمالي الأرصدة</p>
                </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">حسابات العهدة</h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowCreateCustody(true)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-medium transition-colors shadow-sm"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        إنشاء عهدة
                    </button>
                    <button
                        onClick={fetchData}
                        className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4 text-gray-600" />
                    </button>
                </div>
            </div>

            {/* Accounts List */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                </div>
            ) : accounts.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                    <Wallet className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="font-medium">لا توجد حسابات عهدة</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {accounts.map((account) => {
                        const frozen = isFrozen(account)
                        const isExpanded = expandedAccount === account.id

                        return (
                            <div
                                key={account.id}
                                className={`bg-white rounded-xl border overflow-hidden transition-all ${frozen ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
                                    } ${isExpanded ? 'ring-2 ring-orange-300' : ''}`}
                            >
                                {/* Account Row */}
                                <div className="flex items-center justify-between p-3 sm:p-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${frozen ? 'bg-blue-100' :
                                            account.holder_type === 'team_leader' ? 'bg-orange-50' : 'bg-purple-50'
                                            }`}>
                                            {frozen ? (
                                                <Snowflake className="w-5 h-5 text-blue-500" />
                                            ) : account.holder_type === 'team_leader' ? (
                                                <UserCheck className="w-5 h-5 text-orange-600" />
                                            ) : (
                                                <Users2 className="w-5 h-5 text-purple-600" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-gray-800">{getUserName(account)}</p>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${account.holder_type === 'team_leader'
                                                    ? 'bg-orange-100 text-orange-700'
                                                    : 'bg-purple-100 text-purple-700'
                                                    }`}>
                                                    {account.holder_type === 'team_leader' ? 'قائد فريق' : 'مشرف'}
                                                </span>
                                                <span className="text-xs text-gray-400">{getTeamName(account)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <div className="text-left">
                                            <p className="text-lg font-bold text-gray-800">
                                                {(account.balance || 0).toLocaleString('ar-EG')} <span className="text-xs text-gray-400">ج.م</span>
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleExpand(account.id)}
                                            className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-orange-100 text-orange-600' : 'hover:bg-gray-100 text-gray-400'
                                                }`}
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        {(account.balance || 0) > 0 && (
                                            <button
                                                onClick={() => setSettleAccount(account)}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors"
                                            >
                                                <Banknote className="w-3.5 h-3.5" />
                                                تسوية
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Transactions Dropdown */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100 bg-gray-50/50 animate-fade-in">
                                        <div className="px-4 py-2 bg-gray-100">
                                            <h5 className="text-xs font-semibold text-gray-500">آخر الحركات</h5>
                                        </div>
                                        {txLoading ? (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                            </div>
                                        ) : transactions.length === 0 ? (
                                            <div className="text-center py-8 text-gray-400 text-sm">لا توجد حركات</div>
                                        ) : (
                                            <>
                                                <div className="divide-y divide-gray-100">
                                                    {transactions.map((tx) => (
                                                        <div key={tx.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isPositiveTx(tx.type) ? 'bg-green-100' : 'bg-red-100'
                                                                    }`}>
                                                                    {isPositiveTx(tx.type) ? (
                                                                        <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                                                                    ) : (
                                                                        <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm text-gray-700">{tx.notes || tx.type}</p>
                                                                    <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
                                                                </div>
                                                            </div>
                                                            <span className={`text-sm font-bold ${isPositiveTx(tx.type) ? 'text-green-600' : 'text-red-600'
                                                                }`}>
                                                                {isPositiveTx(tx.type) ? '+' : '-'}
                                                                {tx.amount?.toLocaleString('ar-EG')} ج.م
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Pagination */}
                                                {txTotalPages > 1 && (
                                                    <div className="flex items-center justify-between px-4 py-2 border-t bg-gray-100">
                                                        <span className="text-xs text-gray-500">صفحة {txPage} من {txTotalPages}</span>
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => { const p = txPage - 1; setTxPage(p); fetchTransactions(expandedAccount!, p) }}
                                                                disabled={txPage === 1}
                                                                className="p-1 rounded border border-gray-200 disabled:opacity-50"
                                                            >
                                                                <ChevronRight className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                onClick={() => { const p = txPage + 1; setTxPage(p); fetchTransactions(expandedAccount!, p) }}
                                                                disabled={txPage === txTotalPages}
                                                                className="p-1 rounded border border-gray-200 disabled:opacity-50"
                                                            >
                                                                <ChevronLeft className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Settle Modal */}
            {settleAccount && user && (
                <CustodySettleModal
                    account={settleAccount}
                    accounts={accounts.filter(a => a.id !== settleAccount.id && a.is_active)}
                    vaults={vaults}
                    performedBy={user.id}
                    onClose={() => setSettleAccount(null)}
                    onSuccess={() => { fetchData(); setSettleAccount(null) }}
                />
            )}

            {/* Create Custody Modal */}
            {showCreateCustody && (
                <CustodyCreateModal
                    onClose={() => setShowCreateCustody(false)}
                    onSuccess={() => { setShowCreateCustody(false); fetchData() }}
                />
            )}
        </div>
    )
}

export default CustodyTab
