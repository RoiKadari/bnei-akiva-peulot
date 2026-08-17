/**
 * build-calendar.mjs
 * ------------------
 * בונה את קובץ לוח השנה העברי הסטטי של שנת הפעילות.
 *
 * הנתונים נשלפים פעם אחת מ-hebcal.com (לוח ישראל, עברית) בזמן פיתוח,
 * נשמרים ב-content/calendar/_raw/ ומעובדים ל-content/calendar/year-5787.json.
 * האתר עצמו לעולם אינו פונה לרשת - הוא קורא רק את ה-JSON הסטטי.
 *
 * שימוש:  node scripts/build-calendar.mjs
 *         node scripts/build-calendar.mjs --offline   (בונה מחדש מה-cache בלבד)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'content', 'calendar', '_raw');
const OUT = path.join(ROOT, 'content', 'calendar');

const OFFLINE = process.argv.includes('--offline');

// ---- הגדרות שנת הפעילות -----------------------------------------------
const HEBREW_YEAR = 5787;
const YEAR_LABEL = 'תשפ״ז';
const START = '2026-09-01'; // יום שלישי, י״ט באלול תשפ״ו
const END = '2027-08-31';

// ---- עזרי תאריכים ------------------------------------------------------
const iso = (d) => d.toISOString().slice(0, 10);
const parse = (s) => new Date(`${s}T12:00:00Z`);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

const HEB_MONTHS = {
  Nisan: 'ניסן', Iyyar: 'אייר', Sivan: 'סיוון', Tamuz: 'תמוז', Av: 'אב',
  Elul: 'אלול', Tishrei: 'תשרי', Cheshvan: 'חשוון', Kislev: 'כסלו',
  Tevet: 'טבת', "Sh'vat": 'שבט', Shvat: 'שבט', Adar: 'אדר',
  'Adar I': 'אדר א׳', 'Adar II': 'אדר ב׳',
};

/** מסיר ניקוד וטעמים אך שומר על מקף מחבר (־) שמפריד שמות פרשות מחוברות */
const stripNikud = (s = '') => s.replace(/[֑-ֽֿ-ׇ]/g, '');

/** "ראש השנה 5787" -> "ראש השנה תשפ״ז" */
const fixYearInTitle = (s = '') => s.replace(/\b57\d\d\b/g, (n) => (Number(n) === HEBREW_YEAR ? YEAR_LABEL : n));

// ---- שליפה עם cache ----------------------------------------------------
async function cachedFetch(name, url) {
  const file = path.join(RAW, `${name}.json`);
  if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
  if (OFFLINE) throw new Error(`חסר cache: ${file} (הרץ בלי --offline)`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`hebcal ${res.status} עבור ${url}`);
  const json = await res.json();
  await mkdir(RAW, { recursive: true });
  await writeFile(file, JSON.stringify(json, null, 1), 'utf8');
  await new Promise((r) => setTimeout(r, 120)); // עדינות כלפי ה-API
  return json;
}

// ---- 1. אירועי השנה ----------------------------------------------------
const eventsUrl =
  'https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&mf=on' +
  `&ss=on&s=on&o=on&c=off&i=on&lg=h&start=${START}&end=${END}`;

// ---- 2. תאריך עברי לכל יום שלישי/שבת ----------------------------------
async function hebrewDate(dateStr) {
  const d = parse(dateStr);
  const url =
    `https://www.hebcal.com/converter?cfg=json&gy=${d.getUTCFullYear()}` +
    `&gm=${d.getUTCMonth() + 1}&gd=${d.getUTCDate()}&g2h=1&strict=1`;
  const j = await cachedFetch(`conv-${dateStr}`, url);
  return {
    hebrew: stripNikud(j.hebrew || ''),
    day: j.hd,
    month: HEB_MONTHS[j.hm] || j.hm,
    month_en: j.hm,
    year: j.hy,
  };
}

// ---- תקופות בלוח --------------------------------------------------------
/** מחזיר תווית תקופה ללא תלות באירוע נקודתי (למשל "ספירת העומר") */
function periodFor(dateStr, omerByDate, monthName, hebDay) {
  if (omerByDate[dateStr]) return `ספירת העומר (יום ${omerByDate[dateStr]})`;
  if (monthName === 'תשרי' && hebDay >= 1 && hebDay <= 10) return 'עשרת ימי תשובה';
  if (monthName === 'אלול') return 'חודש אלול';
  if (monthName === 'תמוז' && hebDay >= 17) return 'בין המצרים';
  if (monthName === 'אב' && hebDay <= 9) return 'בין המצרים';
  return null;
}

