import { describe, expect, it } from 'vitest'
import { createTarArchive } from './tarArchive'

describe('createTarArchive', () => {
  it('creates a ustar entry with bounded safe paths and correct content', () => {
    const content = new TextEncoder().encode('private export')
    const archive = createTarArchive([
      {
        name: '../../documents/my invoice.json',
        bytes: content,
        modifiedAt: 0,
      },
    ])

    const header = archive.slice(0, 512)
    const name = new TextDecoder()
      .decode(header.slice(0, 100))
      .replaceAll('\0', '')
    expect(name).toBe('documents/my_invoice.json')
    expect(new TextDecoder().decode(header.slice(257, 262))).toBe('ustar')
    expect(
      new TextDecoder().decode(archive.slice(512, 512 + content.length)),
    ).toBe('private export')
    expect(archive.byteLength % 512).toBe(0)
  })
})
