import { useCallback, useState } from 'react'
import Play from 'reicon-react/icons/Play'
import { MakhrajDiagram } from './MakhrajDiagram'
import { letters } from '../lib/letters'
import '../styles-makhraj.css'

/**
 * The mouth diagram plus its controls: one animation at a time, a play button,
 * and a letter to switch between.
 *
 * Shared by the /makhraj page and the gallery's letter collection. The letters
 * are one file rather than one per letter, so showing them as separate tiles
 * would be five copies of the same diagram — a player is the honest shape.
 */
export function MakhrajPlayer() {
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
    <div className="mk-player">
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
    </div>
  )
}
