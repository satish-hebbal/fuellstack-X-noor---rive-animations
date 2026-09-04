import { useCallback, useState } from 'react'
import ArrowLeft from 'reicon-react/icons/ArrowLeft'
import Fire from 'reicon-react/icons/Fire'
import Play from 'reicon-react/icons/Play'
import { MakhrajDiagram } from '../components/MakhrajDiagram'
import { letters, letterCount } from '../lib/letters'
import '../styles-makhraj.css'

/**
 * The letter-articulation lesson screen.
 *
 * Streak, XP and the two buttons are presentational for now — there's no
 * progress model behind them yet. The part that's real is the letter state:
 * it drives the chip and the Rive diagram, so the animation already changes
 * with the letter rather than being a fixed loop.
 */
export default function MakhrajPage() {
  // Starts on Alif because that's a letter the .riv actually animates; the
  // design's letter 7 has no timeline yet.
  const [index, setIndex] = useState(0)
  const [playToken, setPlayToken] = useState(0)
  const [animated, setAnimated] = useState(true)
  const [available, setAvailable] = useState<number[]>([])

  const handleAvailability = useCallback((isAnimated: boolean) => setAnimated(isAnimated), [])
  const handleLetters = useCallback((indices: number[]) => setAvailable(indices), [])

  /** Jump to a letter and play it in one gesture. */
  const playLetter = useCallback((letterIndex: number) => {
    setIndex(letterIndex - 1)
    setPlayToken((token) => token + 1)
  }, [])

  const letter = letters[index]

  return (
    <>
      <div className="mk">
        <div className="mk-top">
          <button className="mk-back" type="button" aria-label="Back">
            <ArrowLeft size={22} aria-hidden="true" />
          </button>

          <span className="mk-streak">
            <Fire size={22} weight="Filled" aria-hidden="true" />3
          </span>

          <div className="mk-xp">
            <div className="mk-xp__track">
              <div className="mk-xp__fill" style={{ width: '50%' }} />
            </div>
            <span className="mk-xp__value">50/100</span>
            <span className="mk-xp__badge">XP</span>
          </div>
        </div>

        <div className="mk-card">
          <p className="mk-card__step">
            Letter {letter.index} of {letterCount}
          </p>

          <div className="mk-stage">
            <MakhrajDiagram
              letterIndex={letter.index}
              playToken={playToken}
              onAvailability={handleAvailability}
              onLetters={handleLetters}
            />
            {!animated && <p className="mk-stage__todo">No timeline for this letter yet</p>}
            <span className="mk-chip" lang="ar">
              {letter.arabic}
            </span>
          </div>

          <div className="mk-card__meta">
            <span className="mk-card__name">{letter.name}</span>
            <button className="mk-card__back" type="button">
              Back to letter
            </button>
          </div>

          <div className="mk-card__notch" aria-hidden="true" />
          <button
            className="mk-play"
            type="button"
            onClick={() => setPlayToken((token) => token + 1)}
            disabled={!animated}
            aria-label={`Play the ${letter.name} sound`}
          >
            <Play size={24} weight="Filled" aria-hidden="true" />
          </button>
        </div>

        <button className="mk-cta" type="button">
          Trace it
        </button>
      </div>

      {/* Outside the phone frame on purpose: a scratch panel for driving the
          diagram while the real lesson flow doesn't exist. One button per
          letter the .riv animates, built from the file's own timelines, so it
          grows by itself as more are exported. */}
      {available.length > 0 && (
        <aside className="mk-devtools">
          <p className="mk-devtools__title">Play letter</p>
          <div className="mk-picks">
            {available.map((position) => {
              const option = letters[position - 1]
              if (!option) return null
              return (
                <button
                  key={position}
                  type="button"
                  className={`mk-pick${position === letter.index ? ' is-active' : ''}`}
                  onClick={() => playLetter(position)}
                  aria-pressed={position === letter.index}
                >
                  <span className="mk-pick__arabic" lang="ar">
                    {option.arabic}
                  </span>
                  {option.name}
                </button>
              )
            })}
          </div>
        </aside>
      )}
    </>
  )
}
