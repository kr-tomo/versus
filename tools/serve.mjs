// Static dev server for the app root. Sends Cache-Control: no-cache so browsers
// (Safari especially) revalidate every file instead of reusing stale copies.
// Usage: node tools/serve.mjs [port] [--https]   — listens on all interfaces for testing on tablets.
// --https uses a self-signed certificate (made once with openssl, kept in ../.cert outside the app)
// so a tablet gets a secure context: gamepads, service worker and install all need one.
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = +process.argv[2] || 8080;
const https = process.argv.includes('--https');
const lanIPs = () => Object.values(networkInterfaces()).flat().filter(a => a.family === 'IPv4' && !a.internal).map(a => a.address);

function certificate() {
  const dir = join(root, '..', '.cert'), key = join(dir, 'key.pem'), cert = join(dir, 'cert.pem');
  if (!existsSync(cert)) {
    mkdirSync(dir, { recursive: true });
    const san = ['DNS:localhost', 'IP:127.0.0.1', ...lanIPs().map(ip => `IP:${ip}`)].join(',');
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '825', '-subj', '/CN=VERSUS dev',
      '-addext', `subjectAltName=${san}`, '-keyout', key, '-out', cert], { stdio: 'ignore' });
  }
  return { key: readFileSync(key), cert: readFileSync(cert) };
}
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.wav': 'audio/wav', '.md': 'text/markdown; charset=utf-8'
};

const handler = async (req, res) => {
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
};

(https ? createHttpsServer(certificate(), handler) : createServer(handler)).listen(port, () => {
  const scheme = https ? 'https' : 'http';
  console.log(`VERSUS → ${scheme}://localhost:${port}  ${lanIPs().map(ip => `${scheme}://${ip}:${port}`).join('  ')}`);
  if (https) console.log('자체 서명 인증서입니다. 태블릿 Safari에서 경고가 뜨면 "세부사항 보기 → 이 웹 사이트 방문"으로 들어가세요.');
});
