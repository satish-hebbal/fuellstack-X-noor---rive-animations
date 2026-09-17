import type { RiveAnimation } from './animations'

/**
 * The .riv files that ship with the app rather than coming from Drive: one
 * folder under `src/assets` per gallery collection, and one collection per
 * folder.
 *
 * The file *names* don't matter, so a fresh export can be dropped into its
 * folder as-is. Keep one file per folder: every file the glob sees is bundled
 * whether or not it's the one we play, so a superseded export is dead weight in
 * the build. Delete the old one once the new one looks right — or tuck it into a
 * subfolder, which the glob doesn't recurse into.
 *
 * If there are several we take the last by name, ignoring the extension, which
 * matches how the exports get named in practice: a suffixed revision sorts
 * after the name it revises (`-trail-c` then `-trail-d`, `29-letters` then
 * `29-letters-updated-a`), so we land on the newest rather than the stalest.
 * Comparing whole filenames would get that backwards, since `-` sorts before
 * the `.` of `.riv` and the base name would win.
 */

/**
 * The two shapes a letter file comes in, and how each maps its letters:
 *
 *   `makhraj` one artboard, a timeline per letter — `1. alif`, `2. baa`
 *   `strokes` an artboard per letter — `1`, `2`, `3`
 *
 * Either way the leading number in the name is the whole mapping, so adding
 * letters is an export, not a code change. Named rather than passed as a
 * component so this layer stays free of JSX; GalleryPage maps them.
 */
export type PlayerKind = 'makhraj' | 'strokes'

export type BundledFile = {
  src: string
  fileName: string
  /** The same shape the Drive files use, so the gallery can probe it. */
  animation: RiveAnimation
  /** How the gallery lists it. */
  slug: string
  title: string
  player: PlayerKind
}

type Spec = {
  found: Record<string, string>
  folder: string
  slug: string
  title: string
  player: PlayerKind
}

// Each glob is written out in full because Vite resolves it at build time from
// the literal — a variable path would match nothing.
const specs: Spec[] = [
  {
    found: import.meta.glob('../assets/makhraj/*.riv', {
      eager: true,
      query: '?url',
      import: 'default',
    }) as Record<string, string>,
    folder: 'makhraj',
    slug: 'makhraj',
    title: 'Makhraj Animations',
    player: 'makhraj',
  },
  {
    found: import.meta.glob('../assets/letters/*.riv', {
      eager: true,
      query: '?url',
      import: 'default',
    }) as Record<string, string>,
    folder: 'letters',
    slug: 'letters',
    title: 'Letter Animations',
    player: 'strokes',
  },
]

/** A path's name with its extension dropped: `a/29-letters.riv` to `29-letters`. */
const stem = (path: string) => (path.split('/').pop() ?? path).replace(/\.[^.]*$/, '')

function pick(spec: Spec): BundledFile | undefined {
  const entries = Object.entries(spec.found).sort(([a], [b]) =>
    stem(a).localeCompare(stem(b)),
  )
  const chosen = entries.at(-1)
  if (!chosen) return undefined

  const [path, src] = chosen
  const fileName = path.split('/').pop() ?? `${spec.slug}.riv`

  if (import.meta.env.DEV && entries.length > 1) {
    console.warn(
      `[${spec.slug}] ${entries.length} .riv files in src/assets/${spec.folder} — ` +
        `using ${fileName}, and bundling the rest for nothing. ` +
        `Delete the ones you don't want.`,
    )
  }

  return {
    src,
    fileName,
    animation: {
      id: spec.slug,
      title: spec.title,
      fileName,
      url: src,
      // Vite content-hashes the URL, so it changes whenever the file does.
      version: src,
    },
    slug: spec.slug,
    title: spec.title,
    player: spec.player,
  }
}

/** Every bundled file that's actually present, in gallery order. */
export const bundledFiles: BundledFile[] = specs
  .map(pick)
  .filter((file) => file !== undefined)

const bySlug = (slug: string) => bundledFiles.find((file) => file.slug === slug)

/** The mouth diagram, used directly by the /makhraj page. */
export const makhrajFile = bySlug('makhraj')
/** The letter strokes. */
export const letterFile = bySlug('letters')
