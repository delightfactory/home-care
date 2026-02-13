// Custody Accounts API Layer - Financial System
import { supabase, handleSupabaseError } from '../lib/supabase'
import {
    CustodyTransaction,
    CustodyAccountWithDetails,
    CustodyTransactionFilters,
    PaginatedResponse,
    ApiResponse,
    DbFunctionResponse
} from '../types'

export class CustodyAPI {

    // =====================
    // CRUD - حسابات العهدة
    // =====================

    /**
     * جلب كل حسابات العهدة
     */
    static async getCustodyAccounts(activeOnly = false): Promise<CustodyAccountWithDetails[]> {
        try {
            let query = supabase
                .from('custody_accounts')
                .select(`
          *,
          user:users!custody_accounts_user_id_fkey(id, full_name),
          team:teams(id, name)
        `)
                .order('created_at', { ascending: true })

            if (activeOnly) {
                query = query.eq('is_active', true)
            }

            const { data, error } = await query
            if (error) throw error
            return data || []
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /**
     * جلب عهدة مستخدم معين
     */
    static async getCustodyByUserId(userId: string): Promise<CustodyAccountWithDetails | null> {
        try {
            const { data, error } = await supabase
                .from('custody_accounts')
                .select(`
          *,
          user:users!custody_accounts_user_id_fkey(id, full_name),
          team:teams(id, name)
        `)
                .eq('user_id', userId)
                .maybeSingle()

            if (error) throw error
            return data
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /**
     * جلب عهدة واحدة بالتفاصيل
     */
    static async getCustodyById(id: string): Promise<CustodyAccountWithDetails> {
        try {
            const { data, error } = await supabase
                .from('custody_accounts')
                .select(`
          *,
          user:users!custody_accounts_user_id_fkey(id, full_name),
          team:teams(id, name)
        `)
                .eq('id', id)
                .single()

            if (error) throw error
            if (!data) throw new Error('العهدة غير موجودة')

            return data
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /**
     * جلب عهد فريق معين
     */
    static async getCustodyByTeam(teamId: string): Promise<CustodyAccountWithDetails[]> {
        try {
            const { data, error } = await supabase
                .from('custody_accounts')
                .select(`
          *,
          user:users!custody_accounts_user_id_fkey(id, full_name)
        `)
                .eq('team_id', teamId)

            if (error) throw error
            return data || []
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    // =====================
    // حركات العهدة
    // =====================

    /**
     * جلب حركات عهدة مع فلترة وترقيم
     */
    static async getCustodyTransactions(
        custodyId: string,
        filters?: CustodyTransactionFilters,
        page = 1,
        limit = 30
    ): Promise<PaginatedResponse<CustodyTransaction>> {
        try {
            const offset = (page - 1) * limit

            let query = supabase
                .from('custody_transactions')
                .select('*', { count: 'exact' })
                .eq('custody_id', custodyId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1)

            if (filters?.type?.length) {
                query = query.in('type', filters.type)
            }
            if (filters?.date_from) {
                const from = filters.date_from.includes('T') ? filters.date_from : `${filters.date_from}T00:00:00.000Z`
                query = query.gte('created_at', from)
            }
            if (filters?.date_to) {
                const to = filters.date_to.includes('T') ? filters.date_to : `${filters.date_to}T23:59:59.999Z`
                query = query.lte('created_at', to)
            }

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

    // =====================
    // عمليات التسوية (RPC)
    // =====================

    /**
     * تسوية عهدة قائد → عهدة مشرف
     * ⚠️ الاتجاه المسموح فقط: team_leader → supervisor
     */
    static async settleCustodyToCustody(
        fromCustodyId: string,
        toCustodyId: string,
        amount: number,
        performedBy: string
    ): Promise<ApiResponse<DbFunctionResponse>> {
        try {
            const { data, error } = await supabase.rpc('settle_custody_to_custody', {
                p_from_custody_id: fromCustodyId,
                p_to_custody_id: toCustodyId,
                p_amount: amount,
                p_performed_by: performedBy
            })

            if (error) throw error

            const result = data as DbFunctionResponse
            if (!result.success) {
                return { success: false, error: result.error }
            }

            return {
                success: true,
                data: result,
                message: 'تم تسوية العهدة بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /**
     * تسوية عهدة → خزنة (إيداع نهائي)
     */
    static async settleCustodyToVault(
        custodyId: string,
        vaultId: string,
        amount: number,
        performedBy: string
    ): Promise<ApiResponse<DbFunctionResponse>> {
        try {
            const { data, error } = await supabase.rpc('settle_custody_to_vault', {
                p_custody_id: custodyId,
                p_vault_id: vaultId,
                p_amount: amount,
                p_performed_by: performedBy
            })

            if (error) throw error

            const result = data as DbFunctionResponse
            if (!result.success) {
                return { success: false, error: result.error }
            }

            return {
                success: true,
                data: result,
                message: 'تم الإيداع في الخزنة بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    // =====================
    // إحصائيات
    // =====================

    /**
     * ملخص أرصدة العهد
     */
    static async getCustodySummary() {
        try {
            const { data, error } = await supabase
                .from('custody_accounts')
                .select(`
          id, holder_type, balance, is_active,
          user:users!custody_accounts_user_id_fkey(id, full_name),
          team:teams(id, name)
        `)
                .order('balance', { ascending: false })

            if (error) throw error

            const accounts = data || []
            const active = accounts.filter(a => a.is_active)
            const frozen = accounts.filter(a => !a.is_active && a.balance > 0)
            const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0)
            const activeBalance = active.reduce((sum, a) => sum + (a.balance || 0), 0)
            const frozenBalance = frozen.reduce((sum, a) => sum + (a.balance || 0), 0)

            return {
                accounts,
                total_balance: totalBalance,
                active_balance: activeBalance,
                frozen_balance: frozenBalance,
                active_count: active.length,
                frozen_count: frozen.length,
                total_count: accounts.length
            }
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }
}
