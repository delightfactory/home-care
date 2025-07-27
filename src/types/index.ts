// Application Types for Home Cleaning Service Management System
import { Database } from './database.types'

// ISO date helpers
export type ISODate = string       // e.g., '2025-07-21'
export type ISODateTime = string   // full ISO timestamp

// Database table types
export type Role = Database['public']['Tables']['roles']['Row']
export type User = Database['public']['Tables']['users']['Row']
export type Customer = Database['public']['Tables']['customers']['Row']
export type ServiceCategory = Database['public']['Tables']['service_categories']['Row']
export type Service = Database['public']['Tables']['services']['Row']
export type Worker = Database['public']['Tables']['workers']['Row']
export type Team = Database['public']['Tables']['teams']['Row']
export type TeamMember = Database['public']['Tables']['team_members']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type OrderItem = Database['public']['Tables']['order_items']['Row']
export type OrderStatusLog = Database['public']['Tables']['order_status_logs']['Row']
export type Route = Database['public']['Tables']['routes']['Row']
export type RouteOrder = Database['public']['Tables']['route_orders']['Row']
export type ExpenseCategory = Database['public']['Tables']['expense_categories']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']
export type DailyReport = Database['public']['Tables']['daily_reports']['Row']
export type TeamPerformance = Database['public']['Tables']['team_performance']['Row']
export type SystemSetting = Database['public']['Tables']['system_settings']['Row']

// Insert types
export type CustomerInsert = Database['public']['Tables']['customers']['Insert']
export type ServiceInsert = Database['public']['Tables']['services']['Insert']
export type WorkerInsert = Database['public']['Tables']['workers']['Insert']
export type TeamInsert = Database['public']['Tables']['teams']['Insert']
export type OrderInsert = Database['public']['Tables']['orders']['Insert']
export type OrderItemInsert = Database['public']['Tables']['order_items']['Insert']
export type ExpenseInsert = Database['public']['Tables']['expenses']['Insert']
export type ExpenseCategoryInsert = Database['public']['Tables']['expense_categories']['Insert']
export type DailyReportInsert = Database['public']['Tables']['daily_reports']['Insert']
export type TeamPerformanceInsert = Database['public']['Tables']['team_performance']['Insert']
export type RouteInsert = Database['public']['Tables']['routes']['Insert']
export type RouteOrderInsert = Database['public']['Tables']['route_orders']['Insert']
export type OrderStatusLogInsert = Database['public']['Tables']['order_status_logs']['Insert']
export type TeamMemberInsert = Database['public']['Tables']['team_members']['Insert']
export type SystemSettingInsert = Database['public']['Tables']['system_settings']['Insert']

// Update types
export type CustomerUpdate = Database['public']['Tables']['customers']['Update']
export type ServiceUpdate = Database['public']['Tables']['services']['Update']
export type WorkerUpdate = Database['public']['Tables']['workers']['Update']
export type TeamUpdate = Database['public']['Tables']['teams']['Update']
export type OrderUpdate = Database['public']['Tables']['orders']['Update']
export type ExpenseUpdate = Database['public']['Tables']['expenses']['Update']
export type ExpenseCategoryUpdate = Database['public']['Tables']['expense_categories']['Update']
export type DailyReportUpdate = Database['public']['Tables']['daily_reports']['Update']
export type TeamPerformanceUpdate = Database['public']['Tables']['team_performance']['Update']
export type RouteUpdate = Database['public']['Tables']['routes']['Update']
export type RouteOrderUpdate = Database['public']['Tables']['route_orders']['Update']
export type OrderStatusLogUpdate = Database['public']['Tables']['order_status_logs']['Update']
export type TeamMemberUpdate = Database['public']['Tables']['team_members']['Update']
export type SystemSettingUpdate = Database['public']['Tables']['system_settings']['Update']

// Enums and Constants
export enum OrderStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum ConfirmationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  DECLINED = 'declined'
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PAID_CASH = 'paid_cash',
  PAID_CARD = 'paid_card'
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card'
}

export enum TransportMethod {
  COMPANY_CAR = 'company_car',
  TAXI = 'taxi',
  UBER = 'uber',
  PUBLIC_TRANSPORT = 'public_transport'
}

export enum WorkerStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  VACATION = 'vacation'
}

export enum RouteStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed'
}

export enum ExpenseStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export enum UserRole {
  MANAGER = 'manager',
  OPERATIONS_SUPERVISOR = 'operations_supervisor',
  RECEPTIONIST = 'receptionist',
  TEAM_LEADER = 'team_leader'
}

export enum TeamStatus {
  ACTIVE   = 'active',
  INACTIVE = 'inactive'
}

export enum ServiceUnit {
  SERVICE = 'service',
  HOUR    = 'hour',
  ROOM    = 'room',
  SQM     = 'sqm'
}

// Extended types with relationships
export interface CustomerWithOrders extends Customer {
  orders?: Order[]
  total_orders?: number
  last_order_date?: string
}

export interface ServiceWithCategory extends Service {
  category?: ServiceCategory
}

export interface WorkerWithTeam extends Worker {
  team?: Team
  user?: User
}

export interface TeamWithMembers extends Team {
  members?: TeamMemberWithWorker[]
  leader?: Worker
  member_count?: number
  status: string
  active_orders?: number
}

export interface TeamMemberWithWorker extends TeamMember {
  worker?: Worker
}

