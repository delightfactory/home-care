import React, { Suspense, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout/Layout'

import LoadingSpinner from './components/UI/LoadingSpinner'
import { AdminGuard } from './hooks/usePermissions'
import RoutePersistence from './components/Router/RoutePersistence'
import { VoiceCallProvider } from './components/VoiceCallProvider'

// PWA Components
import {
  InstallPrompt,
  OfflineManager,
  UpdateNotification,
  registerPWAEventListeners,
  trackPWAPerformance
} from './components/PWA'

// Lazy-loaded pages for code-splitting
const LoginPage = React.lazy(() => import('./pages/Auth/LoginPage'))
const SignUpPage = React.lazy(() => import('./pages/Auth/SignUpPage'))
const DashboardPage = React.lazy(() => import('./pages/Dashboard/DashboardPage'))
const CustomersPage = React.lazy(() => import('./pages/Customers/CustomersPage'))
const ServicesPage = React.lazy(() => import('./pages/Services/ServicesPage'))
const OrdersPage = React.lazy(() => import('./pages/Orders/OrdersPage'))
const WorkersPage = React.lazy(() => import('./pages/Workers/WorkersPage'))
const TeamsPage = React.lazy(() => import('./pages/Teams/TeamsPage'))
const RoutesPage = React.lazy(() => import('./pages/Routes/RoutesPage'))
const ExpensesPage = React.lazy(() => import('./pages/Expenses/ExpensesPage'))
const OperationsPage = React.lazy(() => import('./pages/Operations/OperationsPage'))
const ReportsPage = React.lazy(() => import('./pages/Reports/ReportsPage'))
const SettingsPage = React.lazy(() => import('./pages/Settings/SettingsPage'))
const BackupsPage = React.lazy(() => import('./pages/Backups/BackupsPage'))
const RolesPage = React.lazy(() => import('./pages/Admin/RolesPage'))
const BonusesPage = React.lazy(() => import('./pages/Bonuses/BonusesPage'))
const SurveyFormPage = React.lazy(() => import('./pages/Survey/SurveyFormPage'))
const SurveysPage = React.lazy(() => import('./pages/Surveys/SurveysPage'))
const NotificationsPage = React.lazy(() => import('./pages/Notifications/NotificationsPage'))
const MessagesPage = React.lazy(() => import('./pages/MessagesPage'))

// Technician App - تطبيق الفنى (منفصل)
const TechDashboard = React.lazy(() => import('./pages/Tech/TechDashboard'))
const TechExpensesPage = React.lazy(() => import('./pages/Tech/TechExpensesPage'))
const TechNotificationsPage = React.lazy(() => import('./pages/Tech/TechNotificationsPage'))
const TechMessagesPage = React.lazy(() => import('./pages/Tech/TechMessagesPage'))
import { TechGuard } from './components/Guards/TechGuard'

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session, loading } = useAuth()

  // لا نعرض شيئًا حتى ننتهي من التحقق من الجلسة أو جلب الملف الشخصي
  if (loading || (session && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  // إذا لم تكن هناك جلسة مُصادَقة، وجّه المستخدم لصفحة الدخول
  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Public Route Component (redirect if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session, loading, signOut } = useAuth()

  // انتظر اكتمال التحقق حتى لا يحدث وميض
  if (loading || (session && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  // إذا كان المستخدم مُسجَّل الدخول بالفعل
  if (session && user) {
    const userRole = (user as any)?.role?.name

    // إذا كان فني أو قائد فريق فقط، وجّه لتطبيق الفنى
    if (userRole === 'team_leader' || userRole === 'technician') {
      return <Navigate to="/tech" replace />
    }

    // باقي الأدوار المعروفة للتطبيق العام - وجّه للداشبورد
    const knownAdminRoles = ['manager', 'operations_supervisor', 'receptionist', 'admin']
    if (knownAdminRoles.includes(userRole)) {
      return <Navigate to="/dashboard" replace />
    }

    // للمستخدمين pending أو أدوار غير معروفة - عرض شاشة انتظار
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-lg">
          <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">حسابك قيد المراجعة</h2>
          <p className="text-gray-600 mb-6">
            يتم حالياً مراجعة حسابك من قبل المسؤول. سيتم إعلامك عند تفعيل حسابك.
          </p>
          <button
            onClick={() => signOut()}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// App Routes Component
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      <Route
        path="/signup"
        element={
          <PublicRoute>
            <SignUpPage />
          </PublicRoute>
        }
      />

      {/* Public Survey Route (accessible without auth) */}
      <Route
        path="/survey/:token"
        element={<SurveyFormPage />}
      />

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="workers" element={<WorkersPage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="routes" element={<RoutesPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route
          path="reports"
          element={
            <AdminGuard fallback={<Navigate to="/dashboard" replace />}>
              <ReportsPage />
            </AdminGuard>
          }
        />
        <Route
          path="surveys"
          element={
            <AdminGuard fallback={<Navigate to="/dashboard" replace />}>
              <SurveysPage />
            </AdminGuard>
          }
        />
        <Route
          path="bonuses"
          element={
            <AdminGuard fallback={<Navigate to="/dashboard" replace />}>
              <BonusesPage />
            </AdminGuard>
          }
        />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="messages/:conversationId" element={<MessagesPage />} />
        <Route
          path="backups"
          element={
            <AdminGuard fallback={<Navigate to="/dashboard" replace />}>
              <BackupsPage />
            </AdminGuard>
          }
        />
        <Route
          path="roles"
          element={
            <AdminGuard fallback={<Navigate to="/dashboard" replace />}>
              <RolesPage />
            </AdminGuard>
          }
        />
      </Route>

      {/* Technician App - تطبيق الفنى منفصل */}
      <Route
        path="/tech"
        element={
          <TechGuard>
            <TechDashboard />
          </TechGuard>
        }
      />
      <Route
        path="/tech/expenses"
        element={
          <TechGuard>
            <TechExpensesPage />
          </TechGuard>
        }
      />

      {/* Catch all route */}
      <Route
        path="/tech/notifications"
        element={
          <TechGuard>
            <TechNotificationsPage />
          </TechGuard>
        }
      />
      <Route
        path="/tech/messages"
        element={
          <TechGuard>
            <TechMessagesPage />
          </TechGuard>
        }
      />
      <Route
        path="/tech/messages/:conversationId"
        element={
          <TechGuard>
            <TechMessagesPage />
          </TechGuard>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

// PWA UI wrapper to hide InstallPrompt on survey route
const PWAUI: React.FC = () => {
  const location = useLocation();
  const { user, session } = useAuth();
  const isSurveyRoute = location.pathname.startsWith('/survey/');
  const isAuthenticated = Boolean(session && user);
  return (
    <>
      <OfflineManager />
      {isAuthenticated && !isSurveyRoute && <InstallPrompt />}
      <UpdateNotification />
    </>
  );
};

// Main App Component
const App: React.FC = () => {
  useEffect(() => {
    // Initialize PWA features
    registerPWAEventListeners();
    trackPWAPerformance();
  }, []);

  return (
    <AuthProvider>
      <Router>
        <VoiceCallProvider>
          <div className="App">
            <RoutePersistence />

            {/* PWA Components */}
            <PWAUI />

            <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="large" /></div>}>
              <AppRoutes />
            </Suspense>

            <Toaster
              position="top-center"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                  fontFamily: 'Cairo, Tajawal, system-ui, sans-serif',
                  direction: 'rtl',
                  textAlign: 'right',
                },
                success: {
                  iconTheme: {
                    primary: '#22c55e',
                    secondary: '#fff',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </div>
        </VoiceCallProvider>
      </Router>
    </AuthProvider>
  )
}

export default App
