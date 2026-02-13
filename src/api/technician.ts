// Technician API Layer
// API مخصص لتطبيق الفنى - يعرض الطلب الحالى فقط بدون بيانات حساسة
import { supabase, handleSupabaseError } from '../lib/supabase'
import { ApiResponse, RouteWithOrders, OrderWithDetails } from '../types'

// نوع الطلب للفنى - بدون رقم الهاتف
export interface TechnicianOrder {
    id: string
    order_number: string
    status: string
    scheduled_date: string
    scheduled_time: string
    total_amount: number
    notes?: string | null
    confirmation_status?: string | null
    items: Array<{
        id: string
        quantity: number
        unit_price: number
        service?: {
            id: string
            name: string
            name_ar: string
        } | null
    }>
    customer: {
        id: string
        name: string
        area: string | null
        address: string | null
        phone?: string | null       // للقادة فقط
        extra_phone?: string | null // للقادة فقط
    } | null
}

export interface TechnicianProgress {
    completed: number
    total: number
    percentage: number
}

// عضو الفريق
export interface TeamMember {
    id: string
    name: string
    isLeader: boolean
}

// حالة الفني - للتحقق من العضوية والقيادة
export interface TechnicianStatus {
    workerId: string | null       // معرف العامل
    teamId: string | null         // معرف الفريق
    teamName: string | null       // اسم الفريق
    isTeamMember: boolean         // هل عضو في فريق؟
    isLeader: boolean             // هل هو قائد الفريق؟
    hasLeader: boolean            // هل الفريق له قائد؟
    leaderName: string | null     // اسم قائد الفريق
    teamMembers: TeamMember[]     // أعضاء الفريق
}

export class TechnicianAPI {
    /**
     * جلب معرف العامل المرتبط بالمستخدم الحالى
     */
    static async getMyWorkerId(userId: string): Promise<string | null> {
        try {
            const { data, error } = await supabase
                .from('workers')
                .select('id')
                .eq('user_id', userId)
                .single()

            if (error) {
                if (error.code === 'PGRST116') return null // Not found
                throw error
            }
            return data?.id || null
        } catch (error) {
            console.error('Error getting worker ID:', error)
            return null
        }
    }

    /**
     * جلب الفريق المنتمى إليه العامل
     */
    static async getMyTeamId(workerId: string): Promise<string | null> {
        try {
            const { data, error } = await supabase
                .from('team_members')
                .select('team_id')
                .eq('worker_id', workerId)
                .is('left_at', null)
                .single()

            if (error) {
                if (error.code === 'PGRST116') return null
                throw error
            }
            return data?.team_id || null
        } catch (error) {
            console.error('Error getting team ID:', error)
            return null
        }
    }

    /**
     * جلب حالة الفني الشاملة (عضوية الفريق + القيادة)
     */
    static async getTechnicianStatus(userId: string): Promise<TechnicianStatus> {
        const defaultStatus: TechnicianStatus = {
            workerId: null,
            teamId: null,
            teamName: null,
            isTeamMember: false,
            isLeader: false,
            hasLeader: false,
            leaderName: null,
            teamMembers: []
        }

        try {
            // 1. جلب معرف العامل
            const { data: worker, error: workerError } = await supabase
                .from('workers')
                .select('id')
                .eq('user_id', userId)
                .single()

            if (workerError || !worker) {
                return defaultStatus
            }

            defaultStatus.workerId = worker.id

            // 2. جلب عضوية الفريق
            const { data: membership, error: memberError } = await supabase
                .from('team_members')
                .select(`
                    team_id,
                    team:teams(
                        id,
                        name,
                        leader_id,
                        leader:workers!teams_leader_id_fkey(id, name)
                    )
                `)
                .eq('worker_id', worker.id)
                .is('left_at', null)
                .maybeSingle()

            if (memberError || !membership) {
                return defaultStatus
            }

            const team = membership.team as any

            return {
                workerId: worker.id,
                teamId: team?.id || null,
                teamName: team?.name || null,
                isTeamMember: true,
                isLeader: team?.leader_id === worker.id,
                hasLeader: !!team?.leader_id,
                leaderName: team?.leader?.name || null,
                teamMembers: await this.getTeamMembers(team?.id, team?.leader_id)
            }
        } catch (error) {
            console.error('Error getting technician status:', error)
            return defaultStatus
        }
    }

