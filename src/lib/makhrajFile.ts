import type { RiveAnimation } from './animations'

/**
 * The makhraj mouth-diagram .riv, shared by the /makhraj page and the gallery.
 *
 * The name doesn't matter, so a fresh export can be dropped into `src/assets`
 * as-is. Keep one file there. If there are several we take the last by name,
 * which matches how the exports get named in practice (`-trail-c`, `-trail-d`)
 * and so lands on the newest rather than the stalest.
 */
const found = import.meta.glob('../assets/*.riv', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const entries = Object.entries(found).sort(([a], [b]) => a.localeCompare(b))
const chosen = entries.at(-1)

if (import.meta.env.DEV && entries.length > 1) {
  console.warn(
    `[makhraj] ${entries.length} .riv files in src/assets — using ` +
      `${chosen?.[0].split('/').pop()}. Delete the ones you don't want.`,
  )
}

export const makhrajSrc: string | undefined = chosen?.[1]

const fileName = chosen?.[0].split('/').pop() ?? 'makhraj.riv'

/** The same shape the Drive files use, so the gallery can expand it into tiles. */
export function makhrajAnimation(): RiveAnimation | undefined {
  if (!makhrajSrc) return undefined
  return {
    id: 'makhraj',
    title: 'Makhraj',
    fileName,
    url: makhrajSrc,
    // Vite content-hashes the URL, so it changes whenever the file does.
    version: makhrajSrc,
  }
}
