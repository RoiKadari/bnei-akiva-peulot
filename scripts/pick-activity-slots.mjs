/**
 * pick-activity-slots.mjs - בוחר לאילו מועדים בתוכנית תיכתב פעולה מלאה לדוגמה.
 *
 * למה זה נחוץ: הכלל הוא שאותו משחק לא חוזר בתוך 26 שבועות.
 * כל פעולה צורכת 3 משחקים, ולכן מספר הפעולות בכל רבע שנה מוגבל בגודל מאגר המשחקים.
 * יותר מדי פעולות = הכותב נאלץ לקחת את המשחק שנשאר במקום את המשחק הנכון.
 *
 * הסקריפט מסמן activity_priority=1 למכסה קבועה לכל רבע שנה ולכל סוג יום,
 * ונותן עדיפות למועדים שיש בהם חג או ציון מיוחד. השאר יורדים ל-2.
 *
 * שימוש: node scripts/pick-activity-slots.mjs [--per-slice 5]
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CONTENT, HEBREW_YEAR } from './lib/content.mjs';

const argIdx = process.argv.indexOf('--per-slice');
const PER_SLICE_PER_DAY = argIdx > -1 ? Number(process.argv[argIdx + 1]) : 5;

const SLICES = [[1, 13], [14, 26], [27, 39], [40, 53]];

// מועדים שחייבים פעולה כתובה גם אם המכסה של אותו רבע כבר מלאה.
// הם נוספים מעל המכסה ולא במקום מועד אחר.
// שבוע 36: יום השואה. שבוע 37: יום הזיכרון וערב יום העצמאות.
const FORCE = [[36, 'tuesday'], [37, 'tuesday'], [37, 'shabbat']];

// מועדים שראוי שתהיה להם פעולה כתובה
const LANDMARKS = [
  'ראש השנה', 'יום כיפור', 'סוכות', 'שמחת תורה', 'שמיני עצרת', 'חנוכה', 'ט״ו בשבט',
  'פורים', 'פסח', 'יום השואה', 'יום הזכרון', 'יום העצמאות', 'יום ירושלים', 'שבועות',
  'תשעה באב', 'ל״ג בעומר', 'שבת שובה', 'שבת חזון', 'שבת נחמו', 'שבת זכור', 'שבת הגדול',
];

const planPath = path.join(CONTENT, 'calendar', `plan-${HEBREW_YEAR}.json`);
const plan = JSON.parse(await readFile(planPath, 'utf8'));

const score = (slot) => {
  const text = (slot.calendar_events || []).join(' ');
  return LANDMARKS.some((l) => text.includes(l)) ? 1 : 0;
};

/** בחירה חמדנית: קודם מועדי ציון, ואז פיזור מרבי על פני השבועות */
function pick(cands, n) {
  const chosen = [];
  const pool = [...cands].sort((a, b) => score(b.slot) - score(a.slot) || a.week - b.week);
  const landmarks = pool.filter((c) => score(c.slot));
  for (const c of landmarks.slice(0, n)) chosen.push(c);
  const rest = pool.filter((c) => !chosen.includes(c));
  while (chosen.length < n && rest.length) {
    let best = rest[0];
    let bestGap = -1;
    for (const c of rest) {
      const gap = chosen.length
        ? Math.min(...chosen.map((x) => Math.abs(x.week - c.week)))
        : 99;
      if (gap > bestGap) { bestGap = gap; best = c; }
    }
    chosen.push(best);
    rest.splice(rest.indexOf(best), 1);
  }
  return chosen;
}

const keep = new Set(FORCE.map(([w, d]) => `${w}:${d}`));
const report = [];

for (const [from, to] of SLICES) {
  for (const day of ['tuesday', 'shabbat']) {
    const cands = plan.weeks
      .filter((w) => w.index >= from && w.index <= to && !w[day].blocked)
      .map((w) => ({ week: w.index, day, slot: w[day] }));
    const free = cands.filter((c) => !keep.has(`${c.week}:${day}`));
    const forced = cands.filter((c) => keep.has(`${c.week}:${day}`));
    const chosen = [...forced, ...pick(free, PER_SLICE_PER_DAY)];
    for (const c of chosen) keep.add(`${c.week}:${day}`);
    report.push({ slice: `${from}-${to}`, day, weeks: chosen.map((c) => c.week).sort((a, b) => a - b) });
  }
}

let ones = 0;
for (const w of plan.weeks) {
  for (const day of ['tuesday', 'shabbat']) {
    const slot = w[day];
    if (slot.blocked) continue;
    if (keep.has(`${w.index}:${day}`)) { slot.activity_priority = 1; ones += 1; }
    else if (slot.activity_priority === 1) slot.activity_priority = 2;
  }
}

await writeFile(planPath, JSON.stringify(plan, null, 2), 'utf8');

console.log('');
for (const r of report) {
  console.log(`  ${r.slice.padStart(5)} ${r.day === 'tuesday' ? 'שלישי' : 'שבת  '} → שבועות ${r.weeks.join(', ')}`);
}
console.log('');
console.log(`✓  ${ones} מועדים מסומנים לכתיבת פעולה מלאה`);
