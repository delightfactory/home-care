import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

/**
 * RoutePersistence component
 *
 * Persists the last non-auth route in localStorage and restores it on the first load.
 * 
 * ⚠️ SECURITY: يتحقق من دور المستخدم قبل استعادة المسار
 * - الفني لا يمكن توجيهه لـ /dashboard
 * - المدير لا يمكن توجيهه لـ /tech
 */
const RoutePersistence: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, session } = useAuth()

  // الحصول على دور المستخدم
  const userRole = (user as any)?.role?.name

  // تحديد ما إذا كان المستخدم فني أو لا
  const isTechnician = userRole === 'team_leader' || userRole === 'technician'

  // مفتاح التخزين يعتمد على نوع المستخدم
  const storageKey = isTechnician ? 'lastPath_tech' : 'lastPath_admin'

  // المسارات المستثناة من الحفظ
  const excludedPaths = ['/login', '/signup']

  // Save every route change (except auth pages) to localStorage
  useEffect(() => {
    if (!session || !user) return

    if (!excludedPaths.includes(location.pathname)) {
      // تحقق من أن المسار مناسب لدور المستخدم
      const isTechPath = location.pathname.startsWith('/tech')

      // الفني يحفظ فقط مسارات /tech
      // المدير يحفظ فقط مسارات غير /tech
      if ((isTechnician && isTechPath) || (!isTechnician && !isTechPath)) {
        localStorage.setItem(storageKey, location.pathname + location.search)
      }
    }
  }, [location.pathname, location.search, session, user, isTechnician, storageKey])

  // Restore the last route on first mount only
  useEffect(() => {
    if (!session || !user) return

    const lastPath = localStorage.getItem(storageKey)
    if (!lastPath) return

    // تحقق إضافي: لا تستعيد مسار إذا كان لا يتوافق مع الدور
    const isTechPath = lastPath.startsWith('/tech')

    // الفني يجب أن يذهب لـ /tech فقط
    if (isTechnician && !isTechPath) {
      // مسار خاطئ للفني، تجاهله
      console.warn('RoutePersistence: Ignoring non-tech path for technician:', lastPath)
      localStorage.removeItem(storageKey)
      return
    }

    // غير الفني يجب ألا يذهب لـ /tech
    if (!isTechnician && isTechPath) {
      // مسار خاطئ للمدير، تجاهله
      console.warn('RoutePersistence: Ignoring tech path for non-technician:', lastPath)
      localStorage.removeItem(storageKey)
      return
    }

    // If current path differs from stored path, navigate once
    if (lastPath !== location.pathname + location.search) {
      navigate(lastPath, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, user, isTechnician])

  return null
}

export default RoutePersistence

