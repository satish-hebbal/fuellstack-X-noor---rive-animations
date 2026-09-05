import type { RiveAnimation } from './animations'

/**
 * The .riv files that ship with the app rather than coming from Drive: one
 * folder under `src/assets` per gallery collection, and one collection per
 * folder.
 *
 * The file *names* don't matter, so a fresh export can be dropped into its
 * folder as-is. Keep one file per folder. If there are several we take the last
 * by name, which matches how the exports get named in practice (`-trail-c`,
 * `-trail-d`) and so lands on the newest rather than the stalest.
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

function pick(spec: Spec): BundledFile | undefined {
  const entries = Object.entries(spec.found).sort(([a], [b]) => a.localeCompare(b))
  const chosen = entries.at(-1)
  if (!chosen) return undefined

  const [path, src] = chosen
  const fileName = path.split('/').pop() ?? `${spec.slug}.riv`

  if (import.meta.env.DEV && entries.length > 1) {
    console.warn(
      `[${spec.slug}] ${entries.length} .riv files in src/assets/${spec.folder} — ` +
        `using ${fileName}. Delete the ones you don't want.`,
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
