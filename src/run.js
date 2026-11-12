/* ================= 寵物跑酷（休閒手感） =================
   自己的寵物在田埂上往前跑：點一下跳、空中再點一下二段跳。撞到稻草堆、蘑菇、南瓜、水坑、烏鴉就結束。
   撿到的金幣換成農場金幣（每天有上限），距離每週排行。速度規則要跟伺服器的 _run_maxm 一致 */
const RUN = { V0: 260, ACC: 6, VMAX: 650, PX_M: 40, G: 2100, J1: 760, J2: 680, LH: 400, GY: 322 };
let RN = null;   // 進行中的一場

// iPhone 會無視 maximum-scale：連點畫面會被當成「點兩下放大」，整個畫面跑掉。小遊戲的畫面上把觸控的預設動作擋掉（按鈕除外）
function gameTouchLock(el){
  if(el.dataset.lock) return; el.dataset.lock = '1';
  const f = e => { if(e.target.closest && e.target.closest('button,.rnres')) return; if(e.cancelable) e.preventDefault(); };
  el.addEventListener('touchstart', f, { passive: false });
  el.addEventListener('touchend', f, { passive: false });
  el.addEventListener('touchmove', e => { if(e.cancelable) e.preventDefault(); }, { passive: false });
  el.addEventListener('dblclick', e => e.preventDefault());
  el.addEventListener('gesturestart', e => e.preventDefault());
}
function runImg(src){ const i = new Image(); i.src = src; return i; }
const RUN_IMG = {};
function runAssets(){
  if(!RUN_IMG.bg){ RUN_IMG.bg = runImg(A('bg_forest')); RUN_IMG.hay = runImg(A('dc_hay')); RUN_IMG.mush = runImg(A('dc_mush')); RUN_IMG.pump = runImg(A('dc_pumpkin')); RUN_IMG.coin = runImg(A('i_coin')); }
  RUN_IMG.pet = runImg(chrSrc((S && S.me && S.me.chara) || 'bunny1'));
}

/* ---------- 大廳 ---------- */
async function openRunLobby(tab){
  let I; try{ I = await rpc('farm_run_info'); }catch(e){ return toast(e.message); }
  tab = tab || 'all';
  const L = (tab==='all' ? I.top : I.friends) || [];
  const row = (x,i) => `<div class="rnr${x.me?' me':''}"><b>${x.rk||i+1}</b><img src="${avSrc(x.avatar)}" alt=""><span>${esc(x.nickname)}</span><em>${(+x.dist).toLocaleString()} 公尺</em></div>`;
  const ends = I.ends ? new Date(+I.ends - (S.off||0)) : null;
  const rw = (I.rw||[]).map((r,i)=>`${['🥇','🥈','🥉'][i]} ${[r.gold?(+r.gold).toLocaleString()+' 金':'', r.gems?'💎'+r.gems:''].filter(Boolean).join('＋')}`).join('　');
  modal('🏃 寵物跑酷', `<div class="rnhd"><div><small>本週最佳</small><b>${I.best ? (+I.best).toLocaleString()+' 公尺' : '還沒跑'}</b>${I.best?`<small>全服第 ${I.rank} 名</small>`:''}</div>
      <div><small>今天換到的金幣</small><b>${(+I.today).toLocaleString()} / ${(+I.cap).toLocaleString()}</b><small>撿 1 枚＝${I.rate} 金</small></div></div>
    <button class="btn o" id="rnGo" style="width:100%;font-size:20px;padding:14px 0">▶ 開始跑</button>
    <div class="rhint" style="margin-top:8px">點一下跳，空中再點一下二段跳（電腦可以按空白鍵）。不限次數，金幣每天最多換 ${(+I.cap).toLocaleString()}；每週一結算，全服前 3 名有獎勵和一週稱號：${rw}</div>
    ${I.last && I.last.length ? `<div class="rnlast">上週：${I.last.map(w=>`${['🥇','🥈','🥉'][w.rk-1]} ${esc(w.nickname)}（${(+w.dist).toLocaleString()} 公尺）`).join('　')}</div>` : ''}
    <div class="snav" style="margin-top:8px"><button data-rt="all" class="${tab==='all'?'on':''}">🌏 本週全服</button><button data-rt="fr" class="${tab==='fr'?'on':''}">👫 好友</button>${ends?`<span class="rnend">${ends.getMonth()+1}/${ends.getDate()} 00:00 結算</span>`:''}</div>
    <div class="rnl">${L.length ? L.map(row).join('') : '<div class="empty">這週還沒有人跑，搶第一！</div>'}</div>`,
    [['回寵物娛樂廳','sub',()=>openHall('fun')]]);
  $('rnGo').onclick = runStart;
  document.querySelectorAll('#md [data-rt]').forEach(b=>b.onclick=()=>openRunLobby(b.dataset.rt));
}

