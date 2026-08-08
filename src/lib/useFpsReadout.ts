import { useCallback, useRef } from 'react'

/**
 * A frame-rate readout that writes straight to its own DOM node.
 *
 * Routing the number through React state would re-render the card — and with it
 * the Rive canvas — twice a second, on every visible tile. A measurement tool
 * should not perturb what it measures, so the value is written directly and
 * nothing above the `<span>` re-renders.
 */
export function useFpsReadout(lowThreshold = 50) {
  const ref = useRef<HTMLSpanElement>(null)

  const onFps = useCallback(
    (fps: number) => {
      const el = ref.current
      if (!el) return
      el.textContent = `${fps} fps`
      // Anything still rendering but under the threshold is worth flagging;
      // a parked tile reads 0 and is not a problem.
      el.toggleAttribute('data-low', fps > 0 && fps < lowThreshold)
    },
    [lowThreshold],
  )

  return { ref, onFps }
}
