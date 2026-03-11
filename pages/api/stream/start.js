const { startStreaming } = require('../../../lib/streamEngine');
const { getState, setState } = require('../../../lib/streamState');

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const streamUrl = (req.body && req.body.streamUrl) || getState().streamUrl;
    const questionState = (req.body && req.body.questionState) || {};
    setState({
      ...getState(),
      ...questionState,
    });
    startStreaming(streamUrl);
    return res.status(200).json({ ok: true, state: getState() });
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