/* ---------- 開始一場 ---------- */
async function runStart(){
  let s; try{ s = await rpc('farm_run_start'); }catch(e){ return toast(e.message); }
  closeModal(); runAssets();
  let el = $('run'); if(!el){ el = document.createElement('div'); el.id = 'run'; document.body.appendChild(el); }
  gameTouchLock(el); try{ scrollTo(0, 0); }catch(e){}
  el.innerHTML = `<canvas id="rnC"></canvas><div class="rnhud"><span id="rnD">0 公尺</span><span id="rnCo"><img src="${A('i_coin')}" alt="">0</span><button id="rnX">✕</button></div><div id="rnMsg" class="rnmsg">點畫面開始！</div><div id="rnEnd"></div>`;
  el.classList.add('on'); document.body.classList.add('mjon');
  RN = { id: s.id, t: 0, px: 0, coins: 0, y: RUN.GY, vy: 0, jumps: 0, obs: [], cn: [], pw: [], next: 500, nextC: 300, nextP: 9000 + Math.random()*6000,
         mag: 0, star: 0, over: false, started: false, last: 0, bgx: 0, flip: 0, sfxT: 0 };
  const cv = $('rnC'), fit = () => { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; cv.style.width = innerWidth+'px'; cv.style.height = innerHeight+'px'; };
  fit(); RN.fit = fit; addEventListener('resize', fit);
  const tap = e => { if(e && e.target && e.target.id === 'rnX') return; if(e && e.cancelable) e.preventDefault(); runJump(); };
  RN.tap = tap; RN.key = e => { if(e.code === 'Space' || e.code === 'ArrowUp'){ e.preventDefault(); runJump(); } };
  cv.addEventListener('pointerdown', tap); $('rnMsg').addEventListener('pointerdown', tap); addEventListener('keydown', RN.key);
  $('rnX').onclick = () => { if(!RN || RN.over) return; if(!RN.started) return runQuit(); runDie(); };
  requestAnimationFrame(runLoop);
}
function runJump(){
  const r = RN; if(!r || r.over) return;
  if(!r.started){ r.started = true; r.last = performance.now(); $('rnMsg').style.display = 'none'; }
  if(r.jumps === 0 && r.y >= RUN.GY - 0.5){ r.vy = -RUN.J1; r.jumps = 1; try{ sfx('tap'); }catch(e){} }
  else if(r.jumps === 1){ r.vy = -RUN.J2; r.jumps = 2; try{ sfx('seed'); }catch(e){} }
}

