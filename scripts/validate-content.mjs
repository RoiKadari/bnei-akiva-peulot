/**
 * validate-content.mjs - בדיקות QA אוטומטיות על כל התוכן.
 * שימוש: npm run validate
 * יוצא עם קוד 1 אם יש שגיאות (מתאים ל-CI).
 */

import { loadContent, buildForbiddenIndex, findForbidden, gameText } from './lib/content.mjs';

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const REQUIRED_GAME_FIELDS = [
  'id', 'name', 'description', 'instructions', 'duration_minutes',
  'min_participants', 'max_participants', 'age_min', 'age_max', 'shabbat',
  'equipment', 'preparation', 'energy_level', 'competitive', 'physical_contact',
  'group_structure', 'location', 'categories', 'topics', 'educational_goals',
  'game_family', 'notes',
];

const REQUIRED_ACTIVITY_FIELDS = [
  'id', 'title', 'day_type', 'topic', 'goal', 'games', 'message',
  'equipment', 'duration_minutes',
];

const TARGET_GROUP_SIZE = 40;
const TARGET_AGE = 12;
const NO_REPEAT_WEEKS = 26;        // חצי שנה - אסור לחזור על אותו משחק
const FAMILY_MIN_GAP_WEEKS = 3;    // שגיאה אם אותה משפחת משחקים חוזרת בפער קטן מזה
const FAMILY_WARN_GAP_WEEKS = 6;   // אזהרה בלבד

function ids(list) { return new Set(list.map((x) => x.id)); }

function validateGames({ games, taxonomy, shabbatRules }) {
  const forbidden = buildForbiddenIndex(shabbatRules);
  const vocab = {
    energy_level: new Set(taxonomy.energy_level.map((x) => x.id)),
    group_structure: new Set(taxonomy.group_structure.map((x) => x.id)),
    location: new Set(taxonomy.location.map((x) => x.id)),
    categories: new Set(taxonomy.categories.map((x) => x.id)),
    topics: new Set(taxonomy.topics.map((x) => x.id)),
    game_family: new Set(taxonomy.game_family.map((x) => x.id)),
  };
  const familyShabbat = new Map(taxonomy.game_family.map((f) => [f.id, f.shabbat_ok]));
  const forbiddenEquip = shabbatRules.forbidden_equipment.map((e) => e.trim());

  const seenIds = new Set();
  const seenNames = new Map();

  for (const g of games) {
    const where = `${g._file} [${g.id || '?'}]`;

    for (const f of REQUIRED_GAME_FIELDS) {
      if (g[f] === undefined || g[f] === null || g[f] === '') err(where, `חסר שדה חובה: ${f}`);
    }
    if (!g.id) continue;

    if (!/^g-[a-z]+-\d{2}$/.test(g.id)) err(where, `פורמט id לא תקין (צפוי g-xxx-00)`);
    if (seenIds.has(g.id)) err(where, `id כפול`);
    seenIds.add(g.id);

    const nameKey = String(g.name || '').trim();
    if (seenNames.has(nameKey)) err(where, `שם משחק כפול עם ${seenNames.get(nameKey)}`);
    else seenNames.set(nameKey, g.id);

    if (!Array.isArray(g.instructions) || g.instructions.length < 2) {
      err(where, 'instructions חייב להיות מערך עם לפחות 2 שלבים');
    }
    if (Array.isArray(g.instructions) && g.instructions.length > 8) {
      warn(where, `${g.instructions.length} שלבי הוראות - ארוך מדי למדריך שקורא בטלפון`);
    }

    // גילאים
    if (!(g.age_min < g.age_max)) err(where, `טווח גילאים לא הגיוני (${g.age_min}-${g.age_max})`);
    if (!(g.age_min <= TARGET_AGE && TARGET_AGE <= g.age_max)) {
      err(where, `הטווח ${g.age_min}-${g.age_max} לא מכיל את גיל 12`);
    }
    if (g.age_min < 6 || g.age_max > 18) warn(where, `טווח גילאים חריג (${g.age_min}-${g.age_max})`);

    // כמות משתתפים
    if (!(g.min_participants < g.max_participants)) {
      err(where, `טווח משתתפים לא הגיוני (${g.min_participants}-${g.max_participants})`);
    }
    if (g.max_participants < TARGET_GROUP_SIZE) {
      err(where, `max_participants=${g.max_participants} - לא מתאים ל-40 חניכים`);
    }
    if (g.min_participants > 30) warn(where, `min_participants=${g.min_participants} גבוה מדי`);

    // משך
    if (g.duration_minutes < 3 || g.duration_minutes > 45) {
      warn(where, `משך חריג: ${g.duration_minutes} דקות`);
    }

    // אוצר מילים מבוקר
    for (const [field, set] of Object.entries(vocab)) {
      const val = g[field];
      if (Array.isArray(val)) {
        for (const v of val) if (!set.has(v)) err(where, `ערך לא מוכר ב-${field}: "${v}"`);
        if (field === 'categories' && val.length === 0) err(where, 'חובה קטגוריה אחת לפחות');
        if (field === 'categories' && val.length > 4) warn(where, 'יותר מ-4 קטגוריות');
      } else if (val !== undefined && !set.has(val)) {
        err(where, `ערך לא מוכר ב-${field}: "${val}"`);
      }
    }

    if (typeof g.shabbat !== 'boolean') err(where, 'shabbat חייב להיות true/false');
    if (typeof g.competitive !== 'boolean') err(where, 'competitive חייב להיות true/false');
    if (typeof g.physical_contact !== 'boolean') err(where, 'physical_contact חייב להיות true/false');

    // ---- כללי שבת ----
    if (g.shabbat === false && !g.shabbat_reason) {
      err(where, 'משחק שאינו לשבת חייב shabbat_reason');
    }
    if (g.shabbat === true) {
      if (g.shabbat_reason) err(where, 'shabbat=true אבל יש shabbat_reason');

      const hits = findForbidden(gameText(g), forbidden);
      for (const h of hits) {
        err(where, `מסומן ככשר לשבת אבל מכיל "${h.found}" (${h.rule})`);
      }
      for (const item of g.equipment || []) {
        const bad = forbiddenEquip.find((e) => String(item).split(/[^֐-׿]+/).includes(e));
        if (bad) err(where, `ציוד אסור בשבת: "${item}"`);
      }
      if (familyShabbat.get(g.game_family) === false) {
        err(where, `משפחת המשחק "${g.game_family}" מוגדרת כלא מתאימה לשבת`);
      }
    }
  }

  return seenIds;
}

