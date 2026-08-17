/* דף פעולה בודדת - זה המסך שהמדריך פותח בסניף */

import { DB, label } from '../data.js';
import { esc, join, chip, empty, backLink, toTop, shortDate, dayName } from '../ui.js';

export function render(container, [id]) {
  const a = DB.activitiesById.get(id);
  if (!a) { container.innerHTML = empty('🔍', 'הפעולה לא נמצאה'); return; }

  const games = (a.games || []).map((gid) => DB.gamesById.get(gid)).filter(Boolean);
  const equipment = a.equipment?.length
    ? a.equipment
    : [...new Set(games.flatMap((g) => g.equipment || []))].filter((e) => e !== 'ללא ציוד');
  const total = a.duration_minutes || games.reduce((n, g) => n + g.duration_minutes, 0) + 15;

  const step = (g, i) => `
    <div class="flow__step">
      <div class="flow__num">${i + 1}</div>
      <div class="flow__body">
        <a class="card" href="#/game/${encodeURIComponent(g.id)}" style="margin-bottom:6px">
          <div class="card__title">${esc(g.name)}</div>
          <p class="card__desc">${esc(g.description)}</p>
          <div class="card__meta">
            ${chip(`⏱️ ${g.duration_minutes} דק׳`, 'ghost')}
            ${chip(label('energy_level', g.energy_level), 'gold')}
            ${chip(label('group_structure', g.group_structure), 'teal')}
          </div>
        </a>
      </div>
    </div>
    ${i < games.length - 1 ? '<div class="flow__line"><span></span></div>' : ''}`;

  container.innerHTML = `
    ${backLink('#/activities', 'חזרה לפעולות')}
    <h1 class="page__title">${esc(a.title)}</h1>
    <div class="badges">
      ${a.day_type === 'shabbat' ? chip('🕯️ פעולת שבת', 'violet') : chip('🗓️ פעולת שלישי', 'teal')}
      ${a.date ? chip(`יום ${dayName(a.date)} ${shortDate(a.date)}`, 'ghost') : ''}
      ${a.holiday ? chip(a.holiday, 'gold') : ''}
      ${a.parasha ? chip(`פרשת ${a.parasha}`, 'ghost') : ''}
      ${chip(`⏱️ ${total} דקות`, 'ghost')}
    </div>

    <div class="panel">
      <h3>🎯 מטרת הפעולה</h3>
      <p style="margin:0">${esc(a.goal)}</p>
    </div>

    <div class="section">
      <div class="section__head"><h2>מהלך הפעולה</h2></div>
      <div class="flow">${games.map(step).join('')}</div>
    </div>

    ${a.connection ? `<div class="panel">
      <h3>🔗 איך המשחקים מתחברים</h3>
      <p style="margin:0">${esc(a.connection)}</p>
    </div>` : ''}

    <div class="message-box">
      <h3>💬 המסר</h3>
      <p>${esc(a.message)}</p>
    </div>

    ${(a.discussion_questions || []).length ? `<div class="panel">
      <h3>שאלות לשיחה</h3>
      <ul class="steps">${join(a.discussion_questions, (q) => `<li>${esc(q)}</li>`)}</ul>
    </div>` : ''}

    <div class="panel">
      <h3>🎒 ציוד לפעולה</h3>
      <p style="margin:0">${esc(equipment.length ? equipment.join(', ') : 'לא צריך שום ציוד')}</p>
      ${a.preparation ? `<p class="small muted" style="margin:8px 0 0"><strong>הכנה מראש:</strong> ${esc(a.preparation)}</p>` : ''}
    </div>

    ${(a.sources || []).length ? `<div class="panel">
      <h3>📖 מקורות</h3>
      <ul class="steps">${join(a.sources, (s) => `<li>${esc(s.text)}${s.ref ? ` <span class="muted small">(${esc(s.ref)})</span>` : ''}</li>`)}</ul>
    </div>` : ''}

    ${(a.topics || []).length ? `<div class="card__meta" style="margin-bottom:20px">
      ${join(a.topics, (t) => `<a class="chip chip--teal" href="#/activities?topic=${encodeURIComponent(t)}">${esc(label('topics', t))}</a>`)}
    </div>` : ''}

    ${a.day_type === 'shabbat' ? `<div class="note"><strong>🕯️ פעולת שבת</strong>
      כל המשחקים בפעולה הזאת נבדקו ואינם כוללים כתיבה, יצירה, טכנולוגיה או ציוד שאינו מתאים לשבת.</div>` : ''}
  `;
  toTop();
}
