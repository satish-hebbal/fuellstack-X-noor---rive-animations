import { useCallback, useRef, useState } from 'react'
import Download from 'reicon-react/icons/Download'
import { saveBlob, zipStore, type ZipEntry } from '../lib/zip'
import type { AssetFile } from '../lib/useAnimations'

/**
 * Hands over every file the gallery is built from, as one .zip.
 *
 * The point is the handoff: a developer picking this project up needs the
 * animations *and* the sounds that pair with them, and the pairing is the
 * leading number on each name. Shipping them in one archive, under the folder
 * each belongs to, keeps that contract visible instead of leaving someone to
 * reassemble it from a Drive folder and a repo.
 *
 * Everything is fetched fresh rather than read from the byte cache: that cache
 * holds .riv files only, and a download is a deliberate act where correctness
 * matters more than saving a second.
 */

const FILE_NAME = 'noor-animation-assets.zip'

/** Enough at once to saturate the connection, few enough to stay polite. */
const CONCURRENCY = 6

type Props = {
  assets: AssetFile[]
}

type Status =
  | { state: 'idle' }
  | { state: 'working'; done: number; total: number }
  | { state: 'failed'; message: string }

export function DownloadAll({ assets }: Props) {
  const [status, setStatus] = useState<Status>({ state: 'idle' })
  // Guards the one case a disabled button can't: a second click landing in the
  // same tick, before React has re-rendered with the new status.
  const busy = useRef(false)

  const download = useCallback(async () => {
    if (busy.current || assets.length === 0) return
    busy.current = true

    let done = 0
    setStatus({ state: 'working', done, total: assets.length })

    try {
      const entries = new Array<ZipEntry>(assets.length)
      let cursor = 0

      const workers = Array.from(
        { length: Math.min(CONCURRENCY, assets.length) },
        async () => {
          for (;;) {
            const index = cursor++
            if (index >= assets.length) return
            const asset = assets[index]

            const response = await fetch(asset.url)
            if (!response.ok) {
              throw new Error(`${asset.path} (HTTP ${response.status})`)
            }
            entries[index] = {
              path: asset.path,
              bytes: new Uint8Array(await response.arrayBuffer()),
            }

            done += 1
            setStatus({ state: 'working', done, total: assets.length })
          }
        },
      )

      await Promise.all(workers)
      saveBlob(zipStore(entries), FILE_NAME)
      setStatus({ state: 'idle' })
    } catch (error: unknown) {
      setStatus({
        state: 'failed',
        message: error instanceof Error ? error.message : 'Download failed.',
      })
    } finally {
      busy.current = false
    }
  }, [assets])

  const working = status.state === 'working'

  const label = working
    ? `Preparing ${status.done} of ${status.total}`
    : status.state === 'failed'
      ? `Couldn’t download: ${status.message}. Click to retry.`
      : `Download all ${assets.length} files as a .zip`

  return (
    <button
      className="btn btn--ghost btn--icon"
      type="button"
      onClick={() => void download()}
      disabled={working || assets.length === 0}
      data-state={status.state}
      title={label}
      aria-label={label}
    >
      {working ? (
        // The count is the progress bar — 35 files go by quickly enough that
        // anything more would be a flicker.
        <span className="btn__progress" aria-hidden="true">
          {status.done}
        </span>
      ) : (
        <Download size={17} aria-hidden="true" />
      )}
    </button>
  )
}
