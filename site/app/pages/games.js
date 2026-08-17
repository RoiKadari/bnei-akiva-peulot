/* מאגר המשחקים - חיפוש וסינון */

import { DB, label, labelEmoji } from '../data.js';
import { esc, join, chip, empty, toTop } from '../ui.js';
import { setParams, parseHash } from '../router.js';

const DURATION_BUCKETS = {
  short: { label: '≤ 10 דק׳', test: (g) => g.duration_minutes <= 10 },
  mid: { label: '11-20 דק׳', test: (g) => g.duration_minutes > 10 && g.duration_minutes <= 20 },
  long: { label: '20+ דק׳', test: (g) => g.duration_minutes > 20 },
};

const norm = (s) => String(s || '').replace(/["'׳״]/g, '').toLowerCase();

function matches(g, f) {
  if (f.shabbat && !g.shabbat) return false;
  if (f.noequip && !(g.equipment || []).every((e) => e === 'ללא ציוד')) return false;
  if (f.dur && !DURATION_BUCKETS[f.dur]?.test(g)) return false;
  if (f.loc && g.location !== f.loc && g.location !== 'both') return false;
  if (f.cat.length && !f.cat.some((c) => (g.categories || []).includes(c))) return false;
  if (f.energy.length && !f.energy.includes(g.energy_level)) return false;
  if (f.structure.length && !f.structure.includes(g.group_structure)) return false;
  if (f.topic.length && !f.topic.some((t) => (g.topics || []).includes(t))) return false;
  if (f.q) {
    const hay = norm([
      g.name, g.description, (g.instructions || []).join(' '), (g.equipment || []).join(' '),
      (g.topics || []).map((t) => label('topics', t)).join(' '),
      (g.categories || []).map((c) => label('categories', c)).join(' '),
      label('game_family', g.game_family),
      (g.educational_goals || []).join(' '),
      g.notes,
    ].join(' '));
    if (!norm(f.q).split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

function readFilters(params) {
  const list = (k) => (params.get(k) || '').split(',').filter(Boolean);
  return {
    q: params.get('q') || '',
    shabbat: params.get('shabbat') === '1',
    noequip: params.get('noequip') === '1',
    dur: params.get('dur') || '',
    loc: params.get('loc') || '',
    cat: list('cat'),
    energy: list('energy'),
    structure: list('structure'),
    topic: list('topic'),
    shuffle: params.get('shuffle') === '1',
  };
}

export function gameCard(g) {
  return `<a class="card" href="#/game/${encodeURIComponent(g.id)}">
    <div class="card__title">${esc(g.name)}</div>
    <p class="card__desc">${esc(g.description)}</p>
    <div class="card__meta">
      ${g.shabbat ? chip('🕯️ שבת', 'violet') : chip('שלישי', 'ghost')}
      ${chip(`⏱️ ${g.duration_minutes} דק׳`, 'ghost')}
      ${chip(labelEmoji('energy_level', g.energy_level), 'gold')}
      ${chip(label('group_structure', g.group_structure), 'teal')}
      ${(g.equipment || []).includes('ללא ציוד') ? chip('ללא ציוד', 'ghost') : ''}
    </div>
  </a>`;
}

function filterBar(f) {
  const btn = (key, val, text, pressed) =>
    `<button class="fbtn" type="button" data-key="${key}" data-val="${esc(val)}" aria-pressed="${pressed}">${esc(text)}</button>`;

  const cats = DB.taxonomy?.categories || [];
  const energies = DB.taxonomy?.energy_level || [];
  const structures = DB.taxonomy?.group_structure || [];
  const topics = DB.taxonomy?.topics || [];
  const active = f.cat.length + f.energy.length + f.structure.length + f.topic.length
    + (f.dur ? 1 : 0) + (f.loc ? 1 : 0);

  return `<div class="filters">
    <input class="search" id="q" type="search" inputmode="search" placeholder="חיפוש משחק, נושא או ציוד…" value="${esc(f.q)}" aria-label="חיפוש">
    <div class="chiprow">
      ${btn('shabbat', '1', '🕯️ מתאים לשבת', f.shabbat)}
      ${btn('noequip', '1', '🎒 ללא ציוד', f.noequip)}
      ${join(Object.entries(DURATION_BUCKETS), ([k, v]) => btn('dur', k, `⏱️ ${v.label}`, f.dur === k))}
      ${btn('loc', 'outdoor', '🌳 בחוץ', f.loc === 'outdoor')}
      ${btn('loc', 'indoor', '🏠 בפנים', f.loc === 'indoor')}
    </div>
    <details class="more" ${active ? 'open' : ''}>
      <summary>עוד מסננים${active ? ` (${active} פעילים)` : ''}</summary>
      <div class="small muted" style="margin-top:6px">סוג משחק</div>
      <div class="chiprow">${join(cats, (c) => btn('cat', c.id, `${c.emoji} ${c.label}`, f.cat.includes(c.id)))}</div>
      <div class="small muted">רמת אנרגיה</div>
      <div class="chiprow">${join(energies, (e) => btn('energy', e.id, `${e.emoji} ${e.label}`, f.energy.includes(e.id)))}</div>
      <div class="small muted">מבנה קבוצות</div>
      <div class="chiprow">${join(structures, (s) => btn('structure', s.id, s.label, f.structure.includes(s.id)))}</div>
      <div class="small muted">נושא חינוכי</div>
      <div class="chiprow">${join(topics, (t) => btn('topic', t.id, t.label, f.topic.includes(t.id)))}</div>
      <div class="chiprow" style="margin-top:8px">
        <button class="fbtn fbtn--reset" type="button" data-reset>נקה את כל המסננים</button>
        <button class="fbtn" type="button" data-shuffle aria-pressed="${f.shuffle}">🔀 ערבב לי</button>
      </div>
    </details>
    <div class="filters__count" id="count"></div>
  </div>`;
}

function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function render(container, _args, params) {
  const f = readFilters(params);
  container.innerHTML = `<h1>מאגר המשחקים</h1>${filterBar(f)}<div id="results"></div>`;

  const results = container.querySelector('#results');
  const count = container.querySelector('#count');

  const draw = () => {
    const cur = readFilters(parseHash().params);
    let list = DB.games.filter((g) => matches(g, cur));
    if (cur.shuffle) list = shuffled(list);
    count.textContent = `${list.length} משחקים מתוך ${DB.games.length}`;
    results.innerHTML = list.length
      ? join(list, gameCard)
      : empty('🤷', 'לא נמצאו משחקים', 'נסו להוריד כמה מסננים או לחפש מילה אחרת');
  };

  const update = (fn) => {
    const p = parseHash().params;
    fn(p);
    setParams(p);
    draw();
  };

  container.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-key]');
    if (b) {
      const { key, val } = b.dataset;
      const multi = ['cat', 'energy', 'structure', 'topic'].includes(key);
      update((p) => {
        if (multi) {
          const cur = (p.get(key) || '').split(',').filter(Boolean);
          const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
          if (next.length) p.set(key, next.join(',')); else p.delete(key);
        } else if (p.get(key) === val) p.delete(key);
        else p.set(key, val);
      });
      b.setAttribute('aria-pressed', String(!(b.getAttribute('aria-pressed') === 'true')));
      if (['cat', 'energy', 'structure', 'topic', 'dur', 'loc'].includes(b.dataset.key)) {
        // עדכון מצב שאר הכפתורים באותה קבוצה כשהבחירה יחידה
        if (!['cat', 'energy', 'structure', 'topic'].includes(b.dataset.key)) {
          container.querySelectorAll(`button[data-key="${b.dataset.key}"]`).forEach((o) => {
            if (o !== b) o.setAttribute('aria-pressed', 'false');
          });
        }
      }
      return;
    }
    if (ev.target.closest('[data-reset]')) {
      update((p) => { [...p.keys()].forEach((k) => p.delete(k)); });
      container.querySelectorAll('.fbtn[aria-pressed]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      container.querySelector('#q').value = '';
      return;
    }
    if (ev.target.closest('[data-shuffle]')) {
      const on = parseHash().params.get('shuffle') === '1';
      update((p) => { if (on) p.delete('shuffle'); else p.set('shuffle', '1'); });
      ev.target.closest('[data-shuffle]').setAttribute('aria-pressed', String(!on));
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
