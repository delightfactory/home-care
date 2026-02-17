// HR Module Types — الموارد البشرية
// Types for: Attendance, Payroll, Advances, Adjustments, Company Locations, P&L

// =====================================================================
// Enums
// =====================================================================

export enum AttendanceStatus {
    PRESENT = 'present',
    ABSENT = 'absent',
    LATE = 'late',
    LEAVE = 'leave',
    HOLIDAY = 'holiday'
}

export enum CheckInMethod {
    MANUAL_GPS = 'manual_gps',
    MANUAL_ADMIN = 'manual_admin'
}

export enum CheckOutMethod {
    AUTO_ROUTE_COMPLETE = 'auto_route_complete',
    MANUAL_GPS = 'manual_gps',
    MANUAL_ADMIN = 'manual_admin'
}

export enum PayrollStatus {
    DRAFT = 'draft',
    CALCULATED = 'calculated',
    APPROVED = 'approved',
    PARTIALLY_PAID = 'partially_paid',
    PAID = 'paid'
}

export enum AdvanceType {
    IMMEDIATE = 'immediate',
    INSTALLMENT = 'installment'
}

export enum AdvanceStatus {
    PENDING = 'pending',
    ACTIVE = 'active',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled'
}

export enum InstallmentStatus {
    PENDING = 'pending',
    DEDUCTED = 'deducted',
    SKIPPED = 'skipped'
}

export enum AdjustmentType {
    DEDUCTION = 'deduction',
    PENALTY = 'penalty',
    BONUS = 'bonus'
}


// =====================================================================
// Core Data Types — matching migration 205 tables
// =====================================================================

/** سجل الحضور والانصراف */
export interface AttendanceRecord {
    id: string
    worker_id: string
    date: string
    check_in_time: string | null
    check_out_time: string | null
    check_in_method: CheckInMethod | null
    check_out_method: CheckOutMethod | null
    check_in_location: { lat: number; lng: number; accuracy?: number } | null
    check_out_location: { lat: number; lng: number; accuracy?: number } | null
    status: AttendanceStatus
    work_hours: number | null
    late_minutes: number
    notes: string | null
    modified_by: string | null
    created_at: string
    updated_at: string
}

/** سجل الحضور مع بيانات العامل */
export interface AttendanceWithWorker extends AttendanceRecord {
    worker?: {
        id: string
        name: string
        phone: string
        salary: number | null
    }
    modified_by_user?: {
        full_name: string
    } | null
}

/** إعدادات موقع الشركة */
export interface CompanyLocation {
    id: string
    name: string
    name_ar: string
    latitude: number
    longitude: number
    radius_meters: number
    work_start_time: string
    is_active: boolean
    created_at: string
    updated_at: string
}

/** مسير الرواتب الشهري */
export interface PayrollPeriod {
    id: string
    month: number
    year: number
    status: PayrollStatus
    total_salaries: number
    total_incentives: number
    total_deductions: number
    total_penalties: number
    total_bonuses: number
    total_advances: number
    total_absence_deductions: number
    total_disbursed: number
    net_total: number
    approved_by: string | null
    approved_at: string | null
    expense_id: string | null
    created_by: string | null
    created_at: string
    updated_at: string
}

/** بند الراتب لكل عامل */
export interface PayrollItem {
    id: string
    payroll_period_id: string
    worker_id: string
    base_salary: number
    total_month_days: number
    paid_leave_allowance: number
    work_days: number
    absent_days: number
    leave_days: number
    late_days: number
    holiday_days: number
    unpaid_absent_days: number
    daily_rate: number
    absence_deduction: number
    calculated_bonus: number
    manual_incentives: number
    manual_deductions: number
    manual_penalties: number
    manual_bonuses: number
    advance_deduction: number
    net_salary: number
    disbursed_amount: number
    payment_status: 'unpaid' | 'paid'
    // V2 — أعمدة النظام الجديد
    effective_days: number
    required_work_days: number
    public_holiday_days: number
    leave_balance: number
    leave_used: number
    late_penalty_days: number
    late_penalty_amount: number
    worker_start_date: string | null
    worker_end_date: string | null
    created_at: string
    updated_at: string
}

/** بند الراتب مع بيانات العامل */
export interface PayrollItemWithWorker extends PayrollItem {
    worker?: {
        id: string
        name: string
        phone: string
    }
}

/** دفعة صرف رواتب */
export interface PayrollDisbursement {
    id: string
    payroll_period_id: string
    vault_id: string
    amount: number
    expense_id: string | null
    notes: string | null
    disbursed_by: string | null
    worker_ids: string[] | null
    created_at: string
    vault?: {
        id: string
        name: string
    }
}

/** السلفة */
export interface SalaryAdvance {
    id: string
    worker_id: string
    advance_type: AdvanceType
    total_amount: number
    installments_count: number
    installment_amount: number
    remaining_amount: number
    start_month: number
    start_year: number
    status: AdvanceStatus
    reason: string | null
    vault_id: string | null
    approved_by: string | null
    created_by: string | null
    created_at: string
    updated_at: string
}

/** السلفة مع بيانات العامل */
export interface SalaryAdvanceWithWorker extends SalaryAdvance {
    worker?: {
        id: string
        name: string
        phone: string
    }
    approved_by_user?: {
        full_name: string
    } | null
}

/** قسط السلفة */
export interface AdvanceInstallment {
    id: string
    advance_id: string
    month: number
    year: number
    amount: number
    status: InstallmentStatus
    payroll_item_id: string | null
    created_at: string
    updated_at: string
}

