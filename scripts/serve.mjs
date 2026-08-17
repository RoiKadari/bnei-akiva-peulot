/**
 * serve.mjs - שרת סטטי לתצוגה מקומית בלבד (לא נדרש לפריסה).
 * שימוש: npm run serve  ואז http://localhost:8080
 */

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SITE } from './lib/content.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

const PORT = Number(process.env.PORT || 8080);

http.createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  const file = path.join(SITE, rel);
  if (!file.startsWith(SITE)) { res.writeHead(403).end('forbidden'); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('לא נמצא');
  }
}).listen(PORT, () => console.log(`האתר רץ על http://localhost:${PORT}`));
