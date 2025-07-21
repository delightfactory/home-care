// Workers and Teams API Layer
import { supabase, handleSupabaseError } from '../lib/supabase'
import { 
  Worker, 
  Team,
  WorkerInsert, 
  WorkerUpdate,
  TeamInsert,
  TeamUpdate,
  WorkerWithTeam,
  TeamWithMembers,
  WorkerFilters,
  ApiResponse 
} from '../types'

export class WorkersAPI {
  // Get all workers with optional filters
  static async getWorkers(filters?: WorkerFilters): Promise<WorkerWithTeam[]> {
    try {
      let query = supabase
        .from('workers')
        .select(`
          *,
          user:users(*),
          team_members:team_members(
            team:teams(*)
          )
        `)
        .order('name')

      // Apply filters
      if (filters?.status?.length) {
        query = query.in('status', filters.status)
      }

      if (filters?.team_id) {
        query = query.eq('team_members.team_id', filters.team_id)
      }

      if (filters?.can_drive !== undefined) {
        query = query.eq('can_drive', filters.can_drive)
      }

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`)
      }

      const { data, error } = await query

      if (error) throw error

      // Transform data to include team info
      return (data || []).map(worker => ({
        ...worker,
        team: worker.team_members?.[0]?.team
      }))
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get worker by ID
  static async getWorkerById(id: string): Promise<WorkerWithTeam> {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select(`
          *,
          user:users(*),
          team_members:team_members(
            team:teams(*)
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      if (!data) throw new Error('العامل غير موجود')

      return {
        ...data,
        team: data.team_members?.[0]?.team
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Create new worker
  static async createWorker(workerData: WorkerInsert): Promise<ApiResponse<Worker>> {
    try {
      const { data, error } = await supabase
        .from('workers')
        .insert(workerData)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم إضافة العامل بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Update worker
  static async updateWorker(
    id: string,
    updates: WorkerUpdate
  ): Promise<ApiResponse<Worker>> {
    try {
      const { data, error } = await supabase
        .from('workers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم تحديث بيانات العامل بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Update worker status
  static async updateWorkerStatus(
    id: string,
    status: string
  ): Promise<ApiResponse<Worker>> {
    try {
      const { data, error } = await supabase
        .from('workers')
        .update({ 
          status, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم تحديث حالة العامل بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Get available workers (not in any team or available for new assignments)
  static async getAvailableWorkers(): Promise<Worker[]> {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select(`
          *,
          team_members:team_members(team_id)
        `)
        .eq('status', 'active')
        .order('name')

      if (error) throw error

      // Filter workers who are not in any team or can be assigned to multiple teams
      return (data || []).filter(worker => 
        !worker.team_members || worker.team_members.length === 0
      )
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get worker performance stats
  static async getWorkerStats(workerId: string, dateFrom?: string, dateTo?: string) {
    try {
      let query = supabase
        .from('orders')
        .select(`
          id,
          status,
          total_amount,
          customer_rating,
          scheduled_date,
          team:teams!inner(
            team_members!inner(worker_id)
          )
        `)
        .eq('team.team_members.worker_id', workerId)

      if (dateFrom) {
        query = query.gte('scheduled_date', dateFrom)
      }

      if (dateTo) {
        query = query.lte('scheduled_date', dateTo)
      }

      const { data, error } = await query

      if (error) throw error

      const orders = data || []
      const totalOrders = orders.length
      const completedOrders = orders.filter(o => o.status === 'completed').length
      const totalRevenue = orders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.total_amount || 0), 0)
      const averageRating = orders
        .filter(o => o.customer_rating)
        .reduce((sum, o, _, arr) => sum + (o.customer_rating || 0) / arr.length, 0)

      return {
        total_orders: totalOrders,
        completed_orders: completedOrders,
        total_revenue: totalRevenue,
        average_rating: averageRating,
        completion_rate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }
}

export class TeamsAPI {
  // Get all teams with members
  static async getTeams(): Promise<TeamWithMembers[]> {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          leader:workers!teams_leader_id_fkey(*),
          members:team_members(
            worker:workers(*)
          )
        `)
        .eq('is_active', true)
        .order('name')

      if (error) throw error

      return (data || []).map(team => ({
        ...team,
        member_count: team.members?.length || 0,
        status: team.is_active ? 'active' : 'inactive'
      }))
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get team by ID with full details
  static async getTeamById(id: string): Promise<TeamWithMembers> {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          leader:workers!teams_leader_id_fkey(*),
          members:team_members(
            *,
            worker:workers(*)
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      if (!data) throw new Error('الفريق غير موجود')

      return {
        ...data,
        member_count: data.members?.length || 0,
        status: data.is_active ? 'active' : 'inactive'
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Create new team
  static async createTeam(
    teamData: TeamInsert,
    memberIds: string[] = []
  ): Promise<ApiResponse<TeamWithMembers>> {
    try {
      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert(teamData)
        .select()
        .single()

      if (teamError) throw teamError

      // Deduplicate member IDs
      const uniqueMemberIds = Array.from(new Set(memberIds))
      // Add team members
      if (uniqueMemberIds.length > 0) {
        const teamMembers = uniqueMemberIds.map(workerId => ({
          team_id: team.id,
          worker_id: workerId
        }))

        const { error: membersError } = await supabase
          .from('team_members')
          .upsert(teamMembers, { ignoreDuplicates: true })

        if (membersError) throw membersError
      }

      // Get complete team data
      const completeTeam = await this.getTeamById(team.id)

      return {
        success: true,
        data: completeTeam,
        message: 'تم إنشاء الفريق بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Update team
  static async updateTeam(
    id: string,
    updates: TeamUpdate
  ): Promise<ApiResponse<Team>> {
    try {
      const { data, error } = await supabase
        .from('teams')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم تحديث بيانات الفريق بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Delete (soft) team
  static async deleteTeam(id: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('teams')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error

      return {
        success: true,
        message: 'تم حذف الفريق بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Add member to team
  static async addTeamMember(
    teamId: string,
    workerId: string
  ): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('team_members')
        .upsert({ team_id: teamId, worker_id: workerId }, { ignoreDuplicates: true })

      if (error) throw error

      return {
        success: true,
        message: 'تم إضافة العضو للفريق بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Remove member from team
  static async removeTeamMember(
    teamId: string,
    workerId: string
  ): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('worker_id', workerId)

      if (error) throw error

      return {
        success: true,
        message: 'تم إزالة العضو من الفريق بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Get team performance
  static async getTeamPerformance(teamId: string, dateFrom?: string, dateTo?: string) {
    try {
      let query = supabase
        .from('orders')
        .select('status, total_amount, customer_rating, scheduled_date')
        .eq('team_id', teamId)

      if (dateFrom) {
        query = query.gte('scheduled_date', dateFrom)
      }

      if (dateTo) {
        query = query.lte('scheduled_date', dateTo)
      }

      const { data, error } = await query

      if (error) throw error

      const orders = data || []
      const totalOrders = orders.length
      const completedOrders = orders.filter(o => o.status === 'completed').length
      const totalRevenue = orders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.total_amount || 0), 0)
      const averageRating = orders
        .filter(o => o.customer_rating)
        .reduce((sum, o, _, arr) => sum + (o.customer_rating || 0) / arr.length, 0)

      return {
        total_orders: totalOrders,
        completed_orders: completedOrders,
        total_revenue: totalRevenue,
        average_rating: averageRating,
        completion_rate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get available teams (not assigned to current routes)
  static async getAvailableTeams(date: string): Promise<Team[]> {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          *,
          routes:routes!left(id)
        `)
        .eq('is_active', true)
        .neq('routes.date', date)
        .order('name')

      if (error) throw error

      return (data || []).filter(team => !team.routes || team.routes.length === 0)
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }
}
