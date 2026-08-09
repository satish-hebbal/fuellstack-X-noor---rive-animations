import { useEffect, useRef, useState } from 'react'
// Imported by per-icon subpath rather than from 'reicon-react' directly: the
// package's root barrel re-exports 2,674 modules, and while the bundler would
// tree-shake them, the dev server still has to crawl every one.
import Restart from 'reicon-react/icons/Restart'
import X from 'reicon-react/icons/X'
import { RiveStage } from './RiveStage'
import { useFpsReadout } from '../lib/useFpsReadout'
import { useRiveBytes } from '../lib/useRiveBytes'
import type { RiveTile } from '../lib/animations'

type Props = {
  tile: RiveTile
  /** Show this animation's own frame rate next to its filename. */
  showFps: boolean
  onClose: () => void
}

export function Lightbox({ tile, showFps, onClose }: Props) {
  const [replayToken, setReplayToken] = useState(0)
  const closeRef = useRef<HTMLButtonElement>(null)
  const fps = useFpsReadout()

  // Normally an instant cache hit: the tile behind the overlay already
  // downloaded this file.
  const { bytes, error } = useRiveBytes(tile.url, tile.cacheKey, true)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Lock the page behind the overlay. The padding compensates for the removed
  // scrollbar so the grid underneath doesn't shift by a few pixels.
  useEffect(() => {
    const { body } = document
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    const overflow = body.style.overflow
    const paddingRight = body.style.paddingRight

    body.style.overflow = 'hidden'
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`

    return () => {
      body.style.overflow = overflow
      body.style.paddingRight = paddingRight
    }
  }, [])

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={tile.title}
      onClick={onClose}
    >
      {/* stopPropagation so clicks inside the panel don't dismiss it. */}
      <div className="lightbox__panel" onClick={(event) => event.stopPropagation()}>
        <header className="lightbox__header">
          <div className="lightbox__meta">
            <h2 className="lightbox__title">{tile.title}</h2>
            <p className="lightbox__file">
              {tile.fileName}
              {showFps && (
                <>
                  {' · '}
                  <span ref={fps.ref}>— fps</span>
                </>
              )}
            </p>
          </div>

          <div className="lightbox__actions">
            <button
              className="btn btn--icon"
              type="button"
              onClick={() => setReplayToken((token) => token + 1)}
              title="Replay"
              aria-label="Replay this animation"
            >
              <Restart size={18} aria-hidden="true" />
            </button>
            <button
              className="btn btn--icon"
              type="button"
              ref={closeRef}
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Width is the smallest of: the viewport, a sane max, and whatever
            keeps the artboard's own aspect ratio within 76vh of height. */}
        <div
          className="lightbox__stage"
          style={{
            aspectRatio: tile.aspectRatio,
            width: `min(92vw, 1200px, ${(76 * tile.aspectRatio).toFixed(3)}vh)`,
          }}
        >
          {error ? (
            <div className="stage stage--failed">
              <span>{error}</span>
            </div>
          ) : bytes ? (
            <RiveStage
              key={tile.id}
              buffer={bytes}
              artboard={tile.artboard}
              animation={tile.animation}
              stateMachine={tile.stateMachine}
              active
              interactive
              replayToken={replayToken}
              onFps={showFps ? fps.onFps : undefined}
            />
          ) : (
            <div className="stage stage--skeleton" aria-hidden="true" />
          )}
        </div>
      </div>
    </div>
  )
}
