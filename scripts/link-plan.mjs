/**
 * link-plan.mjs - מחבר בין הפעולות שנכתבו לבין התוכנית השנתית.
 *
 * כל פעולה מצהירה על week_index ועל day_type. הסקריפט משבץ אותה
 * למקום הנכון ב-plan-5787.json (שדה activity_id).
 * כך כמה כותבים יכולים לעבוד במקביל בלי לדרוס זה את קובץ התוכנית של זה.
 *
 * שימוש: node scripts/link-plan.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadContent, CONTENT, HEBREW_YEAR } from './lib/content.mjs';

const planPath = path.join(CONTENT, 'calendar', `plan-${HEBREW_YEAR}.json`);
const { activities, calendar } = await loadContent();
const plan = JSON.parse(await readFile(planPath, 'utf8'));

const byWeek = new Map();
for (const a of activities) {
  if (a.week_index === undefined || !a.day_type) continue;
  byWeek.set(`${a.week_index}:${a.day_type}`, a);
}

let linked = 0;
let cleared = 0;
const problems = [];

for (const w of plan.weeks) {
  const calWeek = calendar?.weeks.find((x) => x.index === w.index);
  for (const day of ['tuesday', 'shabbat']) {
    const slot = w[day];
    if (!slot || slot.blocked) continue;
    const act = byWeek.get(`${w.index}:${day}`);
    if (act) {
      slot.activity_id = act.id;
      linked += 1;
      const calDate = calWeek?.[day]?.date;
      if (calDate && act.date && act.date !== calDate) {
        problems.push(`שבוע ${w.index} ${day}: תאריך הפעולה ${act.date} שונה מהלוח ${calDate}`);
      }
    } else if (slot.activity_id) {
      delete slot.activity_id;
      cleared += 1;
    }
  }
}

await writeFile(planPath, JSON.stringify(plan, null, 2), 'utf8');

console.log('');
console.log(`✓  שובצו ${linked} פעולות לתוכנית${cleared ? ` (${cleared} שיבוצים ישנים הוסרו)` : ''}`);
const orphans = activities.filter((a) => a.week_index === undefined);
if (orphans.length) console.log(`   ${orphans.length} פעולות ללא week_index (לא שובצו): ${orphans.map((a) => a.id).join(', ')}`);
for (const p of problems) console.log(`   ⚠ ${p}`);
console.log('');
