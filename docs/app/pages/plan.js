/* התוכנית השנתית - כל השנה לפי חודשים עבריים */

import { DB, currentWeek, planForWeek } from '../data.js';
import { esc, join, chip, shortDate, toTop, empty } from '../ui.js';

function slot(kind, cal, planSlot) {
  const isShabbat = kind === 'shabbat';
  const cls = isShabbat ? 'slot--shb' : 'slot--tue';
  const name = isShabbat ? 'שבת' : 'שלישי';

  if (cal.blocked) {
    return `<div class="slot ${cls} slot--empty">
      <div class="slot__label">${name}</div>
      <div class="slot__title">אין פעולה · ${esc(cal.blocked_reason || 'חג')}</div></div>`;
  }

  const act = planSlot?.activity_id ? DB.activitiesById.get(planSlot.activity_id) : null;
  const topic = planSlot?.topic || '';
  const body = act
    ? `<div class="slot__title">${esc(act.title)}</div>${topic ? `<div class="small muted">${esc(topic)}</div>` : ''}`
    : `<div class="slot__title">${esc(topic || 'טרם שובץ')}</div>${planSlot?.idea ? `<div class="small muted">${esc(planSlot.idea)}</div>` : ''}`;

  const inner = `<div class="slot__label">${name} · ${shortDate(cal.date)}</div>${body}`;
  return act
    ? `<a class="slot ${cls}" href="#/activity/${encodeURIComponent(act.id)}">${inner}</a>`
    : `<div class="slot ${cls} ${topic ? '' : 'slot--empty'}">${inner}</div>`;
}

export function render(container) {
  const weeks = DB.calendar?.weeks || [];
  if (!weeks.length) { container.innerHTML = empty('🗓️', 'לוח השנה עדיין לא נבנה'); return; }

  const now = currentWeek();
  const months = [];
  for (const w of weeks) {
    const last = months[months.length - 1];
    if (!last || last.name !== w.hebrew_month) months.push({ name: w.hebrew_month, weeks: [w] });
    else last.weeks.push(w);
  }

  container.innerHTML = `
    <h1>התוכנית השנתית</h1>
    <p class="muted small">שנת ${esc(DB.meta?.year_label || '')} · ${weeks.length} שבועות · לוח ישראל</p>

    ${join(months, (m) => {
    const open = m.weeks.some((w) => w.index === now?.index);
    return `<details class="month" ${open ? 'open' : ''}>
        <summary>${esc(m.name)} <span class="small muted">${m.weeks.length === 1 ? 'שבוע אחד' : `${m.weeks.length} שבועות`}</span></summary>
        <div class="month__body">
          ${join(m.weeks, (w) => {
      const p = planForWeek(w.index);
      const isNow = w.index === now?.index;
      return `<div class="week" id="week-${w.index}">
              <div class="week__head">
                <div>
                  <span class="week__num">שבוע ${w.index}${isNow ? ' · השבוע' : ''}</span>
                  ${w.parasha ? chip(`פרשת ${w.parasha}`, 'ghost') : ''}
                </div>
                <span class="week__date">${esc(w.tuesday.hebrew_date)}</span>
              </div>
              ${p?.theme ? `<p class="small" style="margin:0 0 8px"><strong>${esc(p.theme)}</strong>${p.notes ? ` · <span class="muted">${esc(p.notes)}</span>` : ''}</p>` : ''}
              ${slot('tuesday', w.tuesday, p?.tuesday)}
              ${slot('shabbat', w.shabbat, p?.shabbat)}
            </div>`;
    })}
        </div>
      </details>`;
  })}
  `;

  toTop();
  if (now) {
    const el = container.querySelector(`#week-${now.index}`);
    if (el) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
  }
}
