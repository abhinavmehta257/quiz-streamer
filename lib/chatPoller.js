const { getRenderableState, updateState } = require('./streamState');

// Letters for MCQ answers (A/B/C/D)
const OPT_LBLS = ['A', 'B', 'C', 'D'];

let pollTimer = null;
let isRunning = false;
let currentVideoId = null;
let liveChatId = null;
let pageToken = null;
let seenIds = new Set();

async function resolveLiveChatId(videoId) {
  const apiKey = process.env.YOUTUBE_APIKEY;

  if (!videoId || !apiKey) {
    throw new Error('Missing videoId or YOUTUBE_APIKEY');
  }

  const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`;
  const resp = await fetch(url);
  const data = await resp.json();

  if (data.error) {
    throw new Error(data.error.message || 'Failed to resolve live chat ID');
  }

  const item = data.items?.[0];
  if (!item) {
    throw new Error('Video not found. Check your Video ID.');
  }

  const chatId = item.liveStreamingDetails?.activeLiveChatId;
  if (!chatId) {
    throw new Error('No active live chat found. Is the stream live?');
  }

  return chatId;
}

async function fetchMessagesBatch(chatId) {
  const apiKey = process.env.YOUTUBE_APIKEY;

  if (!chatId || !apiKey) {
    throw new Error('Missing liveChatId or YOUTUBE_APIKEY');
  }

  let url = 'https://www.googleapis.com/youtube/v3/liveChat/messages'
    + `?liveChatId=${encodeURIComponent(chatId)}`
    + '&part=snippet,authorDetails'
    + '&maxResults=200'
    + `&key=${apiKey}`;

  if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

  const resp = await fetch(url);
  const data = await resp.json();

  if (data.error) {
    throw new Error(data.error.message || 'Failed to fetch live chat messages');
  }

  const messages = (data.items || [])
    .filter((item) => item.snippet?.type === 'textMessageEvent')
    .map((item) => ({
      id: item.id,
      author: item.authorDetails?.displayName || 'Unknown',
      authorId: item.authorDetails?.channelId || '',
      text: item.snippet?.displayMessage || '',
      publishedAt: item.snippet?.publishedAt || '',
      isModerator: item.authorDetails?.isChatModerator || false,
      isOwner: item.authorDetails?.isChatOwner || false,
    }));

  return {
    messages,
    nextPageToken: data.nextPageToken || null,
    pollingIntervalMs: data.pollingIntervalMillis || 5000,
  };
}

function isCorrectAnswer(text, state) {
  console.log(state.isLive, state.qType, text);
  
  if (!state) return false;

  const t = (text || '').trim().toLowerCase();

  if (!t) return false;

  // Only check answers when question is live
  if (!state.isLive || !state.qType) return false;

  if (state.qType === 'mcq') {
    const idx = typeof state.correctIdx === 'number' ? state.correctIdx : 0;
    const letter = OPT_LBLS[idx]?.toLowerCase();
    if (!letter) return false;
    return t === letter || t.startsWith(letter);
  }

  const ca = (state.correctAnswer || '').trim().toLowerCase();
  
  if (!ca) return false;
  return t.includes(ca);
}

function handleIncomingMessage(msg) {
  const state = getRenderableState();
  const isCorrect = isCorrectAnswer(msg.text, state);
  const alreadyAnswered = (state.answeredUsers || []).includes(msg.author);

  const patch = {
    appendComment: {
      id: msg.id,
      user: msg.author,
      text: msg.text,
      isCorrect: isCorrect && !alreadyAnswered,
    },
  };

  if (isCorrect && !alreadyAnswered) {
    const winner = {
      id: Date.now() + Math.random(),
      username: msg.author,
      points: 10,
      addedAt: Date.now(),
      answer: msg.text,
    };

    patch.appendWinner = winner;
    patch.answeredUsers = [...(state.answeredUsers || []), msg.author];
  }

  updateState(patch);
}

function scheduleNextPoll(delayMs) {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(pollOnce, delayMs);
}

async function pollOnce() {
  if (!isRunning || !liveChatId) return;

  try {
    const { messages, nextPageToken, pollingIntervalMs } = await fetchMessagesBatch(liveChatId);
    console.log("HANDLING ANSWER");

    let newCount = 0;
    for (const msg of messages) {
      if (!seenIds.has(msg.id)) {
        seenIds.add(msg.id);
        handleIncomingMessage(msg);
        newCount++;
      }
    }

    pageToken = nextPageToken;

    const interval = Math.max(1000, pollingIntervalMs || 5000);
    scheduleNextPoll(interval);

    if (newCount > 0) {
      console.log(`[chatPoller] processed ${newCount} new messages`);
    }
  } catch (err) {
    console.error('[chatPoller] Poll error:', err.message);
    // Back off on error
    scheduleNextPoll(15000);
  }
}

async function startChatPolling(videoId) {
  if (isRunning && currentVideoId === videoId) return;

  // Stop any existing poller first
  stopChatPolling();

  currentVideoId = videoId;

  console.log('[chatPoller] Resolving live chat for video', videoId);

  liveChatId = await resolveLiveChatId(videoId);

  console.log('[chatPoller] Using liveChatId', liveChatId);

  seenIds = new Set();
  pageToken = null;
  isRunning = true;

  // Kick off first poll immediately
  scheduleNextPoll(0);
}

function stopChatPolling() {
  isRunning = false;
  currentVideoId = null;
  liveChatId = null;
  pageToken = null;
  seenIds = new Set();

  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  console.log('[chatPoller] Stopped chat polling');
}

function isChatPolling() {
  return isRunning;
}

module.exports = {
  startChatPolling,
  stopChatPolling,
  isChatPolling,
};
