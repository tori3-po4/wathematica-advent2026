import { useCallback, useEffect, useState } from "react";
import { filterArticles, jstDate } from "../calendar.ts";
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
  // 概要は静的生成時から表示し、本文だけを端末時計の取得後に公開判定する。
  const today = now ? jstDate(now) : null;
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [scrollTarget, setScrollTarget] = useState<{ id: string } | null>(null);
  const visibleIds = new Set(filterArticles(articles, { day: selectedDay, query }).map((article) => article.id));

  // 直接アクセスとブラウザの「戻る・進む」を、日付ボタンの操作と同じ状態へ反映する。
  const readHash = useCallback(() => {
    const hash = window.location.hash;
    const match = /^#day-(\d{1,2})$/.exec(hash);
    if (match) {
      const day = Number(match[1]);
      // 公開前の日付も選択できるが、カレンダーの範囲外は受け付けない。
      if (day < 1 || day > 25) return;
      setSelectedDay(day);
      setQuery("");
      setScrollTarget({ id: "articles" });
    } else if (hash.startsWith("#article-")) {
      const article = articles.find((item) => `#article-${item.id}` === hash);
      if (!article) return;
      // 記事への直リンクでは、既存の検索条件で目的の記事が隠れないようにする。
      setSelectedDay(null);
      setQuery("");
      setScrollTarget({ id: `article-${article.id}` });
    } else if (hash === "#articles" || !hash) {
      setSelectedDay(null);
    }
  }, [articles]);

  useEffect(() => {
    // 初期URLを復元する。本文の公開判定とは独立し、日付変更で検索条件を消さない。
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, [readHash]);

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
      <Calendar year={year} articles={articles} today={today} selectedDay={selectedDay} onSelectDay={selectDay} />
      <ArticleList articles={articles} visibleIds={visibleIds} selectedDay={selectedDay}
        query={query} onQueryChange={setQuery} today={today} />
    </>
  );
}
