import React, { Suspense, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout/Layout'

import LoadingSpinner from './components/UI/LoadingSpinner'
import { AdminGuard } from './hooks/usePermissions'
import RoutePersistence from './components/Router/RoutePersistence'

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

// Technician App - تطبيق الفنى (منفصل)
const TechDashboard = React.lazy(() => import('./pages/Tech/TechDashboard'))
const TechExpensesPage = React.lazy(() => import('./pages/Tech/TechExpensesPage'))
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
  const { user, session, loading } = useAuth()

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
    // إذا كان فني أو قائد فريق، وجّه لتطبيق الفنى
    const userRole = (user as any)?.role?.name
    if (userRole === 'team_leader' || userRole === 'technician') {
      return <Navigate to="/tech" replace />
    }
    // باقى المستخدمين للوحة التحكم
    return <Navigate to="/dashboard" replace />
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
      </Router>
    </AuthProvider>
  )
}

export default App
