/* דף משחק בודד */

import { DB, label, labelEmoji } from '../data.js';
import { esc, join, chip, empty, backLink, toTop } from '../ui.js';

export function render(container, [id]) {
  const g = DB.gamesById.get(id);
  if (!g) { container.innerHTML = empty('🔍', 'המשחק לא נמצא'); return; }

  const users = DB.activities.filter((a) => (a.games || []).includes(g.id));

  container.innerHTML = `
    ${backLink('#/games', 'חזרה למאגר')}
    <h1 class="page__title">${esc(g.name)}</h1>
    <div class="badges">
      ${g.shabbat ? chip('🕯️ מתאים לשבת', 'violet') : chip('🗓️ שלישי בלבד', 'teal')}
      ${chip(`⏱️ ${g.duration_minutes} דקות`, 'gold')}
      ${join(g.categories, (c) => chip(labelEmoji('categories', c)))}
      ${g.competitive ? chip('תחרותי', 'ghost') : chip('לא תחרותי', 'ghost')}
      ${g.physical_contact ? chip('כולל מגע', 'ghost') : ''}
    </div>

    <p>${esc(g.description)}</p>

    <div class="panel">
      <h3>איך משחקים</h3>
      <ol class="steps">${join(g.instructions, (s) => `<li>${esc(s)}</li>`)}</ol>
    </div>

    <dl class="facts">
      <div><dt>משתתפים</dt><dd>${g.min_participants}-${g.max_participants}</dd></div>
      <div><dt>גילאים</dt><dd>${g.age_min}-${g.age_max}</dd></div>
      <div><dt>מבנה</dt><dd>${esc(label('group_structure', g.group_structure))}</dd></div>
      <div><dt>מקום</dt><dd>${esc(label('location', g.location))}</dd></div>
      <div><dt>אנרגיה</dt><dd>${esc(labelEmoji('energy_level', g.energy_level))}</dd></div>
      <div><dt>משפחת משחק</dt><dd style="font-size:.85rem">${esc(label('game_family', g.game_family))}</dd></div>
    </dl>

    <div class="panel">
      <h3>ציוד והכנה</h3>
      <p><strong>ציוד:</strong> ${esc((g.equipment || []).join(', ') || 'ללא ציוד')}</p>
      <p style="margin:0"><strong>הכנה:</strong> ${esc(g.preparation || 'אין צורך בהכנה')}</p>
    </div>

    ${g.notes ? `<div class="note"><strong>💡 טיפ למדריך</strong>${esc(g.notes)}</div>` : ''}

    ${g.madrichim_roles ? `<div class="panel"><h3>חלוקת תפקידים בין המדריכים</h3><p style="margin:0">${esc(g.madrichim_roles)}</p></div>` : ''}

    ${(g.variations || []).length ? `<div class="panel"><h3>ווריאציות</h3>
      <ul class="steps">${join(g.variations, (v) => `<li>${esc(v)}</li>`)}</ul></div>` : ''}

    ${(g.educational_goals || []).length ? `<div class="panel"><h3>מה החניכים לוקחים מזה</h3>
      <ul class="steps">${join(g.educational_goals, (v) => `<li>${esc(v)}</li>`)}</ul>
      <div class="card__meta" style="margin-top:8px">${join(g.topics, (t) => `<a class="chip chip--teal" href="#/games?topic=${encodeURIComponent(t)}">${esc(label('topics', t))}</a>`)}</div>
    </div>` : ''}

    ${!g.shabbat && g.shabbat_reason ? `<div class="note note--warn"><strong>לא מתאים לשבת</strong>${esc(g.shabbat_reason)}</div>` : ''}

    ${users.length ? `<div class="section" style="margin-top:20px">
      <div class="section__head"><h2>פעולות שמשתמשות במשחק</h2></div>
      ${join(users, (a) => `<a class="card" href="#/activity/${encodeURIComponent(a.id)}">
        <div class="card__title">${esc(a.title)}</div>
        <div class="card__meta">${a.day_type === 'shabbat' ? chip('שבת', 'violet') : chip('שלישי', 'teal')}${chip(a.topic, 'ghost')}</div>
      </a>`)}
    </div>` : ''}
  `;
  toTop();
}
