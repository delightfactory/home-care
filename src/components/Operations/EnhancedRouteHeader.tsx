import React, { MouseEvent } from 'react';
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  Clock,
  Users,
  Package,
  Star,
  AlertTriangle,
  Activity,
  Play,
  Check,
  Pencil,
  ListTodo,
  Trash2,
  TrendingUp,
  Shield,
  Award
} from 'lucide-react';

interface RouteHeaderProps {
  route: any;
  isExpanded: boolean;
  onToggleExpansion: () => void;
  onEdit: (e: MouseEvent) => void;
  onManageOrders: (e: MouseEvent) => void;
  onStartRoute: (e: MouseEvent) => void;
  onCompleteRoute: (e: MouseEvent) => void;
  onDeleteRoute: (e: MouseEvent) => void;
  getStatusBadge: (status: string, type: 'order' | 'route' | 'expense') => JSX.Element;
}

const EnhancedRouteHeader: React.FC<RouteHeaderProps> = ({
  route,
  isExpanded,
  onToggleExpansion,
  onEdit,
  onManageOrders,
  onStartRoute,
  onCompleteRoute,
  onDeleteRoute,
  getStatusBadge
}) => {
  // Calculate route metrics
  const orders = route.route_orders || [];
  const totalOrders = orders.length;
  const completedOrders = orders.filter((ro: any) => ro.order.status === 'completed').length;
  const inProgressOrders = orders.filter((ro: any) => ro.order.status === 'in_progress').length;
  const cancelledOrders = orders.filter((ro: any) => ro.order.status === 'cancelled').length;
  const totalRevenue = orders.reduce((sum: number, ro: any) => sum + (ro.order.total_amount || 0), 0);
  // Calculate paid vs expected revenue
  const paidRevenue = orders
    .filter((ro: any) => ro.order.status === 'completed' && ro.order.payment_status === 'paid')
    .reduce((sum: number, ro: any) => sum + (ro.order.total_amount || 0), 0);
  const expectedRevenue = orders
    .filter((ro: any) => ro.order.status === 'completed')
    .reduce((sum: number, ro: any) => sum + (ro.order.total_amount || 0), 0);
  const revenueCollectionRate = expectedRevenue > 0 ? Math.round((paidRevenue / expectedRevenue) * 100) : 0;
  const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
  const confirmedOrders = orders.filter((ro: any) => ro.order.confirmation_status === 'confirmed').length;
  const confirmationRate = totalOrders > 0 ? Math.round((confirmedOrders / totalOrders) * 100) : 0;
  
  // Calculate average rating
  const ratedOrders = orders.filter((ro: any) => ro.order.customer_rating);
  const avgRating = ratedOrders.length > 0 
    ? ratedOrders.reduce((sum: number, ro: any) => sum + ro.order.customer_rating, 0) / ratedOrders.length 
    : 0;

  // Determine route health status
  const hasIssues = cancelledOrders > 0 || confirmationRate < 80;
  const isHighPerforming = completionRate >= 90 && confirmationRate >= 95 && avgRating >= 4.5;
  const isGoodPerforming = completionRate >= 70 && confirmationRate >= 80;

  // Get performance color scheme
  const getPerformanceTheme = () => {
    if (isHighPerforming) return {
      primary: 'emerald',
      bg: 'from-emerald-50 to-emerald-100',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
      icon: 'text-emerald-600'
    };
    if (isGoodPerforming) return {
      primary: 'blue',
      bg: 'from-blue-50 to-blue-100',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: 'text-blue-600'
    };
    if (hasIssues) return {
      primary: 'red',
      bg: 'from-red-50 to-red-100',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: 'text-red-600'
    };
    return {
      primary: 'amber',
      bg: 'from-amber-50 to-amber-100',
      border: 'border-amber-200',
      text: 'text-amber-800',
      icon: 'text-amber-600'
    };
  };

  const theme = getPerformanceTheme();

  // Get route status background color
  const getRouteStatusBackground = () => {
    switch (route.status) {
      case 'planned':
        return 'from-blue-50 to-blue-100'; // أزرق خفيف للمخطط
      case 'in_progress':
        return 'from-amber-50 to-amber-100'; // أصفر خفيف للجاري
      case 'completed':
        return 'from-green-50 to-green-100'; // أخضر خفيف للمكتمل
      case 'cancelled':
        return 'from-red-50 to-red-100'; // أحمر خفيف للملغي
      case 'paused':
        return 'from-gray-50 to-gray-100'; // رمادي خفيف للمتوقف
      default:
        return 'from-gray-50 to-gray-100'; // افتراضي
    }
  };

  // Get route status border color
  const getRouteStatusBorder = () => {
    switch (route.status) {
      case 'planned':
        return 'border-blue-200'; // حدود زرقاء للمخطط
      case 'in_progress':
        return 'border-amber-200'; // حدود صفراء للجاري
      case 'completed':
        return 'border-green-200'; // حدود خضراء للمكتمل
      case 'cancelled':
        return 'border-red-200'; // حدود حمراء للملغي
      case 'paused':
        return 'border-gray-200'; // حدود رمادية للمتوقف
      default:
        return 'border-gray-200'; // افتراضي
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}ك ج.م`;
    }
    return `${amount.toFixed(0)} ج.م`;
  };

  // Format currency without symbol
  const formatCurrencyNoSymbol = (amount: number) => {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}ك`;
    }
    return `${amount.toFixed(0)}`;
  };

  return (
    <div className={`bg-gradient-to-r ${getRouteStatusBackground()} border ${getRouteStatusBorder()} rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer`}
         onClick={onToggleExpansion}>
      {/* Performance Indicator Bar */}
      <div className="h-0.5 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-t-lg overflow-hidden">
        <div 
          className="h-full transition-all duration-500"
          style={{ 
            width: `${Math.max(completionRate, 10)}%`,
            background: `linear-gradient(90deg, 
              ${completionRate <= 25 ? '#ef4444, #f87171, #dc2626' : 
                completionRate <= 50 ? '#f97316, #fb923c, #ea580c' : 
                completionRate <= 75 ? '#eab308, #fbbf24, #ca8a04' : 
                '#22c55e, #4ade80, #16a34a'})`
          }}
        />
      </div>

      {/* Main Header Content */}
      <div className="p-2">
        {/* Compact Top Section - Route Identity & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
          {/* Route Identity */}
          <div className="flex-1 min-w-0">
            {/* Route Name Section */}
            <div className="flex items-center space-x-3 space-x-reverse mb-2">
              {/* Expand/Collapse Icon */}
              <div className={`p-1.5 rounded-md ${theme.icon} transition-all duration-200 flex-shrink-0`}>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>

              {/* Route Name */}
              <div className="flex items-center space-x-2 space-x-reverse flex-1 min-w-0">
                <MapPin className={`h-5 w-5 ${theme.icon} flex-shrink-0`} />
                <h3 className={`text-lg sm:text-xl font-bold ${theme.text} min-w-0`} style={{wordBreak: 'break-word'}}>{route.name}</h3>
              </div>

              {/* Performance Badges */}
               <div className="flex items-center space-x-1 space-x-reverse flex-shrink-0">
                 {isHighPerforming && (
                   <div className="flex items-center bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 px-3 py-1.5 rounded-2xl border border-emerald-200/50 shadow-sm backdrop-blur-sm">
                     <Award className="h-3.5 w-3.5 ml-1" />
                     <span className="text-xs font-medium hidden sm:inline">متميز</span>
                   </div>
                 )}
                 
                 {hasIssues && (
                   <div className="flex items-center bg-gradient-to-r from-red-50 to-red-100 text-red-700 px-3 py-1.5 rounded-2xl border border-red-200/50 shadow-sm backdrop-blur-sm">
                     <AlertTriangle className="h-3.5 w-3.5 ml-1" />
                     <span className="text-xs font-medium hidden sm:inline">يحتاج انتباه</span>
                   </div>
                 )}

                 {getStatusBadge(route.status, 'route')}
               </div>
            </div>

            {/* Basic Route Info - Responsive */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center space-x-1 space-x-reverse bg-gradient-to-r from-white/80 to-white/95 rounded-xl px-3 py-1.5 border-2 border-gray-300/60 shadow-md backdrop-blur-sm hover:border-gray-400/70 transition-all duration-200">
                <Clock className={`h-3.5 w-3.5 ${theme.icon} flex-shrink-0`} />
                <span className="font-semibold text-gray-800 whitespace-nowrap">
                  {route.start_time} - {route.end_time}
                </span>
              </div>
              
              <div className="flex items-center space-x-1 space-x-reverse bg-gradient-to-r from-white/80 to-white/95 rounded-xl px-3 py-1.5 border-2 border-gray-300/60 shadow-md backdrop-blur-sm hover:border-gray-400/70 transition-all duration-200">
                <Users className={`h-3.5 w-3.5 ${theme.icon} flex-shrink-0`} />
                <span className="font-semibold text-gray-800 truncate max-w-24 sm:max-w-none">
                  {route.team?.name || 'غير محدد'}
                </span>
              </div>
              
              <div className="flex items-center space-x-1 space-x-reverse bg-gradient-to-r from-white/80 to-white/95 rounded-xl px-3 py-1.5 border-2 border-gray-300/60 shadow-md backdrop-blur-sm hover:border-gray-400/70 transition-all duration-200">
                <Package className={`h-3.5 w-3.5 ${theme.icon} flex-shrink-0`} />
                <span className="font-semibold text-gray-800 whitespace-nowrap">
                  {totalOrders} طلب
                </span>
              </div>
            </div>
          </div>

          {/* Compact Action Buttons - Responsive */}
          <div className="flex items-center space-x-1 space-x-reverse flex-shrink-0">
            {/* Primary Actions */}
            <div className="flex items-center space-x-0.5 space-x-reverse bg-white/80 rounded p-0.5 shadow-sm">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(e); }}
                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-all duration-200"
                title="تعديل"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              
              <button
                onClick={(e) => { e.stopPropagation(); onManageOrders(e); }}
                className="p-1.5 text-amber-600 hover:bg-amber-100 rounded transition-all duration-200"
                title="إدارة الطلبات"
              >
                <ListTodo className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Status Actions */}
            <div className="flex items-center space-x-0.5 space-x-reverse">
              {route.status === 'planned' && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onStartRoute(e); }}
                    className="p-1.5 text-white bg-green-600 hover:bg-green-700 rounded transition-all duration-200 shadow-sm"
                    title="بدء الخط"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                  
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteRoute(e); }}
                    className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-all duration-200"
                    title="حذف"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              
              {route.status === 'in_progress' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCompleteRoute(e); }}
                  className="p-1.5 text-white bg-green-600 hover:bg-green-700 rounded transition-all duration-200 shadow-sm"
                  title="إكمال الخط"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Compact Performance Dashboard */}
        {totalOrders > 0 && (
          <div className="space-y-1">
            {/* Progress & Key Metrics - Responsive */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white/80 rounded p-1.5 shadow-sm gap-2">
              {/* Progress Indicator */}
              <div className="flex items-center space-x-3 space-x-reverse flex-1 min-w-0">
                <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">الإنجاز:</span>
                <div className="flex-1 max-w-24 sm:max-w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-700 ease-out"
                    style={{ 
                      width: `${completionRate}%`,
                      background: `linear-gradient(90deg, 
                        ${completionRate <= 25 ? '#ef4444, #dc2626' : 
                          completionRate <= 50 ? '#f97316, #ea580c' : 
                          completionRate <= 75 ? '#eab308, #ca8a04' : 
                          '#22c55e, #16a34a'})`
                    }}
                  />
                </div>
                <span className={`text-sm font-bold ${theme.text} whitespace-nowrap`}>{completionRate}%</span>
              </div>

              {/* Key Metrics - Responsive */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Active Orders */}
                <div className="flex items-center space-x-1 space-x-reverse bg-gradient-to-r from-blue-50 to-blue-100 px-3 py-1.5 rounded-xl border-2 border-blue-300 shadow-md backdrop-blur-sm whitespace-nowrap hover:border-blue-400 transition-all duration-200">
                  <Activity className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                  <span className="text-blue-700 font-semibold">قيد التنفيذ:</span>
                  <span className="font-bold text-blue-900">{inProgressOrders}</span>
                </div>

                {/* Revenue */}
                {totalRevenue > 0 && (
                  <div className={`flex items-center space-x-1 space-x-reverse px-3 py-1.5 rounded-xl border-2 shadow-md backdrop-blur-sm whitespace-nowrap hover:shadow-lg transition-all duration-200 ${
                    revenueCollectionRate >= 90 ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-300 hover:border-green-400' :
                    revenueCollectionRate >= 75 ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-300 hover:border-blue-400' :
                    revenueCollectionRate >= 60 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300 hover:border-yellow-400' :
                    revenueCollectionRate >= 40 ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-300 hover:border-orange-400' :
                    'bg-gradient-to-r from-red-50 to-red-100 border-red-300 hover:border-red-400'
                  }`}>
                    <TrendingUp className={`h-3.5 w-3.5 flex-shrink-0 ${
                      revenueCollectionRate >= 90 ? 'text-green-600' :
                      revenueCollectionRate >= 75 ? 'text-blue-600' :
                      revenueCollectionRate >= 60 ? 'text-yellow-600' :
                      revenueCollectionRate >= 40 ? 'text-orange-600' :
                      'text-red-600'
                    }`} />
                    <span className={`font-semibold hidden sm:inline ${
                      revenueCollectionRate >= 90 ? 'text-green-700' :
                      revenueCollectionRate >= 75 ? 'text-blue-700' :
                      revenueCollectionRate >= 60 ? 'text-yellow-700' :
                      revenueCollectionRate >= 40 ? 'text-orange-700' :
                      'text-red-700'
                    }`}>إيراد:</span>
                    <span className={`font-bold ${
                       revenueCollectionRate >= 90 ? 'text-green-900' :
                       revenueCollectionRate >= 75 ? 'text-blue-900' :
                       revenueCollectionRate >= 60 ? 'text-yellow-900' :
                       revenueCollectionRate >= 40 ? 'text-orange-900' :
                       'text-red-900'
                     }`}>{formatCurrencyNoSymbol(paidRevenue)}</span>
                     <span className="text-xs text-gray-500">/</span>
                     <span className="text-xs font-medium text-gray-600">{formatCurrency(expectedRevenue)}</span>
                    <span className={`text-xs font-medium ${
                      revenueCollectionRate >= 90 ? 'text-green-600' :
                      revenueCollectionRate >= 75 ? 'text-blue-600' :
                      revenueCollectionRate >= 60 ? 'text-yellow-600' :
                      revenueCollectionRate >= 40 ? 'text-orange-600' :
                      'text-red-600'
                    }`}>({revenueCollectionRate}%)</span>
                  </div>
                )}

                {/* Rating */}
                {avgRating > 0 && (
                  <div className={`flex items-center space-x-1 space-x-reverse px-3 py-1.5 rounded-xl border-2 shadow-md backdrop-blur-sm whitespace-nowrap hover:shadow-lg transition-all duration-200 ${
                    avgRating >= 4.5 ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-300 hover:border-green-400' :
                    avgRating >= 4.0 ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-300 hover:border-blue-400' :
                    avgRating >= 3.5 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300 hover:border-yellow-400' :
                    avgRating >= 3.0 ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-300 hover:border-orange-400' :
                    'bg-gradient-to-r from-red-50 to-red-100 border-red-300 hover:border-red-400'
                  }`}>
                    <Star className={`h-3.5 w-3.5 fill-current flex-shrink-0 ${
                      avgRating >= 4.5 ? 'text-green-600' :
                      avgRating >= 4.0 ? 'text-blue-600' :
                      avgRating >= 3.5 ? 'text-yellow-600' :
                      avgRating >= 3.0 ? 'text-orange-600' :
                      'text-red-600'
                    }`} />
                    <span className={`font-semibold hidden sm:inline ${
                      avgRating >= 4.5 ? 'text-green-700' :
                      avgRating >= 4.0 ? 'text-blue-700' :
                      avgRating >= 3.5 ? 'text-yellow-700' :
                      avgRating >= 3.0 ? 'text-orange-700' :
                      'text-red-700'
                    }`}>تقييم:</span>
                    <span className={`font-bold ${
                      avgRating >= 4.5 ? 'text-green-900' :
                      avgRating >= 4.0 ? 'text-blue-900' :
                      avgRating >= 3.5 ? 'text-yellow-900' :
                      avgRating >= 3.0 ? 'text-orange-900' :
                      'text-red-900'
                    }`}>{avgRating.toFixed(1)}</span>
                    <span className={`text-xs font-medium ${
                      avgRating >= 4.5 ? 'text-green-600' :
                      avgRating >= 4.0 ? 'text-blue-600' :
                      avgRating >= 3.5 ? 'text-yellow-600' :
                      avgRating >= 3.0 ? 'text-orange-600' :
                      'text-red-600'
                    }`}>({ratedOrders.length})</span>
                  </div>
                )}

                {/* Confirmation Rate */}
                <div className={`flex items-center space-x-1 space-x-reverse px-3 py-1.5 rounded-xl border-2 shadow-md backdrop-blur-sm whitespace-nowrap hover:shadow-lg transition-all duration-200 ${
                  confirmationRate >= 90 ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-300 hover:border-green-400' :
                  confirmationRate >= 75 ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-300 hover:border-blue-400' :
                  confirmationRate >= 60 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300 hover:border-yellow-400' :
                  confirmationRate >= 40 ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-300 hover:border-orange-400' :
                  'bg-gradient-to-r from-red-50 to-red-100 border-red-300 hover:border-red-400'
                }`}>
                  <Shield className={`h-3.5 w-3.5 flex-shrink-0 ${
                    confirmationRate >= 90 ? 'text-green-600' :
                    confirmationRate >= 75 ? 'text-blue-600' :
                    confirmationRate >= 60 ? 'text-yellow-600' :
                    confirmationRate >= 40 ? 'text-orange-600' :
                    'text-red-600'
                  }`} />
                  <span className={`font-semibold hidden sm:inline ${
                    confirmationRate >= 90 ? 'text-green-700' :
                    confirmationRate >= 75 ? 'text-blue-700' :
                    confirmationRate >= 60 ? 'text-yellow-700' :
                    confirmationRate >= 40 ? 'text-orange-700' :
                    'text-red-700'
                  }`}>تأكيد:</span>
                  <span className={`font-bold ${
                    confirmationRate >= 90 ? 'text-green-900' :
                    confirmationRate >= 75 ? 'text-blue-900' :
                    confirmationRate >= 60 ? 'text-yellow-900' :
                    confirmationRate >= 40 ? 'text-orange-900' :
                    'text-red-900'
                  }`}>{confirmationRate}%</span>
                </div>
              </div>
            </div>


          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedRouteHeader;
