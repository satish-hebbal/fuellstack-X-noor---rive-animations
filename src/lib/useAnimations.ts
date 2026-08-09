import { useCallback, useEffect, useRef, useState } from 'react'
import { cacheKeyOf, expandToTiles, type RiveAnimation, type RiveTile } from './animations'
import { isDriveConfigured, listDriveAnimations } from './sources/drive'
import { listLocalAnimations } from './sources/local'
import { pruneFileCache } from './fileCache'
import { probeRiveFile, pruneContentsCache } from './probeFile'
import { EXPAND_FILES_INTO_TILES, PROBE_CONCURRENCY, TILE_ASPECT_CLAMP } from '../config'

export type AnimationSource = 'drive' | 'local'

export type AnimationsState =
  | { status: 'loading' }
  | { status: 'ready'; tiles: RiveTile[]; fileCount: number }
  | { status: 'error'; message: string }

export const animationSource: AnimationSource = isDriveConfigured ? 'drive' : 'local'

const [MIN_RATIO, MAX_RATIO] = TILE_ASPECT_CLAMP
const clampRatio = (ratio: number) => Math.min(Math.max(ratio, MIN_RATIO), MAX_RATIO)

/** Run `task` over `items`, at most `limit` at a time. */
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await task(items[index])
    }
  })

  await Promise.all(workers)
  return results
}

/**
 * Resolves the gallery's tiles.
 *
 * Two steps: list the files, then read each one to find the animations inside
 * it. That second step is why a file holding ten timelines shows as ten tiles.
 *
 * Reading a file means downloading it, so the first visit fetches everything up
 * front rather than lazily — there's no way to know how many tiles a file
 * produces without opening it. Both the bytes and the resulting structure are
 * cached, so this happens once per file, ever.
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

    const live = () => !cancelled && run === latest.current

    async function build(files: RiveAnimation[]) {
      const keys = files.map(cacheKeyOf)

      let tiles: RiveTile[]
      if (EXPAND_FILES_INTO_TILES) {
        const contents = await mapWithLimit(files, PROBE_CONCURRENCY, (file) =>
          probeRiveFile(file).catch(() => null),
        )
        tiles = files.flatMap((file, index) => {
          const found = contents[index]
          // A file we couldn't read still gets a tile, so its error is visible
          // rather than the file silently vanishing from the gallery.
          if (!found) {
            return [
              {
                id: file.id,
                title: file.title,
                fileName: file.fileName,
                url: file.url,
                cacheKey: keys[index],
                artboard: '',
                aspectRatio: clampRatio(4 / 3),
              },
            ]
          }
          return expandToTiles(file, found, clampRatio)
        })
      } else {
        tiles = files.map((file, index) => ({
          id: file.id,
          title: file.title,
          fileName: file.fileName,
          url: file.url,
          cacheKey: keys[index],
          artboard: '',
          aspectRatio: clampRatio(4 / 3),
        }))
      }

      if (!live()) return

      setState({ status: 'ready', tiles, fileCount: files.length })

      // Sweep both caches down to the files that are actually in the gallery,
      // so deleting one in Drive reclaims its storage too.
      pruneContentsCache(keys)
      void pruneFileCache(keys)
    }

    setState({ status: 'loading' })

    const listing =
      animationSource === 'local'
        ? Promise.resolve(listLocalAnimations())
        : listDriveAnimations(controller.signal)

    listing
      .then(build)
      .catch((error: unknown) => {
        if (controller.signal.aborted || !live()) return
        setState({
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
