// BonusesTab — تبويب الحوافز المحسوبة
import React, { useState, useCallback } from 'react'
import { Award, Loader2, Search } from 'lucide-react'
import { BonusesAPI, WorkerBonus } from '../../api/bonuses'
import { WorkersAPI } from '../../api/workers'
import toast from 'react-hot-toast'

interface WorkerBonusWithName extends WorkerBonus {
    worker_name?: string
}

const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

const BonusesTab: React.FC = () => {
    const now = new Date()
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(now.getFullYear())
    const [bonuses, setBonuses] = useState<WorkerBonusWithName[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)

    const loadBonuses = useCallback(async () => {
        setLoading(true)
        setSearched(true)
        try {
            const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
            const [bonusData, workers] = await Promise.all([
                BonusesAPI.getWorkerBonuses(monthStr),
                WorkersAPI.getWorkers()
            ])

            const workerMap = new Map(workers.map(w => [w.id, w.name]))

            const enriched: WorkerBonusWithName[] = bonusData.map(b => ({
                ...b,
                worker_name: workerMap.get(b.worker_id) || 'غير معروف'
            }))

            setBonuses(enriched)
        } catch (err: any) {
            toast.error(err.message || 'خطأ فى تحميل الحوافز')
        } finally {
            setLoading(false)
        }
    }, [selectedMonth, selectedYear])

    const totalBaseBonus = bonuses.reduce((s, b) => s + (b.base_bonus || 0), 0)

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-end justify-between">
                <div className="flex gap-2 items-end flex-wrap">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">الشهر</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                        >
                            {months.map((m, i) => (
                                <option key={i + 1} value={i + 1}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">السنة</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={loadBonuses}
                        disabled={loading}
                        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        عرض الحوافز
                    </button>
                </div>

                {searched && bonuses.length > 0 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-2 text-center">
                        <p className="text-xs text-purple-600">إجمالى الحوافز</p>
                        <p className="font-bold text-purple-800 text-lg">{formatCurrency(totalBaseBonus)} ج.م</p>
                    </div>
                )}
            </div>

            {/* Results */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
            ) : !searched ? (
                <div className="text-center py-12 text-gray-400">
                    <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>اختر الشهر واضغط "عرض الحوافز"</p>
                </div>
            ) : bonuses.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>لا توجد حوافز لهذا الشهر</p>
                    <p className="text-xs mt-1">تأكد من وجود طلبات مكتملة فى هذا الشهر</p>
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="text-right py-3 px-4 font-medium text-gray-600">العامل</th>
                                    <th className="text-center py-3 px-3 font-medium text-gray-600 whitespace-nowrap">أيام العمل</th>
                                    <th className="text-center py-3 px-3 font-medium text-gray-600 whitespace-nowrap hidden sm:table-cell">إيراد الشهر</th>
                                    <th className="text-center py-3 px-3 font-medium text-gray-600 whitespace-nowrap hidden sm:table-cell">الحد الأدنى</th>
                                    <th className="text-center py-3 px-3 font-medium text-gray-600 whitespace-nowrap hidden md:table-cell">الفائض</th>
                                    <th className="text-center py-3 px-3 font-medium text-gray-600 whitespace-nowrap">الحافز</th>
                                    <th className="text-center py-3 px-3 font-medium text-gray-600 whitespace-nowrap hidden lg:table-cell">التقييم</th>
                                    <th className="text-center py-3 px-3 font-medium text-gray-600 whitespace-nowrap hidden lg:table-cell">بدون تقييم</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {bonuses.map((b) => (
                                    <tr key={b.worker_id} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-3 px-4 font-medium text-gray-900">{b.worker_name}</td>
                                        <td className="py-3 px-3 text-center text-gray-700">{b.days_worked}</td>
                                        <td className="py-3 px-3 text-center text-gray-700 hidden sm:table-cell">{formatCurrency(b.monthly_contribution)}</td>
                                        <td className="py-3 px-3 text-center text-gray-500 hidden sm:table-cell">{formatCurrency(b.monthly_min)}</td>
                                        <td className="py-3 px-3 text-center hidden md:table-cell">
                                            <span className={`font-semibold ${b.net_above_min > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                {b.net_above_min > 0 ? `+${formatCurrency(b.net_above_min)}` : '0'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            <span className="font-bold text-purple-700">
                                                {formatCurrency(b.base_bonus)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-center hidden lg:table-cell">
                                            {b.avg_rating !== null ? (
                                                <span className="flex items-center justify-center gap-1">
                                                    <span className="text-amber-500">★</span>
                                                    <span>{b.avg_rating.toFixed(1)}</span>
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-center hidden lg:table-cell">
                                            {b.unrated_orders > 0 ? (
                                                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                                    {b.unrated_orders}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">0</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="border-t-2 border-gray-300">
                                <tr className="font-bold bg-gray-50">
                                    <td className="py-3 px-4 text-gray-900">الإجمالي ({bonuses.length} عامل)</td>
                                    <td className="py-3 px-3 text-center">
                                        {bonuses.reduce((s, b) => s + b.days_worked, 0)}
                                    </td>
                                    <td className="py-3 px-3 text-center hidden sm:table-cell">
                                        {formatCurrency(bonuses.reduce((s, b) => s + b.monthly_contribution, 0))}
                                    </td>
                                    <td className="py-3 px-3 hidden sm:table-cell">—</td>
                                    <td className="py-3 px-3 text-center hidden md:table-cell text-green-600">
                                        {formatCurrency(bonuses.reduce((s, b) => s + b.net_above_min, 0))}
                                    </td>
                                    <td className="py-3 px-3 text-center text-purple-700">
                                        {formatCurrency(totalBaseBonus)}
                                    </td>
                                    <td className="py-3 px-3 hidden lg:table-cell">—</td>
                                    <td className="py-3 px-3 hidden lg:table-cell">—</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

export default BonusesTab
