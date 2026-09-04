import { useEffect, useMemo, useRef, useState } from 'react'
import { Alignment, Fit, Layout, useRive } from '@rive-app/react-webgl2'
import { MAKHRAJ_ANIMATION_INDEX, MAX_DEVICE_PIXEL_RATIO } from '../config'
import { createAudioLibrary } from '../lib/riveAudio'

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
const found = import.meta.glob('../assets/makhraj.riv', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const src: string | undefined = Object.values(found)[0]

type Props = {
  /** 1-based letter position. */
  letterIndex: number
  /** Bump to replay the current letter. */
  playToken: number
  /** Told whether this letter has a timeline, so the page can say so. */
  onAvailability?: (available: boolean) => void
  /** The letter positions the file actually animates, ascending. */
  onLetters?: (indices: number[]) => void
}

export function MakhrajDiagram({ letterIndex, playToken, onAvailability, onLetters }: Props) {
  const [byLetter, setByLetter] = useState<Record<number, string>>({})

  // Sound is played by us, not by Rive — see lib/riveAudio.ts for why.
  const audio = useRef(createAudioLibrary())

  const layout = useMemo(
    () => new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    [],
  )
  const devicePixelRatio = useMemo(
    () => Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO),
    [],
  )

  const { rive, RiveComponent } = useRive(
    src
      ? {
          src,
          layout,
          autoplay: false,
          autoBind: true,
          // Observe the embedded assets on the way past so their bytes can be
          // played directly. Returning false leaves Rive's own handling alone.
          assetLoader: (asset, bytes) => {
            if (asset.isAudio && bytes?.length) audio.current.add(asset.name, bytes)
            return false
          },
        }
      : null,
    { useOffscreenRenderer: true, customDevicePixelRatio: devicePixelRatio },
  )

  // Read the file's timelines once and index them by their leading number.
  // Handy when debugging audio or playback from the console.
  useEffect(() => {
    if (rive && import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__rive = rive
    }
  }, [rive])

  useEffect(() => {
    if (!rive) return
    const map: Record<number, string> = {}
    for (const name of rive.animationNames) {
      const match = MAKHRAJ_ANIMATION_INDEX.exec(name)
      if (!match) continue
      const index = Number(match[1])
      // First one wins, so a stray duplicate can't shadow the real timeline.
      if (!(index in map)) map[index] = name
    }
    setByLetter(map)
    onLetters?.(
      Object.keys(map)
        .map(Number)
        .sort((a, b) => a - b),
    )
  }, [rive, onLetters])

  const animation = byLetter[letterIndex]

  useEffect(() => {
    onAvailability?.(Boolean(animation))
  }, [animation, onAvailability])

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
        <code>src/assets/makhraj.riv</code>
      </div>
    )
  }

  return <RiveComponent className="mk-stage__surface" />
}
