import React, { useState, useEffect, useRef } from 'react'
import {
  Route,
  Users,
  DollarSign,
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  Check,
  XCircle,
  Eye,
  Copy,
  Play,
  ArrowRightLeft,
  Edit,
  Trash2,
  Plus,
  RefreshCw,
  Activity,
  Target,



  Phone,
  MessageSquare,
  MessageCircle,


  Star,

  User,
  Send,
  Crown,
  ListTodo,
  Pencil,
  AlertTriangle,
  Package
} from 'lucide-react'
import html2canvas from 'html2canvas'
import ConfirmStatusModal from '../../components/UI/ConfirmStatusModal'
import ConfirmationStatusPickerModal from '../../components/UI/ConfirmationStatusPickerModal'
import {
  RouteWithOrders,
  ExpenseWithDetails,
  OrderWithDetails,
  WorkerWithTeam,
  ConfirmationStatus,
  Vault
} from '../../types'
import { VaultsAPI } from '../../api/vaults'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { useRouteExtension } from '../../hooks/useRouteExtension'
import toast from 'react-hot-toast'
import {
  useRoutes,
  useTeams,
  useExpenses,
  useSystemHealth
} from '../../hooks/useEnhancedAPI'
import EnhancedAPI from '../../api/enhanced-api'
import { eventBus } from '../../utils/EventBus'
import TransferWorkerModal from '../../components/Modals/TransferWorkerModal'
import OrderFormModal from '../../components/Forms/OrderFormModal'
import OrderDetailsModal from '../../components/Orders/OrderDetailsModal'
import OrderRatingModal from '../../components/Orders/OrderRatingModal'
import ExpenseFormModal from '../../components/Forms/ExpenseFormModal'
import RouteFormModal from '../../components/Forms/RouteFormModal'
import AssignOrdersModal from '../../components/Forms/AssignOrdersModal'
import DeleteConfirmModal from '../../components/UI/DeleteConfirmModal'
import SmartModal from '../../components/UI/SmartModal'
import EnhancedRouteHeader from '../../components/Operations/EnhancedRouteHeader'
import { SurveysAPI, OrdersAPI } from '../../api'
import { buildSurveyUrl, buildWhatsAppSurveyMessage, generateSurveyToken, openWhatsAppTo } from '../../utils/survey'

interface ExpandedSections {
  [routeId: string]: boolean
}

// دالة مساعدة لتنسيق رقم الهاتف لاستخدامه مع واتساب
export const formatPhoneForWhatsApp = (raw: string, defaultCountryCode = '20'): string => {
  let phone = raw.replace(/[^0-9]/g, '') // إبقاء الأرقام فقط
  if (phone.startsWith('00')) {
    phone = phone.slice(2)
  }
  if (phone.startsWith('0')) {
    phone = phone.slice(1)
  }
  if (!phone.startsWith(defaultCountryCode)) {
    phone = defaultCountryCode + phone
  }
  return phone
}

