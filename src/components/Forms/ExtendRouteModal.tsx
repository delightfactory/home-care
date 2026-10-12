import AssignOrdersModal from './AssignOrdersModal'
import { RouteWithOrders } from '../../types'

interface Props {
  route: RouteWithOrders
  onClose: () => void
  onSuccess: () => void
}

export default function ExtendRouteModal({ route, onClose, onSuccess }: Props) {
  return <AssignOrdersModal open mode="extend" route={route} onClose={onClose} onSaved={onSuccess} />
}
