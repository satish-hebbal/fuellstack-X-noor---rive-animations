/**
 * What the gallery renders, independent of where the files came from.
 *
 * Two sources implement this shape: `sources/drive.ts` lists a Google Drive
 * folder at runtime, `sources/local.ts` globs `src/rive/` at build time.
 */
export type RiveAnimation = {
  /** Stable identity. Survives the file being edited. */
  id: string
  /** Display name shown under the tile. */
  title: string
  /** Original filename, e.g. `loading-spinner.riv`. */
  fileName: string
  /** Where the bytes live. */
  url: string
  /** Changes whenever the file's *contents* change. */
  version: string
}

/**
 * Cache identity: the file plus its version. Because the version changes with
 * the contents, a cached entry can never be stale — an edited file simply
 * looks up a key that doesn't exist yet, and the old key gets pruned.
 */
export function cacheKeyOf(animation: RiveAnimation): string {
  return `${animation.id}@${animation.version}`
}

/** `loading-spinner.riv` → "Loading Spinner", `heroIcon_v2.riv` → "Hero Icon V2". */
export function toTitle(fileName: string): string {
  return fileName
    .replace(/\.riv$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Alphabetical, with natural number ordering so `scene-2` precedes `scene-10`. */
export function byTitle(a: RiveAnimation, b: RiveAnimation): number {
  return a.title.localeCompare(b.title, undefined, { numeric: true })
}

/**
 * One tile in the gallery.
 *
 * Not the same thing as a file: a single .riv usually contains a whole set of
 * timelines, and each of those gets its own tile. See `expandToTiles`.
 */
export type RiveTile = {
  id: string
  /** What's printed under the tile. */
  title: string
  /** File this came from — shown in the lightbox and on hover. */
  fileName: string
  url: string
  /** Byte-cache key; shared by every tile from the same file. */
  cacheKey: string
  artboard: string
  /** Exactly one of these is set — the thing this tile plays. */
  animation?: string
  stateMachine?: string
  /** From the artboard's own dimensions, so masonry never has to settle. */
  aspectRatio: number
}

/**
 * Turn one file into its tiles: one per state machine, then one per timeline.
 *
 * A file with a single animation keeps the filename as its title (a lone
 * "Untitled 1" tile would be useless). A file with many uses each animation's
 * own name, since that's what distinguishes them.
 */
export function expandToTiles(
  animation: RiveAnimation,
  contents: { artboards: { name: string; width: number; height: number; animations: string[]; stateMachines: string[] }[] },
  clamp: (ratio: number) => number,
): RiveTile[] {
  const tiles: RiveTile[] = []
  const manyArtboards = contents.artboards.length > 1

  for (const artboard of contents.artboards) {
    const aspectRatio = clamp(artboard.height > 0 ? artboard.width / artboard.height : 1)

    // State machines first: when a file has one, it's usually the headline
    // piece and the timelines are the parts it drives.
    const entries: { name: string; kind: 'stateMachine' | 'animation' }[] = [
      ...artboard.stateMachines.map((name) => ({ name, kind: 'stateMachine' as const })),
      ...artboard.animations.map((name) => ({ name, kind: 'animation' as const })),
    ]

    // An artboard with neither still deserves a tile — it's static artwork.
    if (entries.length === 0) {
      tiles.push({
        id: `${animation.id}:${artboard.name}`,
        title: manyArtboards ? toTitle(artboard.name) : animation.title,
        fileName: animation.fileName,
        url: animation.url,
        cacheKey: cacheKeyOf(animation),
        artboard: artboard.name,
        aspectRatio,
      })
      continue
    }

    for (const entry of entries) {
      tiles.push({
        id: `${animation.id}:${artboard.name}:${entry.kind}:${entry.name}`,
        title: manyArtboards
          ? `${toTitle(artboard.name)} · ${toTitle(entry.name)}`
          : toTitle(entry.name),
        fileName: animation.fileName,
        url: animation.url,
        cacheKey: cacheKeyOf(animation),
        artboard: artboard.name,
        [entry.kind]: entry.name,
        aspectRatio,
      })
    }
  }

  // Single-tile files read better as the filename than as "Untitled 1".
  if (tiles.length === 1) tiles[0].title = animation.title

  return tiles
}
