const { startChatPolling, stopChatPolling, isChatPolling } = require('../../../lib/chatPoller');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { videoId, enabled } = body;

    if (enabled === false) {
      stopChatPolling();
      return res.status(200).json({ ok: true, polling: false });
    }

    if (!videoId) {
      return res.status(400).json({ error: 'Missing videoId' });
    }

    await startChatPolling(videoId);

    return res.status(200).json({ ok: true, polling: isChatPolling() });
  } catch (err) {
    console.error('[api/stream/chat] Failed to control chat polling', err);
    return res.status(400).json({ error: err.message });
  }
}
