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
 *
 * Sounds can come from two places, and a loose file always wins:
 *
 *   1. `src/assets/audio/01-alif.mp3` — just drop it in, no Rive involved.
 *   2. Assets embedded in the .riv, if Rive compiled them.
 *
 * The first exists because Rive only exports assets something references, so a
 * sound sitting unused in the editor's Assets panel never reaches the file.
 * Keeping audio as ordinary files also means changing a recording doesn't need
 * a re-export.
 */
const LEADING_NUMBER = /^\s*(\d+)/

export type AudioLibrary = {
  /** Raw asset bytes from inside the .riv, keyed by letter position. */
  add: (name: string, bytes: Uint8Array) => void
  /** A loose audio file, which takes precedence over anything embedded. */
  addUrl: (name: string, url: string) => void
  /** Which letters have a sound. */
  letters: () => number[]
  /** Play one, replacing whatever is already sounding. */
  play: (letterIndex: number) => Promise<void>
  stop: () => void
}

export function createAudioLibrary(): AudioLibrary {
  const raw = new Map<number, Uint8Array>()
  const urls = new Map<number, string>()
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

    addUrl(name, url) {
      const match = LEADING_NUMBER.exec(name)
      if (!match) return
      urls.set(Number(match[1]), url)
    },

    letters: () => [...new Set([...urls.keys(), ...raw.keys()])].sort((a, b) => a - b),

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
      const bytes = raw.get(letterIndex)
      if (!url && !bytes) return

      const ctx = getContext()
      // Safe to call repeatedly; only succeeds inside a user gesture, which is
      // where this is called from.
      if (ctx.state === 'suspended') await ctx.resume()

      let buffer = decoded.get(letterIndex)
      if (!buffer) {
        // decodeAudioData detaches whatever it's given, so hand it a copy and
        // keep the original for any later re-decode.
        const source = url
          ? await (await fetch(url)).arrayBuffer()
          : (bytes as Uint8Array).slice().buffer as ArrayBuffer
        buffer = await ctx.decodeAudioData(source)
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
