/**
 * GET /api/youtube/messages?liveChatId=ID&apiKey=KEY&pageToken=TOKEN
 * Fetches the latest batch of live chat messages.
 * Returns messages + nextPageToken + pollingIntervalMillis (from YouTube).
 */
export default async function handler(req, res) {
  const { liveChatId, pageToken } = req.query;
  const apiKey = process.env.YOUTUBE_APIKEY; // Allow env var override for security
  if (!liveChatId) {
    return res.status(400).json({ error: 'Missing liveChatId or apiKey' });
  }

  try {
    let url = `https://www.googleapis.com/youtube/v3/liveChat/messages`
      + `?liveChatId=${encodeURIComponent(liveChatId)}`
      + `&part=snippet,authorDetails`
      + `&maxResults=200`
      + `&key=${apiKey}`;

    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

    const resp = await fetch(url);
    const data = await resp.json();

    if (data.error) {
      // quota exceeded
      if (data.error.code === 403) {
        return res.status(403).json({ error: 'API quota exceeded. Try again later or use a different API key.' });
      }
      return res.status(400).json({ error: data.error.message });
    }

    const messages = (data.items || [])
      .filter(item => item.snippet?.type === 'textMessageEvent')
      .map(item => ({
        id: item.id,
        author: item.authorDetails?.displayName || 'Unknown',
        authorId: item.authorDetails?.channelId || '',
        text: item.snippet?.displayMessage || '',
        publishedAt: item.snippet?.publishedAt || '',
        isModerator: item.authorDetails?.isChatModerator || false,
        isOwner: item.authorDetails?.isChatOwner || false,
      }));

    return res.status(200).json({
      messages,
      nextPageToken: data.nextPageToken || null,
      // YouTube tells us the minimum poll interval — respect it to avoid quota burn
      pollingIntervalMs: data.pollingIntervalMillis || 5000,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Network error: ' + err.message });
  }
}
