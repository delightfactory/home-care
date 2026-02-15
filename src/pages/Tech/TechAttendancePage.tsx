// TechAttendancePage — صفحة تسجيل الحضور والانصراف بالـ GPS للفنى
import React, { useState, useEffect, useCallback } from 'react'
import {
    Clock, MapPin, LogIn, LogOut, RefreshCw, Loader2,
    CheckCircle2, XCircle, AlertCircle, Calendar, Timer,
    ChevronRight, ChevronLeft, Shield
} from 'lucide-react'
import TechLayout from '../../components/Layout/TechLayout'
import { useTechnicianData } from '../../hooks/useTechnicianData'
import { AttendanceAPI } from '../../api/hr'
import { validateGpsProximity } from '../../utils/gpsUtils'
import type { AttendanceRecord } from '../../types/hr.types'
import toast from 'react-hot-toast'

interface GpsPosition {
    lat: number
    lng: number
    accuracy: number
}

const TechAttendancePage: React.FC = () => {
    const { status } = useTechnicianData()

    const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null)
    const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [gpsPosition, setGpsPosition] = useState<GpsPosition | null>(null)
    const [gpsError, setGpsError] = useState<string | null>(null)
    const [gpsLoading, setGpsLoading] = useState(false)
    const [proximityMessage, setProximityMessage] = useState<string | null>(null)
    const [view, setView] = useState<'today' | 'month'>('today')

    // التنقل بين الأشهر
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

    // تأكيد الانصراف
    const [showCheckOutConfirm, setShowCheckOutConfirm] = useState(false)

    const workerId = status.workerId

    // جلب بيانات الحضور اليوم
    const loadTodayRecord = useCallback(async () => {
        if (!workerId) return
        try {
            const today = new Date().toISOString().split('T')[0]
            const records = await AttendanceAPI.getAttendance({
                worker_id: workerId,
                date: today,
            })
            setTodayRecord(records.length > 0 ? records[0] : null)
        } catch {
            setTodayRecord(null)
        }
    }, [workerId])

    // جلب سجلات الشهر المحدد
    const loadMonthRecords = useCallback(async () => {
        if (!workerId) return
        try {
            const records = await AttendanceAPI.getAttendanceByWorker(
                workerId,
                selectedMonth,
                selectedYear
            )
            setMonthRecords(records)
        } catch {
            setMonthRecords([])
        }
    }, [workerId, selectedMonth, selectedYear])

    const loadAll = useCallback(async () => {
        setLoading(true)
        await Promise.all([loadTodayRecord(), loadMonthRecords()])
        setLoading(false)
    }, [loadTodayRecord, loadMonthRecords])

    useEffect(() => {
        loadAll()
    }, [loadAll])

    // جلب الموقع الجغرافى
    const getGpsLocation = useCallback((): Promise<GpsPosition> => {
        setGpsLoading(true)
        setGpsError(null)
        setProximityMessage(null)
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                setGpsError('الموقع الجغرافى غير مدعوم فى هذا المتصفح')
                setGpsLoading(false)
                reject(new Error('Geolocation not supported'))
                return
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const position = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        accuracy: Math.round(pos.coords.accuracy),
                    }
                    setGpsPosition(position)
                    setGpsLoading(false)
                    resolve(position)
                },
                (err) => {
                    let msg = 'تعذر تحديد الموقع'
                    if (err.code === 1) msg = 'تم رفض إذن الموقع — فعّل GPS وأعد المحاولة'
                    else if (err.code === 2) msg = 'الموقع غير متاح حالياً'
                    else if (err.code === 3) msg = 'انتهت مهلة تحديد الموقع'
                    setGpsError(msg)
                    setGpsLoading(false)
                    reject(new Error(msg))
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            )
        })
    }, [])

    // تسجيل الحضور مع التحقق من الموقع
    const handleCheckIn = async () => {
        if (!workerId) {
            toast.error('لا يمكن تحديد حساب العامل')
            return
        }

        setActionLoading(true)
        try {
            const position = await getGpsLocation()

            // التحقق من القرب من مواقع الشركة
            const proximity = await validateGpsProximity(position)
            setProximityMessage(proximity.message)

            if (!proximity.isWithinRange) {
                toast.error(proximity.message)
                setActionLoading(false)
                return
            }

            const result = await AttendanceAPI.checkIn(workerId, 'manual_gps', position)
            if (result.success) {
                toast.success('تم تسجيل الحضور بنجاح ✅')
                await loadAll()
            } else {
                toast.error(result.error || 'حدث خطأ أثناء تسجيل الحضور')
            }
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ')
        } finally {
            setActionLoading(false)
        }
    }

    // تسجيل الانصراف (مع GPS، بدون تحقق من الموقع)
    const handleCheckOut = async () => {
        if (!workerId) {
            toast.error('لا يمكن تحديد حساب العامل')
            return
        }

        setShowCheckOutConfirm(false)
        setActionLoading(true)
        try {
            const position = await getGpsLocation()
            const result = await AttendanceAPI.checkOut(workerId, 'manual_gps', position)
            if (result.success) {
                toast.success('تم تسجيل الانصراف بنجاح ✅')
                await loadAll()
            } else {
                toast.error(result.error || 'حدث خطأ أثناء تسجيل الانصراف')
            }
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ')
        } finally {
            setActionLoading(false)
        }
    }

    // التنقل بين الأشهر
    const goToPreviousMonth = () => {
        if (selectedMonth === 1) {
            setSelectedMonth(12)
            setSelectedYear(selectedYear - 1)
        } else {
            setSelectedMonth(selectedMonth - 1)
        }
    }

    const goToNextMonth = () => {
        const now = new Date()
        const isCurrentMonth = selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear()
        if (isCurrentMonth) return // لا نتجاوز الشهر الحالى

        if (selectedMonth === 12) {
            setSelectedMonth(1)
            setSelectedYear(selectedYear + 1)
        } else {
            setSelectedMonth(selectedMonth + 1)
        }
    }

    const isCurrentMonth = selectedMonth === new Date().getMonth() + 1 && selectedYear === new Date().getFullYear()

    // حسابات ملخص الشهر
    const presentDays = monthRecords.filter(r => r.status === 'present' || r.status === 'late').length
    const absentDays = monthRecords.filter(r => r.status === 'absent').length
    const leaveDays = monthRecords.filter(r => r.status === 'leave').length
    const totalHours = monthRecords.reduce((sum, r) => sum + (r.work_hours || 0), 0)

    const hasCheckedIn = todayRecord?.check_in_time != null
    const hasCheckedOut = todayRecord?.check_out_time != null

    const formatTime = (iso: string | null) => {
        if (!iso) return '—'
        return new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    }

    const monthNames = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ]

    const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
        present: { label: 'حاضر', color: 'text-green-700', bg: 'bg-green-100' },
        absent: { label: 'غائب', color: 'text-red-700', bg: 'bg-red-100' },
        late: { label: 'متأخر', color: 'text-amber-700', bg: 'bg-amber-100' },
        leave: { label: 'إجازة', color: 'text-blue-700', bg: 'bg-blue-100' },
        holiday: { label: 'عطلة', color: 'text-purple-700', bg: 'bg-purple-100' },
    }

    return (
        <TechLayout isLeader={status.isLeader} routeName={undefined}>
            <div className="p-4 space-y-4">
                {/* Header + Worker Name */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Clock className="w-6 h-6 text-blue-600" />
                            الحضور والانصراف
                        </h2>
                        {status.workerName && (
                            <p className="text-sm text-gray-500 mt-1 mr-8">
                                {status.workerName}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={loadAll}
                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                        <RefreshCw className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                {/* View Toggle */}
                <div className="flex bg-gray-100 rounded-xl p-1">
                    <button
                        onClick={() => setView('today')}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${view === 'today'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500'
                            }`}
                    >
                        اليوم
                    </button>
                    <button
                        onClick={() => setView('month')}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${view === 'month'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500'
                            }`}
                    >
                        الشهر
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                ) : view === 'today' ? (
                    <>
                        {/* Today Status Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                            <div className="text-center">
                                <p className="text-sm text-gray-500">
                                    {new Date().toLocaleDateString('ar-EG', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                </p>

                                {/* Status Badge */}
                                {todayRecord ? (
                                    <div className="mt-3">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusLabels[todayRecord.status]?.bg || 'bg-gray-100'
                                            } ${statusLabels[todayRecord.status]?.color || 'text-gray-600'}`}>
                                            {hasCheckedIn && !hasCheckedOut && (
                                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                            )}
                                            {statusLabels[todayRecord.status]?.label || todayRecord.status}
                                        </span>
                                    </div>
                                ) : (
                                    <p className="mt-3 text-gray-400 text-sm">لم يتم تسجيل الحضور بعد</p>
                                )}
                            </div>

                            {/* Times */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className={`rounded-xl p-4 text-center ${hasCheckedIn ? 'bg-green-50 border border-green-100' : 'bg-gray-50'
                                    }`}>
                                    <LogIn className={`w-5 h-5 mx-auto mb-1 ${hasCheckedIn ? 'text-green-600' : 'text-gray-400'
                                        }`} />
                                    <p className="text-xs text-gray-500">وقت الحضور</p>
                                    <p className={`text-lg font-bold mt-1 ${hasCheckedIn ? 'text-green-700' : 'text-gray-300'
                                        }`}>
                                        {formatTime(todayRecord?.check_in_time || null)}
                                    </p>
                                </div>
                                <div className={`rounded-xl p-4 text-center ${hasCheckedOut ? 'bg-red-50 border border-red-100' : 'bg-gray-50'
                                    }`}>
                                    <LogOut className={`w-5 h-5 mx-auto mb-1 ${hasCheckedOut ? 'text-red-600' : 'text-gray-400'
                                        }`} />
                                    <p className="text-xs text-gray-500">وقت الانصراف</p>
                                    <p className={`text-lg font-bold mt-1 ${hasCheckedOut ? 'text-red-700' : 'text-gray-300'
                                        }`}>
                                        {formatTime(todayRecord?.check_out_time || null)}
                                    </p>
                                </div>
                            </div>

                            {/* Work Hours */}
                            {todayRecord?.work_hours != null && (
                                <div className="bg-blue-50 rounded-xl p-3 flex items-center justify-center gap-2 border border-blue-100">
                                    <Timer className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-medium text-blue-700">
                                        ساعات العمل: {todayRecord.work_hours.toFixed(1)} ساعة
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* GPS Info + Proximity */}
                        {(gpsPosition || gpsError || gpsLoading || proximityMessage) && (
                            <div className="space-y-2">
                                {(gpsPosition || gpsError || gpsLoading) && (
                                    <div className={`rounded-xl p-3 text-sm flex items-center gap-2 ${gpsError
                                        ? 'bg-red-50 text-red-600 border border-red-100'
                                        : 'bg-blue-50 text-blue-600 border border-blue-100'
                                        }`}>
                                        {gpsLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>جارى تحديد الموقع...</span>
                                            </>
                                        ) : gpsError ? (
                                            <>
                                                <AlertCircle className="w-4 h-4" />
                                                <span>{gpsError}</span>
                                            </>
                                        ) : gpsPosition ? (
                                            <>
                                                <MapPin className="w-4 h-4" />
                                                <span>
                                                    الموقع: {gpsPosition.lat.toFixed(5)}, {gpsPosition.lng.toFixed(5)}
                                                    {gpsPosition.accuracy && ` (±${gpsPosition.accuracy}م)`}
                                                </span>
                                            </>
                                        ) : null}
                                    </div>
                                )}

                                {/* Proximity Status */}
                                {proximityMessage && (
                                    <div className={`rounded-xl p-3 text-sm flex items-center gap-2 ${proximityMessage.includes('✅')
                                        ? 'bg-green-50 text-green-700 border border-green-100'
                                        : proximityMessage.includes('⚠️')
                                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                            : 'bg-blue-50 text-blue-600 border border-blue-100'
                                        }`}>
                                        <Shield className="w-4 h-4 flex-shrink-0" />
                                        <span>{proximityMessage}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-3">
                            {!hasCheckedIn ? (
                                <button
                                    onClick={handleCheckIn}
                                    disabled={actionLoading || !workerId}
                                    className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-2xl text-lg font-bold shadow-lg shadow-green-500/30 hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:transform-none"
                                >
                                    {actionLoading ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <LogIn className="w-6 h-6" />
                                    )}
                                    {actionLoading ? 'جارى التسجيل...' : 'تسجيل الحضور'}
                                </button>
                            ) : !hasCheckedOut ? (
                                <button
                                    onClick={() => setShowCheckOutConfirm(true)}
                                    disabled={actionLoading}
                                    className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-red-500 to-red-600 text-white py-4 rounded-2xl text-lg font-bold shadow-lg shadow-red-500/30 hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:transform-none"
                                >
                                    {actionLoading ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <LogOut className="w-6 h-6" />
                                    )}
                                    {actionLoading ? 'جارى التسجيل...' : 'تسجيل الانصراف'}
                                </button>
                            ) : (
                                <div className="text-center py-4 bg-gray-50 rounded-2xl">
                                    <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
                                    <p className="text-green-700 font-semibold">تم تسجيل الحضور والانصراف لليوم ✅</p>
                                </div>
                            )}
                        </div>

                        {!workerId && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-sm text-amber-700">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>لم يتم ربط حسابك بعامل — تواصل مع الإدارة</span>
                            </div>
                        )}
                    </>
                ) : (
                    /* Monthly Summary */
                    <div className="space-y-4">
                        {/* Month Selector */}
                        <div className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                            <button
                                onClick={goToPreviousMonth}
                                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <ChevronRight className="w-5 h-5 text-gray-600" />
                            </button>
                            <span className="text-sm font-semibold text-gray-800">
                                {monthNames[selectedMonth - 1]} {selectedYear}
                            </span>
                            <button
                                onClick={goToNextMonth}
                                disabled={isCurrentMonth}
                                className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30"
                            >
                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>

                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                                <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mb-1" />
                                <p className="text-2xl font-bold text-green-600">{presentDays}</p>
                                <p className="text-xs text-gray-500">يوم حضور</p>
                            </div>
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                                <XCircle className="w-5 h-5 text-red-500 mx-auto mb-1" />
                                <p className="text-2xl font-bold text-red-600">{absentDays}</p>
                                <p className="text-xs text-gray-500">يوم غياب</p>
                            </div>
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                                <Calendar className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                                <p className="text-2xl font-bold text-blue-600">{leaveDays}</p>
                                <p className="text-xs text-gray-500">يوم إجازة</p>
                            </div>
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                                <Timer className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                                <p className="text-2xl font-bold text-purple-600">{totalHours.toFixed(1)}</p>
                                <p className="text-xs text-gray-500">ساعة عمل</p>
                            </div>
                        </div>

                        {/* Records List */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 border-b border-gray-100">
                                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-blue-500" />
                                    سجل {monthNames[selectedMonth - 1]} {selectedYear}
                                </h3>
                            </div>
                            {monthRecords.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                    <p>لا توجد سجلات لهذا الشهر</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {monthRecords.map((record) => {
                                        const st = statusLabels[record.status] || statusLabels.present
                                        return (
                                            <div key={record.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-medium text-gray-700 w-16">
                                                        {new Date(record.date).toLocaleDateString('ar-EG', {
                                                            day: 'numeric',
                                                            weekday: 'short',
                                                        })}
                                                    </span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.bg} ${st.color}`}>
                                                        {st.label}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                                    <span>{formatTime(record.check_in_time)}</span>
                                                    <span>←</span>
                                                    <span>{formatTime(record.check_out_time)}</span>
                                                    {record.work_hours != null && (
                                                        <span className="text-blue-600 font-medium">
                                                            ({record.work_hours.toFixed(1)}س)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Check-Out Confirmation Modal */}
            {showCheckOutConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
                    onClick={() => setShowCheckOutConfirm(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="text-center">
                            <div className="w-14 h-14 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-3">
                                <LogOut className="w-7 h-7 text-red-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">تأكيد تسجيل الانصراف</h3>
                            <p className="text-sm text-gray-500 mt-2">
                                هل أنت متأكد من تسجيل الانصراف؟
                                <br />
                                <span className="text-red-500 font-medium">لا يمكن التراجع عن هذا الإجراء</span>
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleCheckOut}
                                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors"
                            >
                                تأكيد الانصراف
                            </button>
                            <button
                                onClick={() => setShowCheckOutConfirm(false)}
                                className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </TechLayout>
    )
}

export default TechAttendancePage
