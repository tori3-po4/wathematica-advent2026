import { useCallback, useEffect, useRef, useState } from "react";
import { calendarState, dayDate, filterArticles } from "../calendar.mjs";
import { useCalendarDate } from "../hooks/useCalendarDate";
import type { Article } from "../types";
import Calendar from "./Calendar";
import ArticleList from "./ArticleList";

export default function AdventCalendar({ year, articles }: { year: number; articles: Article[] }) {
  const now = useCalendarDate();
  const state = now ? calendarState(year, articles, now) : null;
  const today = state?.today ?? null;
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [scrollTarget, setScrollTarget] = useState<{ id: string } | null>(null);
  const initialized = useRef(false);
  const activeDay = selectedDay && today && dayDate(year, selectedDay) <= today ? selectedDay : null;
  const published = state?.published ?? [];
  const visibleIds = new Set(filterArticles(published, { day: activeDay, query }).map((article) => article.id));

  const readHash = useCallback(() => {
    if (!today) return;
    const hash = window.location.hash;
    const match = /^#day-(\d{1,2})$/.exec(hash);
    if (match) {
      const day = Number(match[1]);
      if (day < 1 || day > 25 || dayDate(year, day) > today) return;
      setSelectedDay(day);
      setQuery("");
      setScrollTarget({ id: "articles" });
    } else if (hash.startsWith("#article-")) {
      const article = articles.find((item) => `#article-${item.id}` === hash && item.date <= today);
      if (!article) return;
      setSelectedDay(null);
      setQuery("");
      setScrollTarget({ id: `article-${article.id}` });
    } else if (hash === "#articles" || !hash) {
      setSelectedDay(null);
    }
  }, [today, year, articles]);

  useEffect(() => {
    if (!today) return;
    if (!initialized.current) {
      initialized.current = true;
      readHash();
    }
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, [today, readHash]);

  useEffect(() => {
    if (today && selectedDay && dayDate(year, selectedDay) > today) setSelectedDay(null);
  }, [today, year, selectedDay]);

  useEffect(() => {
    if (!scrollTarget) return;
    const target = document.getElementById(scrollTarget.id);
    if (!target) return;
    if (scrollTarget.id.startsWith("article-")) {
      const details = target.querySelector("details");
      if (details) details.open = true;
    }
    target.scrollIntoView();
    if (scrollTarget.id.startsWith("article-")) target.focus({ preventScroll: true });
  }, [scrollTarget]);

  const selectDay = (day: number) => {
    const hash = `#day-${day}`;
    if (window.location.hash === hash) readHash();
    else window.location.hash = hash;
  };
  const reset = () => {
    setSelectedDay(null);
    setQuery("");
    window.location.hash = "articles";
  };

  return (
    <>
      <Calendar year={year} articles={articles} today={today} selectedDay={activeDay} onSelectDay={selectDay} />
      <ArticleList year={year} articles={published} visibleIds={visibleIds} selectedDay={activeDay}
        query={query} onQueryChange={setQuery} onReset={reset}
        beforeStart={!state || state.daysUntilStart > 0} />
    </>
  );
}
