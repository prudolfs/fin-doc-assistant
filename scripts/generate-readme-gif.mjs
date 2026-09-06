/* oxlint-disable no-underscore-dangle */

import { spawn, spawnSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const baseUrl = process.env.README_DEMO_BASE_URL ?? 'http://localhost:8080'
const outputDirectory = resolve('docs/assets/readme-frames')
const outputGif = resolve('docs/assets/finance-document-assistant-demo.gif')
const fixture = resolve('tests/fixtures/phase0/receipt.png')
const password = `Readme-demo-${Date.now()}!`
const email = `readme-demo-${Date.now()}@example.com`
const convexBinary = resolve('node_modules/.bin/convex')
const viteBinary = resolve('node_modules/.bin/vite')

await mkdir(outputDirectory, { recursive: true })

let server
let browser
let page

async function serverIsReady() {
  try {
    const response = await fetch(`${baseUrl}/sign-in`)
    return response.ok
  } catch {
    return false
  }
}

async function waitForServer() {
  if (await serverIsReady()) return
  server = spawn(viteBinary, ['dev', '--host', '127.0.0.1'], {
    stdio: 'inherit',
  })
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Vite exited with code ${server.exitCode}`)
    }
    if (await serverIsReady()) return
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500))
  }
  throw new Error('Timed out waiting for the application server')
}

async function shot(index, name) {
  await page.screenshot({
    path: resolve(
      outputDirectory,
      `frame-${String(index).padStart(2, '0')}-${name}.png`,
    ),
    animations: 'disabled',
  })
}

function runConvex(args) {
  const result = spawnSync(convexBinary, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || `Convex exited with code ${result.status}`)
  }
  return result.stdout.trim()
}

function completeDocumentFromFixture(documentId) {
  const job = JSON.parse(
    runConvex([
      'run',
      '--inline-query',
      `return await ctx.db.query("documentJobs").withIndex("by_documentId", q => q.eq("documentId", "${documentId}")).order("desc").first();`,
    ]),
  )
  if (!job?._id) throw new Error('Could not find the README document job')
  const extraction = {
    documentType: 'receipt',
    merchantOrSupplierName: 'BALTIC MARKET SIA',
    supplierAddress: 'Brivibas iela 10, Riga',
    supplierTaxIdentifier: 'LV40100000000',
    customerName: null,
    customerAddress: null,
    documentNumber: 'R-2048',
    issueDate: { printed: '2026-08-21 18:42', iso: '2026-08-21' },
    dueDate: { printed: null, iso: null },
    currency: 'EUR',
    paymentStatus: 'paid',
    paymentMethod: 'CARD',
    subtotalMinor: 420,
    discountMinor: null,
    taxMinor: 88,
    totalMinor: 508,
    lineItems: [
      {
        description: 'Milk',
        quantity: 2,
        unit: null,
        unitPriceMinor: 120,
        discountMinor: null,
        taxRateBasisPoints: null,
        taxMinor: null,
        totalMinor: 240,
        sourcePage: 1,
      },
      {
        description: 'Bread',
        quantity: 1,
        unit: null,
        unitPriceMinor: 180,
        discountMinor: null,
        taxRateBasisPoints: null,
        taxMinor: null,
        totalMinor: 180,
        sourcePage: 1,
      },
    ],
    evidence: [
      { field: 'document_number', printedValue: 'R-2048', sourcePage: 1 },
      { field: 'issue_date', printedValue: '2026-08-21 18:42', sourcePage: 1 },
      { field: 'total', printedValue: 'TOTAL EUR 5.08', sourcePage: 1 },
    ],
    warnings: [],
    confidence: 0.99,
  }
  runConvex([
    'run',
    'internal/documentJobs:complete',
    JSON.stringify({
      documentId,
      jobId: job._id,
      extraction,
      pageCount: 1,
      model: 'deterministic-readme-fixture',
      usage: {},
      latencyMs: 0,
      processingStrategy: 'direct',
      multipleDocumentsDetected: false,
      forcedValidationErrors: [],
    }),
  ])
}

function createGroundedDemoChat(documentId) {
  const document = JSON.parse(
    runConvex([
      'run',
      '--inline-query',
      `return await ctx.db.get("${documentId}");`,
    ]),
  )
  if (!document?.ownerTokenIdentifier) {
    throw new Error('Could not find the README document owner')
  }
  return JSON.parse(
    runConvex([
      'run',
      'readmeDemo:createGroundedChat',
      JSON.stringify({
        documentId,
        ownerTokenIdentifier: document.ownerTokenIdentifier,
      }),
    ]),
  )
}

async function deleteDemoAccount() {
  if (!page || page.isClosed()) return
  try {
    await page.goto(`${baseUrl}/app/settings`)
    const confirmation = page.getByLabel('Type DELETE ACCOUNT to confirm')
    if (!(await confirmation.isVisible({ timeout: 5_000 }))) return
    await page
      .getByLabel('Password (leave blank for an OAuth account)')
      .fill(password)
    await confirmation.fill('DELETE ACCOUNT')
    await page
      .getByRole('button', { name: 'Permanently delete account' })
      .click()
    await page.waitForURL(
      (url) => url.pathname === '/' || url.pathname === '/sign-in',
      { timeout: 20_000 },
    )
  } catch (error) {
    console.warn('Could not delete the temporary README demo account:', error)
  }
}

try {
  await waitForServer()
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
  })
  page = await context.newPage()

  await page.goto(`${baseUrl}/sign-up`)
  await page.getByLabel('Name').fill('Demo Finance User')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL(/\/app(?:\/|$)/, { timeout: 30_000 })

  await page.goto(`${baseUrl}/app/documents/new`)
  await page.locator('input[type="file"]').setInputFiles(fixture)
  await page.getByText('receipt.png', { exact: true }).waitFor()
  await shot(1, 'upload')
  await page.getByRole('button', { name: 'Upload 1 document' }).click()
  await page.waitForURL(/\/app\/documents\/(?!new(?:\/|$))[^/?]+$/, {
    timeout: 30_000,
  })
  const documentId = new URL(page.url()).pathname.split('/').at(-1)
  if (!documentId) throw new Error('Could not determine the demo document ID')
  const finalDocumentStatus = page
    .locator('span.rounded-full')
    .filter({ hasText: /^(completed|needs review|failed)$/i })
    .first()
  await finalDocumentStatus.waitFor({ timeout: 180_000 })
  if ((await finalDocumentStatus.textContent())?.trim() === 'failed') {
    completeDocumentFromFixture(documentId)
    await page
      .locator('span.rounded-full')
      .filter({ hasText: /^completed$/i })
      .first()
      .waitFor({ timeout: 30_000 })
  }
  await page.getByRole('heading', { name: 'Original document' }).waitFor()
  await shot(2, 'document-preview')

  await page.goto(`${baseUrl}/app/documents`)
  await page.getByText('BALTIC MARKET SIA', { exact: true }).waitFor()
  await shot(3, 'documents')

  const chatId = createGroundedDemoChat(documentId)
  await page.goto(`${baseUrl}/app/chat/${chatId}`)
  await page.locator('article').nth(1).waitFor()
  await shot(4, 'grounded-chat')

  await page.goto(`${baseUrl}/app/settings`)
  await page.getByRole('heading', { name: 'Usage and limits' }).waitFor()
  await shot(5, 'settings')

  const ffmpeg = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      '1/2.5',
      '-pattern_type',
      'glob',
      '-i',
      resolve(outputDirectory, 'frame-*.png'),
      '-vf',
      'fps=12,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3',
      '-loop',
      '0',
      outputGif,
    ],
    { stdio: 'inherit' },
  )
  if (ffmpeg.status !== 0) {
    throw new Error(`ffmpeg exited with code ${ffmpeg.status}`)
  }
  console.log(`Created ${outputGif}`)
} finally {
  await deleteDemoAccount()
  await browser?.close()
  server?.kill('SIGTERM')
}
