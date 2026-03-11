const { getState, updateState } = require('../../../lib/streamState');

export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json(getState());
  }

  if (req.method === 'POST') {
    try {
      const patch = req.body && typeof req.body === 'object' ? req.body : {};
      const nextState = updateState(patch);
      return res.status(200).json(nextState);
    } catch (err) {
      console.error('[api/stream/state] Failed to update state', err);
      return res.status(400).json({ error: err.message });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end('Method Not Allowed');
};