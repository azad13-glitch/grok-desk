(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
// --- token: only via URL fragment #t=..., then localStorage ---
(function () { const m = location.hash.match(/[#&]t=([^&]+)/); if (m) { localStorage.setItem('desk_token', decodeURIComponent(m[1])); history.replaceState(null, '', location.pathname + '#home'); } })();
(function () { const m = location.hash.match(/[#&]d=([^&]+)/); if (m) { localStorage.setItem('desk_data', decodeURIComponent(m[1])); history.replaceState(null, '', location.pathname + '#home'); } })();
const TOKEN = () => localStorage.getItem('desk_token') || '';
const DP = () => localStorage.getItem('desk_data') || '';
const PLANB = !!DP() || !/^(127\.0\.0\.1|localhost)$/.test(location.hostname);
const _cache = {};
async function getB(file) {
  if (!DP()) throw Object.assign(new Error('no data path'), {auth: true});
  const r = await fetch(`d/${encodeURIComponent(DP())}/${file}?_=${Math.floor(Date.now() / 30000)}`, {cache: 'no-store'});
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function apiB(path, opt) {
  if (opt.method && opt.method !== 'GET') throw new Error('Read-only here. Change settings in Telegram.');
  const u = new URL(path, location.href), p = u.pathname.replace(/^.*\/api\//, '');
  if (p === 'state') return getB('state.json');
  if (p === 'chart') { const c = await getB('chart.json'); return c[u.searchParams.get('range') || 'LIVE'] || c.LIVE; }
  if (p === 'activity') { const a = await getB('activity.json'); const b = +u.searchParams.get('before') || Infinity; return {rows: a.rows.filter(r => r.ts < b).slice(0, 30)}; }
  if (p === 'account') return (await getB('state.json')).account;
  let m;
  if ((m = p.match(/^agents\/(\w+)\/decisions$/))) return (await getB('state.json')).decisions[m[1]] || {rows: [], paused: false};
  if ((m = p.match(/^(coin|audit)\/(\w+)$/))) return (await getB(`coin/${m[2]}.json`))[m[1]];
  throw new Error('not available');
}
const S = {state: null, chart: null, range: 'LIVE', lastOk: null, failSince: null, retryIn: 0, activity: null, readTs: +localStorage.getItem('desk_read') || 0};
const money = v => v == null ? 'n/a' : (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const kfmt = v => v == null ? 'n/a' : v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? '$' + (v / 1e3).toFixed(1) + 'K' : '$' + v.toFixed(0);
const tm = ts => new Date(ts * 1000).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
const pfmt = p => p == null ? 'n/a' : p >= 1 ? '$' + p.toFixed(4) : '$' + p.toPrecision(4);

async function api(path, opt = {}) {
  if (PLANB) return apiB(path, opt);
  const r = await fetch(path, {...opt, headers: {'Authorization': 'Bearer ' + TOKEN(), 'Content-Type': 'application/json', ...(opt.headers || {})}, cache: 'no-store'});
  if (r.status === 401) throw Object.assign(new Error('unauthorized'), {auth: true});
  if (!r.ok) throw new Error((await r.text()) || r.status);
  return r.json();
}
function ok() { S.lastOk = Date.now(); S.failSince = null; $('#err').classList.add('hidden'); }
function fail(e) {
  if (!S.failSince) S.failSince = Date.now();
  const el = $('#err'); el.classList.remove('hidden');
  if (e && e.auth) { el.textContent = (PLANB ? 'Desk offline · open the link with your #d= code' : 'Desk offline · open the link with your token') + ' · last update ' + (S.lastOk ? new Date(S.lastOk).toLocaleTimeString() : 'never'); return; }
  el.textContent = `Desk offline · retrying in ${S.retryIn}s · last update ${S.lastOk ? new Date(S.lastOk).toLocaleTimeString() : 'never'}`;
}
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), 1800); }

// --- odometer: each changed digit rolls 600ms ease-out, 30ms stagger right to left ---
function odometer(el, text) {
  const old = el.dataset.v || ''; el.dataset.v = text;
  if (!old || old.length !== text.length || RM) { el.innerHTML = [...text].map(ch => /\d/.test(ch) ? `<span class="odo"><span style="transform:translateY(-${ch*1.05}em)">${digits()}</span></span>` : `<span>${esc(ch)}</span>`).join(''); return; }
  const cols = el.children; let k = 0;
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] !== old[i] && /\d/.test(text[i]) && cols[i] && cols[i].firstChild) {
      const s = cols[i].firstChild; s.style.transitionDelay = (k++ * 30) + 'ms'; s.style.transform = `translateY(-${text[i]*1.05}em)`;
    }
  }
}
function digits() { return '0123456789'.split('').map(d => `<div style="height:1.05em;line-height:1.05em">${d}</div>`).join(''); }

// --- views ---
const V = $('#view');
function skeleton(kind) {
  if (kind === 'home') return `<div class="nav"><div class="skel" style="width:36px;height:36px;border-radius:50%"></div><div class="skel" style="width:90px;height:18px"></div></div>
   <div class="g"><div class="skel" style="width:220px;height:70px;margin:6px 0"></div><div class="skel" style="width:120px;height:20px"></div></div>
   <div class="skel" style="height:240px;margin:12px 16px;border-radius:12px"></div><div class="g"><div class="skel" style="height:32px"></div></div>
   <div class="h2"><div class="skel" style="width:160px;height:24px"></div></div><div class="g"><div class="skel agentcard" style="border-radius:28px"></div></div>`;
  return `<div class="title"><div class="skel" style="width:160px;height:36px"></div></div>` + Array(5).fill('<div class="skel" style="height:60px;margin:8px 16px"></div>').join('');
}
function radius(el) { const w = el.getBoundingClientRect().width; el.style.borderRadius = (42 * w / 504) + 'px'; }

function agentCard(a, st) {
  const dot = `<span class="sdot ${a.alive ? '' : 'off'}"></span>`;
  let body = '';
  if (a.name === 'scanner') {
    body = `<div class="big" style="color:#64d2ff">${a.count}</div><div class="lbl">pools · ${a.waiting} in the waiting room</div><div class="feed">` +
      (a.feed.length ? a.feed.map(f => f.verdict === 'pass' ? `<div class="row"><a href="#coin/${f.mint}">${esc(f.name)} · liq ${kfmt(f.liq)}</a><span class="pos">→ auditor</span></div>`
        : `<div class="row"><span class="k">${esc(f.name)}</span><span class="t2">${esc(f.reason)}</span></div>`).join('') : '<div class="t2">Listening for graduations</div>') + '</div>';
  } else if (a.name === 'auditor') {
    const L = Array.from({length: 8}, (_, i) => a.layers.find(l => l.n === i + 1));
    const red = a.layers.find(l => !l.pass);
    body = `<div class="big">${a.count}</div><div class="lbl">taken apart · ${a.rejected} rejected</div>` +
      (a.coin ? `<div style="margin-top:12px;font-size:15px"><a href="#audit/${a.mint}">${esc(a.coin)}</a> · ${a.layers.length < 8 && !red ? 'taking apart...' : red ? '<span class="neg">' + esc(red.value) + '</span>' : '<span class="pos">8/8 → Executor</span>'}</div>` : '<div class="t2" style="margin-top:12px">No coin taken apart yet</div>') +
      `<div class="strips">${L.map(l => `<div class="strip ${l ? (l.pass ? 'ok' : 'bad') : ''}"></div>`).join('')}</div>`;
  } else if (a.name === 'analyst') {
    body = `<div class="lbl" style="margin-top:6px">Scoring${a.mode === 'rules' ? ' (rules)' : ''} · ${a.count} today</div><canvas class="ring" data-score="${a.score ?? ''}"></canvas>`;
  } else if (a.name === 'executor') {
    const l = a.last;
    body = `<div class="big" style="color:#00d35a">${a.count}</div><div class="lbl">trades</div>` +
      (l ? `<div style="margin-top:auto;font-size:15px">${esc(l.name)} · ${money(l.size)} · ${l.pct}% of stack</div><div class="bar"><i style="width:${l.status === 'bought' ? 100 : 40}%"></i></div><div class="lbl" style="margin-top:6px">${l.status === 'bought' ? '✓ Filled' : 'Executing... ' + (l.status === 'sent' ? 40 : 0) + '%'}</div>`
        : `<div class="lbl" style="margin-top:auto">${a.stackPct}% of stack per trade · waiting for a signal</div>`);
  } else {
    body = `<div class="big" style="color:#ff6b9a">${a.count ? 'Guarding' : 'Idle'}</div><div class="lbl">${a.count} open · last exit ${a.lastExit ? esc(a.lastExit) : 'none'}</div>
      <div style="margin-top:auto;display:flex;gap:8px"><span class="pill mono red">stop -${a.stopPct}%</span><span class="pill mono green">trail ${a.trailPct}%</span></div>`;
  }
  return `<div class="card agentcard" data-agent="${a.name}"><div class="ct">${dot}<span style="color:${a.color}">${a.title}</span></div>${body}</div>`;
}
function actRow(r) {
  const ic = {bought: ['#0a84ff', '↓'], sold: ['#00d35a', '↑'], stopped: ['#ff453a', '!'], rejected: ['#636366', '×']}[r.kind] || ['#636366', '·'];
  const href = r.kind === 'rejected' ? `#audit/${r.mint}` : `#coin/${r.mint}`;
  const cls = r.kind === 'sold' ? 'pos' : r.kind === 'stopped' ? 'neg' : r.kind === 'rejected' ? 't2' : '';
  return `<a class="row2" href="${href}"><div class="ic" style="background:${ic[0]}22;color:${ic[0]}">${ic[1]}</div><div class="mid"><div class="ti">${esc(r.title)}</div><div class="st">${esc(r.subtitle)}</div></div><div class="rt ${cls}">${esc(r.value)}</div></a>`;
}

async function home() {
  if (!S.state) V.innerHTML = skeleton('home');
  const st = S.state || await api('/api/state'); S.state = st;
  const ch = await api('/api/chart?range=' + S.range); S.chart = ch;
  const act = await api('/api/activity'); ok();
  const unread = act.rows.some(r => r.ts > S.readTs);
  V.innerHTML = `<div class="nav"><a class="avatar" href="#account">A</a><a class="navtitle" href="#agents">Grok Bot <span class="chev">›</span></a>
    <button class="iconbtn" id="sbtn" aria-label="Search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></button>
    <a class="iconbtn" href="#activity" aria-label="Activity"><svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 1112 0v5l2 2H4z"/><path d="M10 20a2 2 0 004 0"/></svg>${unread ? '<i class="dot"></i>' : ''}</a></div>
    <div class="search" id="search"><input placeholder="Name, symbol or mint" id="sq"></div><div id="sres"></div>
    <div class="bal"><div class="bignum" id="bal"></div>${st.mode === 'PAPER' ? '<span class="pill paper">PAPER</span>' : ''}</div>
    <div class="sub"><span class="${st.todayPct >= 0 ? 'pos' : 'neg'}">${st.todayPct >= 0 ? '+' : ''}${st.todayPct.toFixed(2)}%</span><span class="t2">today</span><span class="pill mult">${st.multiplier.toFixed(2)}×</span></div>
    <div class="chartwrap"><canvas id="chart"></canvas>${(ch.marks.length === 0) ? '<div class="empty-msg">Waiting for the first trade</div>' : ''}</div>
    <div class="ranges">${['LIVE', '1H', '4H', '1D', '1W', 'ALL'].map(r => `<button class="${r === S.range ? 'on' : ''}" data-r="${r}">${r}</button>`).join('')}</div>
    <div class="h2"><span>Agents · ${st.agents.filter(a => a.alive).length} running</span></div>
    <div class="carousel">${st.agents.map(a => agentCard(a, st)).join('')}</div>
    <div class="h2"><span>Activity</span><a href="#activity">See all</a></div>
    <div class="list">${act.rows.slice(0, 5).map(actRow).join('') || '<div class="placeholder">Nothing yet tonight</div>'}</div><div style="height:16px"></div>`;
  odometer($('#bal'), money(st.balance));
  Chart.line($('#chart'), ch);
  document.querySelectorAll('.agentcard').forEach(radius);
  document.querySelectorAll('canvas.ring').forEach(c => Chart.ring(c, c.dataset.score === '' ? null : +c.dataset.score));
  document.querySelectorAll('.ranges button').forEach(b => b.onclick = () => { S.range = b.dataset.r; home().catch(fail); });
  $('#sbtn').onclick = () => { $('#search').classList.toggle('on'); $('#sq').focus(); };
  $('#sq').oninput = e => search(e.target.value);
}
function search(q) {
  q = q.trim().toLowerCase(); const out = $('#sres'); if (!q) { out.innerHTML = ''; return; }
  const seen = new Map();
  (S.state.agents.find(a => a.name === 'scanner').feed || []).forEach(f => seen.set(f.mint, f.name));
  (S.activity || []).forEach(r => r.mint && seen.set(r.mint, r.title.replace(/^\w+ /, '')));
  const hits = [...seen].filter(([m, n]) => m.toLowerCase().includes(q) || (n || '').toLowerCase().includes(q));
  if (q.length >= 32 && !hits.length) hits.push([q, q.slice(0, 6)]);
  out.innerHTML = `<div class="list" style="margin-bottom:8px">${hits.map(([m, n]) => `<a class="row2" href="#coin/${m}"><div class="mid"><div class="ti">${esc(n)}</div><div class="st">${m}</div></div></a>`).join('') || '<div class="placeholder">No match</div>'}</div>`;
}
async function agents() {
  if (!S.state) V.innerHTML = skeleton();
  const st = await api('/api/state'); S.state = st;
  const dec = await Promise.all(st.agents.map(a => api(`/api/agents/${a.name}/decisions`))); ok();
  const riskOpen = st.agents.find(a => a.name === 'risk').count > 0;
  V.innerHTML = `<div class="title">Agents</div>` + st.agents.map((a, i) => `
    <div class="card" style="margin:0 16px 14px;border-radius:24px">
      <div style="display:flex;align-items:center;gap:10px"><span class="sdot ${a.alive ? '' : 'off'}"></span><b style="color:${a.color};font-size:20px;flex:1">${a.title}</b>
      <span class="t2" style="font-size:15px">${a.count} ${a.label}</span>
      <button class="toggle ${dec[i].paused ? '' : 'on'}" data-a="${a.name}" ${a.name === 'risk' && riskOpen ? 'disabled title="Locked while a position is open"' : ''} aria-label="pause or resume"></button></div>
      <div style="margin-top:10px">${dec[i].rows.length ? dec[i].rows.map(r => `<div class="vrow" style="padding:8px 0"><span class="t2">${tm(r.ts)}</span><a href="${esc(r.link)}" target="_blank" rel="noopener" style="flex:1;margin:0 10px">${esc(r.name)}</a><span class="${r.verdict === 'pass' || r.verdict === 'bought' ? 'pos' : 't2'}" style="text-align:right;max-width:55%">${esc(r.verdict)} · ${esc(r.reason)}</span></div>`).join('')
        : `<div class="t2" style="font-size:15px;padding:8px 0">${a.name === 'scanner' ? 'Listening for graduations' : a.name === 'auditor' ? 'No coin taken apart yet' : 'Nothing yet tonight'}</div>`}</div>
      <a href="#account" class="t2" style="display:block;margin-top:8px;font-size:15px">Settings ›</a></div>`).join('');
  document.querySelectorAll('.toggle[data-a]').forEach(b => b.onclick = async () => {
    const on = b.classList.contains('on'); const r = await api(`/api/agents/${b.dataset.a}/${on ? 'pause' : 'resume'}`, {method: 'POST'}); toast(r.result); agents();
  });
}
async function activity() {
  if (!S.activity) V.innerHTML = skeleton();
  const a = await api('/api/activity'); S.activity = a.rows; ok();
  if (a.rows[0]) { S.readTs = a.rows[0].ts; localStorage.setItem('desk_read', S.readTs); }
  V.innerHTML = `<div class="title">Activity</div><div class="list" id="al">${a.rows.map(actRow).join('') || '<div class="placeholder">Nothing yet tonight</div>'}</div>
   ${a.rows.length === 30 ? '<div class="g" style="margin-top:12px"><button class="btn gray" id="more">Load more</button></div>' : ''}`;
  const more = $('#more'); if (more) more.onclick = async () => { const b = await api('/api/activity?before=' + S.activity[S.activity.length - 1].ts); S.activity.push(...b.rows); $('#al').insertAdjacentHTML('beforeend', b.rows.map(actRow).join('')); if (b.rows.length < 30) more.remove(); };
}
let auditAnim = null;
async function audit(mint) {
  V.innerHTML = skeleton();
  const d = await api('/api/audit/' + mint); ok();
  const name = d.name || mint.slice(0, 6);
  V.innerHTML = `<div class="nav"><a class="iconbtn" href="javascript:history.back()">‹</a><div class="navtitle">${esc(name)} · Auditor</div></div>
   <div class="discs" id="discs">${d.layers.map((l, i) => `<div class="disc" data-i="${i}" style="top:${i * 26}px"></div>`).join('')}<div class="beam" id="beam"></div></div>
   <div class="verdict" id="vd"></div>
   <div class="list" id="vals">${d.layers.map(l => `<div class="vrow" data-n="${l.n}"><span>${l.n}. ${esc(l.name)}</span><span class="t3">…</span></div>`).join('')}</div>
   <div class="set" style="margin-top:16px;background:var(--c1);border-radius:14px;margin:16px"><label>Take apart before buying</label><button class="toggle ${d.enabled ? 'on' : ''}" id="aud"></button></div>
   <div class="bottombtn"><a class="btn green" href="${esc(d.coinUrl)}" target="_blank" rel="noopener">Open on FOMO</a></div>`;
  $('#aud').onclick = async e => {
    const on = e.target.classList.contains('on');
    if (on && !(confirm('Turn off the Auditor? Coins would go to the Analyst untested.') && confirm('Really turn it off?'))) return;
    await api('/api/settings', {method: 'POST', body: JSON.stringify({'auditor.enabled': !on})}); audit(mint);
  };
  // beam reads each layer top-down 350ms/layer, then 150ms to green/red. Only results the server sent.
  const discs = [...document.querySelectorAll('.disc')], beam = $('#beam'), rows = [...document.querySelectorAll('#vals .vrow')];
  const reveal = i => { const l = d.layers[i]; const dc = discs[7 - i] || discs[i];
    if (l.pass === true) dc.classList.add('ok'); else if (l.pass === false) dc.classList.add('bad');
    rows[i].lastElementChild.className = l.pass === true ? 'pos' : l.pass === false ? 'neg' : 't3'; rows[i].lastElementChild.textContent = (l.pass === true ? '✓ ' : l.pass === false ? '✗ ' : '') + l.value; };
  const verdict = () => {
    if (!d.layers.some(l => l.pass !== null)) { $('#vd').innerHTML = '<span class="t2">No coin taken apart yet</span>'; return; }
    $('#vd').innerHTML = d.reason ? `<span class="neg">Rejected · ${esc(d.reason)}</span><div class="t2" style="font-size:15px;font-weight:400;margin-top:4px">Grok Bot won't buy ${esc(name)}</div>`
      : `<span class="pos">Cleared · 8/8 parts</span><div class="t2" style="font-size:15px;font-weight:400;margin-top:4px">${d.sentUsd ? 'Sent to Executor · ' + money(d.sentUsd) : 'Sent to Executor'}</div>`;
  };
  if (RM) { d.layers.forEach((_, i) => reveal(i)); verdict(); return; }
  let i = 0; beam.style.opacity = 1;
  clearInterval(auditAnim);
  const tick = () => { if (i >= 8) { beam.style.opacity = 0; clearInterval(auditAnim); verdict(); return; }
    beam.style.top = ((7 - i) * 26 + 20) + 'px'; const k = i; setTimeout(() => reveal(k), 350 + 150 - 150); i++; };
  tick(); auditAnim = setInterval(tick, 500);
}
async function coin(mint) {
  V.innerHTML = skeleton();
  const d = await api('/api/coin/' + mint); ok(); const st = S.state || await api('/api/state');
  const name = d.name || mint.slice(0, 6); const p = d.position && !d.position.closed_at ? d.position : null;
  const age = d.migratedAt ? Math.round((Date.now() / 1000 - d.migratedAt) / 3600) + 'h old' : '';
  const since = p && d.price ? (100 * (d.price / p.entry_price - 1)) : null;
  V.innerHTML = `<div class="nav"><a class="iconbtn" href="javascript:history.back()">‹</a><div class="navtitle"></div>${st.mode === 'PAPER' ? '<span class="pill paper">PAPER</span>' : ''}</div>
   <div class="coinhead"><div style="flex:1"><div style="font-size:22px;font-weight:700">${esc(name)}</div><div class="t2" style="font-size:15px">${esc(d.symbol || '')} · Solana${age ? ' · ' + age : ''}</div></div>${d.shield ? `<a class="chip" href="#audit/${mint}">🛡 ${d.shield}</a>` : ''}</div>
   <div class="g"><div class="bignum" style="font-size:48px">${pfmt(d.price)}</div>${since != null ? `<div class="${since >= 0 ? 'pos' : 'neg'}" style="font-weight:600">${since >= 0 ? '▲' : '▼'} ${Math.abs(since).toFixed(2)}% since entry</div>` : ''}</div>
   <div class="chartwrap" style="height:220px"><canvas id="cc"></canvas></div>
   <div class="stats"><div><span class="t2">Market cap</span><b>${kfmt(d.stats.marketCap)}</b></div><div><span class="t2">Liquidity</span><b>${kfmt(d.stats.liquidity)}</b></div>
   <div><span class="t2">24h volume</span><b>${kfmt(d.stats.volume24h)}</b></div><div><span class="t2">Holders</span><b>${d.stats.holders ?? 'n/a'}</b></div></div>
   ${p ? `<div class="list"><div class="vrow"><span>Your position</span><span>${money(p.size_usd)} in · Executor</span></div>
     <div class="vrow"><span>Stop line</span><span class="neg">${pfmt(p.stopLine)} · -${p.stop_pct}%</span></div>
     <div class="vrow"><span>Trail line</span><span class="pos">${p.trailLine ? pfmt(p.trailLine) : 'starts at +' + st.agents.find(a => a.name === 'risk').trailPct + '%... '}</span></div>
     <div class="vrow"><span>Time left to timeout</span><span>${Math.max(0, Math.round((p.timeoutAt - Date.now() / 1000) / 60))} min</span></div></div>` : ''}
   <div class="bottombtn"><a class="btn ${p ? 'red' : 'green'}" href="${esc(d.coinUrl)}" target="_blank" rel="noopener">${p ? 'Sell on FOMO' : 'Buy on FOMO'}</a></div>`;
  Chart.candles($('#cc'), d);
}
async function account() {
  V.innerHTML = skeleton();
  const a = await api('/api/account'); ok(); const s = a.settings;
  const groups = {scanner: 'Scanner', auditor: 'Auditor', analyst: 'Analyst', executor: 'Executor', risk: 'Risk'};
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const rowsFor = g => Object.keys(s).filter(k => k.startsWith(g + '.')).map(k => {
    const v = s[k], rg = a.ranges[k], ch = a.choices[k];
    if (ch) return `<div class="set"><label>${k.split('.')[1]}</label><select data-k="${k}" style="background:var(--c2);color:#fff;border:0;border-radius:8px;height:36px;padding:0 8px">${ch.map(c => `<option ${String(c) === String(v) ? 'selected' : ''}>${c}</option>`).join('')}</select></div>`;
    if (!rg) return '';
    const st = rg[1] - rg[0] <= 1 ? 0.01 : rg[1] - rg[0] <= 100 ? 0.5 : 100;
    return `<div class="set"><label>${k.split('.')[1]}</label><input type="range" min="${rg[0]}" max="${rg[1]}" step="${st}" value="${v}" data-k="${k}"><input type="number" min="${rg[0]}" max="${rg[1]}" step="any" value="${v}" data-k="${k}"></div>`;
  }).join('');
  V.innerHTML = `<div class="title">Account</div>
   <div class="seg" id="mode"><button class="${a.mode === 'PAPER' ? 'on' : ''}" data-m="PAPER">PAPER</button><button class="${a.mode === 'LIVE' ? 'on' : ''}" data-m="LIVE">LIVE</button></div>
   <div class="grp">Stack</div><div class="list"><div class="set"><label>LIVE stack ($)</label><input type="number" value="${a.stack}" data-k="desk.stack"></div>
     <div class="set"><label>PAPER start stack ($)</label><input type="number" value="${a.paperStack}" data-k="desk.paper_start_stack"></div></div>
   <div class="grp">FOMO</div><div class="list"><a class="row2" href="${esc(a.profileUrl)}" target="_blank" rel="noopener"><div class="mid"><div class="ti">Your FOMO profile</div><div class="st">@${esc(a.fomoHandle)}</div></div><span class="t2">›</span></a>
     <button class="row2" id="invite" style="width:100%;background:none;border:0;color:inherit;text-align:left"><div class="mid"><div class="ti">Invite a friend</div><div class="st">Share your FOMO link</div></div><span class="t2">›</span></button></div>
   <div class="grp">Notifications</div><div class="list"><div class="row2"><div class="mid"><div class="ti">Telegram</div><div class="st">${a.telegram ? 'Connected' : 'Not connected'}</div></div><button class="pill green" id="tp" style="border:0;height:32px">Send test push</button></div>
     <div class="row2"><div class="mid"><div class="ti">Enable notifications</div><div class="st">${PLANB ? 'Not available with this hosting. Pushes come via Telegram.' : !window.isSecureContext ? 'Not available here: needs HTTPS hosting' : standalone ? 'Web push to this iPhone' : 'Open the app from your home screen first'}</div></div>${!PLANB && standalone && window.isSecureContext && 'PushManager' in window ? '<button class="pill green" id="wp" style="border:0;height:32px">Enable</button>' : ''}</div></div>
   ${Object.entries(groups).map(([g, t]) => `<div class="grp">${t}</div><div class="list">${rowsFor(g)}</div>`).join('')}<div style="height:24px"></div>`;
  if (PLANB) {
    document.querySelectorAll('[data-k], #mode button, #tp').forEach(el => { el.disabled = true; el.style.opacity = .5; });
    $('.title').insertAdjacentHTML('afterend', `<div class="list" style="margin-bottom:12px"><div class="row2"><div class="mid"><div class="ti">Read-only</div><div class="st" style="white-space:normal">Change settings, pause agents or switch PAPER/LIVE in Telegram, e.g. "set stop to 8". Data refreshes about every 6 min${a.publishedAt ? ' · updated ' + tm(a.publishedAt) : ''}.</div></div></div></div>`);
  }
  const save = async (k, v) => { try { const r = await api('/api/settings', {method: 'POST', body: JSON.stringify({[k]: v})}); toast(r[k]); } catch (e) { toast(String(e.message).slice(0, 80)); } };
  document.querySelectorAll('[data-k]').forEach(el => {
    el.onchange = () => { document.querySelectorAll(`[data-k="${el.dataset.k}"]`).forEach(o => o !== el && (o.value = el.value)); save(el.dataset.k, el.value); };
    if (el.type === 'range') el.oninput = () => { const n = el.nextElementSibling; if (n) n.value = el.value; };
  });
  document.querySelectorAll('#mode button').forEach(b => b.onclick = async () => {
    const m = b.dataset.m; let body = {mode: m};
    if (m === 'LIVE') { const t = prompt('Type LIVE to switch. Money only moves when you tap in FOMO.'); if (t !== 'LIVE') return; body.confirm = 'LIVE'; }
    try { await api('/api/mode', {method: 'POST', body: JSON.stringify(body)}); account(); } catch (e) { toast(String(e.message).slice(0, 90)); }
  });
  $('#invite').onclick = async () => {
    try { if (navigator.share) { await navigator.share({url: a.signupUrl}); return; } } catch (_) { return; }
    try { await navigator.clipboard.writeText(a.signupUrl); } catch (_) {} toast('Link copied');
  };
  $('#tp').onclick = async () => { const r = await api('/api/push', {method: 'POST', body: JSON.stringify({test: true})}); toast(r.telegram ? 'Sent' : 'Telegram failed'); };
  const wp = $('#wp'); if (wp) wp.onclick = async () => {
    const reg = await navigator.serviceWorker.register('sw.js'); if (await Notification.requestPermission() !== 'granted') return toast('Not allowed');
    const key = Uint8Array.from(atob(a.vapidPublic.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - a.vapidPublic.length % 4) % 4)), c => c.charCodeAt(0));
    const sub = await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: key});
    await api('/api/push', {method: 'POST', body: JSON.stringify(sub.toJSON())}); toast('Notifications on');
  };
}

// --- router ---
async function route() {
  const h = location.hash.replace(/^#/, '') || 'home'; const [r, arg] = h.split('/');
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === r));
  try { await ({home, agents, activity, account, audit: () => audit(arg), coin: () => coin(arg)}[r] || home)(); window.scrollTo(0, 0); }
  catch (e) { fail(e); if (!V.innerHTML.trim() || V.querySelector('.skel')) { if (S.state && r === 'home') { /* keep last numbers */ } } }
}
window.addEventListener('hashchange', route);

// --- live: SSE + refresh; on failure retry with countdown, keep last good numbers ---
let es = null, backoff = 3;
function live() {
  if (PLANB) { setInterval(async () => { const h = (location.hash || '#home').slice(1).split('/')[0]; if (['home', 'agents', 'activity', ''].includes(h)) { S.retryIn = 60; await route(); } }, 60000); return; }
  if (es) es.close();
  es = new EventSource('/api/stream?t=' + encodeURIComponent(TOKEN()));
  const refresh = debounce(async () => {
    try { const st = await api('/api/state'); S.state = st; ok();
      const h = (location.hash || '#home').slice(1).split('/')[0];
      if (h === 'home' || h === '') { const b = $('#bal'); if (b) { odometer(b, money(st.balance)); const ch = await api('/api/chart?range=' + S.range); Chart.line($('#chart'), ch);
        const car = $('.carousel'); if (car) { const x = car.scrollLeft; car.innerHTML = st.agents.map(a => agentCard(a, st)).join(''); car.scrollLeft = x; document.querySelectorAll('.agentcard').forEach(radius); document.querySelectorAll('canvas.ring').forEach(c => Chart.ring(c, c.dataset.score === '' ? null : +c.dataset.score)); } } }
    } catch (e) { fail(e); }
  }, 400);
  ['scan', 'audit_layer', 'verdict', 'signal', 'fill', 'exit', 'balance'].forEach(t => es.addEventListener(t, refresh));
  es.onopen = () => { backoff = 3; ok(); };
  es.onerror = () => { es.close(); S.retryIn = backoff; fail(); const iv = setInterval(() => { S.retryIn--; if (S.failSince) fail(); if (S.retryIn <= 0) { clearInterval(iv); backoff = Math.min(backoff * 2, 60); live(); } }, 1000); };
}
function debounce(f, ms) { let t; return () => { clearTimeout(t); t = setTimeout(f, ms); }; }
setInterval(() => { if (!S.failSince) return; }, 1000);
route(); live();
})();
