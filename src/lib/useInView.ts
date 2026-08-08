import { useEffect, useState, type RefObject } from 'react'

type Handler = (visible: boolean) => void

type Pool = {
  observe: (el: Element, handler: Handler) => void
  unobserve: (el: Element) => void
}

/**
 * One IntersectionObserver per distinct rootMargin, shared by every element
 * that asks for it. A 200-tile gallery therefore costs 2 observers, not 400.
 */
const pools = new Map<string, Pool>()

function getPool(rootMargin: string): Pool {
  const existing = pools.get(rootMargin)
  if (existing) return existing

  const handlers = new Map<Element, Handler>()
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) handlers.get(entry.target)?.(entry.isIntersecting)
    },
    { rootMargin },
  )

  const pool: Pool = {
    observe(el, handler) {
      handlers.set(el, handler)
      observer.observe(el)
    },
    unobserve(el) {
      handlers.delete(el)
      observer.unobserve(el)
    },
  }

  pools.set(rootMargin, pool)
  return pool
}

type Options = {
  /** Grows the viewport rectangle, e.g. '800px' to react before an element is on screen. */
  rootMargin?: string
  /** Latch to `true` on first intersection and stop observing. */
  once?: boolean
}

/**
 * Tracks whether an element intersects the viewport (optionally expanded by
 * `rootMargin`). Used twice per tile: once with a wide margin to decide when to
 * create the Rive instance, once with no margin to decide when to run its
 * render loop.
 */
export function useInView(
  ref: RefObject<Element | null>,
  { rootMargin = '0px', once = false }: Options = {},
): boolean {
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Very old browsers / non-DOM environments: show everything rather than nothing.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }

    const pool = getPool(rootMargin)
    let settled = false

    const handle: Handler = (visible) => {
      if (settled) return
      if (visible && once) {
        settled = true
        pool.unobserve(el)
      }
      setInView(visible)
    }

    pool.observe(el, handle)
    return () => {
      if (!settled) pool.unobserve(el)
    }
  }, [ref, rootMargin, once])

  return inView
}
