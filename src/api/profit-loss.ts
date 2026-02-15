// Profit & Loss Report API — تقرير الأرباح والخسائر
import { supabase, handleSupabaseError } from '../lib/supabase'
import type { ProfitLossReport } from '../types/hr.types'


export class ProfitLossAPI {

    /** جلب تقرير الأرباح والخسائر عبر RPC */
    static async getReport(
        dateFrom: string,
        dateTo: string
    ): Promise<ProfitLossReport> {
        try {
            const { data, error } = await supabase.rpc('get_profit_loss_report', {
                p_date_from: dateFrom,
                p_date_to: dateTo
            })

            if (error) throw error

            // RPC يرجع صف واحد
            const row = Array.isArray(data) ? data[0] : data

            if (!row) {
                return {
                    total_revenue: 0,
                    total_expenses: 0,
                    total_payroll: 0,
                    net_profit: 0,
                    revenue_details: [],
                    expense_details: [],
                    payroll_details: [],
                }
            }

            return {
                total_revenue: Number(row.total_revenue) || 0,
                total_expenses: Number(row.total_expenses) || 0,
                total_payroll: Number(row.total_payroll) || 0,
                net_profit: Number(row.net_profit) || 0,
                revenue_details: row.revenue_details || [],
                expense_details: row.expense_details || [],
                payroll_details: row.payroll_details || [],
            }
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }
}
