/**
 * check-duplicates.mjs - איתור משחקים כפולים או דומים מדי.
 * שימוש: npm run check-duplicates
 *
 * הבדיקה לא מסתפקת בשם: היא משווה את הטקסט המלא של המשחקים
 * ומדגישה במיוחד זוגות מאותה game_family.
 */

import { loadContent, hebrewTokens } from './lib/content.mjs';

// מילים שחוזרות כמעט בכל משחק ולכן מטשטשות את הדמיון
const STOPWORDS = new Set([
  'של', 'את', 'על', 'עם', 'כל', 'לא', 'זה', 'הוא', 'היא', 'הם', 'הן', 'כדי', 'אם', 'או', 'גם',
  'יש', 'אין', 'מי', 'מה', 'כמו', 'אבל', 'רק', 'אחרי', 'לפני', 'בין', 'עד', 'כאשר', 'אז', 'שוב',
  'יותר', 'פחות', 'אפשר', 'צריך', 'צריכה', 'צריכים', 'המשחק', 'משחק', 'משחקים', 'קבוצה', 'קבוצות',
  'הקבוצה', 'הקבוצות', 'חניכים', 'החניכים', 'חניך', 'מדריך', 'המדריך', 'מדריכים', 'המדריכים',
  'סיבוב', 'סיבובים', 'שלב', 'מחלקים', 'כשה', 'שבו', 'בו', 'בה', 'הזה', 'הזאת', 'אחד', 'אחת',
  'שני', 'שתי', 'שלוש', 'ארבע', 'חמש', 'דקות', 'זמן', 'הזמן', 'עומדים', 'יושבים', 'בקבוצה',
  'מכריז', 'מנצחת', 'מנצח', 'נקודה', 'נקודות', 'שבט', 'השבט', 'סניף', 'הסניף', 'לכל', 'לפי',
  'כמה', 'הכי', 'שלהם', 'שלו', 'עוד', 'ואז', 'מתחיל', 'מתחילים', 'מסתיים', 'נגמר', 'בסוף',
]);

function bag(text) {
  return new Set(hebrewTokens(text).filter((t) => t.length > 2 && !STOPWORDS.has(t)));
}

function jaccard(a, b) {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter || 1);
}

const { games, taxonomy } = await loadContent();

const docs = games.map((g) => ({
  id: g.id,
  name: g.name,
  family: g.game_family,
  file: g._file,
  nameBag: bag(g.name),
  bag: bag([g.name, g.description, ...(g.instructions || [])].join(' ')),
}));

const SAME_FAMILY_THRESHOLD = 0.34;
const CROSS_FAMILY_THRESHOLD = 0.46;
const NAME_THRESHOLD = 0.6;

const pairs = [];
for (let i = 0; i < docs.length; i += 1) {
  for (let j = i + 1; j < docs.length; j += 1) {
    const a = docs[i]; const b = docs[j];
    const sim = jaccard(a.bag, b.bag);
    const nameSim = jaccard(a.nameBag, b.nameBag);
    const sameFamily = a.family === b.family;
    const threshold = sameFamily ? SAME_FAMILY_THRESHOLD : CROSS_FAMILY_THRESHOLD;
    if (sim >= threshold || nameSim >= NAME_THRESHOLD) {
      pairs.push({ a, b, sim, nameSim, sameFamily });
    }
  }
}
pairs.sort((x, y) => y.sim - x.sim);

// ---- פיזור משפחות ----
const famCount = new Map();
for (const g of games) famCount.set(g.game_family, (famCount.get(g.game_family) || 0) + 1);
const famLabels = new Map(taxonomy.game_family.map((f) => [f.id, f.label]));

console.log('');
console.log(`  ${games.length} משחקים, ${famCount.size} משפחות בשימוש מתוך ${taxonomy.game_family.length}`);
const sortedFam = [...famCount.entries()].sort((a, b) => b[1] - a[1]);
console.log(`  משפחות עמוסות: ${sortedFam.slice(0, 5).map(([f, n]) => `${famLabels.get(f) || f} (${n})`).join(', ')}`);
const unused = taxonomy.game_family.filter((f) => !famCount.has(f.id));
if (unused.length) console.log(`  משפחות ללא אף משחק: ${unused.map((f) => f.label).join(', ')}`);
console.log('');

if (!pairs.length) {
  console.log('✓  לא נמצאו משחקים דומים מדי');
} else {
  console.log(`⚠  ${pairs.length} זוגות לבדיקה ידנית (דמיון גבוה):`);
  for (const p of pairs.slice(0, 30)) {
    const tag = p.sameFamily ? 'אותה משפחה' : 'משפחות שונות';
    console.log(`   ${(p.sim * 100).toFixed(0)}%  ${p.a.id} "${p.a.name}"  ~  ${p.b.id} "${p.b.name}"  (${tag}: ${p.a.family}/${p.b.family})`);
  }
  if (pairs.length > 30) console.log(`   ... ועוד ${pairs.length - 30}`);
}
console.log('');
