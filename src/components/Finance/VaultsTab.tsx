// VaultsTab - تبويب الخزائن في النظام المالي
import React, { useState, useEffect, useCallback } from 'react'
import {
    Landmark, Plus, Edit2, ArrowLeftRight, Eye, Wallet,
    Loader2, RefreshCw, TrendingUp, TrendingDown, ToggleLeft, ToggleRight,
    ChevronLeft, ChevronRight
} from 'lucide-react'
import { VaultsAPI } from '../../api/vaults'
import { Vault, VaultTransaction } from '../../types'
import VaultTransferModal from './VaultTransferModal'
import VaultAdjustmentModal from './VaultAdjustmentModal'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'

const VaultsTab: React.FC = () => {
    const { user } = useAuth()
    const [vaults, setVaults] = useState<Vault[]>([])
    const [loading, setLoading] = useState(true)
    const [showTransfer, setShowTransfer] = useState(false)
    const [adjustmentVault, setAdjustmentVault] = useState<Vault | null>(null)
    const [selectedVault, setSelectedVault] = useState<string | null>(null)
    const [transactions, setTransactions] = useState<VaultTransaction[]>([])
    const [txLoading, setTxLoading] = useState(false)
    const [txPage, setTxPage] = useState(1)
    const [txTotal, setTxTotal] = useState(0)
    const [editingVault, setEditingVault] = useState<Vault | null>(null)
    const [newVaultName, setNewVaultName] = useState('')
    const [newVaultNameAr, setNewVaultNameAr] = useState('')
    const [showNewForm, setShowNewForm] = useState(false)
    const [formLoading, setFormLoading] = useState(false)
    const [newVaultType, setNewVaultType] = useState<string>('main')

    const fetchVaults = useCallback(async () => {
        setLoading(true)
        try {
            const data = await VaultsAPI.getVaults(false)
            setVaults(data)
        } catch (err) {
            console.error(err)
            toast.error('خطأ في جلب الخزائن')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchVaults() }, [fetchVaults])

    const fetchTransactions = useCallback(async (vaultId: string, page: number = 1) => {
        setTxLoading(true)
        try {
            const result = await VaultsAPI.getVaultTransactions(vaultId, undefined, page, 15)
            setTransactions(result.data || [])
            setTxTotal(result.total || 0)
        } catch (err) {
            console.error(err)
        } finally {
            setTxLoading(false)
        }
    }, [])

    const handleViewTransactions = (vaultId: string) => {
        if (selectedVault === vaultId) {
            setSelectedVault(null)
            setTransactions([])
        } else {
            setSelectedVault(vaultId)
            setTxPage(1)
            fetchTransactions(vaultId, 1)
        }
    }

    const handleToggleActive = async (vault: Vault) => {
        try {
            const result = await VaultsAPI.toggleVaultActive(vault.id, !vault.is_active)
            if (result.success) {
                toast.success(vault.is_active ? 'تم تعطيل الخزنة' : 'تم تفعيل الخزنة')
                fetchVaults()
            }
        } catch {
            toast.error('حدث خطأ')
        }
    }

    const handleCreateVault = async () => {
        if (!newVaultName.trim()) return
        setFormLoading(true)
        try {
            const result = await VaultsAPI.createVault({
                name: newVaultName.trim(),
                name_ar: newVaultNameAr.trim() || newVaultName.trim(),
                type: newVaultType,
                is_active: true,
                balance: 0
            })
            if (result.success) {
                toast.success('تم إنشاء الخزنة')
                setNewVaultName('')
                setNewVaultNameAr('')
                setShowNewForm(false)
                fetchVaults()
            }
        } catch {
            toast.error('حدث خطأ')
        } finally {
            setFormLoading(false)
        }
    }

    const handleUpdateVault = async () => {
        if (!editingVault || !newVaultName.trim()) return
        setFormLoading(true)
        try {
            const result = await VaultsAPI.updateVault(editingVault.id, {
                name: newVaultName.trim(),
                name_ar: newVaultNameAr.trim() || newVaultName.trim()
            })
            if (result.success) {
                toast.success('تم تعديل الخزنة')
                setEditingVault(null)
                setNewVaultName('')
                setNewVaultNameAr('')
                fetchVaults()
            }
        } catch {
            toast.error('حدث خطأ')
        } finally {
            setFormLoading(false)
        }
    }

    const totalBalance = vaults.filter(v => v.is_active).reduce((sum, v) => sum + (v.balance || 0), 0)
    const txTotalPages = Math.ceil(txTotal / 15)

    const formatDate = (date: string) => new Date(date).toLocaleDateString('ar-EG', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })

    const isPositiveVaultTx = (type: string) =>
        type === 'deposit' || type === 'transfer_in' || type === 'collection' || type === 'settlement_in'

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Total Balance */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-4 sm:p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-emerald-100">إجمالي رصيد الخزائن</p>
                        <p className="text-2xl sm:text-3xl font-bold mt-1">
                            {totalBalance.toLocaleString('ar-EG')} <span className="text-lg">ج.م</span>
                        </p>
                    </div>
                    <Landmark className="w-10 h-10 sm:w-12 sm:h-12 text-white/30" />
                </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => { setShowNewForm(true); setNewVaultName(''); setNewVaultNameAr(''); setEditingVault(null) }}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    خزنة جديدة
                </button>
                <button
                    onClick={() => setShowTransfer(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors"
                >
                    <ArrowLeftRight className="w-4 h-4" />
                    تحويل بين خزائن
                </button>
                <button
                    onClick={fetchVaults}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                    <RefreshCw className="w-4 h-4 text-gray-600" />
                </button>
            </div>

            {/* New/Edit Vault Form */}
            {(showNewForm || editingVault) && (
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 animate-fade-in">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        {editingVault ? 'تعديل الخزنة' : 'إنشاء خزنة جديدة'}
                    </h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input
                            type="text"
                            placeholder="اسم الخزنة (EN)"
                            value={newVaultName}
                            onChange={(e) => setNewVaultName(e.target.value)}
                            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                        <input
                            type="text"
                            placeholder="اسم الخزنة (عربي)"
                            value={newVaultNameAr}
                            onChange={(e) => setNewVaultNameAr(e.target.value)}
                            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                        {!editingVault && (
                            <select
                                value={newVaultType}
                                onChange={(e) => setNewVaultType(e.target.value)}
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                            >
                                <option value="main">رئيسية</option>
                                <option value="branch">فرعية</option>
                                <option value="bank">بنكية</option>
                            </select>
                        )}
                        <button
                            onClick={editingVault ? handleUpdateVault : handleCreateVault}
                            disabled={formLoading || !newVaultName.trim()}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                        >
                            {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingVault ? 'تعديل' : 'إنشاء')}
                        </button>
                        <button
                            onClick={() => { setShowNewForm(false); setEditingVault(null); setNewVaultName(''); setNewVaultNameAr(''); setNewVaultType('main') }}
                            className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-100 transition-colors"
                        >
                            إلغاء
                        </button>
                    </div>
                </div>
            )}

            {/* Vaults Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
            ) : vaults.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                    <Landmark className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="font-medium">لا توجد خزائن</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {vaults.map((vault) => (
                        <div
                            key={vault.id}
                            className={`rounded-xl border p-4 transition-all hover:shadow-md ${vault.is_active ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-300 opacity-60'
                                } ${selectedVault === vault.id ? 'ring-2 ring-emerald-500' : ''}`}
                        >
                            {/* Vault Header */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${vault.is_active ? 'bg-emerald-50' : 'bg-gray-200'
                                        }`}>
                                        <Landmark className={`w-4 h-4 ${vault.is_active ? 'text-emerald-600' : 'text-gray-400'}`} />
                                    </div>
                                    <span className="font-bold text-gray-800 text-sm">{vault.name_ar || vault.name}</span>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${vault.type === 'main'
                                    ? 'bg-green-100 text-green-700'
                                    : vault.type === 'branch'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-purple-100 text-purple-700'
                                    }`}>
                                    {vault.type === 'main' ? 'رئيسية' : vault.type === 'branch' ? 'فرعية' : 'بنكية'}
                                </span>
                            </div>

                            {/* Balance */}
                            <p className="text-xl font-bold text-gray-800 mb-3">
                                {(vault.balance || 0).toLocaleString('ar-EG')} <span className="text-sm text-gray-400">ج.م</span>
                            </p>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                                <button
                                    onClick={() => handleViewTransactions(vault.id)}
                                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedVault === vault.id
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'hover:bg-gray-50 text-gray-600'
                                        }`}
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                    الحركات
                                </button>
                                {vault.is_active && (
                                    <button
                                        onClick={() => setAdjustmentVault(vault)}
                                        className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-50 transition-colors"
                                        title="إيداع / سحب يدوي"
                                    >
                                        <Wallet className="w-3.5 h-3.5" />
                                        إيداع/سحب
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setEditingVault(vault)
                                        setNewVaultName(vault.name)
                                        setNewVaultNameAr(vault.name_ar)
                                        setShowNewForm(false)
                                    }}
                                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => handleToggleActive(vault)}
                                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    {vault.is_active ? (
                                        <ToggleRight className="w-4 h-4 text-emerald-600" />
                                    ) : (
                                        <ToggleLeft className="w-4 h-4 text-gray-400" />
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Transactions Panel */}
            {selectedVault && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-fade-in">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700">
                            كشف حركات: {vaults.find(v => v.id === selectedVault)?.name_ar || vaults.find(v => v.id === selectedVault)?.name}
                        </h4>
                    </div>

                    {txLoading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-sm">لا توجد حركات</div>
                    ) : (
                        <>
                            <div className="divide-y divide-gray-100">
                                {transactions.map((tx) => (
                                    <div key={tx.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPositiveVaultTx(tx.type) ? 'bg-green-100' : 'bg-red-100'
                                                }`}>
                                                {isPositiveVaultTx(tx.type) ? (
                                                    <TrendingUp className="w-4 h-4 text-green-600" />
                                                ) : (
                                                    <TrendingDown className="w-4 h-4 text-red-600" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-800">
                                                    {tx.notes || tx.type}
                                                </p>
                                                <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
                                            </div>
                                        </div>
                                        <span className={`text-sm font-bold ${isPositiveVaultTx(tx.type) ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {isPositiveVaultTx(tx.type) ? '+' : '-'}
                                            {tx.amount?.toLocaleString('ar-EG')} ج.م
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination */}
                            {txTotalPages > 1 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                                    <span className="text-xs text-gray-500">صفحة {txPage} من {txTotalPages}</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { const p = txPage - 1; setTxPage(p); fetchTransactions(selectedVault, p) }}
                                            disabled={txPage === 1}
                                            className="p-1.5 rounded border border-gray-200 disabled:opacity-50"
                                        >
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => { const p = txPage + 1; setTxPage(p); fetchTransactions(selectedVault, p) }}
                                            disabled={txPage === txTotalPages}
                                            className="p-1.5 rounded border border-gray-200 disabled:opacity-50"
                                        >
                                            <ChevronLeft className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Transfer Modal */}
            {showTransfer && user && (
                <VaultTransferModal
                    vaults={vaults.filter(v => v.is_active)}
                    performedBy={user.id}
                    onClose={() => setShowTransfer(false)}
                    onSuccess={() => { fetchVaults(); setShowTransfer(false) }}
                />
            )}

            {/* Adjustment Modal */}
            {adjustmentVault && (
                <VaultAdjustmentModal
                    vault={adjustmentVault}
                    onClose={() => setAdjustmentVault(null)}
                    onSuccess={() => {
                        fetchVaults()
                        if (selectedVault === adjustmentVault.id) {
                            fetchTransactions(adjustmentVault.id, txPage)
                        }
                    }}
                />
            )}
        </div>
    )
}

export default VaultsTab
