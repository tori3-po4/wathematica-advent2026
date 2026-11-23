import { test, expect } from "@playwright/test";

// 通常は12月2日の公開状態で開始し、日付境界のテストだけ個別に時計を変更する。
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-12-02T03:00:00Z"));
});

test("React hydrates, filters articles, renders plain text and uses embedded images and PDFs", async ({ page }) => {
  const errors: string[] = [];
  const remoteRequests: string[] = [];
  // ハイドレーションエラーや意図しない外部リクエストも操作と同時に検出する。
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", (request) => {
    if (new URL(request.url()).hostname !== "127.0.0.1") remoteRequests.push(request.url());
  });
  const response = await page.goto("/");
  const html = await response!.text();
  expect(html).toContain("data:image/png;base64,");
  expect(html).toContain(Buffer.from("%PDF-1.4\nfixture").toString("base64"));
  await expect(page.locator("#result-count")).toHaveText("4件の記事");
  await expect(page.locator(".day-tag")).toHaveCount(25);
  await expect(page.locator('[data-day="2"]')).toHaveAttribute("aria-current", "date");
  await expect(page.locator('[data-day="3"]')).toBeEnabled();
  await expect(page.locator('[data-day="1"] .more-authors')).toHaveText("+1");
  const abstract = page.locator("#article-math p.whitespace-pre-wrap");
  await expect(abstract).toHaveText(/^\*\*概要\*\*です。\n<script>/);
  await expect(abstract).toHaveCSS("white-space", "pre-wrap");
  await expect(abstract.locator("strong, script, img")).toHaveCount(0);
  await expect(page.locator("#article-list details")).toHaveCount(0);

  await page.getByLabel("タイトル・著者名で検索").fill(" ＡＬＩＣＥ ");
  await expect(page.locator("#result-count")).toHaveText("1件の記事");
  await page.getByLabel("タイトル・著者名で検索").fill("not found");
  await expect(page.locator("#empty-title")).toHaveText("一致する記事が見つかりませんでした。");
  // 検索欄を空に戻し、検索前の記事一覧を確認する。
  await page.getByLabel("タイトル・著者名で検索").fill("");
  await expect(page.locator("#result-count")).toHaveText("4件の記事");
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
  const pdfLink = page.locator("#article-pdf a.read-link");
  await expect(pdfLink).toHaveAttribute("href", /^data:application\/pdf;base64,/);
  await pdfLink.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("pdf.pdf");
  expect(await download.failure()).toBeNull();
  await expect(page.locator("#article-external a.read-link")).toHaveAttribute("href", "https://example.com/article");
  await expect(page.locator("#article-external a.read-link")).toHaveAttribute("target", "_blank");
  await expect(page.locator("#article-external a.read-link")).toHaveAttribute("rel", "noopener noreferrer");
  expect(await page.evaluate(() => "articleScriptRan" in window)).toBe(false);
  expect(errors).toEqual([]);
  expect(remoteRequests).toEqual([]);
});

