// useTechnicianData - Hook لإدارة بيانات الفنى + فحص الحضور + انصراف تلقائى + real-time
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { TechnicianAPI, TechnicianOrder, TechnicianProgress, TechnicianStatus } from '../api/technician'
import { AttendanceAPI } from '../api/hr'
import { RouteWithOrders } from '../types'
import type { AttendanceRecord } from '../types/hr.types'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

interface AttendanceState {
    checkedIn: boolean
    checkedOut: boolean
    todayRecord: AttendanceRecord | null
    loading: boolean
}

interface UseTechnicianDataReturn {
    // البيانات
    route: RouteWithOrders | null
    currentOrder: TechnicianOrder | null
    progress: TechnicianProgress

    // حالة الفني
    status: TechnicianStatus

    // حالة الحضور
    attendance: AttendanceState

    // حالات التحميل
    loading: boolean
    orderLoading: boolean
    refreshing: boolean

    // الأخطاء
    error: string | null

    // هل أنهى كل الطلبات
    allOrdersDone: boolean

    // الإجراءات
    startOrder: () => Promise<void>
    completeOrder: () => Promise<void>
    moveToNextOrder: () => Promise<void>
    skipCollection: () => Promise<void>
    refresh: () => Promise<void>
    refreshAttendance: () => Promise<void>
}

