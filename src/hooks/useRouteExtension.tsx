import { useState } from 'react'
import { Plus } from 'lucide-react'
import ExtendRouteModal from '../components/Forms/ExtendRouteModal'
import { RouteWithOrders } from '../types'
import { usePermissions } from './usePermissions'
import { eventBus } from '../utils/EventBus'

type Permissions = Pick<ReturnType<typeof usePermissions>, 'hasPermission' | 'isTeamOnly'>

export function useRouteExtension(permissions: Permissions, refresh: () => void) {
  const [route, setRoute] = useState<RouteWithOrders | null>(null)
  const today = new Date().toISOString().substring(0, 10)

  const renderAction = (candidate: RouteWithOrders) => {
    if (candidate.status !== 'completed' || candidate.date !== today
      || permissions.isTeamOnly('routes') || permissions.isTeamOnly('orders')
      || !permissions.hasPermission('routes', 'update')
      || !(permissions.hasPermission('orders', 'assign') || permissions.hasPermission('orders', 'update'))) return null

    return <button type="button" className="p-2 text-blue-700 hover:bg-blue-50 rounded-lg"
      title="تمديد خط السير بطلب إضافي" aria-label="تمديد خط السير بطلب إضافي"
      onClick={event => { event.stopPropagation(); setRoute(candidate) }}>
      <Plus className="h-4 w-4" />
    </button>
  }

  return {
    isOpen: route !== null,
    renderAction,
    modal: route && <ExtendRouteModal key={route.id} route={route} onClose={() => setRoute(null)}
      onSuccess={() => { refresh(); eventBus.emit('routes:changed') }} />,
  }
}
