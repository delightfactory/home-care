// useTechnicianData - Hook لإدارة بيانات الفنى
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { TechnicianAPI, TechnicianOrder, TechnicianProgress, TechnicianStatus } from '../api/technician'
import { RouteWithOrders } from '../types'
import toast from 'react-hot-toast'

const PENDING_COLLECTION_KEY = 'tech_pending_collection_order'

interface UseTechnicianDataReturn {
    // البيانات
    route: RouteWithOrders | null
    currentOrder: TechnicianOrder | null
    progress: TechnicianProgress

    // حالة الفني
    status: TechnicianStatus

    // حالات التحميل
    loading: boolean
    orderLoading: boolean

    // الأخطاء
    error: string | null

    // الإجراءات
    startOrder: () => Promise<void>
    completeOrder: () => Promise<void>
    moveToNextOrder: () => Promise<void>
    refresh: () => Promise<void>
}

export const useTechnicianData = (): UseTechnicianDataReturn => {
    const { user } = useAuth()

    // البيانات
    const [route, setRoute] = useState<RouteWithOrders | null>(null)
    const [currentOrder, setCurrentOrder] = useState<TechnicianOrder | null>(null)
    const [progress, setProgress] = useState<TechnicianProgress>({ completed: 0, total: 0, percentage: 0 })

    // حالة الفني
    const [status, setStatus] = useState<TechnicianStatus>({
        workerId: null,
        workerName: null,
        teamId: null,
        teamName: null,
        isTeamMember: false,
        isLeader: false,
        hasLeader: false,
        leaderName: null,
        teamMembers: []
    })

    // حالات التحميل
    const [loading, setLoading] = useState(true)
    const [orderLoading, setOrderLoading] = useState(false)

    // الأخطاء
    const [error, setError] = useState<string | null>(null)

    // جلب جميع البيانات
    const fetchData = useCallback(async () => {
        if (!user?.id) {
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            setError(null)

            // جلب حالة الفني أولاً
            const techStatus = await TechnicianAPI.getTechnicianStatus(user.id)
            setStatus(techStatus)

            // إذا لم يكن عضواً في فريق، لا داعي لجلب الباقي
            if (!techStatus.isTeamMember) {
                setRoute(null)
                setCurrentOrder(null)
                setProgress({ completed: 0, total: 0, percentage: 0 })
                return
            }

            // جلب خط السير
            const todayRoute = await TechnicianAPI.getMyTodayRoute(user.id)
            setRoute(todayRoute)

            if (todayRoute) {
                // ✅ التحقق من وجود طلب بانتظار التحصيل فى localStorage
                const pendingOrderId = localStorage.getItem(PENDING_COLLECTION_KEY)

                let order: TechnicianOrder | null = null

                if (pendingOrderId && techStatus.isLeader) {
                    // جلب الطلب المكتمل الذي ينتظر التحصيل
                    order = await TechnicianAPI.getOrderById(pendingOrderId, true)

                    // إذا لم يعد الطلب موجوداً أو لم يعد مكتملاً — حذف المفتاح
                    if (!order || order.status !== 'completed') {
                        localStorage.removeItem(PENDING_COLLECTION_KEY)
                        order = null
                    }
                }

                // إذا لم يكن هناك طلب معلق — جلب الطلب التالى بالتسلسل
                if (!order) {
                    order = await TechnicianAPI.getCurrentOrder(todayRoute.id, techStatus.isLeader)
                }

                const prog = await TechnicianAPI.getTodayProgress(todayRoute.id)
                setCurrentOrder(order)
                setProgress(prog)
            } else {
                setCurrentOrder(null)
                setProgress({ completed: 0, total: 0, percentage: 0 })
            }
        } catch (err) {
            console.error('Error fetching technician data:', err)
            setError('حدث خطأ فى جلب البيانات')
        } finally {
            setLoading(false)
        }
    }, [user?.id])

    // جلب البيانات عند التحميل
    useEffect(() => {
        fetchData()
    }, [fetchData])

    // بدء العمل على الطلب
    const startOrder = useCallback(async () => {
        if (!currentOrder) return

        try {
            setOrderLoading(true)
            const result = await TechnicianAPI.startOrder(currentOrder.id)

            if (result.success) {
                toast.success('تم بدء العمل على الطلب')
                // تحديث الحالة محلياً لتفادى إعادة التحميل
                setCurrentOrder(prev => prev ? { ...prev, status: 'in_progress' } : null)
            } else {
                toast.error(result.error || 'حدث خطأ')
            }
        } catch (err) {
            console.error('Error starting order:', err)
            toast.error('حدث خطأ فى بدء الطلب')
        } finally {
            setOrderLoading(false)
        }
    }, [currentOrder])

    // إكمال الطلب — يبقى الطلب ظاهراً كـ completed لعرض الفاتورة
    const completeOrder = useCallback(async () => {
        if (!currentOrder || !route) return

        try {
            setOrderLoading(true)
            const result = await TechnicianAPI.completeOrder(currentOrder.id)

            if (result.success) {
                toast.success('تم إكمال الطلب بنجاح — قم بتحصيل الفاتورة')

                // ✅ حفظ معرف الطلب فى localStorage ليستمر بعد الريفريش
                localStorage.setItem(PENDING_COLLECTION_KEY, currentOrder.id)

                // ✅ تحديث الحالة محلياً لـ completed — يبقى الطلب ظاهراً لعرض الفاتورة
                setCurrentOrder(prev => prev ? { ...prev, status: 'completed' } : null)

                // تحديث التقدم
                const newProgress = await TechnicianAPI.getTodayProgress(route.id)
                setProgress(newProgress)
            } else {
                toast.error(result.error || 'حدث خطأ')
            }
        } catch (err) {
            console.error('Error completing order:', err)
            toast.error('حدث خطأ فى إكمال الطلب')
        } finally {
            setOrderLoading(false)
        }
    }, [currentOrder, route])

    // الانتقال للطلب التالى — بعد التحصيل أو التخطي
    const moveToNextOrder = useCallback(async () => {
        if (!route) return

        try {
            setOrderLoading(true)

            // ✅ حذف المفتاح من localStorage
            localStorage.removeItem(PENDING_COLLECTION_KEY)

            // عرض شاشة النجاح لثانيتين
            setCurrentOrder(null)
            await new Promise(resolve => setTimeout(resolve, 2000))

            // جلب الطلب التالى
            const [newOrder, newProgress] = await Promise.all([
                TechnicianAPI.getCurrentOrder(route.id, status.isLeader),
                TechnicianAPI.getTodayProgress(route.id)
            ])

            setCurrentOrder(newOrder)
            setProgress(newProgress)

            if (!newOrder) {
                toast.success('🎉 أحسنت! أنهيت جميع طلبات اليوم', { duration: 5000 })
            }
        } catch (err) {
            console.error('Error moving to next order:', err)
            toast.error('حدث خطأ فى تحميل الطلب التالي')
        } finally {
            setOrderLoading(false)
        }
    }, [route, status.isLeader])

    // تحديث البيانات
    const refresh = useCallback(async () => {
        await fetchData()
    }, [fetchData])

    return {
        route,
        currentOrder,
        progress,
        status,
        loading,
        orderLoading,
        error,
        startOrder,
        completeOrder,
        moveToNextOrder,
        refresh
    }
}

export default useTechnicianData
