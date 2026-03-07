# ⚡ Quiz Stream — Next.js Edition

YouTube Live streaming quiz overlay.  
**9:16 Portrait · 1080×1920 · H.264 → RTMP → YouTube**

---

## Requirements

- **Node.js** v18+
- **FFmpeg** in PATH:
  - macOS: `brew install ffmpeg`
  - Windows: https://ffmpeg.org/download.html → add to PATH  
  - Linux: `sudo apt install ffmpeg`

---

## Quick Start

```bash
npm install
npm run dev
# open http://localhost:3000
```

---

## YouTube Setup

1. **YouTube Studio** → **Go Live** → **Stream** tab
2. Copy your **Stream Key**
3. Stream URL: `rtmp://a.rtmp.youtube.com/live2`
4. Paste both into the app → **▶ START STREAM**

---

## Question Types

| Type    | Viewer interaction      | Reveal Answer       |
|---------|-------------------------|---------------------|
| 📝 Text  | Type free text in chat  | Shows answer banner |
| 🔤 MCQ  | Type A / B / C / D      | Highlights correct option + banner |
| 🖼 Image | Type answer in chat     | Shows answer banner |

**Reveal Answer works for ALL types** — hit 👁 Reveal Ans while the quiz is live.

---

## Stream Specs

| Setting       | Value        |
|--------------|--------------|
| Canvas       | 1080 × 1920  |
| Aspect Ratio | 9:16 portrait |
| Frame Rate   | 30 fps       |
| Video        | H.264 via FFmpeg |
| Bitrate      | 4 Mbps       |
| Audio        | AAC 160kbps  |
| Protocol     | RTMP         |

---

## Architecture

```
React Canvas (1080×1920, 30fps)
  ↓ canvas.captureStream()
MediaRecorder → WebM chunks
  ↓ WebSocket /ws-stream
server.js (Next.js + ws)
  ↓ pipe stdin
FFmpeg → H.264 / AAC / FLV
  ↓ RTMP
YouTube Live 🎬
```

---

## Project Structure

```
quiz-stream-next/
├── server.js          ← Custom server (Next.js + WebSocket + FFmpeg)
├── next.config.js
├── pages/
│   ├── _app.js
│   ├── globals.css
│   └── index.js       ← Main quiz app
├── lib/
│   └── canvasRenderer.js  ← All canvas drawing logic
└── package.json
```
