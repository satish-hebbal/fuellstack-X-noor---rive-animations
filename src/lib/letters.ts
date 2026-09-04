/**
 * The Arabic alphabet, in the order the lesson walks through it.
 *
 * 29 entries: the 28 letters plus hamza at the end, which is what makes خ the
 * seventh of twenty-nine.
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
  { index: 26, arabic: 'ه', name: 'Haa' },
  { index: 27, arabic: 'و', name: 'Waaw' },
  { index: 28, arabic: 'ي', name: 'Yaa' },
  { index: 29, arabic: 'ء', name: 'Hamza' },
]

export const letterCount = letters.length
