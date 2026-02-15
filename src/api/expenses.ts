// Expenses API Layer
import { supabase, handleSupabaseError } from '../lib/supabase'
import {
  Expense,
  ExpenseCategory,
  ExpenseInsert,
  ExpenseUpdate,
  ExpenseWithDetails,
  ExpenseFilters,
  PaginatedResponse,
  ApiResponse
} from '../types'

export class ExpensesAPI {
  // Aggregate counts by status
  static async getCounts(): Promise<import('../types').ExpenseCounts> {
    try {
      const { count: total, error: totalError } = await supabase
        .from('expenses')
        .select('*', { count: 'exact', head: true });
      if (totalError) throw totalError;

      const statuses = ['pending', 'approved', 'rejected'] as const;
      const counts: import('../types').ExpenseCounts = {
        total: total || 0,
        pending: 0,
        approved: 0,
        rejected: 0
      };

      for (const status of statuses) {
        const { count, error } = await supabase
          .from('expenses')
          .select('*', { count: 'exact', head: true })
          .eq('status', status);
        if (error) throw error;
        counts[status] = count || 0;
      }
      return counts;
    } catch (error) {
      throw new Error(handleSupabaseError(error));
    }
  }

  // Get expense categories
  static async getExpenseCategories(): Promise<ExpenseCategory[]> {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('is_active', true)
        .order('name_ar')

      if (error) throw error
      return data || []
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get expenses with filters and pagination - OPTIMIZED
  static async getExpenses(
    filters?: ExpenseFilters,
    page = 1,
    limit = 20,
    includeDetails = false
  ): Promise<PaginatedResponse<ExpenseWithDetails>> {
    try {
      const offset = (page - 1) * limit;

      // Basic query using indexed columns
      let query = supabase
        .from('expenses')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false }) // Uses idx_expenses_date_team
        .range(offset, offset + limit - 1);

      // Apply filters using indexed columns
      if (filters?.status?.length) {
        query = query.in('status', filters.status); // Uses idx_expenses_status
      }

      if (filters?.category_id) {
        query = query.eq('category_id', filters.category_id);
      }

      if (filters?.team_id) {
        query = query.eq('team_id', filters.team_id); // Uses idx_expenses_date_team
      }

      if (filters?.date_from) {
        // إضافة الوقت لبداية اليوم
        const dateFrom = filters.date_from.includes('T') ? filters.date_from : `${filters.date_from}T00:00:00.000Z`;
        query = query.gte('created_at', dateFrom);
      }

      if (filters?.date_to) {
        // إضافة الوقت لنهاية اليوم
        const dateTo = filters.date_to.includes('T') ? filters.date_to : `${filters.date_to}T23:59:59.999Z`;
        query = query.lte('created_at', dateTo);
      }

      if (filters?.amount_min) {
        query = query.gte('amount', filters.amount_min);
      }

      if (filters?.amount_max) {
        query = query.lte('amount', filters.amount_max);
      }

      if (filters?.search) {
        query = query.or(`description.ilike.%${filters.search}%`);
      }

      const { data: expenses, error, count } = await query;

      if (error) throw error;

      let expensesWithDetails = expenses || [];

      // Load detailed data only when requested
      if (includeDetails && expenses?.length) {
        const categoryIds = [...new Set(expenses.map(e => e.category_id).filter(Boolean))];
        const orderIds = [...new Set(expenses.map(e => e.order_id).filter(Boolean))];
        const teamIds = [...new Set(expenses.map(e => e.team_id).filter(Boolean))];
        const userIds = [...new Set([
          ...expenses.map(e => e.created_by).filter(Boolean),
          ...expenses.map(e => e.approved_by).filter(Boolean)
        ])];

        // Load related data in parallel
        const [categoriesResult, ordersResult, teamsResult, usersResult] = await Promise.all([
          categoryIds.length ? supabase
            .from('expense_categories')
            .select('id, name, name_ar')
            .in('id', categoryIds) : Promise.resolve({ data: [], error: null }),

          orderIds.length ? supabase
            .from('orders')
            .select('id, order_number, customer:customers(name)')
            .in('id', orderIds) : Promise.resolve({ data: [], error: null }),

          teamIds.length ? supabase
            .from('teams')
            .select('id, name')
            .in('id', teamIds) : Promise.resolve({ data: [], error: null }),

          userIds.length ? supabase
            .from('users')
            .select('id, full_name')
            .in('id', userIds) : Promise.resolve({ data: [], error: null })
        ]);

        // Create lookup maps
        const categoriesMap = new Map();
        categoriesResult.data?.forEach(cat => categoriesMap.set(cat.id, cat));

        const ordersMap = new Map();
        ordersResult.data?.forEach(order => ordersMap.set(order.id, order));

        const teamsMap = new Map();
        teamsResult.data?.forEach(team => teamsMap.set(team.id, team));

        const usersMap = new Map();
        usersResult.data?.forEach(user => usersMap.set(user.id, user));

        // Combine data
        expensesWithDetails = expenses.map(expense => ({
          ...expense,
          category: categoriesMap.get(expense.category_id) || null,
          order: ordersMap.get(expense.order_id) || null,
          team: teamsMap.get(expense.team_id) || null,
          created_by_user: usersMap.get(expense.created_by) || null,
          approved_by_user: usersMap.get(expense.approved_by) || null
        }));
      }

      return {
        data: expensesWithDetails,
        total: count || 0,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  // Get expense by ID
  static async getExpenseById(id: string): Promise<ExpenseWithDetails> {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          category:expense_categories(*),
          order:orders(
            order_number,
            customer:customers(name)
          ),
          route:routes(name),
          team:teams(name),
          created_by_user:users!expenses_created_by_fkey(full_name),
          approved_by_user:users!expenses_approved_by_fkey(full_name)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      if (!data) throw new Error('المصروف غير موجود')

      return data
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Create new expense
  static async createExpense(expenseData: ExpenseInsert): Promise<ApiResponse<Expense>> {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم إضافة المصروف بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Update expense
  static async updateExpense(
    id: string,
    updates: ExpenseUpdate
  ): Promise<ApiResponse<Expense>> {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return {
        success: true,
        data,
        message: 'تم تحديث المصروف بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Approve expense (legacy - بدون خصم مالي)
  static async approveExpense(
    id: string,
    approvedBy: string
  ): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'approved',
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error

      return {
        success: true,
        message: 'تم الموافقة على المصروف بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // اعتماد مصروف مع خصم من عهدة المنشئ (RPC ذري)
  static async approveExpenseFromCustody(
    expenseId: string,
    approvedBy: string
  ): Promise<ApiResponse<{ new_custody_balance: number; deducted_amount: number; custody_id: string }>> {
    try {
      const { data, error } = await supabase.rpc('approve_expense_from_custody', {
        p_expense_id: expenseId,
        p_approved_by: approvedBy
      })

      if (error) throw error

      const result = data as any
      if (!result?.success) {
        return {
          success: false,
          error: result?.error || 'فشل في اعتماد المصروف',
          data: result
        } as any
      }

      return {
        success: true,
        data: {
          new_custody_balance: result.new_custody_balance,
          deducted_amount: result.deducted_amount,
          custody_id: result.custody_id
        },
        message: result.message || 'تم اعتماد المصروف وخصمه من العهدة'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // اعتماد مصروف مع خصم من خزنة (RPC ذري)
  static async approveExpenseFromVault(
    expenseId: string,
    vaultId: string,
    approvedBy: string
  ): Promise<ApiResponse<{ new_vault_balance: number; deducted_amount: number; vault_id: string }>> {
    try {
      const { data, error } = await supabase.rpc('approve_expense_from_vault', {
        p_expense_id: expenseId,
        p_vault_id: vaultId,
        p_approved_by: approvedBy
      })

      if (error) throw error

      const result = data as any
      if (!result?.success) {
        return {
          success: false,
          error: result?.error || 'فشل في اعتماد المصروف',
          data: result
        } as any
      }

      return {
        success: true,
        data: {
          new_vault_balance: result.new_vault_balance,
          deducted_amount: result.deducted_amount,
          vault_id: result.vault_id
        },
        message: result.message || 'تم اعتماد المصروف وخصمه من الخزنة'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Delete expense (soft delete)
  static async deleteExpense(id: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)

      if (error) throw error

      return {
        success: true,
        message: 'تم حذف المصروف بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Reject expense
  static async rejectExpense(
    id: string,
    rejectionReason: string,
    rejectedBy: string
  ): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason,
          approved_by: rejectedBy,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error

      return {
        success: true,
        message: 'تم رفض المصروف'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }

  // Get pending expenses for approval
  static async getPendingExpenses(): Promise<ExpenseWithDetails[]> {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          category:expense_categories(*),
          team:teams(name),
          created_by_user:users!expenses_created_by_fkey(full_name)
        `)
        .eq('status', 'pending')
        .order('created_at')

      if (error) throw error
      return data || []
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get expenses by team
  static async getExpensesByTeam(teamId: string, dateFrom?: string, dateTo?: string): Promise<ExpenseWithDetails[]> {
    try {
      let query = supabase
        .from('expenses')
        .select(`
          *,
          category:expense_categories(*),
          order:orders(order_number),
          route:routes(name)
        `)
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })

      if (dateFrom) {
        query = query.gte('created_at', dateFrom)
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Get expense statistics
  static async getExpenseStats(dateFrom?: string, dateTo?: string) {
    try {
      let query = supabase
        .from('expenses')
        .select('status, amount, category_id, created_at')

      if (dateFrom) {
        query = query.gte('created_at', dateFrom)
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo)
      }

      const { data, error } = await query

      if (error) throw error

      const expenses = data || []
      const totalExpenses = expenses.length
      const approvedExpenses = expenses.filter(e => e.status === 'approved').length
      const pendingExpenses = expenses.filter(e => e.status === 'pending').length
      const rejectedExpenses = expenses.filter(e => e.status === 'rejected').length
      const totalAmount = expenses
        .filter(e => e.status === 'approved')
        .reduce((sum, e) => sum + (e.amount || 0), 0)

      // Group by category
      const categoryStats = expenses.reduce((acc, expense) => {
        const categoryId = expense.category_id || 'other'
        if (!acc[categoryId]) {
          acc[categoryId] = { count: 0, amount: 0 }
        }
        acc[categoryId].count++
        if (expense.status === 'approved') {
          acc[categoryId].amount += expense.amount || 0
        }
        return acc
      }, {} as Record<string, { count: number; amount: number }>)

      return {
        total_expenses: totalExpenses,
        approved_expenses: approvedExpenses,
        pending_expenses: pendingExpenses,
        rejected_expenses: rejectedExpenses,
        total_amount: totalAmount,
        approval_rate: totalExpenses > 0 ? (approvedExpenses / totalExpenses) * 100 : 0,
        category_stats: categoryStats
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
    }
  }

  // Upload receipt image
  static async uploadReceiptImage(file: File, expenseId: string): Promise<ApiResponse<string>> {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${expenseId}-${Date.now()}.${fileExt}`
      const filePath = `receipts/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath)

      // Update expense with receipt URL
      const { error: updateError } = await supabase
        .from('expenses')
        .update({ receipt_image_url: publicUrl })
        .eq('id', expenseId)

      if (updateError) throw updateError

      return {
        success: true,
        data: publicUrl,
        message: 'تم رفع صورة الإيصال بنجاح'
      }
    } catch (error) {
      return {
        success: false,
        error: handleSupabaseError(error)
      }
    }
  }
}
