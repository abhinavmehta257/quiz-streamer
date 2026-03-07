const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const WebSocket = require('ws');
const { spawn } = require('child_process');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const PORT = process.env.PORT || 3000;

let ffmpegProcess = null;

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // WebSocket server on /ws-stream path
  const wss = new WebSocket.Server({ server, path: '/ws-stream' });

  wss.on('connection', (ws, req) => {
    const params = new URL(req.url, `http://localhost:${PORT}`).searchParams;
    const streamUrl = decodeURIComponent(params.get('streamUrl') || '');
    const streamKey = process.env.YOUTUBE_STREAM_ID; // Use env var for stream key for security

    if (!streamUrl || !streamKey) {
      ws.send(JSON.stringify({ type: 'error', message: 'Missing streamUrl or streamKey' }));
      ws.close();
      return;
    }

    const rtmpUrl = `${streamUrl}/${streamKey}`;
    console.log(`\n[STREAM] Starting → ${streamUrl}/****`);

    if (ffmpegProcess) {
      try { ffmpegProcess.kill('SIGTERM'); } catch {}
      ffmpegProcess = null;
    }

    ffmpegProcess = spawn('ffmpeg', [
      '-loglevel', 'warning',
      '-i', 'pipe:0',
      // Portrait 9:16 output
      '-vf', 'scale=1080:1920',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-tune', 'zerolatency',
      '-b:v', '4000k',
      '-maxrate', '4500k',
      '-bufsize', '8000k',
      '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-g', '60',
      '-keyint_min', '60',
      '-sc_threshold', '0',
      '-c:a', 'aac',
      '-b:a', '160k',
      '-ar', '44100',
      '-ac', '2',
      '-f', 'flv',
      rtmpUrl,
    ]);

    ffmpegProcess.stderr.on('data', (d) => {
      const line = d.toString();
      process.stdout.write(line.includes('fps=') ? '\r[ffmpeg] ' + line.trim().slice(0, 90) : line);
      if (line.includes('fps=') && ws.readyState === WebSocket.OPEN) {
        const fps = (line.match(/fps=\s*(\d+)/) || [])[1] || '';
        const br = (line.match(/bitrate=\s*([^\s]+)/) || [])[1] || '';
        ws.send(JSON.stringify({ type: 'stats', fps, bitrate: br }));
      }
    });

    ffmpegProcess.on('close', (code) => {
      console.log(`\n[ffmpeg] Exited (code ${code})`);
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: 'error', message: `FFmpeg exited (code ${code}). Check stream key / ffmpeg install.` }));
      ffmpegProcess = null;
    });

    ffmpegProcess.stdin.on('error', () => {});

    ws.on('message', (data) => {
      if (ffmpegProcess?.stdin?.writable) {
        try { ffmpegProcess.stdin.write(data); } catch {}
      }
    });

    ws.on('close', () => {
      console.log('\n[WS] Client disconnected — stopping ffmpeg');
      if (ffmpegProcess) {
        try { ffmpegProcess.stdin.end(); } catch {}
        setTimeout(() => { if (ffmpegProcess) { try { ffmpegProcess.kill('SIGTERM'); } catch {} ffmpegProcess = null; } }, 2000);
      }
    });

    ws.on('error', (e) => console.error('[WS error]', e.message));
    ws.send(JSON.stringify({ type: 'connected' }));
  });

  server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║   ⚡  Quiz Stream (Next.js)                   ║
║   Open:  http://localhost:${PORT}                ║
║   Canvas: 1080 × 1920  (9:16 portrait)        ║
║   FFmpeg → YouTube RTMP relay ready           ║
╚══════════════════════════════════════════════╝
    `);
  });

  process.on('SIGINT', () => {
    if (ffmpegProcess) { try { ffmpegProcess.kill('SIGTERM'); } catch {} }
    process.exit(0);
  });
});
