const { formatTime } = require('../helper');

// Canvas dimensions — 9:16 portrait
const CW = 720;
const CH = 1080;

// ── Colours ───────────────────────────────────────────────────────────────────
const OPT_COLS  = ['#FF6B6B', '#4ECDC4', '#FFD700', '#A78BFA'];
const WIN_COLS  = ['#FFD700', '#FF6B6B', '#4ECDC4', '#A78BFA', '#34D399', '#F472B6'];
const PTL_COLS  = ['#FFD700', '#FF6B6B', '#4ECDC4', '#A78BFA', '#34D399', '#F472B6', '#FBBF24'];
const OPT_LBLS  = ['A', 'B', 'C', 'D'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);  ctx.quadraticCurveTo(x,     y + h, x,     y + h - r);
  ctx.lineTo(x, y + r);      ctx.quadraticCurveTo(x,     y,     x + r, y);
  ctx.closePath();
}

function hexAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function easeBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function wrapText(ctx, text, maxW) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// ── Background ────────────────────────────────────────────────────────────────
function drawBackground(ctx) {
  const bg = ctx.createLinearGradient(0, 0, CW, CH);
  bg.addColorStop(0, '#0a0a1a');
  bg.addColorStop(0.5, '#0d0d2b');
  bg.addColorStop(1, '#0a1a0a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, CH);

  // Grid
  ctx.strokeStyle = 'rgba(0,255,200,0.04)';
  ctx.lineWidth = 1;
  const STEP = 80;
  for (let x = 0; x <= CW; x += STEP) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke(); }
  for (let y = 0; y <= CH; y += STEP) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke(); }
}

