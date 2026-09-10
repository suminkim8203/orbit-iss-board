import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir: '.', testMatch: 'csv.spec.mjs', fullyParallel: false, workers: 1,
  retries: 0, timeout: 15000, expect: { timeout: 4000 },
  reporter: [['list'], ['./reporter.mjs']],
  outputDir: '../../../.t05-test-output',
  use: { baseURL: 'http://127.0.0.1:5185', headless: true, acceptDownloads: true, screenshot: 'only-on-failure' },
  webServer: { command: 'npm exec vite -- --config tests/t05/vite.config.mjs', cwd: fileURLToPath(new URL('../..', import.meta.url)), url: 'http://127.0.0.1:5185', reuseExistingServer: false, timeout: 60000 },
});
