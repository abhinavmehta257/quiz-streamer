/**
 * GET /api/youtube/chat-id?videoId=VIDEO_ID&apiKey=API_KEY
 * Resolves a YouTube video ID → liveChatId needed for polling messages
 */
export default async function handler(req, res) {
  const { videoId } = req.query;
  const apiKey = process.env.YOUTUBE_APIKEY; // Allow env var override for security
  if (!videoId || !apiKey) {
    return res.status(400).json({ error: 'Missing videoId or apiKey' });
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    const item = data.items?.[0];
    if (!item) {
      return res.status(404).json({ error: 'Video not found. Check your Video ID.' });
    }

    const liveChatId = item.liveStreamingDetails?.activeLiveChatId;
    if (!liveChatId) {
      return res.status(404).json({ error: 'No active live chat found. Is the stream live?' });
    }

    return res.status(200).json({ liveChatId });
  } catch (err) {
    return res.status(500).json({ error: 'Network error: ' + err.message });
  }
}