// ימים שבהם לא מתקיימת פעולה כלל
const BLOCKING = [
  'ראש השנה', 'יום כיפור', 'סוכות א', 'סוכות א׳', 'שמיני עצרת', 'שמחת תורה',
  'פסח א', 'פסח א׳', 'פסח ז', 'פסח ז׳', 'שביעי של פסח', 'שבועות', 'תשעה באב',
];

function isBlocking(events) {
  return events.some((e) => e.yomtov === true || BLOCKING.some((b) => e.title.startsWith(b)));
}

// ---- ראשי -------------------------------------------------------------
async function main() {
  const raw = await cachedFetch('events', eventsUrl);
  const items = raw.items || [];

  // מיפוי אירועים לפי תאריך
  const byDate = {};
  const parashaByDate = {};
  const omerByDate = {};
  const holidays = [];

  for (const it of items) {
    const date = (it.date || '').slice(0, 10);
    const title = fixYearInTitle(stripNikud(it.hebrew || it.title || ''));
    if (it.category === 'omer') {
      omerByDate[date] = it.omer?.count ?? null;
      continue;
    }
    if (it.category === 'parashat') {
      parashaByDate[date] = title.replace(/^פרשת\s+/, '');
      continue;
    }
    (byDate[date] ||= []).push({
      title,
      category: it.category,
      subcat: it.subcat || null,
      yomtov: it.yomtov === true,
      memo: stripNikud(it.memo || '') || null,
    });
    if (it.category === 'holiday' && ['major', 'modern', 'minor', 'fast'].includes(it.subcat)) {
      holidays.push({ title, date, subcat: it.subcat, memo: stripNikud(it.memo || '') || null });
    }
  }

  // בניית שבועות: כל שבוע = יום שלישי + השבת שאחריו
  const weeks = [];
  let cursor = parse(START);
  while (cursor.getUTCDay() !== 2) cursor = addDays(cursor, 1); // 2 = שלישי
  const endDate = parse(END);
  let index = 0;

  while (cursor <= endDate) {
    const tueStr = iso(cursor);
    const satStr = iso(addDays(cursor, 4));
    index += 1;

    const slots = {};
    for (const [key, dateStr] of [['tuesday', tueStr], ['shabbat', satStr]]) {
      const hd = await hebrewDate(dateStr);
      const events = byDate[dateStr] || [];

      // אירועים שנופלים בימים הקרובים - כדי שאפשר יהיה לבנות פעולת הכנה לחג
      const upcoming = [];
      for (let n = 1; n <= 6; n += 1) {
        const next = iso(addDays(parse(dateStr), n));
        for (const e of byDate[next] || []) {
          if (e.category === 'holiday' && ['major', 'modern'].includes(e.subcat)) {
            upcoming.push({ title: e.title, date: next, days_ahead: n });
          }
        }
      }

      slots[key] = {
        date: dateStr,
        hebrew_date: hd.hebrew,
        hebrew_day: hd.day,
        hebrew_month: hd.month,
        events: events.map((e) => e.title),
        event_details: events,
        upcoming,
        omer: omerByDate[dateStr] ?? null,
        period: periodFor(dateStr, omerByDate, hd.month, hd.day),
        blocked: isBlocking(events),
        blocked_reason: isBlocking(events) ? events.map((e) => e.title).join(', ') : null,
      };
    }

    weeks.push({
      index,
      hebrew_month: slots.shabbat.hebrew_month,
      parasha: parashaByDate[satStr] || null,
      tuesday: slots.tuesday,
      shabbat: slots.shabbat,
    });

    cursor = addDays(cursor, 7);
  }

  const out = {
    hebrew_year: HEBREW_YEAR,
    year_label: YEAR_LABEL,
    location: 'ישראל',
    range: { start: START, end: END },
    source: 'hebcal.com API (i=on, lg=h) — נשלף בזמן פיתוח ונשמר סטטית',
    generated_at: new Date().toISOString().slice(0, 10),
    weeks,
  };

  await writeFile(path.join(OUT, `year-${HEBREW_YEAR}.json`), JSON.stringify(out, null, 2), 'utf8');
  await writeFile(
    path.join(OUT, `holidays-${HEBREW_YEAR}.json`),
    JSON.stringify({ hebrew_year: HEBREW_YEAR, year_label: YEAR_LABEL, holidays }, null, 2),
    'utf8',
  );

  const blockedCount = weeks.reduce(
    (n, w) => n + (w.tuesday.blocked ? 1 : 0) + (w.shabbat.blocked ? 1 : 0), 0);
  console.log(`✓ נוצרו ${weeks.length} שבועות (${weeks.length * 2 - blockedCount} מועדי פעולה, ${blockedCount} חסומים)`);
  console.log(`✓ ${holidays.length} אירועי חג/מועד`);
}

main().catch((e) => { console.error('✗', e.message); process.exit(1); });
