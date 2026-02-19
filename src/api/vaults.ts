// Vaults API Layer - Financial System
import { supabase, handleSupabaseError } from '../lib/supabase'
import {
    Vault,
    VaultInsert,
    VaultUpdate,
    VaultTransaction,
    VaultWithTransactions,
    VaultTransactionFilters,
    PaginatedResponse,
    ApiResponse,
    DbFunctionResponse
} from '../types'

export class VaultsAPI {

    // =====================
    // CRUD - الخزائن
    // =====================

    /**
     * جلب كل الخزائن
     */
    static async getVaults(activeOnly = false): Promise<Vault[]> {
        try {
            let query = supabase
                .from('vaults')
                .select('*')
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
     * جلب خزنة واحدة بالتفاصيل
     */
    static async getVaultById(id: string): Promise<VaultWithTransactions> {
        try {
            const { data, error } = await supabase
                .from('vaults')
                .select(`
          *,
          created_by_user:users!vaults_created_by_fkey(id, full_name)
        `)
                .eq('id', id)
                .single()

            if (error) throw error
            if (!data) throw new Error('الخزنة غير موجودة')

            return data
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /**
     * إنشاء خزنة جديدة
     */
    static async createVault(vaultData: VaultInsert): Promise<ApiResponse<Vault>> {
        try {
            const { data, error } = await supabase
                .from('vaults')
                .insert(vaultData)
                .select()
                .single()

            if (error) throw error

            return {
                success: true,
                data,
                message: 'تم إنشاء الخزنة بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /**
     * تعديل خزنة
     */
    static async updateVault(
        id: string,
        updates: VaultUpdate
    ): Promise<ApiResponse<Vault>> {
        try {
            const { data, error } = await supabase
                .from('vaults')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error

            return {
                success: true,
                data,
                message: 'تم تحديث الخزنة بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /**
     * تفعيل/تعطيل خزنة
     */
    static async toggleVaultActive(
        id: string,
        isActive: boolean
    ): Promise<ApiResponse<void>> {
        try {
            const { error } = await supabase
                .from('vaults')
                .update({ is_active: isActive, updated_at: new Date().toISOString() })
                .eq('id', id)

            if (error) throw error

            return {
                success: true,
                message: isActive ? 'تم تفعيل الخزنة' : 'تم تعطيل الخزنة'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    // =====================
    // حركات الخزنة
    // =====================

    /**
     * جلب حركات خزنة مع فلترة وترقيم
     */
    static async getVaultTransactions(
        vaultId: string,
        filters?: VaultTransactionFilters,
        page = 1,
        limit = 30
    ): Promise<PaginatedResponse<VaultTransaction>> {
        try {
            const offset = (page - 1) * limit

            let query = supabase
                .from('vault_transactions')
                .select('*', { count: 'exact' })
                .eq('vault_id', vaultId)
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
    // عمليات الخزنة (RPC)
    // =====================

    /**
     * تحويل بين خزائن
     */
    static async transferBetweenVaults(
        fromVaultId: string,
        toVaultId: string,
        amount: number,
        performedBy: string,
        notes?: string
    ): Promise<ApiResponse<DbFunctionResponse>> {
        try {
            const { data, error } = await supabase.rpc('transfer_between_vaults', {
                p_from_vault_id: fromVaultId,
                p_to_vault_id: toVaultId,
                p_amount: amount,
                p_performed_by: performedBy,
                p_notes: notes || 'تحويل بين خزائن'
            })

            if (error) throw error

            const result = data as DbFunctionResponse
            if (!result.success) {
                return { success: false, error: result.error }
            }

            return {
                success: true,
                data: result,
                message: 'تم التحويل بين الخزائن بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /**
     * إيداع أو سحب يدوي من خزنة
     */
    static async manualAdjustment(
        vaultId: string,
        amount: number,
        type: 'deposit' | 'withdrawal',
        performedBy: string,
        notes: string
    ): Promise<ApiResponse<DbFunctionResponse>> {
        try {
            const { data, error } = await supabase.rpc('manual_vault_adjustment', {
                p_vault_id: vaultId,
                p_amount: amount,
                p_type: type,
                p_notes: notes,
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
                message: type === 'deposit' ? 'تم الإيداع بنجاح' : 'تم السحب بنجاح'
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
     * ملخص أرصدة الخزائن
     */
    static async getVaultsSummary() {
        try {
            const { data, error } = await supabase
                .from('vaults')
                .select('id, name, name_ar, type, balance, is_active')
                .order('name_ar')

            if (error) throw error

            const vaults = data || []
            const activeVaults = vaults.filter(v => v.is_active)
            const totalBalance = activeVaults.reduce((sum, v) => sum + (v.balance || 0), 0)

            return {
                vaults,
                total_balance: totalBalance,
                active_count: activeVaults.length,
                inactive_count: vaults.length - activeVaults.length
            }
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }
}
