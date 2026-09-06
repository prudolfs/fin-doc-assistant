'use node'

import { createEngine } from 'clawpdf'
import { PDFDocument } from 'pdf-lib'
import { inspectPageTexts } from '../../shared/documentFallback'

const MAX_IMAGE_PIXELS = 16_777_216
const RENDERED_PAGE_WIDTH = 1_600

export async function inspectPdf(bytes: Uint8Array, maxPages: number) {
  const engine = await createEngine({ maxRenderPixels: MAX_IMAGE_PIXELS })
  const pdf = await engine.open(bytes.slice())
  try {
    if (pdf.pageCount > maxPages) {
      throw new Error(`PDF exceeds the ${maxPages}-page limit.`)
    }
    const text = Array.from({ length: pdf.pageCount }, (_, index) =>
      pdf.page(index + 1).text(),
    )
    return {
      pageCount: pdf.pageCount,
      pages: inspectPageTexts(text),
    }
  } finally {
    pdf.destroy()
    await engine.destroy()
  }
}

export async function renderPdfPages(
  bytes: Uint8Array,
  pageNumbers: ReadonlyArray<number>,
) {
  const engine = await createEngine({ maxRenderPixels: MAX_IMAGE_PIXELS })
  const pdf = await engine.open(bytes.slice())
  try {
    const images = []
    for (const pageNumber of pageNumbers) {
      const rendered = await pdf.page(pageNumber).png({
        width: RENDERED_PAGE_WIDTH,
        background: 'white',
        forms: true,
      })
      images.push({ pageNumber, bytes: rendered })
    }
    return images
  } finally {
    pdf.destroy()
    await engine.destroy()
  }
}

export async function createPdfBatch(
  bytes: Uint8Array,
  pageNumbers: ReadonlyArray<number>,
) {
  const source = await PDFDocument.load(bytes, {
    ignoreEncryption: false,
    updateMetadata: false,
  })
  const target = await PDFDocument.create()
  const copied = await target.copyPages(
    source,
    pageNumbers.map((pageNumber) => pageNumber - 1),
  )
  for (const page of copied) target.addPage(page)
  return await target.save({ useObjectStreams: true })
}
