/* ================= 寵物消消樂（休閒手感） =================
   8×8 的寵物頭像，滑動（或點兩格）交換相鄰兩隻，三隻一樣連成一線就消掉。限時 60 秒，比分數。
   特殊方塊：連 4 個 → 整排消除（橫連消一橫排、直連消一直排）；T／L 形 → 炸彈（炸掉周圍 3×3）。
   分數換成農場金幣（每天有上限），每週排行。伺服器用 _match_max 擋假成績 */
const MT = { N: 8, TIME: 60, PETS: ['bunny1','mouse1','otter1','moth1','dragon1','fox1'],
             BG: ['#FFD9D6','#FFF0B0','#CFE9FF','#DDF3CB','#E8DCFF','#FFE1C4'], PT: 10, SP: 30 };
let MG = null;   // 進行中的一場

/* ---------- 大廳 ---------- */
async function openMatchLobby(tab){
  let I; try{ I = await rpc('farm_match_info'); }catch(e){ return toast(e.message); }
  tab = tab || 'all';
  const L = (tab==='all' ? I.top : I.friends) || [];
  const row = (x,i) => `<div class="rnr${x.me?' me':''}"><b>${x.rk||i+1}</b><img src="${avSrc(x.avatar)}" alt=""><span>${esc(x.nickname)}</span><em>${(+x.score).toLocaleString()} 分</em></div>`;
  const ends = I.ends ? new Date(+I.ends - (S.off||0)) : null;
  const rw = (I.rw||[]).map((r,i)=>`${['🥇','🥈','🥉'][i]} ${[r.gold?(+r.gold).toLocaleString()+' 金':'', r.gems?'💎'+r.gems:''].filter(Boolean).join('＋')}`).join('　');
  modal('🐾 寵物消消樂', `<div class="rnhd"><div><small>本週最佳</small><b>${I.best ? (+I.best).toLocaleString()+' 分' : '還沒玩'}</b>${I.best?`<small>全服第 ${I.rank} 名</small>`:''}</div>
      <div><small>今天換到的金幣</small><b>${(+I.today).toLocaleString()} / ${(+I.cap).toLocaleString()}</b><small>每 100 分＝${I.rate} 金</small></div></div>
    <button class="btn o" id="mtGo" style="width:100%;font-size:20px;padding:14px 0">▶ 開始（60 秒）</button>
    <div class="rhint" style="margin-top:8px">滑動交換相鄰的兩隻寵物，三隻一樣連成一線就消掉。連 4 隻會變成「整排消除」，排成 T 或 L 形會變成「炸彈」。不限次數，金幣每天最多換 ${(+I.cap).toLocaleString()}；每週一結算，全服前 3 名有獎勵和一週稱號：${rw}</div>
    ${I.last && I.last.length ? `<div class="rnlast">上週：${I.last.map(w=>`${['🥇','🥈','🥉'][w.rk-1]} ${esc(w.nickname)}（${(+w.score).toLocaleString()} 分）`).join('　')}</div>` : ''}
    <div class="snav" style="margin-top:8px"><button data-mt="all" class="${tab==='all'?'on':''}">🌏 本週全服</button><button data-mt="fr" class="${tab==='fr'?'on':''}">👫 好友</button>${ends?`<span class="rnend">${ends.getMonth()+1}/${ends.getDate()} 00:00 結算</span>`:''}</div>
    <div class="rnl">${L.length ? L.map(row).join('') : '<div class="empty">這週還沒有人玩，搶第一！</div>'}</div>`,
    [['回寵物娛樂廳','sub',()=>openHall('fun')]]);
  $('mtGo').onclick = matchStart;
  document.querySelectorAll('#md [data-mt]').forEach(b=>b.onclick=()=>openMatchLobby(b.dataset.mt));
}

