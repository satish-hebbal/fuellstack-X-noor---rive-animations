import { useEffect, useMemo } from 'react'
import {
  Alignment,
  Fit,
  Layout,
  useRive,
  useStateMachineInput,
} from '@rive-app/react-webgl2'
import {
  MAKHRAJ_LETTER_INPUT,
  MAKHRAJ_PLAY_INPUT,
  MAKHRAJ_STATE_MACHINE,
  MAX_DEVICE_PIXEL_RATIO,
} from '../config'

/**
 * The vocal-tract diagram.
 *
 * Unlike the gallery's RiveStage this is a single, always-visible animation
 * driven by inputs rather than one of many tiles, so it talks to the state
 * machine directly and skips all the viewport gating.
 *
 * The .riv is optional at build time: glob returns an empty object when the
 * file isn't there yet, and the placeholder takes over. Drop the file at
 * `src/assets/makhraj.riv` and it wires itself up.
 */
const found = import.meta.glob('../assets/makhraj.riv', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const src: string | undefined = Object.values(found)[0]

export const hasMakhrajFile = Boolean(src)

type Props = {
  /** 1-based letter position, handed to the state machine. */
  letterIndex: number
  /** Bump to re-fire the play trigger. */
  playToken: number
}

export function MakhrajDiagram({ letterIndex, playToken }: Props) {
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
          stateMachines: MAKHRAJ_STATE_MACHINE,
          autoplay: true,
          autoBind: true,
        }
      : null,
    { useOffscreenRenderer: true, customDevicePixelRatio: devicePixelRatio },
  )

  const letterInput = useStateMachineInput(rive, MAKHRAJ_STATE_MACHINE, MAKHRAJ_LETTER_INPUT)
  const playInput = useStateMachineInput(rive, MAKHRAJ_STATE_MACHINE, MAKHRAJ_PLAY_INPUT)

  // Selecting a letter moves the diagram to that articulation point.
  useEffect(() => {
    if (letterInput) letterInput.value = letterIndex
  }, [letterInput, letterIndex])

  // The play button replays the current one. Skipped on mount so the diagram
  // doesn't fire before the user asks.
  useEffect(() => {
    if (playToken === 0) return
    playInput?.fire()
  }, [playInput, playToken])

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