test("article and day deep links work with browser history and unpublished dates", async ({ page }) => {
  await page.goto("/#article-math");
  await expect(page.locator("#article-math a.read-link")).toHaveAttribute("download", "math.pdf");
  await expect(page.locator("#article-math")).toBeFocused();
  await page.locator('[data-day="2"]').click();
  await expect(page.locator("#result-count")).toHaveText("1件の記事");
  await page.goBack();
  await expect(page.locator("#result-count")).toHaveText("4件の記事");
  await expect(page.locator("#article-math")).toBeFocused();
  await page.goto("/#day-25");
  await expect(page.locator("#result-count")).toHaveText("1件の記事");
  await expect(page.locator('[data-day="25"]')).toBeEnabled();
  await expect(page.locator('[data-day="25"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#article-last")).toBeVisible();
  await expect(page.locator("#article-last a.read-link")).toHaveCount(0);
  await page.goto("/#article-last");
  await expect(page.locator("#result-count")).toHaveText("4件の記事");
  await expect(page.locator("#article-last")).toBeFocused();
  await expect(page.locator("#article-last a.read-link")).toHaveCount(0);
  await page.goto("/#day-1");
  await expect(page.locator("#result-count")).toHaveText("2件の記事");
  await expect(page.locator("#filter-status")).toHaveText("12月1日の記事を表示中");
});

test("future dates expose abstracts, author icons and search while both content types stay locked", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-30T14:59:59Z"));
  await page.goto("/");
  await expect(page.locator("#result-count")).toHaveText("4件の記事");
  await expect(page.locator(".day-tag:enabled")).toHaveCount(25);
  await expect(page.locator('[data-day="1"]')).toHaveAccessibleName("12月1日：2件の記事");
  await expect(page.locator('[data-day="1"] .more-authors')).toHaveText("+1");
  await expect(page.locator('[data-day="25"] img')).toBeVisible();
  await expect(page.locator("#article-list article")).toHaveCount(4);
  await expect(page.locator("#article-list a.read-link")).toHaveCount(0);
  await expect(page.locator("#article-math")).toContainText("本文は2026-12-01 0:00（日本時間）に公開します。");
  await expect(page.locator("#article-last")).toContainText("本文は2026-12-25 0:00（日本時間）に公開します。");
  await page.getByLabel("タイトル・著者名で検索").fill(" ＤＡＶＥ ");
  await expect(page.locator("#result-count")).toHaveText("1件の記事");
  await expect(page.locator("#article-last p.whitespace-pre-wrap")).toBeVisible();
  await page.locator('[data-day="2"]').click();
  await expect(page.getByLabel("タイトル・著者名で検索")).toHaveValue("");
  await expect(page.locator("#article-external p.whitespace-pre-wrap")).toBeVisible();
  await expect(page.locator("#article-external a.read-link")).toHaveCount(0);
  await page.locator('[data-day="3"]').click();
  await expect(page.locator("#empty-title")).toHaveText("12月3日の記事を準備しています。");
  // 直リンクでも範囲外の日付は選択しない。
  for (const day of [0, 26]) {
    await page.goto(`/#day-${day}`);
    // ハッシュだけの移動では前の日付選択が残るため、直リンクの初期表示を再現する。
    await page.reload();
    await expect(page.locator("#result-count")).toHaveText("4件の記事");
    await expect(page.locator("#filter-status")).toBeHidden();
  }
});

test("JST midnight unlocks only content without reloading or losing date, search and focus", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-30T14:59:59Z"));
  await page.goto("/#day-1");
  await expect(page.locator("#result-count")).toHaveText("2件の記事");
  await expect(page.locator("#article-list a.read-link")).toHaveCount(0);
  const search = page.getByLabel("タイトル・著者名で検索");
  await search.fill("Alice");
  await page.clock.setFixedTime(new Date("2026-11-30T15:00:00Z"));
  await expect(page.locator("#article-math a.read-link")).toHaveAttribute("download", "math.pdf");
  await expect(page.locator("#article-math")).not.toContainText("本文は");
  await expect(page.locator('[data-day="1"]')).toHaveAttribute("aria-pressed", "true");
  await expect(search).toHaveValue("Alice");
  await expect(search).toBeFocused();
  await expect(page.locator("#result-count")).toHaveText("1件の記事");
  await page.clock.setFixedTime(new Date("2026-12-01T15:00:00Z"));
  await expect(page.locator("#article-external a.read-link")).toHaveAttribute("href", "https://example.com/article");
  await expect(search).toHaveValue("Alice");
  await expect(search).toBeFocused();
  await expect(page.locator("#result-count")).toHaveText("1件の記事");
  await search.fill("");
  await expect(page.locator("#result-count")).toHaveText("2件の記事");
  await page.locator('[data-day="25"]').click();
  await expect(page.locator("#result-count")).toHaveText("1件の記事");
  await page.clock.setFixedTime(new Date("2026-12-24T14:59:59Z"));
  await expect(page.locator("#article-last a.read-link")).toHaveCount(0);
  await page.clock.setFixedTime(new Date("2026-12-24T15:00:00Z"));
  await expect(page.locator("#article-last a.read-link")).toBeVisible();
  // 時計を過去へ戻すと本文だけを再ロックし、選択日と概要は維持する。
  await page.clock.setFixedTime(new Date("2026-11-30T14:00:00Z"));
  await expect(page.locator("#article-list a.read-link")).toHaveCount(0);
  await expect(page.locator("#result-count")).toHaveText("1件の記事");
  await expect(page.locator("#filter-status")).toHaveText("12月25日の記事を表示中");
  await expect(page.locator("#article-last p.whitespace-pre-wrap")).toBeVisible();
  await page.clock.setFixedTime(new Date("2027-01-02T00:00:00Z"));
  await expect(page.locator("#article-last a.read-link")).toBeVisible();
  await page.locator("#article-last h3 a").click();
  await expect(page.locator("#result-count")).toHaveText("4件の記事");
});

test("static HTML exposes abstracts and calendar metadata while content stays locked", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("#result-count")).toHaveText("4件の記事");
    await expect(page.locator("#article-math p.whitespace-pre-wrap")).toBeVisible();
    await expect(page.locator("#article-last p.whitespace-pre-wrap")).toBeVisible();
    await expect(page.locator('[data-day="1"] .more-authors')).toHaveText("+1");
    await expect(page.locator('[data-day="25"] img')).toBeVisible();
    await expect(page.locator("#article-list a.read-link")).toHaveCount(0);
  } finally {
    await context.close();
  }
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
