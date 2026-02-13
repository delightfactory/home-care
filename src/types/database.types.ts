// Database Types for Home Cleaning Service Management System
// Generated based on Supabase schema

export interface Database {
  public: {
    Tables: {
      roles: {
        Row: {
          id: string
          name: string
          name_ar: string
          permissions: Record<string, any>
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          name_ar: string
          permissions?: Record<string, any>
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          name_ar?: string
          permissions?: Record<string, any>
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          role_id: string | null
          full_name: string
          phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role_id?: string | null
          full_name: string
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string




        }
        Update: {
          id?: string
          role_id?: string | null
          full_name?: string
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string




        }
      }
      customer_surveys: {
        Row: {
          id: string
          order_id: string
          survey_token: string
          service_quality_rating: number | null
          staff_professionalism_rating: number | null
          punctuality_rating: number | null
          cleanliness_rating: number | null
          value_for_money_rating: number | null
          overall_rating: number | null
          customer_feedback: string | null
          would_recommend: boolean | null
          improvement_suggestions: string | null
          submitted_at: string | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          survey_token: string
          service_quality_rating?: number | null
          staff_professionalism_rating?: number | null
          punctuality_rating?: number | null
          cleanliness_rating?: number | null
          value_for_money_rating?: number | null
          overall_rating?: number | null
          customer_feedback?: string | null
          would_recommend?: boolean | null
          improvement_suggestions?: string | null
          submitted_at?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          survey_token?: string
          service_quality_rating?: number | null
          staff_professionalism_rating?: number | null
          punctuality_rating?: number | null
          cleanliness_rating?: number | null
          value_for_money_rating?: number | null
          overall_rating?: number | null
          customer_feedback?: string | null
          would_recommend?: boolean | null
          improvement_suggestions?: string | null
          submitted_at?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
          updated_at?: string
        }
      },
      customers: {
        Row: {
          id: string
          name: string
          phone: string
          address: string
          area: string | null
          location_coordinates: string | null
          notes: string | null
          extra_phone: string | null
          referral_source: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          phone: string
          address: string
          area?: string | null
          location_coordinates?: string | null
          notes?: string | null
          extra_phone?: string | null
          referral_source?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string
          address?: string
          area?: string | null
          location_coordinates?: string | null
          notes?: string | null
          extra_phone?: string | null
          referral_source?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      service_categories: {
        Row: {
          id: string
          name: string
          name_ar: string
          description: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          name_ar: string
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          name_ar?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      services: {
        Row: {
          id: string
          category_id: string | null
          name: string
          name_ar: string
          description: string | null
          price: number
          unit: string
          estimated_duration: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category_id?: string | null
          name: string
          name_ar: string
          description?: string | null
          price: number
          unit?: string
          estimated_duration?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string




        }
        Update: {
          id?: string
          category_id?: string | null
          name?: string
          name_ar?: string
          description?: string | null
          price?: number
          unit?: string
          estimated_duration?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string




        }
      }
      workers: {
        Row: {
          id: string
          user_id: string | null
          name: string
          phone: string
          hire_date: string
          salary: number | null
          skills: string[]
          can_drive: boolean
          status: string
          rating: number
          total_orders: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          phone: string
          hire_date: string
          salary?: number | null
          skills?: string[]
          can_drive?: boolean
          status?: string
          rating?: number
          total_orders?: number
          created_at?: string
          updated_at?: string




        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          phone?: string
          hire_date?: string
          salary?: number | null
          skills?: string[]
          can_drive?: boolean
          status?: string
          rating?: number
          total_orders?: number
          created_at?: string
          updated_at?: string




        }
      }
      teams: {
        Row: {
          id: string
          name: string
          leader_id: string | null
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          leader_id?: string | null
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string




        }
        Update: {
          id?: string
          name?: string
          leader_id?: string | null
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string




        }
      }
      team_members: {
        Row: {
          id: string
          team_id: string
          worker_id: string
          joined_at: string
          left_at: string | null
        }
        Insert: {
          id?: string
          team_id: string
          worker_id: string
          joined_at?: string
          left_at?: string | null
        }
        Update: {
          id?: string
          team_id?: string
          worker_id?: string
          joined_at?: string
          left_at?: string | null
        }
      }
      order_workers: {
        Row: {
          id: string
          order_id: string
          worker_id: string | null
          team_id: string | null
          role: string | null
          started_at: string
          finished_at: string | null
          customer_rating: number | null
          performance_score: number | null
        }
        Insert: {
          id?: string
          order_id: string
          worker_id?: string | null
          team_id?: string | null
          role?: string | null
          started_at?: string
          finished_at?: string | null
          customer_rating?: number | null
          performance_score?: number | null
        }
        Update: {
          id?: string
          order_id?: string
          worker_id?: string | null
          team_id?: string | null
          role?: string | null
          started_at?: string
          finished_at?: string | null
          customer_rating?: number | null
          performance_score?: number | null
        }
      }
      orders: {
        Row: {
          id: string
          order_number: string
          customer_id: string
          team_id: string | null
          scheduled_date: string
          scheduled_time: string
          status: string
          total_amount: number
          transport_method: string | null
          transport_cost: number
          payment_status: string
          payment_method: string | null
          notes: string | null
          customer_rating: number | null
          customer_feedback: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          confirmation_status: string
          confirmed_at: string | null
          confirmed_by: string | null
          confirmation_notes: string | null
        }
        Insert: {
          id?: string
          order_number: string
          customer_id: string
          team_id?: string | null
          scheduled_date: string
          scheduled_time: string
          status?: string
          total_amount?: number
          transport_method?: string | null
          transport_cost?: number
          payment_status?: string
          payment_method?: string | null
          notes?: string | null
          customer_rating?: number | null
          customer_feedback?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string




        }
        Update: {
          id?: string
          order_number?: string
          customer_id?: string
          team_id?: string | null
          scheduled_date?: string
          scheduled_time?: string
          status?: string
          total_amount?: number
          transport_method?: string | null
          transport_cost?: number
          payment_status?: string
          payment_method?: string | null
          notes?: string | null
          customer_rating?: number | null
          customer_feedback?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string




        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          service_id: string | null
          quantity: number
          unit_price: number
          total_price: number
          notes: string | null
        }
        Insert: {
          id?: string
          order_id: string
          service_id?: string | null
          quantity?: number
          unit_price: number
          total_price: number
          notes?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          service_id?: string | null
          quantity?: number
          unit_price?: number
          total_price?: number
          notes?: string | null
        }
      }
      order_status_logs: {
        Row: {
          id: string
          order_id: string
          status: string
          notes: string | null
          location_coordinates: string | null
          images: string[]
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          status: string
          notes?: string | null
          location_coordinates?: string | null
          images?: string[]
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          status?: string
          notes?: string | null
          location_coordinates?: string | null
          images?: string[]
          created_by?: string | null
          created_at?: string
        }
      }
      routes: {
        Row: {
          id: string
          name: string
          date: string
          team_id: string | null
          start_time: string | null
          estimated_end_time: string | null
          actual_start_time: string | null
          actual_end_time: string | null
          status: string
          total_distance: number | null
          total_estimated_time: number | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          date: string
          team_id?: string | null
          start_time?: string | null
          estimated_end_time?: string | null
          actual_start_time?: string | null
          actual_end_time?: string | null
          status?: string
          total_distance?: number | null
          total_estimated_time?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string




        }
        Update: {
          id?: string
          name?: string
          date?: string
          team_id?: string | null
          start_time?: string | null
          estimated_end_time?: string | null
          actual_start_time?: string | null
          actual_end_time?: string | null
          status?: string
          total_distance?: number | null
          total_estimated_time?: number | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string




        }
      }
      route_orders: {
        Row: {
          id: string
          route_id: string
          order_id: string
          sequence_order: number
          estimated_arrival_time: string | null
          actual_arrival_time: string | null
          estimated_completion_time: string | null
          actual_completion_time: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          route_id: string
          order_id: string
          sequence_order: number
          estimated_arrival_time?: string | null
          actual_arrival_time?: string | null
          estimated_completion_time?: string | null
          actual_completion_time?: string | null
          created_at?: string
          updated_at?: string




        }
        Update: {
          id?: string
          route_id?: string
          order_id?: string
          sequence_order?: number
          estimated_arrival_time?: string | null
          actual_arrival_time?: string | null
          estimated_completion_time?: string | null
          actual_completion_time?: string | null
          created_at?: string
          updated_at?: string




        }
      }
      expense_categories: {
        Row: {
          id: string
          name: string
          name_ar: string
          description: string | null
          requires_approval: boolean
          approval_limit: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          name_ar: string
          description?: string | null
          requires_approval?: boolean
          approval_limit?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          name_ar?: string
          description?: string | null
          requires_approval?: boolean
          approval_limit?: number | null
          is_active?: boolean
          created_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          category_id: string | null
          order_id: string | null
          route_id: string | null
          team_id: string | null
          amount: number
          description: string
          receipt_image_url: string | null
          status: string
          approved_by: string | null
          approved_at: string | null
          rejection_reason: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category_id?: string | null
          order_id?: string | null
          route_id?: string | null
          team_id?: string | null
          amount: number
          description: string
          receipt_image_url?: string | null
          status?: string
          approved_by?: string | null
          approved_at?: string | null
          rejection_reason?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string




        }
        Update: {
          id?: string
          category_id?: string | null
          order_id?: string | null
          route_id?: string | null
          team_id?: string | null
          amount?: number
          description?: string
          receipt_image_url?: string | null
          status?: string
          approved_by?: string | null
          approved_at?: string | null
          rejection_reason?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string




        }
      }
      daily_reports: {
        Row: {
          id: string
          report_date: string
          total_orders: number
          completed_orders: number
          cancelled_orders: number
          total_revenue: number
          total_expenses: number
          net_profit: number
          active_teams: number
          average_rating: number
          generated_at: string
          generated_by: string | null
        }
        Insert: {
          id?: string
          report_date: string
          total_orders?: number
          completed_orders?: number
          cancelled_orders?: number
          total_revenue?: number
          total_expenses?: number
          net_profit?: number
          active_teams?: number
          average_rating?: number
          generated_at?: string
          generated_by?: string | null
        }
        Update: {
          id?: string
          report_date?: string
          total_orders?: number
          completed_orders?: number
          cancelled_orders?: number
          total_revenue?: number
          total_expenses?: number
          net_profit?: number
          active_teams?: number
          average_rating?: number
          generated_at?: string
          generated_by?: string | null
        }
      }
      team_performance: {
        Row: {
          id: string
          team_id: string | null
          date: string
          orders_completed: number
          total_revenue: number
          total_expenses: number
          average_rating: number
          efficiency_score: number
          created_at: string
        }
        Insert: {
          id?: string
          team_id?: string | null
          date: string
          orders_completed?: number
          total_revenue?: number
          total_expenses?: number
          average_rating?: number
          efficiency_score?: number
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string | null
          date?: string
          orders_completed?: number
          total_revenue?: number
          total_expenses?: number
          average_rating?: number
          efficiency_score?: number
          created_at?: string
        }
      }
      system_settings: {
        Row: {
          id: string
          key: string
          value: Record<string, any>
          description: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: Record<string, any>
          description?: string | null
          updated_by?: string | null
          updated_at?: string




        }
        Update: {
          id?: string
          key?: string
          value?: Record<string, any>
          description?: string | null
          updated_by?: string | null
          updated_at?: string
        }
      }
      // =====================
      // Financial System Tables
      // =====================
      invoices: {
        Row: {
          id: string
          invoice_number: string
          order_id: string | null
          customer_id: string
          team_id: string | null
          subtotal: number
          discount: number
          total_amount: number
          paid_amount: number
          status: string
          payment_method: string | null
          payment_proof_url: string | null
          collected_by: string | null
          collected_at: string | null
          cancelled_by: string | null
          cancelled_at: string | null
          cancellation_reason: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_number?: string
          order_id?: string | null
          customer_id: string
          team_id?: string | null
          subtotal?: number
          discount?: number
          total_amount?: number
          paid_amount?: number
          status?: string
          payment_method?: string | null
          payment_proof_url?: string | null
          collected_by?: string | null
          collected_at?: string | null
          cancelled_by?: string | null
          cancelled_at?: string | null
          cancellation_reason?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invoice_number?: string
          order_id?: string | null
          customer_id?: string
          team_id?: string | null
          subtotal?: number
          discount?: number
          total_amount?: number
          paid_amount?: number
          status?: string
          payment_method?: string | null
          payment_proof_url?: string | null
          collected_by?: string | null
          collected_at?: string | null
          cancelled_by?: string | null
          cancelled_at?: string | null
          cancellation_reason?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          service_id: string | null
          description: string
          quantity: number
          unit_price: number
          total_price: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          service_id?: string | null
          description: string
          quantity?: number
          unit_price: number
          total_price: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          service_id?: string | null
          description?: string
          quantity?: number
          unit_price?: number
          total_price?: number
          created_at?: string
        }
      }
      vaults: {
        Row: {
          id: string
          name: string
          name_ar: string
          type: string
          balance: number
          is_active: boolean
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          name_ar: string
          type?: string
          balance?: number
          is_active?: boolean
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          name_ar?: string
          type?: string
          balance?: number
          is_active?: boolean
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      vault_transactions: {
        Row: {
          id: string
          vault_id: string
          target_vault_id: string | null
          type: string
          amount: number
          balance_after: number
          reference_type: string | null
          reference_id: string | null
          notes: string | null
          performed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          vault_id: string
          target_vault_id?: string | null
          type: string
          amount: number
          balance_after: number
          reference_type?: string | null
          reference_id?: string | null
          notes?: string | null
          performed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          vault_id?: string
          target_vault_id?: string | null
          type?: string
          amount?: number
          balance_after?: number
          reference_type?: string | null
          reference_id?: string | null
          notes?: string | null
          performed_by?: string | null
          created_at?: string
        }
      }
      custody_accounts: {
        Row: {
          id: string
          user_id: string
          holder_type: string
          team_id: string | null
          balance: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          holder_type: string
          team_id?: string | null
          balance?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          holder_type?: string
          team_id?: string | null
          balance?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      custody_transactions: {
        Row: {
          id: string
          custody_id: string
          type: string
          amount: number
          balance_after: number
          target_custody_id: string | null
          target_vault_id: string | null
          reference_type: string | null
          reference_id: string | null
          notes: string | null
          performed_by: string
          created_at: string
        }
        Insert: {
          id?: string
          custody_id: string
          type: string
          amount: number
          balance_after: number
          target_custody_id?: string | null
          target_vault_id?: string | null
          reference_type?: string | null
          reference_id?: string | null
          notes?: string | null
          performed_by: string
          created_at?: string
        }
        Update: {
          id?: string
          custody_id?: string
          type?: string
          amount?: number
          balance_after?: number
          target_custody_id?: string | null
          target_vault_id?: string | null
          reference_type?: string | null
          reference_id?: string | null
          notes?: string | null
          performed_by?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

