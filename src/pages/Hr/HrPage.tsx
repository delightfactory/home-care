// HrPage — الصفحة الرئيسية للموارد البشرية (6 تبويبات)
import React, { useState } from 'react'
import { CalendarCheck, Receipt, Banknote, Settings2, MapPin, Award, Sliders } from 'lucide-react'
import AttendanceTab from '../../components/Hr/AttendanceTab'
import PayrollTab from '../../components/Hr/PayrollTab'
import AdvancesTab from '../../components/Hr/AdvancesTab'
import AdjustmentsTab from '../../components/Hr/AdjustmentsTab'
import CompanyLocationsTab from '../../components/Hr/CompanyLocationsTab'
import BonusesTab from '../../components/Hr/BonusesTab'
import HrSettingsTab from '../../components/Hr/HrSettingsTab'

type TabId = 'attendance' | 'payroll' | 'advances' | 'adjustments' | 'bonuses' | 'locations' | 'settings'

interface TabDef {
    id: TabId
    label: string
    icon: React.ElementType
    color: string
}

const tabs: TabDef[] = [
    { id: 'attendance', label: 'الحضور', icon: CalendarCheck, color: 'blue' },
    { id: 'payroll', label: 'الرواتب', icon: Receipt, color: 'emerald' },
    { id: 'advances', label: 'السلف', icon: Banknote, color: 'amber' },
    { id: 'adjustments', label: 'التسويات', icon: Settings2, color: 'purple' },
    { id: 'bonuses', label: 'الحوافز', icon: Award, color: 'rose' },
    { id: 'locations', label: 'المواقع', icon: MapPin, color: 'teal' },
    { id: 'settings', label: 'الإعدادات', icon: Sliders, color: 'slate' },
]

const colorMap: Record<string, { active: string; hover: string; bg: string }> = {
    blue: {
        active: 'border-blue-500 text-blue-600',
        hover: 'hover:text-blue-500 hover:border-blue-300',
        bg: 'bg-blue-50',
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
    purple: {
        active: 'border-purple-500 text-purple-600',
        hover: 'hover:text-purple-500 hover:border-purple-300',
        bg: 'bg-purple-50',
    },
    teal: {
        active: 'border-teal-500 text-teal-600',
        hover: 'hover:text-teal-500 hover:border-teal-300',
        bg: 'bg-teal-50',
    },
    rose: {
        active: 'border-rose-500 text-rose-600',
        hover: 'hover:text-rose-500 hover:border-rose-300',
        bg: 'bg-rose-50',
    },
    slate: {
        active: 'border-slate-500 text-slate-600',
        hover: 'hover:text-slate-500 hover:border-slate-300',
        bg: 'bg-slate-50',
    },
}

const HrPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabId>('attendance')

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900">الموارد البشرية</h1>
                    <p className="text-sm text-gray-500 mt-1">إدارة الحضور والرواتب والسلف والتسويات والحوافز والمواقع</p>
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
                    {activeTab === 'attendance' && <AttendanceTab />}
                    {activeTab === 'payroll' && <PayrollTab />}
                    {activeTab === 'advances' && <AdvancesTab />}
                    {activeTab === 'adjustments' && <AdjustmentsTab />}
                    {activeTab === 'bonuses' && <BonusesTab />}
                    {activeTab === 'locations' && <CompanyLocationsTab />}
                    {activeTab === 'settings' && <HrSettingsTab />}
                </div>
            </div>
        </div>
    )
}

export default HrPage
