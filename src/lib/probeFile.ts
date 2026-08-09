import { RiveFile } from '@rive-app/react-webgl2'
import { cacheKeyOf, type RiveAnimation } from './animations'
import { loadRiveBytes } from './fileCache'

/**
 * Reads what's actually inside a .riv: every artboard, every timeline, every
 * state machine, and the artboard's dimensions.
 *
 * This is what lets one file become many tiles. A .riv authored in Rive
 * typically holds a whole character's worth of animations — "idle", "excited",
 * "sleepy" — and showing one tile per file would hide all but one of them.
 *
 * `RiveFile` parses without needing a canvas or a renderer, so this is cheap:
 * no WebGL context, no render loop, just the file structure.
 *
 * Results are cached in localStorage under the same id@version key as the
 * bytes, so this only runs the first time a file is seen. Because the key
 * includes Drive's modifiedTime, re-exporting a file with new animations
 * re-probes it automatically.
 */
export type ArtboardContents = {
  name: string
  width: number
  height: number
  /** Linear timeline names, in file order. */
  animations: string[]
  stateMachines: string[]
}

export type FileContents = {
  artboards: ArtboardContents[]
}

const KEY = 'rive-showcase:contents'

type Cache = Record<string, FileContents>

function load(): Cache {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Cache
  } catch {
    return {}
  }
}

const cache = load()

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    // Quota or private mode — we just re-probe next time.
  }
}

export async function probeRiveFile(animation: RiveAnimation): Promise<FileContents> {
  const key = cacheKeyOf(animation)

  const cached = cache[key]
  if (cached?.artboards) return cached

  const buffer = await loadRiveBytes(animation.url, key)
  const file = new RiveFile({ buffer })
  await file.init()

  try {
    const instance = file.getInstance()
    const artboards: ArtboardContents[] = []

    for (let i = 0; i < instance.artboardCount(); i += 1) {
      const artboard = instance.artboardByIndex(i)
      try {
        const animations: string[] = []
        for (let a = 0; a < artboard.animationCount(); a += 1) {
          animations.push(artboard.animationByIndex(a).name)
        }

        const stateMachines: string[] = []
        for (let s = 0; s < artboard.stateMachineCount(); s += 1) {
          stateMachines.push(artboard.stateMachineByIndex(s).name)
        }

        const { minX, minY, maxX, maxY } = artboard.bounds
        artboards.push({
          name: artboard.name,
          width: maxX - minX,
          height: maxY - minY,
          animations,
          stateMachines,
        })
      } finally {
        // Artboard instances are WASM-owned and must be released by hand.
        try {
          artboard.delete?.()
        } catch {
          // Older runtimes manage this themselves; a failure here is harmless.
        }
      }
    }

    const contents: FileContents = { artboards }
    cache[key] = contents
    save()
    return contents
  } finally {
    file.cleanup()
  }
}

/** Drop entries for files that are gone, or that have been re-exported since. */
export function pruneContentsCache(validKeys: Iterable<string>): void {
  const keep = new Set(validKeys)
  let changed = false
  for (const key of Object.keys(cache)) {
    if (keep.has(key)) continue
    delete cache[key]
    changed = true
  }
  if (changed) save()
}
