const { startStreaming } = require('../../../lib/streamEngine');
const { getState, updateState } = require('../../../lib/streamState');

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const streamUrl = body.streamUrl || getState().streamUrl;
    const questionState = body.questionState || {};

    console.log('[api/stream/start] questionState payload:', {
      qType: questionState.qType,
      hasImage: Boolean(questionState.image && (questionState.image.url || questionState.image.dataUrl)),
    });

    // Normalize incoming question state into backend stream state shape
    const patch = {
      qId: questionState.qId || String(Date.now()),
      qType: questionState.qType || 'mcq',
      questionText: questionState.questionText || '',
      options: questionState.options || [],
      correctIdx: typeof questionState.correctIdx === 'number' ? questionState.correctIdx : 0,
      correctAnswer: questionState.correctAnswer || '',
      revealAnswer: Boolean(questionState.revealAnswer),
      isLive: true,
      image: questionState.image || { url: '', dataUrl: '', width: 0, height: 0 },
      // timer on the frontend is remaining seconds; backend will compute timerEnd
      timerSeconds: typeof questionState.timer === 'number' ? questionState.timer : 0,
      // Reset per-round data
      resetAnsweredUsers: true,
      comments: [],
      winners: questionState.winners || [],
      allWinners: questionState.allWinners || [],
    };
    console.log(patch);
    
    const nextState = updateState(patch);

    // Kick off the Node canvas + ffmpeg stream
    startStreaming(streamUrl);

    return res.status(200).json({ ok: true, state: nextState });
  } catch (err) {
    console.error('[api/stream/start] Unable to start streaming', err);
    return res.status(400).json({ error: err.message });
  }
};

// {
//   qId:'123',
//   isStreaming: false,
//   streamStartedAt: null,
//   isLive: false,
//   qType: 'mcq',
//   questionText: '',
//   options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
//   correctIdx: 1,
//   correctAnswer: 'Mars',
//   revealAnswer: false,
//   timerDuration: 0,
//   timerEnd: null,
//   winners: [],
//   allWinners: [],
//   comments: [],
//   answeredUsers: [],
//   image: { url: '', dataUrl: '', width: 0, height: 0 },
//   stats: { fps: 0, bitrate: '' },
//   streamUrl: 'rtmp://a.rtmp.youtube.com/live2',
//   lastUpdated: Date.now(),
// }