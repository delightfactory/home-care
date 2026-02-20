// TechProfilePage — صفحة حسابى للفنى (تصميم موبايل احترافى)
import React, { useState, useEffect, useCallback } from 'react'
import {
    Star, Calendar, Banknote, Award, ChevronLeft, ChevronRight,
    TrendingUp, Clock, UserCircle, Loader2,
    CheckCircle, XCircle, Sun, Briefcase, LogOut, Shield,
    Wallet, CreditCard, ArrowDownCircle, ArrowUpCircle,
    ChevronDown, ChevronUp, Users,
} from 'lucide-react'
import TechLayout from '../../components/Layout/TechLayout'
import { useTechnicianData } from '../../hooks/useTechnicianData'
import { useAuth } from '../../hooks/useAuth'
import { AttendanceAPI, AdvancesAPI, AdjustmentsAPI, PayrollAPI, PublicHolidaysAPI } from '../../api/hr'
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
    const { user, signOut } = useAuth()

    // الشهر المحدد للعرض
    const now = new Date()
    const [viewMonth, setViewMonth] = useState(now.getMonth() + 1)
    const [viewYear, setViewYear] = useState(now.getFullYear())

    const [records, setRecords] = useState<AttendanceRecord[]>([])
    const [advances, setAdvances] = useState<SalaryAdvance[]>([])
    const [adjustments, setAdjustments] = useState<HrAdjustment[]>([])
    const [bonus, setBonus] = useState<WorkerBonus | null>(null)
    const [payrollItem, setPayrollItem] = useState<PayrollItem | null>(null)
    const [loading, setLoading] = useState(true)
    const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set())

    // أقسام قابلة للطى
    const [showPayroll, setShowPayroll] = useState(true)
    const [showAttendance, setShowAttendance] = useState(true)
    const [showAdvances, setShowAdvances] = useState(false)
    const [showAdjustments, setShowAdjustments] = useState(false)

    // تأكيد تسجيل الخروج
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)

    const workerId = status.workerId

    const loadData = useCallback(async () => {
        if (!workerId) return
        setLoading(true)
        try {
            const [attendanceData, advancesData, adjustmentsData, bonusData, payrollData, holidays] = await Promise.all([
                AttendanceAPI.getAttendanceByWorker(workerId, viewMonth, viewYear),
                AdvancesAPI.getAdvancesByWorker(workerId),
                AdjustmentsAPI.getAdjustments({ worker_id: workerId }).catch(() => []),
                BonusesAPI.getWorkerBonuses(`${viewYear}-${String(viewMonth).padStart(2, '0')}-01`).catch(() => []),
                PayrollAPI.getWorkerPayrollItem(workerId, viewMonth, viewYear).catch(() => null),
                PublicHolidaysAPI.getHolidays(viewYear),
            ])
            setRecords(attendanceData)
            setAdvances(advancesData)
            setAdjustments(adjustmentsData as HrAdjustment[])
            setPayrollItem(payrollData)
            const myBonus = (bonusData as WorkerBonus[]).find(b => b.worker_id === workerId)
            setBonus(myBonus || null)
            // بناء مجموعة تواريخ العطلات الرسمية
            const hSet = new Set<string>()
            for (const h of holidays) {
                if (h.is_active) hSet.add(h.date)
            }
            setHolidayDates(hSet)
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

    const formatCurrency = (n: number) => formatAmount(n)

    // حساب ملخص الحضور (يشمل الأيام بدون سجل = غياب)
    const presentDays = records.filter(a => a.status === 'present' || a.status === 'late').length
    const recordedAbsentDays = records.filter(a => a.status === 'absent').length
    const leaveDays = records.filter(a => a.status === 'leave').length
    const holidayDays = records.filter(a => a.status === 'holiday').length
    const lateDays = records.filter(a => a.status === 'late').length

    // حساب الأيام الماضية بدون سجل (= غياب بدون تسجيل)
    const unrecordedAbsentDays = (() => {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const daysInMonth = new Date(viewYear, viewMonth, 0).getDate()
        const recordDates = new Set(records.map(r => r.date))
        let count = 0
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const cellDate = new Date(viewYear, viewMonth - 1, d)
            if (cellDate < today && !recordDates.has(dateStr) && !holidayDates.has(dateStr)) {
                count++
            }
        }
        return count
    })()

    const absentDays = recordedAbsentDays + unrecordedAbsentDays
    const totalDays = presentDays + absentDays + leaveDays + holidayDays

    // حساب السلف
    const activeAdvances = advances.filter(a => a.status === 'active' || a.status === 'pending')
    const totalAdvanceRemaining = activeAdvances.reduce((s, a) => s + a.remaining_amount, 0)

    // التسويات الأخيرة
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    const recentAdjustments = adjustments
        .filter(a => new Date(a.created_at) >= threeMonthsAgo)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)

    const isCurrentMonth = viewMonth === now.getMonth() + 1 && viewYear === now.getFullYear()

    // التقييم بالنجوم
    const renderStars = (rating: number | null) => {
        if (!rating) return <span className="text-gray-400 text-xs">لا يوجد</span>
        const stars = []
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <Star
                    key={i}
                    className={`w-4 h-4 ${i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
                />
            )
        }
        return <div className="flex gap-0.5">{stars}</div>
    }

    // تسجيل الخروج
    const handleLogout = async () => {
        setLoggingOut(true)
        try {
            await signOut()
            toast.success('تم تسجيل الخروج')
        } catch {
            toast.error('حدث خطأ أثناء تسجيل الخروج')
        } finally {
            setLoggingOut(false)
            setShowLogoutConfirm(false)
        }
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
            <div className="pb-28">

                {/* ═══════════════════════════════════════════ */}
                {/* 1. هيدر الملف الشخصى — gradient card */}
                {/* ═══════════════════════════════════════════ */}
                <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 px-5 pt-6 pb-8 relative overflow-hidden">
                    {/* خلفية ديكور */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-10">
                        <div className="absolute -top-20 -left-20 w-60 h-60 bg-blue-500 rounded-full blur-3xl" />
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500 rounded-full blur-3xl" />
                    </div>

                    <div className="relative z-10">
                        {/* الاسم والأيقونة */}
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 ring-2 ring-white/20">
                                <UserCircle className="w-9 h-9 text-white" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-white leading-tight">
                                    {status.workerName || 'الفنى'}
                                </h2>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {status.teamName && (
                                        <span className="inline-flex items-center gap-1 text-xs text-slate-300 bg-white/10 px-2.5 py-1 rounded-full">
                                            <Users className="w-3 h-3" />
                                            {status.teamName}
                                        </span>
                                    )}
                                    {status.isLeader && (
                                        <span className="inline-flex items-center gap-1 text-xs bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full font-medium">
                                            <Shield className="w-3 h-3" />
                                            قائد الفريق
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* إحصائيات سريعة — 4 بطاقات */}
                        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mt-5">
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 sm:p-2.5 text-center">
                                <p className="text-base sm:text-lg font-bold text-white">{presentDays}</p>
                                <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">حضور</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 sm:p-2.5 text-center">
                                <p className="text-base sm:text-lg font-bold text-white">{absentDays}</p>
                                <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">غياب</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 sm:p-2.5 text-center">
                                <p className="text-base sm:text-lg font-bold text-white">
                                    {bonus?.avg_rating ? bonus.avg_rating.toFixed(1) : '—'}
                                </p>
                                <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">التقييم</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 sm:p-2.5 text-center">
                                <p className="text-sm sm:text-lg font-bold text-emerald-300 truncate">
                                    {payrollItem ? formatCurrency(payrollItem.net_salary) : '—'}
                                </p>
                                <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">الصافى</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-4 -mt-4 space-y-3 relative z-10">

                    {/* ═══════════════════════════════════════════ */}
                    {/* 2. منتقى الشهر */}
                    {/* ═══════════════════════════════════════════ */}
                    <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
                        <button
                            onClick={goToPrev}
                            className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors active:scale-95"
                        >
                            <ChevronRight className="w-5 h-5 text-gray-600" />
                        </button>
                        <div className="text-center">
                            <p className="font-bold text-gray-900 text-sm">
                                {months[viewMonth - 1]} {viewYear}
                            </p>
                            {isCurrentMonth && (
                                <p className="text-[10px] text-blue-500 font-medium">الشهر الحالى</p>
                            )}
                        </div>
                        <button
                            onClick={goToNext}
                            disabled={isCurrentMonth}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors active:scale-95 ${isCurrentMonth ? 'opacity-30' : 'hover:bg-gray-100'}`}
                        >
                            <ChevronLeft className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="text-center">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
                                <p className="text-xs text-gray-400 mt-2">جارٍ تحميل البيانات...</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* ═══════════════════════════════════════════ */}
                            {/* 3. كشف الراتب — قابل للطى */}
                            {/* ═══════════════════════════════════════════ */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <button
                                    onClick={() => setShowPayroll(!showPayroll)}
                                    className="w-full px-4 py-3.5 flex items-center justify-between active:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                                            <Wallet className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <div className="text-right">
                                            <h3 className="font-bold text-gray-900 text-sm">كشف الراتب</h3>
                                            {payrollItem && (
                                                <p className="text-[11px] text-gray-400">
                                                    {isCurrentMonth ? 'تقديرى' : months[viewMonth - 1]}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {payrollItem && (
                                            <span className="text-sm font-bold text-emerald-600">
                                                {formatCurrency(payrollItem.net_salary)} ج.م
                                            </span>
                                        )}
                                        {showPayroll ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                    </div>
                                </button>

                                {showPayroll && (
                                    <div className="px-4 pb-4 border-t border-gray-50">
                                        {payrollItem ? (
                                            <div className="space-y-3 pt-3">
                                                {/* الراتب الأساسى */}
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-gray-600">الراتب الأساسى</span>
                                                    <span className="text-sm font-semibold text-gray-800">{formatCurrency(payrollItem.base_salary)} ج.م</span>
                                                </div>

                                                {/* أيام فعّالة */}
                                                {payrollItem.effective_days !== undefined && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm text-gray-500">أيام فعّالة / مطلوبة</span>
                                                        <span className="text-sm text-gray-600">
                                                            {payrollItem.effective_days} / {payrollItem.required_work_days}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* رصيد الإجازات */}
                                                {payrollItem.leave_balance !== undefined && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm text-gray-500">رصيد الإجازات</span>
                                                        <span className="text-sm text-gray-600">
                                                            <span className="font-semibold text-blue-600">{payrollItem.leave_used}</span>
                                                            <span className="text-gray-400 mx-0.5">/</span>
                                                            <span>{payrollItem.leave_balance}</span>
                                                        </span>
                                                    </div>
                                                )}

                                                {/* فاصل */}
                                                <div className="border-t border-dashed border-gray-200" />

                                                {/* الخصومات */}
                                                {(payrollItem.absence_deduction > 0 || payrollItem.advance_deduction > 0 || payrollItem.manual_deductions > 0 || payrollItem.manual_penalties > 0 || (payrollItem.late_penalty_amount ?? 0) > 0) && (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <ArrowDownCircle className="w-3.5 h-3.5 text-red-500" />
                                                            <span className="text-xs font-semibold text-red-600">الخصومات</span>
                                                        </div>
                                                        {payrollItem.absence_deduction > 0 && (
                                                            <div className="flex justify-between text-sm pr-5">
                                                                <span className="text-gray-500">غياب ({payrollItem.unpaid_absent_days} يوم)</span>
                                                                <span className="text-red-600 font-medium">-{formatCurrency(payrollItem.absence_deduction)}</span>
                                                            </div>
                                                        )}
                                                        {(payrollItem.late_penalty_amount ?? 0) > 0 && (
                                                            <div className="flex justify-between text-sm pr-5">
                                                                <span className="text-gray-500">جزاءات تأخير ({payrollItem.late_penalty_days} يوم)</span>
                                                                <span className="text-red-600 font-medium">-{formatCurrency(payrollItem.late_penalty_amount!)}</span>
                                                            </div>
                                                        )}
                                                        {payrollItem.advance_deduction > 0 && (
                                                            <div className="flex justify-between text-sm pr-5">
                                                                <span className="text-gray-500">قسط سلفة</span>
                                                                <span className="text-red-600 font-medium">-{formatCurrency(payrollItem.advance_deduction)}</span>
                                                            </div>
                                                        )}
                                                        {payrollItem.manual_deductions > 0 && (
                                                            <div className="flex justify-between text-sm pr-5">
                                                                <span className="text-gray-500">خصومات يدوية</span>
                                                                <span className="text-red-600 font-medium">-{formatCurrency(payrollItem.manual_deductions)}</span>
                                                            </div>
                                                        )}
                                                        {payrollItem.manual_penalties > 0 && (
                                                            <div className="flex justify-between text-sm pr-5">
                                                                <span className="text-gray-500">جزاءات</span>
                                                                <span className="text-red-600 font-medium">-{formatCurrency(payrollItem.manual_penalties)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* الإضافات */}
                                                {(payrollItem.calculated_bonus > 0 || payrollItem.manual_bonuses > 0) && (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-500" />
                                                            <span className="text-xs font-semibold text-emerald-600">الإضافات</span>
                                                        </div>
                                                        {payrollItem.calculated_bonus > 0 && (
                                                            <div className="flex justify-between text-sm pr-5">
                                                                <span className="text-gray-500">حافز التقييم</span>
                                                                <span className="text-emerald-600 font-medium">+{formatCurrency(payrollItem.calculated_bonus)}</span>
                                                            </div>
                                                        )}
                                                        {payrollItem.manual_bonuses > 0 && (
                                                            <div className="flex justify-between text-sm pr-5">
                                                                <span className="text-gray-500">مكافآت</span>
                                                                <span className="text-emerald-600 font-medium">+{formatCurrency(payrollItem.manual_bonuses)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* فاصل */}
                                                <div className="border-t border-gray-200" />

                                                {/* الصافى */}
                                                <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-3 sm:p-3.5 flex items-center justify-between border border-emerald-200/60">
                                                    <span className="text-sm font-bold text-emerald-800">صافى الراتب</span>
                                                    <span className="text-base sm:text-lg font-bold text-emerald-700">{formatCurrency(payrollItem.net_salary)} ج.م</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-8">
                                                <Banknote className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                                                <p className="text-sm text-gray-400">لسه ما اتحسبش الراتب الشهر ده</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ═══════════════════════════════════════════ */}
                            {/* 4. الأداء والتقييم */}
                            {/* ═══════════════════════════════════════════ */}
                            {bonus && (
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                                    <div className="flex items-center gap-2.5 mb-3">
                                        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                                            <Star className="w-4 h-4 text-amber-500" />
                                        </div>
                                        <h3 className="font-bold text-gray-900 text-sm">الأداء والتقييم</h3>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2.5">
                                        {/* التقييم */}
                                        <div className="bg-amber-50/50 rounded-xl p-3 text-center border border-amber-100/60">
                                            <div className="flex justify-center mb-1">
                                                {renderStars(bonus.avg_rating)}
                                            </div>
                                            <p className="text-lg font-bold text-amber-700">
                                                {bonus.avg_rating ? bonus.avg_rating.toFixed(1) : '—'}
                                            </p>
                                            <p className="text-[10px] text-amber-600">التقييم</p>
                                        </div>

                                        {/* المعامل */}
                                        <div className="bg-blue-50/50 rounded-xl p-3 text-center border border-blue-100/60">
                                            <p className="text-lg font-bold text-blue-700 mt-2">
                                                ×{bonus.rating_factor.toFixed(2)}
                                            </p>
                                            <p className="text-[10px] text-blue-600 mt-1">المعامل</p>
                                        </div>

                                        {/* الحافز */}
                                        <div className="bg-emerald-50/50 rounded-xl p-3 text-center border border-emerald-100/60">
                                            <TrendingUp className="w-5 h-5 text-emerald-500 mx-auto" />
                                            <p className="text-lg font-bold text-emerald-700 mt-0.5">
                                                {formatCurrency(bonus.base_bonus)}
                                            </p>
                                            <p className="text-[10px] text-emerald-600">الحافز</p>
                                        </div>
                                    </div>

                                    {/* تفاصيل إضافية */}
                                    <div className="flex items-center justify-between mt-3 px-2 text-xs text-gray-500">
                                        <span>{bonus.days_worked} يوم عمل</span>
                                        <span className="text-gray-300">|</span>
                                        <span>{bonus.unrated_orders} طلب بدون تقييم</span>
                                    </div>
                                </div>
                            )}

                            {/* ═══════════════════════════════════════════ */}
                            {/* 5. ملخص الحضور — قابل للطى */}
                            {/* ═══════════════════════════════════════════ */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <button
                                    onClick={() => setShowAttendance(!showAttendance)}
                                    className="w-full px-4 py-3.5 flex items-center justify-between active:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                            <Calendar className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <h3 className="font-bold text-gray-900 text-sm">ملخص الحضور</h3>
                                        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{totalDays} يوم</span>
                                    </div>
                                    {showAttendance ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                </button>

                                {showAttendance && (
                                    <div className="px-4 pb-4 border-t border-gray-50">
                                        {totalDays > 0 ? (
                                            <div className="space-y-3 pt-3">
                                                {/* شريط التقدم */}
                                                <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden bg-gray-100">
                                                    {presentDays > 0 && (
                                                        <div
                                                            className="bg-emerald-500 first:rounded-r-full last:rounded-l-full transition-all"
                                                            style={{ width: `${(presentDays / totalDays) * 100}%` }}
                                                        />
                                                    )}
                                                    {leaveDays > 0 && (
                                                        <div
                                                            className="bg-blue-400 transition-all"
                                                            style={{ width: `${(leaveDays / totalDays) * 100}%` }}
                                                        />
                                                    )}
                                                    {holidayDays > 0 && (
                                                        <div
                                                            className="bg-amber-400 transition-all"
                                                            style={{ width: `${(holidayDays / totalDays) * 100}%` }}
                                                        />
                                                    )}
                                                    {absentDays > 0 && (
                                                        <div
                                                            className="bg-red-400 last:rounded-l-full transition-all"
                                                            style={{ width: `${(absentDays / totalDays) * 100}%` }}
                                                        />
                                                    )}
                                                </div>

                                                {/* التفاصيل */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="flex items-center gap-2.5 bg-emerald-50 rounded-xl px-3 py-2.5">
                                                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                                        <div>
                                                            <p className="text-sm font-bold text-emerald-700">{presentDays}</p>
                                                            <p className="text-[10px] text-emerald-600">حضور</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2.5 bg-red-50 rounded-xl px-3 py-2.5">
                                                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                                        <div>
                                                            <p className="text-sm font-bold text-red-700">{absentDays}</p>
                                                            <p className="text-[10px] text-red-600">غياب</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2.5 bg-blue-50 rounded-xl px-3 py-2.5">
                                                        <Sun className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                                        <div>
                                                            <p className="text-sm font-bold text-blue-700">{leaveDays}</p>
                                                            <p className="text-[10px] text-blue-600">إجازات</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2.5 bg-amber-50 rounded-xl px-3 py-2.5">
                                                        <Briefcase className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                                        <div>
                                                            <p className="text-sm font-bold text-amber-700">{holidayDays}</p>
                                                            <p className="text-[10px] text-amber-600">عطلات</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* التأخيرات */}
                                                {lateDays > 0 && (
                                                    <div className="flex items-center gap-2 bg-orange-50 rounded-xl px-3 py-2 border border-orange-100/60">
                                                        <Clock className="w-4 h-4 text-orange-500" />
                                                        <span className="text-xs text-orange-700">
                                                            {lateDays} مرة تأخير هذا الشهر
                                                        </span>
                                                    </div>
                                                )}

                                                {/* أيام بدون سجل */}
                                                {unrecordedAbsentDays > 0 && (
                                                    <div className="flex items-center gap-2 bg-red-50 rounded-xl px-3 py-2 border border-red-100/60">
                                                        <XCircle className="w-4 h-4 text-red-400" />
                                                        <span className="text-xs text-red-600">
                                                            {unrecordedAbsentDays} يوم بدون سجل (يُحسب غياب بدون أجر)
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8">
                                                <Clock className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                                                <p className="text-sm text-gray-400">مفيش سجلات حضور الشهر ده</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ═══════════════════════════════════════════ */}
                            {/* 6. السلف — قابل للطى */}
                            {/* ═══════════════════════════════════════════ */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <button
                                    onClick={() => setShowAdvances(!showAdvances)}
                                    className="w-full px-4 py-3.5 flex items-center justify-between active:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                                            <CreditCard className="w-4 h-4 text-orange-600" />
                                        </div>
                                        <h3 className="font-bold text-gray-900 text-sm">السلف</h3>
                                        {totalAdvanceRemaining > 0 && (
                                            <span className="text-[11px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                                                متبقى: {formatCurrency(totalAdvanceRemaining)}
                                            </span>
                                        )}
                                    </div>
                                    {showAdvances ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                </button>

                                {showAdvances && (
                                    <div className="px-4 pb-4 border-t border-gray-50">
                                        {activeAdvances.length > 0 ? (
                                            <div className="space-y-2.5 pt-3">
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
                                                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                                                                    {statusLabel}
                                                                </span>
                                                                <span className="text-sm font-bold text-gray-800">
                                                                    {formatCurrency(adv.total_amount)} ج.م
                                                                </span>
                                                            </div>
                                                            {adv.status === 'active' && (
                                                                <>
                                                                    <div className="flex items-center gap-3 mb-1.5">
                                                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                                            <div
                                                                                className="h-full bg-orange-500 rounded-full transition-all"
                                                                                style={{ width: `${Math.min(progress, 100)}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-[11px] text-gray-500 whitespace-nowrap">
                                                                            {paidInstallments}/{adv.installments_count}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between text-[11px] text-gray-400">
                                                                        <span>القسط: {formatCurrency(adv.installment_amount)} ج.م/شهر</span>
                                                                        <span>متبقى: {formatCurrency(adv.remaining_amount)} ج.م</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                            {adv.reason && (
                                                                <p className="text-[11px] text-gray-400 mt-1.5 truncate">{adv.reason}</p>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8">
                                                <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                                                <p className="text-sm text-gray-400">مفيش سلف نشطة</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ═══════════════════════════════════════════ */}
                            {/* 7. التسويات — قابل للطى */}
                            {/* ═══════════════════════════════════════════ */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <button
                                    onClick={() => setShowAdjustments(!showAdjustments)}
                                    className="w-full px-4 py-3.5 flex items-center justify-between active:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                                            <Award className="w-4 h-4 text-purple-600" />
                                        </div>
                                        <h3 className="font-bold text-gray-900 text-sm">التسويات</h3>
                                        <span className="text-xs text-gray-400">آخر 3 أشهر</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {recentAdjustments.length > 0 && (
                                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                                                {recentAdjustments.length}
                                            </span>
                                        )}
                                        {showAdjustments ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                    </div>
                                </button>

                                {showAdjustments && (
                                    <div className="px-4 pb-4 border-t border-gray-50">
                                        {recentAdjustments.length > 0 ? (
                                            <div className="space-y-2 pt-3">
                                                {recentAdjustments.map((adj) => {
                                                    const isBonus = adj.type === 'bonus'
                                                    return (
                                                        <div
                                                            key={adj.id}
                                                            className={`flex items-center justify-between p-3 rounded-xl border ${isBonus
                                                                ? 'bg-emerald-50/50 border-emerald-100'
                                                                : 'bg-red-50/50 border-red-100'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                                {isBonus
                                                                    ? <ArrowUpCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                                                    : <ArrowDownCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                                                }
                                                                <div className="min-w-0">
                                                                    <p className={`text-sm font-medium truncate ${isBonus ? 'text-emerald-800' : 'text-red-800'}`}>
                                                                        {adj.reason || (isBonus ? 'مكافأة' : adj.type === 'penalty' ? 'جزاء' : 'خصم')}
                                                                    </p>
                                                                    <p className="text-[11px] text-gray-400">
                                                                        {new Date(adj.created_at).toLocaleDateString('en-GB')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <span className={`text-sm font-bold whitespace-nowrap mr-2 ${isBonus ? 'text-emerald-700' : 'text-red-700'}`}>
                                                                {isBonus ? '+' : '-'}{formatCurrency(adj.amount)}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8">
                                                <Award className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                                                <p className="text-sm text-gray-400">مفيش تسويات مسجّلة</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ═══════════════════════════════════════════ */}
                            {/* 8. معلومات الحساب + تسجيل الخروج */}
                            {/* ═══════════════════════════════════════════ */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                                <div className="flex items-center gap-2.5 mb-1">
                                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                                        <UserCircle className="w-4 h-4 text-gray-600" />
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-sm">معلومات الحساب</h3>
                                </div>

                                {/* البريد */}
                                {(user as any)?.email && (
                                    <div className="flex items-center justify-between py-2 border-b border-gray-50">
                                        <span className="text-sm text-gray-500">البريد الإلكترونى</span>
                                        <span className="text-sm text-gray-700 font-medium" dir="ltr">{(user as any).email}</span>
                                    </div>
                                )}

                                {/* الهاتف */}
                                {user?.phone && (
                                    <div className="flex items-center justify-between py-2 border-b border-gray-50">
                                        <span className="text-sm text-gray-500">رقم الهاتف</span>
                                        <span className="text-sm text-gray-700 font-medium" dir="ltr">{user.phone}</span>
                                    </div>
                                )}

                                {/* الدور */}
                                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                                    <span className="text-sm text-gray-500">الدور</span>
                                    <span className="text-sm text-gray-700 font-medium">
                                        {(user as any)?.role?.name_ar || 'فنى'}
                                    </span>
                                </div>

                                {/* زر تسجيل الخروج */}
                                <button
                                    onClick={() => setShowLogoutConfirm(true)}
                                    className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 text-red-600 font-bold text-sm border border-red-200/60 active:bg-red-100 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    تسجيل الخروج
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* ═══════════════════════════════════════════ */}
                {/* مودال تأكيد تسجيل الخروج */}
                {/* ═══════════════════════════════════════════ */}
                {showLogoutConfirm && (
                    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)}>
                        <div
                            className="w-full max-w-lg bg-white rounded-t-3xl p-6 pb-8 shadow-2xl animate-slide-up"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
                            <div className="text-center mb-6">
                                <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                    <LogOut className="w-7 h-7 text-red-500" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">تسجيل الخروج</h3>
                                <p className="text-sm text-gray-500 mt-1">هل أنت متأكد من تسجيل الخروج؟</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowLogoutConfirm(false)}
                                    className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm active:bg-gray-200 transition-colors"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={handleLogout}
                                    disabled={loggingOut}
                                    className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm active:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                                    {loggingOut ? 'جارٍ الخروج...' : 'تسجيل الخروج'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Animation keyframe */}
            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
            `}</style>
        </TechLayout>
    )
}

export default TechProfilePage
