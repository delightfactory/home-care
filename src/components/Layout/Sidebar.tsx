import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
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
  Coins,
  BarChart3,
  Shield,
  Settings,
  X,
  MessageSquare,
  Landmark,
  Briefcase,
  PieChart,
  ChevronDown,
} from 'lucide-react'
import { clsx } from '../../lib/clsx'

import { usePermissions } from '../../hooks/usePermissions'
import { LucideIcon } from 'lucide-react'

// --- Types ---

interface NavigationLink {
  name: string
  href: string
  icon: LucideIcon
  adminOnly?: boolean
  excludeRoles?: string[]
}

interface NavigationGroup {
  name: string
  icon: LucideIcon
  adminOnly?: boolean
  excludeRoles?: string[]
  children: NavigationLink[]
}

type NavigationEntry = NavigationLink | NavigationGroup

function isGroup(entry: NavigationEntry): entry is NavigationGroup {
  return 'children' in entry
}

// --- Navigation Structure ---

const navigation: NavigationEntry[] = [
  { name: 'لوحة التحكم', href: '/dashboard', icon: Home },

  // مجموعة العملاء
  {
    name: 'العملاء',
    icon: Users,
    excludeRoles: ['operations_supervisor'],
    children: [
      { name: 'إدارة العملاء', href: '/customers', icon: Users, excludeRoles: ['operations_supervisor'] },
      { name: 'استبيانات العملاء', href: '/surveys', icon: MessageSquare, adminOnly: true },
    ],
  },

  { name: 'الخدمات', href: '/services', icon: Wrench, excludeRoles: ['operations_supervisor'] },
  { name: 'الطلبات', href: '/orders', icon: ShoppingCart, excludeRoles: ['operations_supervisor'] },

  // مجموعة العمال
  {
    name: 'إدارة العمال',
    icon: UserCheck,
    children: [
      { name: 'العمال', href: '/workers', icon: UserCheck },
      { name: 'الفرق', href: '/teams', icon: Users2 },
      { name: 'حوافز العمال', href: '/bonuses', icon: Coins, adminOnly: true, excludeRoles: ['operations_supervisor'] },
    ],
  },

  { name: 'خطوط السير', href: '/routes', icon: Map },
  { name: 'المصروفات', href: '/expenses', icon: Receipt },

  // مجموعة المالى
  {
    name: 'النظام المالي',
    icon: Landmark,
    children: [
      { name: 'الخزائن والحسابات', href: '/finance', icon: Landmark },
      { name: 'الأرباح والخسائر', href: '/profit-loss', icon: PieChart, adminOnly: true },
    ],
  },

  { name: 'الموارد البشرية', href: '/hr', icon: Briefcase },
  { name: 'إدارة العمليات', href: '/operations', icon: Activity },
  { name: 'التقارير', href: '/reports', icon: BarChart3, adminOnly: true },

  { name: 'الرسائل', href: '/messages', icon: MessageSquare },

  // مجموعة الإعدادات
  {
    name: 'الإعدادات',
    icon: Settings,
    children: [
      { name: 'إعدادات النظام', href: '/settings', icon: Settings },
      { name: 'الأدوار والمستخدمين', href: '/roles', icon: Shield, adminOnly: true },
      { name: 'النسخ الاحتياطية', href: '/backups', icon: DownloadCloud, adminOnly: true },
    ],
  },
]

// --- Props ---

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