    /**
     * جلب أعضاء الفريق
     */
    static async getTeamMembers(teamId: string | null, leaderId: string | null): Promise<TeamMember[]> {
        if (!teamId) return []

        try {
            const { data, error } = await supabase
                .from('team_members')
                .select(`
                    worker_id,
                    worker:workers(id, name)
                `)
                .eq('team_id', teamId)
                .is('left_at', null)

            if (error || !data) {
                console.error('Error fetching team members:', error)
                return []
            }

            return data.map((member: any) => ({
                id: member.worker?.id || member.worker_id,
                name: member.worker?.name || 'غير معروف',
                isLeader: member.worker?.id === leaderId
            })).filter((m: TeamMember) => m.id)
        } catch (error) {
            console.error('Error getting team members:', error)
            return []
        }
    }

    /**
     * جلب خط السير اليومى للفريق
     */
    static async getTodayRoute(teamId: string): Promise<RouteWithOrders | null> {
        try {
            const today = new Date().toISOString().split('T')[0]

            const { data, error } = await supabase
                .from('routes')
                .select(`
          *,
          team:teams(
            id, name, leader_id,
            leader:workers!teams_leader_id_fkey(id, name)
          ),
          route_orders(
            *,
            order:orders(
              *,
              customer:customers(id, name, area, address),
              items:order_items(
                *,
                service:services(id, name, name_ar)
              )
            )
          )
        `)
                .eq('team_id', teamId)
                .eq('date', today)
                .maybeSingle()

            if (error) {
                console.error('Error fetching route:', error)
                return null
            }
            return data
        } catch (error) {
            console.error('Error getting today route:', error)
            return null
        }
    }

    /**
     * جلب خط السير اليومى للمستخدم الحالى
     */
    static async getMyTodayRoute(userId: string): Promise<RouteWithOrders | null> {
        try {
            const workerId = await this.getMyWorkerId(userId)
            if (!workerId) return null

            const teamId = await this.getMyTeamId(workerId)
            if (!teamId) return null

            return await this.getTodayRoute(teamId)
        } catch (error) {
            console.error('Error getting my today route:', error)
            return null
        }
    }

    /**
     * تحويل الطلب لنوع الفنى (إخفاء الهاتف للفنيين العاديين)
     * @param order الطلب الكامل
     * @param isLeader هل المستخدم قائد فريق؟ إذا نعم يظهر رقم الهاتف
     */
    private static sanitizeOrder(order: OrderWithDetails, isLeader: boolean = false): TechnicianOrder {
        return {
            id: order.id,
            order_number: order.order_number || '',
            status: order.status,
            scheduled_date: order.scheduled_date,
            scheduled_time: order.scheduled_time,
            total_amount: order.total_amount || 0,
            notes: order.notes,
            confirmation_status: order.confirmation_status,
            items: (order.items || []).map(item => ({
                id: item.id,
                quantity: item.quantity || 1,
                unit_price: item.unit_price || 0,
                service: item.service ? {
                    id: item.service.id,
                    name: item.service.name,
                    name_ar: item.service.name_ar
                } : null
            })),
            customer: order.customer ? {
                id: order.customer.id,
                name: order.customer.name,
                area: order.customer.area,
                address: order.customer.address,
                // الهاتف للقادة فقط
                ...(isLeader && {
                    phone: order.customer.phone,
                    extra_phone: order.customer.extra_phone
                })
            } : null
        }
    }

    /**
     * جلب الطلب الحالى (أول طلب غير مكتمل فى التسلسل)
     * @param routeId معرف خط السير
     * @param isLeader هل المستخدم قائد فريق؟ إذا نعم يظهر رقم هاتف العميل
     */
    static async getCurrentOrder(routeId: string, isLeader: boolean = false): Promise<TechnicianOrder | null> {
        try {
            const { data, error } = await supabase
                .from('route_orders')
                .select(`
          sequence_order,
          order:orders(
            *,
            customer:customers(id, name, area, address, phone, extra_phone),
            items:order_items(
              *,
              service:services(id, name, name_ar)
            )
          )
        `)
                .eq('route_id', routeId)
                .order('sequence_order', { ascending: true })

            if (error) throw error

            // البحث عن أول طلب غير مكتمل وغير ملغى
            const currentRouteOrder = (data || []).find(
                (ro: any) => ro.order && !['completed', 'cancelled'].includes(ro.order.status)
            )

            if (!currentRouteOrder?.order) return null

            return this.sanitizeOrder(currentRouteOrder.order as unknown as OrderWithDetails, isLeader)
        } catch (error) {
            console.error('Error getting current order:', error)
            return null
        }
    }

