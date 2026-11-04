import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "*.spec.js",
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:5178/project-monitor/",
    channel: process.env.CI ? undefined : "msedge",
    headless: true,
    actionTimeout: 15000,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node --import tsx tests/e2e/server.ts",
    url: "http://127.0.0.1:5178/project-monitor/",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
