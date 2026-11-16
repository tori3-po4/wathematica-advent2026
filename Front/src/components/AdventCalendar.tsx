import { useCallback, useEffect, useRef, useState } from "react";
import { calendarState, dayDate, filterArticles } from "../calendar.mjs";
import { useCalendarDate } from "../hooks/useCalendarDate";
import type { Article } from "../types";
import Calendar from "./Calendar";
import ArticleList from "./ArticleList";

/**
 * ビルド時に受け取った記事と、ブラウザ上の日付・検索・URLハッシュを結び付ける。
 * 子コンポーネントには表示に必要な値と操作を渡し、絞り込みの状態はここに集約する。
 */
export default function AdventCalendar({ year, articles }: { year: number; articles: Article[] }) {
  const now = useCalendarDate();
  // 静的生成時とブラウザの初回描画では日付が未確定。端末時計の取得後に公開判定する。
  const state = now ? calendarState(year, articles, now) : null;
  const today = state?.today ?? null;
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [scrollTarget, setScrollTarget] = useState<{ id: string } | null>(null);
  const initialized = useRef(false);
  // 端末時計が過去へ戻った場合も、未公開になった日付で絞り込まない。
  const activeDay = selectedDay && today && dayDate(year, selectedDay) <= today ? selectedDay : null;
  const published = state?.published ?? [];
  // 公開判定と検索を分け、公開済みの記事だけを検索対象にする。
  const visibleIds = new Set(filterArticles(published, { day: activeDay, query }).map((article) => article.id));

  // 直接アクセスとブラウザの「戻る・進む」を、日付ボタンの操作と同じ状態へ反映する。
  const readHash = useCallback(() => {
    if (!today) return;
    const hash = window.location.hash;
    const match = /^#day-(\d{1,2})$/.exec(hash);
    if (match) {
      const day = Number(match[1]);
      // URLを手入力しても、範囲外・公開前の日付は選択できないようにする。
      if (day < 1 || day > 25 || dayDate(year, day) > today) return;
      setSelectedDay(day);
      setQuery("");
      setScrollTarget({ id: "articles" });
    } else if (hash.startsWith("#article-")) {
      const article = articles.find((item) => `#article-${item.id}` === hash && item.date <= today);
      if (!article) return;
      // 記事への直リンクでは、既存の検索条件で目的の記事が隠れないようにする。
      setSelectedDay(null);
      setQuery("");
      setScrollTarget({ id: `article-${article.id}` });
    } else if (hash === "#articles" || !hash) {
      setSelectedDay(null);
    }
  }, [today, year, articles]);

  useEffect(() => {
    if (!today) return;
    // 初期URLの復元は日付確定後の一度だけ。日付変更のたびに検索条件を消さない。
    if (!initialized.current) {
      initialized.current = true;
      readHash();
    }
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, [today, readHash]);

  useEffect(() => {
    // 表示上の activeDay だけでなく選択stateも消し、時計を戻しても選択が復活しないようにする。
    if (today && selectedDay && dayDate(year, selectedDay) > today) setSelectedDay(null);
  }, [today, year, selectedDay]);

  useEffect(() => {
    // 絞り込み解除がDOMへ反映されてから移動する。
    if (!scrollTarget) return;
    const target = document.getElementById(scrollTarget.id);
    if (!target) return;
    target.scrollIntoView();
    // キーボードや読み上げでも、直リンク先の記事から読み進められるようにする。
    if (scrollTarget.id.startsWith("article-")) target.focus({ preventScroll: true });
  }, [scrollTarget]);

  const selectDay = (day: number) => {
    const hash = `#day-${day}`;
    // 同じ日を再選択すると hashchange が発火しないため、検索解除とスクロールを直接実行する。
    // readHash 内で移動先を毎回新しいオブジェクトにするのも、同じ移動を再実行するため。
    if (window.location.hash === hash) readHash();
    else window.location.hash = hash;
  };

  return (
    <>
      <Calendar year={year} articles={articles} today={today} selectedDay={activeDay} onSelectDay={selectDay} />
      <ArticleList year={year} articles={published} visibleIds={visibleIds} selectedDay={activeDay}
        query={query} onQueryChange={setQuery}
        beforeStart={!state || state.daysUntilStart > 0} />
    </>
  );
}
