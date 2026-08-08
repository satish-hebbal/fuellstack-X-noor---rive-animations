import { useEffect, useState } from 'react'
import { cacheKeyOf, type RiveAnimation } from './animations'
import { loadRiveBytes } from './fileCache'

type BytesState = {
  bytes?: ArrayBuffer
  error?: string
}

/**
 * Fetches one animation's bytes, cache-first.
 *
 * We hand Rive a buffer rather than a URL so the download goes through
 * `fileCache` — Drive's own headers forbid HTTP caching, and a gallery that
 * re-downloads everything on each visit isn't a gallery you show people twice.
 *
 * `enabled` is the tile's viewport gate: nothing is requested until the tile is
 * close enough to matter.
 */
export function useRiveBytes(animation: RiveAnimation, enabled: boolean): BytesState {
  const [state, setState] = useState<BytesState>({})

  const { url } = animation
  const key = cacheKeyOf(animation)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    loadRiveBytes(url, key).then(
      (bytes) => {
        if (!cancelled) setState({ bytes })
      },
      (error: unknown) => {
        if (cancelled) return
        setState({
          error: error instanceof Error ? error.message : 'Couldn’t download this file.',
        })
      },
    )

    return () => {
      cancelled = true
    }
  }, [url, key, enabled])

  return state
}
