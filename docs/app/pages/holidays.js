/* רשימת חגים ומועדים */

import { DB, todayISO } from '../data.js';
import { esc, join, chip, shortDate, empty, toTop } from '../ui.js';

export function render(container) {
  if (!DB.holidays.length) { container.innerHTML = empty('✡️', 'תוכן החגים עדיין לא נבנה'); return; }
  const today = todayISO();

  const withDates = DB.holidays.map((h) => {
    const dates = (h.dates_this_year || []).map((d) => d.date).sort();
    const next = dates.find((d) => d >= today) || dates[0] || '';
    return { ...h, next, passed: next && next < today };
  }).sort((a, b) => {
    const an = a.next >= today ? 0 : 1;
    const bn = b.next >= today ? 0 : 1;
    return an - bn || a.next.localeCompare(b.next);
  });

  container.innerHTML = `
    <h1>חגים ומועדים</h1>
    <p class="muted small">לכל חג: רעיונות לנושאים, מסרים, משחקים מתאימים ופעולות לדוגמה.</p>
    ${join(withDates, (h) => `<a class="card" href="#/holiday/${encodeURIComponent(h.id)}">
      <div class="card__title">${h.emoji || '✡️'} ${esc(h.name)}</div>
      <p class="card__desc">${esc(h.summary || '')}</p>
      <div class="card__meta">
        ${h.next ? chip(shortDate(h.next), h.passed ? 'ghost' : 'gold') : ''}
        ${h.hebrew_date ? chip(h.hebrew_date, 'ghost') : ''}
        ${(h.topic_ideas || []).length ? chip(`${h.topic_ideas.length} רעיונות לנושא`, 'teal') : ''}
      </div>
    </a>`)}
  `;
  toTop();
}
