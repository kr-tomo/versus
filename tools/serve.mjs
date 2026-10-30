// Static dev server for the app root. Sends Cache-Control: no-cache so browsers
// (Safari especially) revalidate every file instead of reusing stale copies.
// Usage: node tools/serve.mjs [port]   — listens on all interfaces for testing on tablets.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = +process.argv[2] || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.wav': 'audio/wav', '.md': 'text/markdown; charset=utf-8'
};

createServer(async (req, res) => {
  try {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(root, path);
    if (!file.startsWith(root)) throw Object.assign(new Error('forbidden'), { code: 'EACCES' });
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch (e) {
    res.writeHead(e.code === 'EACCES' ? 403 : 404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  }
}).listen(port, () => {
  const lan = Object.values(networkInterfaces()).flat().filter(a => a.family === 'IPv4' && !a.internal).map(a => `http://${a.address}:${port}`);
  console.log(`VERSUS → http://localhost:${port}  ${lan.join('  ')}`);
});