export const useTechnicianData = (): UseTechnicianDataReturn => {
    const { user } = useAuth()

    const [route, setRoute] = useState<RouteWithOrders | null>(null)
    const [currentOrder, setCurrentOrder] = useState<TechnicianOrder | null>(null)
    const [progress, setProgress] = useState<TechnicianProgress>({ completed: 0, total: 0, percentage: 0 })
    const [allOrdersDone, setAllOrdersDone] = useState(false)

    // قراءة القيم المحفوظة من sessionStorage لمنع flickering الناف بار
    const cachedIsLeader = sessionStorage.getItem('tech_isLeader') === 'true'
    const cachedIsTeamMember = sessionStorage.getItem('tech_isTeamMember') === 'true'

    const [status, setStatus] = useState<TechnicianStatus>({
        workerId: null,
        workerName: null,
        teamId: null,
        teamName: null,
        isTeamMember: cachedIsTeamMember,
        isLeader: cachedIsLeader,
        hasLeader: false,
        leaderName: null,
        teamMembers: []
    })

    const [attendance, setAttendance] = useState<AttendanceState>({
        checkedIn: false,
        checkedOut: false,
        todayRecord: null,
        loading: true
    })

    const [loading, setLoading] = useState(true)
    const [orderLoading, setOrderLoading] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const fetchSequence = useRef(0)
    const loadedUserId = useRef<string | null>(null)
    const currentUserId = useRef(user?.id)
    currentUserId.current = user?.id

    // فحص حالة الحضور
    const checkAttendance = useCallback(async (wId: string) => {
        setAttendance(prev => ({ ...prev, loading: true }))
        try {
            const record = await AttendanceAPI.getTodayAttendance(wId)
            setAttendance({
                checkedIn: record?.check_in_time != null,
                checkedOut: record?.check_out_time != null,
                todayRecord: record,
                loading: false
            })
            return record
        } catch {
            setAttendance(prev => ({ ...prev, loading: false }))
            return null
        }
    }, [])

    // تحديث حالة الحضور
    const refreshAttendance = useCallback(async () => {
        if (status.workerId) {
            await checkAttendance(status.workerId)
        }
    }, [status.workerId, checkAttendance])

    // جلب جميع البيانات
    const fetchData = useCallback(async (background = false) => {
        const sequence = ++fetchSequence.current
        const userId = user?.id
        const isCurrent = () => sequence === fetchSequence.current && currentUserId.current === userId
        const keepScreen = background && loadedUserId.current === userId
        let refreshed = false
        if (!user?.id) {
            setLoading(false)
            return
        }

        try {
            // Returning from the camera/gallery must not unmount the collection form.
            if (!keepScreen) setLoading(true)
            setRefreshing(true)
            setError(null)

            const techStatus = await TechnicianAPI.getTechnicianStatus(user.id)
            if (!isCurrent()) return
            let record: AttendanceRecord | null | undefined
            if (techStatus.isTeamMember && techStatus.workerId) {
                try { record = await AttendanceAPI.getTodayAttendance(techStatus.workerId) } catch { /* Keep the last attendance state on read failure. */ }
            }
            const todayRoute = techStatus.isTeamMember ? await TechnicianAPI.getMyTodayRoute(user.id) : null
            const order = todayRoute ? await TechnicianAPI.getCurrentOrder(todayRoute.id, techStatus.isLeader) : null
            const prog = todayRoute ? await TechnicianAPI.getTodayProgress(todayRoute.id) : { completed: 0, total: 0, percentage: 0 }
            if (!isCurrent()) return
            setStatus(techStatus)

            // تخزين مؤقت لمنع flickering عند التنقل
            sessionStorage.setItem('tech_isLeader', String(techStatus.isLeader))
            sessionStorage.setItem('tech_isTeamMember', String(techStatus.isTeamMember))

            if (record !== undefined) {
                setAttendance({ checkedIn: record?.check_in_time != null, checkedOut: record?.check_out_time != null, todayRecord: record, loading: false })
            } else if (techStatus.isTeamMember && techStatus.workerId) {
                setAttendance(previous => ({ ...previous, loading: false }))
            }
            setRoute(todayRoute)
            setCurrentOrder(order)
            setProgress(prog)
            setAllOrdersDone(!order && prog.total > 0 && prog.completed === prog.total)
            loadedUserId.current = userId || null
            refreshed = true
        } catch (err) {
            if (!isCurrent()) return
            console.error('Error fetching technician data:', err)
            if (keepScreen) toast.error('تعذر تحديث البيانات؛ بيانات النموذج ما زالت محفوظة. جرّب تحديث البيانات قبل متابعة العملية.')
            else setError('حصل مشكلة فى جلب البيانات — جرّب تانى')
        } finally {
            if (isCurrent()) {
                setLoading(false)
                setRefreshing(keepScreen && !refreshed)
            }
        }
    }, [user?.id])

    const cancelPendingFetch = useCallback(() => { fetchSequence.current++ }, [])
    useEffect(() => {
        fetchData()
        return cancelPendingFetch
    }, [fetchData, cancelPendingFetch])

    // ─── Real-time subscriptions للأوامر والفواتير ─────────────────
    const routeRef = useRef(route)
    const statusRef = useRef(status)
    routeRef.current = route
    statusRef.current = status
    const routeOrderIds = route?.route_orders?.map(link => link.order_id).sort().join(',')

    useEffect(() => {
        if (!route?.id) return

        // These tables are published in the current production publication.
        // A link change reloads the route and therefore rebuilds order filters.
        const linksChannel = supabase.channel(`tech-route-links-${route.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'route_orders', filter: `route_id=eq.${route.id}` }, () => { void fetchData(true) })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'routes', filter: `id=eq.${route.id}` }, () => { void fetchData(true) })
            .subscribe()
        const refreshOnFocus = () => { if (document.visibilityState === 'visible') void fetchData(true) }
        window.addEventListener('focus', refreshOnFocus)
        document.addEventListener('visibilitychange', refreshOnFocus)

        // جلب order_ids المرتبطة بخط السير
        const setupSubscriptions = async () => {
            const { data: routeOrders } = await supabase
                .from('route_orders')
                .select('order_id')
                .eq('route_id', route.id)

            const orderIds = (routeOrders || []).map(ro => ro.order_id)
            if (orderIds.length === 0) return

            // الاشتراك في تغييرات الطلبات (status, payment_status, total_amount)
            const ordersChannel = supabase
                .channel(`tech-orders-${route.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'orders',
                        filter: `id=in.(${orderIds.join(',')})`
                    },
                    async () => {
                        // إعادة جلب الطلب الحالى والتقدم
                        if (!routeRef.current?.id) return
                        const sequence = fetchSequence.current
                        const routeId = routeRef.current.id
                        const [newOrder, newProgress] = await Promise.all([
                            TechnicianAPI.getCurrentOrder(routeId, statusRef.current.isLeader),
                            TechnicianAPI.getTodayProgress(routeId)
                        ])
                        if (disposed || sequence !== fetchSequence.current || routeRef.current?.id !== routeId) return
                        setCurrentOrder(newOrder)
                        setProgress(newProgress)
                        setAllOrdersDone(!newOrder && newProgress.total > 0 && newProgress.completed === newProgress.total)
                    }
                )
                .subscribe()

            // الاشتراك في تغييرات الفواتير المرتبطة بالطلبات
            const invoicesChannel = supabase
                .channel(`tech-invoices-${route.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'invoices',
                    },
                    async (payload) => {
                        // تحقق إذا كانت الفاتورة مرتبطة بأحد طلبات خط السير
                        const changedOrderId = (payload.new as any)?.order_id || (payload.old as any)?.order_id
                        if (!changedOrderId || !orderIds.includes(changedOrderId)) return
                        if (!routeRef.current?.id) return
                        // إعادة جلب الطلب الحالى
                        const sequence = fetchSequence.current
                        const routeId = routeRef.current.id
                        const newOrder = await TechnicianAPI.getCurrentOrder(routeId, statusRef.current.isLeader)
                        if (disposed || sequence !== fetchSequence.current || routeRef.current?.id !== routeId) return
                        setCurrentOrder(newOrder)
                    }
                )
                .subscribe()

            return () => {
                supabase.removeChannel(ordersChannel)
                supabase.removeChannel(invoicesChannel)
            }
        }

        let cleanup: (() => void) | undefined
        let disposed = false
        setupSubscriptions().then(fn => { if (disposed) fn?.(); else cleanup = fn })

        return () => {
            disposed = true
            cleanup?.()
            void supabase.removeChannel(linksChannel)
            window.removeEventListener('focus', refreshOnFocus)
            document.removeEventListener('visibilitychange', refreshOnFocus)
        }
    }, [route?.id, routeOrderIds, fetchData])

    // بدء العمل على الطلب
    const startOrder = useCallback(async () => {
        if (!currentOrder) return
        try {
            setOrderLoading(true)
            const result = await TechnicianAPI.startOrder(currentOrder.id)
            if (result.success) {
                toast.success('يلا بينا! تم بدء الطلب 🚀')
            } else {
                toast.error(result.error || 'حصل مشكلة')
            }
            await fetchData()
        } catch (err) {
            console.error('Error starting order:', err)
            toast.error('حصل مشكلة فى بدء الطلب')
        } finally {
            setOrderLoading(false)
        }
    }, [currentOrder, fetchData])

    // إكمال الطلب
    const completeOrder = useCallback(async () => {
        if (!currentOrder || !route) return
        try {
            setOrderLoading(true)
            const result = await TechnicianAPI.completeOrder(currentOrder.id)
            if (result.success) {
                toast.success('شغل جامد! الطلب خلص — حصّل الفاتورة 🎯')
                setCurrentOrder(prev => prev ? { ...prev, status: 'completed' } : null)
                const newProgress = await TechnicianAPI.getTodayProgress(route.id)
                setProgress(newProgress)
            } else {
                toast.error(result.error || 'حصل مشكلة')
            }
        } catch (err) {
            console.error('Error completing order:', err)
            toast.error('حصل مشكلة فى إكمال الطلب')
        } finally {
            setOrderLoading(false)
        }
    }, [currentOrder, route])

    // الانتقال للطلب التالى — مع انصراف تلقائى لو آخر طلب
    const moveToNextOrder = useCallback(async () => {
        if (!route) return
        try {
            setOrderLoading(true)

            // عرض انتقال لثانيتين
            setCurrentOrder(null)
            await new Promise(resolve => setTimeout(resolve, 1500))

            // جلب الطلب التالى
            const [newOrder, newProgress] = await Promise.all([
                TechnicianAPI.getCurrentOrder(route.id, status.isLeader),
                TechnicianAPI.getTodayProgress(route.id)
            ])

            setCurrentOrder(newOrder)
            setProgress(newProgress)

            if (!newOrder && newProgress.total > 0 && newProgress.completed === newProgress.total) {
                // آخر طلب — انصراف تلقائى
                setAllOrdersDone(true)

                if (status.workerId) {
                    const attRecord = await AttendanceAPI.getTodayAttendance(status.workerId)
                    if (attRecord && attRecord.check_in_time && !attRecord.check_out_time) {
                        // تسجيل انصراف تلقائى
                        const checkoutResult = await AttendanceAPI.checkOut(status.workerId, 'auto_route_complete')
                        if (checkoutResult.success) {
                            toast.success('تم تسجيل انصرافك تلقائى 🏠 ريّح نفسك!', { duration: 5000 })
                            setAttendance({
                                checkedIn: true,
                                checkedOut: true,
                                todayRecord: checkoutResult.data || attRecord,
                                loading: false
                            })
                        }
                    }
                }

                toast.success('الله ينوّر يا بطل! خلّصت كل شغل النهاردة 🏆', { duration: 5000 })
            }
        } catch (err) {
            console.error('Error moving to next order:', err)
            toast.error('حصل مشكلة فى تحميل الطلب التالى')
        } finally {
            setOrderLoading(false)
        }
    }, [route, status.isLeader, status.workerId])

    // تخطى التحصيل — يعلّم الطلب بحالة "skipped" حتى لا يظهر مرة أخرى
    const skipCollection = useCallback(async () => {
        if (!currentOrder || !route) return
        try {
            setOrderLoading(true)

            // تحديث payment_status فى الداتا للطلب المكتمل عشان ما يظهرش تانى
            await supabase
                .from('orders')
                .update({ payment_status: 'skipped' })
                .eq('id', currentOrder.id)

            // الانتقال للطلب التالى
            setCurrentOrder(null)
            await new Promise(resolve => setTimeout(resolve, 800))

            const [newOrder, newProgress] = await Promise.all([
                TechnicianAPI.getCurrentOrder(route.id, status.isLeader),
                TechnicianAPI.getTodayProgress(route.id)
            ])

            setCurrentOrder(newOrder)
            setProgress(newProgress)

            if (!newOrder && newProgress.total > 0 && newProgress.completed === newProgress.total) {
                setAllOrdersDone(true)

                if (status.workerId) {
                    const attRecord = await AttendanceAPI.getTodayAttendance(status.workerId)
                    if (attRecord && attRecord.check_in_time && !attRecord.check_out_time) {
                        const checkoutResult = await AttendanceAPI.checkOut(status.workerId, 'auto_route_complete')
                        if (checkoutResult.success) {
                            toast.success('تم تسجيل انصرافك تلقائى 🏠 ريّح نفسك!', { duration: 5000 })
                            setAttendance({
                                checkedIn: true,
                                checkedOut: true,
                                todayRecord: checkoutResult.data || attRecord,
                                loading: false
                            })
                        }
                    }
                }

                toast.success('الله ينوّر يا بطل! خلّصت كل شغل النهاردة 🏆', { duration: 5000 })
            }
        } catch (err) {
            console.error('Error skipping collection:', err)
            toast.error('حصل مشكلة فى تخطى التحصيل')
        } finally {
            setOrderLoading(false)
        }
    }, [currentOrder, route, status.isLeader, status.workerId])

    const refresh = useCallback(async () => {
        await fetchData()
    }, [fetchData])

    return {
        route,
        currentOrder,
        progress,
        status,
        attendance,
        loading,
        orderLoading,
        refreshing,
        error,
        allOrdersDone,
        startOrder,
        completeOrder,
        moveToNextOrder,
        skipCollection,
        refresh,
        refreshAttendance
    }
}

export default useTechnicianData
