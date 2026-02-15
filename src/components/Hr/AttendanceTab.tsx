// AttendanceTab — تبويب إدارة الحضور والانصراف
import React, { useState, useEffect, useCallback } from 'react'
import {
    Plus, RefreshCw, Loader2, UserCheck, UserX,
    Clock, CalendarOff, Sun, Search, X,
} from 'lucide-react'
import { AttendanceAPI } from '../../api/hr'
import { CheckInMethod } from '../../types/hr.types'
import type {
    AttendanceWithWorker,
    AttendanceStatus,
    AttendanceSummary,
} from '../../types/hr.types'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
    present: { label: 'حاضر', color: 'text-green-700', bg: 'bg-green-100', icon: UserCheck },
    absent: { label: 'غائب', color: 'text-red-700', bg: 'bg-red-100', icon: UserX },
    late: { label: 'متأخر', color: 'text-amber-700', bg: 'bg-amber-100', icon: Clock },
    leave: { label: 'إجازة', color: 'text-blue-700', bg: 'bg-blue-100', icon: CalendarOff },
    holiday: { label: 'عطلة', color: 'text-purple-700', bg: 'bg-purple-100', icon: Sun },
}

const AttendanceTab: React.FC = () => {
    const [records, setRecords] = useState<AttendanceWithWorker[]>([])
    const [summary, setSummary] = useState<AttendanceSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [viewMode, setViewMode] = useState<'daily' | 'summary'>('daily')
    const [filterStatus, setFilterStatus] = useState<string>('')
    const [searchTerm, setSearchTerm] = useState('')
    const [showAddModal, setShowAddModal] = useState(false)

    // بيانات النموذج
    const [formWorkerId, setFormWorkerId] = useState('')
    const [formStatus, setFormStatus] = useState<AttendanceStatus>('present' as AttendanceStatus)
    const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
    const [formNotes, setFormNotes] = useState('')
    const [formCheckIn, setFormCheckIn] = useState('')
    const [formCheckOut, setFormCheckOut] = useState('')
    const [workers, setWorkers] = useState<{ id: string; name: string }[]>([])
    const [submitting, setSubmitting] = useState(false)

    const now = new Date()
    const [summaryMonth, setSummaryMonth] = useState(now.getMonth() + 1)
    const [summaryYear, setSummaryYear] = useState(now.getFullYear())

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            if (viewMode === 'daily') {
                const data = await AttendanceAPI.getAttendance({
                    date: selectedDate,
                    status: filterStatus ? [filterStatus as AttendanceStatus] : undefined,
                })
                setRecords(data)
            } else {
                const data = await AttendanceAPI.getAttendanceSummary(summaryMonth, summaryYear)
                setSummary(data)
            }
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ في تحميل البيانات')
        } finally {
            setLoading(false)
        }
    }, [viewMode, selectedDate, filterStatus, summaryMonth, summaryYear])

    useEffect(() => {
        loadData()
    }, [loadData])

    // تحميل قائمة العمال للنموذج
    useEffect(() => {
        const loadWorkers = async () => {
            const { data } = await supabase
                .from('workers')
                .select('id, name')
                .eq('status', 'active')
                .order('name')
            setWorkers(data || [])
        }
        loadWorkers()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formWorkerId) {
            toast.error('اختر العامل')
            return
        }
        setSubmitting(true)
        try {
            const result = await AttendanceAPI.createAttendance({
                worker_id: formWorkerId,
                date: formDate,
                status: formStatus,
                check_in_time: formCheckIn ? `${formDate}T${formCheckIn}:00` : undefined,
                check_out_time: formCheckOut ? `${formDate}T${formCheckOut}:00` : undefined,
                check_in_method: CheckInMethod.MANUAL_ADMIN,
                notes: formNotes || undefined,
            })
            if (result.success) {
                toast.success(result.message || 'تم التسجيل بنجاح')
                setShowAddModal(false)
                resetForm()
                loadData()
            } else {
                toast.error(result.error || 'حدث خطأ')
            }
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ')
        } finally {
            setSubmitting(false)
        }
    }

    const resetForm = () => {
        setFormWorkerId('')
        setFormStatus('present' as AttendanceStatus)
        setFormDate(new Date().toISOString().split('T')[0])
        setFormNotes('')
        setFormCheckIn('')
        setFormCheckOut('')
    }

    const handleDeleteRecord = async (id: string) => {
        if (!confirm('هل تريد حذف هذا السجل؟')) return
        const result = await AttendanceAPI.deleteAttendance(id)
        if (result.success) {
            toast.success('تم الحذف')
            loadData()
        } else {
            toast.error(result.error || 'حدث خطأ')
        }
    }

    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return '—'
        return new Date(dateStr).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    }

    const filteredRecords = records.filter(r => {
        if (searchTerm) {
            const name = (r.worker as any)?.name || ''
            return name.includes(searchTerm)
        }
        return true
    })

    // إحصائيات سريعة
    const stats = {
        present: records.filter(r => r.status === 'present' || r.status === 'late').length,
        absent: records.filter(r => r.status === 'absent').length,
        leave: records.filter(r => r.status === 'leave').length,
        holiday: records.filter(r => r.status === 'holiday').length,
    }

    return (
        <div className="space-y-4">
            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode('daily')}
                        className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${viewMode === 'daily'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        عرض يومي
                    </button>
                    <button
                        onClick={() => setViewMode('summary')}
                        className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${viewMode === 'summary'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        ملخص شهري
                    </button>
                </div>

                <div className="flex gap-2 flex-wrap">
                    {viewMode === 'daily' ? (
                        <>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="بحث بالاسم..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="border border-gray-300 rounded-lg pr-9 pl-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-40"
                                />
                            </div>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">كل الحالات</option>
                                <option value="present">حاضر</option>
                                <option value="absent">غائب</option>
                                <option value="late">متأخر</option>
                                <option value="leave">إجازة</option>
                                <option value="holiday">عطلة</option>
                            </select>
                        </>
                    ) : (
                        <>
                            <select
                                value={summaryMonth}
                                onChange={(e) => setSummaryMonth(Number(e.target.value))}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            >
                                {Array.from({ length: 12 }, (_, i) => (
                                    <option key={i + 1} value={i + 1}>
                                        {new Date(2024, i).toLocaleDateString('ar-EG', { month: 'long' })}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={summaryYear}
                                onChange={(e) => setSummaryYear(Number(e.target.value))}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            >
                                {[2024, 2025, 2026, 2027].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </>
                    )}

                    <button
                        onClick={loadData}
                        className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                        title="تحديث"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => { resetForm(); setShowAddModal(true) }}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">تسجيل حضور</span>
                    </button>
                </div>
            </div>

            {/* Stats Cards (Daily View) */}
            {viewMode === 'daily' && !loading && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'حاضر', value: stats.present, color: 'green', icon: UserCheck },
                        { label: 'غائب', value: stats.absent, color: 'red', icon: UserX },
                        { label: 'إجازة', value: stats.leave, color: 'blue', icon: CalendarOff },
                        { label: 'عطلة', value: stats.holiday, color: 'purple', icon: Sun },
                    ].map((stat) => {
                        const Icon = stat.icon
                        return (
                            <div key={stat.label} className={`bg-${stat.color}-50 rounded-xl p-3 border border-${stat.color}-100`}>
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 bg-${stat.color}-100 rounded-lg flex items-center justify-center`}>
                                        <Icon className={`w-4 h-4 text-${stat.color}-600`} />
                                    </div>
                                    <div>
                                        <p className={`text-lg font-bold text-${stat.color}-700`}>{stat.value}</p>
                                        <p className="text-xs text-gray-500">{stat.label}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : viewMode === 'daily' ? (
                /* Daily View Table */
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-right py-3 px-3 font-medium text-gray-600">العامل</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600">الحالة</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600 hidden sm:table-cell">الحضور</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600 hidden sm:table-cell">الانصراف</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600 hidden md:table-cell">ساعات العمل</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600 hidden lg:table-cell">ملاحظات</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-8 text-gray-400">
                                        لا توجد سجلات حضور لهذا اليوم
                                    </td>
                                </tr>
                            ) : (
                                filteredRecords.map((record) => {
                                    const config = statusConfig[record.status] || statusConfig.present
                                    const StatusIcon = config.icon
                                    return (
                                        <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-3 px-3 font-medium text-gray-900">
                                                {(record.worker as any)?.name || '—'}
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                                                    <StatusIcon className="w-3 h-3" />
                                                    {config.label}
                                                </span>
                                            </td>
                                            <td className="py-3 px-3 text-center text-gray-600 hidden sm:table-cell">
                                                {formatTime(record.check_in_time)}
                                            </td>
                                            <td className="py-3 px-3 text-center text-gray-600 hidden sm:table-cell">
                                                {formatTime(record.check_out_time)}
                                            </td>
                                            <td className="py-3 px-3 text-center text-gray-600 hidden md:table-cell">
                                                {record.work_hours ? `${record.work_hours} ساعة` : '—'}
                                            </td>
                                            <td className="py-3 px-3 text-center text-gray-500 text-xs hidden lg:table-cell truncate max-w-[150px]">
                                                {record.notes || '—'}
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <button
                                                    onClick={() => handleDeleteRecord(record.id)}
                                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="حذف"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                /* Monthly Summary Table */
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-right py-3 px-3 font-medium text-gray-600">العامل</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600">حاضر</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600">غائب</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600">إجازة</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600 hidden sm:table-cell">متأخر</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600 hidden sm:table-cell">عطلة</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600 hidden md:table-cell">ساعات العمل</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600 hidden md:table-cell">إجازات مسموحة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {summary.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-8 text-gray-400">
                                        لا توجد بيانات لهذا الشهر
                                    </td>
                                </tr>
                            ) : (
                                summary.map((s) => (
                                    <tr key={s.worker_id} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-3 px-3 font-medium text-gray-900">{s.worker_name}</td>
                                        <td className="py-3 px-3 text-center">
                                            <span className="text-green-600 font-semibold">{s.present_days}</span>
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <span className={`font-semibold ${s.absent_days > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                {s.absent_days}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <span className={`font-semibold ${s.leave_days > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                                {s.leave_days}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-center hidden sm:table-cell">
                                            <span className={`font-semibold ${s.late_days > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                                {s.late_days}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-center hidden sm:table-cell">
                                            <span className="text-purple-600 font-semibold">{s.holiday_days}</span>
                                        </td>
                                        <td className="py-3 px-3 text-center text-gray-600 hidden md:table-cell">
                                            {s.total_work_hours.toFixed(1)}
                                        </td>
                                        <td className="py-3 px-3 text-center hidden md:table-cell">
                                            <span className="text-sm font-medium text-gray-600">{s.paid_leave_allowance}</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add Attendance Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900">تسجيل حضور يدوي</h3>
                            <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            {/* العامل */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">العامل *</label>
                                <select
                                    value={formWorkerId}
                                    onChange={(e) => setFormWorkerId(e.target.value)}
                                    required
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">اختر العامل</option>
                                    {workers.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* التاريخ */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>
                                <input
                                    type="date"
                                    value={formDate}
                                    onChange={(e) => setFormDate(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            {/* الحالة */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {Object.entries(statusConfig).map(([key, config]) => {
                                        const Icon = config.icon
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setFormStatus(key as AttendanceStatus)}
                                                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${formStatus === key
                                                    ? `${config.bg} ${config.color} border-current`
                                                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <Icon className="w-3.5 h-3.5" />
                                                {config.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* وقت الحضور والانصراف (فقط للحاضر والمتأخر) */}
                            {(formStatus === 'present' || formStatus === 'late') && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">وقت الحضور</label>
                                        <input
                                            type="time"
                                            value={formCheckIn}
                                            onChange={(e) => setFormCheckIn(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">وقت الانصراف</label>
                                        <input
                                            type="time"
                                            value={formCheckOut}
                                            onChange={(e) => setFormCheckOut(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* ملاحظات */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                                <textarea
                                    value={formNotes}
                                    onChange={(e) => setFormNotes(e.target.value)}
                                    rows={2}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                                    placeholder="ملاحظات إضافية..."
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {submitting ? 'جارِ التسجيل...' : 'تسجيل'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AttendanceTab