// ── LIVE Badge ────────────────────────────────────────────────────────────────
function drawLiveBadge(ctx, ts) {
  const badgeW = 152, badgeH = 60, pad = 32;
  const x = CW - pad - badgeW, y = 144;
  const pulse = Math.sin(ts * 0.003) > 0;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  roundRect(ctx, x, y, badgeW, badgeH, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(255,80,80,0.5)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, badgeW, badgeH, 12); ctx.stroke();

  ctx.fillStyle = pulse ? '#FF4444' : '#991111';
  ctx.shadowColor = '#FF4444';
  ctx.shadowBlur = pulse ? 14 : 4;
  ctx.beginPath(); ctx.arc(x + 28, y + 30, 9, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px JetBrains Mono,monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('LIVE', x + 46, y + 30);
  ctx.restore();
}

// ── Panel box ─────────────────────────────────────────────────────────────────
function drawPanel(ctx, x, y, w, h, label) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.shadowColor = 'rgba(0,255,200,0.08)';
  ctx.shadowBlur = 50;
  roundRect(ctx, x, y, w, h, 28); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0,255,200,0.35)';
  ctx.lineWidth = 1.8;
  roundRect(ctx, x, y, w, h, 28); ctx.stroke();

  ctx.fillStyle = 'rgba(0,255,200,0.7)';
  ctx.font = '18px JetBrains Mono,monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + 36);
  ctx.restore();
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function drawTimer(ctx, cx, y, timer) {
  if (timer <= 0) return;
  const low = timer <= 10;
  const col = low ? '#FF6B6B' : '#FFD700';
  ctx.save();
  ctx.fillStyle = col;
  ctx.shadowColor = col;
  ctx.shadowBlur = 30;
  ctx.font = `900 ${low ? 96 : 82}px Orbitron,monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let time = formatTime(timer); 
  ctx.fillText(time, cx, y);
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── Answer Reveal Banner ──────────────────────────────────────────────────────
function drawAnswerReveal(ctx, answer, x, y, w) {
  if (!answer) return;
  const bH = 80;
  ctx.save();
  ctx.fillStyle = 'rgba(52,211,153,0.18)';
  roundRect(ctx, x, y, w, bH, 14); ctx.fill();
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, bH, 14); ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 28px JetBrains Mono,monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✓  ANSWER:  ' + answer, x + w / 2, y + bH / 2);
  ctx.restore();
}

// ── Text Question ─────────────────────────────────────────────────────────────
function drawTextQuestion(ctx, state) {
  const { questionText, correctAnswer, revealAnswer, timer, isLive } = state;
  if (!isLive) return;

  const PAD = 100, BW = CW - 80, BX = 40;
  ctx.font = 'bold 36px JetBrains Mono,monospace';
  const lines = wrapText(ctx, questionText || '', BW - PAD * 2);
  const textH = lines.length * 56;
  const revH = revealAnswer ? 98 : 0;
  const timerH = timer > 0 ? 120 : 0;
  const BH = 76 + textH + revH + timerH + 30;
  const BY = (CH - BH) / 2 - 60;

  drawPanel(ctx, BX, BY, BW, BH, '◆   QUIZ QUESTION   ◆');

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px JetBrains Mono,monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, CW / 2, BY + 62 + i * 56));

  if (revealAnswer) {
    drawAnswerReveal(ctx, correctAnswer, BX + PAD, BY + 62 + textH + 14, BW - PAD * 2);
  }
  if (timer > 0) {
    drawTimer(ctx, CW / 2, BY + 62 + textH + revH + 14, timer);
  }
}

// ── MCQ Question ──────────────────────────────────────────────────────────────
function drawMCQQuestion(ctx, state) {
  const { questionText, options, correctIdx, correctAnswer, revealAnswer, timer, isLive } = state;
  if (!isLive) return;

  const PAD = 120, BW = CW - 80, BX = 40;
  ctx.font = 'bold 24px JetBrains Mono,monospace';
  const lines = wrapText(ctx, questionText || '', BW - PAD * 2);
  const textH = lines.length * 54;
  const validOpts = (options || []).filter(Boolean);
  const optH = validOpts.length * 80 + (validOpts.length - 1) * 12;
  const revH = revealAnswer ? 98 : 0;
  const timerH = timer > 0 ? 120 : 0;
  const BH = 76 + textH + 24 + optH + revH + timerH + 30;
  const BY = Math.max(20, (CH - BH) / 2 );

  drawPanel(ctx, BX, BY, BW, BH, '◆   MULTIPLE CHOICE   ◆');

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 32px JetBrains Mono,monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, CW / 2, BY + 62 + i * 54));

  // Options — single column for portrait
  const oStartY = BY + 62 + textH + 24;
  drawMCQOptions(ctx, validOpts, correctIdx, revealAnswer, BX + PAD, oStartY, BW - PAD * 2);

  if (revealAnswer && correctAnswer) {
    drawAnswerReveal(ctx, correctAnswer, BX + PAD, oStartY + optH + 14, BW - PAD * 2);
  }
  if (timer > 0) {
    drawTimer(ctx, CW / 2, oStartY + optH + revH + 18, timer);
  }
}

function drawMCQOptions(ctx, opts, correctIdx, revealed, sx, sy, totalW) {
  const OH = 80, GAP = 12;
  opts.forEach((opt, i) => {
    const oy = sy + i * (OH + GAP);
    const col = OPT_COLS[i];
    const isC = revealed && i === correctIdx;
    const dim = revealed && i !== correctIdx;

    ctx.save();
    ctx.globalAlpha = dim ? 0.25 : 1;

    ctx.fillStyle = isC ? hexAlpha(col, 0.22) : 'rgba(0,0,0,0.55)';
    if (isC) { ctx.shadowColor = col; ctx.shadowBlur = 28; }
    roundRect(ctx, sx, oy, totalW, OH, 16); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = isC ? col : revealed ? '#252535' : hexAlpha(col, 0.45);
    ctx.lineWidth = isC ? 3 : 1.5;
    roundRect(ctx, sx, oy, totalW, OH, 16); ctx.stroke();

    // Badge circle
    const bx = sx + 34, by = oy + OH / 2;
    ctx.fillStyle = isC ? col : hexAlpha(col, 0.2);
    ctx.shadowColor = isC ? col : 'transparent';
    ctx.shadowBlur = isC ? 18 : 0;
    ctx.beginPath(); ctx.arc(bx, by, 28, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bx, by, 28, 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = isC ? '#000' : col;
    ctx.font = 'bold 18px Orbitron,monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(isC ? '✓' : OPT_LBLS[i], bx, by);

    // Option text
    ctx.fillStyle = isC ? '#fff' : '#ddd';
    ctx.font = `${isC ? 'bold ' : ''}24px JetBrains Mono,monospace`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    let txt = opt;
    const maxW = totalW - 90;
    while (ctx.measureText(txt).width > maxW && txt.length > 3) txt = txt.slice(0, -1);
    if (txt !== opt) txt += '…';
    ctx.fillText(txt, sx + 76, oy + OH / 2);

    ctx.restore();
  });
}

// ── Image Question ────────────────────────────────────────────────────────────
function drawImageQuestion(ctx, state) {
  const { questionText, imageObj, correctAnswer, revealAnswer, timer, isLive } = state;
  if (!isLive) return;

  const BW = CW - 80, BX = 40;
  const hasCaption = !!(questionText || '').trim();
  const revH = revealAnswer ? 98 : 0;
  const timerH = timer > 0 ? 120 : 0;
  const captionH = hasCaption ? 70 : 0;
  const BH = CH - 440 ;
  const BY = 320;

  drawPanel(ctx, BX, BY, BW, BH, '◆   CAN YOU SOLVE THIS?   ◆');

  if (imageObj) {
    const PAD = 30;
    // console.log(BW);
    
    const imgMaxW = BW - PAD * 2;
    const imgMaxH = BH - 62 - captionH - timerH - PAD;
    console.log(imgMaxW,imgMaxH);
    
    const ir = imageObj.width / imageObj.height;
    let iW = imgMaxW, iH = imgMaxW / ir;
    if (iH > imgMaxH) { iH = imgMaxH; iW = imgMaxH * ir; }
    const ix = BX + (BW - iW) / 2;
    const iy = BY + 62;

    ctx.save();
    roundRect(ctx, ix, iy, iW, iH, 16); ctx.clip();
    ctx.drawImage(imageObj, ix, iy, iW, iH);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,255,200,0.35)';
    ctx.lineWidth = 2;
    roundRect(ctx, ix, iy, iW, iH, 16); ctx.stroke();

    if (hasCaption) {
      ctx.fillStyle = '#ddd';
      ctx.font = 'bold 28px JetBrains Mono,monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(questionText, CW / 2, iy + iH + 14);
    }
    if (revealAnswer && correctAnswer) {
      drawAnswerReveal(ctx, correctAnswer, BX + PAD, iy + iH + captionH + 14, BW - PAD * 2);
    }
    if (timer > 0) {
      drawTimer(ctx, CW / 2, iy + iH + captionH + revH + 20, timer);
    }
  } else {
    ctx.fillStyle = '#1a1a2a';
    roundRect(ctx, BX + 30, BY + 62, BW - 60, BH - 120, 14); ctx.fill();
    ctx.fillStyle = '#444';
    ctx.font = '26px JetBrains Mono,monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('[ Upload an image in the control panel ]', CW / 2, CH / 2);
  }
}

// ── Winner Cards ──────────────────────────────────────────────────────────────
function drawWinners(ctx, winners) {
  console.log("winner added",winners);
  
  const now = Date.now();
  const CARD_W = CW - 64, CARD_H = 110;
  const active = winners.filter(w => (now - w.addedAt) / 1000 < 8.5);

  active.forEach((w, i) => {
    const age = (now - w.addedAt) / 1000;
    const tIn = easeBack(Math.min(1, age / 0.55));
    const tOut = age > 6.5 ? Math.min(1, (age - 6.5) / 0.8) : 0;
    const alpha = Math.min(1, tIn * 2.5) * (1 - tOut);
    const slideX = (1 - Math.min(1, tIn)) * (CARD_W + 80);

    const col = WIN_COLS[i % WIN_COLS.length];
    const rx = 32 + slideX;
    const ry = CH - 40 - (i + 1) * (CARD_H + 14);

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.fillStyle = 'rgba(5,5,14,0.97)';
    ctx.shadowColor = col; ctx.shadowBlur = 32;
    roundRect(ctx, rx, ry, CARD_W, CARD_H, 20); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = col; ctx.lineWidth = 2.5;
    roundRect(ctx, rx, ry, CARD_W, CARD_H, 20); ctx.stroke();

    // Avatar
    const g = ctx.createRadialGradient(rx + 42, ry + CARD_H / 2, 0, rx + 42, ry + CARD_H / 2, 32);
    g.addColorStop(0, col); g.addColorStop(1, hexAlpha(col, 0.4));
    ctx.fillStyle = g; ctx.shadowColor = col; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(rx + 42, ry + CARD_H / 2, 32, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000'; ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(w.username[0].toUpperCase(), rx + 42, ry + CARD_H / 2);

    // Name
    ctx.fillStyle = col;
    ctx.font = 'bold 22px Orbitron,monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'center';
    ctx.fillText(w.username, rx + 88, ry + CARD_H / 2);

    // Answer
    ctx.fillStyle = '#aaa';
    ctx.font = '18px JetBrains Mono,monospace';
    // ctx.fillText('✓ ' + String(w.answerLabel || w.answer).slice(0, 38), rx + 88, ry + 46);

    // Points badge
    const pbW = 120, pbH = 42;
    ctx.fillStyle = hexAlpha(col, 0.15);
    roundRect(ctx, rx + CARD_W - pbW - 14, ry + (CARD_H - pbH) / 2, pbW, pbH, 10); ctx.fill();
    ctx.strokeStyle = hexAlpha(col, 0.5); ctx.lineWidth = 1.2;
    roundRect(ctx, rx + CARD_W - pbW - 14, ry + (CARD_H - pbH) / 2, pbW, pbH, 10); ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = 'bold 20px JetBrains Mono,monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('+' + w.points + 'pts', rx + CARD_W - pbW / 2 - 14, ry + CARD_H / 2);

    ctx.restore();
  });

  return active;
}

// ── Particles ─────────────────────────────────────────────────────────────────
function spawnParticles(particles) {
  for (let i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * CW,
      y: CH + 10,
      vx: (Math.random() - 0.5) * 14,
      vy: -(Math.random() * 22 + 10),
      size: Math.random() * 12 + 3,
      color: PTL_COLS[Math.floor(Math.random() * PTL_COLS.length)],
      life: 1,
    });
  }
}

function drawParticles(ctx, particles) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.015;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawLeaderboard(ctx, leaderboard) {
  // leaderboard: [{ username, points }]
  const x = 35, y = 144, width = 320, rowH = 44, pad = 18;
  const height = pad * 2 + rowH * Math.max(leaderboard.length, 1) + 38;
  ctx.save();
  // Panel background
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "#0d0d1a";
  roundRect(ctx, x, y, width, height, 16); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#1e1e3a";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, width, height, 16); ctx.stroke();

  // Title
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 22px Orbitron,monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("🏆 LEADERBOARD", x + pad, y + pad);

  // Rows
  if (leaderboard.length === 0) {
    ctx.fillStyle = "#666";
    ctx.font = "16px JetBrains Mono,monospace";
    ctx.fillText("No scores yet", x + pad, y + pad + 38);
  } else {
    leaderboard.forEach((u, i) => {
      ctx.fillStyle = "#FFD700";
      ctx.font = "bold 18px Orbitron,monospace";
      ctx.fillText(`#${i + 1}`, x + pad, y + pad + 38 + i * rowH);

      ctx.fillStyle = "#e0e0ff";
      ctx.font = "bold 18px JetBrains Mono,monospace";
      ctx.fillText(`${u.username}`, x + pad + 54, y + pad + 38 + i * rowH);

      ctx.fillStyle = "#4ECDC4";
      ctx.font = "bold 18px JetBrains Mono,monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${u.points} pts`, x + width - pad, y + pad + 38 + i * rowH);
      ctx.textAlign = "left";
    });
  }
  ctx.restore();
}

// ── Winner count footer ───────────────────────────────────────────────────────
function drawFooter(ctx, count) {
  if (!count) return;
  ctx.fillStyle = 'rgba(0,255,200,0.55)';
  ctx.font = '26px JetBrains Mono,monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`🏆 ${count} correct answer${count > 1 ? 's' : ''} so far`, 36, CH - 30);
}

module.exports = {
  CW,
  CH,
  OPT_COLS,
  WIN_COLS,
  PTL_COLS,
  OPT_LBLS,
  roundRect,
  hexAlpha,
  easeBack,
  wrapText,
  drawBackground,
  drawLiveBadge,
  drawPanel,
  drawTimer,
  drawAnswerReveal,
  drawTextQuestion,
  drawMCQQuestion,
  drawImageQuestion,
  drawWinners,
  spawnParticles,
  drawParticles,
  drawFooter,
  drawLeaderboard,
};
