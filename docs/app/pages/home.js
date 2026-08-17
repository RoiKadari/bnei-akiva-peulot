/* דף הבית - מה רלוונטי השבוע */

import { DB, currentWeek, planForWeek, upcomingHolidays, todayISO } from '../data.js';
import { esc, join, chip, shortDate, toTop } from '../ui.js';
import { gameCard } from './games.js';

function slotCard(kind, week, planSlot) {
  const isShabbat = kind === 'shabbat';
  const cal = week[kind];
  const act = planSlot?.activity_id ? DB.activitiesById.get(planSlot.activity_id) : null;
  const title = isShabbat ? 'פעולת שבת' : 'פעולת שלישי';
  const emoji = isShabbat ? '🕯️' : '🗓️';

  if (cal.blocked) {
    return `<div class="card"><div class="card__title">${emoji} ${title}</div>
      <p class="card__desc">אין פעולה השבוע: ${esc(cal.blocked_reason || 'חג')}</p></div>`;
  }

  const head = `<div class="card__title">${emoji} ${title}</div>
    <div class="card__meta" style="margin-bottom:8px">
      ${chip(`${shortDate(cal.date)} · ${esc(cal.hebrew_date)}`, 'ghost')}
      ${join(cal.events, (e) => chip(e, 'gold'))}
      ${cal.period ? chip(cal.period, 'teal') : ''}
    </div>`;

  if (!act) {
    return `<div class="card">${head}
      <p class="card__desc">${esc(planSlot?.topic ? `נושא מוצע: ${planSlot.topic}` : 'עדיין לא שובצה פעולה')}</p>
      <a class="btn btn--ghost btn--block" href="#/games${isShabbat ? '?shabbat=1' : ''}">בנו פעולה מהמאגר</a>
    </div>`;
  }

  return `<a class="card" href="#/activity/${encodeURIComponent(act.id)}">${head}
    <div style="font-weight:700;font-size:1.1rem;margin-bottom:4px">${esc(act.title)}</div>
    <p class="card__desc">${esc(act.goal)}</p>
    <div class="card__meta">${join((act.games || []).map((g) => DB.gamesById.get(g)?.name).filter(Boolean), (n) => chip(n, 'ghost'))}</div>
  </a>`;
}

export function render(container) {
  const week = currentWeek();
  const plan = week ? planForWeek(week.index) : null;
  const holidays = upcomingHolidays(3);
  const today = todayISO();
  const meta = DB.meta?.counts || {};

  const before = week && today < week.tuesday.date;
  const heroLabel = before ? 'השבוע הקרוב' : 'השבוע';

  container.innerHTML = `
    ${week ? `<div class="hero">
      <div class="hero__date">${esc(heroLabel)} · שבוע ${week.index} · ${esc(week.hebrew_month)}</div>
      <h1>${esc(plan?.theme || (week.parasha ? `פרשת ${week.parasha}` : 'שבוע חדש'))}</h1>
      <div class="hero__date">${esc(week.tuesday.hebrew_date)} - ${esc(week.shabbat.hebrew_date)}</div>
      <div class="hero__events">
        ${join([...week.tuesday.events, ...week.shabbat.events], (e) => `<span class="chip chip--live">${esc(e)}</span>`)}
        ${week.shabbat.period ? `<span class="chip chip--live">${esc(week.shabbat.period)}</span>` : ''}
      </div>
      ${plan?.theme && week.parasha ? `<p class="small" style="margin:10px 0 0;opacity:.85">פרשת ${esc(week.parasha)}</p>` : ''}
    </div>` : ''}

    ${week ? `<div class="section">
      ${slotCard('tuesday', week, plan?.tuesday)}
      ${slotCard('shabbat', week, plan?.shabbat)}
    </div>` : ''}

    ${holidays.length ? `<div class="section">
      <div class="section__head"><h2>החגים הקרובים</h2><a href="#/holidays">כל החגים</a></div>
      ${join(holidays, (h) => `<a class="card" href="#/holiday/${encodeURIComponent(h.id)}">
        <div class="card__title">${h.emoji || '✡️'} ${esc(h.name)}</div>
        <p class="card__desc">${esc(h.summary || '')}</p>
        <div class="card__meta">${chip(shortDate(h.next_date), 'gold')}${chip(`${daysUntil(h.next_date, today)}`, 'ghost')}</div>
      </a>`)}
    </div>` : ''}

    <div class="section">
      <div class="section__head"><h2>צריכים רעיון עכשיו?</h2></div>
      <div class="grid2">
        <a class="btn btn--ghost" href="#/games?shabbat=1">🕯️ משחקי שבת</a>
        <a class="btn btn--ghost" href="#/games?noequip=1">🎒 בלי ציוד</a>
        <a class="btn btn--ghost" href="#/games?dur=short">⏱️ עד 10 דקות</a>
        <a class="btn btn--ghost" href="#/games?energy=high">🔥 להוציא אנרגיה</a>
      </div>
      <div style="height:10px"></div>
      <button class="btn btn--block" type="button" id="random">🎲 הפתיעו אותי במשחק</button>
      <div id="randomBox" style="margin-top:12px"></div>
    </div>

    <div class="section">
      <div class="section__head"><h2>מה יש במאגר</h2></div>
      <dl class="facts">
        <div><dt>משחקים</dt><dd>${meta.games ?? 0}</dd></div>
        <div><dt>מתאימים לשבת</dt><dd>${meta.games_shabbat ?? 0}</dd></div>
        <div><dt>פעולות</dt><dd>${meta.activities ?? 0}</dd></div>
        <div><dt>שבועות בתוכנית</dt><dd>${meta.weeks ?? 0}</dd></div>
      </dl>
      <p class="small muted center" style="margin-top:10px">
        <a href="#/plan">לתוכנית השנתית המלאה ←</a>
      </p>
    </div>

    <p class="small muted center" style="margin:4px 0 0">
      <a href="#/about">מה זה האתר הזה ואיך בנוי כאן תוכן ←</a>
    </p>
  `;

  container.querySelector('#random')?.addEventListener('click', () => {
    const pool = DB.games;
    if (!pool.length) return;
    const g = pool[Math.floor(Math.random() * pool.length)];
    container.querySelector('#randomBox').innerHTML = gameCard(g);
  });

  toTop();
}

function daysUntil(dateStr, today) {
  const diff = Math.round((new Date(dateStr) - new Date(today)) / 86400000);
  if (diff <= 0) return 'היום';
  if (diff === 1) return 'מחר';
  if (diff < 14) return `בעוד ${diff} ימים`;
  return `בעוד ${Math.round(diff / 7)} שבועות`;
}
