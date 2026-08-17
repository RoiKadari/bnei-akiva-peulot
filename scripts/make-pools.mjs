/**
 * make-pools.mjs - מחלק את מאגר המשחקים למאגרי משנה עבור כותבי הפעולות.
 *
 * למה: הכלל הוא שאותו משחק לא יחזור בתוך חצי שנה (26 שבועות).
 * כשכמה כותבים עובדים במקביל על חלקים שונים של השנה, אי אפשר לסמוך על תיאום ביניהם.
 * לכן כל רבע שנה מקבל מאגר משחקים נפרד, ורק רבעים שרחוקים זה מזה ביותר מ-26 שבועות
 * חולקים מאגר. כך הכלל נשמר מעצם החלוקה.
 *
 * שימוש: node scripts/make-pools.mjs
 * פלט:   content/_pools.json  (קובץ עזר לפיתוח, לא נטען לאתר)
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadContent, CONTENT } from './lib/content.mjs';

// חלוקת השנה לרבעים. שני רבעים יכולים לחלוק מאגר רק אם הפער ביניהם >= 26 שבועות.
const SLICES = [
  { id: 'S1', weeks: [1, 13], pool: 'P1' },
  { id: 'S2', weeks: [14, 26], pool: 'P2' },
  { id: 'S3', weeks: [27, 39], pool: 'P3' },
  { id: 'S4', weeks: [40, 53], pool: 'P1' }, // 40-13 = 27 שבועות פער מ-S1, מותר לחלוק
];

const POOLS = ['P1', 'P2', 'P3'];

const { games, plan } = await loadContent();

// מיון לפי משפחה ואז לפי id, וחלוקה סבב-סבב - כך כל מאגר מקבל תמהיל דומה
const sorted = [...games].sort((a, b) =>
  a.game_family.localeCompare(b.game_family) || a.id.localeCompare(b.id));

const pools = Object.fromEntries(POOLS.map((p) => [p, []]));
sorted.forEach((g, i) => pools[POOLS[i % POOLS.length]].push(g));

// אילו מועדים צריכים פעולה כתובה, לפי התוכנית השנתית
const slots = [];
for (const w of plan?.weeks || []) {
  for (const key of ['tuesday', 'shabbat']) {
    const s = w[key];
    if (!s || s.blocked || s.activity_priority !== 1) continue;
    slots.push({ week: w.index, day: key, date: s.date, topic: s.topic, theme: w.theme });
  }
}

const out = { generated_at: new Date().toISOString().slice(0, 10), slices: [] };

console.log('');
for (const slice of SLICES) {
  const [from, to] = slice.weeks;
  const mySlots = slots.filter((s) => s.week >= from && s.week <= to);
  const pool = pools[slice.pool];
  const shabbatNeeded = mySlots.filter((s) => s.day === 'shabbat').length;
  const shabbatAvail = pool.filter((g) => g.shabbat).length;

  out.slices.push({
    id: slice.id,
    weeks: slice.weeks,
    pool: slice.pool,
    game_ids: pool.map((g) => g.id),
    slots: mySlots,
  });

  console.log(`  ${slice.id} (שבועות ${from}-${to}) → מאגר ${slice.pool}: ${pool.length} משחקים ` +
    `(${shabbatAvail} לשבת) | ${mySlots.length} פעולות לכתוב (${shabbatNeeded} מהן בשבת)`);
  if (shabbatNeeded * 3 > shabbatAvail) {
    console.log(`     ⚠ אין מספיק משחקי שבת במאגר ${slice.pool}`);
  }
}

await writeFile(path.join(CONTENT, '_pools.json'), JSON.stringify(out, null, 1), 'utf8');

// קטלוג דחוס לכל מאגר - שורה למשחק, כדי שכותב הפעולות יוכל לבחור
// בלי לקרוא את כל 140 המשחקים במלואם
for (const [poolId, pool] of Object.entries(pools)) {
  const lines = pool.map((g) => [
    g.id,
    g.name,
    g.shabbat ? 'שבת✓' : 'שבת✗',
    `${g.duration_minutes}ד׳`,
    g.energy_level,
    g.group_structure,
    g.game_family,
    (g.topics || []).join('/') || '-',
    g.description,
  ].join(' | '));

  const md = `# מאגר ${poolId} - ${pool.length} משחקים\n\n`
    + 'העמודות: id | שם | שבת | משך | אנרגיה | מבנה | משפחה | נושאים | תיאור\n\n'
    + `${lines.join('\n')}\n`;
  await writeFile(path.join(CONTENT, `_pool-${poolId}.md`), md, 'utf8');
}

console.log('');
console.log(`✓  נכתב content/_pools.json ו-${POOLS.length} קטלוגים (${slots.length} מועדים לכתיבה בסך הכול)`);
