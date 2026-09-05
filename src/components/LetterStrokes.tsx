import { useEffect, useMemo, useRef, useState } from 'react'
import { Alignment, Fit, Layout, useRive } from '@rive-app/react-webgl2'
import { MAX_DEVICE_PIXEL_RATIO, PREFER_STATE_MACHINE } from '../config'
import { letterFile } from '../lib/bundledFiles'
import { ARTBOARD_LETTER } from '../lib/letters'
import { createLetterSounds } from '../lib/riveAudio'
import type { LetterStageProps } from './LetterPlayer'

/**
 * The letter being written, stroke by stroke.
 *
 * Where the mouth diagram is one artboard holding a timeline per letter, this
 * file is the other shape: one *artboard* per letter, each with its own short
 * timeline. The artboard's name carries the letter's position — `1`, `2`, `3`
 * — and that number is the whole mapping, so adding letters means exporting
 * more numbered artboards with no code change here.
 *
 * Switching letters therefore means switching artboards, which `useRive` can't
 * do through its props: the hook instantiates once and ignores later parameter
 * changes. `rive.reset({ artboard })` re-instantiates on the same canvas, which
 * is both the supported way and much cheaper than remounting the component.
 */
const src = letterFile?.src

/** One letter's artboard, and the single thing to run on it. */
type Playable = {
  artboard: string
  /** Exactly one of these is set. */
  stateMachine?: string
  animation?: string
}

export function LetterStrokes({
  letterIndex,
  playToken,
  onAvailability,
  onLetters,
  onAudioLetters,
}: LetterStageProps) {
  // artboard name and what to play on it, per letter.
  const [byLetter, setByLetter] = useState<Record<number, Playable>>({})

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

  // Read the file's artboards once and index them by their leading number.
  useEffect(() => {
    if (!rive) return

    const map: Record<number, Playable> = {}
    for (const artboard of rive.contents?.artboards ?? []) {
      // Only artboards named for their letter and nothing else — see
      // ARTBOARD_LETTER for why the editor's `2 5`-style copies are excluded.
      const match = ARTBOARD_LETTER.exec(artboard.name)
      if (!match) continue
      const index = Number(match[1])
      // First one wins, so a stray duplicate can't shadow the real artboard.
      if (index in map) continue

      // Same preference as the gallery: a file with a state machine is
      // authored around it, and its timelines are the parts it drives.
      const stateMachine = PREFER_STATE_MACHINE ? artboard.stateMachines?.[0] : undefined
      map[index] = {
        artboard: artboard.name,
        stateMachine: stateMachine?.name,
        animation: stateMachine ? undefined : artboard.animations?.[0],
      }
    }

    setByLetter(map)
    onLetters?.(
      Object.keys(map)
        .map(Number)
        .sort((a, b) => a - b),
    )
  }, [rive, onLetters])

  // Sound files are known from the glob, so this doesn't wait on Rive at all.
  useEffect(() => {
    onAudioLetters?.(audio.current.letters())
  }, [onAudioLetters])

  const playable = byLetter[letterIndex]

  // Only once the file is parsed. Reporting before then would announce "no
  // animation for this letter" during the load, when we simply don't know yet.
  useEffect(() => {
    if (!rive) return
    onAvailability?.(Boolean(playable))
  }, [rive, playable, onAvailability])

  // Nothing should keep sounding after this leaves the screen.
  useEffect(() => {
    const library = audio.current
    return () => library.stop()
  }, [])

  // One effect covers both cases: changing letter and pressing play. Both
  // should start the stroke from the beginning, so both belong here.
  useEffect(() => {
    if (!rive) return

    if (!playable) {
      // Nothing authored for this letter yet — show the file's own default
      // artboard rather than leaving the previous letter's last frame up.
      rive.reset({ autoplay: false })
      return
    }

    rive.reset({
      artboard: playable.artboard,
      stateMachines: playable.stateMachine,
      animations: playable.animation,
      autoplay: true,
      autoBind: true,
    })
    rive.startRendering()

    // Only after a real interaction: an AudioContext can't start before one,
    // and a queued sound would otherwise fire late and unprompted.
    if (playToken > 0) void audio.current.play(letterIndex)
  }, [rive, playable, playToken, letterIndex])

  if (!src) {
    return (
      <div className="mk-stage__placeholder">
        <p>Letter animation</p>
        <code>src/assets/letters/*.riv</code>
      </div>
    )
  }

  return <RiveComponent className="mk-stage__surface" />
}
