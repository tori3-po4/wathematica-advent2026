import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:4322",
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  webServer: {
    command: "node tests/serve-fixture.mjs",
    url: "http://127.0.0.1:4322",
    timeout: 60_000,
  },
});
