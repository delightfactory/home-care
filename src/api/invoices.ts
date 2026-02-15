// Invoices API Layer - Financial System
import { supabase, handleSupabaseError } from '../lib/supabase'
import {
    Invoice,
    InvoiceItem,
    InvoiceInsert,
    InvoiceUpdate,
    InvoiceItemInsert,
    InvoiceItemUpdate,
    InvoiceWithDetails,
    InvoiceFilters,
    PaginatedResponse,
    ApiResponse,
    DbFunctionResponse
} from '../types'

export class InvoicesAPI {

    // =====================
    // CRUD - الفواتير
    // =====================

    /**
     * جلب الفواتير مع فلترة وترقيم
     */
    static async getInvoices(
        filters?: InvoiceFilters,
        page = 1,
        limit = 20
    ): Promise<PaginatedResponse<InvoiceWithDetails>> {
        try {
            const offset = (page - 1) * limit

            let query = supabase
                .from('invoices')
                .select(`
          *,
          customer:customers(id, name, phone),
          team:teams(id, name),
          order:orders(id, order_number),
          items:invoice_items(*, service:services(id, name, name_ar)),
          collected_by_user:users!invoices_collected_by_fkey(id, full_name)
        `, { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1)

            // تطبيق الفلاتر
            if (filters?.status?.length) {
                query = query.in('status', filters.status)
            }
            if (filters?.payment_method) {
                query = query.eq('payment_method', filters.payment_method)
            }
            if (filters?.customer_id) {
                query = query.eq('customer_id', filters.customer_id)
            }
            if (filters?.team_id) {
                query = query.eq('team_id', filters.team_id)
            }
            if (filters?.order_id) {
                query = query.eq('order_id', filters.order_id)
            }
            if (filters?.date_from) {
                const dateFrom = filters.date_from.includes('T') ? filters.date_from : `${filters.date_from}T00:00:00.000Z`
                query = query.gte('created_at', dateFrom)
            }
            if (filters?.date_to) {
                const dateTo = filters.date_to.includes('T') ? filters.date_to : `${filters.date_to}T23:59:59.999Z`
                query = query.lte('created_at', dateTo)
            }
            if (filters?.search) {
                // بحث بالعميل (اسم/هاتف) + رقم الفاتورة + الملاحظات
                const { data: matchingCustomers } = await supabase
                    .from('customers')
                    .select('id')
                    .or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`)
                    .limit(50)

                const customerIds = matchingCustomers?.map(c => c.id) || []

                if (customerIds.length > 0) {
                    // بحث في رقم الفاتورة أو الملاحظات أو العملاء المطابقين
                    query = query.or(`invoice_number.ilike.%${filters.search}%,notes.ilike.%${filters.search}%,customer_id.in.(${customerIds.join(',')})`)
                } else {
                    // لا عملاء مطابقين — بحث في الفاتورة فقط
                    query = query.or(`invoice_number.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`)
                }
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

    /**
     * جلب فاتورة واحدة بالتفاصيل
     */
    static async getInvoiceById(id: string): Promise<InvoiceWithDetails> {
        try {
            const { data, error } = await supabase
                .from('invoices')
                .select(`
          *,
          customer:customers(id, name, phone, address),
          team:teams(id, name),
          order:orders(id, order_number, scheduled_date),
          items:invoice_items(*, service:services(id, name, name_ar))
        `)
                .eq('id', id)
                .single()

            if (error) throw error
            if (!data) throw new Error('الفاتورة غير موجودة')

            return data
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /**
     * جلب فواتير طلب معين
     */
    static async getInvoicesByOrder(orderId: string): Promise<InvoiceWithDetails[]> {
        try {
            const { data, error } = await supabase
                .from('invoices')
                .select(`
          *,
          customer:customers(id, name, phone),
          items:invoice_items(*, service:services(id, name, name_ar))
        `)
                .eq('order_id', orderId)
                .order('created_at', { ascending: false })

            if (error) throw error
            return data || []
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /**
     * جلب فواتير عميل معين
     */
    static async getInvoicesByCustomer(customerId: string): Promise<InvoiceWithDetails[]> {
        try {
            const { data, error } = await supabase
                .from('invoices')
                .select(`
          *,
          team:teams(id, name),
          order:orders(id, order_number),
          items:invoice_items(*, service:services(id, name, name_ar))
        `)
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false })

            if (error) throw error
            return data || []
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /**
     * إنشاء فاتورة يدوية (بدون طلب)
     */
    static async createInvoice(
        invoiceData: InvoiceInsert,
        items: Omit<InvoiceItemInsert, 'invoice_id'>[]
    ): Promise<ApiResponse<Invoice>> {
        try {
            // إنشاء الفاتورة
            const { data: invoice, error: invoiceError } = await supabase
                .from('invoices')
                .insert(invoiceData)
                .select()
                .single()

            if (invoiceError) throw invoiceError

            // إضافة البنود (إن وجدت)
            if (items.length > 0) {
                const itemsWithInvoiceId = items.map(item => ({
                    ...item,
                    invoice_id: invoice.id
                }))

                const { error: itemsError } = await supabase
                    .from('invoice_items')
                    .insert(itemsWithInvoiceId)

                if (itemsError) throw itemsError
            }

            return {
                success: true,
                data: invoice,
                message: 'تم إنشاء الفاتورة بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /**
     * تعديل فاتورة (draft أو pending فقط)
     */
    static async updateInvoice(
        id: string,
        updates: InvoiceUpdate
    ): Promise<ApiResponse<Invoice>> {
        try {
            const { data, error } = await supabase
                .from('invoices')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .in('status', ['draft', 'pending'])
                .select()
                .maybeSingle()

            if (error) throw error
            if (!data) {
                return {
                    success: false,
                    error: 'لا يمكن تعديل هذه الفاتورة — ربما تم تحصيلها أو تغيير حالتها بالفعل'
                }
            }

            return {
                success: true,
                data,
                message: 'تم تحديث الفاتورة بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    // =====================
    // بنود الفاتورة
    // =====================

    /**
     * إضافة بند للفاتورة
     */
    static async addInvoiceItem(item: InvoiceItemInsert): Promise<ApiResponse<InvoiceItem>> {
        try {
            const { data, error } = await supabase
                .from('invoice_items')
                .insert(item)
                .select()
                .single()

            if (error) throw error

            return {
                success: true,
                data,
                message: 'تم إضافة البند بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /**
     * تعديل بند فاتورة
     */
    static async updateInvoiceItem(
        id: string,
        updates: InvoiceItemUpdate
    ): Promise<ApiResponse<InvoiceItem>> {
        try {
            const { data, error } = await supabase
                .from('invoice_items')
                .update(updates)
                .eq('id', id)
                .select()
                .single()

            if (error) throw error

            return {
                success: true,
                data,
                message: 'تم تحديث البند بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /**
     * حذف بند فاتورة
     */
    static async deleteInvoiceItem(id: string): Promise<ApiResponse<void>> {
        try {
            const { error } = await supabase
                .from('invoice_items')
                .delete()
                .eq('id', id)

            if (error) throw error

            return {
                success: true,
                message: 'تم حذف البند بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    // =====================
    // عمليات التحصيل والإلغاء (RPC)
    // =====================

    /**
     * تحصيل فاتورة نقدى → عهدة القائد
     */
    static async collectCash(
        invoiceId: string,
        custodyId: string,
        performedBy: string
    ): Promise<ApiResponse<DbFunctionResponse>> {
        try {
            const { data, error } = await supabase.rpc('collect_invoice_cash', {
                p_invoice_id: invoiceId,
                p_custody_id: custodyId,
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
                message: 'تم تحصيل الفاتورة نقدياً بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /**
     * تحصيل إداري → خزنة مباشرة (instapay / bank_transfer)
     */
    static async collectAdmin(
        invoiceId: string,
        vaultId: string,
        paymentMethod: 'instapay' | 'bank_transfer',
        proofUrl: string,
        performedBy: string
    ): Promise<ApiResponse<DbFunctionResponse>> {
        try {
            const { data, error } = await supabase.rpc('collect_invoice_admin', {
                p_invoice_id: invoiceId,
                p_vault_id: vaultId,
                p_payment_method: paymentMethod,
                p_proof_url: proofUrl,
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
                message: 'تم تحصيل الفاتورة إدارياً بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /**
     * إلغاء فاتورة (مع عكس الأرصدة إن كانت محصّلة)
     */
    static async cancelInvoice(
        invoiceId: string,
        reason: string,
        performedBy: string
    ): Promise<ApiResponse<DbFunctionResponse>> {
        try {
            const { data, error } = await supabase.rpc('cancel_paid_invoice', {
                p_invoice_id: invoiceId,
                p_reason: reason,
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
                message: result.refunded
                    ? `تم إلغاء الفاتورة ورد مبلغ ${result.refunded_amount}`
                    : 'تم إلغاء الفاتورة'
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
     * إحصائيات الفواتير الإجمالية
     */
    static async getInvoiceStats(dateFrom?: string, dateTo?: string) {
        try {
            const params: { p_date_from?: string; p_date_to?: string } = {}

            if (dateFrom) {
                params.p_date_from = dateFrom.includes('T') ? dateFrom : `${dateFrom}T00:00:00.000Z`
            }
            if (dateTo) {
                params.p_date_to = dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59.999Z`
            }

            const { data, error } = await supabase.rpc('get_invoice_stats', params)
            if (error) throw error

            return data as {
                total_invoices: number
                paid_invoices: number
                pending_invoices: number
                partially_paid_invoices: number
                cancelled_invoices: number
                total_revenue: number
                total_pending_amount: number
                total_partially_paid_amount: number
                total_partially_remaining: number
                cash_revenue: number
                digital_revenue: number
            }
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }
}
