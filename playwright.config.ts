import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8080',
    channel: 'chrome',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm --pm-on-fail=ignore dev --host 127.0.0.1',
    url: 'http://127.0.0.1:8080/sign-in',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
