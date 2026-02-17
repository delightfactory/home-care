// CompanyLocationsTab — إدارة مواقع الشركة (GPS)
import React, { useState, useEffect, useCallback } from 'react'
import {
    MapPin, Plus, RefreshCw, Loader2,
    X, Trash2, Edit2, ToggleLeft, ToggleRight
} from 'lucide-react'
import { CompanyLocationsAPI } from '../../api/hr'
import type { CompanyLocation, CompanyLocationInsert } from '../../types/hr.types'
import toast from 'react-hot-toast'

const CompanyLocationsTab: React.FC = () => {
    const [locations, setLocations] = useState<CompanyLocation[]>([])
    const [loading, setLoading] = useState(true)

    const [showModal, setShowModal] = useState(false)
    const [editId, setEditId] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    const [formName, setFormName] = useState('')
    const [formNameAr, setFormNameAr] = useState('')
    const [formLat, setFormLat] = useState('')
    const [formLng, setFormLng] = useState('')
    const [formRadius, setFormRadius] = useState('200')
    const [formWorkStartTime, setFormWorkStartTime] = useState('09:00')

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const data = await CompanyLocationsAPI.getLocations()
            setLocations(data)
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    const resetForm = () => {
        setEditId(null)
        setFormName('')
        setFormNameAr('')
        setFormLat('')
        setFormLng('')
        setFormRadius('200')
        setFormWorkStartTime('09:00')
    }

    const handleEdit = (loc: CompanyLocation) => {
        setEditId(loc.id)
        setFormName(loc.name)
        setFormNameAr(loc.name_ar)
        setFormLat(loc.latitude.toString())
        setFormLng(loc.longitude.toString())
        setFormRadius(loc.radius_meters.toString())
        setFormWorkStartTime(loc.work_start_time?.substring(0, 5) || '09:00')
        setShowModal(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const lat = parseFloat(formLat)
        const lng = parseFloat(formLng)
        const radius = parseInt(formRadius)

        if (!formName || !formNameAr || isNaN(lat) || isNaN(lng) || isNaN(radius)) {
            toast.error('أكمل جميع البيانات المطلوبة بشكل صحيح')
            return
        }

        setSubmitting(true)
        try {
            if (editId) {
                const result = await CompanyLocationsAPI.updateLocation(editId, {
                    name: formName,
                    name_ar: formNameAr,
                    latitude: lat,
                    longitude: lng,
                    radius_meters: radius,
                    work_start_time: formWorkStartTime + ':00',
                })
                if (result.success) {
                    toast.success('تم تحديث الموقع بنجاح')
                } else {
                    toast.error(result.error || 'حدث خطأ')
                }
            } else {
                const insertData: CompanyLocationInsert = {
                    name: formName,
                    name_ar: formNameAr,
                    latitude: lat,
                    longitude: lng,
                    radius_meters: radius,
                    work_start_time: formWorkStartTime + ':00',
                }
                const result = await CompanyLocationsAPI.createLocation(insertData)
                if (result.success) {
                    toast.success('تم إضافة الموقع بنجاح')
                } else {
                    toast.error(result.error || 'حدث خطأ')
                }
            }

            setShowModal(false)
            resetForm()
            loadData()
        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('هل تريد حذف هذا الموقع؟')) return

        const result = await CompanyLocationsAPI.deleteLocation(id)
        if (result.success) {
            toast.success('تم حذف الموقع')
            loadData()
        } else {
            toast.error(result.error || 'حدث خطأ')
        }
    }

    const handleToggle = async (loc: CompanyLocation) => {
        const result = await CompanyLocationsAPI.updateLocation(loc.id, {
            is_active: !loc.is_active,
        })
        if (result.success) {
            toast.success(loc.is_active ? 'تم إلغاء تفعيل الموقع' : 'تم تفعيل الموقع')
            loadData()
        } else {
            toast.error(result.error || 'حدث خطأ')
        }
    }

    const useCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast.error('الموقع الجغرافى غير مدعوم')
            return
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setFormLat(pos.coords.latitude.toFixed(7))
                setFormLng(pos.coords.longitude.toFixed(7))
                toast.success('تم تحديد الموقع الحالى')
            },
            () => toast.error('تعذر تحديد الموقع'),
            { enableHighAccuracy: true, timeout: 10000 }
        )
    }

    const activeCount = locations.filter(l => l.is_active).length

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex gap-3 items-center">
                    <span className="text-sm text-gray-500">
                        إجمالى: <span className="font-semibold text-gray-700">{locations.length}</span>
                        {' · '}
                        نشط: <span className="font-semibold text-green-600">{activeCount}</span>
                    </span>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={loadData}
                        className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => { resetForm(); setShowModal(true) }}
                        className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span>موقع جديد</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
                </div>
            ) : locations.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>لا توجد مواقع مسجلة</p>
                    <p className="text-sm mt-1">أضف مواقع الشركة لتفعيل التحقق من الحضور بالـ GPS</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-right py-3 px-3 font-medium text-gray-600">الاسم</th>
                                <th className="text-right py-3 px-3 font-medium text-gray-600 hidden sm:table-cell">الاسم (عربى)</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600 hidden md:table-cell">الإحداثيات</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600">نصف القطر</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600 hidden md:table-cell">بداية الدوام</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600">الحالة</th>
                                <th className="text-center py-3 px-3 font-medium text-gray-600">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {locations.map((loc) => (
                                <tr key={loc.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="py-3 px-3 font-medium text-gray-900">
                                        {loc.name}
                                    </td>
                                    <td className="py-3 px-3 text-gray-600 hidden sm:table-cell">
                                        {loc.name_ar}
                                    </td>
                                    <td className="py-3 px-3 text-center text-gray-500 text-xs hidden md:table-cell font-mono">
                                        {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                                    </td>
                                    <td className="py-3 px-3 text-center text-gray-600">
                                        {loc.radius_meters}م
                                    </td>
                                    <td className="py-3 px-3 text-center text-gray-600 hidden md:table-cell">
                                        {loc.work_start_time?.substring(0, 5) || '09:00'}
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                        <button
                                            onClick={() => handleToggle(loc)}
                                            className="inline-flex items-center gap-1"
                                            title={loc.is_active ? 'إلغاء التفعيل' : 'تفعيل'}
                                        >
                                            {loc.is_active ? (
                                                <ToggleRight className="w-6 h-6 text-green-500" />
                                            ) : (
                                                <ToggleLeft className="w-6 h-6 text-gray-400" />
                                            )}
                                        </button>
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => handleEdit(loc)}
                                                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="تعديل"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(loc.id)}
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="حذف"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editId ? 'تعديل الموقع' : 'موقع جديد'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">الاسم (إنجليزى) *</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    required
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500"
                                    placeholder="Main Office"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">الاسم (عربى) *</label>
                                <input
                                    type="text"
                                    value={formNameAr}
                                    onChange={(e) => setFormNameAr(e.target.value)}
                                    required
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500"
                                    placeholder="المقر الرئيسى"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">خط العرض *</label>
                                    <input
                                        type="number"
                                        value={formLat}
                                        onChange={(e) => setFormLat(e.target.value)}
                                        step="0.0000001"
                                        required
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500"
                                        placeholder="30.0444"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">خط الطول *</label>
                                    <input
                                        type="number"
                                        value={formLng}
                                        onChange={(e) => setFormLng(e.target.value)}
                                        step="0.0000001"
                                        required
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500"
                                        placeholder="31.2357"
                                    />
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={useCurrentLocation}
                                className="w-full flex items-center justify-center gap-2 border border-teal-200 text-teal-700 bg-teal-50 px-3 py-2 rounded-lg text-sm font-medium hover:bg-teal-100 transition-colors"
                            >
                                <MapPin className="w-4 h-4" />
                                استخدام الموقع الحالى
                            </button>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">نصف القطر (بالمتر)</label>
                                <input
                                    type="number"
                                    value={formRadius}
                                    onChange={(e) => setFormRadius(e.target.value)}
                                    min="50"
                                    max="5000"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500"
                                    placeholder="200"
                                />
                                <p className="text-xs text-gray-400 mt-1">المسافة المسموحة لتسجيل الحضور (افتراضى: 200 متر)</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">وقت بداية الدوام</label>
                                <input
                                    type="time"
                                    value={formWorkStartTime}
                                    onChange={(e) => setFormWorkStartTime(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500"
                                />
                                <p className="text-xs text-gray-400 mt-1">يُستخدم لحساب التأخير تلقائياً عند تسجيل الحضور (افتراضى: 09:00)</p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 bg-teal-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {submitting ? 'جارِ الحفظ...' : editId ? 'تحديث' : 'إضافة'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
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

export default CompanyLocationsTab
