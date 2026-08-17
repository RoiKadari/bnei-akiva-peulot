/**
 * lib/content.mjs - טעינת התוכן מהתיקייה /content
 * משמש גם את סקריפטי ה-QA וגם את סקריפט הבנייה.
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONTENT = path.join(ROOT, 'content');
export const SITE = path.join(ROOT, 'site');

export const HEBREW_YEAR = 5787;

async function readJson(file) {
  const txt = await readFile(file, 'utf8');
  try {
    return JSON.parse(txt.replace(/^﻿/, ''));
  } catch (e) {
    throw new Error(`JSON לא תקין בקובץ ${path.relative(ROOT, file)}: ${e.message}`);
  }
}

/** קורא את כל קבצי ה-JSON בתיקייה ומחזיר [{file, data}] */
async function readDirJson(dir) {
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
  return Promise.all(
    files.sort().map(async (f) => ({ file: f, data: await readJson(path.join(dir, f)) })),
  );
}

export async function loadContent() {
  const gameFiles = await readDirJson(path.join(CONTENT, 'games'));
  const activityFiles = await readDirJson(path.join(CONTENT, 'activities'));
  const holidayFiles = await readDirJson(path.join(CONTENT, 'holidays'));

  const games = [];
  for (const { file, data } of gameFiles) {
    for (const g of data) games.push({ ...g, _file: `games/${file}` });
  }

  const activities = [];
  for (const { file, data } of activityFiles) {
    for (const a of data) activities.push({ ...a, _file: `activities/${file}` });
  }

  const holidays = [];
  for (const { file, data } of holidayFiles) {
    for (const h of (Array.isArray(data) ? data : [data])) holidays.push({ ...h, _file: `holidays/${file}` });
  }

  const calendarPath = path.join(CONTENT, 'calendar', `year-${HEBREW_YEAR}.json`);
  const holidayDatesPath = path.join(CONTENT, 'calendar', `holidays-${HEBREW_YEAR}.json`);
  const planPath = path.join(CONTENT, 'calendar', `plan-${HEBREW_YEAR}.json`);

  return {
    games,
    activities,
    holidays,
    taxonomy: await readJson(path.join(CONTENT, 'taxonomy.json')),
    shabbatRules: await readJson(path.join(CONTENT, 'rules', 'shabbat-rules.json')),
    calendar: existsSync(calendarPath) ? await readJson(calendarPath) : null,
    holidayDates: existsSync(holidayDatesPath) ? await readJson(holidayDatesPath) : null,
    plan: existsSync(planPath) ? await readJson(planPath) : null,
  };
}

// ---------- בדיקת מילים אסורות בשבת ----------

const PREFIXES = ['', 'ו', 'ה', 'ב', 'ל', 'כ', 'מ', 'ש', 'וה', 'ול', 'וב', 'ומ', 'כש', 'לכ', 'מה', 'שה', 'שב', 'של', 'לה', 'וכ'];
const SUFFIXES = ['', 'ים', 'ות'];

/** בונה מפה: וריאציה אסורה -> {rule, token} */
export function buildForbiddenIndex(shabbatRules) {
  const index = new Map();
  for (const rule of shabbatRules.forbidden_actions) {
    for (const token of rule.tokens) {
      for (const p of PREFIXES) {
        for (const s of SUFFIXES) index.set(p + token + s, { rule: rule.label, ruleId: rule.id, token });
      }
    }
  }
  for (const ex of shabbatRules.token_exceptions || []) index.delete(ex);
  return index;
}

/** מפרק טקסט עברי לטוקנים */
export function hebrewTokens(text) {
  return String(text).split(/[^֐-׿]+/).filter(Boolean);
}

/** מחזיר את כל ההפרות בטקסט */
export function findForbidden(text, index) {
  const hits = [];
  for (const tok of hebrewTokens(text)) {
    const hit = index.get(tok);
    if (hit) hits.push({ ...hit, found: tok });
  }
  return hits;
}

/** כל הטקסט החופשי של משחק, כמחרוזת אחת */
export function gameText(g) {
  return [
    g.name, g.description, ...(g.instructions || []), g.preparation, g.notes,
    ...(g.equipment || []), ...(g.variations || []), ...(g.educational_goals || []),
    g.madrichim_roles,
  ].filter(Boolean).join(' | ');
}
