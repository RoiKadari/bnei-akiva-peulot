/* רשימת הפעולות - חיפוש וסינון */

import { DB, label } from '../data.js';
import { esc, join, chip, empty, toTop, shortDate } from '../ui.js';
import { setParams, parseHash } from '../router.js';

const norm = (s) => String(s || '').replace(/["'׳״]/g, '').toLowerCase();

function matches(a, f) {
  if (f.day && a.day_type !== f.day) return false;
  if (f.holiday && a.holiday !== f.holiday) return false;
  if (f.topic.length && !f.topic.some((t) => (a.topics || []).includes(t))) return false;
  if (f.q) {
    const hay = norm([
      a.title, a.topic, a.goal, a.message, a.holiday, a.parasha, a.connection,
      (a.games || []).map((g) => DB.gamesById.get(g)?.name).join(' '),
      (a.topics || []).map((t) => label('topics', t)).join(' '),
    ].join(' '));
    if (!norm(f.q).split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

function readFilters(params) {
  return {
    q: params.get('q') || '',
    day: params.get('day') || '',
    holiday: params.get('holiday') || '',
    topic: (params.get('topic') || '').split(',').filter(Boolean),
  };
}

export function activityCard(a) {
  const games = (a.games || []).map((id) => DB.gamesById.get(id)?.name).filter(Boolean);
  return `<a class="card" href="#/activity/${encodeURIComponent(a.id)}">
    <div class="card__title">${esc(a.title)}</div>
    <p class="card__desc">${esc(a.goal)}</p>
    <div class="card__meta">
      ${a.day_type === 'shabbat' ? chip('🕯️ שבת', 'violet') : chip('🗓️ שלישי', 'teal')}
      ${a.holiday ? chip(a.holiday, 'gold') : ''}
      ${a.parasha ? chip(`פרשת ${a.parasha}`, 'ghost') : ''}
      ${a.date ? chip(shortDate(a.date), 'ghost') : ''}
      ${chip(`${a.duration_minutes} דק׳`, 'ghost')}
    </div>
    ${games.length ? `<p class="small muted" style="margin:8px 0 0">${esc(games.join(' ← '))}</p>` : ''}
  </a>`;
}

export function render(container, _args, params) {
  const f = readFilters(params);
  const holidays = [...new Set(DB.activities.map((a) => a.holiday).filter(Boolean))];
  const topics = DB.taxonomy?.topics || [];

  const btn = (key, val, text, pressed) =>
    `<button class="fbtn" type="button" data-key="${key}" data-val="${esc(val)}" aria-pressed="${pressed}">${esc(text)}</button>`;

  container.innerHTML = `<h1>פעולות</h1>
    <div class="filters">
      <input class="search" id="q" type="search" placeholder="חיפוש לפי נושא, חג או משחק…" value="${esc(f.q)}" aria-label="חיפוש">
      <div class="chiprow">
        ${btn('day', 'tuesday', '🗓️ שלישי', f.day === 'tuesday')}
        ${btn('day', 'shabbat', '🕯️ שבת', f.day === 'shabbat')}
        ${join(holidays, (h) => btn('holiday', h, h, f.holiday === h))}
      </div>
      <details class="more" ${f.topic.length ? 'open' : ''}>
        <summary>סינון לפי נושא${f.topic.length ? ` (${f.topic.length})` : ''}</summary>
        <div class="chiprow">${join(topics, (t) => btn('topic', t.id, t.label, f.topic.includes(t.id)))}</div>
        <div class="chiprow"><button class="fbtn fbtn--reset" type="button" data-reset>נקה מסננים</button></div>
      </details>
      <div class="filters__count" id="count"></div>
    </div>
    <div id="results"></div>`;

  const results = container.querySelector('#results');
  const count = container.querySelector('#count');

  const draw = () => {
    const cur = readFilters(parseHash().params);
    const list = DB.activities.filter((a) => matches(a, cur));
    count.textContent = `${list.length} פעולות מתוך ${DB.activities.length}`;
    results.innerHTML = list.length
      ? join(list, activityCard)
      : empty('🤷', 'לא נמצאו פעולות', 'נסו לשנות את הסינון');
  };

  const update = (fn) => { const p = parseHash().params; fn(p); setParams(p); draw(); };

  container.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-key]');
    if (b) {
      const { key, val } = b.dataset;
      update((p) => {
        if (key === 'topic') {
          const cur = (p.get(key) || '').split(',').filter(Boolean);
          const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
          if (next.length) p.set(key, next.join(',')); else p.delete(key);
        } else if (p.get(key) === val) p.delete(key);
        else p.set(key, val);
      });
      const p2 = parseHash().params;
      container.querySelectorAll(`button[data-key="${key}"]`).forEach((o) => {
        const on = key === 'topic'
          ? (p2.get('topic') || '').split(',').includes(o.dataset.val)
          : p2.get(key) === o.dataset.val;
        o.setAttribute('aria-pressed', String(on));
      });
      return;
    }
    if (ev.target.closest('[data-reset]')) {
      update((p) => { [...p.keys()].forEach((k) => p.delete(k)); });
      container.querySelectorAll('.fbtn[aria-pressed]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      container.querySelector('#q').value = '';
    }
  });

  let timer;
  container.querySelector('#q').addEventListener('input', (ev) => {
    clearTimeout(timer);
    const val = ev.target.value;
    timer = setTimeout(() => update((p) => { if (val) p.set('q', val); else p.delete('q'); }), 180);
  });

  draw();
  toTop();
}
