import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useYouTubeChat
 * Polls the YouTube Live Chat API and fires onMessage(author, text) for each new message.
 *
 * @param {object} opts
 * @param {string}   opts.videoId      - YouTube video/stream ID
 * @param {string}   opts.apiKey       - YouTube Data API v3 key
 * @param {boolean}  opts.enabled      - start/stop polling
 * @param {function} opts.onMessage    - callback(author: string, text: string)
 * @param {function} opts.onError      - callback(message: string)
 * @param {function} opts.onStatus     - callback(status: string)
 */
export function useYouTubeChat({ videoId, apiKey='123', enabled, onMessage, onError, onStatus }) {
  const [liveChatId, setLiveChatId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const [autoVideoId, setAutoVideoId] = useState(null);

  const pageTokenRef = useRef(null);
  const pollTimerRef = useRef(null);
  const discoveryTimerRef = useRef(null);
  const seenIds = useRef(new Set());
  const mountedRef = useRef(true);

  const effectiveVideoId = videoId || autoVideoId;

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    clearTimeout(pollTimerRef.current);
    clearTimeout(discoveryTimerRef.current);
    discoveryTimerRef.current = null;
    setConnected(false);
    setLiveChatId(null);
    setAutoVideoId(null);
    pageTokenRef.current = null;
    seenIds.current.clear();
    onStatus?.('Disconnected');
  }, [onStatus]);

  // ── Poll for messages ─────────────────────────────────────────────────────
  const poll = useCallback(async (chatId) => {
    if (!mountedRef.current) return;
    try {
      let url = `/api/youtube/messages?liveChatId=${encodeURIComponent(chatId)}&apiKey=${encodeURIComponent(apiKey)}`;
      if (pageTokenRef.current) url += `&pageToken=${encodeURIComponent(pageTokenRef.current)}`;

      const resp = await fetch(url);
      const data = await resp.json();

      if (!mountedRef.current) return;

      if (data.error) {
        onError?.(data.error);
        // Back off on error
        pollTimerRef.current = setTimeout(() => poll(chatId), 15000);
        return;
      }

      // Fire callback for each new message
      let newCount = 0;
      for (const msg of data.messages || []) {
        if (!seenIds.current.has(msg.id)) {
          seenIds.current.add(msg.id);
          onMessage?.(msg.author, msg.text, msg);
          newCount++;
        }
      }

      if (newCount > 0) setMsgCount(n => n + newCount);
      pageTokenRef.current = data.nextPageToken;

      // Respect YouTube's suggested polling interval (min 1s enforced here)
      const interval = Math.max(1000, data.pollingIntervalMs || 5000);
      onStatus?.(`Live · polling every ${(interval / 1000).toFixed(0)}s`);
      pollTimerRef.current = setTimeout(() => poll(chatId), interval);

    } catch (err) {
      if (!mountedRef.current) return;
      onError?.('Poll error: ' + err.message);
      pollTimerRef.current = setTimeout(() => poll(chatId), 10000);
    }
  }, [apiKey, onMessage, onError, onStatus]);

  // ── Connect: resolve videoId → liveChatId → start polling ─────────────────
  const connect = useCallback(async (targetVideoId) => {
    if (!targetVideoId) { onError?.('Enter a Video ID first'); return; }
    onStatus?.('Resolving live chat ID…');
    seenIds.current.clear();
    pageTokenRef.current = null;

    try {
      const resp = await fetch(`/api/youtube/chat-id?videoId=${encodeURIComponent(targetVideoId)}&apiKey=${encodeURIComponent(apiKey)}`);
      const data = await resp.json();
      if (!mountedRef.current) return;

      if (data.error) { onError?.(data.error); onStatus?.('Error'); return; }

      setLiveChatId(data.liveChatId);
      setConnected(true);
      onStatus?.('Connected — fetching first batch…');
      poll(data.liveChatId);
    } catch (err) {
      onError?.('Connect error: ' + err.message);
      onStatus?.('Error');
    }
  }, [apiKey, poll, onError, onStatus]);

  // ── React to enabled toggle ───────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(pollTimerRef.current);

    if (!enabled) {
      stop();
      return () => clearTimeout(pollTimerRef.current);
    }

    if (!effectiveVideoId) {
      onStatus?.('Waiting for live stream…');
      return () => clearTimeout(pollTimerRef.current);
    }

    connect(effectiveVideoId);
    return () => clearTimeout(pollTimerRef.current);
  }, [enabled, effectiveVideoId, connect, stop, onStatus]);

  // ── Auto-discover live video ─────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || videoId || autoVideoId) {
      clearTimeout(discoveryTimerRef.current);
      discoveryTimerRef.current = null;
      return;
    }

    let cancelled = false;

    async function pollForLiveVideo() {
      if (cancelled || !mountedRef.current || videoId || autoVideoId || !enabled) return;
      try {
        onStatus?.('Searching for live stream…');
        const resp = await fetch('/api/youtube/live-video');
        const data = await resp.json();

        if (cancelled || !mountedRef.current) return;

        if (data.videoId) {
          setAutoVideoId(data.videoId);
          onStatus?.('Live stream found! Connecting…');
          clearTimeout(discoveryTimerRef.current);
          discoveryTimerRef.current = null;
          return;
        }

        scheduleNext();
      } catch (err) {
        if (cancelled || !mountedRef.current) return;
        onError?.('Auto-discovery error: ' + err.message);
        scheduleNext();
      }
    }

    function scheduleNext(delay = 15000) {
      clearTimeout(discoveryTimerRef.current);
      discoveryTimerRef.current = setTimeout(() => {
        if (!cancelled) pollForLiveVideo();
      }, delay);
    }

    pollForLiveVideo();

    return () => {
      cancelled = true;
      clearTimeout(discoveryTimerRef.current);
      discoveryTimerRef.current = null;
    };
  }, [enabled, videoId, autoVideoId, onError, onStatus]);

  useEffect(() => {
    if (videoId) {
      setAutoVideoId(null);
    }
  }, [videoId]);

  return {
    connected,
    liveChatId,
    msgCount,
    reconnect: () => connect(effectiveVideoId || videoId),
    disconnect: stop,
  };
}
