import { defineConfig, devices } from "@playwright/test";

/**
 * Production-scale E2E: runs against a real `next start` build on :3100
 * (auto-started), hitting live providers — slow but honest.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120000,
  expect: { timeout: 30000 },
  retries: 1,
  workers: 2,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    // NOTE: `next start` prints a standalone-mode warning but serves fine;
    // `node .next/standalone/server.js` hangs under the test harness.
    command: "npm run start -- -p 3100",
    port: 3100,
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
