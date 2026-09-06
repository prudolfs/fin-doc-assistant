import { describe, expect, it } from 'vitest'
import { relativeDateContext } from './relativeDateContext'

describe('relativeDateContext', () => {
  it('provides deterministic UTC month boundaries', () => {
    expect(relativeDateContext(new Date('2026-09-06T23:30:00Z'))).toContain(
      '2026-09-01 through 2026-09-30',
    )
  })

  it('handles leap-year February', () => {
    expect(relativeDateContext(new Date('2028-02-10T00:00:00Z'))).toContain(
      '2028-02-01 through 2028-02-29',
    )
  })
})
