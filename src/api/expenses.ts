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

  // Get expenses with filters and pagination
  static async getExpenses(
    filters?: ExpenseFilters,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<ExpenseWithDetails>> {
    try {
      let query = supabase
        .from('expenses')
        .select(`
          *,
          category:expense_categories(*),
          order:orders(order_number, customer:customers(name)),
          route:routes(name),
          team:teams(name),
          created_by_user:users!expenses_created_by_fkey(full_name),
          approved_by_user:users!expenses_approved_by_fkey(full_name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters?.status?.length) {
        query = query.in('status', filters.status)
      }

      if (filters?.category_id) {
        query = query.eq('category_id', filters.category_id)
      }

      if (filters?.date_from) {
        query = query.gte('created_at', filters.date_from)
      }

      if (filters?.date_to) {
        query = query.lte('created_at', filters.date_to)
      }

      if (filters?.team_id) {
        query = query.eq('team_id', filters.team_id)
      }

      if (filters?.amount_min) {
        query = query.gte('amount', filters.amount_min)
      }

      if (filters?.amount_max) {
        query = query.lte('amount', filters.amount_max)
      }

      // Apply pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) throw error

      return {
        data: data || [],
        total: count || 0,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit)
      }
    } catch (error) {
      throw new Error(handleSupabaseError(error))
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

  // Approve expense
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
