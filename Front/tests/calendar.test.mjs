import test from "node:test";
import assert from "node:assert/strict";
import { calendarState, dayDate, filterArticles, jstDate } from "../src/calendar.mjs";

const articles = [
  { id: "a", date: "2026-12-01", title: "数学の話", author: "Alice" },
  { id: "b", date: "2026-12-01", title: "別の記事", author: "Bob" },
  { id: "c", date: "2026-12-25", title: "最終日の記事", author: "Carol" },
];

test("JST midnight, including December 25, determines publication", () => {
  const before = calendarState(2026, articles, new Date("2026-11-30T14:59:59.999Z"));
  assert.equal(before.openedDays, 0);
  assert.equal(before.daysUntilStart, 1);
  assert.deepEqual(before.published, []);
  const after = calendarState(2026, articles, new Date("2026-11-30T15:00:00Z"));
  assert.equal(after.today, "2026-12-01");
  assert.equal(after.openedDays, 1);
  assert.deepEqual(after.published.map((item) => item.id), ["a", "b"]);
  assert.equal(calendarState(2026, articles, new Date("2026-12-24T14:59:59Z")).published.length, 2);
  assert.equal(calendarState(2026, articles, new Date("2026-12-24T15:00:00Z")).published.length, 3);
});

test("articles remain available after December and in subsequent years", () => {
  const state = calendarState(2026, articles, new Date("2028-03-02T00:00:00Z"));
  assert.equal(state.openedDays, 25);
  assert.equal(state.daysUntilStart, 0);
  assert.equal(state.published.length, 3);
  assert.equal(jstDate(new Date("2026-12-01T00:00:00+09:00")), "2026-12-01");
  assert.equal(dayDate(2026, 9), "2026-12-09");
});

test("filtering supports multiple articles on one day, title and normalized author search", () => {
  assert.equal(filterArticles(articles, { day: 1 }).length, 2);
  assert.equal(filterArticles(articles, { query: "数学" })[0].id, "a");
  assert.equal(filterArticles(articles, { query: " ＡＬＩＣＥ " })[0].id, "a");
  assert.equal(filterArticles(articles, { day: 25, query: "alice" }).length, 0);
});
