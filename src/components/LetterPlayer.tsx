import { useCallback, useState, type ComponentType } from 'react'
import Play from 'reicon-react/icons/Play'
import { letters } from '../lib/letters'
import '../styles-makhraj.css'

/**
 * What a stage inside the player has to accept. Two implement it —
 * `MakhrajDiagram` (mouth, a timeline per letter) and `LetterStrokes` (the
 * glyph being written, an artboard per letter) — and the shell below is
 * identical for both, so it lives here once.
 */
export type LetterStageProps = {
  /** 1-based letter position. */
  letterIndex: number
  /** Bump to replay the current letter. */
  playToken: number
  /** Told whether this letter is animated, so the page can say so. */
  onAvailability?: (available: boolean) => void
  /** The letter positions the file actually animates, ascending. */
  onLetters?: (indices: number[]) => void
  /** The letter positions that have a sound, ascending. */
  onAudioLetters?: (indices: number[]) => void
}

type Props = {
  stage: ComponentType<LetterStageProps>
  /**
   * Extra class on the white plate, for artwork that wants different framing.
   * See `--mk-crop` in styles-makhraj.css.
   */
  stageClassName?: string
}

/**
 * A letter animation plus its controls: one letter at a time, a play button,
 * and a row of the letters the file covers.
 *
 * Shared by the /makhraj page and both of the gallery's letter collections.
 * Each file holds every letter rather than one file per letter, so laying them
 * out as separate tiles would be five copies of the same stage — a player is
 * the honest shape.
 */
export function LetterPlayer({ stage: Stage, stageClassName = '' }: Props) {
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
      <div className={`mk-stage ${stageClassName}`.trim()}>
        <Stage
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
