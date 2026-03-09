import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import {
  CW, CH, OPT_COLS, OPT_LBLS, WIN_COLS,
  drawBackground, drawLiveBadge, drawTextQuestion,
  drawMCQQuestion, drawImageQuestion, drawWinners,
  drawParticles, spawnParticles, drawFooter, drawLeaderboard
} from '../lib/canvasRenderer';
import { useYouTubeChat } from '../lib/useYouTubeChat';

// ── Shared style tokens ───────────────────────────────────────────────────────
const S = {
  panel: { background: '#0d0d1a', border: '1px solid #1e1e3a', borderRadius: 10, padding: 14 },
  inp: { background: '#07070f', border: '1px solid #2a2a4a', borderRadius: 6, color: '#e0e0ff', padding: '7px 10px', fontSize: 12, width: '100%', outline: 'none', fontFamily: 'JetBrains Mono,monospace', resize: 'vertical' },
  lbl: { display: 'block', color: '#666', fontSize: 10, letterSpacing: 1, marginBottom: 3, marginTop: 8 },
  btn: (bg = '#7c3aed', extra = {}) => ({ background: bg, border: 'none', borderRadius: 6, color: '#fff', padding: '7px 13px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'JetBrains Mono,monospace', ...extra }),
  pt: (color) => ({ fontSize: 11, letterSpacing: 2, fontWeight: 700, marginBottom: 10, color }),
};

// ── Sub-components ────────────────────────────────────────────────────────────

function TypeTab({ active, type, label, onClick }) {
  const colors = { text: '#7c3aed', mcq: '#0ea5e9', image: '#059669' };
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 11, fontWeight: 700,
      cursor: 'pointer', border: `1px solid ${active ? colors[type] : '#2a2a4a'}`,
      background: active ? colors[type] : '#13131f', color: '#fff',
      fontFamily: 'JetBrains Mono,monospace', transition: 'all .2s',
    }}>{label}</button>
  );
}

