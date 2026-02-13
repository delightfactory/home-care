// FinancePage - الصفحة الرئيسية للنظام المالي (4 تبويبات)
import React, { useState } from 'react'
import { FileText, CreditCard, Landmark, Wallet } from 'lucide-react'
import InvoicesTab from '../../components/Finance/InvoicesTab'
import PaymentsTab from '../../components/Finance/PaymentsTab'
import VaultsTab from '../../components/Finance/VaultsTab'
import CustodyTab from '../../components/Finance/CustodyTab'

type TabId = 'invoices' | 'payments' | 'vaults' | 'custody'

interface TabDef {
    id: TabId
    label: string
    icon: React.ElementType
    color: string
}

const tabs: TabDef[] = [
    { id: 'invoices', label: 'الفواتير', icon: FileText, color: 'blue' },
    { id: 'payments', label: 'المدفوعات', icon: CreditCard, color: 'purple' },
    { id: 'vaults', label: 'الخزائن', icon: Landmark, color: 'emerald' },
    { id: 'custody', label: 'العُهد', icon: Wallet, color: 'amber' },
]

const colorMap: Record<string, { active: string; hover: string; bg: string }> = {
    blue: {
        active: 'border-blue-500 text-blue-600',
        hover: 'hover:text-blue-500 hover:border-blue-300',
        bg: 'bg-blue-50',
    },
    purple: {
        active: 'border-purple-500 text-purple-600',
        hover: 'hover:text-purple-500 hover:border-purple-300',
        bg: 'bg-purple-50',
    },
    emerald: {
        active: 'border-emerald-500 text-emerald-600',
        hover: 'hover:text-emerald-500 hover:border-emerald-300',
        bg: 'bg-emerald-50',
    },
    amber: {
        active: 'border-amber-500 text-amber-600',
        hover: 'hover:text-amber-500 hover:border-amber-300',
        bg: 'bg-amber-50',
    },
}

const FinancePage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabId>('invoices')

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900">النظام المالي</h1>
                    <p className="text-sm text-gray-500 mt-1">إدارة الفواتير والمدفوعات والخزائن والعُهد</p>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Tab Headers */}
                <div className="border-b border-gray-200 overflow-x-auto scrollbar-hide">
                    <nav className="flex min-w-max" aria-label="Tabs">
                        {tabs.map((tab) => {
                            const Icon = tab.icon
                            const isActive = activeTab === tab.id
                            const colors = colorMap[tab.color]

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap
                                        ${isActive
                                            ? `${colors.active} ${colors.bg}`
                                            : `border-transparent text-gray-500 ${colors.hover}`
                                        }`}
                                >
                                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                                    <span>{tab.label}</span>
                                </button>
                            )
                        })}
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="p-3 sm:p-6">
                    {activeTab === 'invoices' && <InvoicesTab />}
                    {activeTab === 'payments' && <PaymentsTab />}
                    {activeTab === 'vaults' && <VaultsTab />}
                    {activeTab === 'custody' && <CustodyTab />}
                </div>
            </div>
        </div>
    )
}

export default FinancePage
