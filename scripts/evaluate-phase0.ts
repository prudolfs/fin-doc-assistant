import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { createGateway } from '@ai-sdk/gateway'
import { generateText, Output } from 'ai'
import {
  DEFAULT_AI_GATEWAY_CHAT_MODEL,
  DOCUMENT_EXTRACTION_INSTRUCTIONS,
  MODEL_PRICING_USD_PER_TOKEN,
} from '../shared/constants'
import { estimateModelCostUsd } from '../shared/documentValidation'
import { financeDocumentExtractionSchema } from '../shared/financeSchemas'

const apiKey = process.env.AI_GATEWAY_API_KEY
if (!apiKey) throw new Error('AI_GATEWAY_API_KEY is required')

const model = process.env.AI_GATEWAY_CHAT_MODEL || DEFAULT_AI_GATEWAY_CHAT_MODEL
const gateway = createGateway({ apiKey })
const fixtureDirectory = resolve('tests/fixtures/phase0')
const expected = JSON.parse(
  await readFile(resolve(fixtureDirectory, 'expected.json'), 'utf8'),
) as Record<string, Record<string, unknown>>

const fixtures = [
  { path: resolve(fixtureDirectory, 'receipt.png'), mediaType: 'image/png' },
  {
    path: resolve(fixtureDirectory, 'invoice.pdf'),
    mediaType: 'application/pdf',
  },
] as const

for (const fixture of fixtures) {
  const filename = basename(fixture.path)
  const startedAt = Date.now()
  let result
  try {
    result = await generateText({
      model: gateway(model),
      output: Output.object({
        schema: financeDocumentExtractionSchema,
        name: 'finance_document_extraction',
        description:
          'One receipt or invoice with monetary values in minor units.',
      }),
      system: DOCUMENT_EXTRACTION_INSTRUCTIONS,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the finance document.' },
            {
              type: 'file',
              data: await readFile(fixture.path),
              mediaType: fixture.mediaType,
              filename,
            },
          ],
        },
      ],
    })
  } catch (error) {
    console.log(
      JSON.stringify({
        filename,
        model,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    )
    continue
  }
  const actual = {
    documentType: result.output.documentType,
    merchantOrSupplierName: result.output.merchantOrSupplierName,
    documentNumber: result.output.documentNumber,
    issueDate: result.output.issueDate.iso,
    dueDate: result.output.dueDate.iso,
    currency: result.output.currency,
    subtotalMinor: result.output.subtotalMinor,
    taxMinor: result.output.taxMinor,
    totalMinor: result.output.totalMinor,
    lineItemCount: result.output.lineItems.length,
  }
  const expectedFields = expected[filename] ?? {}
  const checks = Object.entries(expectedFields).map(([field, value]) => ({
    field,
    passed: actual[field as keyof typeof actual] === value,
  }))
  const cost = estimateModelCostUsd(
    model,
    result.usage,
    MODEL_PRICING_USD_PER_TOKEN,
  )
  console.log(
    JSON.stringify({
      filename,
      model,
      latencyMs: Date.now() - startedAt,
      usage: result.usage,
      estimatedCostUsd: cost,
      accuracy:
        checks.length === 0
          ? null
          : checks.filter((item) => item.passed).length / checks.length,
      failedFields: checks
        .filter((item) => !item.passed)
        .map((item) => item.field),
      actual,
    }),
  )
}
