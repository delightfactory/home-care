import React from 'react'
import { NavLink } from 'react-router-dom'
import { 
  Home, 
  Users, 
  Wrench, 
  ShoppingCart, 
  UserCheck, 
  Users2, 
  Map, 
  Receipt, 
  Activity,
  DownloadCloud,
  BarChart3, 
  Shield,
  Settings,
  X
} from 'lucide-react'
import { clsx } from '../../lib/clsx'

import { usePermissions } from '../../hooks/usePermissions'
import { LucideIcon } from 'lucide-react'

interface NavigationItem {
  name: string
  href: string
  icon: LucideIcon
  adminOnly?: boolean
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const navigation: NavigationItem[] = [
  { name: 'لوحة التحكم', href: '/dashboard', icon: Home },
  { name: 'العملاء', href: '/customers', icon: Users },
  { name: 'الخدمات', href: '/services', icon: Wrench },
  { name: 'الطلبات', href: '/orders', icon: ShoppingCart },
  { name: 'العمال', href: '/workers', icon: UserCheck },
  { name: 'الفرق', href: '/teams', icon: Users2 },
  { name: 'خطوط السير', href: '/routes', icon: Map },
  { name: 'المصروفات', href: '/expenses', icon: Receipt },
  { name: 'إدارة العمليات', href: '/operations', icon: Activity },
  { name: 'التقارير', href: '/reports', icon: BarChart3 },
  { name: 'الأدوار', href: '/roles', icon: Shield },
  { name: 'النسخ الاحتياطية', href: '/backups', icon: DownloadCloud, adminOnly: true },
  { name: 'الإعدادات', href: '/settings', icon: Settings },
]

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { isAdmin } = usePermissions()
  const filteredNav = navigation.filter(item => !item.adminOnly || isAdmin())
  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:right-0 lg:z-30 lg:block lg:w-64 lg:overflow-y-auto lg:bg-white/95 lg:backdrop-blur-md lg:border-l lg:border-gray-200/50 lg:shadow-xl">
        <div className="flex h-16 shrink-0 items-center justify-center border-b border-gray-200/50 bg-gradient-to-r from-primary-50/80 to-primary-100/80 backdrop-blur-sm">
          <h1 className="text-lg font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent transition-all duration-300 hover:scale-105">
            نظام HOME CARE
          </h1>
        </div>
        <nav className="mt-6 px-4">
          <ul role="list" className="space-y-2">
            {filteredNav.map((item, index) => (
              <li key={item.name} style={{ animationDelay: `${index * 50}ms` }}>
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    clsx(
                      'sidebar-link group flex items-center gap-x-3 rounded-xl p-3 text-sm font-semibold transition-all duration-300 transform hover:scale-[1.02] hover:translate-x-1 animate-fade-in',
                      isActive
                        ? 'active bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg border-r-4 border-primary-300'
                        : 'text-gray-700 hover:text-primary-700 hover:bg-gradient-to-r hover:from-primary-50 hover:to-primary-100 hover:shadow-md'
                    )
                  }
                >
                  <div className="sidebar-icon-container p-2 rounded-lg transition-all duration-300 group-hover:scale-110 bg-gray-100 group-hover:bg-primary-100">
                    <item.icon
                      className="sidebar-icon h-5 w-5 transition-all duration-300 text-gray-600 group-hover:text-primary-600"
                      aria-hidden="true"
                    />
                  </div>
                  <span className="transition-all duration-300">{item.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Mobile Sidebar */}
      <div
        className={clsx(
          'fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10 lg:hidden transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
            نظام HOME CARE
          </h1>
          <button
            type="button"
            className="-m-2.5 rounded-lg p-2.5 text-gray-700 hover:bg-gray-100 transition-colors duration-200"
            onClick={onClose}
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <nav className="mt-6">
          <ul role="list" className="space-y-2">
            {filteredNav.map((item, index) => (
              <li key={item.name} style={{ animationDelay: `${index * 50}ms` }}>
                <NavLink
                  to={item.href}
                  onClick={onClose}
                  className={({ isActive }) =>
                    clsx(
                      'sidebar-link group flex items-center gap-x-3 rounded-xl p-3 text-sm font-semibold transition-all duration-300 transform hover:scale-[1.02] animate-fade-in',
                      isActive
                        ? 'active bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg border-r-4 border-primary-300'
                        : 'text-gray-700 hover:text-primary-700 hover:bg-gradient-to-r hover:from-primary-50 hover:to-primary-100 hover:shadow-md'
                    )
                  }
                >
                  <div className="sidebar-icon-container p-2 rounded-lg transition-all duration-300 group-hover:scale-110 bg-gray-100 group-hover:bg-primary-100">
                    <item.icon
                      className="sidebar-icon h-5 w-5 transition-all duration-300 text-gray-600 group-hover:text-primary-600"
                      aria-hidden="true"
                    />
                  </div>
                  <span className="transition-all duration-300">{item.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  )
}

export default Sidebar
