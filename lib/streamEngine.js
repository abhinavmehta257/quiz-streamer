const { spawn } = require('child_process');
const { createCanvas, loadImage } = require('canvas');

const {
  CW,
  CH,
  drawBackground,
  drawParticles,
  spawnParticles,
  drawTextQuestion,
  drawMCQQuestion,
  drawImageQuestion,
  drawWinners,
  drawFooter,
  drawLiveBadge,
  drawLeaderboard,
  drawPromoText,
} = require('./canvasRenderer');

const {
  getRenderableState,
  setStreamingStatus,
  setStreamStats,
  subscribe,
  updateState,
} = require('./streamState');
const { log } = require('console');

const TARGET_FPS = 18; // Reduced from 24 for better stability
const FRAME_INTERVAL = 1000 / TARGET_FPS;
const WRITER_INTERVAL = 1000 / (TARGET_FPS * 2); // Writer runs at 2x render frequency

// Frame queue system
const frameQueue = [];
const MAX_QUEUE_SIZE = 3;
let queueDroppedFrames = 0;
let totalFramesRendered = 0;
let totalFramesWritten = 0;


/* ---------- CANVAS LAYERS ---------- */

const baseCanvas = createCanvas(CW, CH);
const baseCtx = baseCanvas.getContext('2d');

const dataCanvas = createCanvas(CW, CH);
const dataCtx = dataCanvas.getContext('2d');

const animCanvas = createCanvas(CW, CH);
const animCtx = animCanvas.getContext('2d');

const finalCanvas = createCanvas(CW, CH);
const finalCtx = finalCanvas.getContext('2d');

/* ---------- STREAM STATE ---------- */

let ffmpegProcess = null;
let frameTimer = null;
let writerTimer = null;

let currentImage = null;
let currentImageKey = '';
let loadingImage = false;

const particles = [];
const knownWinnerIds = new Set();

/* ---------- DIRTY FLAGS ---------- */

let lastQuestionId = null;
let winnersDirty = true;
let leaderboardDirty = true;

/* ---------- IMAGE LOADING ---------- */

subscribe(({ state }) => {
  const latestWinner = (state?.allWinners || []).slice(-1)[0];

  if (latestWinner && !knownWinnerIds.has(latestWinner.id)) {
    knownWinnerIds.add(latestWinner.id);

    spawnParticles(particles);

    winnersDirty = true;
    leaderboardDirty = true;
  }

  const image = state?.image || {};
  const key = image.dataUrl || image.url || '';

  if (key && key !== currentImageKey && !loadingImage) {
    loadingImage = true;

    loadImage(key)
      .then((img) => {
        currentImage = img;
        currentImageKey = key;

        redrawBaseLayer(state);
      })
      .catch((err) => {
        console.error('[canvas] Failed to load image', err.message);
      })
      .finally(() => {
        loadingImage = false;
      });
  }

  if (!key) {
    currentImage = null;
    currentImageKey = '';
  }

  if (state.qId !== lastQuestionId) {
    lastQuestionId = state.qId;
    redrawBaseLayer(state);
  }
});

/* ---------- LEADERBOARD ---------- */

