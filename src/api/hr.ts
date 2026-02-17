// HR API Layer — الموارد البشرية
// Attendance, Payroll, Advances, Adjustments, Company Locations
import { supabase, handleSupabaseError } from '../lib/supabase'
import type { ApiResponse } from '../types'
import type {
    AttendanceRecord,
    AttendanceWithWorker,
    AttendanceInsert,
    AttendanceUpdate,
    AttendanceFilters,
    AttendanceSummary,
    AttendanceStatus,
    CompanyLocation,
    CompanyLocationInsert,
    CompanyLocationUpdate,
    PayrollPeriod,
    PayrollItemWithWorker,
    PayrollDisbursement,
    PayrollFilters,
    SalaryAdvance,
    SalaryAdvanceWithWorker,
    AdvanceInsert,
    AdvanceInstallment,
    AdvanceFilters,
    HrAdjustment,
    HrAdjustmentWithWorker,
    AdjustmentInsert,
    AdjustmentUpdate,
    AdjustmentFilters,
    PublicHoliday,
    PenaltyRule,
} from '../types/hr.types'


// =====================================================================
// Attendance API — الحضور والانصراف
// =====================================================================
export class AttendanceAPI {

    /** جلب سجلات الحضور مع الفلاتر */
    static async getAttendance(filters?: AttendanceFilters): Promise<AttendanceWithWorker[]> {
        try {
            let query = supabase
                .from('attendance_records')
                .select(`
          *,
          worker:workers!attendance_records_worker_id_fkey(id, name, phone, salary)
        `)
                .order('date', { ascending: false })

            if (filters?.worker_id) {
                query = query.eq('worker_id', filters.worker_id)
            }

            if (filters?.date) {
                query = query.eq('date', filters.date)
            }

            if (filters?.date_from) {
                query = query.gte('date', filters.date_from)
            }

            if (filters?.date_to) {
                query = query.lte('date', filters.date_to)
            }

            if (filters?.status?.length) {
                query = query.in('status', filters.status)
            }

            const { data, error } = await query
            if (error) throw error
            return data || []
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /** جلب حضور عامل معين لشهر محدد */
    static async getAttendanceByWorker(
        workerId: string,
        month: number,
        year: number
    ): Promise<AttendanceRecord[]> {
        try {
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`
            const endDate = new Date(year, month, 0).toISOString().split('T')[0]

            const { data, error } = await supabase
                .from('attendance_records')
                .select('*')
                .eq('worker_id', workerId)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: true })

            if (error) throw error
            return data || []
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /** تسجيل حضور — مع حساب التأخير تلقائياً */
    static async checkIn(
        workerId: string,
        method: 'manual_gps' | 'manual_admin',
        location?: { lat: number; lng: number; accuracy?: number }
    ): Promise<ApiResponse<AttendanceRecord>> {
        try {
            const now = new Date()
            const today = now.toISOString().split('T')[0]

            // ⭐ Fix #1+#4: حساب التأخير — جلب وقت بداية الدوام
            let workStartTime = '09:00:00' // الافتراضى
            try {
                const { data: locData } = await supabase
                    .from('company_locations')
                    .select('work_start_time')
                    .eq('is_active', true)
                    .limit(1)
                    .single()
                if (locData?.work_start_time) {
                    workStartTime = locData.work_start_time
                }
            } catch {
                // استخدام الافتراضى إذا لم تُعثر على مواقع
            }

            // حساب الفارق بالدقائق
            const [startH, startM] = workStartTime.split(':').map(Number)
            const currentH = now.getHours()
            const currentM = now.getMinutes()
            const diffMinutes = (currentH * 60 + currentM) - (startH * 60 + startM)

            // تحديد الحالة ودقائق التأخير
            const lateMinutes = diffMinutes > 0 ? diffMinutes : 0
            const status: AttendanceStatus = lateMinutes > 0 ? 'late' as AttendanceStatus : 'present' as AttendanceStatus

            const { data, error } = await supabase
                .from('attendance_records')
                .upsert({
                    worker_id: workerId,
                    date: today,
                    check_in_time: now.toISOString(),
                    check_in_method: method,
                    check_in_location: location || null,
                    status,
                    late_minutes: lateMinutes,
                }, {
                    onConflict: 'worker_id,date'
                })
                .select()
                .single()

            if (error) throw error

            return {
                success: true,
                data,
                message: lateMinutes > 0
                    ? `تم تسجيل الحضور — متأخر ${lateMinutes} دقيقة`
                    : 'تم تسجيل الحضور بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /** تسجيل انصراف */
    static async checkOut(
        workerId: string,
        method: 'manual_gps' | 'manual_admin' | 'auto',
        location?: { lat: number; lng: number; accuracy?: number }
    ): Promise<ApiResponse<AttendanceRecord>> {
        try {
            const today = new Date().toISOString().split('T')[0]

            const { data, error } = await supabase
                .from('attendance_records')
                .update({
                    check_out_time: new Date().toISOString(),
                    check_out_method: method,
                    check_out_location: location || null,
                    updated_at: new Date().toISOString()
                })
                .eq('worker_id', workerId)
                .eq('date', today)
                .select()
                .single()

            if (error) throw error

            return {
                success: true,
                data,
                message: 'تم تسجيل الانصراف بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /** جلب سجل حضور اليوم لعامل محدد (فحص سريع) */
    static async getTodayAttendance(
        workerId: string
    ): Promise<AttendanceRecord | null> {
        try {
            const today = new Date().toISOString().split('T')[0]
            const { data, error } = await supabase
                .from('attendance_records')
                .select('*')
                .eq('worker_id', workerId)
                .eq('date', today)
                .maybeSingle()
            if (error) throw error
            return data || null
        } catch {
            return null
        }
    }

    /** تسجيل غياب */
    static async markAbsent(
        workerId: string,
        date: string,
        notes?: string
    ): Promise<ApiResponse<AttendanceRecord>> {
        try {
            const { data, error } = await supabase
                .from('attendance_records')
                .upsert({
                    worker_id: workerId,
                    date,
                    status: 'absent' as AttendanceStatus,
                    notes: notes || null,
                }, {
                    onConflict: 'worker_id,date'
                })
                .select()
                .single()

            if (error) throw error

            return {
                success: true,
                data,
                message: 'تم تسجيل الغياب'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /** تسجيل إجازة */
    static async markLeave(
        workerId: string,
        date: string,
        notes?: string
    ): Promise<ApiResponse<AttendanceRecord>> {
        try {
            const { data, error } = await supabase
                .from('attendance_records')
                .upsert({
                    worker_id: workerId,
                    date,
                    status: 'leave' as AttendanceStatus,
                    notes: notes || null,
                }, {
                    onConflict: 'worker_id,date'
                })
                .select()
                .single()

            if (error) throw error

            return {
                success: true,
                data,
                message: 'تم تسجيل الإجازة'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /** تسجيل عطلة رسمية لمجموعة عمال */
    static async markHoliday(
        date: string,
        workerIds: string[],
        notes?: string
    ): Promise<ApiResponse<void>> {
        try {
            const records = workerIds.map(workerId => ({
                worker_id: workerId,
                date,
                status: 'holiday' as AttendanceStatus,
                notes: notes || 'عطلة رسمية',
            }))

            const { error } = await supabase
                .from('attendance_records')
                .upsert(records, {
                    onConflict: 'worker_id,date'
                })

            if (error) throw error

            return {
                success: true,
                message: `تم تسجيل العطلة الرسمية لـ ${workerIds.length} عامل`
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /** تحديث سجل حضور */
    static async updateAttendance(
        id: string,
        updates: AttendanceUpdate
    ): Promise<ApiResponse<AttendanceRecord>> {
        try {
            const { data, error } = await supabase
                .from('attendance_records')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error

            return {
                success: true,
                data,
                message: 'تم تحديث سجل الحضور'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /** حذف سجل حضور */
    static async deleteAttendance(id: string): Promise<ApiResponse<void>> {
        try {
            const { error } = await supabase
                .from('attendance_records')
                .delete()
                .eq('id', id)

            if (error) throw error

            return {
                success: true,
                message: 'تم حذف سجل الحضور'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /** إنشاء سجل حضور جديد */
    static async createAttendance(
        record: AttendanceInsert
    ): Promise<ApiResponse<AttendanceRecord>> {
        try {
            const { data, error } = await supabase
                .from('attendance_records')
                .upsert({
                    ...record,
                    date: record.date || new Date().toISOString().split('T')[0],
                }, {
                    onConflict: 'worker_id,date'
                })
                .select()
                .single()

            if (error) throw error

            return {
                success: true,
                data,
                message: 'تم تسجيل الحضور بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /** ملخص الحضور الشهري */
    static async getAttendanceSummary(
        month: number,
        year: number
    ): Promise<AttendanceSummary[]> {
        try {
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`
            const endDate = new Date(year, month, 0).toISOString().split('T')[0]

            // جلب كل سجلات الحضور للشهر
            const { data: records, error } = await supabase
                .from('attendance_records')
                .select(`
          worker_id,
          status,
          work_hours,
          worker:workers!attendance_records_worker_id_fkey(id, name, paid_leave_days)
        `)
                .gte('date', startDate)
                .lte('date', endDate)

            if (error) throw error

            // تجميع حسب العامل
            const summaryMap = new Map<string, AttendanceSummary>()

            for (const record of (records || [])) {
                const workerId = record.worker_id
                const worker = record.worker as any

                if (!summaryMap.has(workerId)) {
                    summaryMap.set(workerId, {
                        worker_id: workerId,
                        worker_name: worker?.name || 'غير معروف',
                        total_days: 0,
                        present_days: 0,
                        absent_days: 0,
                        leave_days: 0,
                        late_days: 0,
                        holiday_days: 0,
                        total_work_hours: 0,
                        paid_leave_allowance: worker?.paid_leave_days || 4,
                    })
                }

                const summary = summaryMap.get(workerId)!
                summary.total_days++

                switch (record.status) {
                    case 'present':
                        summary.present_days++
                        break
                    case 'late':
                        summary.present_days++  // late = حاضر + متأخر
                        summary.late_days++
                        break
                    case 'absent':
                        summary.absent_days++
                        break
                    case 'leave':
                        summary.leave_days++
                        break
                    case 'holiday':
                        summary.holiday_days++
                        break
                }

                if (record.work_hours) {
                    summary.total_work_hours += Number(record.work_hours)
                }
            }

            return Array.from(summaryMap.values())
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /** جلب حالة حضور اليوم لعامل محدد */
    static async getTodayStatus(workerId: string): Promise<AttendanceRecord | null> {
        try {
            const today = new Date().toISOString().split('T')[0]

            const { data, error } = await supabase
                .from('attendance_records')
                .select('*')
                .eq('worker_id', workerId)
                .eq('date', today)
                .maybeSingle()

            if (error) throw error
            return data
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }
}


// =====================================================================
// Company Locations API — مواقع الشركة
// =====================================================================
export class CompanyLocationsAPI {

    /** جلب كل المواقع */
    static async getLocations(): Promise<CompanyLocation[]> {
        try {
            const { data, error } = await supabase
                .from('company_locations')
                .select('*')
                .order('name')

            if (error) throw error
            return data || []
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /** جلب المواقع النشطة فقط */
    static async getActiveLocations(): Promise<CompanyLocation[]> {
        try {
            const { data, error } = await supabase
                .from('company_locations')
                .select('*')
                .eq('is_active', true)
                .order('name')

            if (error) throw error
            return data || []
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /** إنشاء موقع جديد */
    static async createLocation(
        locationData: CompanyLocationInsert
    ): Promise<ApiResponse<CompanyLocation>> {
        try {
            const { data, error } = await supabase
                .from('company_locations')
                .insert(locationData)
                .select()
                .single()

            if (error) throw error

            return {
                success: true,
                data,
                message: 'تم إضافة الموقع بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /** تحديث موقع */
    static async updateLocation(
        id: string,
        updates: CompanyLocationUpdate
    ): Promise<ApiResponse<CompanyLocation>> {
        try {
            const { data, error } = await supabase
                .from('company_locations')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error

            return {
                success: true,
                data,
                message: 'تم تحديث الموقع بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /** حذف موقع */
    static async deleteLocation(id: string): Promise<ApiResponse<void>> {
        try {
            const { error } = await supabase
                .from('company_locations')
                .delete()
                .eq('id', id)

            if (error) throw error

            return {
                success: true,
                message: 'تم حذف الموقع بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }
}


// =====================================================================
// Payroll API — الرواتب
// =====================================================================
export class PayrollAPI {

    /** جلب مسيرات الرواتب */
    static async getPayrollPeriods(filters?: PayrollFilters): Promise<PayrollPeriod[]> {
        try {
            let query = supabase
                .from('payroll_periods')
                .select('*')
                .order('year', { ascending: false })
                .order('month', { ascending: false })

            if (filters?.status?.length) {
                query = query.in('status', filters.status)
            }

            if (filters?.year) {
                query = query.eq('year', filters.year)
            }

            const { data, error } = await query
            if (error) throw error
            return data || []
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /** جلب بنود مسير معين مع بيانات العمال */
    static async getPayrollItems(periodId: string): Promise<PayrollItemWithWorker[]> {
        try {
            const { data, error } = await supabase
                .from('payroll_items')
                .select(`
          *,
          worker:workers!payroll_items_worker_id_fkey(id, name, phone)
        `)
                .eq('payroll_period_id', periodId)
                .order('net_salary', { ascending: false })

            if (error) throw error
            return data || []
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /** حساب مسير الرواتب عبر RPC */
    static async calculatePayroll(
        month: number,
        year: number
    ): Promise<ApiResponse<{ periodId: string }>> {
        try {
            const { data, error } = await supabase.rpc('calculate_payroll', {
                p_month: month,
                p_year: year
            })

            if (error) throw error

            return {
                success: true,
                data: { periodId: data as string },
                message: `تم حساب مسير رواتب شهر ${month}/${year} بنجاح`
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /** اعتماد مسير الرواتب عبر RPC */
    static async approvePayroll(
        periodId: string,
        approvedBy: string
    ): Promise<ApiResponse<boolean>> {
        try {
            const { data, error } = await supabase.rpc('approve_payroll', {
                p_period_id: periodId,
                p_approved_by: approvedBy
            })

            if (error) throw error

            return {
                success: true,
                data: data as boolean,
                message: 'تم اعتماد مسير الرواتب بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /** جلب مسير بالId */
    static async getPayrollPeriodById(periodId: string): Promise<PayrollPeriod | null> {
        try {
            const { data, error } = await supabase
                .from('payroll_periods')
                .select('*')
                .eq('id', periodId)
                .maybeSingle()

            if (error) throw error
            return data
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /** صرف رواتب — خصم من خزنة (يدعم الصرف الجزئى) */
    static async disbursePayroll(
        periodId: string,
        vaultId: string,
        amount: number,
        disbursedBy: string
    ): Promise<ApiResponse<{
        disbursement_id: string
        amount_disbursed: number
        total_disbursed: number
        remaining: number
        new_vault_balance: number
        new_status: string
    }>> {
        try {
            const { data, error } = await supabase.rpc('disburse_payroll', {
                p_period_id: periodId,
                p_vault_id: vaultId,
                p_amount: amount,
                p_disbursed_by: disbursedBy
            })

            if (error) throw error

            const result = data as any
            if (!result?.success) {
                return {
                    success: false,
                    error: result?.error || 'حدث خطأ غير متوقع'
                }
            }

            return {
                success: true,
                data: result,
                message: result.message || 'تم صرف الرواتب بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /** جلب بند عامل محدد لشهر واحد */
    static async getWorkerPayrollItem(
        workerId: string,
        month: number,
        year: number
    ): Promise<PayrollItemWithWorker | null> {
        try {
            // أولاً نجد المسير للشهر المطلوب
            const { data: period } = await supabase
                .from('payroll_periods')
                .select('id')
                .eq('month', month)
                .eq('year', year)
                .maybeSingle()

            if (!period) return null

            const { data, error } = await supabase
                .from('payroll_items')
                .select('*, worker:workers!payroll_items_worker_id_fkey(id, name, phone)')
                .eq('payroll_period_id', period.id)
                .eq('worker_id', workerId)
                .maybeSingle()

            if (error) throw error
            return data as PayrollItemWithWorker | null
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /** جلب دفعات صرف مسير معين */
    static async getDisbursements(periodId: string): Promise<PayrollDisbursement[]> {
        try {
            const { data, error } = await supabase
                .from('payroll_disbursements')
                .select('*, vault:vaults(id, name)')
                .eq('payroll_period_id', periodId)
                .order('created_at', { ascending: false })

            if (error) throw error
            return (data || []) as PayrollDisbursement[]
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /** صرف رواتب فردى/مجمّع — عمال محددين */
    static async disburseWorkerSalary(
        periodId: string,
        workerIds: string[],
        vaultId: string,
        disbursedBy: string
    ): Promise<ApiResponse<{
        disbursement_id: string
        amount_disbursed: number
        workers_paid: number
        worker_names: string[]
        total_disbursed: number
        remaining: number
        new_vault_balance: number
        new_status: string
    }>> {
        try {
            const { data, error } = await supabase.rpc('disburse_worker_salary', {
                p_period_id: periodId,
                p_worker_ids: workerIds,
                p_vault_id: vaultId,
                p_disbursed_by: disbursedBy
            })

            if (error) throw error

            const result = data as any
            if (!result?.success) {
                return {
                    success: false,
                    error: result?.error || 'حدث خطأ غير متوقع'
                }
            }

            return {
                success: true,
                data: result,
                message: result.message || 'تم صرف الرواتب بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }
}


// =====================================================================
// Salary Advances API — السلف
// =====================================================================
export class AdvancesAPI {

    /** جلب السلف مع الفلاتر */
    static async getAdvances(filters?: AdvanceFilters): Promise<SalaryAdvanceWithWorker[]> {
        try {
            let query = supabase
                .from('salary_advances')
                .select(`
          *,
          worker:workers!salary_advances_worker_id_fkey(id, name, phone)
        `)
                .order('created_at', { ascending: false })

            if (filters?.worker_id) {
                query = query.eq('worker_id', filters.worker_id)
            }

            if (filters?.status?.length) {
                query = query.in('status', filters.status)
            }

            const { data, error } = await query
            if (error) throw error
            return data || []
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /** جلب سلف عامل معين */
    static async getAdvancesByWorker(workerId: string): Promise<SalaryAdvance[]> {
        try {
            const { data, error } = await supabase
                .from('salary_advances')
                .select('*')
                .eq('worker_id', workerId)
                .order('created_at', { ascending: false })

            if (error) throw error
            return data || []
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /** إنشاء سلفة جديدة مع أقساطها */
    static async createAdvance(
        advanceData: AdvanceInsert
    ): Promise<ApiResponse<SalaryAdvance>> {
        try {
            // إنشاء السلفة
            const { data: advance, error: advanceError } = await supabase
                .from('salary_advances')
                .insert(advanceData)
                .select()
                .single()

            if (advanceError) throw advanceError

            // إنشاء الأقساط
            if (advance && advanceData.installments_count && advanceData.installments_count > 0) {
                const installments = []
                let currentMonth = advanceData.start_month
                let currentYear = advanceData.start_year

                for (let i = 0; i < (advanceData.installments_count || 1); i++) {
                    installments.push({
                        advance_id: advance.id,
                        month: currentMonth,
                        year: currentYear,
                        amount: advanceData.installment_amount,
                        status: 'pending' as const,
                    })

                    // الشهر التالي
                    currentMonth++
                    if (currentMonth > 12) {
                        currentMonth = 1
                        currentYear++
                    }
                }

                const { error: installmentError } = await supabase
                    .from('advance_installments')
                    .insert(installments)

                if (installmentError) {
                    // لو فشل إنشاء الأقساط، نحذف السلفة
                    await supabase.from('salary_advances').delete().eq('id', advance.id)
                    throw installmentError
                }
            }

            return {
                success: true,
                data: advance,
                message: 'تم إنشاء السلفة بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /** إلغاء سلفة */
    static async cancelAdvance(id: string): Promise<ApiResponse<void>> {
        try {
            const { error } = await supabase
                .from('salary_advances')
                .update({
                    status: 'cancelled',
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .eq('status', 'active') // فقط السلف النشطة

            if (error) throw error

            return {
                success: true,
                message: 'تم إلغاء السلفة'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /** جلب أقساط سلفة */
    static async getInstallments(advanceId: string): Promise<AdvanceInstallment[]> {
        try {
            const { data, error } = await supabase
                .from('advance_installments')
                .select('*')
                .eq('advance_id', advanceId)
                .order('year', { ascending: true })
                .order('month', { ascending: true })

            if (error) throw error
            return data || []
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /** اعتماد سلفة مع خصم من خزنة (RPC ذرى) */
    static async approveAdvance(
        advanceId: string,
        vaultId: string,
        approvedBy: string
    ): Promise<ApiResponse<{ new_vault_balance: number; deducted_amount: number; vault_id: string }>> {
        try {
            const { data, error } = await supabase.rpc('approve_advance_from_vault', {
                p_advance_id: advanceId,
                p_vault_id: vaultId,
                p_approved_by: approvedBy,
            })

            if (error) throw error

            const result = data as any
            if (!result?.success) {
                return {
                    success: false,
                    error: result?.error || 'فشل في اعتماد السلفة',
                }
            }

            return {
                success: true,
                data: {
                    new_vault_balance: result.new_vault_balance,
                    deducted_amount: result.deducted_amount,
                    vault_id: result.vault_id,
                },
                message: result.message || 'تم اعتماد السلفة وخصمها من الخزنة',
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error),
            }
        }
    }
}


// =====================================================================
// HR Adjustments API — التسويات اليدوية
// =====================================================================
export class AdjustmentsAPI {

    /** جلب التسويات مع الفلاتر */
    static async getAdjustments(filters?: AdjustmentFilters): Promise<HrAdjustmentWithWorker[]> {
        try {
            let query = supabase
                .from('hr_adjustments')
                .select(`
          *,
          worker:workers!hr_adjustments_worker_id_fkey(id, name, phone),
          created_by_user:users!hr_adjustments_created_by_fkey(full_name)
        `)
                .order('date', { ascending: false })

            if (filters?.worker_id) {
                query = query.eq('worker_id', filters.worker_id)
            }

            if (filters?.type?.length) {
                query = query.in('type', filters.type)
            }

            if (filters?.date_from) {
                query = query.gte('date', filters.date_from)
            }

            if (filters?.date_to) {
                query = query.lte('date', filters.date_to)
            }

            if (filters?.is_processed !== undefined) {
                query = query.eq('is_processed', filters.is_processed)
            }

            const { data, error } = await query
            if (error) throw error
            return data || []
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /** إنشاء تسوية جديدة */
    static async createAdjustment(
        adjustmentData: AdjustmentInsert
    ): Promise<ApiResponse<HrAdjustment>> {
        try {
            const { data, error } = await supabase
                .from('hr_adjustments')
                .insert({
                    ...adjustmentData,
                    date: adjustmentData.date || new Date().toISOString().split('T')[0],
                })
                .select()
                .single()

            if (error) throw error

            const typeLabels = {
                bonus: 'المكافأة',
                deduction: 'الخصم',
                penalty: 'الجزاء'
            }

            return {
                success: true,
                data,
                message: `تم إضافة ${typeLabels[adjustmentData.type]} بنجاح`
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /** تحديث تسوية */
    static async updateAdjustment(
        id: string,
        updates: AdjustmentUpdate
    ): Promise<ApiResponse<HrAdjustment>> {
        try {
            const { data, error } = await supabase
                .from('hr_adjustments')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .eq('is_processed', false)  // فقط التسويات غير المعالجة
                .select()
                .single()

            if (error) throw error

            return {
                success: true,
                data,
                message: 'تم تحديث التسوية بنجاح'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }

    /** حذف تسوية */
    static async deleteAdjustment(id: string): Promise<ApiResponse<void>> {
        try {
            const { error } = await supabase
                .from('hr_adjustments')
                .delete()
                .eq('id', id)
                .eq('is_processed', false)  // فقط التسويات غير المعالجة

            if (error) throw error

            return {
                success: true,
                message: 'تم حذف التسوية'
            }
        } catch (error) {
            return {
                success: false,
                error: handleSupabaseError(error)
            }
        }
    }
}


// =====================================================================
// Public Holidays API — العطل الرسمية
// =====================================================================

export class PublicHolidaysAPI {
    /** جلب كل العطل الرسمية */
    static async getHolidays(year?: number): Promise<PublicHoliday[]> {
        try {
            let query = supabase
                .from('public_holidays')
                .select('*')
                .order('date', { ascending: true })

            if (year) {
                query = query.eq('year', year)
            }

            const { data, error } = await query
            if (error) throw error
            return data || []
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /** إنشاء عطلة جديدة */
    static async createHoliday(holiday: { name: string; date: string }): Promise<ApiResponse<PublicHoliday>> {
        try {
            const { data, error } = await supabase
                .from('public_holidays')
                .insert(holiday)
                .select()
                .single()

            if (error) throw error
            return { success: true, data, message: 'تم إضافة العطلة بنجاح' }
        } catch (error) {
            return { success: false, error: handleSupabaseError(error) }
        }
    }

    /** تحديث عطلة */
    static async updateHoliday(id: string, updates: Partial<{ name: string; date: string; is_active: boolean }>): Promise<ApiResponse<PublicHoliday>> {
        try {
            const { data, error } = await supabase
                .from('public_holidays')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return { success: true, data, message: 'تم تحديث العطلة' }
        } catch (error) {
            return { success: false, error: handleSupabaseError(error) }
        }
    }

    /** حذف عطلة */
    static async deleteHoliday(id: string): Promise<ApiResponse<void>> {
        try {
            const { error } = await supabase
                .from('public_holidays')
                .delete()
                .eq('id', id)

            if (error) throw error
            return { success: true, message: 'تم حذف العطلة' }
        } catch (error) {
            return { success: false, error: handleSupabaseError(error) }
        }
    }
}


// =====================================================================
// Penalty Rules API — قواعد الجزاءات
// =====================================================================

export class PenaltyRulesAPI {
    /** جلب كل القواعد */
    static async getRules(): Promise<PenaltyRule[]> {
        try {
            const { data, error } = await supabase
                .from('penalty_rules')
                .select('*')
                .order('sort_order', { ascending: true })

            if (error) throw error
            return data || []
        } catch (error) {
            throw new Error(handleSupabaseError(error))
        }
    }

    /** تحديث قاعدة جزاء */
    static async updateRule(id: string, updates: Partial<{
        name_ar: string;
        min_minutes: number;
        max_minutes: number | null;
        deduction_days: number;
        grace_count: number;
        is_active: boolean;
    }>): Promise<ApiResponse<PenaltyRule>> {
        try {
            const { data, error } = await supabase
                .from('penalty_rules')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single()

            if (error) throw error
            return { success: true, data, message: 'تم تحديث القاعدة' }
        } catch (error) {
            return { success: false, error: handleSupabaseError(error) }
        }
    }
}
