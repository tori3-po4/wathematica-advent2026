import test from "node:test";
import assert from "node:assert/strict";
import { dayDate, filterArticles, isContentPublished, jstDate } from "../src/calendar.ts";

// 同日複数投稿と最終日の記事を用意し、日付の公開判定と検索を別々に検証する。
const articles = [
  { id: "a", date: "2026-12-01", title: "数学の話", author: "Alice" },
  { id: "b", date: "2026-12-01", title: "別の記事", author: "Bob" },
  { id: "c", date: "2026-12-25", title: "最終日の記事", author: "Carol" },
];

test("JST midnight, including December 25, determines publication", () => {
  // 日本時間の0時は前日のUTC 15時。直前・直後を指定し、実行端末の時差に依存させない。
  const publishedAt = (now: string) => articles
    .filter((article) => isContentPublished(article.date, jstDate(new Date(now))))
    .map((article) => article.id);
  assert.deepEqual(publishedAt("2026-11-30T14:59:59.999Z"), []);
  assert.deepEqual(publishedAt("2026-11-30T15:00:00Z"), ["a", "b"]);
  assert.deepEqual(publishedAt("2026-12-24T14:59:59.999Z"), ["a", "b"]);
  assert.deepEqual(publishedAt("2026-12-24T15:00:00Z"), ["a", "b", "c"]);
  assert.equal(isContentPublished("2026-12-01", null), false);
});

test("articles remain available after December and in subsequent years", () => {
  // 開催期間が終わっても過去の記事を読み続けられることを、翌々年の時計で確認する。
  const today = jstDate(new Date("2028-03-02T00:00:00Z"));
  assert.ok(articles.every((article) => isContentPublished(article.date, today)));
  assert.equal(jstDate(new Date("2026-12-01T00:00:00+09:00")), "2026-12-01");
  assert.equal(dayDate(2026, 9), "2026-12-09");
});

test("filtering includes future abstracts and supports date, title and normalized author search", () => {
  assert.equal(filterArticles(articles, { day: 1 }).length, 2);
  assert.equal(filterArticles(articles, { query: "数学" })[0].id, "a");
  assert.equal(filterArticles(articles, { query: " ＡＬＩＣＥ " })[0].id, "a");
  assert.equal(filterArticles(articles, { day: 25, query: "alice" }).length, 0);
  assert.equal(filterArticles(articles, { day: 25, query: "最終日" })[0].id, "c");
  assert.equal(filterArticles(articles, { query: " ＣＡＲＯＬ " })[0].id, "c");
});
