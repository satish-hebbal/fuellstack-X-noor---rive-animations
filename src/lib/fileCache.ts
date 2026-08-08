/**
 * Persistent byte cache for .riv files.
 *
 * Drive serves API downloads with `Cache-Control: private, max-age=0`, so the
 * browser's HTTP cache refuses to keep them — without this, every visit
 * re-downloads every animation. Cache Storage gives us somewhere to put them
 * that we control.
 *
 * Entries are keyed by file id *and* version, so a cached entry can never be
 * stale: editing a file in Drive changes its `modifiedTime`, which produces a
 * new key. Old keys are swept by `pruneFileCache`.
 */
const CACHE_NAME = 'rive-showcase-files-v1'
const KEY_PREFIX = '/__rive-cache/'

/** In-flight only. Settled entries are dropped so buffers aren't held forever. */
const inFlight = new Map<string, Promise<ArrayBuffer>>()

function cacheUrl(key: string): string {
  return KEY_PREFIX + encodeURIComponent(key)
}

async function openCache(): Promise<Cache | null> {
  // Absent in non-secure contexts and some private-browsing modes.
  if (typeof caches === 'undefined') return null
  try {
    return await caches.open(CACHE_NAME)
  } catch {
    return null
  }
}

/**
 * Fetch a .riv, preferring the cache. Concurrent callers for the same key
 * share one request — the tile and the lightbox routinely ask at once.
 */
export function loadRiveBytes(url: string, key: string): Promise<ArrayBuffer> {
  const pending = inFlight.get(key)
  if (pending) return pending

  const request = read(url, key).finally(() => inFlight.delete(key))
  inFlight.set(key, request)
  return request
}

async function read(url: string, key: string): Promise<ArrayBuffer> {
  const cache = await openCache()

  if (cache) {
    try {
      const hit = await cache.match(cacheUrl(key))
      if (hit) return await hit.arrayBuffer()
    } catch {
      // Corrupt entry: fall through and re-fetch.
    }
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Couldn’t download this file (HTTP ${response.status}).`)
  }
  const bytes = await response.arrayBuffer()

  if (cache) {
    try {
      await cache.put(cacheUrl(key), new Response(bytes))
    } catch {
      // Quota exceeded — the gallery works fine, it just re-downloads later.
    }
  }

  return bytes
}

/**
 * Drop cached files that are no longer in the gallery, or that have been
 * superseded by a newer version of the same file.
 */
export async function pruneFileCache(validKeys: Iterable<string>): Promise<void> {
  const cache = await openCache()
  if (!cache) return

  const keep = new Set<string>()
  for (const key of validKeys) keep.add(cacheUrl(key))

  try {
    const entries = await cache.keys()
    await Promise.all(
      entries
        .filter((entry) => !keep.has(new URL(entry.url).pathname))
        .map((entry) => cache.delete(entry)),
    )
  } catch {
    // Sweeping is housekeeping; failing it changes nothing the user sees.
  }
}
