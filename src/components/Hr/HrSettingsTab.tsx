// HrSettingsTab — إدارة العطل الرسمية وقواعد الجزاءات
import React, { useState, useEffect, useCallback } from 'react'
import {
    Calendar, Shield, Plus, Trash2, Edit3, Loader2, X,
    Check, Power, PowerOff, Clock
} from 'lucide-react'
import { PublicHolidaysAPI, PenaltyRulesAPI } from '../../api/hr'
import type { PublicHoliday, PenaltyRule } from '../../types/hr.types'
import toast from 'react-hot-toast'
import { getWeekdayName, getMonthName } from '../../utils/formatters'

const HrSettingsTab: React.FC = () => {
    // ═══════ State ═══════
    const [activeSection, setActiveSection] = useState<'holidays' | 'penalties'>('holidays')

    // Holidays
    const [holidays, setHolidays] = useState<PublicHoliday[]>([])
    const [loadingHolidays, setLoadingHolidays] = useState(false)
    const [showAddHoliday, setShowAddHoliday] = useState(false)
    const [newHolidayName, setNewHolidayName] = useState('')
    const [newHolidayDate, setNewHolidayDate] = useState('')
    const [addingHoliday, setAddingHoliday] = useState(false)
    const [editingHolidayId, setEditingHolidayId] = useState<string | null>(null)
    const [editHolidayName, setEditHolidayName] = useState('')
    const [editHolidayDate, setEditHolidayDate] = useState('')
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear())

    // Penalties
    const [rules, setRules] = useState<PenaltyRule[]>([])
    const [loadingRules, setLoadingRules] = useState(false)
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
    const [editRuleValues, setEditRuleValues] = useState<Partial<PenaltyRule>>({})

    // ═══════ Load Data ═══════
    const loadHolidays = useCallback(async () => {
        setLoadingHolidays(true)
        try {
            const data = await PublicHolidaysAPI.getHolidays(yearFilter)
            setHolidays(data)
        } catch (err) {
            toast.error('خطأ فى تحميل العطل')
        } finally {
            setLoadingHolidays(false)
        }
    }, [yearFilter])

    const loadRules = useCallback(async () => {
        setLoadingRules(true)
        try {
            const data = await PenaltyRulesAPI.getRules()
            setRules(data)
        } catch (err) {
            toast.error('خطأ فى تحميل القواعد')
        } finally {
            setLoadingRules(false)
        }
    }, [])

    useEffect(() => {
        if (activeSection === 'holidays') loadHolidays()
        else loadRules()
    }, [activeSection, loadHolidays, loadRules])

    // ═══════ Holiday Actions ═══════
    const handleAddHoliday = async () => {
        if (!newHolidayName.trim() || !newHolidayDate) return
        setAddingHoliday(true)
        try {
            const res = await PublicHolidaysAPI.createHoliday({
                name: newHolidayName.trim(),
                date: newHolidayDate
            })
            if (res.success) {
                toast.success('تم إضافة العطلة')
                setShowAddHoliday(false)
                setNewHolidayName('')
                setNewHolidayDate('')
                loadHolidays()
            } else {
                toast.error(res.error || 'خطأ')
            }
        } finally {
            setAddingHoliday(false)
        }
    }

    const handleUpdateHoliday = async (id: string) => {
        if (!editHolidayName.trim() || !editHolidayDate) return
        const res = await PublicHolidaysAPI.updateHoliday(id, {
            name: editHolidayName.trim(),
            date: editHolidayDate
        })
        if (res.success) {
            toast.success('تم التحديث')
            setEditingHolidayId(null)
            loadHolidays()
        } else {
            toast.error(res.error || 'خطأ')
        }
    }

    const handleDeleteHoliday = async (id: string) => {
        if (!confirm('هل تريد حذف هذه العطلة؟')) return
        const res = await PublicHolidaysAPI.deleteHoliday(id)
        if (res.success) {
            toast.success('تم الحذف')
            loadHolidays()
        } else {
            toast.error(res.error || 'خطأ')
        }
    }

    const handleToggleHoliday = async (h: PublicHoliday) => {
        const res = await PublicHolidaysAPI.updateHoliday(h.id, { is_active: !h.is_active })
        if (res.success) {
            toast.success(h.is_active ? 'تم تعطيل العطلة' : 'تم تفعيل العطلة')
            loadHolidays()
        }
    }

    // ═══════ Penalty Rule Actions ═══════
    const handleSaveRule = async (id: string) => {
        const res = await PenaltyRulesAPI.updateRule(id, editRuleValues)
        if (res.success) {
            toast.success('تم تحديث القاعدة')
            setEditingRuleId(null)
            setEditRuleValues({})
            loadRules()
        } else {
            toast.error(res.error || 'خطأ')
        }
    }

    const handleToggleRule = async (rule: PenaltyRule) => {
        const res = await PenaltyRulesAPI.updateRule(rule.id, { is_active: !rule.is_active })
        if (res.success) {
            toast.success(rule.is_active ? 'تم تعطيل القاعدة' : 'تم تفعيل القاعدة')
            loadRules()
        }
    }

    const startEditRule = (rule: PenaltyRule) => {
        setEditingRuleId(rule.id)
        setEditRuleValues({
            name_ar: rule.name_ar,
            min_minutes: rule.min_minutes,
            max_minutes: rule.max_minutes,
            deduction_days: rule.deduction_days,
            grace_count: rule.grace_count,
        })
    }

    // ═══════ Render ═══════
    return (
        <div className="space-y-4">
            {/* Section Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveSection('holidays')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === 'holidays'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                >
                    <Calendar className="w-4 h-4" />
                    العطل الرسمية
                </button>
                <button
                    onClick={() => setActiveSection('penalties')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === 'penalties'
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                >
                    <Shield className="w-4 h-4" />
                    قواعد الجزاءات
                </button>
            </div>

            {/* ═══════ Public Holidays Section ═══════ */}
            {activeSection === 'holidays' && (
                <div className="space-y-3">
                    {/* Controls */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <select
                                value={yearFilter}
                                onChange={(e) => setYearFilter(Number(e.target.value))}
                                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                            >
                                {[2024, 2025, 2026, 2027].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                            <span className="text-sm text-gray-500">
                                {holidays.length} عطلة
                            </span>
                        </div>
                        <button
                            onClick={() => setShowAddHoliday(true)}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            إضافة عطلة
                        </button>
                    </div>

                    {/* Add Holiday Form */}
                    {showAddHoliday && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-indigo-900">عطلة جديدة</h4>
                                <button onClick={() => setShowAddHoliday(false)} className="p-1 hover:bg-indigo-100 rounded-lg">
                                    <X className="w-4 h-4 text-indigo-500" />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input
                                    type="text"
                                    value={newHolidayName}
                                    onChange={(e) => setNewHolidayName(e.target.value)}
                                    placeholder="اسم العطلة (مثال: عيد الفطر)"
                                    className="border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                />
                                <input
                                    type="date"
                                    value={newHolidayDate}
                                    onChange={(e) => setNewHolidayDate(e.target.value)}
                                    className="border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <button
                                onClick={handleAddHoliday}
                                disabled={addingHoliday || !newHolidayName.trim() || !newHolidayDate}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {addingHoliday && <Loader2 className="w-4 h-4 animate-spin" />}
                                <Plus className="w-4 h-4" />
                                إضافة
                            </button>
                        </div>
                    )}

                    {/* Holidays List */}
                    {loadingHolidays ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        </div>
                    ) : holidays.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>لا توجد عطل رسمية لسنة {yearFilter}</p>
                            <p className="text-xs mt-1">اضغط "إضافة عطلة" للبدء</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {holidays.map((h) => {
                                const isEditing = editingHolidayId === h.id
                                const dateObj = new Date(h.date + 'T00:00:00')
                                const dayName = getWeekdayName(dateObj)

                                return (
                                    <div
                                        key={h.id}
                                        className={`flex items-center gap-3 bg-white border rounded-xl p-3 transition-all ${h.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
                                            }`}
                                    >
                                        {/* Date Badge */}
                                        <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center text-center ${h.is_active ? 'bg-indigo-50' : 'bg-gray-100'
                                            }`}>
                                            <span className={`text-lg font-bold ${h.is_active ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                {dateObj.getDate()}
                                            </span>
                                            <span className="text-[10px] text-gray-500">
                                                {getMonthName(dateObj.getMonth())}
                                            </span>
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            {isEditing ? (
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <input
                                                        type="text"
                                                        value={editHolidayName}
                                                        onChange={(e) => setEditHolidayName(e.target.value)}
                                                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm flex-1"
                                                    />
                                                    <input
                                                        type="date"
                                                        value={editHolidayDate}
                                                        onChange={(e) => setEditHolidayDate(e.target.value)}
                                                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="font-semibold text-sm text-gray-900 truncate">{h.name}</p>
                                                    <p className="text-xs text-gray-400">{dayName}</p>
                                                </>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            {isEditing ? (
                                                <>
                                                    <button
                                                        onClick={() => handleUpdateHoliday(h.id)}
                                                        className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingHolidayId(null)}
                                                        className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            setEditingHolidayId(h.id)
                                                            setEditHolidayName(h.name)
                                                            setEditHolidayDate(h.date)
                                                        }}
                                                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleHoliday(h)}
                                                        className={`p-1.5 rounded-lg ${h.is_active
                                                            ? 'text-green-600 hover:bg-green-50'
                                                            : 'text-gray-400 hover:bg-gray-100'
                                                            }`}
                                                        title={h.is_active ? 'تعطيل' : 'تفعيل'}
                                                    >
                                                        {h.is_active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteHoliday(h.id)}
                                                        className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )
            }

            {/* ═══════ Penalty Rules Section ═══════ */}
            {
                activeSection === 'penalties' && (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-500">
                            قواعد الجزاءات التلقائية المطبّقة عند حساب الرواتب.
                            يمكنك تعديل القيم أو تعطيل/تفعيل كل قاعدة.
                        </p>

                        {loadingRules ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                            </div>
                        ) : rules.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>لا توجد قواعد جزاءات</p>
                                <p className="text-xs mt-1">شغّل الميجريشن 210 أولاً</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {rules.map((rule) => {
                                    const isEditing = editingRuleId === rule.id
                                    const isGrace = rule.name === 'grace_period'

                                    return (
                                        <div
                                            key={rule.id}
                                            className={`bg-white border rounded-xl overflow-hidden transition-all ${rule.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
                                                }`}
                                        >
                                            {/* Header */}
                                            <div className="flex items-center gap-3 p-3 sm:p-4">
                                                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${isGrace ? 'bg-green-50' : 'bg-orange-50'
                                                    }`}>
                                                    <Clock className={`w-5 h-5 ${isGrace ? 'text-green-600' : 'text-orange-600'}`} />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm text-gray-900">{rule.name_ar}</p>
                                                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                                                        <span>{rule.min_minutes}–{rule.max_minutes ?? '∞'} دقيقة</span>
                                                        {isGrace ? (
                                                            <span className="text-green-600 font-semibold">سماح {rule.grace_count} مرات</span>
                                                        ) : (
                                                            <span className="text-orange-600 font-semibold">
                                                                {rule.deduction_days === 0 ? 'إنذار' : `خصم ${rule.deduction_days} يوم`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    {isEditing ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleSaveRule(rule.id)}
                                                                className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => { setEditingRuleId(null); setEditRuleValues({}) }}
                                                                className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => startEditRule(rule)}
                                                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                                                            >
                                                                <Edit3 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleToggleRule(rule)}
                                                                className={`p-1.5 rounded-lg ${rule.is_active
                                                                    ? 'text-green-600 hover:bg-green-50'
                                                                    : 'text-gray-400 hover:bg-gray-100'
                                                                    }`}
                                                            >
                                                                {rule.is_active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Edit Form */}
                                            {isEditing && (
                                                <div className="border-t border-gray-100 px-3 sm:px-4 py-3 bg-gray-50/60">
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                        <div>
                                                            <label className="block text-[10px] text-gray-400 mb-1">الاسم</label>
                                                            <input
                                                                type="text"
                                                                value={editRuleValues.name_ar || ''}
                                                                onChange={(e) => setEditRuleValues(v => ({ ...v, name_ar: e.target.value }))}
                                                                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] text-gray-400 mb-1">من (دقيقة)</label>
                                                            <input
                                                                type="number"
                                                                value={editRuleValues.min_minutes ?? 0}
                                                                onChange={(e) => setEditRuleValues(v => ({ ...v, min_minutes: Number(e.target.value) }))}
                                                                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] text-gray-400 mb-1">إلى (دقيقة)</label>
                                                            <input
                                                                type="number"
                                                                value={editRuleValues.max_minutes ?? ''}
                                                                onChange={(e) => setEditRuleValues(v => ({ ...v, max_minutes: e.target.value ? Number(e.target.value) : null }))}
                                                                placeholder="∞"
                                                                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                                                            />
                                                        </div>
                                                        {isGrace ? (
                                                            <div>
                                                                <label className="block text-[10px] text-gray-400 mb-1">عدد مرات السماح</label>
                                                                <input
                                                                    type="number"
                                                                    value={editRuleValues.grace_count ?? 0}
                                                                    onChange={(e) => setEditRuleValues(v => ({ ...v, grace_count: Number(e.target.value) }))}
                                                                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <label className="block text-[10px] text-gray-400 mb-1">خصم (أيام)</label>
                                                                <input
                                                                    type="number"
                                                                    step="0.25"
                                                                    value={editRuleValues.deduction_days ?? 0}
                                                                    onChange={(e) => setEditRuleValues(v => ({ ...v, deduction_days: Number(e.target.value) }))}
                                                                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )
            }
        </div >
    )
}

export default HrSettingsTab