/* ---------- 產生障礙、金幣、道具 ---------- */
function runSpawn(r, W){
  const v = Math.min(RUN.VMAX, RUN.V0 + RUN.ACC * r.t), x = W + 60;
  if(r.px >= r.next){
    const kinds = ['hay','hay','mush','pump','puddle'].concat(r.t > 15 ? ['crow','crow'] : []);
    const k = kinds[Math.floor(Math.random()*kinds.length)];
    const o = { k, x, w: 0, h: 0, y: RUN.GY, dx: 0, rot: 0 };
    if(k==='hay'){ o.w = 64; o.h = 58; }
    else if(k==='mush'){ o.w = 56; o.h = 80; }
    else if(k==='pump'){ o.w = 52; o.h = 48; o.dx = 110; }
    else if(k==='puddle'){ o.w = 86; o.h = 10; }
    else { o.w = 50; o.h = 34; o.y = RUN.GY - 92; o.dx = 70; }
    r.obs.push(o);
    if(Math.random() < 0.55 && k!=='crow'){ for(let i=0;i<5;i++){ const a = i/4; r.cn.push({ x: x - 70 + a*(o.w+140), y: RUN.GY - 70 - Math.sin(a*Math.PI)*95 }); } }   // 障礙上方一道弧線金幣
    r.next = r.px + v * (0.95 + Math.random()*0.9) + (k==='mush' ? 60 : 0);
  }
  if(r.px >= r.nextC){
    const n = 4 + Math.floor(Math.random()*5), y = RUN.GY - (Math.random() < 0.7 ? 28 : 120);
    for(let i=0;i<n;i++) r.cn.push({ x: x + 260 + i*36, y });
    r.nextC = r.px + 600 + Math.random()*700;
  }
  if(r.t*1000 >= r.nextP){ r.pw.push({ k: Math.random() < 0.55 ? 'mag' : 'star', x: x + 180, y: RUN.GY - 130 }); r.nextP = r.t*1000 + 22000 + Math.random()*18000; }
}

