import { useCallback, useState } from 'react'
import Play from 'reicon-react/icons/Play'
import { MakhrajDiagram } from '../components/MakhrajDiagram'
import { letters } from '../lib/letters'
import '../styles-makhraj.css'

/**
 * Shows the mouth diagram for one letter, and plays it.
 *
 * Deliberately just the animation and a play button — the lesson chrome
 * (streak, XP, trace) belongs to the app the mobile team is building, not to a
 * page whose job is showing a client what the animations do.
 */
export default function MakhrajPage() {
  const [index, setIndex] = useState(0)
  const [playToken, setPlayToken] = useState(0)
  const [animated, setAnimated] = useState(true)
  const [available, setAvailable] = useState<number[]>([])
  const [withAudio, setWithAudio] = useState<number[]>([])

  const handleAvailability = useCallback((isAnimated: boolean) => setAnimated(isAnimated), [])
  const handleLetters = useCallback((indices: number[]) => setAvailable(indices), [])
  const handleAudioLetters = useCallback((indices: number[]) => setWithAudio(indices), [])

  const play = useCallback(() => setPlayToken((token) => token + 1), [])

  /** Selecting a letter plays it, so one tap does the obvious thing. */
  const selectLetter = useCallback((position: number) => {
    setIndex(position - 1)
    setPlayToken((token) => token + 1)
  }, [])

  const letter = letters[index]
  const hasAudio = withAudio.includes(letter.index)

  return (
    <main className="mk">
      <h1 className="mk-title">Makhraj</h1>

      <div className="mk-stage">
        <MakhrajDiagram
          letterIndex={letter.index}
          playToken={playToken}
          onAvailability={handleAvailability}
          onLetters={handleLetters}
          onAudioLetters={handleAudioLetters}
        />
        {!animated && <p className="mk-note">No animation for this letter yet</p>}
      </div>

      <div className="mk-bar">
        <span className="mk-letter">
          <span className="mk-letter__arabic" lang="ar">
            {letter.arabic}
          </span>
          {letter.name}
        </span>

        <button
          className="mk-play"
          type="button"
          onClick={play}
          disabled={!animated}
          title={hasAudio ? `Play ${letter.name}` : `Play ${letter.name} (no sound file yet)`}
          aria-label={`Play ${letter.name}`}
        >
          <Play size={22} weight="Filled" aria-hidden="true" />
        </button>
      </div>

      {available.length > 1 && (
        <div className="mk-picks">
          {available.map((position) => {
            const option = letters[position - 1]
            if (!option) return null
            return (
              <button
                key={position}
                type="button"
                className={`mk-pick${position === letter.index ? ' is-active' : ''}`}
                onClick={() => selectLetter(position)}
                aria-pressed={position === letter.index}
              >
                <span lang="ar">{option.arabic}</span>
                {option.name}
              </button>
            )
          })}
        </div>
      )}
    </main>
  )
}
