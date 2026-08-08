import { useCallback, useEffect, useRef, useState } from 'react'
import { cacheKeyOf, type RiveAnimation } from './animations'
import { isDriveConfigured, listDriveAnimations } from './sources/drive'
import { listLocalAnimations } from './sources/local'
import { pruneFileCache } from './fileCache'
import { pruneAspectCache } from './aspectCache'

export type AnimationSource = 'drive' | 'local'

export type AnimationsState =
  | { status: 'loading' }
  | { status: 'ready'; animations: RiveAnimation[] }
  | { status: 'error'; message: string }

export const animationSource: AnimationSource = isDriveConfigured ? 'drive' : 'local'

/**
 * Resolves the gallery's file list.
 *
 * With Drive configured this is a network call, so it has real loading and
 * error states; the local folder resolves synchronously but goes through the
 * same states so there's only one code path to reason about.
 *
 * `reload` re-lists the folder without a page refresh — the byte cache means
 * files you've already seen don't come down again, so it's cheap enough to hit
 * every time you drop something new into Drive.
 */
export function useAnimations(): AnimationsState & { reload: () => void } {
  const [state, setState] = useState<AnimationsState>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)

  // Guards against a slow first request resolving after a newer one.
  const latest = useRef(0)

  useEffect(() => {
    const run = ++latest.current
    const controller = new AbortController()
    let cancelled = false

    const settle = (next: AnimationsState) => {
      if (cancelled || run !== latest.current) return
      setState(next)

      if (next.status === 'ready') {
        // Sweep both caches down to exactly what's in the gallery now, so
        // deleting a file in Drive reclaims its storage too.
        const keys = next.animations.map(cacheKeyOf)
        pruneAspectCache(keys)
        void pruneFileCache(keys)
      }
    }

    if (animationSource === 'local') {
      settle({ status: 'ready', animations: listLocalAnimations() })
      return () => {
        cancelled = true
      }
    }

    setState({ status: 'loading' })
    listDriveAnimations(controller.signal)
      .then((animations) => settle({ status: 'ready', animations }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        settle({
          status: 'error',
          message: error instanceof Error ? error.message : 'Couldn’t reach Google Drive.',
        })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  return { ...state, reload }
}
