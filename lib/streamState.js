const { EventEmitter } = require('events');

const defaultState = {
  qId:'123',
  isStreaming: false,
  streamStartedAt: null,
  isLive: false,
  qType: 'mcq',
  questionText: '',
  options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
  correctIdx: 1,
  correctAnswer: 'Mars',
  revealAnswer: false,
  timerDuration: 0,
  timerEnd: null,
  winners: [],
  allWinners: [],
  comments: [],
  answeredUsers: [],
  image: { url: '', dataUrl: '', width: 0, height: 0 },
  stats: { fps: 0, bitrate: '' },
  streamUrl: 'rtmp://a.rtmp.youtube.com/live2',
  lastUpdated: Date.now(),
};

let streamState = JSON.parse(JSON.stringify(defaultState));
const emitter = new EventEmitter();

const MAX_COMMENTS = 100;
const MAX_WINNERS = 10;
const MAX_HALL_OF_FAME = 200;

function cloneState() {
  return JSON.parse(JSON.stringify(streamState));
}

function computeTimerRemaining() {
  if (!streamState.timerEnd) return 0;
  const remaining = Math.ceil((streamState.timerEnd - Date.now()) / 1000);
  if (remaining <= 0) {
    streamState.timerEnd = null;
    streamState.isLive = false;
    return 0;
  }
  return remaining;
}

function getState() {
  const snap = cloneState();
  snap.timerRemaining = computeTimerRemaining();
  return snap;
}

function getRenderableState() {
  const timer = computeTimerRemaining();
  return { ...streamState, timer };
}

function merge(target, patch) {
  Object.entries(patch).forEach(([key, value]) => {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof target[key] === 'object' &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      merge(target[key], value);
    } else {
      target[key] = value;
    }
  });
}

function sanitizeArray(arr, limit) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(-limit);
}

function updateState(patch = {}) {
  const { timerSeconds, resetAnsweredUsers, appendComment, appendWinner, ...rest } = patch;

  if (typeof timerSeconds === 'number') {
    if (timerSeconds > 0) {
      streamState.timerDuration = timerSeconds;
      streamState.timerEnd = Date.now() + timerSeconds * 1000;
    } else {
      streamState.timerDuration = 0;
      streamState.timerEnd = null;
    }
  }

  if (resetAnsweredUsers) {
    streamState.answeredUsers = [];
  }

  if (appendComment) {
    streamState.comments = sanitizeArray([...streamState.comments, appendComment], MAX_COMMENTS);
  }

  if (appendWinner) {
    streamState.winners = sanitizeArray([...streamState.winners, appendWinner], MAX_WINNERS);
    streamState.allWinners = sanitizeArray([...streamState.allWinners, appendWinner], MAX_HALL_OF_FAME);
  }

  if (rest.comments) {
    streamState.comments = sanitizeArray(rest.comments, MAX_COMMENTS);
    delete rest.comments;
  }
  if (rest.winners) {
    streamState.winners = sanitizeArray(rest.winners, MAX_WINNERS);
    delete rest.winners;
  }
  if (rest.allWinners) {
    streamState.allWinners = sanitizeArray(rest.allWinners, MAX_HALL_OF_FAME);
    delete rest.allWinners;
  }

  if (rest.options) {
    const opts = Array.isArray(rest.options) ? rest.options.slice(0, 4) : [];
    while (opts.length < 4) opts.push('');
    streamState.options = opts;
    delete rest.options;
  }

  merge(streamState, rest);
  streamState.lastUpdated = Date.now();

  emitter.emit('change', { type: 'state', state: getState() });
  return getState();
}

function setStreamingStatus(isStreaming) {
  streamState.isStreaming = isStreaming;
  streamState.streamStartedAt = isStreaming ? Date.now() : null;
  streamState.lastUpdated = Date.now();
  emitter.emit('change', { type: 'streaming', state: getState() });
}

function setStreamStats(stats = {}) {
  const filtered = Object.entries(stats).reduce((acc, [k, v]) => {
    if (typeof v !== 'undefined') acc[k] = v;
    return acc;
  }, {});
  streamState.stats = { ...streamState.stats, ...filtered };
  streamState.lastUpdated = Date.now();
  emitter.emit('change', { type: 'stats', state: getState() });
}

function subscribe(listener) {
  emitter.on('change', listener);
  return () => emitter.off('change', listener);
}

function resetState() {
  streamState = JSON.parse(JSON.stringify(defaultState));
  emitter.emit('change', { type: 'reset', state: getState() });
}

function setState(newState = {}) {
  if (!newState || typeof newState !== 'object') return getState();

  streamState = {
    ...JSON.parse(JSON.stringify(defaultState)),
    ...JSON.parse(JSON.stringify(newState)),
  };

  streamState.lastUpdated = Date.now();

  emitter.emit('change', { type: 'state', state: getState() });

  return getState();
}

module.exports = {
  getState,
  getRenderableState,
  updateState,
  setState,
  setStreamingStatus,
  setStreamStats,
  subscribe,
  resetState,
};