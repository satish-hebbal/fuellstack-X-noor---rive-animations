import { useCallback, useEffect, useRef, useState } from 'react'
// Per-icon subpaths, not the package barrel — see the note in Lightbox.tsx.
import Refresh from 'reicon-react/icons/Refresh'
import Gauge from 'reicon-react/icons/Gauge'
import Sun from 'reicon-react/icons/Sun'
import Moon from 'reicon-react/icons/Moon'
import Play from 'reicon-react/icons/Play'
import Files from 'reicon-react/icons/Files'
import More from 'reicon-react/icons/More'
import Folder from 'reicon-react/icons/Folder'
import { GalleryCard } from '../components/GalleryCard'
import { Lightbox } from '../components/Lightbox'
import { MakhrajPlayer } from '../components/MakhrajPlayer'
import { FpsMeter } from '../components/FpsMeter'
import { animationSource, useAnimations } from '../lib/useAnimations'
import type { RiveTile } from '../lib/animations'

type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  // A saved choice always wins. Otherwise light, regardless of the OS setting:
  // the animations sit on a white plate, so light chrome is the closer match.
  const saved = localStorage.getItem('rive-showcase:theme')
  if (saved === 'light' || saved === 'dark') return saved
  return 'light'
}

export default function GalleryPage() {
  const [selected, setSelected] = useState<RiveTile | null>(null)
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [showFps, setShowFps] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)

  const gallery = useAnimations()

  // Which folder is open, or null for the folder list. Kept in state rather
  // than the URL: it's one level deep and nothing needs to link into it.
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  const collections = gallery.status === 'ready' ? gallery.collections : []
  const open = collections.find((collection) => collection.slug === openSlug) ?? null
  const totalTiles = collections.reduce((sum, c) => sum + c.count, 0)
  const totalFiles = collections.reduce((sum, c) => sum + c.fileCount, 0)

  const shownTiles = open ? open.count : totalTiles
  const shownFiles = open ? open.fileCount : totalFiles

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('rive-showcase:theme', theme)
  }, [theme])

  // Dismiss the narrow-screen menu on an outside tap or Escape. Actions inside
  // it deliberately leave it open, so you can flip the theme and see the result
  // without reopening.
  useEffect(() => {
    if (!menuOpen) return

    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const close = useCallback(() => setSelected(null), [])

  return (
    <>
      <header className="topbar" ref={headerRef}>
        <div className="topbar__brand">
          {/* A breadcrumb rather than a back button: the title stays put
              whether or not a folder is open, so nothing shifts on the way in
              and out. Inside one, the title is the way back. */}
          <h1>
            {open ? (
              <button
                className="topbar__up"
                type="button"
                onClick={() => setOpenSlug(null)}
                title="All collections"
              >
                NOOR Animation Assets
              </button>
            ) : (
              'NOOR Animation Assets'
            )}
          </h1>

          {open && <span className="topbar__crumb">{open.title}</span>}
        </div>

        {/* Narrow screens only: collapses everything below into a panel so the
            name gets the full width instead of being truncated. */}
        <button
          className="btn btn--ghost btn--icon topbar__more"
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          title="Menu"
          aria-label="Menu"
        >
          <More size={17} aria-hidden="true" />
        </button>

        <div className={`topbar__tools${menuOpen ? ' is-open' : ''}`}>
          {gallery.status === 'ready' && (
            <span className="topbar__count">
              <span className="topbar__stat">
                <Play size={13} aria-hidden="true" />
                {shownTiles} {shownTiles === 1 ? 'animation' : 'animations'}
              </span>
              {/* Only worth saying when the counts differ — ten tiles out of
                  two files is interesting, one out of one is noise. */}
              {shownFiles !== shownTiles && (
                <span className="topbar__stat">
                  <Files size={13} aria-hidden="true" />
                  {shownFiles} {shownFiles === 1 ? 'file' : 'files'}
                </span>
              )}
            </span>
          )}
          {gallery.status === 'loading' && <span className="topbar__count">Loading…</span>}

          <div className="topbar__actions">
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
          (collections.length === 0 ? (
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
          ) : open ? (
            <>
              {open.kind === 'player' ? (
                <MakhrajPlayer />
              ) : (
                <div className="grid">
                  {open.tiles.map((tile) => (
                    <GalleryCard
                      key={tile.id}
                      tile={tile}
                      frozen={selected !== null}
                      showFps={showFps}
                      onOpen={setSelected}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="folders">
              {collections.map((collection) => (
                <button
                  key={collection.slug}
                  type="button"
                  className="folder"
                  onClick={() => setOpenSlug(collection.slug)}
                >
                  <Folder size={26} aria-hidden="true" />
                  <span className="folder__name">{collection.title}</span>
                  <span className="folder__count">
                    {collection.count} {collection.count === 1 ? 'animation' : 'animations'}
                    {collection.fileCount !== collection.count &&
                      ` · ${collection.fileCount} ${
                        collection.fileCount === 1 ? 'file' : 'files'
                      }`}
                  </span>
                </button>
              ))}
            </div>
          ))}
      </main>

      {selected && <Lightbox tile={selected} showFps={showFps} onClose={close} />}
    </>
  )
}
