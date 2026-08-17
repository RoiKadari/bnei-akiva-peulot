/* עזרי תצוגה קטנים - ללא ספריות */

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** בונה HTML מרשימה, מסנן ערכים ריקים */
export const join = (arr, fn) => (arr || []).filter(Boolean).map(fn).join('');

export const chip = (text, kind = '') => text
  ? `<span class="chip ${kind ? `chip--${kind}` : ''}">${esc(text)}</span>` : '';

export const dayChip = (isShabbat) => isShabbat
  ? chip('🕯️ שבת', 'violet')
  : chip('🗓️ שלישי בלבד', 'teal');

/** 2026-09-01 -> 1.9.26 */
export function shortDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.${y.slice(2)}`;
}

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const dayName = (iso) => DAY_NAMES[new Date(`${iso}T12:00:00Z`).getUTCDay()];

export function empty(emoji, title, sub = '') {
  return `<div class="empty"><span class="empty__emoji">${emoji}</span>
    <strong>${esc(title)}</strong>${sub ? `<p class="small">${esc(sub)}</p>` : ''}</div>`;
}

export function backLink(href, text) {
  return `<a class="back" href="${href}">→ ${esc(text)}</a>`;
}

/** גלילה לראש העמוד בכל מעבר מסך */
export const toTop = () => window.scrollTo({ top: 0, behavior: 'instant' });
