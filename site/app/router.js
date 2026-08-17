/* ראוטר מינימלי מבוסס hash: #/games?shabbat=1&cat=movement */

const routes = [];

export function route(pattern, handler) { routes.push({ pattern, handler }); }

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path || '/', params: new URLSearchParams(qs) };
}

export function buildHash(path, params) {
  const qs = params ? params.toString() : '';
  return `#${path}${qs ? `?${qs}` : ''}`;
}

/** מעדכן פרמטר סינון בלי להוסיף רשומה להיסטוריה */
export function setParams(params) {
  const { path } = parseHash();
  history.replaceState(null, '', buildHash(path, params));
}

export function navigate(hash) { location.hash = hash; }

export function start(render404) {
  const run = () => {
    const { path, params } = parseHash();
    for (const { pattern, handler } of routes) {
      const m = path.match(pattern);
      if (m) { handler(m.slice(1).map(decodeURIComponent), params); return; }
    }
    render404(path);
  };
  window.addEventListener('hashchange', run);
  run();
}
