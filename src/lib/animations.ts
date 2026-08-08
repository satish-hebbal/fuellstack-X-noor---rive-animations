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
