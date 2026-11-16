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
    <button type="button" className="day-tag flex min-h-[100px] min-w-0 flex-col items-center justify-between gap-1
      border border-[#ccc] bg-white px-1 py-2 [font:inherit] enabled:cursor-pointer
      disabled:bg-[#f5f5f5] disabled:text-[#777] aria-pressed:border-[#222] aria-pressed:bg-[#e8e8e8]
      aria-[current=date]:[outline:2px_solid_#555] aria-[current=date]:-outline-offset-2
      [@media(max-width:480px)]:min-h-[88px] [@media(max-width:480px)]:px-0.5" data-day={day} data-date={date}
      disabled={!open} aria-current={date === today ? "date" : undefined}
      aria-pressed={selected} aria-label={`12月${day}日：${open ? `${count}件の記事` : "公開前"}`}
      onClick={() => onSelect(day)}>
      <span className="font-bold">{day}</span>
      {open && count > 0 && (
        <span className="relative">
          <img className="block size-8 rounded-[50%] object-cover [@media(max-width:480px)]:size-6" src={articles[0].icon} alt="" width="64" height="64" />
          {count > 1 && <span className="more-authors absolute -top-1 -right-2.5 border border-[#ccc] bg-white px-0.5 py-0 text-[0.7rem]">+{count - 1}</span>}
        </span>
      )}
      <span className="text-[0.75rem] [@media(max-width:480px)]:text-[0.625rem]">{!open ? "公開前" : count ? `${count}件` : "準備中"}</span>
    </button>
  );
}