// --- Component ---

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { isAdmin, hasRole } = usePermissions()
  const location = useLocation()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Check if a single link/group should be visible
  const isVisible = (item: { adminOnly?: boolean; excludeRoles?: string[] }) => {
    if (item.adminOnly && !isAdmin()) return false
    if (item.excludeRoles?.some(role => hasRole(role))) return false
    return true
  }

  // Filter children of a group
  const getVisibleChildren = (group: NavigationGroup) =>
    group.children.filter(child => isVisible(child))

  // Build the filtered entries (hide groups with zero visible children)
  const filteredNav = navigation.filter(entry => {
    if (!isVisible(entry)) return false
    if (isGroup(entry)) {
      return getVisibleChildren(entry).length > 0
    }
    return true
  })

  // Check if a group contains the currently active route
  const groupContainsActive = (group: NavigationGroup) =>
    group.children.some(child => location.pathname === child.href)

  // Toggle group expand/collapse
  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  const isGroupExpanded = (groupName: string) =>
    expandedGroups.has(groupName)

  // --- Render helpers ---

  const renderLink = (
    item: NavigationLink,
    index: number,
    options?: { onClick?: () => void; isChild?: boolean }
  ) => (
    <li key={item.href} style={{ animationDelay: `${index * 50}ms` }}>
      <NavLink
        to={item.href}
        onClick={options?.onClick}
        className={({ isActive }) =>
          clsx(
            'sidebar-link group flex items-center gap-x-3 rounded-xl text-sm font-semibold transition-all duration-300 transform hover:scale-[1.02] animate-fade-in',
            options?.isChild ? 'p-2.5 pr-10' : 'p-3 hover:translate-x-1',
            isActive
              ? 'active bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg border-r-4 border-primary-300'
              : 'text-gray-700 hover:text-primary-700 hover:bg-gradient-to-r hover:from-primary-50 hover:to-primary-100 hover:shadow-md'
          )
        }
      >
        <div className={clsx(
          'sidebar-icon-container rounded-lg transition-all duration-300 group-hover:scale-110 bg-gray-100 group-hover:bg-primary-100',
          options?.isChild ? 'p-1.5' : 'p-2'
        )}>
          <item.icon
            className={clsx(
              'sidebar-icon transition-all duration-300 text-gray-600 group-hover:text-primary-600',
              options?.isChild ? 'h-4 w-4' : 'h-5 w-5'
            )}
            aria-hidden="true"
          />
        </div>
        <span className="transition-all duration-300">{item.name}</span>
      </NavLink>
    </li>
  )

  const renderGroup = (
    group: NavigationGroup,
    index: number,
    options?: { onChildClick?: () => void }
  ) => {
    const visibleChildren = getVisibleChildren(group)
    const isActive = groupContainsActive(group)
    const isExpanded = isGroupExpanded(group.name) || isActive

    return (
      <li key={group.name} style={{ animationDelay: `${index * 50}ms` }}>
        {/* Group Header */}
        <button
          onClick={() => toggleGroup(group.name)}
          className={clsx(
            'w-full sidebar-link group flex items-center gap-x-3 rounded-xl p-3 text-sm font-semibold transition-all duration-300 animate-fade-in',
            isActive
              ? 'bg-primary-50 text-primary-700 border-r-4 border-primary-300'
              : 'text-gray-700 hover:text-primary-700 hover:bg-gradient-to-r hover:from-primary-50 hover:to-primary-100 hover:shadow-md'
          )}
        >
          <div className="sidebar-icon-container p-2 rounded-lg transition-all duration-300 group-hover:scale-110 bg-gray-100 group-hover:bg-primary-100">
            <group.icon
              className="sidebar-icon h-5 w-5 transition-all duration-300 text-gray-600 group-hover:text-primary-600"
              aria-hidden="true"
            />
          </div>
          <span className="flex-1 text-right transition-all duration-300">{group.name}</span>
          <ChevronDown
            className={clsx(
              'h-4 w-4 text-gray-400 transition-transform duration-300',
              isExpanded && 'rotate-180'
            )}
          />
        </button>

        {/* Children */}
        <ul
          className={clsx(
            'overflow-hidden transition-all duration-300 ease-in-out',
            isExpanded ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'
          )}
        >
          <div className="space-y-1 mr-2 border-r-2 border-gray-200 pr-0">
            {visibleChildren.map((child, childIndex) =>
              renderLink(child, childIndex, {
                onClick: options?.onChildClick,
                isChild: true,
              })
            )}
          </div>
        </ul>
      </li>
    )
  }

  const renderEntry = (
    entry: NavigationEntry,
    index: number,
    options?: { onClick?: () => void }
  ) => {
    if (isGroup(entry)) {
      return renderGroup(entry, index, { onChildClick: options?.onClick })
    }
    return renderLink(entry as NavigationLink, index, { onClick: options?.onClick })
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:right-0 lg:z-30 lg:block lg:w-64 lg:overflow-y-auto lg:bg-white/95 lg:backdrop-blur-md lg:border-l lg:border-gray-200/50 lg:shadow-xl">
        <div className="flex h-16 shrink-0 items-center justify-center border-b border-gray-200/50 bg-gradient-to-r from-primary-50/80 to-primary-100/80 backdrop-blur-sm">
          <h1 className="text-lg font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent transition-all duration-300 hover:scale-105">
            نظام HOME CARE
          </h1>
        </div>
        <nav className="mt-6 px-4 pb-6">
          <ul role="list" className="space-y-2">
            {filteredNav.map((entry, index) => renderEntry(entry, index))}
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
            {filteredNav.map((entry, index) =>
              renderEntry(entry, index, { onClick: onClose })
            )}
          </ul>
        </nav>
      </div>
    </>
  )
}

export default Sidebar
