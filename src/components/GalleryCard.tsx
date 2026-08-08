import { useCallback, useRef, useState } from 'react'
import { RiveStage, type StageInfo } from './RiveStage'
import { useInView } from '../lib/useInView'
import { useFpsReadout } from '../lib/useFpsReadout'
import { useRiveBytes } from '../lib/useRiveBytes'
import { getAspectRatio, rememberAspectRatio } from '../lib/aspectCache'
import { cacheKeyOf, type RiveAnimation } from '../lib/animations'
import {
  DEFAULT_TILE_ASPECT_RATIO,
  PRELOAD_MARGIN,
  TILE_ASPECT_CLAMP,
} from '../config'

type Props = {
  animation: RiveAnimation
  /** True while the lightbox is open — freezes every tile behind it. */
  frozen: boolean
  /** Show this animation's own frame rate next to its name. */
  showFps: boolean
  onOpen: (animation: RiveAnimation) => void
}

const [MIN_RATIO, MAX_RATIO] = TILE_ASPECT_CLAMP

export function GalleryCard({ animation, frozen, showFps, onOpen }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const fps = useFpsReadout()
  const key = cacheKeyOf(animation)

  // Two independent questions, two different margins:
  //   `near`     — close enough to be worth downloading and instantiating.
  //                Latched, so a tile is built once and never torn down.
  //   `onScreen` — actually visible, so its render loop should be running.
  const near = useInView(stageRef, { rootMargin: PRELOAD_MARGIN, once: true })
  const onScreen = useInView(stageRef)

  const { bytes, error } = useRiveBytes(animation, near)

  // The tile's shape drives the masonry packing. Seed it from the cache so a
  // returning visitor gets the right height before anything loads.
  const [ratio, setRatio] = useState(
    () => getAspectRatio(key) ?? DEFAULT_TILE_ASPECT_RATIO,
  )

  const handleReady = useCallback(
    ({ aspectRatio }: StageInfo) => {
      const clamped = Math.min(Math.max(aspectRatio, MIN_RATIO), MAX_RATIO)
      setRatio(clamped)
      rememberAspectRatio(key, clamped)
    },
    [key],
  )

  return (
    <article className="card">
      <div className="card__stage" ref={stageRef} style={{ aspectRatio: ratio }}>
        {error ? (
          <div className="stage stage--failed">
            <span>{error}</span>
          </div>
        ) : bytes ? (
          <RiveStage
            buffer={bytes}
            active={onScreen && !frozen}
            onReady={handleReady}
            onFps={showFps ? fps.onFps : undefined}
          />
        ) : (
          near && <div className="stage stage--skeleton" aria-hidden="true" />
        )}
      </div>

      <div className="card__bar">
        <span className="card__title" title={animation.fileName}>
          {animation.title}
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
      <button className="card__hit" type="button" onClick={() => onOpen(animation)}>
        <span className="sr-only">Open {animation.title}</span>
      </button>
    </article>
  )
}
