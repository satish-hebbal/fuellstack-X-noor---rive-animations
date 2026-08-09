import { useCallback, useEffect, useState } from 'react'
// Per-icon subpaths, not the package barrel — see the note in Lightbox.tsx.
import Refresh from 'reicon-react/icons/Refresh'
import Gauge from 'reicon-react/icons/Gauge'
import Sun from 'reicon-react/icons/Sun'
import Moon from 'reicon-react/icons/Moon'
import Play from 'reicon-react/icons/Play'
import Files from 'reicon-react/icons/Files'
import { GalleryCard } from './components/GalleryCard'
import { Lightbox } from './components/Lightbox'
import { FpsMeter } from './components/FpsMeter'
import { animationSource, useAnimations } from './lib/useAnimations'
import type { RiveTile } from './lib/animations'

type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  // A saved choice always wins. Otherwise light, regardless of the OS setting:
  // the animations sit on a white plate, so light chrome is the closer match.
  const saved = localStorage.getItem('rive-showcase:theme')
  if (saved === 'light' || saved === 'dark') return saved
  return 'light'
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
              <span className="topbar__stat">
                <Play size={13} aria-hidden="true" />
                {gallery.tiles.length}{' '}
                {gallery.tiles.length === 1 ? 'animation' : 'animations'}
              </span>
              {/* Only worth saying when the counts differ — ten tiles out of
                  two files is interesting, one out of one is noise. */}
              {gallery.fileCount !== gallery.tiles.length && (
                <span className="topbar__stat">
                  <Files size={13} aria-hidden="true" />
                  {gallery.fileCount} {gallery.fileCount === 1 ? 'file' : 'files'}
                </span>
              )}
            </span>
          )}
          {gallery.status === 'loading' && <span className="topbar__count">Loading…</span>}
        </div>

        <div className="topbar__tools">
          {showFps && <FpsMeter />}

          {animationSource === 'drive' && (
            <button
              className="btn btn--ghost btn--icon"
              type="button"
              onClick={gallery.reload}
              disabled={gallery.status === 'loading'}
              title="Re-read the Drive folder"
              aria-label="Refresh from Google Drive"
            >
              <Refresh size={17} aria-hidden="true" />
            </button>
          )}

          <button
            className="btn btn--ghost btn--icon"
            type="button"
            onClick={() => setShowFps((on) => !on)}
            aria-pressed={showFps}
            title="Show frame rate"
            aria-label="Show frame rate"
          >
            <Gauge size={17} aria-hidden="true" />
          </button>
          <button
            className="btn btn--ghost btn--icon"
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} background`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} background`}
          >
            {/* Shows where the click takes you, not where you are. */}
            {theme === 'dark' ? (
              <Sun size={17} aria-hidden="true" />
            ) : (
              <Moon size={17} aria-hidden="true" />
            )}
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
