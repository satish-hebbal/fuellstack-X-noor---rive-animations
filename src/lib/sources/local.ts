import { byTitle, toTitle, type RiveAnimation } from '../animations'

/**
 * Build-time source: every `.riv` in `src/rive/`.
 *
 * Used when Drive isn't configured, which keeps `npm run dev` working with no
 * API key and gives the deployed site something to fall back on.
 *
 * `query: '?url'` imports each file's URL rather than its bytes, so the .riv
 * files stay out of the JS bundle. Vite content-hashes those URLs, which makes
 * the URL itself a perfectly good version string.
 */
const files = import.meta.glob('../../rive/*.riv', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export function listLocalAnimations(): RiveAnimation[] {
  return Object.entries(files)
    .map(([path, url]) => {
      const fileName = path.split('/').pop() ?? path
      return {
        id: fileName.replace(/\.riv$/i, ''),
        fileName,
        title: toTitle(fileName),
        url,
        version: url,
      }
    })
    .sort(byTitle)
}
