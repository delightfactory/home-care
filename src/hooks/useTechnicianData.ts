// useTechnicianData - Hook لإدارة بيانات الفنى
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { TechnicianAPI, TechnicianOrder, TechnicianProgress, TechnicianStatus } from '../api/technician'
import { RouteWithOrders } from '../types'
import toast from 'react-hot-toast'

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
        teamId: null,
        teamName: null,
        isTeamMember: false,
        isLeader: false,
        hasLeader: false,
        leaderName: null
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
                // جلب الطلب الحالى والتقدم بالتوازى
                const [order, prog] = await Promise.all([
                    TechnicianAPI.getCurrentOrder(todayRoute.id, techStatus.isLeader),
                    TechnicianAPI.getTodayProgress(todayRoute.id)
                ])

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

    // إكمال الطلب
    const completeOrder = useCallback(async () => {
        if (!currentOrder || !route) return

        try {
            setOrderLoading(true)
            const result = await TechnicianAPI.completeOrder(currentOrder.id)

            if (result.success) {
                toast.success('تم إكمال الطلب بنجاح')

                // ⏳ تأخير 2.5 ثانية لعرض شاشة النجاح ومنع الضغط الخاطئ
                setCurrentOrder(null) // إخفاء الطلب الحالي لعرض شاشة النجاح

                await new Promise(resolve => setTimeout(resolve, 2500))

                // إعادة جلب البيانات للحصول على الطلب التالى
                const [newOrder, newProgress] = await Promise.all([
                    TechnicianAPI.getCurrentOrder(route.id, status.isLeader),
                    TechnicianAPI.getTodayProgress(route.id)
                ])

                setCurrentOrder(newOrder)
                setProgress(newProgress)

                // إذا لم يعد هناك طلبات
                if (!newOrder) {
                    toast.success('🎉 أحسنت! أنهيت جميع طلبات اليوم', { duration: 5000 })
                }
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
        refresh
    }
}

export default useTechnicianData
