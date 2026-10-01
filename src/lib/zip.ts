/**
 * A ZIP writer, stored entries only.
 *
 * Deliberately uncompressed. Everything we put in a bundle is already a
 * compact binary format — DEFLATE saves about 5% on an .mp3 and a third on a
 * .riv, which across a real bundle works out at roughly 6% overall. That isn't
 * worth a compression dependency, and the browser's own `CompressionStream`
 * would still leave the CRCs and headers below to write by hand. Stored
 * entries make this the whole implementation, and every unzip tool reads them.
 *
 * No Zip64, so this tops out at 4 GB per file and per archive. The bundles
 * here are a couple of megabytes.
 */

export type ZipEntry = {
  /** Path inside the archive, e.g. `letters/29-letters.riv`. Forward slashes. */
  path: string
  /**
   * Backed by a plain ArrayBuffer, not the SharedArrayBuffer that a bare
   * `Uint8Array` also admits — `Blob` only accepts the former.
   */
  bytes: Uint8Array<ArrayBuffer>
}

const CRC_TABLE = /* @__PURE__ */ (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array<ArrayBufferLike>): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** MS-DOS packed time and date, which is what the format stores. */
function dosStamp(when: Date): { time: number; date: number } {
  return {
    // Two-second resolution — that's the format, not a rounding choice.
    time: ((when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1)) & 0xffff,
    date:
      (((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate()) & 0xffff,
  }
}

/** Build a .zip from the entries, in the order given. */
export function zipStore(entries: ZipEntry[], when: Date = new Date()): Blob {
  const encoder = new TextEncoder()
  const { time, date } = dosStamp(when)

  const body: BlobPart[] = []
  const directory: Uint8Array<ArrayBuffer>[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.path)
    const crc = crc32(entry.bytes)
    const size = entry.bytes.length

    const local = new Uint8Array(30 + name.length)
    const head = new DataView(local.buffer)
    head.setUint32(0, 0x04034b50, true) // local file header
    head.setUint16(4, 20, true) // version needed
    head.setUint16(6, 0x0800, true) // flags: names are UTF-8
    head.setUint16(8, 0, true) // method: stored
    head.setUint16(10, time, true)
    head.setUint16(12, date, true)
    head.setUint32(14, crc, true)
    head.setUint32(18, size, true) // compressed size — the same, stored
    head.setUint32(22, size, true)
    head.setUint16(26, name.length, true)
    local.set(name, 30)

    body.push(local, entry.bytes)

    const record = new Uint8Array(46 + name.length)
    const dir = new DataView(record.buffer)
    dir.setUint32(0, 0x02014b50, true) // central directory header
    dir.setUint16(4, 20, true) // version made by
    dir.setUint16(6, 20, true) // version needed
    dir.setUint16(8, 0x0800, true)
    dir.setUint16(10, 0, true)
    dir.setUint16(12, time, true)
    dir.setUint16(14, date, true)
    dir.setUint32(16, crc, true)
    dir.setUint32(20, size, true)
    dir.setUint32(24, size, true)
    dir.setUint16(28, name.length, true)
    // Extra, comment, disk and attribute fields all stay zero.
    dir.setUint32(42, offset, true) // where this entry's local header sits
    record.set(name, 46)

    directory.push(record)
    offset += local.length + size
  }

  const directorySize = directory.reduce((total, record) => total + record.length, 0)

  const end = new Uint8Array(22)
  const tail = new DataView(end.buffer)
  tail.setUint32(0, 0x06054b50, true) // end of central directory
  tail.setUint16(8, entries.length, true)
  tail.setUint16(10, entries.length, true)
  tail.setUint32(12, directorySize, true)
  tail.setUint32(16, offset, true)

  return new Blob([...body, ...directory, end], { type: 'application/zip' })
}

/** Hand a Blob to the browser as a download. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // Firefox needs the URL to outlive the click, so this can't be synchronous.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
