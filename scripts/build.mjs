/**
 * build.mjs - מאחד את התוכן מ-/content לקבצי הנתונים של האתר ב-site/data.
 * שימוש: npm run build
 *
 * האתר עצמו קורא רק את site/data/*.json. אין שום עיבוד בזמן ריצה.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { loadContent, SITE, HEBREW_YEAR } from './lib/content.mjs';

const clean = (o) => { const { _file, ...rest } = o; return rest; };

const c = await loadContent();
const DATA = path.join(SITE, 'data');
await mkdir(DATA, { recursive: true });

const games = c.games.map(clean).sort((a, b) => a.name.localeCompare(b.name, 'he'));
const activities = c.activities.map(clean);
const holidays = c.holidays.map(clean);

// חיבור בין תוכן החג לבין התאריכים בפועל בשנה הנוכחית
const datesByKeyword = new Map();
for (const h of c.holidayDates?.holidays || []) {
  datesByKeyword.set(h.title, h);
}
for (const h of holidays) {
  h.dates_this_year = (h.calendar_titles || [])
    .map((t) => datesByKeyword.get(t))
    .filter(Boolean)
    .map((x) => ({ title: x.title, date: x.date }));

  // אם לא שויכו משחקים ידנית - בוחרים אוטומטית לפי הנושאים של החג,
  // עם גיוון משפחות ותמהיל של משחקי שבת ומשחקי שלישי
  if (!h.game_ids?.length && h.topics?.length) {
    const scored = games
      .map((g) => ({ g, score: (g.topics || []).filter((t) => h.topics.includes(t)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.g.id.localeCompare(b.g.id));
    const picked = [];
    const families = new Set();
    for (const { g } of scored) {
      if (families.has(g.game_family)) continue;
      families.add(g.game_family);
      picked.push(g.id);
      if (picked.length >= 6) break;
    }
    h.game_ids = picked;
  }
}

const files = {
  'games.json': games,
  'activities.json': activities,
  'holidays.json': holidays,
  'taxonomy.json': c.taxonomy,
  'calendar.json': c.calendar,
  'plan.json': c.plan,
  'shabbat-rules.json': c.shabbatRules,
  'meta.json': {
    hebrew_year: HEBREW_YEAR,
    year_label: c.calendar?.year_label ?? '',
    built_at: new Date().toISOString().slice(0, 10),
    counts: {
      games: games.length,
      games_shabbat: games.filter((g) => g.shabbat).length,
      activities: activities.length,
      activities_shabbat: activities.filter((a) => a.day_type === 'shabbat').length,
      holidays: holidays.length,
      weeks: c.calendar?.weeks.length ?? 0,
    },
  },
};

let total = 0;
for (const [name, data] of Object.entries(files)) {
  if (data === null || data === undefined) continue;
  const json = JSON.stringify(data);
  await writeFile(path.join(DATA, name), json, 'utf8');
  total += json.length;
  console.log(`  ${name.padEnd(20)} ${(json.length / 1024).toFixed(1)} KB`);
}

console.log('');
console.log(`✓  נבנה ל-site/data - ${(total / 1024).toFixed(0)} KB בסך הכול`);
console.log('   האתר מוכן לפריסה: התיקייה site/ היא כל מה שצריך להעלות.');
