/**
 * The Arabic alphabet, in the order the lesson walks through it.
 *
 * 29 entries, in hijaiyah order — the sequence used for Quran teaching, which
 * ends waaw, haa, hamza, yaa rather than the haa, waaw, yaa, hamza of the
 * modern-standard ordering. It has to match the numbering on the audio files
 * and the Rive timelines, since the number is what pairs them: letter 26 shows
 * waaw because `26-waaw.mp3` does.
 *
 * Emphatic letters carry a dot below (Ḥ, Ṣ, Ḍ, Ṭ, Ẓ) — without it ح and ه
 * would both be "Haa", and ت and ط both "Taa". Edit the names here if your
 * course transliterates them differently; nothing else reads them.
 */
export type Letter = {
  /** 1-based position, and the value handed to the Rive state machine. */
  index: number
  /** The letter itself, for the chip. */
  arabic: string
  /** Transliterated name, shown under the diagram. */
  name: string
}

export const letters: Letter[] = [
  { index: 1, arabic: 'ا', name: 'Alif' },
  { index: 2, arabic: 'ب', name: 'Baa' },
  { index: 3, arabic: 'ت', name: 'Taa' },
  { index: 4, arabic: 'ث', name: 'Thaa' },
  { index: 5, arabic: 'ج', name: 'Jeem' },
  { index: 6, arabic: 'ح', name: 'Ḥaa' },
  { index: 7, arabic: 'خ', name: 'Khaa' },
  { index: 8, arabic: 'د', name: 'Daal' },
  { index: 9, arabic: 'ذ', name: 'Dhaal' },
  { index: 10, arabic: 'ر', name: 'Raa' },
  { index: 11, arabic: 'ز', name: 'Zaay' },
  { index: 12, arabic: 'س', name: 'Seen' },
  { index: 13, arabic: 'ش', name: 'Sheen' },
  { index: 14, arabic: 'ص', name: 'Ṣaad' },
  { index: 15, arabic: 'ض', name: 'Ḍaad' },
  { index: 16, arabic: 'ط', name: 'Ṭaa' },
  { index: 17, arabic: 'ظ', name: 'Ẓaa' },
  { index: 18, arabic: 'ع', name: 'Ayn' },
  { index: 19, arabic: 'غ', name: 'Ghayn' },
  { index: 20, arabic: 'ف', name: 'Faa' },
  { index: 21, arabic: 'ق', name: 'Qaaf' },
  { index: 22, arabic: 'ك', name: 'Kaaf' },
  { index: 23, arabic: 'ل', name: 'Laam' },
  { index: 24, arabic: 'م', name: 'Meem' },
  { index: 25, arabic: 'ن', name: 'Noon' },
  { index: 26, arabic: 'و', name: 'Waaw' },
  { index: 27, arabic: 'ه', name: 'Haa' },
  { index: 28, arabic: 'ء', name: 'Hamza' },
  { index: 29, arabic: 'ي', name: 'Yaa' },
]

export const letterCount = letters.length

/**
 * The leading number in `5. jeem`, `05-jeem.mp3`.
 *
 * That number is the entire contract between the letter list above, the Rive
 * files and the sound files. Nothing pairs them by name, spelling or order, so
 * adding a letter never means editing code — it means exporting something
 * whose name starts with the right number.
 */
export const LETTER_INDEX = /^\s*(\d+)/

/**
 * The same contract for an artboard-per-letter file, where the artboard's name
 * is the number and nothing else: `1`, `2`, `3`.
 *
 * Deliberately stricter than {@link LETTER_INDEX}. Duplicating an artboard in
 * the Rive editor produces names like `2 5`, `2 6` — twenty-odd unfinished
 * copies of letter 2 sitting alongside the real one. Under the loose rule they
 * all read as letter 2 and only export order decides which the app shows; under
 * this one they're simply not letters until they're renamed to their own
 * number. Silence beats the wrong glyph.
 */
export const ARTBOARD_LETTER = /^\s*(\d+)\s*$/

/**
 * Index names by their number: `["1. alif", "5. jeem"]` becomes
 * `{ 1: "1. alif", 5: "5. jeem" }`. Names without one are skipped, and the
 * first of a duplicate wins so a stray copy can't shadow the real thing.
 */
export function byLetterIndex(
  names: Iterable<string>,
  pattern: RegExp = LETTER_INDEX,
): Record<number, string> {
  const map: Record<number, string> = {}
  for (const name of names) {
    const match = pattern.exec(name)
    if (!match) continue
    const index = Number(match[1])
    if (!(index in map)) map[index] = name
  }
  return map
}

/** The letter positions covered by a set of names, ascending. */
export function letterIndices(
  names: Iterable<string>,
  pattern: RegExp = LETTER_INDEX,
): number[] {
  return Object.keys(byLetterIndex(names, pattern))
    .map(Number)
    .sort((a, b) => a - b)
}
