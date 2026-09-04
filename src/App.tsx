import { useEffect, useState } from 'react'
import GalleryPage from './pages/GalleryPage'
import MakhrajPage from './pages/MakhrajPage'

/**
 * Two pages, one path segment each. Deliberately not react-router: there are no
 * nested routes, params or loaders here, so a dozen lines beats a dependency.
 */
const routes = {
  '/noor': GalleryPage,
  '/makhraj': MakhrajPage,
} as const

const DEFAULT_PATH = '/noor'

function normalise(pathname: string): keyof typeof routes {
  const path = `/${pathname.replace(/^\/+|\/+$/g, '').split('/')[0]}`
  return path in routes ? (path as keyof typeof routes) : DEFAULT_PATH
}

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // An unknown or bare path settles on the default, and the address bar is
  // corrected so a refresh or a shared link behaves the same.
  const route = normalise(pathname)
  useEffect(() => {
    if (window.location.pathname !== route) {
      window.history.replaceState(null, '', route)
    }
  }, [route])

  const Page = routes[route]
  return <Page />
}
