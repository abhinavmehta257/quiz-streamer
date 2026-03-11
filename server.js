const { createServer } = require('http');
const next = require('next');
const { stopStreaming } = require('./lib/streamEngine');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const PORT = process.env.PORT || 3000;

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));

  server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║   ⚡  Quiz Stream (Next.js)                   ║
║   Open:  http://localhost:${PORT}                ║
║   Canvas: 1080 × 1920  (9:16 portrait)        ║
║   Node renderer + FFmpeg relay ready          ║
╚══════════════════════════════════════════════╝
    `);
  });

  process.on('SIGINT', () => {
    stopStreaming();
    process.exit(0);
  });
});