export interface OrderWithDetails extends Order {
  customer?: Customer
  customer_name?: string
  customer_phone?: string
  team?: TeamWithMembers
  team_name?: string
  items?: OrderItemWithService[]
  status_logs?: OrderStatusLog[]
  route_info?: {
    route_id: string
    route_name: string
    sequence_order: number
  }
}

export interface OrderItemWithService extends OrderItem {
  service?: Service
}

export interface RouteOrderWithOrder extends RouteOrder {
  order?: Order
}

export interface RouteWithOrders extends Route {
  team?: TeamWithMembers
  orders?: OrderWithDetails[]
  route_orders?: RouteOrderWithOrder[]
}

export interface ExpenseWithDetails extends Expense {
  category?: ExpenseCategory
  order?: Order
  route?: Route
  team?: Team
  created_by_user?: User
  approved_by_user?: User
}

export interface ExpenseWithCategory extends Expense {
  category?: ExpenseCategory
  created_by_user?: User
  approved_by_user?: User
}

export interface MonthlyReport {
  id: string
  month: number
  year: number
  total_orders: number
  completed_orders: number
  total_revenue: number
  total_expenses: number
  net_profit: number
  avg_orders_per_team: number
  avg_rating: number
  new_customers: number
  created_at: string
}

export interface SystemSettings {
  id: string
  key: string
  value: string
  display_name?: string
  description?: string
  data_type: 'string' | 'number' | 'boolean' | 'json'
  category?: string
  created_at: string
  updated_at: string
}

// Form types
export interface CustomerForm {
  name: string
  phone: string
  address: string
  area?: string
  latitude?: number
  longitude?: number
  is_active?: boolean
  notes?: string
}

export interface ServiceForm {
  category_id: string
  name: string
  name_ar: string
  description?: string
  price: number
  unit: string
  estimated_duration?: number
}

export interface WorkerForm {
  name: string
  phone: string
  hire_date: string
  salary?: number
  skills: string[]
  can_drive: boolean
  status?: string
}

export interface TeamForm {
  name: string
  leader_id?: string
  description?: string
  member_ids: string[]
  is_active?: boolean
}

export interface OrderForm {
  customer_id: string
  scheduled_date: string
  scheduled_time: string
  services: {
    service_id: string
    quantity: number
  }[]
  team_id?: string
  payment_status?: PaymentStatus
  payment_method?: PaymentMethod
  transport_method?: TransportMethod
  notes?: string
}

export interface ExpenseForm {
  category_id: string
  amount: number
  description: string
  order_id?: string
  route_id?: string
  team_id?: string
  receipt_image_url?: string
}

// API Response types


export interface OrderCounts {
  total: number
  pending: number
  scheduled: number
  in_progress: number
  completed: number
  cancelled: number
}

export interface CustomerCounts {
  total: number
  active: number
  inactive: number
}

export interface RouteCounts {
  total: number
  planned: number
  in_progress: number
  completed: number
}

// Aggregate counts for expenses
export interface ExpenseCounts {
  total: number
  pending: number
  approved: number
  rejected: number
}

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  total_pages: number
}

// Dashboard types
export interface DashboardStats {
  today_orders: number
  pending_orders: number
  active_routes: number
  total_revenue: number
  total_expenses: number
  net_profit: number
  active_teams: number
  inactive_teams: number
  total_teams: number
  average_rating: number
}

export interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor?: string[]
    borderColor?: string[]
  }[]
}

// -------- Views Interfaces --------
export interface DailyDashboard {
  report_date: ISODate
  total_orders: number
  completed_orders: number
  cancelled_orders: number
  total_revenue: number
  total_expenses: number
  net_profit: number
  active_teams: number
  average_rating: number
}

export interface TeamSummary {
  team_id: string
  team_name: string
  orders_completed: number
  total_revenue: number
  total_expenses: number
  average_rating: number
  efficiency_score: number
}

export interface CustomerHistory {
  id: string
  name: string
  phone: string
  area: string
  total_orders: number
  last_order_date: ISODate | null
  avg_rating: number | null
}

export interface WorkerStats {
  worker_id: string
  worker_name: string
  status: WorkerStatus
  rating: number | null
  total_orders: number
  completed_orders: number
  average_rating: number | null
}

// Filter and search types
export interface OrderFilters {
  status?: OrderStatus[]
  confirmation_status?: ConfirmationStatus[]
  payment_status?: PaymentStatus[]
  date_from?: string
  date_to?: string
  customer_id?: string
  team_id?: string
  search?: string
}

export interface CustomerFilters {
  area?: string[]
  is_active?: boolean
  search?: string
}

export interface WorkerFilters {
  status?: WorkerStatus[]
  team_id?: string
  can_drive?: boolean
  search?: string
}

export interface ExpenseFilters {
  status?: ExpenseStatus[]
  category_id?: string
  date_from?: string
  date_to?: string
  team_id?: string
  amount_min?: number
  amount_max?: number
}

// Notification types
export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: string
  read: boolean
  action_url?: string
}

// Settings types
export interface AppSettings {
  transport_rates: {
    company_car: number
    taxi: number
    uber: number
    public_transport: number
  }
  working_hours: {
    start: string
    end: string
  }
  order_number_prefix: string
  company_info: {
    name: string
    phone: string
    address: string
  }
}

// Location types
export interface Location {
  lat: number
  lng: number
  address?: string
}

// File upload types
export interface FileUpload {
  file: File
  preview?: string
  progress?: number
  error?: string
}

// Export all database types
export * from './database.types'