/* ---------- 盤面邏輯 ---------- */
let mtId = 0;
const mtRand = () => Math.floor(Math.random() * MT.PETS.length);
function mtNew(t){ return { t: t == null ? mtRand() : t, sp: null, id: ++mtId }; }
function mtAt(b, r, c){ return r >= 0 && r < MT.N && c >= 0 && c < MT.N ? b[r][c] : null; }
// 找出所有連線：每條 { cells:[[r,c]...], dir:'h'|'v' }
function mtRuns(b){
  const runs = [];
  for(let r = 0; r < MT.N; r++){ let c = 0; while(c < MT.N){ const t = b[r][c] && b[r][c].t; let e = c + 1; while(e < MT.N && b[r][e] && b[r][e].t === t) e++; if(t != null && e - c >= 3) runs.push({ dir: 'h', cells: Array.from({length: e - c}, (_, k) => [r, c + k]) }); c = e; } }
  for(let c = 0; c < MT.N; c++){ let r = 0; while(r < MT.N){ const t = b[r][c] && b[r][c].t; let e = r + 1; while(e < MT.N && b[e][c] && b[e][c].t === t) e++; if(t != null && e - r >= 3) runs.push({ dir: 'v', cells: Array.from({length: e - r}, (_, k) => [r + k, c]) }); r = e; } }
  return runs;
}
// 有沒有可以走的步（順便回傳一步當提示）
function mtHint(b){
  for(let r = 0; r < MT.N; r++) for(let c = 0; c < MT.N; c++) for(const [dr, dc] of [[0,1],[1,0]]){
    const r2 = r + dr, c2 = c + dc; if(r2 >= MT.N || c2 >= MT.N) continue;
    [b[r][c], b[r2][c2]] = [b[r2][c2], b[r][c]]; const ok = mtRuns(b).length > 0; [b[r][c], b[r2][c2]] = [b[r2][c2], b[r][c]];
    if(ok) return [[r, c], [r2, c2]];
  }
  return null;
}
function mtFresh(){
  for(;;){
    const b = Array.from({length: MT.N}, () => Array(MT.N).fill(null));
    for(let r = 0; r < MT.N; r++) for(let c = 0; c < MT.N; c++){
      let t; do{ t = mtRand(); } while((c >= 2 && b[r][c-1].t === t && b[r][c-2].t === t) || (r >= 2 && b[r-1][c].t === t && b[r-2][c].t === t));
      b[r][c] = mtNew(t);
    }
    if(mtHint(b)) return b;
  }
}

/* ---------- 開始一場 ---------- */
async function matchStart(){
  let s; try{ s = await rpc('farm_match_start'); }catch(e){ return toast(e.message); }
  closeModal();
  let el = $('match'); if(!el){ el = document.createElement('div'); el.id = 'match'; document.body.appendChild(el); }
  gameTouchLock(el); try{ scrollTo(0, 0); }catch(e){}
  el.innerHTML = `<div class="mthud"><span id="mtS">0 分</span><span class="mttime"><i id="mtT"></i><b id="mtTx">60</b></span></div><button class="mtx" id="mtX">✕</button>
    <div class="mtboard" id="mtB"></div><div id="mtMsg" class="rnmsg">滑動交換寵物，開始！</div><div id="mtEnd"></div>`;
  el.classList.add('on'); document.body.classList.add('mjon');
  el.style.backgroundImage = `url(${A('backdrop')}), linear-gradient(#3f9be8, #8fcdfb 55%, #d6efff)`;
  MG = { id: s.id, b: mtFresh(), score: 0, t0: 0, started: false, over: false, busy: false, sel: null, idle: performance.now(), els: {}, S: 40 };
  MG.fit = () => matchLayout(); addEventListener('resize', MG.fit);
  matchLayout(true);
  const B = $('mtB');
  let down = null;
  B.addEventListener('pointerdown', e => { const rc = matchCell(e); if(!rc) return; e.preventDefault(); down = { rc, x: e.clientX, y: e.clientY, moved: false }; });
  B.addEventListener('pointermove', e => { if(!down || down.moved) return; const dx = e.clientX - down.x, dy = e.clientY - down.y, th = MG.S * 0.35;
    if(Math.abs(dx) < th && Math.abs(dy) < th) return;
    down.moved = true; const [r, c] = down.rc, to = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c];
    matchSel(null); matchTry(down.rc, to); });
  const up = () => { if(down && !down.moved) matchTap(down.rc); down = null; };
  B.addEventListener('pointerup', up); B.addEventListener('pointercancel', () => { down = null; });
  $('mtX').onclick = () => { if(!MG || MG.over) return; if(!MG.started) return matchQuit(); matchEnd(); };
  MG.tick = setInterval(matchTick, 200);
}
// 版面：直式盤面在上面寬度塞滿；橫式盤面在中間、分數在左邊
function matchLayout(first){
  const g = MG; if(!g) return; const w = innerWidth, h = innerHeight, port = h > w * 1.1, el = $('match');
  el.classList.toggle('port', port);
  const size = port ? Math.min(w - 20, h - 230, 560) : Math.min(h - 70, w - 340, 560);
  g.S = size / MT.N;
  const B = $('mtB'); Object.assign(B.style, { width: size + 'px', height: size + 'px', left: (w - size) / 2 + 'px', top: (port ? Math.max(110, (h - size) / 2 - 20) : (h - size) / 2 + 10) + 'px' });
  matchDraw(first);
}
function matchCell(e){
  const B = $('mtB'), r0 = B.getBoundingClientRect(), c = Math.floor((e.clientX - r0.left) / MG.S), r = Math.floor((e.clientY - r0.top) / MG.S);
  return r >= 0 && r < MT.N && c >= 0 && c < MT.N ? [r, c] : null;
}
function matchGo(){ const g = MG; if(!g || g.started) return; g.started = true; g.t0 = performance.now(); $('mtMsg').style.display = 'none'; }