    /**
     * جلب طلب محدد بمعرفه (بما فى ذلك المكتمل) — لعرض فاتورة بعد الريفريش
     */
    static async getOrderById(orderId: string, isLeader: boolean = false): Promise<TechnicianOrder | null> {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    customer:customers(id, name, area, address, phone, extra_phone),
                    items:order_items(
                        *,
                        service:services(id, name, name_ar)
                    )
                `)
                .eq('id', orderId)
                .single()

            if (error) throw error
            if (!data) return null

            return this.sanitizeOrder(data as unknown as OrderWithDetails, isLeader)
        } catch (error) {
            console.error('Error getting order by ID:', error)
            return null
        }
    }

    /**
     * جلب تقدم اليوم
     */
    static async getTodayProgress(routeId: string): Promise<TechnicianProgress> {
        try {
            const { data, error } = await supabase
                .from('route_orders')
                .select(`
          order:orders(status)
        `)
                .eq('route_id', routeId)

            if (error) throw error

            const orders = (data || []).filter((ro: any) => ro.order)
            const total = orders.length
            const completed = orders.filter((ro: any) => (ro.order as any)?.status === 'completed').length
            const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

            return { completed, total, percentage }
        } catch (error) {
            console.error('Error getting progress:', error)
            return { completed: 0, total: 0, percentage: 0 }
        }
    }

    /**
     * بدء العمل على الطلب
     * يسجل الحدث في سجل الحالات ويربط العمال بالطلب
     */
    static async startOrder(orderId: string, userId?: string): Promise<ApiResponse<void>> {
        try {
            // الحصول على معرف المستخدم الحالي
            const currentUserId = userId || (await supabase.auth.getUser()).data.user?.id

            // تحديث حالة الطلب
            const { error } = await supabase
                .from('orders')
                .update({
                    status: 'in_progress',
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId)

            if (error) throw error

            // ✅ تسجيل الحدث في سجل الحالات
            await supabase
                .from('order_status_logs')
                .insert({
                    order_id: orderId,
                    status: 'in_progress',
                    notes: 'تم بدء العمل على الطلب',
                    created_by: currentUserId
                })

            // ✅ ربط أعضاء الفريق بالطلب (للحوافز)
            if (currentUserId) {
                const workerId = await this.getMyWorkerId(currentUserId)
                if (workerId) {
                    const teamId = await this.getMyTeamId(workerId)
                    if (teamId) {
                        // جلب أعضاء الفريق الحاليين
                        const { data: teamMembers } = await supabase
                            .from('team_members')
                            .select('worker_id')
                            .eq('team_id', teamId)
                            .is('left_at', null)

                        if (teamMembers && teamMembers.length > 0) {
                            // التحقق من العمال الموجودين بالفعل في الطلب
                            const { data: existingWorkers } = await supabase
                                .from('order_workers')
                                .select('worker_id')
                                .eq('order_id', orderId)

                            const existingWorkerIds = new Set(
                                (existingWorkers || []).map(ew => ew.worker_id)
                            )

                            // إضافة العمال الجدد فقط
                            const newOrderWorkers = teamMembers
                                .filter(tm => !existingWorkerIds.has(tm.worker_id))
                                .map(tm => ({
                                    order_id: orderId,
                                    worker_id: tm.worker_id,
                                    team_id: teamId,
                                    started_at: new Date().toISOString()
                                }))

                            if (newOrderWorkers.length > 0) {
                                await supabase
                                    .from('order_workers')
                                    .insert(newOrderWorkers)
                            }
                        }
                    }
                }
            }

            return {
                success: true,
                message: 'تم بدء العمل على الطلب'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /**
     * إكمال الطلب
     * يسجل الحدث في سجل الحالات
     */
    static async completeOrder(orderId: string, userId?: string): Promise<ApiResponse<void>> {
        try {
            // الحصول على معرف المستخدم الحالي
            const currentUserId = userId || (await supabase.auth.getUser()).data.user?.id

            const { error } = await supabase
                .from('orders')
                .update({
                    status: 'completed',
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId)

            if (error) throw error

            // ✅ تسجيل الحدث في سجل الحالات
            await supabase
                .from('order_status_logs')
                .insert({
                    order_id: orderId,
                    status: 'completed',
                    notes: 'تم إكمال الطلب بواسطة الفني',
                    created_by: currentUserId
                })

            return {
                success: true,
                message: 'تم إكمال الطلب بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }
}
