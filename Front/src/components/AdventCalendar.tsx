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
    // 検索フォームはヘッダー（静的HTML）にあるため、入力と送信をDOMイベントで受け取る。
    // URL復元より先に実行し、日付リンクで開いた場合は readHash の検索解除を優先させる。
    const form = document.getElementById("article-search-form");
    const input = document.getElementById("article-search");
    if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) return;
    // ハイドレーション前の入力や、ブラウザが復元した値を取り込む。
    setQuery(input.value);
    const onInput = () => setQuery(input.value);
    // 送信ではページ遷移せず、ヘッダーから記事一覧へ移動する。
    const onSubmit = (event: SubmitEvent) => {
      event.preventDefault();
      setScrollTarget({ id: "articles" });
    };
    input.addEventListener("input", onInput);
    form.addEventListener("submit", onSubmit);
    return () => {
      input.removeEventListener("input", onInput);
      form.removeEventListener("submit", onSubmit);
    };
  }, []);

  useEffect(() => {
    // 日付選択などで検索条件が変わったら、ヘッダーの入力欄へ反映する。
    const input = document.getElementById("article-search");
    if (input instanceof HTMLInputElement && input.value !== query) input.value = query;
  }, [query]);

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
        query={query} today={today} />
    </>
  );
}
