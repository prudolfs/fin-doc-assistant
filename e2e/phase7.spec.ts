import { expect, test } from '@playwright/test'

test('protects application routes and exposes supported sign-in methods', async ({
  page,
}) => {
  await page.goto('/app/settings')
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /github/i })).toBeVisible()
})

test('validates account creation before sending credentials', async ({
  page,
}) => {
  await page.goto('/sign-up')
  await page.getByLabel('Name').fill('Phase Seven')
  await page.getByLabel('Email').fill('phase-seven@example.com')
  await page.getByLabel('Password', { exact: true }).fill('valid-password')
  await page.getByLabel('Confirm password').fill('different-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/sign-up$/)
})
