import { defineConfig } from "@playwright/test";

// ブラウザテストは開発サーバーではなく、専用データからビルドした静的サイトを操作する。
export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:4322",
    // 既存のChromeを使う場合はPLAYWRIGHT_CHANNEL=chromeを指定し、追加インストールを避けられる。
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  webServer: {
    // 記事・年度を固定した一時サイトを作り、本物のcontent/やdist/とテストを分離する。
    command: "node tests/serve-fixture.ts",
    url: "http://127.0.0.1:4322",
    timeout: 60_000,
  },
});
