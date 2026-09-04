import { useState } from 'react'
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
 * it drives both the chip and the Rive diagram, so the animation is already
 * wired to change with the letter rather than being a fixed loop.
 */
export default function MakhrajPage() {
  const [index, setIndex] = useState(6) // خ — letter 7 of 29, as in the design
  const [playToken, setPlayToken] = useState(0)

  const letter = letters[index]

  return (
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
          <MakhrajDiagram letterIndex={letter.index} playToken={playToken} />
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
          aria-label={`Play the ${letter.name} sound`}
        >
          <Play size={24} weight="Filled" aria-hidden="true" />
        </button>
      </div>

      {/* Temporary, until the real lesson flow exists — lets the diagram be
          checked against every letter. */}
      <div className="mk-steps">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(letters.length - 1, i + 1))}
          disabled={index === letters.length - 1}
        >
          Next letter
        </button>
      </div>

      <button className="mk-cta" type="button">
        Trace it
      </button>
    </div>
  )
}