function MCQBuilder({ options, setOptions, correctIdx, setCorrectIdx }) {
  return (
    <div>
      <span style={S.lbl}>OPTIONS — click letter to set correct answer</span>
      {options.map((opt, i) => (
        <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 6 }}>
          <div onClick={() => setCorrectIdx(i)} style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: correctIdx === i ? OPT_COLS[i] : `${OPT_COLS[i]}22`,
            border: `2px solid ${OPT_COLS[i]}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: correctIdx === i ? '#000' : OPT_COLS[i], fontWeight: 900, fontSize: 12, cursor: 'pointer',
            fontFamily: 'Orbitron,monospace', transition: 'all .2s',
          }}>
            {correctIdx === i ? '✓' : OPT_LBLS[i]}
          </div>
          <input
            value={opt}
            onChange={e => { const o = [...options]; o[i] = e.target.value; setOptions(o); }}
            style={{ ...S.inp, resize: 'none' }}
            placeholder={`Option ${OPT_LBLS[i]}…`}
          />
        </div>
      ))}
      <div style={{ color: '#555', fontSize: 10, marginTop: 2 }}>Viewers type A / B / C / D in chat</div>
    </div>
  );
}

function ImageBuilder({ imageUrl, setImageUrl, imageObj, setImageObj }) {
  const [mode, setMode] = useState('url');

  const loadImg = useCallback((src) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImageObj(img);
    img.onerror = () => setImageObj(null);
    img.src = src;
    setImageUrl(src);
  }, [setImageObj, setImageUrl]);

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => loadImg(ev.target.result);
    r.readAsDataURL(file);
  };

  return (
    <div>
      <span style={S.lbl}>IMAGE</span>
      <div style={{ display: 'flex', gap: 6, marginBottom: 7 }}>
        <button onClick={() => setMode('url')} style={S.btn(mode === 'url' ? '#059669' : '#374151', { fontSize: 10, padding: '4px 10px' })}>🔗 URL</button>
        <button onClick={() => setMode('upload')} style={S.btn(mode === 'upload' ? '#059669' : '#374151', { fontSize: 10, padding: '4px 10px' })}>📁 Upload</button>
      </div>
      {mode === 'url' ? (
        <input
          value={imageUrl}
          onChange={e => { setImageUrl(e.target.value); if (e.target.value) loadImg(e.target.value); }}
          style={{ ...S.inp, resize: 'none' }}
          placeholder="https://example.com/image.jpg"
        />
      ) : (
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px dashed #2a2a4a', borderRadius: 8, padding: '16px',
          cursor: 'pointer', color: imageObj ? '#34d399' : '#555', fontSize: 11,
          background: imageObj ? '#0d1a0d' : '#07070f',
        }}>
          {imageObj ? '✅ Image loaded — click to change' : '📁 Click to upload image'}
          <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
        </label>
      )}
      {imageObj && (
        <div style={{ marginTop: 6, borderRadius: 6, overflow: 'hidden', border: '1px solid #2a2a4a', maxHeight: 80 }}>
          <img src={imageUrl} alt="preview" style={{ width: '100%', maxHeight: 80, objectFit: 'cover' }} />
        </div>
      )}
    </div>
  );
}

function CommentFeed({ comments }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [comments]);
  return (
    <div ref={ref} style={{ height: 150, overflowY: 'auto', background: '#07070f', border: '1px solid #1a1a30', borderRadius: 8, padding: '6px 9px', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {!comments.length
        ? <div style={{ color: '#333', fontSize: 11, margin: 'auto', fontStyle: 'italic' }}>Waiting for comments…</div>
        : comments.slice(-40).map(c => (
          <div key={c.id} style={{ display: 'flex', gap: 7, fontSize: 11 }}>
            <span style={{ color: c.isCorrect ? '#4ECDC4' : '#555', fontWeight: 700, minWidth: 80, flexShrink: 0 }}>
              {c.isCorrect ? '✅' : '💬'} @{c.user}
            </span>
            <span style={{ color: c.isCorrect ? '#fff' : '#666' }}>{c.text}</span>
          </div>
        ))}
    </div>
  );
}

function HallOfFame({ allWinners }) {
  return (
    <div style={S.panel}>
      <div style={S.pt('#FFD700')}>◆ HALL OF FAME ({allWinners.length})</div>
      {!allWinners.length
        ? <div style={{ color: '#333', fontSize: 11, textAlign: 'center', padding: '12px 0' }}>No winners yet</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
          {allWinners.map((w, i) => (
            <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#13131f', borderRadius: 5, padding: '4px 8px', fontSize: 11 }}>
              <span style={{ color: '#FFD700', fontWeight: 900, minWidth: 22 }}>#{i + 1}</span>
              <span style={{ flex: 1, color: '#e0e0ff' }}>@{w.username}</span>
              <span style={{ color: '#666', fontSize: 10 }}>{String(w.answerLabel || w.answer).slice(0, 22)}</span>
              <span style={{ color: '#4ECDC4', fontWeight: 700 }}>+{w.points}pts</span>
            </div>
          ))}
        </div>
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function QuizStream() {
  // Question builder state (editable)
  const [qType, setQType] = useState('mcq');
  const [questionText, setQuestionText] = useState('Which planet is known as the Red Planet?');
  const [options, setOptions] = useState(['Venus', 'Mars', 'Jupiter', 'Saturn']);
  const [correctIdx, setCorrectIdx] = useState(1);
  const [correctAnswer, setCorrectAnswer] = useState('Mars');
  const [imageUrl, setImageUrl] = useState('');
  const [imageObj, setImageObj] = useState(null);

  // Live question state (used during quiz)
  const [liveQType, setLiveQType] = useState(null);
  const [liveQuestionText, setLiveQuestionText] = useState('');
  const [liveOptions, setLiveOptions] = useState([]);
  const [liveCorrectIdx, setLiveCorrectIdx] = useState(null);
  const [liveCorrectAnswer, setLiveCorrectAnswer] = useState('');
  const [liveImageUrl, setLiveImageUrl] = useState('');
  const [liveImageObj, setLiveImageObj] = useState(null);
  const [liveRevealAnswer, setLiveRevealAnswer] = useState(false);

  // Quiz state
  const [isLive, setIsLive] = useState(false);
  const [timer, setTimer] = useState(0);
  const [timerInput, setTimerInput] = useState(360);
  const [winners, setWinners] = useState([]);
  const [allWinners, setAllWinners] = useState([]);
  const [comments, setComments] = useState([]);

  // Stream state
  const [streamUrl, setStreamUrl] = useState('rtmp://a.rtmp.youtube.com/live2');
  const [streaming, setStreaming] = useState(false);
  const [streamMsg, setStreamMsg] = useState(null);
  const [streamStats, setStreamStats] = useState('');

  // Sim state
  const [simUser, setSimUser] = useState('');
  const [simMsg, setSimMsg] = useState('');

  // YouTube Live Chat state
  const [ytVideoId, setYtVideoId] = useState('');
  const [ytApiKey, setYtApiKey] = useState('');
  const [ytEnabled, setYtEnabled] = useState(false);
  const [ytStatus, setYtStatus] = useState('');
  const [ytError, setYtError] = useState('');

  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const timerRef = useRef(null);
  const seenUsers = useRef(new Set());
  const wsRef = useRef(null);
  const mrRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Derived correct answer string for builder
  const effectiveAnswer = qType === 'mcq'
    ? `${OPT_LBLS[correctIdx]}: ${options[correctIdx] || ''}`
    : correctAnswer;

  // Derived correct answer string for live quiz
  const liveEffectiveAnswer = liveQType === 'mcq'
    ? `${OPT_LBLS[liveCorrectIdx]}: ${liveOptions[liveCorrectIdx] || ''}`
    : liveCorrectAnswer;

  // ── Canvas Render Loop ──────────────────────────────────────────────────
  const stateRef = useRef({});
  useEffect(() => {
    // Use live question state if quiz is live, else builder state
    if (isLive && liveQType) {
      stateRef.current = {
        qType: liveQType,
        questionText: liveQuestionText,
        options: liveOptions,
        correctIdx: liveCorrectIdx,
        correctAnswer: liveEffectiveAnswer,
        imageObj: liveImageObj,
        liveRevealAnswer,
        isLive,
        timer,
        winners,
      };
    } else {
      stateRef.current = {
        qType,
        questionText,
        options,
        correctIdx,
        correctAnswer: effectiveAnswer,
        imageObj,
        liveRevealAnswer,
        isLive,
        timer,
        winners,
      };
    }
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CW;
    canvas.height = CH;
    const ctx = canvas.getContext('2d');
    let rafId;

    // Aggregate leaderboard data (top 3)
    function getLeaderboard(winners) {
      const pointsMap = {};
      winners.forEach(w => {
        pointsMap[w.username] = (pointsMap[w.username] || 0) + w.points;
      });
      return Object.entries(pointsMap)
        .map(([username, points]) => ({ username, points }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 3);
    }

    const loop = (ts) => {
      rafId = requestAnimationFrame(loop);
      const st = stateRef.current;
      ctx.clearRect(0, 0, CW, CH);
      drawBackground(ctx);
      drawParticles(ctx, particlesRef.current);

      if (st.qType === 'text') drawTextQuestion(ctx, st);
      else if (st.qType === 'mcq') drawMCQQuestion(ctx, st);
      else drawImageQuestion(ctx, st);

      // Draw leaderboard inside canvas
      drawLeaderboard(ctx, getLeaderboard(allWinnersRef.current));

      const alive = drawWinners(ctx, st.winners);
      // prune expired winners
      if (alive.length !== st.winners.length)
        setWinners([...alive]);

      drawFooter(ctx, allWinnersRef.current.length);
      drawLiveBadge(ctx, ts);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const allWinnersRef = useRef(allWinners);
  useEffect(() => { allWinnersRef.current = allWinners; }, [allWinners]);

  // ── Canvas fit ──────────────────────────────────────────────────────────
  const wrapRef = useRef(null);
  useEffect(() => {
    const fit = () => {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!wrap || !canvas) return;
      const s = Math.min(wrap.clientWidth / CW, wrap.clientHeight / CH);
      canvas.style.width = CW * s + 'px';
      canvas.style.height = CH * s + 'px';
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // ── Answer checking ─────────────────────────────────────────────────────
  const checkAnswer = useCallback((text) => {
    const t = text.trim().toLowerCase();
    // Use live question state if quiz is live
    if (isLive && liveQType) {
      if (liveQType === 'mcq') {
        const letter = OPT_LBLS[liveCorrectIdx]?.toLowerCase();
        return t === letter || t.startsWith(letter);
      }
      const ca = liveCorrectAnswer.trim().toLowerCase();
      return ca && t.includes(ca);
    }
    // Otherwise use builder state
    if (qType === 'mcq') {
      const letter = OPT_LBLS[correctIdx].toLowerCase();
      return t === letter || t.startsWith(letter);
    }
    const ca = correctAnswer.trim().toLowerCase();
    return ca && t.includes(ca);
  }, [isLive, liveQType, liveCorrectIdx, liveCorrectAnswer, qType, correctIdx, correctAnswer]);

  // ── Add comment ─────────────────────────────────────────────────────────
  const addComment = useCallback((user, text) => {
    console.log(user,text);
    
    const id = Date.now() + Math.random();
    const isCorrect = isLive && checkAnswer(text) && !seenUsers.current.has(user);
    if (isCorrect) {
      seenUsers.current.add(user);
      const w = { id, username: user, points: 10, addedAt: Date.now() };
      setWinners(prev => [...prev, w]);
      setAllWinners(prev => [...prev, w]);
      spawnParticles(particlesRef.current);
    }
    setComments(prev => [...prev.slice(-60), { id, user, text, isCorrect }]);
  }, [isLive, checkAnswer, qType, correctIdx, options]);

  // ── YouTube Live Chat Hook ──────────────────────────────────────────────
  const { connected: ytConnected, msgCount: ytMsgCount } = useYouTubeChat({
    videoId: ytVideoId,
    apiKey: ytApiKey,
    enabled: ytEnabled,
    onMessage: (author, text) => addComment(author, text),
    onError: (msg) => { setYtError(msg); setYtEnabled(false); },
    onStatus: (s) => setYtStatus(s),
  });

  // ── Timer ───────────────────────────────────────────────────────────────
  const startTimer = (secs) => {
    clearInterval(timerRef.current);
    setTimer(secs);
    const end = Date.now() + secs * 1000;
    timerRef.current = setInterval(() => {
      const rem = Math.ceil((end - Date.now()) / 1000);
      if (rem <= 0) { clearInterval(timerRef.current); setTimer(0); setIsLive(false); }
      else setTimer(rem);
    }, 500);
  };

  const goLive = () => {
    seenUsers.current.clear();
    setIsLive(true);
    setTimer(timerInput);
    startTimer(timerInput);
    // Copy builder state to live state
    setLiveQType(qType);
    setLiveQuestionText(questionText);
    setLiveOptions([...options]);
    setLiveCorrectIdx(correctIdx);
    setLiveCorrectAnswer(correctAnswer);
    setLiveImageUrl(imageUrl);
    setLiveImageObj(imageObj);
    setLiveRevealAnswer(false);
  };

  const stopQuiz = () => {
    setIsLive(false);
    clearInterval(timerRef.current);
    setTimer(0);

    // Clear live question state
    setLiveQType(null);
    setLiveQuestionText('');
    setLiveOptions([]);
    setLiveCorrectIdx(null);
    setLiveCorrectAnswer('');
    setLiveImageUrl('');
    setLiveImageObj(null);
    setLiveRevealAnswer(false);
  };

  const revealAns = () => setLiveRevealAnswer(true);

  const resetRound = () => {
    stopQuiz();
    seenUsers.current.clear();
    setComments([]);
    setLiveRevealAnswer(false);
  };

  // ── Streaming ───────────────────────────────────────────────────────────
  const startStream = async () => {
    if (!streamUrl) { setStreamMsg({ text: '⚠ Enter stream URL and key', color: '#f59e0b' }); return; }
    setStreamMsg({ text: '⟳ Connecting…', color: '#f59e0b' });
    try {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      gain.gain.value = 0;
      const dest = audioCtxRef.current.createMediaStreamDestination();
      osc.connect(gain); gain.connect(dest); osc.start();

      const cvStream = canvasRef.current.captureStream(30);
      const combined = new MediaStream([...cvStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);

      const mimes = ['video/webm;codecs=h264,opus', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'];
      const mime = mimes.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';

      mrRef.current = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 4_000_000 });

      const wsUrl = `ws://localhost:3000/ws-stream?streamUrl=${encodeURIComponent(streamUrl)}`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        mrRef.current.start(200);
        setStreaming(true);
        setStreamMsg({ text: '✅ Streaming live to YouTube…', color: '#34d399' });
      };
      wsRef.current.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data);
          if (m.type === 'error') setStreamMsg({ text: '❌ ' + m.message, color: '#FF6B6B' });
          if (m.type === 'stats' && m.fps) setStreamStats(m.fps + 'fps · ' + m.bitrate);
        } catch {}
      };
      wsRef.current.onerror = () => setStreamMsg({ text: '❌ Cannot connect — run npm run dev in the project folder', color: '#FF6B6B' });
      wsRef.current.onclose = () => { setStreaming(false); setStreamStats(''); };

      mrRef.current.ondataavailable = (e) => {
        if (e.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN)
          wsRef.current.send(e.data);
      };
    } catch (err) {
      setStreamMsg({ text: '❌ ' + err.message, color: '#FF6B6B' });
    }
  };

  const stopStream = () => {
    if (mrRef.current?.state !== 'inactive') mrRef.current?.stop();
    wsRef.current?.close();
    audioCtxRef.current?.close();
    setStreaming(false);
    setStreamStats('');
    setStreamMsg({ text: 'Stream stopped.', color: '#666' });
  };

  // ── Quick fire sim ──────────────────────────────────────────────────────
  const quickFire = () => {
    const names = ['QuizKing', 'StreamFan', 'Pro_Player', 'GamerXYZ', 'ViewerOne', 'ChatBot99', 'NightOwl'];
    const right = qType === 'mcq' ? OPT_LBLS[correctIdx] : correctAnswer;
    const wrong = qType === 'mcq'
      ? OPT_LBLS.filter((_, i) => i !== correctIdx)
      : ['wrong', 'idk', 'pass', 'nope', '??'];
    names.forEach((u, i) => setTimeout(() => addComment(u, i < 3 ? right : wrong[i % wrong.length]), i * 270));
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <>
      <Head>
        <title>⚡ Quiz Stream</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

        {/* ── Header ── */}
        <div style={{ background: '#0a0a1a', borderBottom: '1px solid #1e1e3a', padding: '9px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'linear-gradient(135deg,#7c3aed,#0ea5e9)', borderRadius: 8, padding: '5px 14px', fontFamily: 'Orbitron,monospace', fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: 1 }}>
              ⚡ QUIZ STREAM
            </div>
            <span style={{ color: '#444', fontSize: 11 }}>9:16 Portrait · YouTube Live</span>
          </div>
          {streaming && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,68,68,.1)', border: '1px solid rgba(255,68,68,.4)', borderRadius: 8, padding: '5px 12px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF4444', boxShadow: '0 0 8px #FF4444', animation: 'pulse 1s infinite' }} />
              <span style={{ color: '#FF4444', fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>STREAMING LIVE</span>
              {streamStats && <span style={{ color: '#666', fontSize: 10, marginLeft: 4 }}>{streamStats}</span>}
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {/* ── Left: Controls ── */}
          <div style={{ width: 380, flexShrink: 0, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, borderRight: '1px solid #1e1e3a' }}>

            {/* YouTube Config */}
            <div style={S.panel}>
              <div style={S.pt('#FF6B6B')}>◆ YOUTUBE STREAM</div>
              <label style={{display:"none"}}>STREAM URL</label>
              <input style={{display:"none"}} value={streamUrl} onChange={e => setStreamUrl(e.target.value)} />
              <div style={{ display: 'flex', gap: 7, marginTop: 9 }}>
                <button onClick={startStream} disabled={streaming} style={S.btn('#059669', { flex: 1, opacity: streaming ? 0.4 : 1 })}>▶ START STREAM</button>
                <button onClick={stopStream} disabled={!streaming} style={S.btn('#DC2626', { flex: 1, opacity: !streaming ? 0.4 : 1 })}>■ STOP</button>
              </div>
              {streamMsg && (
                <div style={{ marginTop: 8, background: '#13131f', borderRadius: 6, padding: '6px 9px', fontSize: 11, color: streamMsg.color }}>{streamMsg.text}</div>
              )}
            </div>

            {/* Question Builder */}
            <div style={S.panel}>
              <div style={S.pt('#7c3aed')}>◆ QUESTION BUILDER</div>

              {/* Type selector */}
              <label style={S.lbl}>TYPE</label>
              <div style={{ display: 'flex', gap: 7, marginBottom: 8 }}>
                <TypeTab active={qType === 'text'} type="text" label="📝 Text" onClick={() => setQType('text')} />
                <TypeTab active={qType === 'mcq'} type="mcq" label="🔤 MCQ" onClick={() => setQType('mcq')} />
                <TypeTab active={qType === 'image'} type="image" label="🖼 Image" onClick={() => setQType('image')} />
              </div>

              {/* Image uploader */}
              {qType === 'image' && (
                <ImageBuilder imageUrl={imageUrl} setImageUrl={setImageUrl} imageObj={imageObj} setImageObj={setImageObj} />
              )}

              {/* Question text */}
              <label style={{ ...S.lbl, marginTop: 8 }}>
                {qType === 'image' ? 'CAPTION / HINT (optional)' : 'QUESTION'}
              </label>
              <textarea
                rows={2}
                value={questionText}
                onChange={e => setQuestionText(e.target.value)}
                style={S.inp}
                placeholder={qType === 'image' ? 'e.g. What landmark is this?' : 'Type your question…'}
              />

              {/* MCQ Options */}
              {qType === 'mcq' && (
                <MCQBuilder options={options} setOptions={setOptions} correctIdx={correctIdx} setCorrectIdx={setCorrectIdx} />
              )}

              {/* Correct answer — shown for TEXT and IMAGE */}
              {(qType === 'text' || qType === 'image') && (
                <>
                  <label style={S.lbl}>CORRECT ANSWER (partial match — viewers type this)</label>
                  <input
                    value={correctAnswer}
                    onChange={e => setCorrectAnswer(e.target.value)}
                    style={{ ...S.inp, resize: 'none' }}
                    placeholder="e.g. Paris, 42, Eiffel Tower…"
                  />
                </>
              )}
            </div>

            {/* Quiz Controls */}
            <div style={S.panel}>
              <div style={S.pt('#0ea5e9')}>◆ QUIZ CONTROLS</div>
              <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 70px' }}>
                  <label style={S.lbl}>TIMER (s)</label>
                  <input type="number" value={timerInput} onChange={e => setTimerInput(+e.target.value)} min={5} max={180} style={{ ...S.inp, resize: 'none' }} />
                </div>
                <button onClick={goLive} style={S.btn('#059669')}>▶ GO LIVE</button>
                {/* Reveal works for ALL question types */}
                {isLive && (
                  <button onClick={revealAns} disabled={liveRevealAnswer} style={S.btn('#f59e0b', { opacity: liveRevealAnswer ? 0.45 : 1 })}>
                    {liveRevealAnswer ? '✓ Revealed' : '👁 Reveal Ans'}
                  </button>
                )}
                <button onClick={stopQuiz} style={S.btn('#DC2626')}>■ Stop</button>
                <button onClick={resetRound} style={S.btn('#374151', { fontSize: 10 })}>↺</button>
              </div>
              {isLive && (
                <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF4444', boxShadow: '0 0 7px #FF4444', animation: 'pulse 1s infinite' }} />
                  <span style={{ color: '#FF4444', fontSize: 12, fontWeight: 700 }}>
                    QUIZ LIVE — {timer > 0 ? `${timer}s remaining` : "Time's up!"}
                  </span>
                </div>
              )}
            </div>

            {/* YouTube Live Chat */}
            <div style={S.panel}>
              <div style={{ ...S.pt('#FF0000'), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>◆ YOUTUBE LIVE CHAT</span>
                {ytConnected && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#34d399', fontWeight: 700 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block', boxShadow: '0 0 6px #34d399' }} />
                    LIVE · {ytMsgCount} msgs
                  </span>
                )}
              </div>

              <label style={S.lbl}>
                VIDEO ID
                <span style={{ color: '#444', fontSize: 9, marginLeft: 6 }}>
                  youtube.com/live/<strong style={{ color: '#666' }}>VIDEO_ID</strong>
                </span>
              </label>
              <input
                value={ytVideoId}
                onChange={e => setYtVideoId(e.target.value)}
                style={{ ...S.inp, resize: 'none' }}
                placeholder="e.g. dQw4w9WgXcQ"
                disabled={ytEnabled}
              />

              {/* <label style={S.lbl}>
                API KEY
                <span style={{ color: '#444', fontSize: 9, marginLeft: 6 }}>
                  console.cloud.google.com → YouTube Data API v3
                </span>
              </label> */}
              {/* <input
                type="password"
                value={ytApiKey}
                onChange={e => setYtApiKey(e.target.value)}
                style={{ ...S.inp, resize: 'none' }}
                placeholder="AIza…"
                disabled={ytEnabled}
              /> */}

              <div style={{ display: 'flex', gap: 7, marginTop: 9 }}>
                <button
                  onClick={() => { setYtError(''); setYtStatus(''); setYtEnabled(true); }}
                  disabled={ytEnabled || !ytVideoId}
                  style={S.btn('#FF0000', { flex: 1, opacity: (ytEnabled || !ytVideoId) ? 0.4 : 1 })}
                >
                  ▶ CONNECT CHAT
                </button>
                <button
                  onClick={() => setYtEnabled(false)}
                  disabled={!ytEnabled}
                  style={S.btn('#374151', { opacity: !ytEnabled ? 0.4 : 1 })}
                >
                  ■ STOP
                </button>
              </div>

              {(ytStatus || ytError) && (
                <div style={{ marginTop: 7, background: '#13131f', borderRadius: 6, padding: '6px 9px', fontSize: 11, color: ytError ? '#FF6B6B' : '#34d399' }}>
                  {ytError || ytStatus}
                </div>
              )}

              {!ytEnabled && (
                <div style={{ marginTop: 8, background: '#0d0d1a', borderRadius: 6, padding: '8px 10px', fontSize: 10, color: '#555', lineHeight: 1.7 }}>
                  <div style={{ color: '#444', marginBottom: 3, fontWeight: 700 }}>HOW TO GET YOUR API KEY:</div>
                  1. Go to <span style={{ color: '#4ECDC4' }}>console.cloud.google.com</span><br/>
                  2. New project → Enable <span style={{ color: '#4ECDC4' }}>YouTube Data API v3</span><br/>
                  3. Credentials → Create API Key → paste above<br/>
                  4. Get Video ID from your YouTube stream URL
                </div>
              )}
            </div>

            {/* Simulate Comments */}
            <div style={S.panel}>
              <div style={S.pt('#34d399')}>◆ SIMULATE COMMENTS</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 7 }}>
                <input value={simUser} onChange={e => setSimUser(e.target.value)} style={{ ...S.inp, width: 90, resize: 'none' }} placeholder="User" />
                <input
                  value={simMsg}
                  onChange={e => setSimMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && simUser && simMsg) { addComment(simUser, simMsg); setSimMsg(''); } }}
                  style={{ ...S.inp, flex: 1, resize: 'none' }}
                  placeholder="Message… (Enter to send)"
                />
                <button onClick={() => { if (simUser && simMsg) { addComment(simUser, simMsg); setSimMsg(''); } }} style={S.btn('#0ea5e9')}>SEND</button>
              </div>
              <button onClick={quickFire} style={S.btn('#374151', { width: '100%', marginBottom: 7, fontSize: 10 })}>
                ⚡ Quick-fire 7 viewers (3 correct · 4 wrong)
              </button>
              <CommentFeed comments={comments} />
            </div>

            <HallOfFame allWinners={allWinners} />
          </div>

          {/* ── Right: Canvas Preview ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#030308', minWidth: 0, position: 'relative' }}>
            <div style={{ background: '#0a0a1a', borderBottom: '1px solid #1e1e3a', padding: '6px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ color: '#555', fontSize: 11 }}>📺 1080 × 1920 · 9:16 portrait · 30fps → YouTube RTMP</span>
              <span style={{ color: '#4ECDC4', fontSize: 10, background: '#13131f', border: '1px solid #2a2a4a', borderRadius: 4, padding: '2px 9px' }}>9:16</span>
            </div>
            <div ref={wrapRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, overflow: 'hidden' }}>
              <canvas ref={canvasRef} style={{ border: '1px solid #1e1e3a', borderRadius: 4, imageRendering: 'crisp-edges' }} />
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}`}</style>
    </>
  );
}
