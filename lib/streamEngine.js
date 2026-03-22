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

const FRAME_INTERVAL = 1000 / 24;
let backpressure = false;


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

  if (backpressure) return;   // STOP rendering while ffmpeg busy

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

  if (ffmpegProcess?.stdin?.writable) {
  const imgData = finalCtx.getImageData(0,0,CW,CH);
  const frameBuffer = Buffer.from(imgData.data);

  let ok = ffmpegProcess.stdin.write(frameBuffer);
  if(ok) {
    // console.log("STREAMING");
    console.log(frameBuffer.length,ok);
  }
    
    
  if (!ok) {
    backpressure = true;
    ffmpegProcess.stdin.once('drain', () => {
      backpressure = false;
    })
    // console.log("backpressure");
    
  }
}
}

/* ---------- RENDER LOOP ---------- */

function startRenderer() {
  if (frameTimer) return;

  frameTimer = setInterval(renderFrame, FRAME_INTERVAL);
}

function stopRenderer() {
  if (!frameTimer) return;

  clearInterval(frameTimer);

  frameTimer = null;
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

  // video input
  '-f','rawvideo',
  '-pix_fmt','rgba',
  '-s','720x1080',
  '-r','24',
  '-i','pipe:0',

  // silent audio
  '-f','lavfi',
  '-i','anullsrc=channel_layout=stereo:sample_rate=44100',

  '-shortest',

  '-c:v','libx264',
  '-preset','ultrafast',
  '-tune','zerolatency',

  '-pix_fmt','yuv420p',

  '-c:a','aac',
  '-b:a','128k',
  '-ar','44100',
  '-ac','2',

  '-f','flv',
  rtmpUrl
]);

  startRenderer();

  setStreamingStatus(true);

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

    stopRenderer();

    setStreamingStatus(false);

    ffmpegProcess = null;
  });

  ffmpegProcess.stdin.on('error', (err) => {
    console.warn('[ffmpeg] stdin closed', err.message);
  });
}

/* ---------- STREAM STOP ---------- */

function stopStreaming() {
  if (!ffmpegProcess) {
    stopRenderer();
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