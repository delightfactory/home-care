import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface ChartProps {
  data: any[]
  height?: number
  className?: string
}

// Revenue Trend Chart
export const RevenueTrendChart: React.FC<ChartProps> = ({ data, height = 300, className = '' }) => {
  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="date" 
            className="text-sm text-gray-600"
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            className="text-sm text-gray-600"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${value.toLocaleString()} ج.م`}
          />
          <Tooltip 
            formatter={(value: any) => [`${value.toLocaleString()} ج.م`, 'الإيرادات']}
            labelFormatter={(label) => `التاريخ: ${label}`}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Area 
            type="monotone" 
            dataKey="revenue" 
            stroke="#10b981" 
            fill="url(#revenueGradient)" 
            strokeWidth={2}
          />
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// Orders Status Chart
export const OrdersStatusChart: React.FC<ChartProps> = ({ data, height = 300, className = '' }) => {
  const COLORS = {
    pending: '#f59e0b',
    scheduled: '#3b82f6',
    in_progress: '#8b5cf6',
    completed: '#10b981',
    cancelled: '#ef4444'
  }

  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.status as keyof typeof COLORS] || '#6b7280'} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: any) => [value, 'عدد الطلبات']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

// Team Performance Chart
export const TeamPerformanceChart: React.FC<ChartProps> = ({ data, height = 300, className = '' }) => {
  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="team_name" 
            className="text-sm text-gray-600"
            tick={{ fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            className="text-sm text-gray-600"
            tick={{ fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          />
          <Legend />
          <Bar dataKey="completed_orders" fill="#10b981" name="الطلبات المكتملة" radius={[4, 4, 0, 0]} />
          <Bar dataKey="total_revenue" fill="#3b82f6" name="الإيرادات" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Weekly Trends Chart
export const WeeklyTrendsChart: React.FC<ChartProps> = ({ data, height = 300, className = '' }) => {
  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="week_start" 
            className="text-sm text-gray-600"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => new Date(value).toLocaleDateString('ar-AE', { month: 'short', day: 'numeric' })}
          />
          <YAxis 
            className="text-sm text-gray-600"
            tick={{ fontSize: 12 }}
          />
          <Tooltip 
            labelFormatter={(label) => `الأسبوع: ${new Date(label).toLocaleDateString('ar-AE')}`}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="total_orders" 
            stroke="#3b82f6" 
            strokeWidth={3}
            name="إجمالي الطلبات"
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
          />
          <Line 
            type="monotone" 
            dataKey="total_revenue" 
            stroke="#10b981" 
            strokeWidth={3}
            name="الإيرادات"
            dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
          />
          <Line 
            type="monotone" 
            dataKey="net_profit" 
            stroke="#8b5cf6" 
            strokeWidth={3}
            name="صافي الربح"
            dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Trend Indicator Component
interface TrendIndicatorProps {
  trend: {
    direction: 'up' | 'down' | 'stable'
    percentage: number
  }
  className?: string
}

export const TrendIndicator: React.FC<TrendIndicatorProps> = ({ trend, className = '' }) => {
  const getIcon = () => {
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="h-4 w-4" />
      case 'down':
        return <TrendingDown className="h-4 w-4" />
      default:
        return <Minus className="h-4 w-4" />
    }
  }

  const getColor = () => {
    switch (trend.direction) {
      case 'up':
        return 'text-green-600 bg-green-100'
      case 'down':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-full text-sm font-medium ${getColor()} ${className}`}>
      {getIcon()}
      <span className="mr-1">
        {trend.percentage.toFixed(1)}%
      </span>
    </div>
  )
}

// Quarterly Comparison Chart
export const QuarterlyComparisonChart: React.FC<ChartProps> = ({ data, height = 300, className = '' }) => {
  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="quarter_label" 
            className="text-sm text-gray-600"
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            className="text-sm text-gray-600"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
          />
          <Tooltip 
            formatter={(value: any) => [`${value.toLocaleString()} ج.م`, '']}
            labelFormatter={(label) => `الربع: ${label}`}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          />
          <Legend />
          <Bar dataKey="total_revenue" fill="#10b981" name="الإيرادات" radius={[4, 4, 0, 0]} />
          <Bar dataKey="total_expenses" fill="#ef4444" name="المصروفات" radius={[4, 4, 0, 0]} />
          <Bar dataKey="net_profit" fill="#3b82f6" name="صافي الربح" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}