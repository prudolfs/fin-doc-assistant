import { describe, expect, it } from 'vitest'
import { formatBytes, validateDocumentFile } from './document-files'

describe('document file validation', () => {
  it('accepts configured finance document formats within the limit', () => {
    expect(
      validateDocumentFile(
        { name: 'invoice.pdf', size: 1024, type: 'application/pdf' },
        2048,
      ),
    ).toBeNull()
  })

  it('rejects unsupported formats', () => {
    expect(
      validateDocumentFile(
        { name: 'ledger.csv', size: 100, type: 'text/csv' },
        2048,
      ),
    ).toContain('not a supported')
  })

  it('honors server-provided MIME types and file-size limits', () => {
    expect(
      validateDocumentFile(
        { name: 'receipt.webp', size: 100, type: 'image/webp' },
        2048,
        ['application/pdf'],
      ),
    ).toContain('not a supported')
    expect(
      validateDocumentFile(
        { name: 'large.pdf', size: 2049, type: 'application/pdf' },
        2048,
      ),
    ).toContain(formatBytes(2048))
  })
})
