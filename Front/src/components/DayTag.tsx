// Port of Daytag in tori3-po4/wathematica-advent2025/app/calendar.tsx.
// Retains the day number, first author icon and +N badge. See THIRD_PARTY_NOTICES.md.
import { dayDate } from "../calendar.mjs";
import type { Article } from "../types";

interface Props {
  year: number;
  day: number;
  articles: Article[];
  today: string | null;
  selected: boolean;
  onSelect: (day: number) => void;
}

export default function DayTag({ year, day, articles, today, selected, onSelect }: Props) {
  const date = dayDate(year, day);
  const open = today !== null && date <= today;
  const count = articles.length;
  return (
    <button type="button" className="day-tag" data-day={day} data-date={date}
      disabled={!open} aria-current={date === today ? "date" : undefined}
      aria-pressed={selected} aria-label={`12月${day}日：${open ? `${count}件の記事` : "公開前"}`}
      onClick={() => onSelect(day)}>
      <span className="day-number">{day}</span>
      {open && count > 0 && (
        <span className="day-icons">
          <img src={articles[0].icon} alt="" width="64" height="64" />
          {count > 1 && <span className="more-authors">+{count - 1}</span>}
        </span>
      )}
      <span className="day-status">{!open ? "公開前" : count ? `${count}件` : "準備中"}</span>
    </button>
  );
}