function validateActivities({ activities, games, taxonomy, shabbatRules }) {
  const forbidden = buildForbiddenIndex(shabbatRules);
  const byId = new Map(games.map((g) => [g.id, g]));
  const topicIds = new Set(taxonomy.topics.map((t) => t.id));
  const seen = new Set();

  for (const a of activities) {
    const where = `${a._file} [${a.id || '?'}]`;
    for (const f of REQUIRED_ACTIVITY_FIELDS) {
      if (a[f] === undefined || a[f] === null || a[f] === '') err(where, `חסר שדה חובה: ${f}`);
    }
    if (!a.id) continue;
    if (seen.has(a.id)) err(where, 'id כפול');
    seen.add(a.id);
    if (!/^a-[a-z0-9-]+$/.test(a.id)) err(where, 'פורמט id לא תקין (צפוי a-...)');

    if (!['tuesday', 'shabbat'].includes(a.day_type)) {
      err(where, `day_type לא תקין: "${a.day_type}"`);
    }

    if (!Array.isArray(a.games) || a.games.length !== 3) {
      err(where, `פעולה חייבת בדיוק 3 משחקים (יש ${a.games?.length ?? 0})`);
    }
    for (const gid of a.games || []) {
      const g = byId.get(gid);
      if (!g) { err(where, `הפניה למשחק שלא קיים: ${gid}`); continue; }
      if (a.day_type === 'shabbat' && g.shabbat !== true) {
        err(where, `פעולת שבת מכילה משחק שאינו כשר לשבת: ${gid} (${g.name})`);
      }
    }
    if (new Set(a.games || []).size !== (a.games || []).length) {
      err(where, 'אותו משחק מופיע פעמיים באותה פעולה');
    }

    for (const t of a.topics || []) if (!topicIds.has(t)) err(where, `נושא לא מוכר: "${t}"`);

    // קשת אנרגיה: המשחק האחרון הוא הגשר למסר, ולכן לא אמור להיות הכי סוער
    const arc = (a.games || []).map((gid) => byId.get(gid)?.energy_level).filter(Boolean);
    const rank = { low: 0, medium: 1, high: 2 };
    if (arc.length === 3 && rank[arc[2]] > rank[arc[0]]) {
      warn(where, `קשת אנרגיה הפוכה (${arc.join(' → ')}) - קשה לעבור למסר אחרי משחק סוער`);
    }

    if (a.duration_minutes && (a.duration_minutes < 30 || a.duration_minutes > 120)) {
      warn(where, `משך פעולה חריג: ${a.duration_minutes} דקות`);
    }
    if (a.connection && String(a.connection).length < 30) {
      warn(where, 'ההסבר על הקשר בין המשחקים קצר מדי');
    }
    if (a.date && Number.isNaN(Date.parse(a.date))) err(where, `תאריך לא תקין: ${a.date}`);

    // בפעולת שבת: הטקסט שנאמר בפעולה עצמה לא אמור לתאר פעילות אסורה.
    // שדה preparation מוחרג בכוונה - ההכנה נעשית לפני שבת.
    if (a.day_type === 'shabbat') {
      const spoken = [a.connection, a.message, ...(a.discussion_questions || [])].filter(Boolean).join(' ');
      for (const h of findForbidden(spoken, forbidden)) {
        warn(where, `טקסט פעולת שבת מזכיר "${h.found}" (${h.rule}) - לוודא שזה לא משהו שעושים בשבת`);
      }
    }
  }
}