/* ---------- 畫（每隻寵物一個 div，用 transform 移動，CSS 做動畫） ---------- */
function matchDraw(noAnim){
  const g = MG, B = $('mtB'), S = g.S, seen = {};
  for(let r = 0; r < MT.N; r++) for(let c = 0; c < MT.N; c++){
    const x = g.b[r][c]; if(!x) continue; seen[x.id] = 1;
    let d = g.els[x.id];
    if(!d){ d = document.createElement('div'); d.className = 'mtc'; d.innerHTML = `<img src="${chrSrc(MT.PETS[x.t])}" alt=""><b></b>`;
      d.style.setProperty('--bg', MT.BG[x.t]); B.appendChild(d); g.els[x.id] = d;
      const from = x.from != null ? x.from : r; d.style.transition = 'none'; d.style.transform = `translate(${c*S}px,${from*S}px)`; d.offsetWidth; d.style.transition = ''; }
    d.style.width = d.style.height = S + 'px';
    if(noAnim) d.style.transition = 'none';
    d.style.transform = `translate(${c*S}px,${r*S}px)`;
    if(noAnim){ d.offsetWidth; d.style.transition = ''; }
    d.dataset.sp = x.sp || ''; d.classList.toggle('sel', !!(g.sel && g.sel[0]===r && g.sel[1]===c));
    delete x.from;
  }
  for(const id in g.els) if(!seen[id] && !g.els[id].classList.contains('pop')){ g.els[id].remove(); delete g.els[id]; }
}
function matchSel(rc){ MG.sel = rc; matchDraw(); }
function matchTap(rc){
  const g = MG; if(g.busy || g.over) return;
  if(g.sel && Math.abs(g.sel[0]-rc[0]) + Math.abs(g.sel[1]-rc[1]) === 1){ const a = g.sel; matchSel(null); return matchTry(a, rc); }
  matchSel(g.sel && g.sel[0]===rc[0] && g.sel[1]===rc[1] ? null : rc);
}
const mtWait = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 交換 → 消除 → 掉落 → 連鎖 ---------- */
async function matchTry(a, b2){
  const g = MG; if(!g || g.busy || g.over) return;
  if(b2[0] < 0 || b2[0] >= MT.N || b2[1] < 0 || b2[1] >= MT.N) return;
  matchGo(); if(g.over) return;
  g.busy = true; g.idle = performance.now(); matchHintOff();
  const B = g.b; [B[a[0]][a[1]], B[b2[0]][b2[1]]] = [B[b2[0]][b2[1]], B[a[0]][a[1]]];
  matchDraw(); try{ sfx('tap'); }catch(e){} await mtWait(170); if(!MG) return;
  let runs = mtRuns(B);
  if(!runs.length){ [B[a[0]][a[1]], B[b2[0]][b2[1]]] = [B[b2[0]][b2[1]], B[a[0]][a[1]]]; matchDraw(); await mtWait(170); if(MG) g.busy = false; return; }
  let swap = [a, b2], chain = 0;
  while(runs.length && MG){
    chain++;
    matchClear(runs, swap); swap = null;
    try{ sfx(chain > 1 ? 'coin' : 'harvest'); }catch(e){}
    await mtWait(230); if(!MG) return;
    matchFall(); await mtWait(260); if(!MG) return;
    runs = mtRuns(B);
  }
  if(!mtHint(B)){ $('mtMsg').textContent = '沒有步了，重新洗牌！'; $('mtMsg').style.display = ''; g.b = mtFresh(); for(const id in g.els){ g.els[id].remove(); } g.els = {}; for(let r=0;r<MT.N;r++) for(let c=0;c<MT.N;c++) g.b[r][c].from = r - MT.N; matchDraw(); await mtWait(700); if(MG) $('mtMsg').style.display = 'none'; }
  if(MG){ g.busy = false; g.idle = performance.now(); if(g.timeUp) matchEnd(); }
}
// 消掉連線，連 4 隻變整排、T/L 形變炸彈；碰到特殊方塊會連帶引爆
function matchClear(runs, swap){
  const g = MG, B = g.b, key = (r, c) => r * 10 + c, kill = new Map(), make = [];
  const inSwap = (r, c) => swap && swap.some(([sr, sc]) => sr === r && sc === c);
  // T／L：有格子同時在橫連和直連裡
  const cnt = new Map(); runs.forEach(u => u.cells.forEach(([r, c]) => cnt.set(key(r, c), (cnt.get(key(r, c)) || 0) + 1)));
  const used = new Set();
  runs.forEach(u => { const x = u.cells.find(([r, c]) => cnt.get(key(r, c)) > 1); if(x && !used.has(key(...x))){ used.add(key(...x)); make.push({ r: x[0], c: x[1], sp: 'b', t: B[x[0]][x[1]].t }); } });
  runs.forEach(u => { if(u.cells.length < 4 || u.cells.some(([r, c]) => used.has(key(r, c)))) return;
    const at = u.cells.find(([r, c]) => inSwap(r, c)) || u.cells[Math.floor(u.cells.length / 2) - 1]; make.push({ r: at[0], c: at[1], sp: u.dir, t: B[at[0]][at[1]].t }); });
  runs.forEach(u => u.cells.forEach(([r, c]) => kill.set(key(r, c), [r, c])));
  // 連帶引爆特殊方塊
  const q = [...kill.values()], boom = new Set();
  while(q.length){ const [r, c] = q.pop(), x = B[r][c]; if(!x || !x.sp || boom.has(x.id)) continue; boom.add(x.id);
    let area = [];
    if(x.sp === 'h') area = Array.from({length: MT.N}, (_, k) => [r, k]);
    else if(x.sp === 'v') area = Array.from({length: MT.N}, (_, k) => [k, c]);
    else for(let dr = -1; dr <= 1; dr++) for(let dc = -1; dc <= 1; dc++) if(mtAt(B, r+dr, c+dc)) area.push([r+dr, c+dc]);
    area.forEach(([rr, cc]) => { if(!kill.has(key(rr, cc))){ kill.set(key(rr, cc), [rr, cc]); q.push([rr, cc]); } });
    matchFx(x.sp, r, c);
  }
  make.forEach(m => kill.delete(key(m.r, m.c)));
  let n = 0;
  kill.forEach(([r, c]) => { const x = B[r][c]; if(!x) return; n++; const d = g.els[x.id]; if(d){ d.classList.add('pop'); setTimeout(() => d.remove(), 260); delete g.els[x.id]; } B[r][c] = null; });
  make.forEach(m => { const old = B[m.r][m.c]; if(old && g.els[old.id]){ g.els[old.id].remove(); delete g.els[old.id]; } const x = mtNew(m.t); x.sp = m.sp; B[m.r][m.c] = x; });
  const add = n * MT.PT + boom.size * MT.SP + make.length * MT.SP;
  g.score += add; $('mtS').textContent = `${g.score.toLocaleString()} 分`;
  if(add){ const f = document.createElement('div'); f.className = 'mtpop'; f.textContent = '+' + add; const [r, c] = (runs[0].cells[1] || runs[0].cells[0]);
    Object.assign(f.style, { left: (c + 0.5) * g.S + 'px', top: r * g.S + 'px' }); $('mtB').appendChild(f); setTimeout(() => f.remove(), 800); }
  matchDraw();
}
function matchFx(sp, r, c){
  const g = MG, f = document.createElement('div'), S = g.S;
  f.className = 'mtfx ' + sp;
  if(sp === 'h') Object.assign(f.style, { left: 0, top: r * S + S * 0.3 + 'px', width: MT.N * S + 'px', height: S * 0.4 + 'px' });
  else if(sp === 'v') Object.assign(f.style, { top: 0, left: c * S + S * 0.3 + 'px', height: MT.N * S + 'px', width: S * 0.4 + 'px' });
  else Object.assign(f.style, { left: (c - 1) * S + 'px', top: (r - 1) * S + 'px', width: S * 3 + 'px', height: S * 3 + 'px' });
  $('mtB').appendChild(f); setTimeout(() => f.remove(), 450); try{ sfx('poof'); }catch(e){}
}
function matchFall(){
  const g = MG, B = g.b;
  for(let c = 0; c < MT.N; c++){
    let w = MT.N - 1;
    for(let r = MT.N - 1; r >= 0; r--) if(B[r][c]){ if(w !== r){ B[w][c] = B[r][c]; B[r][c] = null; } w--; }
    const k = w + 1; for(let r = w; r >= 0; r--){ const x = mtNew(); x.from = r - k; B[r][c] = x; }
  }
  matchDraw();
}
function matchHintOff(){ document.querySelectorAll('#mtB .mtc.hint').forEach(d => d.classList.remove('hint')); }

