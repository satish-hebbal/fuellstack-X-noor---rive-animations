import { useCallback, useEffect, useState } from 'react'
import { GalleryCard } from './components/GalleryCard'
import { Lightbox } from './components/Lightbox'
import { FpsMeter } from './components/FpsMeter'
import { animationSource, useAnimations } from './lib/useAnimations'
import type { RiveTile } from './lib/animations'

type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  const saved = localStorage.getItem('rive-showcase:theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [selected, setSelected] = useState<RiveTile | null>(null)
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [showFps, setShowFps] = useState(false)

  const gallery = useAnimations()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('rive-showcase:theme', theme)
  }, [theme])

  const close = useCallback(() => setSelected(null), [])

  return (
    <>
      <header className="topbar">
        <div className="topbar__brand">
          <h1>NOOR — Mascot Animations</h1>
          {gallery.status === 'ready' && (
            <span className="topbar__count">
              {gallery.tiles.length}{' '}
              {gallery.tiles.length === 1 ? 'animation' : 'animations'}
              {/* Worth saying when ten tiles came out of two files. */}
              {gallery.fileCount !== gallery.tiles.length &&
                ` · ${gallery.fileCount} ${gallery.fileCount === 1 ? 'file' : 'files'}`}
            </span>
          )}
          {gallery.status === 'loading' && <span className="topbar__count">Loading…</span>}
        </div>

        <div className="topbar__tools">
          {showFps && <FpsMeter />}

          {animationSource === 'drive' && (
            <button
              className="btn btn--ghost"
              type="button"
              onClick={gallery.reload}
              disabled={gallery.status === 'loading'}
              title="Re-read the Drive folder"
            >
              Refresh
            </button>
          )}

          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => setShowFps((on) => !on)}
            aria-pressed={showFps}
          >
            FPS
          </button>
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} background`}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>

      <main className="page">
        {gallery.status === 'loading' && <p className="notice">Reading your animations…</p>}

        {gallery.status === 'error' && (
          <div className="notice notice--error">
            <h2>Couldn’t load the gallery</h2>
            <p>{gallery.message}</p>
            <button className="btn" type="button" onClick={gallery.reload}>
              Try again
            </button>
          </div>
        )}

        {gallery.status === 'ready' &&
          (gallery.tiles.length === 0 ? (
            <div className="notice">
              <h2>No animations yet</h2>
              <p>
                {animationSource === 'drive' ? (
                  <>
                    Drop <code>.riv</code> files into your Drive folder, then hit{' '}
                    <strong>Refresh</strong>. Every animation inside a file gets its own
                    tile.
                  </>
                ) : (
                  <>
                    Drop your <code>.riv</code> files into <code>src/rive/</code> and they
                    show up here automatically.
                  </>
                )}
              </p>
            </div>
          ) : (
            <div className="grid">
              {gallery.tiles.map((tile) => (
                <GalleryCard
                  key={tile.id}
                  tile={tile}
                  frozen={selected !== null}
                  showFps={showFps}
                  onOpen={setSelected}
                />
              ))}
            </div>
          ))}
      </main>

      {selected && <Lightbox tile={selected} showFps={showFps} onClose={close} />}
    </>
  )
}
