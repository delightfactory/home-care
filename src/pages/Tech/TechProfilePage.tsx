// TechProfilePage — كشف حساب الفنى (مالى + أداء + حضور)
import React, { useState, useEffect, useCallback } from 'react'
import {
    Star, Calendar, Banknote, Award, ChevronLeft, ChevronRight,
    TrendingUp, Clock, UserCircle, Loader2, AlertCircle,
    CheckCircle, XCircle, Sun, Briefcase,
} from 'lucide-react'
import TechLayout from '../../components/Layout/TechLayout'
import { useTechnicianData } from '../../hooks/useTechnicianData'
import { AttendanceAPI, AdvancesAPI, AdjustmentsAPI, PayrollAPI } from '../../api/hr'
import { BonusesAPI, WorkerBonus } from '../../api/bonuses'
import type { AttendanceRecord, SalaryAdvance, HrAdjustment, PayrollItem } from '../../types/hr.types'
import { formatAmount } from '../../utils/formatters'
import toast from 'react-hot-toast'

const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

const TechProfilePage: React.FC = () => {
    const { status, loading: techLoading } = useTechnicianData()

    // الشهر المحدد للعرض
    const now = new Date()
    const [viewMonth, setViewMonth] = useState(now.getMonth() + 1)
    const [viewYear, setViewYear] = useState(now.getFullYear())

    // البيانات
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
    const [advances, setAdvances] = useState<SalaryAdvance[]>([])
    const [adjustments, setAdjustments] = useState<HrAdjustment[]>([])
    const [bonus, setBonus] = useState<WorkerBonus | null>(null)
    const [payrollItem, setPayrollItem] = useState<PayrollItem | null>(null)
    const [loading, setLoading] = useState(true)

    const workerId = status.workerId

    const loadData = useCallback(async () => {
        if (!workerId) return
        setLoading(true)
        try {
            const [attendanceData, advancesData, adjustmentsData, bonusData, payrollData] = await Promise.all([
                AttendanceAPI.getAttendanceByWorker(workerId, viewMonth, viewYear),
                AdvancesAPI.getAdvancesByWorker(workerId),
                AdjustmentsAPI.getAdjustments({ worker_id: workerId }).catch(() => []),
                BonusesAPI.getWorkerBonuses(`${viewYear}-${String(viewMonth).padStart(2, '0')}-01`).catch(() => []),
                PayrollAPI.getWorkerPayrollItem(workerId, viewMonth, viewYear).catch(() => null),
            ])
            setAttendance(attendanceData)
            setAdvances(advancesData)
            setAdjustments(adjustmentsData as HrAdjustment[])
            setPayrollItem(payrollData)
            // العثور على حافز هذا الفنى
            const myBonus = (bonusData as WorkerBonus[]).find(b => b.worker_id === workerId)
            setBonus(myBonus || null)
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ فى تحميل البيانات')
        } finally {
            setLoading(false)
        }
    }, [workerId, viewMonth, viewYear])

    useEffect(() => {
        loadData()
    }, [loadData])

    // التنقل بين الأشهر
    const goToPrev = () => {
        if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1) }
        else setViewMonth(m => m - 1)
    }
    const goToNext = () => {
        const isCurrentMonth = viewMonth === now.getMonth() + 1 && viewYear === now.getFullYear()
        if (isCurrentMonth) return
        if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1) }
        else setViewMonth(m => m + 1)
    }

    // استخدام formatAmount من formatters.ts — أرقام إنجليزية
    const formatCurrency = (n: number) => formatAmount(n)

    // حساب ملخص الحضور
    const presentDays = attendance.filter(a => a.status === 'present').length
    const absentDays = attendance.filter(a => a.status === 'absent').length
    const leaveDays = attendance.filter(a => a.status === 'leave').length
    const holidayDays = attendance.filter(a => a.status === 'holiday').length
    const totalDays = attendance.length

    // حساب السلف
    const activeAdvances = advances.filter(a => a.status === 'active' || a.status === 'pending')
    const totalAdvanceRemaining = activeAdvances.reduce((s, a) => s + a.remaining_amount, 0)

    // التسويات الأخيرة — آخر 3 أشهر
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    const recentAdjustments = adjustments
        .filter(a => new Date(a.created_at) >= threeMonthsAgo)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)

    const isCurrentMonth = viewMonth === now.getMonth() + 1 && viewYear === now.getFullYear()

    // التقييم بالنجوم
    const renderStars = (rating: number | null) => {
        if (!rating) return <span className="text-gray-400 text-sm">لا يوجد تقييم</span>
        const stars = []
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <Star
                    key={i}
                    className={`w-5 h-5 ${i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                />
            )
        }
        return <div className="flex gap-0.5">{stars}</div>
    }

    if (techLoading) {
        return (
            <TechLayout isLeader={status.isLeader}>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            </TechLayout>
        )
    }

    return (
        <TechLayout isLeader={status.isLeader}>
            <div className="p-4 pb-24 space-y-4">

                {/* 1. بطاقة الملف الشخصى */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-5 text-white shadow-xl shadow-blue-600/20">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-inner">
                            <UserCircle className="w-10 h-10 text-white" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold">
                                {status.workerName || 'الفنى'}
                            </h2>
                            <p className="text-blue-200 text-sm mt-0.5">
                                {status.teamName || 'بدون فريق'}
                                {status.isLeader && (
                                    <span className="mr-2 inline-flex items-center gap-1 bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded-full text-xs">
                                        <Award className="w-3 h-3" />
                                        قائد الفريق
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* إحصائيات سريعة */}
                    <div className="grid grid-cols-3 gap-3 mt-4 bg-white/10 backdrop-blur-sm rounded-2xl p-3">
                        <div className="text-center">
                            <p className="text-2xl font-bold">{presentDays}</p>
                            <p className="text-xs text-blue-200">يوم حضور</p>
                        </div>
                        <div className="text-center border-x border-white/20">
                            <p className="text-2xl font-bold">
                                {bonus?.avg_rating ? bonus.avg_rating.toFixed(1) : '—'}
                            </p>
                            <p className="text-xs text-blue-200">التقييم</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold">
                                {bonus ? formatCurrency(bonus.base_bonus) : '—'}
                            </p>
                            <p className="text-xs text-blue-200">الحافز</p>
                        </div>
                    </div>
                </div>

                {/* منتقى الشهر */}
                <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
                    <button
                        onClick={goToPrev}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className="text-center">
                        <p className="font-bold text-gray-900">
                            {months[viewMonth - 1]} {viewYear}
                        </p>
                        {isCurrentMonth && (
                            <p className="text-xs text-blue-500">الشهر الحالى</p>
                        )}
                    </div>
                    <button
                        onClick={goToNext}
                        disabled={isCurrentMonth}
                        className={`p-2 rounded-lg transition-colors ${isCurrentMonth ? 'opacity-30' : 'hover:bg-gray-100'}`}
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                ) : (
                    <>
                        {/* 2. بطاقة الأداء والتقييم */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                                <Star className="w-5 h-5 text-amber-500" />
                                <h3 className="font-bold text-gray-900">الأداء والتقييم</h3>
                            </div>
                            <div className="p-4">
                                {bonus ? (
                                    <div className="space-y-4">
                                        {/* التقييم */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600">تقييم العملاء</span>
                                            <div className="flex items-center gap-2">
                                                {renderStars(bonus.avg_rating)}
                                                {bonus.avg_rating && (
                                                    <span className="text-sm font-semibold text-amber-600">
                                                        {bonus.avg_rating.toFixed(1)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* معامل التقييم */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-600">معامل التقييم</span>
                                            <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${bonus.rating_factor >= 1
                                                ? 'bg-green-100 text-green-700'
                                                : bonus.rating_factor >= 0.8
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-red-100 text-red-700'
                                                }`}>
                                                ×{bonus.rating_factor.toFixed(2)}
                                            </span>
                                        </div>

                                        {/* الحافز */}
                                        <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-3 flex items-center justify-between border border-green-200">
                                            <div className="flex items-center gap-2">
                                                <TrendingUp className="w-5 h-5 text-green-600" />
                                                <span className="text-sm font-medium text-green-800">الحافز الشهرى</span>
                                            </div>
                                            <span className="text-lg font-bold text-green-700">
                                                {formatCurrency(bonus.base_bonus)} ج.م
                                            </span>
                                        </div>

                                        {/* تفاصيل إضافية */}
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                                                <p className="font-semibold text-gray-800">{bonus.days_worked}</p>
                                                <p className="text-xs text-gray-500">يوم عمل</p>
                                            </div>
                                            <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                                                <p className="font-semibold text-gray-800">{bonus.unrated_orders}</p>
                                                <p className="text-xs text-gray-500">بدون تقييم</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-gray-400">
                                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">مفيش بيانات أداء الشهر ده</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. بطاقة الحضور الشهرى */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-blue-500" />
                                <h3 className="font-bold text-gray-900">ملخص الحضور</h3>
                                <span className="text-xs text-gray-400 mr-auto">{totalDays} يوم</span>
                            </div>
                            <div className="p-4">
                                {totalDays > 0 ? (
                                    <div className="space-y-3">
                                        {/* شريط التقدم */}
                                        <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-gray-100">
                                            {presentDays > 0 && (
                                                <div
                                                    className="bg-green-500 rounded-full transition-all"
                                                    style={{ width: `${(presentDays / totalDays) * 100}%` }}
                                                    title={`حضور: ${presentDays}`}
                                                />
                                            )}
                                            {leaveDays > 0 && (
                                                <div
                                                    className="bg-blue-400 transition-all"
                                                    style={{ width: `${(leaveDays / totalDays) * 100}%` }}
                                                    title={`إجازة: ${leaveDays}`}
                                                />
                                            )}
                                            {holidayDays > 0 && (
                                                <div
                                                    className="bg-amber-400 transition-all"
                                                    style={{ width: `${(holidayDays / totalDays) * 100}%` }}
                                                    title={`عطلة: ${holidayDays}`}
                                                />
                                            )}
                                            {absentDays > 0 && (
                                                <div
                                                    className="bg-red-400 rounded-full transition-all"
                                                    style={{ width: `${(absentDays / totalDays) * 100}%` }}
                                                    title={`غياب: ${absentDays}`}
                                                />
                                            )}
                                        </div>

                                        {/* التفاصيل */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2.5">
                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                                <div>
                                                    <p className="text-sm font-semibold text-green-700">{presentDays}</p>
                                                    <p className="text-xs text-green-600">حضور</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2.5">
                                                <XCircle className="w-4 h-4 text-red-500" />
                                                <div>
                                                    <p className="text-sm font-semibold text-red-700">{absentDays}</p>
                                                    <p className="text-xs text-red-600">غياب</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2.5">
                                                <Sun className="w-4 h-4 text-blue-500" />
                                                <div>
                                                    <p className="text-sm font-semibold text-blue-700">{leaveDays}</p>
                                                    <p className="text-xs text-blue-600">إجازات</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2.5">
                                                <Briefcase className="w-4 h-4 text-amber-500" />
                                                <div>
                                                    <p className="text-sm font-semibold text-amber-700">{holidayDays}</p>
                                                    <p className="text-xs text-amber-600">عطلات</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-gray-400">
                                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">مفيش سجلات حضور الشهر ده</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3.5 بطاقة كشف الراتب */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                                <Banknote className="w-5 h-5 text-emerald-500" />
                                <h3 className="font-bold text-gray-900">كشف الراتب</h3>
                                {payrollItem && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full mr-auto font-medium ${isCurrentMonth ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                        }`}>
                                        {isCurrentMonth ? 'مؤقت' : months[viewMonth - 1]} {isCurrentMonth ? '' : viewYear}
                                    </span>
                                )}
                            </div>
                            <div className="p-4">
                                {payrollItem ? (
                                    <div className="space-y-3">
                                        {/* الراتب الأساسى */}
                                        <div className="flex items-center justify-between py-2">
                                            <div>
                                                <span className="text-sm text-gray-600">الراتب الأساسى</span>
                                                {isCurrentMonth && payrollItem.total_month_days > 0 && (() => {
                                                    const elapsed = Math.min(
                                                        payrollItem.total_month_days,
                                                        Math.max(0, Math.floor((Date.now() - new Date(viewYear, viewMonth - 1, 1).getTime()) / 86400000) + 1)
                                                    )
                                                    return elapsed < payrollItem.total_month_days ? (
                                                        <p className="text-xs text-amber-600 mt-0.5">
                                                            {elapsed} من {payrollItem.total_month_days} يوم
                                                        </p>
                                                    ) : null
                                                })()}
                                            </div>
                                            <span className="text-sm font-semibold text-gray-800">{formatCurrency(payrollItem.base_salary)} ج.م</span>
                                        </div>

                                        {/* الخصومات */}
                                        {(payrollItem.absence_deduction > 0 || payrollItem.advance_deduction > 0 || payrollItem.manual_deductions > 0 || payrollItem.manual_penalties > 0) && (
                                            <div className="bg-red-50 rounded-xl p-3 space-y-2">
                                                <p className="text-xs font-semibold text-red-700 mb-1">الخصومات</p>
                                                {payrollItem.absence_deduction > 0 && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-red-600">خصم غياب ({payrollItem.unpaid_absent_days} يوم)</span>
                                                        <span className="font-medium text-red-700">-{formatCurrency(payrollItem.absence_deduction)}</span>
                                                    </div>
                                                )}
                                                {payrollItem.advance_deduction > 0 && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-red-600">قسط سلفة</span>
                                                        <span className="font-medium text-red-700">-{formatCurrency(payrollItem.advance_deduction)}</span>
                                                    </div>
                                                )}
                                                {payrollItem.manual_deductions > 0 && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-red-600">خصومات يدوية</span>
                                                        <span className="font-medium text-red-700">-{formatCurrency(payrollItem.manual_deductions)}</span>
                                                    </div>
                                                )}
                                                {payrollItem.manual_penalties > 0 && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-red-600">جزاءات</span>
                                                        <span className="font-medium text-red-700">-{formatCurrency(payrollItem.manual_penalties)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* الإضافات */}
                                        {(payrollItem.calculated_bonus > 0 || payrollItem.manual_bonuses > 0) && (
                                            <div className="bg-green-50 rounded-xl p-3 space-y-2">
                                                <p className="text-xs font-semibold text-green-700 mb-1">الإضافات</p>
                                                {payrollItem.calculated_bonus > 0 && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-green-600">حافز التقييم</span>
                                                        <span className="font-medium text-green-700">+{formatCurrency(payrollItem.calculated_bonus)}</span>
                                                    </div>
                                                )}
                                                {payrollItem.manual_incentives > 0 && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-green-600">حوافز يدوية</span>
                                                        <span className="font-medium text-green-700">+{formatCurrency(payrollItem.manual_incentives)}</span>
                                                    </div>
                                                )}
                                                {payrollItem.manual_bonuses > 0 && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-green-600">مكافآت</span>
                                                        <span className="font-medium text-green-700">+{formatCurrency(payrollItem.manual_bonuses)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* صافى الراتب */}
                                        <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-3 flex items-center justify-between border border-green-200">
                                            <span className="text-sm font-bold text-green-800">صافى الراتب</span>
                                            <span className="text-lg font-bold text-green-700">{formatCurrency(payrollItem.net_salary)} ج.م</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-gray-400">
                                        <Banknote className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">لسه ما اتحسبش الراتب الشهر ده</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 4. بطاقة السلف */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                                <Banknote className="w-5 h-5 text-amber-500" />
                                <h3 className="font-bold text-gray-900">السلف</h3>
                                {totalAdvanceRemaining > 0 && (
                                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full mr-auto font-medium">
                                        متبقى: {formatCurrency(totalAdvanceRemaining)} ج.م
                                    </span>
                                )}
                            </div>
                            <div className="p-4">
                                {activeAdvances.length > 0 ? (
                                    <div className="space-y-3">
                                        {activeAdvances.map((adv) => {
                                            const paidAmount = adv.total_amount - adv.remaining_amount
                                            const progress = (paidAmount / adv.total_amount) * 100
                                            const paidInstallments = adv.installments_count > 1
                                                ? Math.round((paidAmount / adv.installment_amount))
                                                : (paidAmount > 0 ? 1 : 0)
                                            const statusLabel = adv.status === 'pending' ? 'في انتظار الاعتماد' :
                                                adv.status === 'completed' ? 'مكتملة' : 'نشطة'
                                            const statusColor = adv.status === 'pending'
                                                ? 'bg-orange-100 text-orange-700'
                                                : adv.status === 'completed'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-blue-100 text-blue-700'
                                            return (
                                                <div key={adv.id} className="border border-gray-100 rounded-xl p-3">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                                                            {statusLabel}
                                                        </span>
                                                        <span className="text-sm font-bold text-gray-800">
                                                            {formatCurrency(adv.total_amount)} ج.م
                                                        </span>
                                                    </div>
                                                    {adv.status === 'active' && (
                                                        <>
                                                            <div className="flex items-center gap-3 mb-1.5">
                                                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-amber-500 rounded-full transition-all"
                                                                        style={{ width: `${Math.min(progress, 100)}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                                                    {paidInstallments}/{adv.installments_count} قسط
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs text-gray-500">
                                                                <span>القسط: {formatCurrency(adv.installment_amount)} ج.م/شهر</span>
                                                                <span>متبقى: {formatCurrency(adv.remaining_amount)} ج.م</span>
                                                            </div>
                                                        </>
                                                    )}
                                                    {adv.status === 'pending' && (
                                                        <p className="text-xs text-orange-500 mt-1">
                                                            {adv.advance_type === 'immediate' ? 'فورية' : 'مجدولة'} — {adv.installments_count} قسط × {formatCurrency(adv.installment_amount)} ج.م
                                                        </p>
                                                    )}
                                                    {adv.reason && (
                                                        <p className="text-xs text-gray-400 mt-1 truncate">{adv.reason}</p>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-gray-400">
                                        <Banknote className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">مفيش سلف نشطة حالياً</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 5. بطاقة التسويات الأخيرة */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                                <Award className="w-5 h-5 text-purple-500" />
                                <h3 className="font-bold text-gray-900">التسويات</h3>
                                <span className="text-xs text-gray-400 mr-auto">آخر 3 أشهر</span>
                            </div>
                            <div className="p-4">
                                {recentAdjustments.length > 0 ? (
                                    <div className="space-y-2">
                                        {recentAdjustments.map((adj) => {
                                            const isBonus = adj.type === 'bonus'
                                            return (
                                                <div
                                                    key={adj.id}
                                                    className={`flex items-center justify-between p-3 rounded-lg border ${isBonus ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                                                        }`}
                                                >
                                                    <div>
                                                        <p className={`text-sm font-medium ${isBonus ? 'text-green-800' : 'text-red-800'}`}>
                                                            {adj.reason || (isBonus ? 'مكافأة' : 'خصم')}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                            {new Date(adj.created_at).toLocaleDateString('en-GB')}
                                                        </p>
                                                    </div>
                                                    <span className={`text-sm font-bold ${isBonus ? 'text-green-700' : 'text-red-700'}`}>
                                                        {isBonus ? '+' : '-'}{formatCurrency(adj.amount)} ج.م
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-gray-400">
                                        <Award className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">مفيش تسويات مسجّلة</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </>
                )}
            </div>
        </TechLayout>
    )
}

export default TechProfilePage
