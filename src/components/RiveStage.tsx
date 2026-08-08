import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Alignment, EventType, Fit, Layout, useRive } from '@rive-app/react-webgl2'
import {
  AUTO_BIND_VIEW_MODELS,
  MAX_DEVICE_PIXEL_RATIO,
  PREFER_STATE_MACHINE,
} from '../config'

export type StageInfo = {
  /** Artboard width / height, so the lightbox can size itself to the artwork. */
  aspectRatio: number
}

type Props = {
  /**
   * The .riv file's bytes. We pass a buffer rather than a URL so downloads go
   * through our own cache — see `lib/fileCache.ts` for why that matters when
   * the files are served from Drive.
   */
  buffer: ArrayBuffer
  /**
   * Whether the render loop should run. `false` stops drawing entirely — the
   * animation keeps its state but costs zero CPU and zero GPU until it's `true`
   * again. This is the single most important lever for a big gallery.
   */
  active: boolean
  /**
   * Tiles are inert so a click always opens the lightbox, even on files that
   * ship their own Rive Listeners. The lightbox itself is interactive.
   */
  interactive?: boolean
  /** Bump this number to restart playback from the beginning. */
  replayToken?: number
  onReady?: (info: StageInfo) => void
  /**
   * Called twice a second with this animation's own frame rate. Pass
   * `undefined` to skip the measurement entirely — nothing is subscribed and
   * no timer runs unless someone is listening.
   *
   * Must be referentially stable (wrap it in `useCallback`).
   */
  onFps?: (fps: number) => void
}

export function RiveStage({
  buffer,
  active,
  interactive = false,
  replayToken = 0,
  onReady,
  onFps,
}: Props) {
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  // Both must be stable: a fresh object each render would churn the runtime.
  const layout = useMemo(
    () => new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    [],
  )
  const devicePixelRatio = useMemo(
    () => Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO),
    [],
  )

  // Held in a ref so the effect below doesn't re-run when the parent hands us a
  // new callback identity. Layout effects commit before the effect that reads it.
  const onReadyRef = useRef(onReady)
  useLayoutEffect(() => {
    onReadyRef.current = onReady
  })

  const { rive, RiveComponent } = useRive(
    {
      buffer,
      layout,
      // Start paused: we can only inspect the file's artboard once it's loaded,
      // and we want to choose *what* to play before anything moves.
      autoplay: false,
      autoBind: AUTO_BIND_VIEW_MODELS,
      shouldDisableRiveListeners: !interactive,
      onLoadError: () => setFailed(true),
    },
    {
      // We drive visibility ourselves via useInView, which gives us a preload
      // margin and lets the lightbox freeze the whole grid in one go.
      shouldUseIntersectionObserver: false,
      // Every canvas on the page shares one WebGL context instead of burning
      // one each — browsers hard-cap concurrent contexts at around 16.
      useOffscreenRenderer: true,
      customDevicePixelRatio: devicePixelRatio,
    },
  )

  /** The state machine we chose to drive, if the file has one. */
  const target = useRef<string | undefined>(undefined)

  // `rive` becomes non-null only once the file is loaded and its artboard is
  // readable, so this is where we decide what to play.
  useEffect(() => {
    if (!rive) return

    const stateMachine = PREFER_STATE_MACHINE ? rive.stateMachineNames[0] : undefined
    target.current = stateMachine

    if (stateMachine) {
      // Drop the linear animation the runtime instanced by default, otherwise
      // it and the state machine would both write to the same artboard.
      rive.stop()
      rive.play(stateMachine)
    } else {
      rive.play()
    }

    setReady(true)

    const { minX, minY, maxX, maxY } = rive.bounds
    const width = maxX - minX
    const height = maxY - minY
    onReadyRef.current?.({ aspectRatio: height > 0 ? width / height : 1 })
  }, [rive])

  // Replay, for one-shot animations that would otherwise sit on their last frame.
  useEffect(() => {
    if (!rive || replayToken === 0) return
    rive.reset({
      stateMachines: target.current,
      autoplay: true,
      autoBind: AUTO_BIND_VIEW_MODELS,
    })
    rive.startRendering()
  }, [rive, replayToken])

  // Per-animation frame rate.
  //
  // Rive's own `enableFPSCounter` is no use here: it delegates to the shared
  // WASM runtime, so it reports one page-wide number and a second caller
  // overwrites the first. `EventType.Advance` however fires once per frame per
  // instance, so counting it gives this tile's real rate — and reads 0 the
  // moment the tile is parked, which is exactly what we want to see.
  useEffect(() => {
    if (!rive || !onFps) return

    let frames = 0
    const count = () => {
      frames += 1
    }
    rive.on(EventType.Advance, count)

    const timer = window.setInterval(() => {
      onFps(frames * 2) // frames per 500ms window → per second
      frames = 0
    }, 500)

    return () => {
      rive.off(EventType.Advance, count)
      window.clearInterval(timer)
    }
  }, [rive, onFps])

  // Declared last so it wins: if a tile was instantiated while off screen, the
  // effects above start it and this immediately parks it again.
  useEffect(() => {
    if (!rive) return
    if (active) rive.startRendering()
    else rive.stopRendering()
  }, [rive, active])

  if (failed) {
    // The bytes arrived but Rive rejected them. Overwhelmingly that means a
    // .riv exported from an older Rive version than this runtime supports —
    // re-export it from the editor and it works.
    return (
      <div className="stage stage--failed">
        <span>
          Rive couldn&apos;t read this file.
          <br />
          Try re-exporting it.
        </span>
      </div>
    )
  }

  return (
    <div className={`stage${ready ? ' is-ready' : ''}`}>
      <RiveComponent className="stage__surface" />
      {!ready && <div className="stage__skeleton" aria-hidden="true" />}
    </div>
  )
}
