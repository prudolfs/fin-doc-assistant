export type TarEntry = {
  name: string
  bytes: Uint8Array
  modifiedAt?: number
}

const BLOCK_SIZE = 512
const encoder = new TextEncoder()

function writeText(
  target: Uint8Array,
  offset: number,
  length: number,
  text: string,
) {
  target.set(encoder.encode(text).slice(0, length), offset)
}

function writeOctal(
  target: Uint8Array,
  offset: number,
  length: number,
  value: number,
) {
  const text = Math.max(0, Math.trunc(value))
    .toString(8)
    .padStart(length - 1, '0')
    .slice(-(length - 1))
  writeText(target, offset, length, `${text}\0`)
}

function safeName(name: string, index: number) {
  const normalized = name
    .normalize('NFKD')
    .replaceAll(/[^A-Za-z0-9._/-]+/g, '_')
    .replaceAll(/\.{2,}/g, '.')
    .replace(/^\/+/, '')
    .replace(/^(\.\/)+/, '')
  const fallback = normalized || `entry-${index}`
  const encoded = encoder.encode(fallback)
  if (encoded.length <= 100) return fallback
  return new TextDecoder().decode(encoded.slice(0, 100)).replace(/_+$/, '')
}

function header(entry: TarEntry, index: number) {
  const result = new Uint8Array(BLOCK_SIZE)
  writeText(result, 0, 100, safeName(entry.name, index))
  writeOctal(result, 100, 8, 0o600)
  writeOctal(result, 108, 8, 0)
  writeOctal(result, 116, 8, 0)
  writeOctal(result, 124, 12, entry.bytes.byteLength)
  writeOctal(
    result,
    136,
    12,
    Math.floor((entry.modifiedAt ?? Date.now()) / 1_000),
  )
  result.fill(0x20, 148, 156)
  result[156] = '0'.charCodeAt(0)
  writeText(result, 257, 6, 'ustar\0')
  writeText(result, 263, 2, '00')
  const checksum = result.reduce((total, byte) => total + byte, 0)
  const checksumText = checksum.toString(8).padStart(6, '0').slice(-6)
  writeText(result, 148, 8, `${checksumText}\0 `)
  return result
}

export function createTarArchive(entries: ReadonlyArray<TarEntry>) {
  const parts: Array<Uint8Array> = []
  let totalBytes = BLOCK_SIZE * 2
  for (const [index, entry] of entries.entries()) {
    const padding =
      (BLOCK_SIZE - (entry.bytes.byteLength % BLOCK_SIZE)) % BLOCK_SIZE
    parts.push(header(entry, index), entry.bytes, new Uint8Array(padding))
    totalBytes += BLOCK_SIZE + entry.bytes.byteLength + padding
  }
  const archive = new Uint8Array(totalBytes)
  let offset = 0
  for (const part of parts) {
    archive.set(part, offset)
    offset += part.byteLength
  }
  return archive
}
