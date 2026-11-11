import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-12-02T03:00:00Z"));
});

test("React hydrates with CSP, filters articles, preserves disclosures and uses embedded images and PDFs", async ({ page }) => {
  const errors: string[] = [];
  const remoteRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", (request) => {
    if (new URL(request.url()).hostname !== "127.0.0.1") remoteRequests.push(request.url());
  });
  const response = await page.goto("/");
  const html = await response!.text();
  expect(html).toContain("data:image/png;base64,");
  expect(html).toContain(Buffer.from("%PDF-1.4\nfixture").toString("base64"));
  await expect(page.locator("#result-count")).toHaveText("3件の記事");
  await expect(page.locator(".day-tag")).toHaveCount(25);
  await expect(page.locator('[data-day="2"]')).toHaveAttribute("aria-current", "date");
  await expect(page.locator('[data-day="3"]')).toBeDisabled();
  await expect(page.locator('[data-day="1"] .more-authors')).toHaveText("+1");
  await expect(page.locator("#article-math .prose strong")).toHaveText("概要");
  await page.locator("#article-math summary").click();
  const details = page.locator("#article-math details");
  await expect(details).toHaveJSProperty("open", true);

  await page.getByLabel("タイトル・著者名で検索").fill(" ＡＬＩＣＥ ");
  await expect(page.locator("#result-count")).toHaveText("1件の記事");
  await page.getByLabel("タイトル・著者名で検索").fill("not found");
  await expect(page.locator("#empty-title")).toHaveText("一致する記事が見つかりませんでした。");
  await page.getByRole("button", { name: "絞り込みを解除" }).click();
  await expect(page.locator("#result-count")).toHaveText("3件の記事");
  await expect(details).toHaveJSProperty("open", true);
  await page.locator('[data-day="1"]').click();
  await expect(page).toHaveURL(/#day-1$/);
  await expect(page.locator("#result-count")).toHaveText("2件の記事");
  await expect(page.locator('[data-day="1"]')).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("タイトル・著者名で検索").fill("Bob");
  await page.locator('[data-day="1"]').click();
  await expect(page.getByLabel("タイトル・著者名で検索")).toHaveValue("");
  await expect(page.locator("#result-count")).toHaveText("2件の記事");

  const icon = page.locator("#article-math .author img");
  await expect(icon).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect.poll(() => icon.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
  const downloadPromise = page.waitForEvent("download");
  await expect(page.getByRole("link", { name: "PDFをダウンロード" })).toHaveAttribute("href", /^data:application\/pdf;base64,/);
  await page.getByRole("link", { name: "PDFをダウンロード" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("pdf.pdf");
  expect(await download.failure()).toBeNull();
  await expect(page.locator("#article-external a.read-link")).toHaveAttribute("href", "https://example.com/article");
  expect(await page.evaluate(() => "articleScriptRan" in window)).toBe(false);
  expect(errors).toEqual([]);
  expect(remoteRequests).toEqual([]);
});

test("article and day deep links work with browser history and unpublished dates", async ({ page }) => {
  await page.goto("/#article-math");
  await expect(page.locator("#article-math details")).toHaveJSProperty("open", true);
  await expect(page.locator("#article-math")).toBeFocused();
  await page.locator('[data-day="2"]').click();
  await expect(page.locator("#result-count")).toHaveText("1件の記事");
  await page.goBack();
  await expect(page.locator("#result-count")).toHaveText("3件の記事");
  await expect(page.locator("#article-math")).toBeFocused();
  await page.goto("/#day-25");
  await expect(page.locator("#result-count")).toHaveText("3件の記事");
  await expect(page.locator('[data-day="25"]')).toBeDisabled();
  await page.goto("/#day-1");
  await expect(page.locator("#result-count")).toHaveText("2件の記事");
  await expect(page.locator("#filter-status")).toHaveText("12月1日の記事を表示中");
});

test("JST midnight unlocks days without reloading or losing search, focus and expanded bodies", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-30T14:59:59Z"));
  await page.goto("/");
  await expect(page.locator(".day-tag:disabled")).toHaveCount(25);
  await expect(page.locator("#article-list article")).toHaveCount(0);
  await page.clock.setFixedTime(new Date("2026-11-30T15:00:00Z"));
  await expect(page.locator("#result-count")).toHaveText("2件の記事");
  await page.locator("#article-math summary").click();
  const search = page.getByLabel("タイトル・著者名で検索");
  await search.fill("Alice");
  await page.clock.setFixedTime(new Date("2026-12-01T15:00:00Z"));
  await expect(page.locator('[data-day="2"]')).toBeEnabled();
  await expect(search).toHaveValue("Alice");
  await expect(search).toBeFocused();
  await expect(page.locator("#article-math details")).toHaveJSProperty("open", true);
  await expect(page.locator("#result-count")).toHaveText("1件の記事");
  await page.getByRole("button", { name: "絞り込みを解除" }).click();
  await expect(page.locator("#result-count")).toHaveText("3件の記事");
  await page.clock.setFixedTime(new Date("2026-12-24T15:00:00Z"));
  await expect(page.locator("#result-count")).toHaveText("4件の記事");
  await page.locator('[data-day="25"]').click();
  await expect(page.locator("#result-count")).toHaveText("1件の記事");
  await page.clock.setFixedTime(new Date("2026-11-30T14:00:00Z"));
  await expect(page.locator("#result-count")).toHaveText("0件の記事");
  await expect(page.locator("#filter-status")).toBeHidden();
  await page.clock.setFixedTime(new Date("2027-01-02T00:00:00Z"));
  await expect(page.locator("#result-count")).toHaveText("4件の記事");
});

test("calendar and search fit a narrow screen and empty dates explain their state", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.clock.setFixedTime(new Date("2027-01-02T00:00:00Z"));
  await page.goto("/");
  await expect(page.locator("#result-count")).toHaveText("4件の記事");
  await page.locator('[data-day="3"]').click();
  await expect(page.locator("#empty-title")).toHaveText("12月3日の記事を準備しています。");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
