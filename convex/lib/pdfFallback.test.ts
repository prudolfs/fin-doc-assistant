import { PDFDocument, StandardFonts } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { createPdfBatch, inspectPdf, renderPdfPages } from './pdfFallback'

async function samplePdf() {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  for (const text of [
    'Invoice INV-100 Supplier Alpha total EUR 12.34',
    'Invoice INV-100 line item consulting EUR 12.34',
  ]) {
    const page = pdf.addPage([400, 300])
    page.drawText(text, { x: 30, y: 240, size: 16, font })
  }
  return await pdf.save()
}

describe('PDF fallback primitives', () => {
  it('inspects page text and creates a selected page batch', async () => {
    const bytes = await samplePdf()
    const inspection = await inspectPdf(bytes, 10)
    expect(inspection.pageCount).toBe(2)
    expect(inspection.pages[0].text).toContain('INV-100')

    const batch = await createPdfBatch(bytes, [2])
    const batchInspection = await inspectPdf(batch, 10)
    expect(batchInspection.pageCount).toBe(1)
    expect(batchInspection.pages[0].text).toContain('consulting')
  })

  it('renders a PDF page to a bounded PNG for vision fallback', async () => {
    const bytes = await samplePdf()
    const [image] = await renderPdfPages(bytes, [1])
    expect(image.pageNumber).toBe(1)
    expect(Array.from(image.bytes.slice(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ])
    expect(image.bytes.byteLength).toBeGreaterThan(1_000)
  })

  it('rejects an oversized PDF before extracting its pages', async () => {
    const bytes = await samplePdf()
    await expect(inspectPdf(bytes, 1)).rejects.toThrow('1-page limit')
  })
})
