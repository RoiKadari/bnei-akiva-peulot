/* נקודת הכניסה: טעינת הנתונים, ראוטינג, סימון הטאב הפעיל */

import { loadDB } from './data.js';
import { route, start, parseHash, navigate } from './router.js';
import { empty } from './ui.js';

import * as home from './pages/home.js';
import * as games from './pages/games.js';
import * as game from './pages/game.js';
import * as activities from './pages/activities.js';
import * as activity from './pages/activity.js';
import * as plan from './pages/plan.js';
import * as holidays from './pages/holidays.js';
import * as holiday from './pages/holiday.js';
import * as about from './pages/about.js';

const main = document.getElementById('main');

/** מנקה את המסך לפני כל ציור כדי שמאזיני אירועים ישנים ימותו עם ה-DOM */
function fresh() {
  const el = document.createElement('div');
  main.replaceChildren(el);
  return el;
}

const TAB_BY_PATH = [
  [/^\/$/, 'home'],
  [/^\/games?/, 'games'],
  [/^\/game\//, 'games'],
  [/^\/activit/, 'activities'],
  [/^\/plan/, 'plan'],
  [/^\/holiday/, 'holidays'],
];

function markTab(path) {
  const tab = TAB_BY_PATH.find(([re]) => re.test(path))?.[1];
  document.querySelectorAll('.tabbar a').forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function page(fn) {
  return (args, params) => {
    markTab(parseHash().path);
    try {
      fn(fresh(), args, params);
    } catch (e) {
      console.error(e);
      main.innerHTML = empty('😵', 'משהו השתבש בטעינת המסך', String(e.message || e));
    }
  };
}

route(/^\/$/, page(home.render));
route(/^\/games$/, page(games.render));
route(/^\/game\/(.+)$/, page(game.render));
route(/^\/activities$/, page(activities.render));
route(/^\/activity\/(.+)$/, page(activity.render));
route(/^\/plan$/, page(plan.render));
route(/^\/holidays$/, page(holidays.render));
route(/^\/holiday\/(.+)$/, page(holiday.render));
route(/^\/about$/, page(about.render));

document.querySelector('[data-action="focus-search"]')?.addEventListener('click', () => {
  const { path } = parseHash();
  if (path !== '/games' && path !== '/activities') navigate('#/games');
  setTimeout(() => document.getElementById('q')?.focus(), 80);
});

loadDB()
  .then(() => start((path) => {
    markTab(path);
    main.innerHTML = empty('🧭', 'הדף לא נמצא', path);
  }))
  .catch((e) => {
    main.innerHTML = empty('📡', 'לא הצלחנו לטעון את המאגר',
      'אם פתחתם את הקובץ ישירות מהמחשב, צריך להריץ שרת מקומי: npm run serve');
    console.error(e);
  });
