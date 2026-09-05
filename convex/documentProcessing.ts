'use node'

import { createGateway } from '@ai-sdk/gateway'
import { generateText, Output } from 'ai'
import { PDFDocument } from 'pdf-lib'
import { v } from 'convex/values'
import {
  DOCUMENT_EXTRACTION_INSTRUCTIONS,
  MODEL_PRICING_USD_PER_TOKEN,
} from '../shared/constants'
import {
  estimateModelCostUsd,
  validateDocumentExtraction,
} from '../shared/documentValidation'
import { financeDocumentExtractionSchema } from '../shared/financeSchemas'
import { internal } from './_generated/api'
import { env, internalAction } from './_generated/server'
import { resolveChatModel, resolveDocumentLimits } from './lib/documentConfig'
import type { AcceptedDocumentMimeType } from '../shared/constants'

function matchesSignature(
  bytes: Uint8Array,
  mimeType: AcceptedDocumentMimeType,
) {
  if (mimeType === 'application/pdf') {
    return new TextDecoder('ascii').decode(bytes.slice(0, 5)) === '%PDF-'
  }
  if (mimeType === 'image/png') {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    )
  }
  if (mimeType === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  return (
    new TextDecoder('ascii').decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder('ascii').decode(bytes.slice(8, 12)) === 'WEBP'
  )
}

async function getPageCount(
  bytes: Uint8Array,
  mimeType: AcceptedDocumentMimeType,
) {
  if (mimeType !== 'application/pdf') return 1
  const pdf = await PDFDocument.load(bytes, {
    ignoreEncryption: false,
    updateMetadata: false,
  })
  return pdf.getPageCount()
}

function usageWithoutUndefined(usage: {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}) {
  return {
    ...(usage.inputTokens === undefined
      ? {}
      : { inputTokens: usage.inputTokens }),
    ...(usage.outputTokens === undefined
      ? {}
      : { outputTokens: usage.outputTokens }),
    ...(usage.totalTokens === undefined
      ? {}
      : { totalTokens: usage.totalTokens }),
  }
}

function safeFailure(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes('signature')) {
      return { code: 'invalid_file_signature', message: error.message }
    }
    if (error.message.includes('page limit')) {
      return { code: 'page_limit_exceeded', message: error.message }
    }
    if (error.message.includes('encrypted')) {
      return {
        code: 'encrypted_pdf',
        message: 'Encrypted PDFs are not supported by the validation spike.',
      }
    }
  }
  return {
    code: 'extraction_failed',
    message:
      'The document could not be extracted. Check the server log for details.',
  }
}

export const processDocument = internalAction({
  args: {
    documentId: v.id('documents'),
    jobId: v.id('documentJobs'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const queued = await ctx.runQuery(
      internal.internal.documentJobs.getForProcessing,
      args,
    )
    if (!queued || queued.job.status !== 'queued') return null

    try {
      await ctx.runMutation(internal.internal.documentJobs.markProcessing, {
        ...args,
        stage: 'downloading',
      })
      const blob = await ctx.storage.get(queued.document.storageId)
      if (!blob) throw new Error('Stored file could not be retrieved')
      const bytes = new Uint8Array(await blob.arrayBuffer())
      if (!matchesSignature(bytes, queued.document.mimeType)) {
        throw new Error('File signature does not match its declared type.')
      }

      const pageCount = await getPageCount(bytes, queued.document.mimeType)
      const documentLimits = resolveDocumentLimits({
        maxAcceptedFiles: env.DOCUMENT_MAX_ACCEPTED_FILES,
        maxAcceptedFileBytes: env.DOCUMENT_MAX_ACCEPTED_FILE_BYTES,
        maxPages: env.DOCUMENT_MAX_PAGES,
      })
      if (pageCount > documentLimits.maxPages) {
        throw new Error(
          `PDF exceeds the ${documentLimits.maxPages}-page limit.`,
        )
      }
      if (!env.AI_GATEWAY_API_KEY) {
        throw new Error('AI Gateway is not configured')
      }

      await ctx.runMutation(internal.internal.documentJobs.markProcessing, {
        ...args,
        stage: 'extracting',
      })
      const model = resolveChatModel(env.AI_GATEWAY_CHAT_MODEL)
      const gateway = createGateway({ apiKey: env.AI_GATEWAY_API_KEY })
      const startedAt = Date.now()
      const result = await generateText({
        model: gateway(model),
        output: Output.object({
          schema: financeDocumentExtractionSchema,
          name: 'finance_document_extraction',
          description:
            'Validated fields extracted from one receipt or invoice.',
        }),
        system: DOCUMENT_EXTRACTION_INSTRUCTIONS,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract the finance document. Return only facts visible in the file.',
              },
              {
                type: 'file',
                data: bytes,
                mediaType: queued.document.mimeType,
                filename: queued.document.originalFilename,
              },
            ],
          },
        ],
      })
      const latencyMs = Date.now() - startedAt

      await ctx.runMutation(internal.internal.documentJobs.markProcessing, {
        ...args,
        stage: 'validating',
      })
      const validationErrors = validateDocumentExtraction(
        result.output,
        pageCount,
      )
      const usage = usageWithoutUndefined(result.usage)
      const estimatedCostUsd = estimateModelCostUsd(
        model,
        usage,
        MODEL_PRICING_USD_PER_TOKEN,
      )
      await ctx.runMutation(internal.internal.documentJobs.complete, {
        ...args,
        extraction: result.output,
        pageCount,
        validationErrors,
        model,
        usage,
        latencyMs,
        ...(estimatedCostUsd === null ? {} : { estimatedCostUsd }),
      })
    } catch (error) {
      console.error('Phase 0 document processing failed', {
        documentId: args.documentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      const failure = safeFailure(error)
      await ctx.runMutation(internal.internal.documentJobs.fail, {
        ...args,
        errorCode: failure.code,
        safeErrorMessage: failure.message,
      })
    }
    return null
  },
})