/* ---------- 每一格 ---------- */
function runLoop(now){
  const r = RN; if(!r) return;
  const cv = $('rnC'); if(!cv) return;
  const ctx = cv.getContext('2d'), cw = cv.width, ch = cv.height;
  const LW = Math.max(470, RUN.LH * cw / ch), sc = cw / LW, bandH = RUN.LH * sc, oy = Math.max(0, (ch - bandH) * 0.62);
  let dt = r.started && !r.over ? Math.min(0.05, (now - r.last) / 1000) : 0; r.last = now;
  if(document.hidden) dt = 0;
  if(dt > 0){
    r.t += dt;
    const v = Math.min(RUN.VMAX, RUN.V0 + RUN.ACC * r.t), d = v * dt;
    r.px += d; r.bgx += d * 0.35;
    r.vy += RUN.G * dt; r.y += r.vy * dt; if(r.y >= RUN.GY){ r.y = RUN.GY; r.vy = 0; r.jumps = 0; }
    runSpawn(r, LW);
    r.obs.forEach(o => { o.x -= d + o.dx * dt; o.rot -= (d + o.dx*dt) / 26; });
    r.cn.forEach(c => { c.x -= d; if(r.mag > 0){ const dx = 110 - c.x, dy = (r.y - 35) - c.y, dd = Math.hypot(dx,dy); if(dd < 190){ c.x += dx/dd*620*dt; c.y += dy/dd*620*dt; } } });
    r.pw.forEach(p => { p.x -= d; });
    r.obs = r.obs.filter(o => o.x + o.w > -40); r.cn = r.cn.filter(c => c.x > -40 && !c.got); r.pw = r.pw.filter(p => p.x > -40 && !p.got);
    r.mag = Math.max(0, r.mag - dt); r.star = Math.max(0, r.star - dt);
    // 碰撞（寵物的框縮小一點，比較公平）
    const px0 = 110 - 22, px1 = 110 + 22, py1 = r.y - 4, py0 = r.y - 58;
    for(const c of r.cn){ if(Math.abs(c.x - 110) < 30 && c.y > py0 - 14 && c.y < py1 + 10){ c.got = true; r.coins++; if(now - r.sfxT > 70){ try{ sfx('coin'); }catch(e){} r.sfxT = now; } } }
    for(const p of r.pw){ if(Math.abs(p.x - 110) < 36 && p.y > py0 - 30 && p.y < py1 + 20){ p.got = true; if(p.k==='mag') r.mag = 8; else r.star = 5; try{ sfx('lvup'); }catch(e){} } }
    if(r.star <= 0) for(const o of r.obs){
      const ox0 = o.x + o.w*0.18, ox1 = o.x + o.w*0.82, oy0 = (o.k==='crow' ? o.y - o.h/2 : o.y - o.h) + o.h*0.15, oy1 = o.k==='crow' ? o.y + o.h/2 - 4 : o.y;
      if(o.k==='puddle'){ if(r.y >= RUN.GY - 2 && 110 > o.x + 14 && 110 < o.x + o.w - 14) { runDie(); break; } continue; }
      if(px1 > ox0 && px0 < ox1 && py1 > oy0 && py0 < oy1){ runDie(); break; }
    }
  }
  // ---- 畫 ----
  ctx.setTransform(1,0,0,1,0,0);
  const sky = ctx.createLinearGradient(0,0,0,oy+1); sky.addColorStop(0,'#6EC3F0'); sky.addColorStop(1,'#A9DDF7');
  ctx.fillStyle = sky; ctx.fillRect(0,0,cw,oy+2);
  const gr = ctx.createLinearGradient(0,oy+bandH,0,ch); gr.addColorStop(0,'#5DAA3C'); gr.addColorStop(1,'#3E8A2A');
  ctx.fillStyle = gr; ctx.fillRect(0,oy+bandH-2,cw,ch-oy-bandH+2);
  ctx.setTransform(sc,0,0,sc,0,oy);
  const bg = RUN_IMG.bg;
  if(bg.complete && bg.naturalWidth){ const bw = RUN.LH * bg.naturalWidth / bg.naturalHeight, n0 = Math.floor(r.bgx / bw), off = -(r.bgx - n0 * bw);
    for(let x = off, k = n0; x < LW; x += bw, k++){ if(k % 2){ ctx.save(); ctx.translate(x + bw, 0); ctx.scale(-1, 1); ctx.drawImage(bg, 0, 0, bw + 1, RUN.LH); ctx.restore(); } else ctx.drawImage(bg, x, 0, bw + 1, RUN.LH); } }   // 每隔一張左右翻轉，接縫才看不出來
  else { ctx.fillStyle = '#8FD06A'; ctx.fillRect(0,0,LW,RUN.LH); }
  const img = (im, x, y, w, h) => { if(im && im.complete && im.naturalWidth) ctx.drawImage(im, x, y, w, h); };
  for(const o of r.obs){
    if(o.k==='hay') img(RUN_IMG.hay, o.x, o.y - o.h, o.w, o.h);
    else if(o.k==='mush') img(RUN_IMG.mush, o.x, o.y - o.h, o.w, o.h);
    else if(o.k==='pump'){ ctx.save(); ctx.translate(o.x + o.w/2, o.y - o.h/2); ctx.rotate(o.rot); img(RUN_IMG.pump, -o.w/2, -o.h/2, o.w, o.h); ctx.restore(); }
    else if(o.k==='puddle'){ ctx.fillStyle = 'rgba(60,140,220,.75)'; ctx.beginPath(); ctx.ellipse(o.x + o.w/2, o.y + 2, o.w/2, 9, 0, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(o.x + o.w*0.4, o.y, o.w*0.18, 3, 0, 0, Math.PI*2); ctx.fill(); }
    else { ctx.font = '38px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.save(); ctx.translate(o.x + o.w/2, o.y + Math.sin(now/120 + o.x)*4); ctx.scale(-1,1); ctx.fillText('🐦‍⬛', 0, 0); ctx.restore(); }
  }
  for(const c of r.cn){ img(RUN_IMG.coin, c.x - 13, c.y - 13, 26, 26); }
  for(const p of r.pw){ ctx.fillStyle = p.k==='mag' ? 'rgba(255,90,90,.25)' : 'rgba(255,214,0,.3)'; ctx.beginPath(); ctx.arc(p.x, p.y, 24 + Math.sin(now/150)*3, 0, Math.PI*2); ctx.fill();
    ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.k==='mag' ? '🧲' : '⭐', p.x, p.y); }
  // 寵物（跑步時上下晃、撞到翻滾）
  const pet = RUN_IMG.pet, ph = 72, pw = pet && pet.naturalWidth ? ph * pet.naturalWidth / pet.naturalHeight : 56;
  ctx.save(); ctx.translate(110, r.y);
  if(r.over){ r.flip += 0.25; ctx.rotate(Math.min(Math.PI, r.flip)); }
  const bob = r.y >= RUN.GY && r.started && !r.over ? Math.abs(Math.sin(r.t * 14)) * 4 : 0;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, RUN.GY - r.y + 2, 24, 6, 0, 0, Math.PI*2); ctx.fill();
  if(r.star > 0){ ctx.shadowColor = '#FFD43B'; ctx.shadowBlur = 24; }
  img(pet, -pw/2, -ph - bob, pw, ph); ctx.restore();
  if(r.mag > 0){ ctx.strokeStyle = 'rgba(255,90,90,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(110, r.y - 36, 60 + Math.sin(now/100)*6, 0, Math.PI*2); ctx.stroke(); }
  // HUD
  const m = Math.floor(r.px / RUN.PX_M);
  if($('rnD')) $('rnD').textContent = `${m.toLocaleString()} 公尺${r.star>0?'　⭐':''}${r.mag>0?'　🧲':''}`;
  if($('rnCo')) $('rnCo').lastChild.textContent = r.coins;
  if(RN) requestAnimationFrame(runLoop);
}

/* ---------- 結束 ---------- */
async function runDie(){
  const r = RN; if(!r || r.over) return; r.over = true; try{ sfx('poof'); }catch(e){}
  const dist = Math.floor(r.px / RUN.PX_M), coins = r.coins;
  let res = null, err = null;
  try{ res = await rpc('farm_run_end', { p_id: r.id, p_dist: dist, p_coins: coins }); if(res.state){ applyState(res.state); try{ refresh(); }catch(e){} } }catch(e){ err = e.message; }
  if(!RN) return;
  $('rnEnd').innerHTML = `<div class="rnres"><h3>${res && res.newbest ? '🎉 新紀錄！' : '跑完了！'}</h3>
    <div class="rnbig">${dist.toLocaleString()} <small>公尺</small></div>
    <div class="rnline"><img src="${A('i_coin')}" alt=""> 撿到 ${coins} 枚</div>
    ${res ? `<div class="rnline">獲得 <b>${(+res.gold).toLocaleString()}</b> 農場金幣${res.capped ? `<small>（今天已經換滿 ${(+res.cap).toLocaleString()} 金）</small>` : `<small>（今天 ${(+res.today).toLocaleString()} / ${(+res.cap).toLocaleString()}）</small>`}</div>
      <div class="rnline">本週最佳 ${(+res.best).toLocaleString()} 公尺・全服第 ${res.rank} 名</div>` : `<div class="rnline" style="color:#D9534F">${esc(err||'結算失敗')}</div>`}
    <div class="rnbtn"><button class="btn o" id="rnAgain">再跑一次</button><button class="btn sub" id="rnBack">回大廳</button></div></div>`;
  $('rnAgain').onclick = () => { runQuit(true); runStart(); };
  $('rnBack').onclick = () => { runQuit(); openRunLobby(); };
}
function runQuit(keep){
  const r = RN; RN = null;
  if(r){ removeEventListener('resize', r.fit); removeEventListener('keydown', r.key); }
  const el = $('run'); if(el){ el.classList.remove('on'); el.innerHTML = ''; }
  if(!keep) document.body.classList.remove('mjon');
}
