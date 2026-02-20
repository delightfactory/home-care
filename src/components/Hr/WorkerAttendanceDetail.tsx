// WorkerAttendanceDetail — عرض تفصيلي لسجل حضور عامل
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
    X, ChevronLeft, ChevronRight, Loader2,
    UserCheck, UserX, Clock, CalendarOff, Sun,
    Calendar, TrendingUp, AlertCircle,
} from 'lucide-react'
import { AttendanceAPI, PublicHolidaysAPI } from '../../api/hr'
import type { AttendanceRecord } from '../../types/hr.types'
import toast from 'react-hot-toast'

interface WorkerAttendanceDetailProps {
    workerId: string
    workerName: string
    onClose: () => void
    initialMonth?: number
    initialYear?: number
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string; dotColor: string; gradient: string; icon: React.ElementType }> = {
    present: { label: 'حاضر', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dotColor: 'bg-emerald-500', gradient: 'from-emerald-400 to-emerald-600', icon: UserCheck },
    absent: { label: 'غائب', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dotColor: 'bg-red-500', gradient: 'from-red-400 to-red-600', icon: UserX },
    late: { label: 'متأخر', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dotColor: 'bg-amber-500', gradient: 'from-amber-400 to-amber-600', icon: Clock },
    leave: { label: 'إجازة', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', dotColor: 'bg-blue-500', gradient: 'from-blue-400 to-blue-600', icon: CalendarOff },
    holiday: { label: 'عطلة', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', dotColor: 'bg-purple-500', gradient: 'from-purple-400 to-purple-600', icon: Sun },
}

const dayNames = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
const monthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

const WorkerAttendanceDetail: React.FC<WorkerAttendanceDetailProps> = ({
    workerId,
    workerName,
    onClose,
    initialMonth,
    initialYear,
}) => {
    const now = new Date()
    const [month, setMonth] = useState(initialMonth || now.getMonth() + 1)
    const [year, setYear] = useState(initialYear || now.getFullYear())
    const [records, setRecords] = useState<AttendanceRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedDay, setSelectedDay] = useState<AttendanceRecord | null>(null)
    const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set())

    const loadRecords = useCallback(async () => {
        setLoading(true)
        try {
            const [data, holidays] = await Promise.all([
                AttendanceAPI.getAttendanceByWorker(workerId, month, year),
                PublicHolidaysAPI.getHolidays(year),
            ])
            setRecords(data)
            // بناء مجموعة تواريخ العطلات الرسمية النشطة
            const hSet = new Set<string>()
            for (const h of holidays) {
                if (h.is_active) hSet.add(h.date)
            }
            setHolidayDates(hSet)
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ في تحميل سجلات الحضور')
        } finally {
            setLoading(false)
        }
    }, [workerId, month, year])

    useEffect(() => {
        loadRecords()
    }, [loadRecords])

    // ─── بيانات التقويم ─────────────────────────────────────
    const calendarData = useMemo(() => {
        const recordMap = new Map<string, AttendanceRecord>()
        for (const r of records) {
            recordMap.set(r.date, r)
        }

        const firstDay = new Date(year, month - 1, 1)
        const daysInMonth = new Date(year, month, 0).getDate()
        const startDayOfWeek = firstDay.getDay()

        const days: Array<{ day: number; record: AttendanceRecord | null; isToday: boolean; isUnrecordedAbsent: boolean }> = []

        for (let i = 0; i < startDayOfWeek; i++) {
            days.push({ day: 0, record: null, isToday: false, isUnrecordedAbsent: false })
        }

        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const record = recordMap.get(dateStr) || null
            const cellDate = new Date(year, month - 1, d)
            // يوم ماضي بدون سجل ومش عطلة رسمية = غياب بدون تسجيل
            const isPast = cellDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())
            const isPublicHoliday = holidayDates.has(dateStr)
            const isUnrecordedAbsent = !record && isPast && !isPublicHoliday

            days.push({
                day: d,
                record,
                isToday: dateStr === todayStr,
                isUnrecordedAbsent,
            })
        }

        return days
    }, [records, month, year, holidayDates])

    // ─── حساب الإحصائيات (تشمل الأيام بدون سجل) ─────────────────────────────────────
    const stats = useMemo(() => {
        const s = {
            present: 0,
            absent: 0,
            unrecordedAbsent: 0,
            late: 0,
            leave: 0,
            holiday: 0,
            totalHours: 0,
            totalLateMinutes: 0,
            lateCount: 0,
        }
        for (const r of records) {
            switch (r.status) {
                case 'present': s.present++; break
                case 'absent': s.absent++; break
                case 'late': s.late++; s.lateCount++; break
                case 'leave': s.leave++; break
                case 'holiday': s.holiday++; break
            }
            if (r.work_hours) s.totalHours += Number(r.work_hours)
            if (r.late_minutes && r.late_minutes > 0) s.totalLateMinutes += r.late_minutes
        }
        // عد الأيام الماضية بدون سجل كغياب
        s.unrecordedAbsent = calendarData.filter(c => c.isUnrecordedAbsent).length
        return s
    }, [records, calendarData])

    // ─── التنقل بين الأشهر ─────────────────────────────────────
    const goToPrevMonth = () => {
        if (month === 1) { setMonth(12); setYear(y => y - 1) }
        else setMonth(m => m - 1)
    }
    const goToNextMonth = () => {
        if (month === 12) { setMonth(1); setYear(y => y + 1) }
        else setMonth(m => m + 1)
    }
    const goToCurrentMonth = () => {
        setMonth(now.getMonth() + 1)
        setYear(now.getFullYear())
    }

    // ─── تنسيق الوقت بأرقام إنجليزية ─────────────────────────────────────
    const fmtTime = (dateStr: string | null) => {
        if (!dateStr) return '—'
        const d = new Date(dateStr)
        const h = d.getHours()
        const m = d.getMinutes()
        const period = h >= 12 ? 'م' : 'ص'
        const h12 = h % 12 || 12
        return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`
    }

    const formatWorkHours = (hours: number | null) => {
        if (!hours) return '—'
        const h = Math.floor(hours)
        const m = Math.round((hours - h) * 60)
        return m > 0 ? `${h}h ${m}m` : `${h}h`
    }

    // ─── نسبة الحضور (تشمل الأيام بدون سجل) ─────────────────────────────────────
    const totalAbsent = stats.absent + stats.unrecordedAbsent
    const totalWorkDays = stats.present + stats.late + totalAbsent
    const attendanceRate = totalWorkDays > 0 ? ((stats.present + stats.late) / totalWorkDays * 100) : 0

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-2 sm:p-4 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-4 sm:my-8 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ═══ Header ═══ */}
                <div className="bg-gradient-to-l from-blue-600 to-indigo-700 px-5 py-4 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold">{workerName}</h2>
                                <p className="text-blue-100 text-xs mt-0.5">سجل الحضور التفصيلي</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Month Navigator */}
                    <div className="flex items-center justify-between mt-4 bg-white/10 rounded-xl px-3 py-2">
                        <button
                            onClick={goToPrevMonth}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={goToCurrentMonth}
                            className="text-sm font-semibold hover:bg-white/20 px-3 py-1 rounded-lg transition-colors"
                        >
                            {monthNames[month - 1]} {year}
                        </button>
                        <button
                            onClick={goToNextMonth}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                ) : (
                    <div className="p-4 sm:p-5 space-y-5">
                        {/* ═══ Stats Cards ═══ */}
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {[
                                { label: 'حضور', value: stats.present + stats.late, config: statusConfig.present },
                                { label: 'غياب', value: totalAbsent, config: statusConfig.absent },
                                { label: 'تأخير', value: stats.late, config: statusConfig.late },
                                { label: 'إجازة', value: stats.leave, config: statusConfig.leave },
                                { label: 'عطلة', value: stats.holiday, config: statusConfig.holiday },
                                { label: 'ساعات', value: stats.totalHours.toFixed(1), config: { color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200', dotColor: 'bg-slate-500', gradient: 'from-slate-400 to-slate-600', icon: TrendingUp } },
                            ].map((stat) => {
                                const Icon = (stat.config as any).icon
                                return (
                                    <div key={stat.label} className={`${stat.config.bg} rounded-xl p-2.5 text-center border ${stat.config.border}`}>
                                        <Icon className={`w-4 h-4 ${stat.config.color} mx-auto mb-1`} />
                                        <p className={`text-lg font-bold ${stat.config.color} leading-none`}>{stat.value}</p>
                                        <p className="text-[10px] text-gray-500 mt-1">{stat.label}</p>
                                    </div>
                                )
                            })}
                        </div>

                        {/* ═══ Attendance Rate Bar ═══ */}
                        {totalWorkDays > 0 && (
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <div className="flex items-center justify-between text-xs mb-1.5">
                                    <span className="text-gray-500 font-medium">نسبة الحضور</span>
                                    <span className={`font-bold ${attendanceRate >= 90 ? 'text-emerald-600' : attendanceRate >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                                        {attendanceRate.toFixed(0)}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ${attendanceRate >= 90 ? 'bg-emerald-500' : attendanceRate >= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                                        style={{ width: `${attendanceRate}%` }}
                                    />
                                </div>
                                {stats.totalLateMinutes > 0 && (
                                    <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        <span>اجمالي التأخير: {stats.totalLateMinutes} دقيقة ({stats.lateCount} مرة)</span>
                                    </div>
                                )}
                                {stats.unrecordedAbsent > 0 && (
                                    <div className="flex items-center gap-1.5 mt-2 text-xs text-red-500">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        <span>{stats.unrecordedAbsent} يوم بدون سجل (يُحسب غياب بدون أجر)</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ═══ Professional Calendar ═══ */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gradient-to-l from-gray-50 to-white border-b border-gray-100">
                                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-blue-500" />
                                    التقويم الشهري
                                </h3>
                            </div>
                            <div className="p-3 sm:p-4">
                                {/* Day names header */}
                                <div className="grid grid-cols-7 gap-1 mb-2">
                                    {dayNames.map((d, i) => (
                                        <div
                                            key={d}
                                            className={`text-center text-[11px] font-bold py-1.5 rounded-lg
                                                ${i === 5 ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500 bg-gray-50'}`}
                                        >
                                            {d}
                                        </div>
                                    ))}
                                </div>
                                {/* Calendar grid */}
                                <div className="grid grid-cols-7 gap-1">
                                    {calendarData.map((cell, idx) => {
                                        if (cell.day === 0) {
                                            return <div key={`empty-${idx}`} className="aspect-square" />
                                        }
                                        const config = cell.record ? statusConfig[cell.record.status] : null
                                        const isFuture = new Date(year, month - 1, cell.day) > now
                                        const isSelected = selectedDay?.date === cell.record?.date && cell.record !== null

                                        return (
                                            <button
                                                key={cell.day}
                                                onClick={() => {
                                                    if (cell.record) setSelectedDay(isSelected ? null : cell.record)
                                                    else if (cell.isUnrecordedAbsent) setSelectedDay(null)
                                                }}
                                                disabled={!cell.record && !cell.isUnrecordedAbsent}
                                                className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-200 relative group
                                                    ${cell.isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                                                    ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1 scale-105 shadow-md' : ''}
                                                    ${config
                                                        ? `${config.bg} border ${config.border} hover:shadow-md hover:scale-105 cursor-pointer`
                                                        : cell.isUnrecordedAbsent
                                                            ? 'bg-red-50/70 border-2 border-dashed border-red-300 hover:shadow-md hover:scale-105 cursor-pointer'
                                                            : isFuture
                                                                ? 'bg-gray-50/50 text-gray-300 cursor-default border border-transparent'
                                                                : 'bg-gray-50 text-gray-400 border border-gray-100 cursor-default'}
                                                `}
                                            >
                                                <span className={`text-xs font-bold ${config ? config.color : cell.isUnrecordedAbsent ? 'text-red-500' : ''}`}>
                                                    {cell.day}
                                                </span>
                                                {config && (
                                                    <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-br ${config.gradient} mt-0.5 shadow-sm`} />
                                                )}
                                                {cell.isUnrecordedAbsent && !config && (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-300 mt-0.5" />
                                                )}
                                                {/* Tooltip on hover */}
                                                {config && (
                                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
                                                        {config.label}
                                                        {cell.record?.late_minutes ? ` (${cell.record.late_minutes}د)` : ''}
                                                    </div>
                                                )}
                                                {cell.isUnrecordedAbsent && !config && (
                                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-red-800 text-white text-[9px] px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
                                                        غياب (بدون سجل)
                                                    </div>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* Day detail card (when a day is clicked) */}
                                {selectedDay && (
                                    <div className={`mt-3 p-3 rounded-xl border-2 ${statusConfig[selectedDay.status]?.border || 'border-gray-200'} ${statusConfig[selectedDay.status]?.bg || 'bg-gray-50'} animate-in fade-in duration-200`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {(() => { const Icon = statusConfig[selectedDay.status]?.icon || UserCheck; return <Icon className={`w-4 h-4 ${statusConfig[selectedDay.status]?.color}`} /> })()}
                                                <span className="text-sm font-bold text-gray-800">
                                                    {new Date(selectedDay.date).getDate()} {monthNames[month - 1]}
                                                </span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig[selectedDay.status]?.bg} ${statusConfig[selectedDay.status]?.color} border ${statusConfig[selectedDay.status]?.border}`}>
                                                    {statusConfig[selectedDay.status]?.label}
                                                </span>
                                            </div>
                                            <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                            <div className="bg-white/80 rounded-lg p-2 text-center">
                                                <p className="text-gray-400 mb-0.5">الحضور</p>
                                                <p className="font-bold text-gray-800">{fmtTime(selectedDay.check_in_time)}</p>
                                            </div>
                                            <div className="bg-white/80 rounded-lg p-2 text-center">
                                                <p className="text-gray-400 mb-0.5">الانصراف</p>
                                                <p className="font-bold text-gray-800">{fmtTime(selectedDay.check_out_time)}</p>
                                            </div>
                                            <div className="bg-white/80 rounded-lg p-2 text-center">
                                                <p className="text-gray-400 mb-0.5">ساعات العمل</p>
                                                <p className="font-bold text-gray-800">{formatWorkHours(selectedDay.work_hours)}</p>
                                            </div>
                                            {selectedDay.status === 'late' && selectedDay.late_minutes > 0 && (
                                                <div className="bg-white/80 rounded-lg p-2 text-center">
                                                    <p className="text-gray-400 mb-0.5">التأخير</p>
                                                    <p className="font-bold text-amber-700">{selectedDay.late_minutes} دقيقة</p>
                                                </div>
                                            )}
                                        </div>
                                        {selectedDay.notes && (
                                            <p className="mt-2 text-xs text-gray-600 bg-white/60 rounded-lg p-2">📝 {selectedDay.notes}</p>
                                        )}
                                    </div>
                                )}

                                {/* Legend */}
                                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-gray-100">
                                    {Object.entries(statusConfig).map(([key, config]) => (
                                        <div key={key} className="flex items-center gap-1.5">
                                            <div className={`w-3 h-3 rounded-md bg-gradient-to-br ${config.gradient} shadow-sm`} />
                                            <span className="text-[11px] text-gray-600 font-medium">{config.label}</span>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded-md border-2 border-dashed border-red-300 bg-red-50" />
                                        <span className="text-[11px] text-gray-600 font-medium">بدون سجل</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ═══ Records Table ═══ */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gradient-to-l from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-gray-800">السجلات التفصيلية</h3>
                                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{records.length} سجل</span>
                            </div>
                            {records.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">
                                    <CalendarOff className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm font-medium">لا توجد سجلات لهذا الشهر</p>
                                </div>
                            ) : (
                                <div className="max-h-[340px] overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10">
                                            <tr className="border-b border-gray-200">
                                                <th className="text-right py-2.5 px-3 font-semibold text-gray-600 text-xs">اليوم</th>
                                                <th className="text-center py-2.5 px-2 font-semibold text-gray-600 text-xs">الحالة</th>
                                                <th className="text-center py-2.5 px-2 font-semibold text-gray-600 text-xs">الحضور</th>
                                                <th className="text-center py-2.5 px-2 font-semibold text-gray-600 text-xs">الانصراف</th>
                                                <th className="text-center py-2.5 px-2 font-semibold text-gray-600 text-xs hidden sm:table-cell">ساعات</th>
                                                <th className="text-center py-2.5 px-2 font-semibold text-gray-600 text-xs hidden sm:table-cell">تأخير</th>
                                                <th className="text-right py-2.5 px-2 font-semibold text-gray-600 text-xs hidden md:table-cell">ملاحظات</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {records.map((record) => {
                                                const config = statusConfig[record.status] || statusConfig.present
                                                const StatusIcon = config.icon
                                                const date = new Date(record.date)
                                                const dayNum = date.getDate()
                                                const dayName = dayNames[date.getDay()]

                                                return (
                                                    <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="py-2.5 px-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-gray-900 w-5 text-center">{dayNum}</span>
                                                                <span className="text-[10px] text-gray-400">{dayName}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-2.5 px-2 text-center">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.color} border ${config.border}`}>
                                                                <StatusIcon className="w-3 h-3" />
                                                                {config.label}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-2 text-center text-xs text-gray-600 font-mono">
                                                            {fmtTime(record.check_in_time)}
                                                        </td>
                                                        <td className="py-2.5 px-2 text-center text-xs text-gray-600 font-mono">
                                                            {fmtTime(record.check_out_time)}
                                                        </td>
                                                        <td className="py-2.5 px-2 text-center text-xs text-gray-600 hidden sm:table-cell">
                                                            {formatWorkHours(record.work_hours)}
                                                        </td>
                                                        <td className="py-2.5 px-2 text-center hidden sm:table-cell">
                                                            {record.status === 'late' && record.late_minutes > 0 ? (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                                                                    {record.late_minutes}m
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-gray-300">—</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 px-2 text-right text-[10px] text-gray-500 truncate max-w-[120px] hidden md:table-cell">
                                                            {record.notes || '—'}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default WorkerAttendanceDetail
