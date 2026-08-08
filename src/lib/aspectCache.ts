/**
 * Remembers each animation's artboard shape between visits.
 *
 * A masonry column can only be packed once every tile's height is known, and a
 * tile's height isn't known until its .riv has loaded. On a cold visit the
 * columns therefore settle as files arrive. Caching the measured ratios means
 * that only ever happens once: every later visit lays out correctly on the
 * first paint.
 *
 * Keyed the same way as the byte cache — file id plus version — so an edited
 * file gets measured afresh rather than reusing its old shape.
 */
const KEY = 'rive-showcase:aspect'

type Cache = Record<string, number>

function load(): Cache {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Cache
  } catch {
    // Unparseable or blocked (private mode). Start over; it's only a cache.
    return {}
  }
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    // Quota exceeded or storage blocked — the app works fine without it.
  }
}

const cache = load()

export function getAspectRatio(key: string): number | undefined {
  const ratio = cache[key]
  return typeof ratio === 'number' && ratio > 0 ? ratio : undefined
}

export function rememberAspectRatio(key: string, ratio: number): void {
  // Three decimals is far below one pixel of column height. Storing full
  // floats would just bloat the entry.
  const rounded = Math.round(ratio * 1000) / 1000
  if (cache[key] === rounded) return
  cache[key] = rounded
  save()
}

/** Drop entries for files that are gone or have been edited since. */
export function pruneAspectCache(validKeys: Iterable<string>): void {
  const keep = new Set(validKeys)
  let changed = false

  for (const key of Object.keys(cache)) {
    if (keep.has(key)) continue
    delete cache[key]
    changed = true
  }

  if (changed) save()
}
