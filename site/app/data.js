/* טעינת המאגר הסטטי ואינדוקס שלו בזיכרון.
   כל הקבצים נוצרים ע"י npm run build מתוך /content. אין כאן שום קריאה לשרת חיצוני. */

export const DB = {
  games: [], activities: [], holidays: [], taxonomy: null,
  calendar: null, plan: null, meta: null,
  gamesById: new Map(), activitiesById: new Map(), holidaysById: new Map(),
  labels: {},
};

const FILES = ['meta', 'taxonomy', 'games', 'activities', 'holidays', 'calendar', 'plan'];

async function getJson(name) {
  try {
    const res = await fetch(`data/${name}.json`, { cache: 'no-cache' });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function loadDB() {
  const results = await Promise.all(FILES.map(getJson));
  FILES.forEach((name, i) => { DB[name] = results[i] ?? DB[name]; });

  DB.games = DB.games || [];
  DB.activities = DB.activities || [];
  DB.holidays = DB.holidays || [];

  DB.gamesById = new Map(DB.games.map((g) => [g.id, g]));
  DB.activitiesById = new Map(DB.activities.map((a) => [a.id, a]));
  DB.holidaysById = new Map(DB.holidays.map((h) => [h.id, h]));

  // מפות תווית: taxonomy.categories -> {movement: "תנועה וריצה", ...}
  DB.labels = {};
  for (const [key, list] of Object.entries(DB.taxonomy || {})) {
    if (!Array.isArray(list)) continue;
    DB.labels[key] = new Map(list.map((x) => [x.id, x]));
  }
  return DB;
}

/** מחזיר תווית קריאה לערך מסווג */
export function label(kind, id) {
  return DB.labels[kind]?.get(id)?.label ?? id ?? '';
}
export function labelEmoji(kind, id) {
  const x = DB.labels[kind]?.get(id);
  return x ? `${x.emoji ? `${x.emoji} ` : ''}${x.label}` : (id ?? '');
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** השבוע הרלוונטי עכשיו: השבוע הראשון שהשבת שלו עדיין לא עברה */
export function currentWeek(today = todayISO()) {
  const weeks = DB.calendar?.weeks || [];
  if (!weeks.length) return null;
  return weeks.find((w) => w.shabbat.date >= today) || weeks[weeks.length - 1];
}

export function planForWeek(index) {
  return (DB.plan?.weeks || []).find((w) => w.index === index) || null;
}

/** החגים הקרובים מתוך לוח השנה */
export function upcomingHolidays(limit = 4, today = todayISO()) {
  const seen = new Set();
  const out = [];
  for (const h of DB.holidays) {
    const next = (h.dates_this_year || []).map((d) => d.date).filter((d) => d >= today).sort()[0];
    if (!next || seen.has(h.id)) continue;
    seen.add(h.id);
    out.push({ ...h, next_date: next });
  }
  return out.sort((a, b) => a.next_date.localeCompare(b.next_date)).slice(0, limit);
}

/** כל הפעולות שמשויכות לחג מסוים */
export function activitiesForHoliday(holiday) {
  const explicit = (holiday.activity_ids || []).map((id) => DB.activitiesById.get(id)).filter(Boolean);
  if (explicit.length) return explicit;
  return DB.activities.filter((a) => a.holiday && holiday.calendar_titles?.some((t) => t.startsWith(a.holiday)));
}
