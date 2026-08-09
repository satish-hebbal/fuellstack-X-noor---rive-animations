import { useRef } from 'react'
import { RiveStage } from './RiveStage'
import { useInView } from '../lib/useInView'
import { useFpsReadout } from '../lib/useFpsReadout'
import { useRiveBytes } from '../lib/useRiveBytes'
import { PRELOAD_MARGIN } from '../config'
import type { RiveTile } from '../lib/animations'

type Props = {
  tile: RiveTile
  /** True while the lightbox is open — freezes every tile behind it. */
  frozen: boolean
  /** Show this animation's own frame rate next to its name. */
  showFps: boolean
  onOpen: (tile: RiveTile) => void
}

export function GalleryCard({ tile, frozen, showFps, onOpen }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const fps = useFpsReadout()

  // Two independent questions, two different margins:
  //   `near`     — close enough to be worth downloading and instantiating.
  //                Latched, so a tile is built once and never torn down.
  //   `onScreen` — actually visible, so its render loop should be running.
  const near = useInView(stageRef, { rootMargin: PRELOAD_MARGIN, once: true })
  const onScreen = useInView(stageRef)

  const { bytes, error } = useRiveBytes(tile.url, tile.cacheKey, near)

  return (
    <article className="card">
      {/* The artboard's real shape, known before anything loads because the
          file was measured when the gallery was built. */}
      <div
        className="card__stage"
        ref={stageRef}
        style={{ aspectRatio: tile.aspectRatio }}
      >
        {error ? (
          <div className="stage stage--failed">
            <span>{error}</span>
          </div>
        ) : bytes ? (
          <RiveStage
            buffer={bytes}
            artboard={tile.artboard}
            animation={tile.animation}
            stateMachine={tile.stateMachine}
            active={onScreen && !frozen}
            onFps={showFps ? fps.onFps : undefined}
          />
        ) : (
          near && <div className="stage stage--skeleton" aria-hidden="true" />
        )}
      </div>

      <div className="card__bar">
        <span className="card__title" title={tile.fileName}>
          {tile.title}
        </span>

        {showFps && (
          <span className="card__fps" ref={fps.ref}>
            — fps
          </span>
        )}

        <svg className="card__expand" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Overlay hit target: keeps the button free of nested block content
          while still giving the whole tile keyboard focus and a click area. */}
      <button className="card__hit" type="button" onClick={() => onOpen(tile)}>
        <span className="sr-only">Open {tile.title}</span>
      </button>
    </article>
  )
}
