const { stopStreaming } = require('../../../lib/streamEngine');
const { getState } = require('../../../lib/streamState');

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    stopStreaming();
    return res.status(200).json({ ok: true, state: getState() });
  } catch (err) {
    console.error('[api/stream/stop] Unable to stop streaming', err);
    return res.status(400).json({ error: err.message });
  }
};