/* ---------- 計時 ---------- */
function matchTick(){
  const g = MG; if(!g || g.over) return;
  const now = performance.now(), left = g.started ? Math.max(0, MT.TIME - (now - g.t0) / 1000) : MT.TIME;
  $('mtT').style.width = (left / MT.TIME * 100) + '%'; $('mtTx').textContent = Math.ceil(left);
  $('mtT').classList.toggle('lo', left <= 10);
  if(g.started && left <= 0){ g.timeUp = true; if(!g.busy) matchEnd(); return; }
  if(!g.busy && now - g.idle > 5000 && !document.querySelector('#mtB .mtc.hint')){ const h = mtHint(g.b); if(h) h.forEach(([r, c]) => { const d = g.els[g.b[r][c].id]; if(d) d.classList.add('hint'); }); }
}

/* ---------- 結束 ---------- */
async function matchEnd(){
  const g = MG; if(!g || g.over) return; g.over = true; clearInterval(g.tick); try{ sfx('lvup'); }catch(e){}
  const score = g.score;
  let res = null, err = null;
  try{ res = await rpc('farm_match_end', { p_id: g.id, p_score: score }); if(res.state){ applyState(res.state); try{ refresh(); }catch(e){} } }catch(e){ err = e.message; }
  if(!MG) return;
  $('mtEnd').innerHTML = `<div class="rnres"><h3>${res && res.newbest ? '🎉 新紀錄！' : '時間到！'}</h3>
    <div class="rnbig">${score.toLocaleString()} <small>分</small></div>
    ${res ? `<div class="rnline">獲得 <b>${(+res.gold).toLocaleString()}</b> 農場金幣${res.capped ? `<small>（今天已經換滿 ${(+res.cap).toLocaleString()} 金）</small>` : `<small>（今天 ${(+res.today).toLocaleString()} / ${(+res.cap).toLocaleString()}）</small>`}</div>
      <div class="rnline">本週最佳 ${(+res.best).toLocaleString()} 分・全服第 ${res.rank} 名</div>` : `<div class="rnline" style="color:#D9534F">${esc(err||'結算失敗')}</div>`}
    <div class="rnbtn"><button class="btn o" id="mtAgain">再玩一次</button><button class="btn sub" id="mtBack">回大廳</button></div></div>`;
  $('mtAgain').onclick = () => { matchQuit(true); matchStart(); };
  $('mtBack').onclick = () => { matchQuit(); openMatchLobby(); };
}
function matchQuit(keep){
  const g = MG; MG = null;
  if(g){ clearInterval(g.tick); removeEventListener('resize', g.fit); }
  const el = $('match'); if(el){ el.classList.remove('on'); el.innerHTML = ''; }
  if(!keep) document.body.classList.remove('mjon');
}
