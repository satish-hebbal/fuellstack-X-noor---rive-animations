import { useEffect, useMemo, useRef, useState } from 'react'
import { Alignment, Fit, Layout, useRive } from '@rive-app/react-webgl2'
import { MAX_DEVICE_PIXEL_RATIO } from '../config'
import { makhrajFile } from '../lib/bundledFiles'
import { byLetterIndex, letterIndices } from '../lib/letters'
import { createLetterSounds } from '../lib/riveAudio'
import type { LetterStageProps } from './LetterPlayer'

/**
 * The vocal-tract diagram.
 *
 * Unlike the gallery's RiveStage this is a single, always-visible animation, so
 * it skips the viewport gating and drives playback directly.
 *
 * Letters map to timelines by the number in front of the timeline's name —
 * `1. alif`, `2. baa`. The file's state machine carries no inputs, so there is
 * nothing to set; we just play the right timeline. Adding letters means
 * exporting more timelines named the same way, with no code change here.
 *
 * The .riv is optional at build time: glob returns an empty object when the
 * file isn't there, and the placeholder takes over.
 */
const src = makhrajFile?.src

export function MakhrajDiagram({
  letterIndex,
  playToken,
  onAvailability,
  onLetters,
  onAudioLetters,
}: LetterStageProps) {
  const [byLetter, setByLetter] = useState<Record<number, string>>({})

  // Sound is played by us, not by Rive — see lib/riveAudio.ts for why.
  const audio = useRef(createLetterSounds())

  const layout = useMemo(
    () => new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    [],
  )
  const devicePixelRatio = useMemo(
    () => Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO),
    [],
  )

  const { rive, RiveComponent } = useRive(
    src ? { src, layout, autoplay: false, autoBind: true } : null,
    { useOffscreenRenderer: true, customDevicePixelRatio: devicePixelRatio },
  )

  // Read the file's timelines once and index them by their leading number.
  useEffect(() => {
    if (!rive) return
    setByLetter(byLetterIndex(rive.animationNames))
    onLetters?.(letterIndices(rive.animationNames))
  }, [rive, onLetters])

  // Sound files are known from the glob, so this doesn't wait on Rive at all.
  useEffect(() => {
    onAudioLetters?.(audio.current.letters())
  }, [onAudioLetters])

  const animation = byLetter[letterIndex]

  // Only once the file is parsed. Reporting before then would announce "no
  // animation for this letter" during the load, when we simply don't know yet.
  useEffect(() => {
    if (!rive) return
    onAvailability?.(Boolean(animation))
  }, [rive, animation, onAvailability])

  // Nothing should keep sounding after this leaves the screen.
  useEffect(() => {
    const library = audio.current
    return () => library.stop()
  }, [])

  // One effect covers both cases: changing letter and pressing play. Both
  // should start the timeline from the beginning, so both belong here.
  useEffect(() => {
    if (!rive) return

    if (!animation) {
      // Nothing authored for this letter yet — return to the resting pose
      // rather than leaving the previous letter's last frame on screen.
      rive.reset({ autoplay: false })
      return
    }

    rive.stop()
    rive.play(animation)
    rive.startRendering()

    // Only after a real interaction: an AudioContext can't start before one,
    // and a queued sound would otherwise fire late and unprompted.
    if (playToken > 0) void audio.current.play(letterIndex)
  }, [rive, animation, playToken, letterIndex])

  if (!src) {
    return (
      <div className="mk-stage__placeholder">
        <p>Mouth diagram</p>
        <code>src/assets/makhraj/*.riv</code>
      </div>
    )
  }

  return <RiveComponent className="mk-stage__surface" />
}
