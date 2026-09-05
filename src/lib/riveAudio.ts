/**
 * Plays the letter sounds.
 *
 * Audio deliberately lives outside the .riv, as ordinary files in
 * `src/assets/trimmed-audio` named `01-alif.mp3`, `05-jeem.mp3`. Two reasons:
 *
 *  1. Rive only reports Events from state machines — `advanceAndReportChanges`
 *     gathers them from `activeStateMachines` and nowhere else. This file plays
 *     one linear timeline per letter, and linear animations report nothing, so
 *     an Audio Event on a timeline never fires at runtime however well it
 *     previews in the editor. Embedding audio would mean rebuilding the file as
 *     29 states and transitions.
 *  2. Rive only compiles assets something references, so a sound sitting in the
 *     editor's Assets panel can silently miss the export — which is exactly what
 *     happened to `01-alif`.
 *
 * Keeping them as files also means the same pairing works for the React Native
 * build: play timeline N, play sound N. The leading number is the whole
 * contract.
 */
const LEADING_NUMBER = /^\s*(\d+)/

export type AudioLibrary = {
  /** Register a sound file under the letter its filename starts with. */
  add: (fileName: string, url: string) => void
  /** Which letters have a sound, ascending. */
  letters: () => number[]
  /** Play one, replacing whatever is already sounding. */
  play: (letterIndex: number) => Promise<void>
  stop: () => void
}

export function createAudioLibrary(): AudioLibrary {
  const urls = new Map<number, string>()
  const decoded = new Map<number, AudioBuffer>()
  let context: AudioContext | null = null
  let current: AudioBufferSourceNode | null = null

  const getContext = () => {
    context ??= new AudioContext()
    return context
  }

  return {
    add(fileName, url) {
      const match = LEADING_NUMBER.exec(fileName)
      if (!match) return
      urls.set(Number(match[1]), url)
    },

    letters: () => [...urls.keys()].sort((a, b) => a - b),

    stop() {
      try {
        current?.stop()
      } catch {
        // Already finished; nothing to stop.
      }
      current = null
    },

    async play(letterIndex) {
      const url = urls.get(letterIndex)
      if (!url) return

      const ctx = getContext()
      // Safe to call repeatedly, and only succeeds inside a user gesture —
      // which is where this is called from.
      if (ctx.state === 'suspended') await ctx.resume()

      let buffer = decoded.get(letterIndex)
      if (!buffer) {
        buffer = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer())
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
