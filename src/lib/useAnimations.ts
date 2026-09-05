import { useCallback, useEffect, useRef, useState } from 'react'
import { cacheKeyOf, expandToTiles, type RiveAnimation, type RiveTile } from './animations'
import { isDriveConfigured, listDriveAnimations } from './sources/drive'
import { listLocalAnimations } from './sources/local'
import { pruneFileCache } from './fileCache'
import { probeRiveFile, pruneContentsCache } from './probeFile'
import { bundledFiles, type BundledFile, type PlayerKind } from './bundledFiles'
import { ARTBOARD_LETTER, letterIndices } from './letters'
import { EXPAND_FILES_INTO_TILES, PROBE_CONCURRENCY, TILE_ASPECT_CLAMP } from '../config'

export type AnimationSource = 'drive' | 'local'

/** A folder in the gallery. */
export type Collection = {
  slug: string
  title: string
  /** How many animations it holds, whether or not each gets a tile. */
  count: number
  fileCount: number
  tiles: RiveTile[]
} & (
  /** Laid out as tiles, one per animation in the folder. */
  | { kind: 'grid' }
  /**
   * Shown one at a time with controls — right when the animations are
   * variations of a single thing, as the letters are: five tiles would be five
   * copies of the same stage. `player` says which stage draws them.
   */
  | { kind: 'player'; player: PlayerKind }
)

export type AnimationsState =
  | { status: 'loading' }
  | { status: 'ready'; collections: Collection[] }
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

function fallbackTile(file: RiveAnimation, key: string): RiveTile {
  return {
    id: file.id,
    title: file.title,
    fileName: file.fileName,
    url: file.url,
    cacheKey: key,
    artboard: '',
    aspectRatio: clampRatio(4 / 3),
  }
}

/**
 * Which letters a bundled file covers, read off the tiles the probe produced.
 * The mouth diagram numbers its timelines, the stroke file its artboards — the
 * leading number is the same contract either way.
 */
function coveredLetters(file: BundledFile, tiles: RiveTile[]): number[] {
  if (file.player === 'makhraj') {
    return letterIndices(tiles.map((tile) => tile.animation ?? tile.stateMachine ?? ''))
  }
  // Same rule the player itself applies, so the card can't promise a letter the
  // player won't offer.
  return letterIndices(
    tiles.map((tile) => tile.artboard),
    ARTBOARD_LETTER,
  )
}

/**
 * Resolves the gallery's collections.
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

    /** Read each file and turn it into tiles, one per animation inside. */
    async function toTiles(files: RiveAnimation[]): Promise<RiveTile[]> {
      const keys = files.map(cacheKeyOf)

      if (!EXPAND_FILES_INTO_TILES) {
        return files.map((file, index) => fallbackTile(file, keys[index]))
      }

      const contents = await mapWithLimit(files, PROBE_CONCURRENCY, (file) =>
        probeRiveFile(file).catch(() => null),
      )

      return files.flatMap((file, index) => {
        const found = contents[index]
        // A file we couldn't read still gets a tile, so its error is visible
        // rather than the file silently vanishing from the gallery.
        return found ? expandToTiles(file, found, clampRatio) : [fallbackTile(file, keys[index])]
      })
    }

    async function build(mascotFiles: RiveAnimation[]) {
      // The letter files ship with the app rather than coming from Drive, so
      // the collections are gathered separately and shown side by side.
      const [mascotTiles, ...bundledTiles] = await Promise.all([
        toTiles(mascotFiles),
        ...bundledFiles.map((file) => toTiles([file.animation])),
      ])

      if (!live()) return

      const collections: Collection[] = []
      if (mascotTiles.length > 0) {
        collections.push({
          slug: 'mascot',
          title: 'Mascot Animations',
          count: mascotTiles.length,
          fileCount: mascotFiles.length,
          kind: 'grid',
          tiles: mascotTiles,
        })
      }

      bundledFiles.forEach((file, index) => {
        const tiles = bundledTiles[index] ?? []
        if (tiles.length === 0) return
        collections.push({
          slug: file.slug,
          title: file.title,
          // A player counts letters, not tiles: the stroke file holds a state
          // machine *and* a timeline per artboard, which would otherwise read
          // as two animations per letter.
          count: coveredLetters(file, tiles).length,
          fileCount: 1,
          kind: 'player',
          player: file.player,
          tiles,
        })
      })

      setState({ status: 'ready', collections })

      // Sweep both caches down to the files that are actually in the gallery,
      // so deleting one in Drive reclaims its storage too.
      const keys = [...mascotFiles, ...bundledFiles.map((file) => file.animation)].map(cacheKeyOf)
      pruneContentsCache(keys)
      void pruneFileCache(keys)
    }

    setState({ status: 'loading' })

    const listing =
      animationSource === 'local'
        ? Promise.resolve(listLocalAnimations())
        : listDriveAnimations(controller.signal)

    listing.then(build).catch((error: unknown) => {
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