/** التسوية اليدوية */
export interface HrAdjustment {
    id: string
    worker_id: string
    type: AdjustmentType
    amount: number
    reason: string
    date: string
    payroll_item_id: string | null
    is_processed: boolean
    created_by: string | null
    created_at: string
    updated_at: string
}

/** التسوية مع بيانات العامل */
export interface HrAdjustmentWithWorker extends HrAdjustment {
    worker?: {
        id: string
        name: string
        phone: string
    }
    created_by_user?: {
        full_name: string
    } | null
}


// =====================================================================
// Insert Types — for creating new records
// =====================================================================

export interface AttendanceInsert {
    worker_id: string
    date?: string
    check_in_time?: string
    check_out_time?: string
    check_in_method?: CheckInMethod
    check_out_method?: CheckOutMethod
    check_in_location?: { lat: number; lng: number; accuracy?: number }
    check_out_location?: { lat: number; lng: number; accuracy?: number }
    status?: AttendanceStatus
    late_minutes?: number
    notes?: string
    modified_by?: string
}

export interface AttendanceUpdate {
    check_in_time?: string | null
    check_out_time?: string | null
    check_in_method?: CheckInMethod | null
    check_out_method?: CheckOutMethod | null
    check_in_location?: { lat: number; lng: number; accuracy?: number } | null
    check_out_location?: { lat: number; lng: number; accuracy?: number } | null
    status?: AttendanceStatus
    late_minutes?: number | null
    notes?: string | null
    modified_by?: string | null
}

export interface CompanyLocationInsert {
    name: string
    name_ar: string
    latitude: number
    longitude: number
    radius_meters?: number
    work_start_time?: string
    is_active?: boolean
}

export interface CompanyLocationUpdate {
    name?: string
    name_ar?: string
    latitude?: number
    longitude?: number
    radius_meters?: number
    work_start_time?: string
    is_active?: boolean
}

export interface AdvanceInsert {
    worker_id: string
    advance_type: AdvanceType
    total_amount: number
    installments_count?: number
    installment_amount: number
    remaining_amount: number
    start_month: number
    start_year: number
    reason?: string
    approved_by?: string
    created_by?: string
}

export interface AdjustmentInsert {
    worker_id: string
    type: AdjustmentType
    amount: number
    reason: string
    date?: string
    created_by?: string
}

export interface AdjustmentUpdate {
    type?: AdjustmentType
    amount?: number
    reason?: string
    date?: string
}


// =====================================================================
// Filter Types
// =====================================================================

export interface AttendanceFilters {
    worker_id?: string
    date?: string
    date_from?: string
    date_to?: string
    status?: AttendanceStatus[]
    search?: string
}

export interface PayrollFilters {
    status?: PayrollStatus[]
    year?: number
}

export interface AdvanceFilters {
    worker_id?: string
    status?: AdvanceStatus[]
    search?: string
}

export interface AdjustmentFilters {
    worker_id?: string
    type?: AdjustmentType[]
    date_from?: string
    date_to?: string
    is_processed?: boolean
    search?: string
}


// =====================================================================
// Summary / Report Types
// =====================================================================

/** ملخص الحضور الشهري لكل عامل */
export interface AttendanceSummary {
    worker_id: string
    worker_name: string
    total_days: number
    present_days: number
    absent_days: number
    leave_days: number
    late_days: number
    holiday_days: number
    total_work_hours: number
    paid_leave_allowance: number
}

/** تقرير الأرباح والخسائر */
export interface ProfitLossReport {
    total_revenue: number
    total_expenses: number
    total_payroll: number
    total_advances: number
    net_profit: number
    revenue_details: RevenueDetail[]
    expense_details: ExpenseDetail[]
    payroll_details: PayrollDetail[]
    advance_details: AdvanceDetail[]
}

export interface RevenueDetail {
    id: string
    invoice_number: string
    amount: number
    date: string
    status: string
}

export interface ExpenseDetail {
    id: string
    description: string
    amount: number
    category: string
    date: string
    status: string
}

export interface PayrollDetail {
    id: string
    month: number
    year: number
    amount: number
    net_total: number
    total_disbursed: number
    total_salaries: number
    total_incentives: number
    total_deductions: number
    total_advances: number
    total_absence_deductions: number
    status: string
    date: string
}

export interface AdvanceDetail {
    id: string
    amount: number
    notes: string
    vault_name: string
    date: string
    worker_name: string
}


// =====================================================================
// Form Types — for UI forms
// =====================================================================

export interface AttendanceForm {
    worker_id: string
    date: string
    status: AttendanceStatus
    check_in_time?: string
    check_out_time?: string
    notes?: string
}

export interface AdvanceForm {
    worker_id: string
    advance_type: AdvanceType
    total_amount: number
    installments_count: number
    start_month: number
    start_year: number
    reason?: string
}

export interface AdjustmentForm {
    worker_id: string
    type: AdjustmentType
    amount: number
    reason: string
    date: string
}

export interface CompanyLocationForm {
    name: string
    name_ar: string
    latitude: number
    longitude: number
    radius_meters: number
    work_start_time: string
}


// =====================================================================
// V2 Types — Migration 210
// =====================================================================

/** عطلة رسمية */
export interface PublicHoliday {
    id: string
    name: string
    date: string
    year: number
    is_active: boolean
    created_at: string
    updated_at: string
}

/** قاعدة جزاء */
export interface PenaltyRule {
    id: string
    name: string
    name_ar: string
    type: 'late' | 'absent' | 'early_leave'
    min_minutes: number
    max_minutes: number | null
    deduction_days: number
    grace_count: number
    is_active: boolean
    sort_order: number
    created_at: string
    updated_at: string
}
