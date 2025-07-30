import React, { Suspense, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
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

  // إذا كان المستخدم مُسجَّل الدخول بالفعل، وجّه مباشرة للوحة التحكم
  if (session && user) {
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
        <Route path="reports" element={<ReportsPage />} />
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

      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

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
          <OfflineManager />
          <InstallPrompt />
          <UpdateNotification />
          
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