function getLeaderboardFromWinners(winners = []) {
  const pointsMap = {};

  winners.forEach((w) => {
    if (!w?.username) return;

    pointsMap[w.username] =
      (pointsMap[w.username] || 0) + (w.points || 0);
  });

  return Object.entries(pointsMap)
    .map(([username, points]) => ({ username, points }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);
}

/* ---------- BASE LAYER (QUESTION) ---------- */

function redrawBaseLayer(state) {
  baseCtx.clearRect(0, 0, CW, CH);

  drawBackground(baseCtx);

  const payload = {
    qId: state.qId,
    qType: state.qType,
    questionText: state.questionText,
    options: state.options,
    correctIdx: state.correctIdx,
    correctAnswer: state.correctAnswer,
    revealAnswer: state.revealAnswer,
    isLive: state.isLive,
    timer: state.timer,
    imageObj: currentImage,
  };

  if (payload.qType === 'text') {
    drawTextQuestion(baseCtx, payload);
  } else if (payload.qType === 'mcq') {
      console.log(payload);
    drawMCQQuestion(baseCtx, payload);
  } else {
    drawImageQuestion(baseCtx, payload);
  }
  drawPromoText(baseCtx);
}

/* ---------- DATA LAYER (WINNERS) ---------- */

function redrawDataLayer(state) {
  dataCtx.clearRect(0, 0, CW, CH);

  drawLeaderboard(
    dataCtx,
    getLeaderboardFromWinners(state.allWinners)
  );

  drawWinners(dataCtx, state.winners || []);

  drawFooter(
    dataCtx,
    (state.allWinners || []).length
  );

  // Static promo text at the bottom of the canvas
  drawPromoText(dataCtx);
}

/* ---------- ANIMATION LAYER ---------- */

function drawAnimationLayer() {
  animCtx.clearRect(0, 0, CW, CH);

  drawParticles(animCtx, particles);

  drawLiveBadge(animCtx, Date.now());
}

/* ---------- FRAME RENDER ---------- */

function renderFrame() {
  const state = getRenderableState();

  if (winnersDirty || leaderboardDirty) {
    redrawDataLayer(state);
    winnersDirty = false;
    leaderboardDirty = false;
  }

  drawAnimationLayer();

  finalCtx.clearRect(0, 0, CW, CH);

  finalCtx.drawImage(baseCanvas, 0, 0);
  finalCtx.drawImage(dataCanvas, 0, 0);
  finalCtx.drawImage(animCanvas, 0, 0);

  // OPTIMIZED: Use canvas.toBuffer('raw') - 3-5x faster than getImageData
  const frameBuffer = finalCanvas.toBuffer('raw');
  
  totalFramesRendered++;

  // Add frame to queue
  if (frameQueue.length >= MAX_QUEUE_SIZE) {
    // Queue is full - drop the oldest frame
    frameQueue.shift();
    queueDroppedFrames++;
    
    if (queueDroppedFrames % 30 === 1) {
      console.log(`[streamEngine] Queue full - dropped ${queueDroppedFrames} frames total (queue: ${frameQueue.length}/${MAX_QUEUE_SIZE})`);
    }
  }

  frameQueue.push(frameBuffer);
}

/* ---------- FRAME WRITER ---------- */

function writeFrameFromQueue() {
  // No frames to write
  if (frameQueue.length === 0) {
    return;
  }

  // FFmpeg not ready
  if (!ffmpegProcess?.stdin?.writable) {
    return;
  }

  // Get the oldest frame from queue
  const frameBuffer = frameQueue.shift();

  // Try to write the frame
  const ok = ffmpegProcess.stdin.write(frameBuffer);
  
  if (ok) {
    totalFramesWritten++;
  } else {
    // Backpressure detected - put frame back at front of queue
    frameQueue.unshift(frameBuffer);
    
    // Log backpressure state
    if (totalFramesWritten % 50 === 0) {
      console.log(`[streamEngine] Backpressure (queue: ${frameQueue.length}/${MAX_QUEUE_SIZE}, written: ${totalFramesWritten})`);
    }
  }
}

/* ---------- RENDER & WRITER LOOPS ---------- */

function startRenderer() {
  if (frameTimer) return;

  frameTimer = setInterval(renderFrame, FRAME_INTERVAL);
}

function stopRenderer() {
  if (!frameTimer) return;

  clearInterval(frameTimer);

  frameTimer = null;
}

function startWriter() {
  if (writerTimer) return;

  writerTimer = setInterval(writeFrameFromQueue, WRITER_INTERVAL);
}

function stopWriter() {
  if (!writerTimer) return;

  clearInterval(writerTimer);

  writerTimer = null;
}

/* ---------- STREAM START ---------- */

function startStreaming(streamUrl) {
  if (ffmpegProcess) {
    throw new Error('Streaming already in progress');
  }

  const streamKey = process.env.YOUTUBE_STREAM_ID;

  if (!streamUrl || !streamKey) {
    throw new Error(
      'Missing stream URL or stream key environment variable'
    );
  }

  updateState({ streamUrl });

  const rtmpUrl = `${streamUrl.replace(/\/$/, '')}/${streamKey}`;

  // const args = [
  //   '-loglevel','warning',

  //   '-f','rawvideo',
  //   '-pix_fmt','rgba',
  //   '-s',`${CW}x${CH}`,
  //   '-r','24',
  //   '-i','pipe:0',

  //   '-f','lavfi',
  //   '-i','anullsrc=channel_layout=stereo:sample_rate=44100',

  //   '-shortest',

  //   '-c:v','libx264',
  //   '-preset','fast',
  //   '-tune','zerolatency',

  //   '-b:v','2000k',
  //   '-maxrate','2500k',
  //   '-bufsize','4000k',

  //   '-pix_fmt','yuv420p',

  //   '-g','48',
  //   '-keyint_min','48',
  //   '-sc_threshold','0',

  //   '-c:a','aac',
  //   '-b:a','160k',
  //   '-ar','44100',
  //   '-ac','2',

  //   '-map','0:v:0',
  //   '-map','1:a:0',

  //   '-f','flv',

  //   rtmpUrl
  // ];

   ffmpegProcess = spawn('ffmpeg', [
  '-loglevel','warning',

  // video input - optimized for 18 FPS
  '-f','rawvideo',
  '-pix_fmt','rgba',
  '-s','720x1080',
  '-r', String(TARGET_FPS), // Match our render FPS
  '-i','pipe:0',

  // silent audio
  '-f','lavfi',
  '-i','anullsrc=channel_layout=stereo:sample_rate=44100',

  '-shortest',

  // Video encoding - optimized for stability
  '-c:v','libx264',
  '-preset','ultrafast',
  '-tune','zerolatency',
  
  // Bitrate adjusted for 18 FPS (25% less than 24 FPS)
  '-b:v','1500k',
  '-maxrate','1800k',
  '-bufsize','3600k', // 2x maxrate for better buffering
  
  // Reduce encoding complexity
  '-bf','0', // No B-frames for faster encoding
  '-threads','0', // Auto-detect optimal thread count
  
  '-pix_fmt','yuv420p',
  
  // Keyframe settings (every 2 seconds at 18fps = 36 frames)
  '-g','36',
  '-keyint_min','36',
  '-sc_threshold','0',

  // Audio encoding
  '-c:a','aac',
  '-b:a','128k',
  '-ar','44100',
  '-ac','2',

  '-f','flv',
  rtmpUrl
]);

  // Reset counters and clear queue
  frameQueue.length = 0;
  queueDroppedFrames = 0;
  totalFramesRendered = 0;
  totalFramesWritten = 0;

  // Start both render and writer loops
  startRenderer();
  startWriter();

  setStreamingStatus(true);
  
  console.log(`[streamEngine] Starting stream at ${TARGET_FPS} FPS (720x1080)`);
  console.log(`[streamEngine] Frame queue system enabled (max queue: ${MAX_QUEUE_SIZE} frames)`);
  console.log(`[streamEngine] Target bitrate: 1500k, Buffer: 3600k`);

  ffmpegProcess.stderr.on('data', (chunk) => {
    const line = chunk.toString();

    process.stdout.write(
      line.includes('fps=')
        ? `\r[ffmpeg] ${line.trim().slice(0,120)}`
        : line
    );

    const fpsMatch = line.match(/fps=\s*(\d+)/);
    const brMatch = line.match(/bitrate=\s*([^\s]+)/);

    if (fpsMatch || brMatch) {
      setStreamStats({
        fps: fpsMatch ? Number(fpsMatch[1]) : undefined,
        bitrate: brMatch ? brMatch[1] : undefined,
      });
    }
  });

  ffmpegProcess.on('close', (code) => {
    console.log(`\n[ffmpeg] exited with code ${code}`);
    console.log(`[streamEngine] Stream stats - Rendered: ${totalFramesRendered}, Written: ${totalFramesWritten}, Dropped: ${queueDroppedFrames}`);

    stopRenderer();
    stopWriter();

    setStreamingStatus(false);

    ffmpegProcess = null;
  });

  ffmpegProcess.stdin.on('error', (err) => {
    console.warn('[ffmpeg] stdin closed', err.message);
  });
}

/* ---------- STREAM STOP ---------- */

function stopStreaming() {
  console.log(`[streamEngine] Stopping stream...`);
  console.log(`[streamEngine] Final stats - Rendered: ${totalFramesRendered}, Written: ${totalFramesWritten}, Dropped: ${queueDroppedFrames}`);
  
  if (!ffmpegProcess) {
    stopRenderer();
    stopWriter();
    setStreamingStatus(false);
    return;
  }

  try {
    ffmpegProcess.stdin.end();
    ffmpegProcess.kill('SIGTERM');
  } catch (err) {
    console.error('[ffmpeg] Failed to stop process', err.message);
  }

  ffmpegProcess = null;

  stopRenderer();
  stopWriter();

  // Clear the queue
  frameQueue.length = 0;

  setStreamingStatus(false);
}

/* ---------- STATUS ---------- */

function isStreaming() {
  return Boolean(ffmpegProcess);
}

module.exports = {
  startStreaming,
  stopStreaming,
  isStreaming,
};


// function renderFrame() {

//   const state = getRenderableState();
  
//   if (winnersDirty || leaderboardDirty) {
//     redrawDataLayer(state);
//     winnersDirty = false;
//     leaderboardDirty = false;
//   }

//   drawAnimationLayer();

//   finalCtx.clearRect(0, 0, CW, CH);

//   finalCtx.drawImage(baseCanvas, 0, 0);
//   finalCtx.drawImage(dataCanvas, 0, 0);
//   finalCtx.drawImage(animCanvas, 0, 0);

//   /* ---------- STREAM FRAME ---------- */

//   if (ffmpegProcess?.stdin?.writable) {
//     const rawFrame = finalCanvas.toBuffer('raw');

//     const ok = ffmpegProcess.stdin.write(rawFrame);

//     if (!ok) {
//       console.warn('[streamEngine] Frame dropped (backpressure)',ok);
//     }
//   }
// }