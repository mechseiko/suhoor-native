// Minimal static file server for serving an exported Expo web bundle.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'dist-web-check');
const mime = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found: ' + p); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8123, () => console.log('serving on http://localhost:8123'));
