import { useCallback, useEffect, useRef, useState } from 'react'
import { cacheKeyOf, expandToTiles, type RiveAnimation, type RiveTile } from './animations'
import { isDriveConfigured, listDriveAnimations } from './sources/drive'
import { listLocalAnimations } from './sources/local'
import { pruneFileCache } from './fileCache'
import { probeRiveFile, pruneContentsCache } from './probeFile'
import { bundledFiles, collectionSpecs, stem, type PlayerKind } from './bundledFiles'
import { ARTBOARD_LETTER, letterIndices } from './letters'
import { listLetterSounds } from './riveAudio'
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
  | {
      kind: 'player'
      player: PlayerKind
      /** The file the player loads — from Drive when there is one, else bundled. */
      src: string
    }
)

/**
 * One file in the downloadable bundle: where its bytes are now, and where it
 * should sit inside the .zip. Built alongside the collections because that is
 * where the routing already knows which file belongs to what.
 */
export type AssetFile = {
  /** Path inside the archive, e.g. `letters/29-letters.riv`. */
  path: string
  url: string
}

export type AnimationsState =
  | { status: 'loading' }
  | { status: 'ready'; collections: Collection[]; assets: AssetFile[] }
  | { status: 'error'; message: string }

export const animationSource: AnimationSource = isDriveConfigured ? 'drive' : 'local'

/**
 * Grid collections besides Mascot, each claiming its files by name the same
 * way the player collections do. Unclaimed files still fall through to Mascot.
 */
const gridSpecs: { slug: string; title: string; match: RegExp }[] = [
  {
    slug: 'events',
    title: 'Events',
    match: /^(first-aya|loading|planing-your-path)\b/i,
  },
]

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
function coveredLetters(player: PlayerKind, tiles: RiveTile[]): number[] {
  if (player === 'makhraj') {
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

    /**
     * Sort the listed files into collections before reading any of them.
     *
     * A player collection takes the file whose name claims it — so a letters
     * export dropped into Drive drives Letter Animations rather than arriving
     * as twenty-nine loose tiles in the Mascot grid. Whatever no collection
     * claims is the grid, which is most things.
     */
    function route(files: RiveAnimation[]) {
      const claimed = new Map<string, RiveAnimation>()
      const mascotFiles: RiveAnimation[] = []
      const grids = gridSpecs.map((spec) => ({ spec, files: [] as RiveAnimation[] }))

      for (const file of files) {
        const spec = collectionSpecs.find((candidate) => candidate.match.test(file.fileName))
        if (!spec) {
          const grid = grids.find((candidate) => candidate.spec.match.test(file.fileName))
          ;(grid ? grid.files : mascotFiles).push(file)
          continue
        }
        // Several exports of the same collection in one folder: newest wins,
        // by the same stem rule the bundled folders use.
        const held = claimed.get(spec.slug)
        if (!held || stem(held.fileName).localeCompare(stem(file.fileName)) < 0) {
          claimed.set(spec.slug, file)
        }
      }

      // Drive wins where it has a file, so updating an animation is an upload
      // rather than a commit. The bundled copy is what's left when it doesn't
      // — which is every collection when Drive isn't configured at all.
      const players = collectionSpecs.flatMap((spec) => {
        const animation =
          claimed.get(spec.slug) ??
          bundledFiles.find((file) => file.slug === spec.slug)?.animation
        return animation ? [{ spec, animation }] : []
      })

      return { mascotFiles, grids, players }
    }

    async function build(files: RiveAnimation[]) {
      const { mascotFiles, grids: extraGrids, players } = route(files)
      const grids = [
        { spec: { slug: 'mascot', title: 'Mascot Animations' }, files: mascotFiles },
        ...extraGrids,
      ]

      const [gridTiles, playerTiles] = await Promise.all([
        Promise.all(grids.map((grid) => toTiles(grid.files))),
        Promise.all(players.map(({ animation }) => toTiles([animation]))),
      ])

      if (!live()) return

      const collections: Collection[] = []
      grids.forEach(({ spec, files }, index) => {
        const tiles = gridTiles[index]
        if (tiles.length === 0) return
        collections.push({
          slug: spec.slug,
          title: spec.title,
          count: tiles.length,
          fileCount: files.length,
          kind: 'grid',
          tiles,
        })
      })

      players.forEach(({ spec, animation }, index) => {
        const tiles = playerTiles[index] ?? []
        if (tiles.length === 0) return
        collections.push({
          slug: spec.slug,
          title: spec.title,
          // A player counts letters, not tiles: the stroke file holds a state
          // machine *and* a timeline per artboard, which would otherwise read
          // as two animations per letter.
          count: coveredLetters(spec.player, tiles).length,
          fileCount: 1,
          kind: 'player',
          player: spec.player,
          src: animation.url,
          tiles,
        })
      })

      // Everything a developer would need to rebuild this gallery: each
      // collection's file under its own folder, and the sounds that pair with
      // the letters by number.
      const assets: AssetFile[] = [
        ...grids.flatMap(({ spec, files }) =>
          files.map((file) => ({ path: `${spec.slug}/${file.fileName}`, url: file.url })),
        ),
        ...players.map(({ spec, animation }) => ({
          path: `${spec.slug}/${animation.fileName}`,
          url: animation.url,
        })),
        ...listLetterSounds().map((sound) => ({
          path: `audio/${sound.fileName}`,
          url: sound.url,
        })),
      ]

      setState({ status: 'ready', collections, assets })

      // Sweep both caches down to the files that are actually in the gallery,
      // so deleting one in Drive reclaims its storage too.
      const keys = [
        ...grids.flatMap((grid) => grid.files),
        ...players.map(({ animation }) => animation),
      ].map(cacheKeyOf)
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
