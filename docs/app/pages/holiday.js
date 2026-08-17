/* דף חג בודד */

import { DB, activitiesForHoliday } from '../data.js';
import { esc, join, chip, empty, backLink, shortDate, dayName, toTop } from '../ui.js';
import { gameCard } from './games.js';
import { activityCard } from './activities.js';

export function render(container, [id]) {
  const h = DB.holidaysById.get(id);
  if (!h) { container.innerHTML = empty('🔍', 'החג לא נמצא'); return; }

  const games = (h.game_ids || []).map((g) => DB.gamesById.get(g)).filter(Boolean);
  const activities = activitiesForHoliday(h);

  container.innerHTML = `
    ${backLink('#/holidays', 'חזרה לחגים')}
    <h1 class="page__title">${h.emoji || '✡️'} ${esc(h.name)}</h1>
    <div class="badges">
      ${h.hebrew_date ? chip(h.hebrew_date, 'gold') : ''}
      ${join(h.dates_this_year, (d) => chip(`${d.title}: יום ${dayName(d.date)} ${shortDate(d.date)}`, 'ghost'))}
    </div>

    ${h.summary ? `<p>${esc(h.summary)}</p>` : ''}
    ${h.background ? `<div class="panel"><h3>רקע קצר</h3><p style="margin:0">${esc(h.background)}</p></div>` : ''}

    ${(h.topic_ideas || []).length ? `<div class="panel">
      <h3>💡 רעיונות לנושאי פעולה</h3>
      ${join(h.topic_ideas, (t) => `<div style="margin-bottom:12px">
        <strong>${esc(t.title)}</strong>
        <p class="small muted" style="margin:2px 0 0">${esc(t.description)}</p>
      </div>`)}
    </div>` : ''}

    ${(h.message_ideas || []).length ? `<div class="panel">
      <h3>💬 רעיונות למסרים</h3>
      <ul class="steps">${join(h.message_ideas, (m) => `<li>${esc(m)}</li>`)}</ul>
    </div>` : ''}

    ${h.shabbat_note ? `<div class="note"><strong>🕯️ אם החג חל בשבת</strong>${esc(h.shabbat_note)}</div>` : ''}

    ${activities.length ? `<div class="section" style="margin-top:20px">
      <div class="section__head"><h2>פעולות לחג</h2></div>
      ${join(activities, activityCard)}
    </div>` : ''}

    ${games.length ? `<div class="section">
      <div class="section__head"><h2>משחקים מתאימים</h2></div>
      ${join(games, gameCard)}
    </div>` : ''}

    ${(h.sources || []).length ? `<div class="panel">
      <h3>📖 מקורות</h3>
      <ul class="steps">${join(h.sources, (s) => `<li>${esc(s.text)}${s.ref ? ` <span class="muted small">(${esc(s.ref)})</span>` : ''}</li>`)}</ul>
    </div>` : ''}
  `;
  toTop();
}
