import { useEffect, useState } from 'react'
import { loadRiveBytes } from './fileCache'

type BytesState = {
  bytes?: ArrayBuffer
  error?: string
}

/**
 * Fetches one file's bytes, cache-first.
 *
 * We hand Rive a buffer rather than a URL so the download goes through
 * `fileCache` — Drive's own headers forbid HTTP caching, and a gallery that
 * re-downloads everything on each visit isn't a gallery you show people twice.
 *
 * Several tiles usually share one file (each playing a different timeline from
 * it); they all resolve to the same cache entry, so it's fetched once.
 *
 * `enabled` is the tile's viewport gate: nothing is requested until the tile is
 * close enough to matter.
 */
export function useRiveBytes(url: string, cacheKey: string, enabled: boolean): BytesState {
  const [state, setState] = useState<BytesState>({})

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    loadRiveBytes(url, cacheKey).then(
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
  }, [url, cacheKey, enabled])

  return state
}