function validateCalendar({ calendar }) {
  if (!calendar) { warn('calendar', 'אין קובץ לוח שנה'); return; }
  let prev = null;
  for (const w of calendar.weeks) {
    for (const key of ['tuesday', 'shabbat']) {
      const s = w[key];
      if (!s?.date || Number.isNaN(Date.parse(s.date))) {
        err(`calendar week ${w.index}`, `תאריך לא תקין ב-${key}`);
        continue;
      }
      const d = new Date(`${s.date}T12:00:00Z`);
      const expected = key === 'tuesday' ? 2 : 6;
      if (d.getUTCDay() !== expected) {
        err(`calendar week ${w.index}`, `${s.date} אינו ${key === 'tuesday' ? 'יום שלישי' : 'שבת'}`);
      }
      if (!s.hebrew_date) err(`calendar week ${w.index}`, `חסר תאריך עברי ב-${key}`);
    }
    if (prev && new Date(w.tuesday.date) - new Date(prev) !== 7 * 86400000) {
      err(`calendar week ${w.index}`, 'רצף השבועות נשבר');
    }
    prev = w.tuesday.date;
  }
}

function validatePlan({ plan, activities, games, calendar }) {
  if (!plan) { warn('plan', 'אין תוכנית שנתית עדיין'); return; }
  const actById = new Map(activities.map((a) => [a.id, a]));
  const gameById = new Map(games.map((g) => [g.id, g]));
  const calDates = new Set();
  for (const w of calendar?.weeks || []) { calDates.add(w.tuesday.date); calDates.add(w.shabbat.date); }

  const lastGameWeek = new Map();
  const lastFamilyWeek = new Map();

  for (const entry of plan.weeks) {
    const where = `plan שבוע ${entry.index}`;
    for (const key of ['tuesday', 'shabbat']) {
      const slot = entry[key];
      if (!slot || slot.blocked) continue;
      if (slot.date && calendar && !calDates.has(slot.date)) {
        err(where, `תאריך ${slot.date} לא קיים בלוח השנה`);
      }
      if (!slot.activity_id) {
        // מועדים בעדיפות 2-3 אמורים להישאר עם נושא בלבד, בלי פעולה כתובה
        if (slot.activity_priority === 1) warn(where, `מועד בעדיפות 1 בלי פעולה כתובה (${key})`);
        continue;
      }

      const act = actById.get(slot.activity_id);
      if (!act) { err(where, `פעולה לא קיימת: ${slot.activity_id}`); continue; }
      if (act.day_type !== key) {
        err(where, `הפעולה ${act.id} מסוג ${act.day_type} משובצת ב-${key}`);
      }

      for (const gid of act.games) {
        const prevWeek = lastGameWeek.get(gid);
        if (prevWeek !== undefined && entry.index - prevWeek < NO_REPEAT_WEEKS) {
          err(where, `המשחק ${gid} כבר שובץ בשבוע ${prevWeek} (פער ${entry.index - prevWeek} שבועות, נדרש ${NO_REPEAT_WEEKS})`);
        }
        lastGameWeek.set(gid, entry.index);

        const fam = gameById.get(gid)?.game_family;
        if (!fam) continue;
        const prevFam = lastFamilyWeek.get(fam);
        if (prevFam !== undefined) {
          const gap = entry.index - prevFam;
          if (gap < FAMILY_MIN_GAP_WEEKS) {
            err(where, `משפחת המשחקים "${fam}" חוזרת אחרי ${gap} שבועות בלבד`);
          } else if (gap < FAMILY_WARN_GAP_WEEKS) {
            warn(where, `משפחת המשחקים "${fam}" חוזרת אחרי ${gap} שבועות`);
          }
        }
        lastFamilyWeek.set(fam, entry.index);
      }
    }
  }
}

// ---------------------------------------------------------------

const content = await loadContent();
validateGames(content);
validateActivities(content);
validateCalendar(content);
validatePlan(content);

console.log('');
console.log(`  משחקים: ${content.games.length} | פעולות: ${content.activities.length} | חגים: ${content.holidays.length} | שבועות בלוח: ${content.calendar?.weeks.length ?? 0}`);
console.log(`  משחקי שבת: ${content.games.filter((g) => g.shabbat).length} | משפחות משחקים בשימוש: ${new Set(content.games.map((g) => g.game_family)).size}`);
console.log('');

if (warnings.length) {
  console.log(`⚠  ${warnings.length} אזהרות:`);
  for (const w of warnings.slice(0, 40)) console.log(`   - ${w}`);
  if (warnings.length > 40) console.log(`   ... ועוד ${warnings.length - 40}`);
  console.log('');
}

if (errors.length) {
  console.log(`✗  ${errors.length} שגיאות:`);
  for (const e of errors.slice(0, 80)) console.log(`   - ${e}`);
  if (errors.length > 80) console.log(`   ... ועוד ${errors.length - 80}`);
  process.exit(1);
}

console.log('✓  כל הבדיקות עברו');
