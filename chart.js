// Hand-drawn canvas charts, devicePixelRatio aware.
const Chart = (() => {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setup(cv) {
    const dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, r.width, r.height];
  }
  const state = new WeakMap();
  function line(cv, data, opt = {}) {
    const prev = state.get(cv); const t0 = performance.now();
    const animate = prev && !RM && data.points.length === prev.n + 1;
    state.set(cv, {n: data.points.length});
    const draw = (k) => {
      const [c, W, H] = setup(cv); c.clearRect(0, 0, W, H);
      const pts = data.points, start = data.start;
      const pad = {t: 34, b: 12, l: 0, r: 0};
      const vals = pts.map(p => p[1]).concat(start != null ? [start] : []);
      let lo = Math.min(...vals), hi = Math.max(...vals); if (!isFinite(lo)) { lo = 0; hi = 1; }
      if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
      const span = hi - lo; lo -= span * .1; hi += span * .1;
      const t0d = pts.length ? pts[0][0] : 0, t1d = pts.length ? pts[pts.length - 1][0] : 1;
      const X = t => pad.l + (W - pad.l - pad.r) * (t1d === t0d ? 1 : (t - t0d) / (t1d - t0d));
      const Y = v => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
      if (start != null) { c.setLineDash([3, 4]); c.strokeStyle = 'rgba(235,235,245,0.3)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(0, Y(start)); c.lineTo(W, Y(start)); c.stroke(); c.setLineDash([]); }
      if (pts.length < 2) return;
      let n = pts.length; let last = pts[n - 1];
      if (k < 1) { const a = pts[n - 2]; last = [a[0] + (last[0] - a[0]) * k, a[1] + (last[1] - a[1]) * k]; }
      const P = pts.slice(0, n - 1).concat([last]);
      const g = c.createLinearGradient(0, pad.t, 0, H); g.addColorStop(0, 'rgba(0,211,90,0.28)'); g.addColorStop(1, 'rgba(0,211,90,0)');
      c.beginPath(); P.forEach((p, i) => i ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1])));
      c.lineTo(X(last[0]), H); c.lineTo(X(P[0][0]), H); c.closePath(); c.fillStyle = g; c.fill();
      c.beginPath(); P.forEach((p, i) => i ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1])));
      c.strokeStyle = '#00d35a'; c.lineWidth = 2; c.lineJoin = 'round'; c.stroke();
      // marks, never overlap: a later mark moves up a row
      c.font = '600 12px -apple-system, "SF Pro Text", sans-serif'; const rows = [];
      (data.marks || []).forEach(m => {
        if (m.ts < t0d) return;
        const x = X(Math.min(m.ts, t1d)); const w = c.measureText(m.label).width + 14;
        let row = 0; while ((rows[row] || []).some(([a, b]) => x - w / 2 < b && x + w / 2 > a)) row++;
        (rows[row] = rows[row] || []).push([x - w / 2, x + w / 2]);
        const col = m.kind === 'bought' ? '#0a84ff' : m.kind === 'sold' ? '#00d35a' : '#ff453a';
        const y = 4 + row * 0; const yy = Math.max(2, pad.t - 26 - row * 22);
        c.globalAlpha = RM ? 1 : Math.min(1, k * 1.25);
        c.fillStyle = col; const x0 = Math.max(0, Math.min(W - w, x - w / 2));
        c.beginPath(); c.roundRect ? c.roundRect(x0, yy, w, 20, 10) : c.rect(x0, yy, w, 20); c.fill();
        c.fillStyle = m.kind === 'sold' ? '#000' : '#fff'; c.fillText(m.label, x0 + 7, yy + 14); c.globalAlpha = 1;
      });
    };
    if (!animate) return draw(1);
    const step = now => { const k = Math.min(1, (now - t0) / 250); draw(k); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function candles(cv, d) {
    const [c, W, H] = setup(cv); c.clearRect(0, 0, W, H);
    const cs = d.candles || []; if (!cs.length) { c.fillStyle = 'rgba(235,235,245,0.6)'; c.font = '15px -apple-system'; c.textAlign = 'center'; c.fillText('No price data yet', W / 2, H / 2); return; }
    const volH = H * .18, top = 8, bot = H - volH - 6;
    const lines = [d.exitLine].filter(v => v != null);
    let lo = Math.min(...cs.map(k => k.l), ...lines), hi = Math.max(...cs.map(k => k.h), ...lines);
    if (hi - lo < 1e-15) { hi *= 1.01; lo *= .99; }
    const Y = v => top + (bot - top) * (1 - (v - lo) / (hi - lo));
    const bw = Math.max(2, Math.min(10, W / cs.length * .7)); const step = W / cs.length;
    const vmax = Math.max(...cs.map(k => k.v), 1e-9);
    cs.forEach((k, i) => { const x = step * i + step / 2; const up = k.c >= k.o; c.strokeStyle = c.fillStyle = up ? '#00d35a' : '#ff453a';
      c.beginPath(); c.moveTo(x, Y(k.h)); c.lineTo(x, Y(k.l)); c.lineWidth = 1; c.stroke();
      const y1 = Y(Math.max(k.o, k.c)), y2 = Y(Math.min(k.o, k.c)); c.fillRect(x - bw / 2, y1, bw, Math.max(1, y2 - y1));
      c.globalAlpha = .35; const vh = volH * k.v / vmax; c.fillRect(x - bw / 2, H - vh, bw, vh); c.globalAlpha = 1; });
    if (d.exitLine != null) { c.setLineDash([6, 4]); c.strokeStyle = '#ff9f0a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, Y(d.exitLine)); c.lineTo(W, Y(d.exitLine)); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#ff9f0a'; c.font = '600 12px -apple-system'; c.fillText('Risk trailing stop', 6, Y(d.exitLine) - 5); }
  }
  function ring(cv, score) {
    const [c, W, H] = setup(cv); const r = Math.min(W, H) / 2 - 8, cx = W / 2, cy = H / 2;
    c.lineWidth = 10; c.lineCap = 'round'; c.strokeStyle = '#2c2c2e'; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
    if (score != null) { c.strokeStyle = score >= 70 ? '#00d35a' : '#ffd60a'; c.beginPath(); c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * score / 100); c.stroke(); }
    c.fillStyle = '#fff'; c.font = '600 34px -apple-system, "SF Pro Display"'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(score == null ? '–' : String(Math.round(score)), cx, cy);
  }
  return {line, candles, ring};
})();
