import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.tsx'
import Header from './Header.tsx'
import FloatingRefreshButton from '../UI/FloatingRefreshButton'
import FloatingCallButton from '../UI/FloatingCallButton'
import { PushNotificationPrompt } from '../Notifications'

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Header */}
      <Header onMenuClick={() => setSidebarOpen(true)} />

      {/* Main Content */}
      <div className="lg:pr-64 pt-16">
        {/* Page Content */}
        <main className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Floating Buttons */}
      <FloatingRefreshButton />
      <FloatingCallButton />

      {/* Push Notification Prompt - يظهر بعد 5 ثواني للمستخدمين غير المشتركين */}
      <PushNotificationPrompt delay={5000} variant="floating" />
    </div>
  )
}

export default Layout
