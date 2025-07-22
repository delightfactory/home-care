import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * RoutePersistence component
 *
 * Persists the last non-auth route in localStorage and restores it on the first load.
 * This prevents the application from always redirecting to the dashboard after a
 * page refresh and helps users return to the exact page they were viewing.
 */
const RoutePersistence: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()

  // Save every route change (except auth pages) to localStorage
  useEffect(() => {
    const excluded = ['/login', '/signup']

    if (!excluded.includes(location.pathname)) {
      // Keep query params (e.g. ?page=2)
      localStorage.setItem('lastPath', location.pathname + location.search)
    }
  }, [location.pathname, location.search])

  // Restore the last route on first mount only
  useEffect(() => {
    const lastPath = localStorage.getItem('lastPath')
    if (!lastPath) return

    // If current path differs from stored path, navigate once on first mount
    if (lastPath !== location.pathname) {
      navigate(lastPath, { replace: true })
    }
    // We intentionally leave the dependency array empty so this runs once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default RoutePersistence
