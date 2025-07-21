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
  BarChart3, 
  Shield,
  Settings,
  X
} from 'lucide-react'
import { clsx } from '../../lib/clsx'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const navigation = [
  { name: 'لوحة التحكم', href: '/dashboard', icon: Home },
  { name: 'العملاء', href: '/customers', icon: Users },
  { name: 'الخدمات', href: '/services', icon: Wrench },
  { name: 'الطلبات', href: '/orders', icon: ShoppingCart },
  { name: 'العمال', href: '/workers', icon: UserCheck },
  { name: 'الفرق', href: '/teams', icon: Users2 },
  { name: 'خطوط السير', href: '/routes', icon: Map },
  { name: 'المصروفات', href: '/expenses', icon: Receipt },
  { name: 'التقارير', href: '/reports', icon: BarChart3 },
  { name: 'الأدوار', href: '/roles', icon: Shield },
  { name: 'الإعدادات', href: '/settings', icon: Settings },
]

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:right-0 lg:z-50 lg:block lg:w-64 lg:overflow-y-auto lg:bg-white lg:border-l lg:border-gray-200">
        <div className="flex h-16 shrink-0 items-center justify-center border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">
            نظام إدارة التنظيف
          </h1>
        </div>
        <nav className="mt-8">
          <ul role="list" className="flex flex-1 flex-col gap-y-7 px-6">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <NavLink
                      to={item.href}
                      className={({ isActive }) =>
                        clsx(
                          isActive
                            ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-700'
                            : 'text-gray-700 hover:text-primary-700 hover:bg-gray-50',
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors duration-200'
                        )
                      }
                    >
                      <item.icon
                        className="h-6 w-6 shrink-0"
                        aria-hidden="true"
                      />
                      {item.name}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </li>
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
          <h1 className="text-xl font-bold text-gray-900">
            نظام إدارة التنظيف
          </h1>
          <button
            type="button"
            className="-m-2.5 rounded-md p-2.5 text-gray-700"
            onClick={onClose}
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <nav className="mt-8">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <NavLink
                      to={item.href}
                      onClick={onClose}
                      className={({ isActive }) =>
                        clsx(
                          isActive
                            ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-700'
                            : 'text-gray-700 hover:text-primary-700 hover:bg-gray-50',
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors duration-200'
                        )
                      }
                    >
                      <item.icon
                        className="h-6 w-6 shrink-0"
                        aria-hidden="true"
                      />
                      {item.name}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    </>
  )
}

export default Sidebar
