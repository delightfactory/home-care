// Workers and Teams API Layer
import { supabase, handleSupabaseError } from '../lib/supabase'
import { eventBus } from '../utils/EventBus'
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
  // Get all workers with optional filters - OPTIMIZED
  static async getWorkers(filters?: WorkerFilters): Promise<WorkerWithTeam[]> {
    try {
      // Use indexed columns for better performance
      let query = supabase
        .from('workers')
        .select(`
          id, name, phone, hire_date, salary, skills, can_drive, 
          status, rating, total_orders, created_at, updated_at, user_id
        `)
        .order('created_at', { ascending: false }); // Use indexed column

      // Apply filters using indexed columns
      if (filters?.status?.length) {
        query = query.in('status', filters.status); // Uses idx_workers_status
      }

      if (filters?.can_drive !== undefined) {
        query = query.eq('can_drive', filters.can_drive);
      }

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
      }

      const { data: workers, error } = await query;

      if (error) throw error;

      if (!workers?.length) return [];

      // Get team information separately for better performance
      const workerIds = workers.map(w => w.id);
      
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select(`
          worker_id,
          team:teams(id, name, leader_id, is_active)
        `)
        .in('worker_id', workerIds)
        .is('left_at', null);

      // Create team lookup map
      const teamMap = new Map();
      teamMembers?.forEach(tm => {
        teamMap.set(tm.worker_id, tm.team);
      });

      // Combine data efficiently
      const workersWithTeam = workers.map(worker => ({
        ...worker,
        team: teamMap.get(worker.id) || null
      }));

      return workersWithTeam;
    } catch (error) {
      throw handleSupabaseError(error);
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

      eventBus.emit('workers:changed')
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

      eventBus.emit('workers:changed')
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

      eventBus.emit('workers:changed')
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
  // Get all teams with members - OPTIMIZED
  static async getTeams(): Promise<TeamWithMembers[]> {
    try {
      // Get basic team info using indexed columns
      const { data: teams, error } = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!teams?.length) return [];

      const teamIds = teams.map(t => t.id);

      // Get team members and leaders in parallel
      const [membersResult, leadersResult, ordersResult] = await Promise.all([
        // Get team members
        supabase
          .from('team_members')
          .select(`
            team_id,
            worker:workers(id, name, phone, status, rating)
          `)
          .in('team_id', teamIds)
           .is('left_at', null),
        
        // Get team leaders
        supabase
          .from('workers')
          .select('id, name, phone, status, rating')
          .in('id', teams.filter(t => t.leader_id).map(t => t.leader_id!)),
        
        // Get active orders count
        supabase
          .from('orders')
          .select('team_id')
          .in('team_id', teamIds)
          .in('status', ['pending', 'scheduled', 'in_progress'])
      ]);

      if (membersResult.error) throw membersResult.error;
      if (leadersResult.error) throw leadersResult.error;
      if (ordersResult.error) throw ordersResult.error;

      // Create lookup maps for O(1) access
      const membersMap = new Map<string, any[]>();
      membersResult.data?.forEach(member => {
        if (!membersMap.has(member.team_id)) {
          membersMap.set(member.team_id, []);
        }
        membersMap.get(member.team_id)!.push(member);
      });

      const leadersMap = new Map();
      leadersResult.data?.forEach(leader => {
        leadersMap.set(leader.id, leader);
      });

      const ordersCountMap = new Map<string, number>();
      ordersResult.data?.forEach(order => {
        const current = ordersCountMap.get(order.team_id) || 0;
        ordersCountMap.set(order.team_id, current + 1);
      });

      // Combine all data efficiently
      return teams.map(team => ({
        ...team,
        leader: leadersMap.get(team.leader_id) || null,
        members: membersMap.get(team.id) || [],
        member_count: (membersMap.get(team.id) || []).length,
        status: team.is_active ? 'active' : 'inactive',
        active_orders: ordersCountMap.get(team.id) || 0
      }));
    } catch (error) {
      throw handleSupabaseError(error);
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

      const activeMembers = (data.members || []).filter((m: any) => !m.left_at);

      return {
        ...data,
        members: activeMembers,
        member_count: activeMembers.length,
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
      // تأمين قيمة leader_id بحيث تكون NULL إذا كانت سلسلة فارغة
      const sanitizedData = {
        ...teamData,
        leader_id:
          (teamData as any).leader_id === '' || (teamData as any).leader_id === undefined
            ? null
            : (teamData as any).leader_id
      }

      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert(sanitizedData)
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

      eventBus.emit('teams:changed')
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
      // تأمين leader_id فى التحديثات أيضًا
      const sanitizedUpdates = {
        ...updates,
        leader_id:
          (updates as any).leader_id === '' || (updates as any).leader_id === undefined
            ? null
            : (updates as any).leader_id,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('teams')
        .update(sanitizedUpdates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      eventBus.emit('teams:changed')
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

      eventBus.emit('teams:changed')
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
        .upsert(
          { team_id: teamId, worker_id: workerId, left_at: null },
          { onConflict: 'team_id,worker_id', ignoreDuplicates: false }
        )

      if (error) throw error

      eventBus.emit('teams:changed')
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

      eventBus.emit('teams:changed')
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

  // Transfer worker from one team to another
  static async transferWorker(
    workerId: string,
    fromTeamId: string | null,
    toTeamId: string
  ): Promise<ApiResponse<void>> {
    try {
      // إزالة العامل من الفريق الحالي (قد يكون قائدًا، وسيقوم التريجر بضبط leader_id = NULL تلقائيًا)
      if (fromTeamId) {
        // إزالة العامل من الفريق الحالي
        const removeResult = await this.removeTeamMember(fromTeamId, workerId)
        if (!removeResult.success) {
          return removeResult
        }
      }

      // إضافة العامل للفريق الجديد
      const addResult = await this.addTeamMember(toTeamId, workerId)
      if (!addResult.success) {
        return addResult
      }

      eventBus.emit('workers:changed')
      eventBus.emit('teams:changed')
      return {
        success: true,
        message: 'تم نقل العامل بنجاح'
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
