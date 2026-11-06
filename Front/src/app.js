// Inlined after calendar.mjs by Astro. No fetch, runtime imports, or external assets.
(() => {
  const { year, articles } = JSON.parse(document.getElementById("calendar-data").textContent);
  const list = document.getElementById("article-list");
  const search = document.getElementById("article-search");
  const reset = document.getElementById("reset-filter");
  const days = [...document.querySelectorAll(".day-tag")];
  const templates = new Map([...document.querySelectorAll("template[data-article]")].map((template) => [template.dataset.article, template]));
  let selectedDay = null;
  let state;

  function updateCalendar() {
    for (const button of days) {
      const open = button.dataset.date <= state.today;
      const count = Number(button.dataset.count);
      button.disabled = !open;
      if (button.dataset.date === state.today) button.setAttribute("aria-current", "date");
      else button.removeAttribute("aria-current");
      button.setAttribute("aria-pressed", String(selectedDay === Number(button.dataset.day)));
      button.setAttribute("aria-label", `12月${button.dataset.day}日：${open ? `${count}件の記事` : "公開前"}`);
      button.querySelector(".day-icons").hidden = !open || count === 0;
      button.querySelector(".day-status").textContent = !open ? "公開前" : count ? `${count}件` : "準備中";
    }
  }

  function updateArticles() {
    const visible = filterArticles(state.published, { day: selectedDay, query: search.value });
    const visibleIds = new Set(visible.map((article) => article.id));
    for (const card of list.children) card.hidden = !visibleIds.has(card.id.slice("article-".length));
    document.getElementById("result-count").textContent = `${visible.length}件の記事`;
    const status = document.getElementById("filter-status");
    status.hidden = selectedDay === null;
    status.textContent = selectedDay ? `12月${selectedDay}日の記事を表示中` : "";
    const empty = document.getElementById("empty-state");
    empty.hidden = visible.length > 0;
    let title = "公開済みの記事はありません。";
    let description = "記事が登録されると、ここに表示されます。";
    if (search.value.trim()) {
      title = "一致する記事が見つかりませんでした。";
      description = "キーワードを変えるか、日付の絞り込みを解除してお試しください。";
    } else if (selectedDay) {
      title = `12月${selectedDay}日の記事を準備しています。`;
      description = "ほかの日付を選ぶと、公開済みの記事を読めます。";
    } else if (state.daysUntilStart > 0) {
      description = `${year}年12月1日から記事を表示します。`;
    }
    document.getElementById("empty-title").textContent = title;
    document.getElementById("empty-description").textContent = description;
    updateCalendar();
  }

  function refreshDate(force = false) {
    const next = calendarState(year, articles);
    if (!force && state?.today === next.today) return;
    state = next;
    if (selectedDay && dayDate(year, selectedDay) > state.today) selectedDay = null;
    // Reconcile without replacing open article bodies or the current keyboard focus.
    const publishedIds = new Set(state.published.map((article) => article.id));
    for (const card of [...list.children]) if (!publishedIds.has(card.id.slice(8))) card.remove();
    for (const article of state.published) {
      if (!document.getElementById(`article-${article.id}`)) list.append(templates.get(article.id).content.cloneNode(true));
    }
    updateArticles();
  }

  function readHash(scroll = true) {
    const match = /^#day-(\d{1,2})$/.exec(location.hash);
    if (match) {
      const day = Number(match[1]);
      if (day >= 1 && day <= 25 && dayDate(year, day) <= state.today) {
        selectedDay = day;
        search.value = "";
        updateArticles();
        if (scroll) document.getElementById("articles").scrollIntoView();
      }
    } else if (location.hash.startsWith("#article-")) {
      const article = state.published.find((item) => `#article-${item.id}` === location.hash);
      if (!article) return;
      selectedDay = null;
      search.value = "";
      updateArticles();
      const card = document.getElementById(`article-${article.id}`);
      const details = card.querySelector("details");
      if (details) details.open = true;
      if (scroll) { card.scrollIntoView(); card.focus({ preventScroll: true }); }
    } else if (location.hash === "#articles" || !location.hash) {
      selectedDay = null;
      updateArticles();
    }
  }

  for (const button of days) button.addEventListener("click", () => {
    const hash = `#day-${button.dataset.day}`;
    if (location.hash === hash) readHash();
    else location.hash = hash;
  });
  reset.addEventListener("click", () => {
    selectedDay = null;
    search.value = "";
    updateArticles();
    location.hash = "articles";
  });
  search.addEventListener("input", updateArticles);
  window.addEventListener("hashchange", () => readHash());
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshDate(); });
  window.addEventListener("pageshow", () => refreshDate());
  refreshDate(true);
  readHash();
  // This timer only reads the local clock; it performs no network requests.
  setInterval(() => refreshDate(), 1000);
})();