const OperationsPage: React.FC = () => {
  // State management
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({})
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showRouteModal, setShowRouteModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  // حالات نافذة تأكيد تغيير الحالة
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [targetOrder, setTargetOrder] = useState<OrderWithDetails | null>(null)
  const [targetStatus, setTargetStatus] = useState<string | null>(null)
  const [selectedWorker, setSelectedWorker] = useState<WorkerWithTeam | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null)
  const [selectedExpense, setSelectedExpense] = useState<ExpenseWithDetails | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<RouteWithOrders | null>(null)
  const [routeForOrders, setRouteForOrders] = useState<RouteWithOrders | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: string, id: string, name: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [sendingSurvey, setSendingSurvey] = useState(false)

  // Vault selection state for expense approval fallback
  const [showVaultModal, setShowVaultModal] = useState(false)
  const [vaults, setVaults] = useState<Vault[]>([])
  const [pendingExpenseForVault, setPendingExpenseForVault] = useState<ExpenseWithDetails | null>(null)
  const [vaultLoading, setVaultLoading] = useState(false)
  const [vaultModalInfo, setVaultModalInfo] = useState<{ code: string; currentBalance?: number; requiredAmount?: number } | null>(null)
  const orderExportRef = useRef<HTMLDivElement>(null)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')

  // حالات نافذة تأكيد تغيير حالة خط السير
  const [routeStatusConfirm, setRouteStatusConfirm] = useState<{ route: RouteWithOrders; action: 'start' | 'complete' } | null>(null)
  const [routeStatusLoading, setRouteStatusLoading] = useState(false)

  // Additional states for imported functionality from OrdersPage
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showFormModal, setShowFormModal] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [detailsOrderId, setDetailsOrderId] = useState<string | undefined>()
  const [ratingOrderId, setRatingOrderId] = useState<string | undefined>()
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  // حالات اختيار تأكيد العميل
  const [showConfirmationPicker, setShowConfirmationPicker] = useState(false)
  const [confirmationLoading, setConfirmationLoading] = useState(false)
  const [selectedConfirmationOrder, setSelectedConfirmationOrder] = useState<OrderWithDetails | null>(null)

  const { user } = useAuth()
  const permissions = usePermissions()
  const { canApproveExpense, hasRole } = permissions
  const isSupervisor = hasRole('operations_supervisor')
  const hidePhone = isSupervisor

  // Data hooks
  const { routes, loading: routesLoading, error: routesError, refresh: refreshRoutes } = useRoutes(
    { date: selectedDate }, 1, 50
  )
  const { teams, loading: teamsLoading, refresh: refreshTeams } = useTeams()
  const { data: expenses, loading: expensesLoading, refresh: refreshExpenses } = useExpenses(
    { date_from: `${selectedDate}T00:00:00`, date_to: `${selectedDate}T23:59:59` }, 1, 100
  )
  const { health, refresh: refreshHealth } = useSystemHealth()
  const extension = useRouteExtension(permissions, refreshRoutes)

  // Auto-refresh data when date changes
  useEffect(() => {
    refreshRoutes()
    refreshExpenses()
  }, [selectedDate])

  // Smart real-time updates with debouncing
  const debounceTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({})

  const debouncedRefresh = (key: string, refreshFn: () => void, delay = 300) => {
    if (debounceTimeouts.current[key]) {
      clearTimeout(debounceTimeouts.current[key])
    }

    debounceTimeouts.current[key] = setTimeout(() => {
      refreshFn()
      delete debounceTimeouts.current[key]
    }, delay)
  }

  useEffect(() => {
    const unsubscribeRoutes = eventBus.on('routes:changed', () => {
      debouncedRefresh('routes', refreshRoutes)
    })

    const unsubscribeOrders = eventBus.on('orders:changed', () => {
      // Only refresh routes if orders change, with debouncing
      debouncedRefresh('orders-routes', refreshRoutes)
    })

    const unsubscribeExpenses = eventBus.on('expenses:changed', () => {
      debouncedRefresh('expenses', refreshExpenses)
    })

    const unsubscribeTeams = eventBus.on('teams:changed', () => {
      debouncedRefresh('teams', refreshTeams)
    })

    return () => {
      // Clear all pending timeouts
      Object.values(debounceTimeouts.current).forEach(timeout => clearTimeout(timeout))
      debounceTimeouts.current = {}

      unsubscribeRoutes()
      unsubscribeOrders()
      unsubscribeExpenses()
      unsubscribeTeams()
    }
  }, [refreshRoutes, refreshExpenses, refreshTeams])

  // Toggle route expansion
  const toggleRouteExpansion = (routeId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [routeId]: !prev[routeId]
    }))
  }

  // Helper functions for order details
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': 'في الانتظار',
      'scheduled': 'مجدول',
      'in_progress': 'قيد التنفيذ',
      'completed': 'مكتمل',
      'cancelled': 'ملغي'
    }
    return statusMap[status] || status
  }

  const getConfirmationStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': 'غير مؤكد',
      'confirmed': 'تم التأكيد',
      'declined': 'مرفوض'
    }
    return statusMap[status] || status
  }

  const getOrderStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'pending': 'في الانتظار',
      'scheduled': 'مجدول',
      'in_progress': 'قيد التنفيذ',
      'completed': 'مكتمل',
      'cancelled': 'ملغي'
    }
    return statusMap[status] || status
  }

  // -------- تأكيد تغيير حالة الطلب -----------
  const promptStatusChange = (order: OrderWithDetails, status: string) => {
    if (status === 'cancelled') {
      setSelectedOrder(order)
      setShowCancelModal(true)
      return
    }
    setTargetOrder(order)
    setTargetStatus(status)
    setShowConfirmModal(true)
  }

  const handleConfirmStatusChange = async () => {
    if (!targetOrder || !targetStatus) return
    let notes: string | undefined
    try {
      setConfirmLoading(true)
      toast.loading('جاري تحديث حالة الطلب...', { id: 'statusConfirm' })
      const response = await EnhancedAPI.updateOrderStatus(targetOrder.id, targetStatus, notes, undefined)
      if (response.success) {
        toast.success('تم تحديث حالة الطلب', { id: 'statusConfirm' })
        setShowConfirmModal(false)
        setTargetOrder(null)
        setTargetStatus(null)
      } else {
        throw new Error(response.error || 'فشل في تحديث الحالة')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'حدث خطأ في تحديث الحالة', { id: 'statusConfirm' })
      console.error('Status update error:', error)
      if (targetStatus === 'in_progress') refreshRoutes()
    } finally {
      setConfirmLoading(false)
    }
  }

  // الدالة القديمة للتوافق مع نداءات سابقة
  const handleStatusChange = (order: OrderWithDetails, status: string) => {
    promptStatusChange(order, status)
  }

  // دالة تغيير حالة التأكيد - نفس المنطق المستخدم في صفحة الطلبات
  const getConfirmationBadge = (status?: string | null) => {
    const statusClasses: Record<string, string> = {
      pending: 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border border-amber-200',
      confirmed: 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 border border-emerald-200',
      declined: 'bg-gradient-to-r from-rose-100 to-red-100 text-rose-800 border border-rose-200'
    };

    const statusTexts: Record<string, string> = {
      pending: 'غير مؤكد',
      confirmed: 'تم التأكيد',
      declined: 'مرفوضة'
    };

    // عيّن الحالة الافتراضية إلى pending إذا كانت غير موجودة
    const effectiveStatus: string = (status && status in statusTexts ? status : 'pending');

    const iconMap: Record<string, JSX.Element> = {
      pending: <RefreshCw className="inline-block w-3.5 h-3.5 mr-1" />,
      confirmed: <Check className="inline-block w-3.5 h-3.5 mr-1" />,
      declined: <XCircle className="inline-block w-3.5 h-3.5 mr-1" />
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105 hover:shadow-md cursor-pointer ${statusClasses[effectiveStatus]}`}>
        {iconMap[effectiveStatus]}
        {statusTexts[effectiveStatus]}
      </span>
    );
  };

  const handleConfirmationChange = (order: OrderWithDetails) => {
    setSelectedConfirmationOrder(order)
    setShowConfirmationPicker(true)
  };

  const handleConfirmStatusUpdate = async (newStatus: ConfirmationStatus) => {
    if (!selectedConfirmationOrder) return;

    setConfirmationLoading(true);
    try {
      const response = await EnhancedAPI.updateOrderConfirmationStatus(
        selectedConfirmationOrder.id,
        newStatus,
        undefined,
        undefined
      );

      if (response.success) {
        toast.success('تم تحديث حالة التأكيد بنجاح');
        setShowConfirmationPicker(false);
        setSelectedConfirmationOrder(null);
        // EventBus will handle the refresh automatically via orders:changed event
      } else {
        throw new Error(response.error || 'فشل في تحديث حالة التأكيد');
      }
    } catch (error) {
      toast.error('حدث خطأ في تحديث حالة التأكيد');
      console.error('Confirmation status update error:', error);
    } finally {
      setConfirmationLoading(false);
    }
  }



  // Copy order details as formatted text (ensures including notes by fetching details if missing)
  const copyOrderDetails = async (order: OrderWithDetails, teamName?: string) => {
    try {
      let richOrder: OrderWithDetails = order
      // If notes are not loaded in the current list item, fetch full order details
      if (!order.notes || (typeof order.notes === 'string' && order.notes.trim() === '')) {
        const fresh = await OrdersAPI.getOrderById(order.id)
        if (fresh) {
          richOrder = { ...richOrder, ...fresh }
        }
      }

      const orderDetails = `🏠 تفاصيل الطلب رقم: ${richOrder.order_number}

` +
        `👤 العميل: ${richOrder.customer?.name || 'غير محدد'}\n` +
        `📞 الهاتف: ${hidePhone ? '*****' : (richOrder.customer?.phone || 'غير محدد')}\n` +
        (!hidePhone && richOrder.customer?.extra_phone ? `📞 هاتف إضافي: ${richOrder.customer.extra_phone}\n` : '') +
        `📍 العنوان: ${richOrder.customer?.address || 'غير محدد'}\n` +
        `🏘️ المنطقة: ${richOrder.customer?.area || 'غير محدد'}\n\n` +
        `📅 التاريخ: ${new Date(richOrder.scheduled_date).toLocaleDateString('en-US')}\n` +
        `⏰ الوقت: ${richOrder.scheduled_time}\n` +
        `💰 المبلغ: ${richOrder.total_amount} ج.م\n` +
        `📊 الحالة: ${getStatusText(richOrder.status)}\n` +
        `✅ التأكيد: ${getConfirmationStatusText(richOrder.confirmation_status || 'pending')}\n` +
        `👥 الفريق: ${teamName || 'غير محدد'}\n\n` +
        `📝 الخدمات:\n${richOrder.items?.map(item => `• ${item.service?.name_ar || 'خدمة'} (${item.quantity || 1})`).join('\n') || 'لا توجد خدمات'}\n\n` +
        `📋 ملاحظات: ${(richOrder.notes && richOrder.notes.trim()) ? richOrder.notes : 'لا توجد ملاحظات'}`

      await navigator.clipboard.writeText(orderDetails)
      toast.success('تم نسخ تفاصيل الطلب')
    } catch (error) {
      console.error('Copy order details error:', error)
      toast.error('تعذر نسخ تفاصيل الطلب')
    }
  }

  // Export order as image using existing template from OrderDetailsModal
  const exportOrderAsImage = async (order: OrderWithDetails, teamName?: string) => {
    try {
      setIsExporting(true)

      // Create a temporary container with the same structure as OrderDetailsModal
      const tempContainer = document.createElement('div')
      tempContainer.style.position = 'absolute'
      tempContainer.style.left = '-9999px'
      tempContainer.style.top = '0'
      tempContainer.style.width = '400px'
      tempContainer.style.backgroundColor = 'white'

      // Use the same template structure from OrderDetailsModal
      tempContainer.innerHTML = `
        <div class="bg-white mobile-export">
          <!-- Enhanced Header with Company Logo -->
          <div class="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 relative overflow-hidden">
            <!-- Background Pattern -->
            <div class="absolute inset-0 opacity-10">
              <div class="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-16 -translate-y-16"></div>
              <div class="absolute bottom-0 right-0 w-24 h-24 bg-white rounded-full translate-x-12 translate-y-12"></div>
            </div>
            
            <!-- Header Content -->
            <div class="relative z-10">
              <!-- Company Logo and Info -->
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-lg">
                    <img 
                      src="/icons/icon-192x192.png" 
                      alt="شعار الشركة" 
                      class="w-8 h-8 object-contain"
                      onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');"
                    />
                    <svg class="w-8 h-8 text-blue-600 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                  </div>
                  <div class="text-right">
                    <h2 class="text-lg font-bold">HOME CARE </h2>
                    <p class="text-sm opacity-90">care about your hom</p>
                  </div>
                </div>
                <div class="text-left">
                  <p class="text-sm opacity-90">تاريخ الطباعة</p>
                  <p class="text-base font-semibold">${new Date().toLocaleDateString('en-US')}</p>
                </div>
              </div>
              
              <!-- Order Title -->
              <div class="text-center border-t border-white/20 pt-4">
                <div class="flex items-center justify-center gap-3 mb-2">
                  <div class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                  </div>
                  <h1 class="text-2xl font-bold">تفاصيل الطلب رقم: ${order.order_number || 'غير محدد'}</h1>
                </div>
                <div class="flex items-center justify-center gap-4 text-sm opacity-90">
                  <span>📞 للاستفسار: 01122594454</span>
                  <span>🌐 www.homecare.com</span>
                </div>
              </div>
            </div>
          </div>

          <div class="p-4 space-y-4">
            <!-- Customer Information -->
            <div class="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <h2 class="text-lg font-bold text-gray-800 mb-3">بيانات العميل</h2>
              <div class="space-y-1 text-sm">
                <div class="flex items-center gap-2 p-2 rounded bg-white border border-blue-100">
                  <span class="font-semibold text-gray-700">الاسم:</span>
                  <span class="text-gray-900">${order.customer?.name || 'غير محدد'}</span>
                </div>
                <div class="flex items-center gap-2 p-2 rounded bg-blue-25 border border-blue-100">
                  <span class="font-semibold text-gray-700">الهاتف:</span>
                  <span class="text-gray-900">${hidePhone ? '*****' : (order.customer?.phone || 'غير محدد')}</span>
                </div>
                <div class="flex items-start gap-2 p-2 rounded bg-white border border-blue-100">
                  <span class="font-semibold text-gray-700">العنوان:</span>
                  <span class="text-gray-900 flex-1">${order.customer?.address || 'غير محدد'}</span>
                </div>
                ${order.customer?.area ? `
                <div class="flex items-center gap-2 p-2 rounded bg-blue-25 border border-blue-100">
                  <span class="font-semibold text-gray-700">المنطقة:</span>
                  <span class="text-gray-900">${order.customer.area}</span>
                </div>
                ` : ''}
              </div>
            </div>

            <!-- Order Information -->
            <div class="border border-green-200 rounded-lg p-4 bg-green-50">
              <h2 class="text-lg font-bold text-gray-800 mb-3">بيانات الطلب</h2>
              <div class="grid grid-cols-1 gap-1 text-sm">
                <div class="flex items-center justify-between p-2 rounded bg-white border border-green-100">
                  <span class="font-semibold text-gray-700">التاريخ:</span>
                  <span class="text-gray-900">${order.scheduled_date || 'غير محدد'}</span>
                </div>
                <div class="flex items-center justify-between p-2 rounded bg-green-25 border border-green-100">
                  <span class="font-semibold text-gray-700">الوقت:</span>
                  <span class="text-gray-900">${order.scheduled_time || 'غير محدد'}</span>
                </div>
                <div class="flex items-center justify-between p-2 rounded bg-white border border-green-100">
                  <span class="font-semibold text-gray-700">الحالة:</span>
                  <span class="px-2 py-1 rounded text-xs font-medium ${order.status === 'completed' ? 'bg-green-100 text-green-800' :
          order.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
            order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
        }">${getOrderStatusText(order.status)}</span>
                </div>
                <div class="flex items-center justify-between p-2 rounded bg-green-25 border border-green-100">
                  <span class="font-semibold text-gray-700">المبلغ الإجمالي:</span>
                  <span class="font-bold text-green-700">${order.total_amount || 0} ج.م</span>
                </div>
                <div class="flex items-center justify-between p-2 rounded bg-white border border-green-100">
                  <span class="font-semibold text-gray-700">الفريق:</span>
                  <span class="text-gray-900">${teamName || 'غير محدد'}</span>
                </div>
                ${order.customer_rating ? `
                <div class="flex items-center justify-between p-2 rounded bg-green-25 border border-green-100">
                  <span class="font-semibold text-gray-700">التقييم:</span>
                  <span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">${order.customer_rating}/5</span>
                </div>
                ` : ''}
              </div>
            </div>

            <!-- Services Information -->
            <div class="border border-orange-200 rounded-lg p-4 bg-orange-50">
              <h2 class="text-lg font-bold text-gray-800 mb-3">الخدمات المطلوبة</h2>
              <div class="space-y-1 text-sm">
                ${order.items?.map(item => `
                <div class="flex items-center justify-between p-2 rounded ${item.quantity % 2 === 0 ? 'bg-white' : 'bg-orange-25'} border border-orange-100">
                  <span class="text-gray-900">${item.service?.name_ar || 'خدمة'}</span>
                  <span class="font-semibold text-gray-700">الكمية: ${item.quantity || 1}</span>
                </div>
                `).join('') || '<div class="text-center text-gray-500 py-2">لا توجد خدمات</div>'}
              </div>
              ${order.notes ? `
              <div class="mt-3 pt-3 border-t border-orange-200">
                <div class="bg-white p-2 rounded border border-orange-100">
                  <span class="font-semibold text-gray-700">ملاحظات:</span>
                  <p class="text-gray-900 mt-1">${order.notes}</p>
                </div>
              </div>
              ` : ''}
            </div>
          </div>
        </div>
      `

      document.body.appendChild(tempContainer)

      // Create mobile-friendly styles
      const exportStyles = document.createElement('style')
      exportStyles.textContent = `
        .mobile-export {
          width: 400px !important;
          font-size: 0.875rem !important;
          background: white !important;
          font-family: Arial, sans-serif !important;
          direction: rtl !important;
        }
        .mobile-export .text-sm {
          font-size: 0.875rem !important;
        }
        .mobile-export .text-xs {
          font-size: 0.75rem !important;
        }
        .mobile-export .text-xl {
          font-size: 1.25rem !important;
        }
        .mobile-export .text-lg {
          font-size: 1.125rem !important;
        }
        .mobile-export .mb-2 {
          margin-bottom: 0.5rem !important;
        }
        .mobile-export .mb-3 {
          margin-bottom: 0.75rem !important;
        }
        .mobile-export .mt-1 {
          margin-top: 0.25rem !important;
        }
        .mobile-export .mt-3 {
          margin-top: 0.75rem !important;
        }
        .mobile-export .pt-3 {
          padding-top: 0.75rem !important;
        }
        .mobile-export .p-2 {
          padding: 0.5rem !important;
        }
        .mobile-export .p-4 {
          padding: 1rem !important;
        }
        .mobile-export .space-y-1 > * + * {
          margin-top: 0.25rem !important;
        }
        .mobile-export .space-y-4 > * + * {
          margin-top: 1rem !important;
        }
        .mobile-export .gap-2 {
          gap: 0.5rem !important;
        }
        .mobile-export .gap-3 {
          gap: 0.75rem !important;
        }
        .mobile-export .gap-1 {
          gap: 0.25rem !important;
        }
        .mobile-export .rounded {
          border-radius: 0.25rem !important;
        }
        .mobile-export .rounded-lg {
          border-radius: 0.5rem !important;
        }
        .mobile-export .border {
          border-width: 1px !important;
        }
        .mobile-export .border-t {
          border-top-width: 1px !important;
        }
        .mobile-export .flex {
          display: flex !important;
        }
        .mobile-export .grid {
          display: grid !important;
        }
        .mobile-export .grid-cols-1 {
          grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
        }
        .mobile-export .items-center {
          align-items: center !important;
        }
        .mobile-export .items-start {
          align-items: flex-start !important;
        }
        .mobile-export .justify-center {
          justify-content: center !important;
        }
        .mobile-export .justify-between {
          justify-content: space-between !important;
        }
        .mobile-export .text-center {
          text-align: center !important;
        }
        .mobile-export .flex-1 {
          flex: 1 1 0% !important;
        }
        .mobile-export .font-bold {
          font-weight: 700 !important;
        }
        .mobile-export .font-semibold {
          font-weight: 600 !important;
        }
        .mobile-export .opacity-90 {
          opacity: 0.9 !important;
        }
        .mobile-export .bg-gradient-to-r {
          background: linear-gradient(to right, #2563eb, #1d4ed8) !important;
        }
        .mobile-export .text-white {
          color: white !important;
        }
        .mobile-export .bg-white {
          background-color: white !important;
        }
        .mobile-export .bg-blue-50 {
          background-color: #eff6ff !important;
        }
        .mobile-export .bg-green-50 {
          background-color: #f0fdf4 !important;
        }
        .mobile-export .bg-orange-50 {
          background-color: #fff7ed !important;
        }
        .mobile-export .border-blue-200 {
          border-color: #bfdbfe !important;
        }
        .mobile-export .border-green-200 {
          border-color: #bbf7d0 !important;
        }
        .mobile-export .border-orange-200 {
          border-color: #fed7aa !important;
        }
        .mobile-export .border-blue-100 {
          border-color: #dbeafe !important;
        }
        .mobile-export .border-green-100 {
          border-color: #dcfce7 !important;
        }
        .mobile-export .border-orange-100 {
          border-color: #ffedd5 !important;
        }
        .mobile-export .text-gray-800 {
          color: #1f2937 !important;
        }
        .mobile-export .text-gray-700 {
          color: #374151 !important;
        }
        .mobile-export .text-gray-900 {
          color: #111827 !important;
        }
        .mobile-export .text-gray-500 {
          color: #6b7280 !important;
        }
        .mobile-export .text-green-700 {
          color: #15803d !important;
        }
        .mobile-export .bg-green-100 {
          background-color: #dcfce7 !important;
        }
        .mobile-export .text-green-800 {
          color: #166534 !important;
        }
        .mobile-export .bg-blue-100 {
          background-color: #dbeafe !important;
        }
        .mobile-export .text-blue-800 {
          color: #1e40af !important;
        }
        .mobile-export .bg-red-100 {
          background-color: #fee2e2 !important;
        }
        .mobile-export .text-red-800 {
          color: #991b1b !important;
        }
        .mobile-export .bg-yellow-100 {
          background-color: #fef3c7 !important;
        }
        .mobile-export .text-yellow-800 {
          color: #92400e !important;
        }
        .mobile-export .px-2 {
          padding-left: 0.5rem !important;
          padding-right: 0.5rem !important;
        }
        .mobile-export .py-1 {
          padding-top: 0.25rem !important;
          padding-bottom: 0.25rem !important;
        }
        .mobile-export .py-2 {
          padding-top: 0.5rem !important;
          padding-bottom: 0.5rem !important;
        }
      `
      document.head.appendChild(exportStyles)

      const canvas = await html2canvas(tempContainer.firstElementChild as HTMLElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 400,
        height: (tempContainer.firstElementChild as HTMLElement).scrollHeight
      })

      // Clean up
      document.body.removeChild(tempContainer)
      document.head.removeChild(exportStyles)

      // Create download link
      const link = document.createElement('a')
      link.download = `order-${order.order_number || order.id}-${new Date().toISOString().split('T')[0]}.png`
      link.href = canvas.toDataURL()

      // Auto-download
      link.click()

      // Send via WhatsApp if customer phone is available (hidden for supervisor)
      if (!hidePhone && order.customer?.phone) {
        const whatsappMessage = `مرحباً ${order.customer.name || 'عزيزي العميل'},\n\nإليك تفاصيل طلبك رقم: ${order.order_number}\n\nشكراً لثقتكم بنا 🌟`
        const waNumber = formatPhoneForWhatsApp(order.customer.phone)
        const whatsappUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(whatsappMessage)}`
        window.open(whatsappUrl, '_blank')
        toast.success('تم تصدير الطلب وفتح واتساب للإرسال')
      } else {
        toast.success('تم تصدير الطلب كصورة')
      }
    } catch (error) {
      console.error('Export error:', error)
      toast.error('حدث خطأ في تصدير الطلب')
    } finally {
      setIsExporting(false)
    }
  }

  // إرسال رابط استبيان رضا العميل عبر واتساب (للرقم الأساسي والهاتف الإضافي)
  const sendSurveyLink = async (order: OrderWithDetails) => {
    try {
      const primary = hidePhone ? undefined : order.customer?.phone
      const extra = hidePhone ? undefined : order.customer?.extra_phone
      if (!primary && !extra) {
        toast.error('لا يوجد رقم هاتف لإرسال الاستبيان')
        return
      }

      setSendingSurvey(true)

      // 1) جلب الاستبيان إن وُجد لهذا الطلب
      const res = await SurveysAPI.getSurveyByOrder(order.id)
      if (!res.success) {
        throw new Error(res.error || 'تعذر جلب بيانات الاستبيان')
      }

      // 2) تحديد / إنشاء التوكن
      let token: string
      if (res.data) {
        if (res.data.submitted_at) {
          toast.error('تم إرسال هذا الاستبيان مسبقاً وتمت الإجابة عليه')
          return
        }
        token = res.data.survey_token
      } else {
        const newToken = generateSurveyToken(32)
        const createRes = await SurveysAPI.createSurvey({
          order_id: order.id,
          survey_token: newToken
        })
        if (!createRes.success || !createRes.data) {
          throw new Error(createRes.error || 'تعذر إنشاء الاستبيان')
        }
        token = createRes.data.survey_token
      }

      // 3) بناء الرابط والرسالة
      const url = buildSurveyUrl(token)
      const message = buildWhatsAppSurveyMessage({
        orderNumber: (order as any).order_number?.toString?.() || undefined,
        customerName: order.customer?.name || undefined,
        url
      })

      // 4) فتح واتساب للأرقام المتاحة (بدون تكرار)
      const numbers = [primary, extra].filter(Boolean) as string[]
      const unique = Array.from(new Set(numbers))
      unique.forEach((num) => openWhatsAppTo(num, message))

      toast.success('تم فتح واتساب لإرسال رابط الاستبيان')
    } catch (error) {
      console.error('sendSurveyLink error:', error)
      toast.error(error instanceof Error ? error.message : 'حدث خطأ أثناء تجهيز رابط الاستبيان')
    } finally {
      setSendingSurvey(false)
    }
  }

  // Handle worker transfer
  const handleTransferWorker = (worker: WorkerWithTeam) => {
    setSelectedWorker(worker)
    setShowTransferModal(true)
  }



  // Handle expense actions
  const handleExpenseAction = async (action: string, expense: ExpenseWithDetails) => {
    switch (action) {
      case 'approve':
        await handleApproveExpenseFinancial(expense)
        return
      case 'reject': {
        const reason = window.prompt('أدخل سبب الرفض:')
        if (reason === null) return
        setLoading(true)
        try {
          const result = await EnhancedAPI.rejectExpense(expense.id, reason, user?.id || '')
          if (result?.success) {
            toast.success(result.message || 'تم رفض المصروف')
          } else {
            toast.error(result?.error || 'حدث خطأ')
          }
        } catch (error) {
          toast.error('حدث خطأ أثناء رفض المصروف')
        } finally {
          setLoading(false)
        }
        return
      }
      case 'edit':
        setSelectedExpense(expense)
        setShowExpenseModal(true)
        return
      case 'delete':
        setDeleteTarget({ type: 'expense', id: expense.id, name: expense.description })
        setShowDeleteModal(true)
        return
      default:
        return
    }
  }

  // Approve expense with financial deduction (custody first, vault fallback)
  const handleApproveExpenseFinancial = async (expense: ExpenseWithDetails) => {
    // Permission check
    if (!canApproveExpense(expense.amount)) {
      toast.error('ليس لديك صلاحية للموافقة على هذا المبلغ')
      return
    }
    setLoading(true)
    try {
      const res = await EnhancedAPI.approveExpenseFromCustody(expense.id, user?.id || '')

      if (res.success) {
        toast.success(`تم اعتماد المصروف وخصمه من العهدة ✅\nالرصيد الجديد: ${res.data?.new_custody_balance?.toLocaleString()} ج.م`, { duration: 4000 })
        return
      }

      // If NO_CUSTODY or INSUFFICIENT_BALANCE → show vault selector
      const errorData = res as any
      const errorCode = errorData?.data?.code
      if (errorCode === 'NO_CUSTODY' || errorCode === 'INSUFFICIENT_BALANCE') {
        const msg = errorCode === 'NO_CUSTODY'
          ? 'لا توجد عُهدة للمنشئ — اختر خزنة للخصم'
          : 'رصيد العهدة غير كافٍ — اختر خزنة للخصم'
        toast(msg, { icon: '⚠️', duration: 3000 })
        setPendingExpenseForVault(expense)
        setVaultModalInfo({
          code: errorCode,
          currentBalance: errorData?.data?.current_balance,
          requiredAmount: errorData?.data?.required_amount
        })
        setVaultLoading(true)
        setShowVaultModal(true)
        try {
          const vaultList = await VaultsAPI.getVaults(true)
          setVaults(vaultList)
        } catch {
          toast.error('تعذر تحميل الخزائن')
          setShowVaultModal(false)
        } finally {
          setVaultLoading(false)
        }
        return
      }

      toast.error(res.error || 'فشل في اعتماد المصروف')
    } catch (error) {
      toast.error('حدث خطأ أثناء الموافقة')
      console.error('Approve expense error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle vault selection for expense approval
  const handleVaultApproveOps = async (vaultId: string) => {
    if (!pendingExpenseForVault) return
    setLoading(true)
    try {
      const res = await EnhancedAPI.approveExpenseFromVault(pendingExpenseForVault.id, vaultId, user?.id || '')
      if (!res.success) {
        toast.error(res.error || 'فشل في اعتماد المصروف من الخزنة')
        return
      }
      toast.success(`تم اعتماد المصروف وخصمه من الخزنة ✅\nالرصيد الجديد: ${res.data?.new_vault_balance?.toLocaleString()} ج.م`, { duration: 4000 })
      setShowVaultModal(false)
      setPendingExpenseForVault(null)
    } catch (error) {
      toast.error('حدث خطأ أثناء الخصم من الخزنة')
      console.error('Vault approve error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle start route — show confirmation modal
  const handleStartRoute = (route: RouteWithOrders) => {
    setRouteStatusConfirm({ route, action: 'start' })
  }

  // Handle complete route — show confirmation modal
  const handleCompleteRoute = (route: RouteWithOrders) => {
    setRouteStatusConfirm({ route, action: 'complete' })
  }

  // Confirm route status change (actual API call)
  const confirmRouteStatusChange = async () => {
    if (!routeStatusConfirm) return
    setRouteStatusLoading(true)
    try {
      const { route, action } = routeStatusConfirm
      if (action === 'start') {
        const res = await EnhancedAPI.startRoute(route.id)
        if (!res.success) throw new Error(res.error)
        toast.success('تم بدء خط السير')
      } else {
        const res = await EnhancedAPI.completeRoute(route.id)
        if (!res.success) throw new Error(res.error)
        toast.success('تم إكمال خط السير')
      }
    } catch (error) {
      toast.error(routeStatusConfirm.action === 'start' ? 'تعذر بدء خط السير' : 'تعذر إكمال خط السير')
      console.error(error)
    } finally {
      setRouteStatusLoading(false)
      setRouteStatusConfirm(null)
    }
  }

  // Handle delete route
  const handleDeleteRoute = async (route: RouteWithOrders) => {
    try {
      const res = await EnhancedAPI.deleteRoute(route.id)
      if (!res.success) throw new Error(res.error)
      toast.success('تم حذف خط السير')
      setShowDeleteModal(false)
      // EventBus will handle the refresh automatically via routes:changed event
    } catch (error) {
      toast.error('تعذر حذف خط السير')
      console.error(error)
    }
  }



  // Handle delete confirmation
  const handleDelete = async () => {
    if (!deleteTarget) return

    setLoading(true)
    try {
      let result
      switch (deleteTarget.type) {
        case 'order':
          result = await EnhancedAPI.deleteOrder(deleteTarget.id)
          break
        case 'expense':
          result = await EnhancedAPI.deleteExpense(deleteTarget.id)
          break
        case 'route':
          result = await EnhancedAPI.deleteRoute(deleteTarget.id)
          break
        default:
          return
      }

      if (result?.success) {
        toast.success(result.message || 'تم الحذف بنجاح')
        // EventBus will handle the refresh automatically via respective changed events
      } else {
        toast.error(result?.error || 'حدث خطأ')
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء الحذف')
    } finally {
      setLoading(false)
      setShowDeleteModal(false)
      setDeleteTarget(null)
    }
  }

  // Get status badge component
  const getStatusBadge = (status: string, type: 'order' | 'route' | 'expense') => {
    const statusConfig = {
      order: {
        pending: { class: 'bg-yellow-100 text-yellow-800', text: 'في الانتظار' },
        confirmed: { class: 'bg-blue-100 text-blue-800', text: 'مؤكد' },
        scheduled: { class: 'bg-purple-100 text-purple-800', text: 'مجدول' },
        in_progress: { class: 'bg-orange-100 text-orange-800', text: 'قيد التنفيذ' },
        completed: { class: 'bg-green-100 text-green-800', text: 'مكتمل' },
        cancelled: { class: 'bg-red-100 text-red-800', text: 'ملغي' }
      },
      route: {
        planned: { class: 'bg-blue-100 text-blue-800', text: 'مخطط' },
        in_progress: { class: 'bg-orange-100 text-orange-800', text: 'قيد التنفيذ' },
        completed: { class: 'bg-green-100 text-green-800', text: 'مكتمل' }
      },
      expense: {
        pending: { class: 'bg-yellow-100 text-yellow-800', text: 'في الانتظار' },
        approved: { class: 'bg-green-100 text-green-800', text: 'موافق عليه' },
        rejected: { class: 'bg-red-100 text-red-800', text: 'مرفوض' }
      }
    }

    const config = statusConfig[type][status as keyof typeof statusConfig[typeof type]] ||
      { class: 'bg-gray-100 text-gray-800', text: status }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${(config as any).class}`}>
        {(config as any).text}
      </span>
    )
  }

  // Calculate daily statistics
  const dailyStats = {
    totalRoutes: routes?.length || 0,
    activeRoutes: routes?.filter((r: any) => r.status === 'in_progress').length || 0,
    completedRoutes: routes?.filter((r: any) => r.status === 'completed').length || 0,
    totalOrders: routes?.reduce((sum: number, route: any) => sum + (route.route_orders?.length || 0), 0) || 0,
    totalExpenses: expenses?.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0) || 0,
    pendingExpenses: expenses?.filter((e: any) => e.status === 'pending').length || 0
  }

  if ((routesLoading || teamsLoading || expensesLoading) && !extension.isOpen) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" text="جاري تحميل بيانات العمليات..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {routesError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p>تعذر تحديث بيانات العمليات. قد تكون البيانات المعروضة قديمة: {routesError}</p>
          <button type="button" onClick={() => refreshRoutes()} className="mt-2 underline">
            إعادة تحميل بيانات العمليات
          </button>
        </div>
      )}
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
            إدارة العمليات اليومية
          </h1>
          <p className="text-gray-600 mt-2 text-sm sm:text-base">
            إدارة شاملة لخطوط السير والطلبات والفرق والمصروفات
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 sm:space-x-4 sm:space-x-reverse">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-full sm:w-auto"
          />
          <button
            onClick={async () => {
              setLoading(true)
              try {
                await Promise.all([
                  refreshRoutes(),
                  refreshExpenses(),
                  refreshTeams(),
                  refreshHealth()
                ])
                toast.success('تم تحديث جميع البيانات بنجاح')
              } catch (error) {
                toast.error('حدث خطأ أثناء تحديث البيانات')
              } finally {
                setLoading(false)
              }
            }}
            className="btn-secondary hover:scale-105 transition-all duration-200 w-full sm:w-auto flex items-center justify-center"
            disabled={loading}
          >
            <RefreshCw className={`h-5 w-5 ml-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">تحديث</span>
            <span className="sm:hidden">تحديث البيانات</span>
          </button>
        </div>
      </div>

      {/* System Health & Statistics - Hidden on mobile */}
      <div className="hidden md:grid grid-cols-1 md:grid-cols-6 gap-4">
        {/* System Health */}
        {health && (
          <div className="card-compact bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">حالة النظام</p>
                <div className="flex items-center mt-1">
                  <div className={`w-2 h-2 rounded-full ml-2 ${health.database?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                  <span className="text-xs text-gray-600">
                    {health.database?.response_time_ms || 0}ms
                  </span>
                </div>
              </div>
              <Activity className="h-5 w-5 text-gray-600" />
            </div>
          </div>
        )}

        {/* Daily Statistics */}
        <div className="card-compact bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">خطوط السير</p>
              <p className="text-xl font-bold text-blue-800">{dailyStats.totalRoutes}</p>
            </div>
            <Route className="h-6 w-6 text-blue-600" />
          </div>
        </div>

        <div className="card-compact bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">نشطة</p>
              <p className="text-xl font-bold text-green-800">{dailyStats.activeRoutes}</p>
            </div>
            <Play className="h-6 w-6 text-green-600" />
          </div>
        </div>

        <div className="card-compact bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">الطلبات</p>
              <p className="text-xl font-bold text-purple-800">{dailyStats.totalOrders}</p>
            </div>
            <Target className="h-6 w-6 text-purple-600" />
          </div>
        </div>

        <div className="card-compact bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">المصروفات</p>
              <p className="text-xl font-bold text-orange-800">{dailyStats.totalExpenses.toFixed(0)} ج.م</p>
            </div>
            <DollarSign className="h-6 w-6 text-orange-600" />
          </div>
        </div>

        <div className="card-compact bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">في الانتظار</p>
              <p className="text-xl font-bold text-red-800">{dailyStats.pendingExpenses}</p>
            </div>
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
        </div>
      </div>

      {/* Routes Management */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <Route className="h-6 w-6 ml-2 text-primary-600" />
            خطوط السير اليومية
          </h2>
          <button
            onClick={() => {
              setSelectedRoute(null)
              setShowRouteModal(true)
            }}
            className="btn-primary hover:scale-105 transition-all duration-200"
          >
            <Plus className="h-4 w-4 ml-2" />
            إضافة خط سير
          </button>
        </div>

        {routes?.length === 0 ? (
          <div className="card-compact text-center py-12">
            <Route className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 text-lg font-medium">لا توجد خطوط سير لهذا التاريخ</p>
            <p className="text-gray-400 text-sm mt-1">ابدأ بإنشاء خط سير جديد</p>
          </div>
        ) : (
          routes?.map((route: any) => (
            <div key={route.id} className="mb-4">
              <EnhancedRouteHeader
                route={route}
                isExpanded={expandedSections[route.id]}
                onToggleExpansion={() => toggleRouteExpansion(route.id)}
                onEdit={(e) => {
                  e.stopPropagation();
                  if (!isSupervisor) {
                    setSelectedRoute(route);
                    setFormMode('edit');
                    setShowRouteModal(true);
                  }
                }}
                onManageOrders={(e) => { e.stopPropagation(); setRouteForOrders(route); setShowAssignModal(true); }}
                onStartRoute={(e) => { e.stopPropagation(); handleStartRoute(route); }}
                onCompleteRoute={(e) => { e.stopPropagation(); handleCompleteRoute(route); }}
                extensionAction={extension.renderAction(route)}
                onDeleteRoute={(e) => { e.stopPropagation(); setSelectedRoute(route); setShowDeleteModal(true); }}
                getStatusBadge={getStatusBadge}
              />
              {/* Legacy header (hidden) */}
              {false && (<div className="p-4">
                {/* Main Header Row */}
                <div
                  className="flex items-start justify-between cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors duration-200"
                  onClick={() => toggleRouteExpansion(route.id)}
                >
                  {/* Left Side - Route Info */}
                  <div className="flex items-start space-x-3 space-x-reverse flex-1 min-w-0">
                    {/* Expand/Collapse Icon */}
                    <div className="flex-shrink-0 mt-1">
                      {expandedSections[route.id] ? (
                        <ChevronUp className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      )}
                    </div>

                    {/* Route Details */}
                    <div className="flex-1 min-w-0">
                      {/* Route Name and Icon */}
                      <div className="flex items-center space-x-2 space-x-reverse mb-2">
                        <MapPin className="h-5 w-5 text-primary-600 flex-shrink-0" />
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{route.name}</h3>
                        {getStatusBadge(route.status, 'route')}
                      </div>

                      {/* Route Basic Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600 mb-3">
                        <span className="flex items-center">
                          <Clock className="h-4 w-4 ml-1 flex-shrink-0" />
                          <span className="truncate">{route.start_time} - {route.end_time}</span>
                        </span>
                        <span className="flex items-center">
                          <Users className="h-4 w-4 ml-1 flex-shrink-0" />
                          <span className="truncate">{route.team?.name || 'غير محدد'}</span>
                        </span>
                        <span className="flex items-center">
                          <Package className="h-4 w-4 ml-1 flex-shrink-0" />
                          <span>{route.route_orders?.length || 0} طلب</span>
                        </span>
                      </div>

                      {/* Smart Performance Summary */}
                      {(() => {
                        const orders = route.route_orders || []
                        const totalOrders = orders.length
                        const completedOrders = orders.filter((ro: any) => ro.order.status === 'completed').length
                        const inProgressOrders = orders.filter((ro: any) => ro.order.status === 'in_progress').length
                        const totalRevenue = orders.reduce((sum: number, ro: any) => sum + (ro.order.total_amount || 0), 0)
                        const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0
                        const avgRating = orders.filter((ro: any) => ro.order.customer_rating).reduce((sum: number, ro: any, _index: number, arr: any[]) => sum + ro.order.customer_rating / arr.length, 0)
                        const hasIssues = orders.some((ro: any) => ro.order.status === 'cancelled' || ro.order.confirmation_status === 'declined')
                        const confirmedOrders = orders.filter((ro: any) => ro.order.confirmation_status === 'confirmed').length

                        if (totalOrders === 0) return null

                        return (
                          <div className="mt-2 space-y-2">
                            {/* Main Progress Bar */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-gray-600 font-medium">التقدم</span>
                                  <span className="font-bold text-gray-800">{completionRate}%</span>
                                </div>
                                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500 ease-out"
                                    style={{ width: `${completionRate}%` }}
                                  ></div>
                                </div>
                              </div>
                              {hasIssues && (
                                <div className="flex items-center bg-red-100 text-red-700 px-2 py-1 rounded-md">
                                  <AlertTriangle className="h-3 w-3 ml-1" />
                                  <span className="text-xs font-medium">تنبيه</span>
                                </div>
                              )}
                            </div>

                            {/* Compact Stats Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                              {/* Orders Status */}
                              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg px-2 py-1.5 border border-blue-200">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-1 space-x-reverse">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    <span className="text-blue-700 font-medium">{completedOrders + inProgressOrders}</span>
                                  </div>
                                  <span className="text-blue-600 text-xs">نشط</span>
                                </div>
                              </div>

                              {/* Revenue */}
                              {totalRevenue > 0 && (
                                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg px-2 py-1.5 border border-green-200">
                                  <div className="flex items-center justify-between">
                                    <span className="text-green-700 font-bold text-xs">{(totalRevenue / 1000).toFixed(1)}ك</span>
                                    <span className="text-green-600 text-xs">ج.م</span>
                                  </div>
                                </div>
                              )}

                              {/* Rating */}
                              {avgRating > 0 && (
                                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg px-2 py-1.5 border border-yellow-200">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-1 space-x-reverse">
                                      <Star className="h-3 w-3 text-yellow-500 fill-current" />
                                      <span className="text-yellow-700 font-bold">{avgRating.toFixed(1)}</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Confirmation Rate */}
                              {confirmedOrders > 0 && (
                                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg px-2 py-1.5 border border-purple-200">
                                  <div className="flex items-center justify-between">
                                    <span className="text-purple-700 font-bold">{Math.round((confirmedOrders / totalOrders) * 100)}%</span>
                                    <span className="text-purple-600 text-xs">تأكيد</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Right Side - Action Buttons */}
                  <div className="flex-shrink-0">
                    <div className="flex items-center space-x-1 space-x-reverse">
                      {/* Primary Actions Group */}
                      <div className="flex items-center space-x-1 space-x-reverse bg-gray-50 rounded-lg p-1">
                        {/* Edit */}
                        {!isSupervisor && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedRoute(route)
                              setFormMode('edit')
                              setShowRouteModal(true)
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-all duration-200 hover:scale-105"
                            title="تعديل"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}

                        {/* Manage Orders */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setRouteForOrders(route)
                            setShowAssignModal(true)
                          }}
                          className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-md transition-all duration-200 hover:scale-105"
                          title="إدارة الطلبات"
                        >
                          <ListTodo className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Status Actions Group */}
                      <div className="flex items-center space-x-1 space-x-reverse">
                        {/* Start Route */}
                        {route.status === 'planned' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStartRoute(route)
                            }}
                            className="p-1.5 text-white bg-green-600 hover:bg-green-700 rounded-md transition-all duration-200 hover:scale-105 shadow-sm"
                            title="بدء الخط"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        )}

                        {/* Complete Route */}
                        {route.status === 'in_progress' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCompleteRoute(route)
                            }}
                            className="p-1.5 text-white bg-green-600 hover:bg-green-700 rounded-md transition-all duration-200 hover:scale-105 shadow-sm"
                            title="إكمال الخط"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}

                        {/* Delete Route */}
                        {route.status === 'planned' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedRoute(route)
                              setShowDeleteModal(true)
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-all duration-200 hover:scale-105"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}
              {/* Expanded Content */}
              {expandedSections[route.id] && (
                <div className="border-t border-gray-200 p-4 space-y-6">
                  {/* Team Details */}
                  {route.team && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <h4 className="font-medium text-blue-900 mb-2 flex items-center text-sm">
                        <Users className="h-4 w-4 ml-1" />
                        فريق: {route.team.name}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                        {/* All Team Members (including leader with special styling) */}
                        {(() => {
                          // Create a combined list of all team members
                          const allMembers = [];

                          // Add leader first if exists
                          if (route.team.leader) {
                            allMembers.push({
                              worker: route.team.leader,
                              isLeader: true
                            });
                          }

                          // Add other members (excluding leader to avoid duplication)
                          if (route.team.members) {
                            route.team.members.forEach((member: any) => {
                              // Only add if not the leader
                              if (!route.team.leader || member.worker.id !== route.team.leader.id) {
                                allMembers.push({
                                  worker: member.worker,
                                  isLeader: false
                                });
                              }
                            });
                          }

                          return allMembers.map((member: any) => {
                            const isLeader = member.isLeader;
                            const worker = member.worker;

                            return (
                              <div
                                key={worker.id}
                                className={`rounded-md p-2 flex items-center justify-between transition-colors ${isLeader
                                  ? 'bg-yellow-50 border border-yellow-200'
                                  : 'bg-white border border-gray-200 hover:bg-gray-50'
                                  }`}
                              >
                                <div className="flex items-center gap-1 min-w-0 flex-1">
                                  <div className="relative flex-shrink-0">
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isLeader ? 'bg-yellow-500' : 'bg-gray-500'
                                      }`}>
                                      <span className="text-white font-bold text-xs">
                                        {worker.name.charAt(0)}
                                      </span>
                                    </div>
                                    {isLeader && (
                                      <Crown className="absolute -top-0.5 -right-0.5 h-2 w-2 text-yellow-600" />
                                    )}
                                  </div>
                                  <span className="font-medium text-gray-900 text-sm truncate">{worker.name}</span>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={() => window.open(`tel:${worker.phone}`, '_self')}
                                    className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                                    title="اتصال"
                                  >
                                    <Phone className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => window.open(`https://wa.me/${formatPhoneForWhatsApp(worker.phone)}`, '_blank')}
                                    className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                                    title="واتساب"
                                  >
                                    <MessageSquare className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => handleTransferWorker({
                                      ...worker,
                                      team: { id: route.team!.id, name: route.team!.name, leader_id: route.team!.leader_id }
                                    })}
                                    className="p-1 text-orange-600 hover:bg-orange-100 rounded transition-colors"
                                    title="نقل"
                                  >
                                    <ArrowRightLeft className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Orders in Route */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <Target className="h-5 w-5 ml-2 text-purple-600" />
                      الطلبات ({route.route_orders?.length || 0})
                    </h4>
                    {route.route_orders?.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <Target className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500">لا توجد طلبات في هذا الخط</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {route.route_orders?.sort((a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0)).map((routeOrder: any) => (
                          <div key={routeOrder.order.id} className="bg-gradient-to-r from-white to-gray-50 rounded-lg p-2 sm:p-3 border-2 border-gray-300 hover:border-blue-400 hover:shadow-lg transition-all duration-200 group shadow-sm">
                            {/* Mobile-First Responsive Layout */}
                            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 lg:gap-0">
                              <div className="flex-1 min-w-0">
                                {/* First Row - Header with Status and Rating */}
                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-2 gap-2 lg:gap-4">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <div className="bg-gray-200 text-gray-900 px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold whitespace-nowrap border border-gray-300 shadow-sm">
                                      #{routeOrder.order.order_number}
                                    </div>
                                    <span className={`inline-flex items-center px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold whitespace-nowrap border shadow-sm ${routeOrder.order.status === 'completed' ? 'bg-green-200 text-green-900 border-green-300' :
                                      routeOrder.order.status === 'in_progress' ? 'bg-blue-200 text-blue-900 border-blue-300' :
                                        routeOrder.order.status === 'cancelled' ? 'bg-red-200 text-red-900 border-red-300' :
                                          'bg-yellow-200 text-yellow-900 border-yellow-300'
                                      }`}>
                                      {getOrderStatusText(routeOrder.order.status)}
                                    </span>
                                    {/* Rating - Inline with status */}
                                    {routeOrder.order.customer_rating && (
                                      <div className="flex items-center bg-yellow-200 px-3 py-1.5 rounded-md text-xs sm:text-sm border border-yellow-300 shadow-sm">
                                        <Star className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-700 ml-1" />
                                        <span className="font-semibold text-yellow-900">{routeOrder.order.customer_rating}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Desktop: Additional info in first row */}
                                  <div className="hidden lg:flex items-center gap-3 text-xs text-gray-700">
                                    <span className="flex items-center bg-gray-100 px-3 py-1.5 rounded-md whitespace-nowrap border border-gray-300 shadow-sm">
                                      <Target className="h-3 w-3 text-blue-600 ml-1" />
                                      <span className="font-medium">ترتيب {routeOrder.sequence_order}</span>
                                    </span>
                                    <span className="flex items-center bg-gray-100 px-3 py-1.5 rounded-md border border-gray-300 shadow-sm">
                                      <Users className="h-3 w-3 text-indigo-600 ml-1" />
                                      <span className="truncate max-w-[120px] font-medium">{route.team?.name || 'غير محدد'}</span>
                                    </span>
                                    <div onClick={() => handleConfirmationChange(routeOrder.order)}>
                                      {getConfirmationBadge(routeOrder.order.confirmation_status)}
                                    </div>
                                    {!hidePhone && routeOrder.order.customer?.phone && (
                                      <span className="flex items-center bg-gray-100 px-3 py-1.5 rounded-md border border-gray-300 shadow-sm">
                                        <Phone className="h-3 w-3 text-green-600 ml-1" />
                                        <span className="text-xs font-medium">{routeOrder.order.customer.phone}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Second Row - Main Content */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs sm:text-sm mb-2">
                                  {/* Customer & Location */}
                                  <div className="lg:col-span-2 flex items-center space-x-1 space-x-reverse bg-blue-100 px-3 py-2 rounded-md border border-blue-300 shadow-sm">
                                    <User className="h-3 w-3 sm:h-4 sm:w-4 text-blue-700 flex-shrink-0" />
                                    <div className="flex flex-col lg:flex-row lg:items-center lg:space-x-1 lg:space-x-reverse min-w-0 flex-1">
                                      <span className="font-semibold text-blue-900 truncate">{routeOrder.order.customer?.name || 'غير محدد'}</span>
                                      <span className="text-blue-700 hidden lg:inline">•</span>
                                      <span className="text-blue-800 truncate text-xs lg:text-sm font-medium">{routeOrder.order.customer?.area || 'غير محدد'}</span>
                                    </div>
                                  </div>

                                  {/* Time & Amount */}
                                  <div className="lg:col-span-2 flex items-center space-x-1 space-x-reverse bg-green-100 px-3 py-2 rounded-md border border-green-300 shadow-sm">
                                    <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-orange-700 flex-shrink-0" />
                                    <div className="flex flex-col lg:flex-row lg:items-center lg:space-x-1 lg:space-x-reverse flex-1">
                                      <span className="text-orange-800 whitespace-nowrap font-medium">{routeOrder.order.scheduled_time}</span>
                                      <span className="text-green-700 hidden lg:inline">•</span>
                                      <span className="font-bold text-green-800 whitespace-nowrap">{routeOrder.order.total_amount} ج.م</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Mobile: Bottom Info - Only shown on mobile */}
                                <div className="lg:hidden flex flex-wrap items-center gap-2 text-xs text-gray-700">
                                  <span className="flex items-center bg-gray-100 px-3 py-1.5 rounded-md whitespace-nowrap border border-gray-300 shadow-sm">
                                    <Target className="h-3 w-3 text-blue-600 ml-1" />
                                    <span className="font-medium">ترتيب {routeOrder.sequence_order}</span>
                                  </span>
                                  <span className="flex items-center bg-gray-100 px-3 py-1.5 rounded-md border border-gray-300 shadow-sm">
                                    <Users className="h-3 w-3 text-indigo-600 ml-1" />
                                    <span className="truncate max-w-[120px] sm:max-w-none font-medium">{route.team?.name || 'غير محدد'}</span>
                                  </span>
                                  <div onClick={() => handleConfirmationChange(routeOrder.order)}>
                                    {getConfirmationBadge(routeOrder.order.confirmation_status)}
                                  </div>
                                  {!hidePhone && routeOrder.order.customer?.phone && (
                                    <span className="flex items-center bg-gray-100 px-3 py-1.5 rounded-md border border-gray-300 shadow-sm">
                                      <Phone className="h-3 w-3 text-green-600 ml-1" />
                                      <span className="text-xs sm:text-sm font-medium">{routeOrder.order.customer.phone}</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Actions - Mobile Responsive */}
                              <div className="flex flex-col gap-2 lg:ml-2">
                                {/* Primary Actions - Mobile Responsive */}
                                <div className="flex flex-wrap gap-1 justify-start">
                                  {/* الأزرار الأساسية - تظهر دائماً */}
                                  <button
                                    onClick={() => {
                                      setDetailsOrderId(routeOrder.order.id)
                                      setShowDetailsModal(true)
                                    }}
                                    className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors flex-shrink-0 touch-manipulation"
                                    title="عرض التفاصيل"
                                  >
                                    <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  </button>
                                  {!isSupervisor && (
                                    <button
                                      onClick={() => {
                                        setSelectedOrder(routeOrder.order)
                                        setFormMode('edit')
                                        setShowFormModal(true)
                                      }}
                                      className="p-1.5 sm:p-2 text-green-600 hover:bg-green-50 rounded transition-colors flex-shrink-0 touch-manipulation"
                                      title="تعديل"
                                    >
                                      <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    </button>
                                  )}

                                  {/* الأزرار الشرطية - تظهر حسب حالة الطلب */}
                                  {routeOrder.order.status === 'scheduled' && !!route.team_id && routeOrder.order.team_id === route.team_id ? (
                                    <button
                                      onClick={() => handleStatusChange(routeOrder.order, 'in_progress')}
                                      className="p-1.5 sm:p-2 text-yellow-600 hover:bg-yellow-50 rounded transition-colors flex-shrink-0 touch-manipulation"
                                      title="بدء التنفيذ"
                                    >
                                      <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    </button>
                                  ) : null}
                                  {routeOrder.order.status === 'in_progress' ? (
                                    <button
                                      onClick={() => handleStatusChange(routeOrder.order, 'completed')}
                                      className="p-1.5 sm:p-2 text-green-700 hover:bg-green-50 rounded transition-colors flex-shrink-0 touch-manipulation"
                                      title="إكمال"
                                    >
                                      <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    </button>
                                  ) : null}
                                  {routeOrder.order.status === 'completed' && !routeOrder.order.customer_rating ? (
                                    <button
                                      onClick={() => {
                                        setRatingOrderId(routeOrder.order.id)
                                        setShowRatingModal(true)
                                      }}
                                      className="p-1.5 sm:p-2 text-yellow-600 hover:bg-yellow-50 rounded transition-colors flex-shrink-0 touch-manipulation"
                                      title="تقييم الخدمة"
                                    >
                                      <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    </button>
                                  ) : null}
                                  {routeOrder.order.status !== 'cancelled' && routeOrder.order.status !== 'completed' ? (
                                    <button
                                      onClick={() => handleStatusChange(routeOrder.order, 'cancelled')}
                                      className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0 touch-manipulation"
                                      title="إلغاء"
                                    >
                                      <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    </button>
                                  ) : null}
                                </div>

                                {/* Secondary Actions - Mobile Optimized */}
                                <div className="flex flex-wrap gap-1">
                                  {!hidePhone && routeOrder.order.customer?.phone && (
                                    <>
                                      <button
                                        onClick={() => window.open(`tel:${routeOrder.order.customer.phone}`, '_self')}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors flex-shrink-0 border border-blue-200 hover:border-blue-300 touch-manipulation"
                                        title="اتصال"
                                      >
                                        <Phone className="h-3.5 w-3.5" />
                                      </button>

                                      <button
                                        onClick={() => {
                                          const waNumber = formatPhoneForWhatsApp(routeOrder.order.customer.phone)
                                          window.open(`https://wa.me/${waNumber}`, '_blank')
                                        }}
                                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-full transition-colors flex-shrink-0 border border-green-200 hover:border-green-300 touch-manipulation"
                                        title="واتساب"
                                      >
                                        <MessageCircle className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  )}

                                  <button
                                    onClick={() => copyOrderDetails(routeOrder.order, route.team?.name)}
                                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors flex-shrink-0 border border-indigo-200 hover:border-indigo-300 touch-manipulation"
                                    title="نسخ التفاصيل"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>

                                  <button
                                    onClick={() => exportOrderAsImage(routeOrder.order, route.team?.name)}
                                    disabled={isExporting}
                                    className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-full transition-colors flex-shrink-0 border border-teal-200 hover:border-teal-300 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                                    title="تصدير وإرسال"
                                  >
                                    {isExporting ? (
                                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Send className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                  {routeOrder.order.status === 'completed' && !routeOrder.order.customer_rating && (
                                    <button
                                      onClick={() => sendSurveyLink(routeOrder.order)}
                                      disabled={sendingSurvey}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-full transition-colors flex-shrink-0 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                                      title="إرسال الاستبيان"
                                    >
                                      {sendingSurvey ? (
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <MessageSquare className="h-3.5 w-3.5" />
                                      )}
                                      <span className="hidden sm:inline text-xs font-medium">إرسال الاستبيان</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Route Expenses */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                      <DollarSign className="h-5 w-5 ml-2 text-orange-600" />
                      مصروفات الخط
                    </h4>
                    {expenses?.filter((exp: any) => {
                      // Filter expenses that are linked to this route, its orders, or its team
                      return exp.route_id === route.id ||
                        route.route_orders?.some((routeOrder: any) => routeOrder.order.id === exp.order_id) ||
                        exp.team_id === route.team?.id
                    }).length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <DollarSign className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500">لا توجد مصروفات لهذا الخط</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {expenses?.filter((exp: any) => {
                          // Filter expenses that are linked to this route, its orders, or its team
                          return exp.route_id === route.id ||
                            route.route_orders?.some((routeOrder: any) => routeOrder.order.id === exp.order_id) ||
                            exp.team_id === route.team?.id
                        }).map((expense: any) => (
                          <div key={expense.id} className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 space-x-reverse mb-2">
                                  <span className="font-medium text-gray-900">
                                    {expense.description}
                                  </span>
                                  {getStatusBadge(expense.status, 'expense')}
                                </div>
                                <div className="flex items-center space-x-4 space-x-reverse text-sm text-gray-600">
                                  <span className="flex items-center">
                                    <DollarSign className="h-4 w-4 ml-1" />
                                    {expense.amount} ج.م
                                  </span>
                                  <span>
                                    {expense.category?.name_ar || 'غير محدد'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1 space-x-reverse">
                                {/* Approval Actions */}
                                {expense.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleExpenseAction('approve', expense)}
                                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                      title="موافقة"
                                    >
                                      <Check className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleExpenseAction('reject', expense)}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="رفض"
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </button>
                                  </>
                                )}






                                {/* Standard Actions */}
                                <button
                                  onClick={() => handleExpenseAction('edit', expense)}
                                  className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                                  title="تعديل"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleExpenseAction('delete', expense)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="حذف"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      <TransferWorkerModal
        isOpen={showTransferModal}
        onClose={() => {
          setShowTransferModal(false)
          setSelectedWorker(null)
        }}
        onSuccess={() => {
          // EventBus will handle the refresh automatically via teams:changed and routes:changed events
          setShowTransferModal(false)
          setSelectedWorker(null)
        }}
        worker={selectedWorker}
      />

      <OrderFormModal
        isOpen={showOrderModal}
        onClose={() => {
          setShowOrderModal(false)
          setSelectedOrder(null)
        }}
        onSuccess={() => {
          // EventBus will handle the refresh automatically via orders:changed event
          setShowOrderModal(false)
          setSelectedOrder(null)
        }}
        order={selectedOrder || undefined}
        mode={selectedOrder ? 'edit' : 'create'}
      />

      {/* Vault Selection Modal for expense approval */}
      {
        showVaultModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="p-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                <h3 className="text-lg font-bold">اختر خزنة للخصم</h3>
                {vaultModalInfo?.code === 'INSUFFICIENT_BALANCE' ? (
                  <div className="mt-1 space-y-1">
                    <p className="text-sm text-white/90">رصيد العهدة غير كافٍ لتغطية المصروف</p>
                    <div className="flex items-center gap-3 mt-2 p-2 bg-white/20 rounded-lg text-sm">
                      <span>رصيد العهدة: <strong>{vaultModalInfo.currentBalance?.toLocaleString('en-US')} ج.م</strong></span>
                      <span>|</span>
                      <span>المطلوب: <strong>{vaultModalInfo.requiredAmount?.toLocaleString('en-US')} ج.م</strong></span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-white/80 mt-1">لا توجد عُهدة لمنشئ المصروف — اختر خزنة بديلة</p>
                )}
                {pendingExpenseForVault && (
                  <div className="mt-2 p-2 bg-white/20 rounded-lg text-sm">
                    <span className="font-bold">{pendingExpenseForVault.description}</span>
                    <span className="mr-2">— {pendingExpenseForVault.amount.toLocaleString('en-US')} ج.م</span>
                  </div>
                )}
              </div>
              <div className="p-4 max-h-80 overflow-y-auto">
                {vaultLoading ? (
                  <div className="text-center py-8"><LoadingSpinner size="small" text="جاري تحميل الخزائن..." /></div>
                ) : vaults.length === 0 ? (
                  <p className="text-center py-8 text-gray-500">لا توجد خزائن نشطة</p>
                ) : (
                  <div className="space-y-2">
                    {vaults.map(vault => (
                      <button
                        key={vault.id}
                        onClick={() => handleVaultApproveOps(vault.id)}
                        className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all text-right"
                      >
                        <div>
                          <p className="font-medium text-gray-800">{vault.name}</p>
                          <p className="text-sm text-gray-500">رصيد: {Number(vault.balance).toLocaleString('en-US')} ج.م</p>
                        </div>
                        <DollarSign className="h-5 w-5 text-gray-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 border-t bg-gray-50">
                <button
                  onClick={() => { setShowVaultModal(false); setPendingExpenseForVault(null); setVaultModalInfo(null) }}
                  className="w-full py-2.5 text-sm font-medium text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-xl transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )
      }

      <ExpenseFormModal
        isOpen={showExpenseModal}
        onClose={() => {
          setShowExpenseModal(false)
          setSelectedExpense(null)
        }}
        onSuccess={() => {
          // EventBus will handle the refresh automatically via expenses:changed event
          setShowExpenseModal(false)
          setSelectedExpense(null)
        }}
        expense={selectedExpense || undefined}
        mode={selectedExpense ? 'edit' : 'create'}
      />

      <RouteFormModal
        open={showRouteModal}
        onClose={() => {
          setShowRouteModal(false)
          setSelectedRoute(null)
        }}
        onSaved={() => {
          // EventBus will handle the refresh automatically via routes:changed event
          setShowRouteModal(false)
          setSelectedRoute(null)
        }}
        existingRoute={selectedRoute || undefined}
        mode={formMode}
        teams={teams}
      />

      {
        showAssignModal && routeForOrders && (
          <AssignOrdersModal
            open={showAssignModal}
            onClose={() => setShowAssignModal(false)}
            route={routeForOrders}
            onSaved={() => {
              // EventBus will handle the refresh automatically via routes:changed event
              setShowAssignModal(false)
              setRouteForOrders(null)
            }}
          />
        )
      }

      {extension.modal}

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setDeleteTarget(null)
          setSelectedRoute(null)
        }}
        onConfirm={() => {
          if (deleteTarget) {
            handleDelete()
          } else if (selectedRoute) {
            handleDeleteRoute(selectedRoute)
          }
        }}
        message={deleteTarget ? `هل أنت متأكد من حذف ${deleteTarget.name}؟` : selectedRoute ? `هل أنت متأكد من حذف خط السير "${selectedRoute.name}"؟` : 'هل أنت متأكد من الحذف؟'}
        loading={loading}
      />

      {/* Route Status Confirmation Modal */}
      {routeStatusConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => !routeStatusLoading && setRouteStatusConfirm(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-6 py-4 ${routeStatusConfirm.action === 'start' ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  {routeStatusConfirm.action === 'start'
                    ? <Play className="w-5 h-5 text-white" />
                    : <Check className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {routeStatusConfirm.action === 'start' ? 'تأكيد تشغيل خط السير' : 'تأكيد إنهاء خط السير'}
                  </h3>
                  <p className="text-sm text-white/80">{routeStatusConfirm.route.name}</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  {routeStatusConfirm.action === 'start' ? (
                    <p>هل أنت متأكد من <strong>تشغيل</strong> خط السير <strong>"{routeStatusConfirm.route.name}"</strong>؟ سيتم تحديث حالة الخط وجميع الطلبات المرتبطة.</p>
                  ) : (
                    <p>هل أنت متأكد من <strong>إنهاء</strong> خط السير <strong>"{routeStatusConfirm.route.name}"</strong>؟ سيؤدى ذلك لإنهاء الخط وتسجيل انصراف العمال المرتبطين تلقائياً.</p>
                  )}
                </div>
              </div>

              {/* Route Info */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {routeStatusConfirm.route.team?.name || 'غير محدد'}
                </span>
                <span className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  {routeStatusConfirm.route.route_orders?.length || 0} طلب
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 flex items-center gap-3 justify-end border-t border-gray-100">
              <button
                onClick={() => setRouteStatusConfirm(null)}
                disabled={routeStatusLoading}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={confirmRouteStatusChange}
                disabled={routeStatusLoading}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center gap-2 ${routeStatusConfirm.action === 'start'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                  }`}
              >
                {routeStatusLoading ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> جارٍ التنفيذ...</>
                ) : routeStatusConfirm.action === 'start' ? (
                  <><Play className="w-4 h-4" /> تشغيل</>
                ) : (
                  <><Check className="w-4 h-4" /> إنهاء</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      <OrderDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false)
          setDetailsOrderId(undefined)
        }}
        orderId={detailsOrderId}
        hideCustomerPhone={hidePhone}
      />

      {
        showFormModal && (
          <OrderFormModal
            isOpen={showFormModal}
            onClose={() => {
              setShowFormModal(false)
              setSelectedOrder(null)
            }}
            onSuccess={() => {
              // EventBus will handle the refresh automatically via orders:changed event
              setShowFormModal(false)
              setSelectedOrder(null)
            }}
            order={selectedOrder || undefined}
            mode={formMode}
          />
        )
      }

      {/* Order Rating Modal */}
      <OrderRatingModal
        isOpen={showRatingModal}
        onClose={() => {
          setShowRatingModal(false)
          setRatingOrderId(undefined)
        }}
        onSuccess={() => {
          // مسح كاش الطلبات لضمان تحديث التقييم الظاهر فوراً
          EnhancedAPI.clearCache('enhanced:orders')
          // EventBus will handle the refresh automatically via orders:changed event
        }}
        orderId={ratingOrderId || ''}
        orderNumber={routes.flatMap(r => r.orders || []).find(o => o.id === ratingOrderId)?.order_number}
        customerName={routes.flatMap(r => r.orders || []).find(o => o.id === ratingOrderId)?.customer?.name}
      />

      {/* Cancel Order Modal */}
      <SmartModal
        isOpen={showCancelModal}
        size="sm"
        headerGradient="from-red-500 via-red-600 to-red-700"
        contentClassName="p-6"
        className="ring-1 ring-red-100"
        onClose={() => {
          setShowCancelModal(false)
          setCancelReason('')
          setSelectedOrder(null)
        }}
        title="تأكيد إلغاء الطلب"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">يرجى كتابة سبب الإلغاء قبل المتابعة:</p>
          <textarea
            className="textarea w-full textarea-bordered"
            rows={3}
            placeholder="سبب الإلغاء"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <div className="flex justify-end gap-4 mt-6">
            <button
              onClick={async () => {
                if (!selectedOrder) return
                if (!cancelReason.trim()) return
                setCancelLoading(true)
                try {
                  toast.loading('جاري إلغاء الطلب...', { id: 'cancel' })
                  const response = await EnhancedAPI.updateOrderStatus(
                    selectedOrder.id,
                    'cancelled',
                    cancelReason.trim(),
                    undefined
                  )
                  if (response.success) {
                    toast.success('تم إلغاء الطلب', { id: 'cancel' })
                    setShowCancelModal(false)
                    setCancelReason('')
                    // EventBus will handle the refresh automatically via orders:changed event
                  } else {
                    throw new Error(response.error || 'فشل في إلغاء الطلب')
                  }
                } catch (error) {
                  toast.error('حدث خطأ أثناء الإلغاء', { id: 'cancel' })
                  console.error('Cancel order error:', error)
                } finally {
                  setCancelLoading(false)
                }
              }}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={cancelLoading || !cancelReason.trim()}
            >
              {cancelLoading ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}
            </button>
            <button
              onClick={() => setShowCancelModal(false)}
              className="btn btn-ghost"
              disabled={cancelLoading}
            >
              تراجع
            </button>
          </div>
        </div>
      </SmartModal>

      {/* Confirm Status Modal */}
      <ConfirmStatusModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmStatusChange}
        loading={confirmLoading}
        orderNumber={targetOrder?.order_number}
        newStatusLabel={targetStatus ? getOrderStatusText(targetStatus) : ''}
      />

      {/* Confirmation Status Picker Modal */}
      <ConfirmationStatusPickerModal
        isOpen={showConfirmationPicker}
        onClose={() => {
          setShowConfirmationPicker(false)
          setSelectedConfirmationOrder(null)
        }}
        onConfirm={handleConfirmStatusUpdate}
        loading={confirmationLoading}
        currentStatus={selectedConfirmationOrder?.confirmation_status as ConfirmationStatus}
        customerName={selectedConfirmationOrder?.customer_name}
        customerArea={selectedConfirmationOrder?.customer?.area || undefined}
      />

      {/* Hidden Order Export Template */}
      <div
        ref={orderExportRef}
        className="fixed -top-[9999px] left-0 bg-white p-6 w-96 border border-gray-200 rounded-lg shadow-lg"
        style={{ fontFamily: 'Arial, sans-serif' }}
      >
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">تفاصيل الطلب</h2>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">رقم الطلب:</span>
            <span id="export-order-number" className="text-gray-800"></span>
          </div>

          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">اسم العميل:</span>
            <span id="export-customer-name" className="text-gray-800"></span>
          </div>

          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">رقم الهاتف:</span>
            <span id="export-customer-phone" className="text-gray-800"></span>
          </div>

          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">المنطقة:</span>
            <span id="export-customer-area" className="text-gray-800"></span>
          </div>

          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">العنوان:</span>
            <span id="export-customer-address" className="text-gray-800 text-right"></span>
          </div>

          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">التاريخ:</span>
            <span id="export-order-date" className="text-gray-800"></span>
          </div>

          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">الوقت المحدد:</span>
            <span id="export-scheduled-time" className="text-gray-800"></span>
          </div>

          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">المدة:</span>
            <span id="export-duration" className="text-gray-800"></span>
          </div>

          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">حالة الطلب:</span>
            <span id="export-order-status" className="text-gray-800"></span>
          </div>

          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">حالة التأكيد:</span>
            <span id="export-confirmation-status" className="text-gray-800"></span>
          </div>

          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">المبلغ الإجمالي:</span>
            <span id="export-total-amount" className="text-gray-800 font-bold"></span>
          </div>

          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">الفريق:</span>
            <span id="export-team-name" className="text-gray-800"></span>
          </div>

          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">التقييم:</span>
            <span id="export-rating" className="text-gray-800"></span>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500 text-center">
              تم إنشاء هذا التقرير في {new Date().toLocaleDateString('en-US')}
            </div>
          </div>
        </div>
      </div>
    </div >
  )
}

export default OperationsPage
