import { useEffect, useState } from 'react'

/**
 * Frame rate of the page as a whole, sampled twice a second.
 *
 * Deliberately mounted only while enabled: the meter itself needs a
 * requestAnimationFrame loop, and an idle gallery should have none running.
 */
export function FpsMeter() {
  const [fps, setFps] = useState(0)

  useEffect(() => {
    let frame = 0
    let frames = 0
    let since = performance.now()

    const tick = (now: number) => {
      frames += 1
      const elapsed = now - since
      if (elapsed >= 500) {
        setFps(Math.round((frames * 1000) / elapsed))
        frames = 0
        since = now
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <span className="fps" data-low={fps > 0 && fps < 50 ? '' : undefined}>
      {fps || '--'} fps
    </span>
  )
}
