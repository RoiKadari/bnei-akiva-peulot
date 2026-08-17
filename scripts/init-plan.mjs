/**
 * init-plan.mjs - יוצר שלד לתוכנית שנתית מתוך לוח השנה.
 *
 * התאריכים, הפרשות והמועדים נלקחים ישירות מ-year-5787.json ולכן אינם יכולים לסטות.
 * הכותב (אדם או סוכן) ממלא רק theme / topic / idea / topics / activity_priority.
 *
 * שימוש: node scripts/init-plan.mjs [--force]
 * ברירת מחדל: לא דורס תוכנית קיימת.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { CONTENT, HEBREW_YEAR } from './lib/content.mjs';

const planPath = path.join(CONTENT, 'calendar', `plan-${HEBREW_YEAR}.json`);
if (existsSync(planPath) && !process.argv.includes('--force')) {
  console.log('כבר קיימת תוכנית. להחלפה הריצו עם --force');
  process.exit(0);
}

const cal = JSON.parse(await readFile(path.join(CONTENT, 'calendar', `year-${HEBREW_YEAR}.json`), 'utf8'));

const slot = (s) => (s.blocked
  ? { date: s.date, blocked: true, reason: s.blocked_reason }
  : {
    date: s.date,
    hebrew_date: s.hebrew_date,
    calendar_events: [...s.events, ...s.upcoming.map((u) => `${u.title} (בעוד ${u.days_ahead} ימים)`)],
    topic: '',
    idea: '',
    topics: [],
    activity_priority: 3,
  });

const plan = {
  hebrew_year: HEBREW_YEAR,
  year_label: cal.year_label,
  weeks: cal.weeks.map((w) => ({
    index: w.index,
    hebrew_month: w.hebrew_month,
    parasha: w.parasha,
    theme: '',
    notes: '',
    tuesday: slot(w.tuesday),
    shabbat: slot(w.shabbat),
  })),
};

await writeFile(planPath, JSON.stringify(plan, null, 2), 'utf8');
console.log(`✓ נוצר שלד תוכנית עם ${plan.weeks.length} שבועות ב-${path.relative(process.cwd(), planPath)}`);
