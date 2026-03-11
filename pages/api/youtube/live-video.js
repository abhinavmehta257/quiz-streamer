/**
 * GET /api/youtube/live-video
 * Returns the videoId of the currently live video for the configured channel.
 * Reads channelId and apiKey from process.env.
 */
export default async function handler(req, res) {
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  const apiKey = process.env.YOUTUBE_APIKEY;

  if (!channelId || !apiKey) {
    return res.status(400).json({ error: 'Missing YOUTUBE_CHANNEL_ID or YOUTUBE_APIKEY in environment.' });
  }

  try {
    // Search for live videos on the channel
    const url = `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }
    console.log(`\n[API] Fetched live video data: ${JSON.stringify(data)}`);
    const item = data.items?.[0];
    if (!item || !item.id?.videoId) {
      return res.status(404).json({ error: 'No active live video found for this channel.' });
    }

    return res.status(200).json({ videoId: item.id.videoId });
  } catch (err) {
    return res.status(500).json({ error: 'Network error: ' + err.message });
  }
}