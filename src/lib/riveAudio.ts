/**
 * Plays a .riv's embedded audio ourselves.
 *
 * Rive only reports Events from state machines — `advanceAndReportChanges`
 * gathers them from `activeStateMachines` and nothing else. Linear animations
 * advance and apply but report nothing, so an Audio Event on a timeline never
 * fires at runtime, however well it previews in the editor.
 *
 * The makhraj file is one timeline per letter with no state machine inputs, so
 * there's no way to reach those events without rebuilding it as 29 states and
 * transitions. Instead we pull the audio assets straight out of the file and
 * play them through WebAudio, matched to letters by the same leading number the
 * timelines use: `01-alif` → 1, `02- ba` → 2.
 *
 * This also sidesteps Rive's audio unlocking, since we own the context.
 */
const LEADING_NUMBER = /^\s*(\d+)/

export type AudioLibrary = {
  /** Raw asset bytes, keyed by letter position. */
  add: (name: string, bytes: Uint8Array) => void
  /** Which letters have a sound. */
  letters: () => number[]
  /** Play one, replacing whatever is already sounding. */
  play: (letterIndex: number) => Promise<void>
  stop: () => void
}

export function createAudioLibrary(): AudioLibrary {
  const raw = new Map<number, Uint8Array>()
  const decoded = new Map<number, AudioBuffer>()
  let context: AudioContext | null = null
  let current: AudioBufferSourceNode | null = null

  const getContext = () => {
    context ??= new AudioContext()
    return context
  }

  return {
    add(name, bytes) {
      const match = LEADING_NUMBER.exec(name)
      if (!match) return
      const index = Number(match[1])
      if (!raw.has(index)) raw.set(index, bytes)
    },

    letters: () => [...raw.keys()].sort((a, b) => a - b),

    stop() {
      try {
        current?.stop()
      } catch {
        // Already finished; nothing to stop.
      }
      current = null
    },

    async play(letterIndex) {
      const bytes = raw.get(letterIndex)
      if (!bytes) return

      const ctx = getContext()
      // Safe to call repeatedly; only succeeds inside a user gesture, which is
      // where this is called from.
      if (ctx.state === 'suspended') await ctx.resume()

      let buffer = decoded.get(letterIndex)
      if (!buffer) {
        // decodeAudioData detaches whatever it's given, so hand it a copy and
        // keep the original for any later re-decode.
        buffer = await ctx.decodeAudioData(bytes.slice().buffer as ArrayBuffer)
        decoded.set(letterIndex, buffer)
      }

      this.stop()
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start()
      current = source
    },
  }
}
