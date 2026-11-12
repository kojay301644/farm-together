/* ================= 寵物下樓梯（休閒手感） =================
   經典「小朋友下樓梯」的農場版：畫面一直往上捲，用左右鍵帶寵物踩著平台往下。碰到天花板尖刺、踩到尖刺板扣血，掉出畫面就結束。
   平台：田埂（補血）、尖刺板、輸送帶（左／右）、翻轉板、彈簧板、稻草堆（踩一下就塌）。
   下的層數換成農場金幣（每天有上限），每週排行。捲動速度要跟伺服器的 _stair_max 一致 */
const ST = { W: 320, H: 520, GAP: 70, V0: 60, ACC: 1.6, VMAX: 170, G: 1500, FALL: 560, MV: 200, PW: 84, PH: 14, CEIL: 24, HP: 12, BELT: 110, PETH: 44 };
let SR = null;   // 進行中的一場

/* ---------- 大廳 ---------- */
async function openStairLobby(tab){
  let I; try{ I = await rpc('farm_stair_info'); }catch(e){ return toast(e.message); }
  tab = tab || 'all';
  const L = (tab==='all' ? I.top : I.friends) || [];
  const row = (x,i) => `<div class="rnr${x.me?' me':''}"><b>${x.rk||i+1}</b><img src="${avSrc(x.avatar)}" alt=""><span>${esc(x.nickname)}</span><em>${(+x.floors).toLocaleString()} 層</em></div>`;
  const ends = I.ends ? new Date(+I.ends - (S.off||0)) : null;
  const rw = (I.rw||[]).map((r,i)=>`${['🥇','🥈','🥉'][i]} ${[r.gold?(+r.gold).toLocaleString()+' 金':'', r.gems?'💎'+r.gems:''].filter(Boolean).join('＋')}`).join('　');
  modal('🪜 寵物下樓梯', `<div class="rnhd"><div><small>本週最佳</small><b>${I.best ? '地下 '+(+I.best).toLocaleString()+' 層' : '還沒玩'}</b>${I.best?`<small>全服第 ${I.rank} 名</small>`:''}</div>
      <div><small>今天換到的金幣</small><b>${(+I.today).toLocaleString()} / ${(+I.cap).toLocaleString()}</b><small>每下 1 層＝${I.rate} 金</small></div></div>
    <button class="btn o" id="stGo" style="width:100%;font-size:20px;padding:14px 0">▶ 開始下樓</button>
    <div class="rhint" style="margin-top:8px">按左右鍵移動（電腦用 ← →），踩著平台一直往下。田埂會補血，尖刺板和天花板會扣血，輸送帶會把你帶走，翻轉板和稻草堆站不久，彈簧板會彈起來。不限次數，金幣每天最多換 ${(+I.cap).toLocaleString()}；每週一結算，全服前 3 名有獎勵和一週稱號：${rw}</div>
    ${I.last && I.last.length ? `<div class="rnlast">上週：${I.last.map(w=>`${['🥇','🥈','🥉'][w.rk-1]} ${esc(w.nickname)}（${(+w.floors).toLocaleString()} 層）`).join('　')}</div>` : ''}
    <div class="snav" style="margin-top:8px"><button data-st="all" class="${tab==='all'?'on':''}">🌏 本週全服</button><button data-st="fr" class="${tab==='fr'?'on':''}">👫 好友</button>${ends?`<span class="rnend">${ends.getMonth()+1}/${ends.getDate()} 00:00 結算</span>`:''}</div>
    <div class="rnl">${L.length ? L.map(row).join('') : '<div class="empty">這週還沒有人玩，搶第一！</div>'}</div>`,
    [['回寵物娛樂廳','sub',()=>openHall('fun')]]);
  $('stGo').onclick = stairStart;
  document.querySelectorAll('#md [data-st]').forEach(b=>b.onclick=()=>openStairLobby(b.dataset.st));
}

/* ---------- 開始一場 ---------- */
async function stairStart(){
  let s; try{ s = await rpc('farm_stair_start'); }catch(e){ return toast(e.message); }
  closeModal();
  let el = $('stair'); if(!el){ el = document.createElement('div'); el.id = 'stair'; document.body.appendChild(el); }
  el.innerHTML = `<canvas id="stC"></canvas><div class="rnhud"><span id="stF">地下 0 層</span><span class="sthp" id="stHp"></span><button id="stX">✕</button></div>
    <div id="stMsg" class="rnmsg">按 ◀ ▶ 開始！</div>
    <button class="stbtn l" id="stL">◀</button><button class="stbtn r" id="stR">▶</button><div id="stEnd"></div>`;
  el.classList.add('on'); document.body.classList.add('mjon');
  const pet = new Image(); pet.src = chrSrc((S && S.me && S.me.chara) || 'bunny1');
  SR = { id: s.id, t: 0, scroll: 0, plats: [], x: ST.W/2, y: 0, vy: 0, on: null, hp: ST.HP, inv: 0, skip: null, skipT: 0, l: 0, r: 0, face: 1,
         over: false, started: false, last: 0, pet, hpShown: -1, fShown: -1, flash: 0 };
  // 一開始的平台：前幾層都是田埂，寵物站在中間那塊
  for(let y = 150, i = 0; y < ST.H + ST.GAP; y += ST.GAP, i++) SR.plats.push(stairPlat(y, i < 6 ? 'n' : null, i===2 ? ST.W/2 - ST.PW/2 : null));
  SR.on = SR.plats[2]; SR.y = SR.on.y;
  const cv = $('stC'), fit = () => { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; cv.style.width = innerWidth+'px'; cv.style.height = innerHeight+'px'; };
  fit(); SR.fit = fit; addEventListener('resize', fit);
  const hold = (id, k) => { const b = $(id);
    b.addEventListener('pointerdown', e => { e.preventDefault(); try{ b.setPointerCapture(e.pointerId); }catch(_){} stairGo(); if(SR) SR[k] = 1; b.classList.add('on'); });
    ['pointerup','pointercancel','lostpointercapture'].forEach(n => b.addEventListener(n, () => { if(SR) SR[k] = 0; b.classList.remove('on'); })); };
  hold('stL', 'l'); hold('stR', 'r');
  const K = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  SR.kd = e => { const k = K[e.code]; if(!k || !SR) return; e.preventDefault(); stairGo(); SR[k] = 1; };
  SR.ku = e => { const k = K[e.code]; if(k && SR) SR[k] = 0; };
  addEventListener('keydown', SR.kd); addEventListener('keyup', SR.ku);
  $('stX').onclick = () => { if(!SR || SR.over) return; if(!SR.started) return stairQuit(); stairDie(); };
  requestAnimationFrame(stairLoop);
}
function stairGo(){ const r = SR; if(!r || r.over || r.started) return; r.started = true; r.last = performance.now(); $('stMsg').style.display = 'none'; }

// 新平台：越往下，難的平台越多
function stairPlat(y, k, x){
  if(!k){
    const lv = SR ? Math.min(1, SR.t / 90) : 0, R = Math.random();
    const w = [['n', 0.46 - lv*0.16], ['s', 0.10 + lv*0.06], ['cl', 0.08], ['cr', 0.08], ['f', 0.08 + lv*0.03], ['j', 0.10], ['h', 0.10 + lv*0.07]];
    const sum = w.reduce((a,b)=>a+b[1],0); let acc = 0; k = 'n';
    for(const [kk, p] of w){ acc += p / sum; if(R < acc){ k = kk; break; } }
  }
  return { k, x: x != null ? x : 6 + Math.random() * (ST.W - ST.PW - 12), y, tOn: 0, flipT: 0, gone: 0, sq: 0 };
}

function stairHurt(n){
  const r = SR; if(r.inv > 0) return;
  r.hp = Math.max(0, r.hp - n); r.inv = 1; r.flash = 0.25;
  try{ sfx('poof'); }catch(e){} try{ navigator.vibrate && navigator.vibrate(60); }catch(e){}
  if(r.hp <= 0) stairDie();
}
function stairLand(p){
  const r = SR; r.y = p.y; r.vy = 0; r.on = p; p.tOn = 0;
  if(p.k === 's'){ stairHurt(5); }
  else { if(r.hp < ST.HP) r.hp++; try{ sfx('tap'); }catch(e){} }
  if(p.k === 'j'){ r.vy = -520; r.on = null; p.sq = 0.2; try{ sfx('seed'); }catch(e){} }
}

/* ---------- 每一格 ---------- */
function stairLoop(now){
  const r = SR; if(!r) return;
  const cv = $('stC'); if(!cv) return;
  let dt = r.started && !r.over ? Math.min(0.05, (now - r.last) / 1000) : 0; r.last = now;
  if(document.hidden) dt = 0;
  if(dt > 0){
    r.t += dt;
    const v = Math.min(ST.VMAX, ST.V0 + ST.ACC * r.t), d = v * dt;
    r.scroll += d;
    for(const p of r.plats){ p.y -= d; if(p.flipT > 0) p.flipT -= dt; if(p.sq > 0) p.sq -= dt; if(p.gone > 0) p.gone += dt; }
    r.plats = r.plats.filter(p => p.y > -30 && !(p.gone > 0.5));
    while(r.plats[r.plats.length-1].y < ST.H + ST.GAP) r.plats.push(stairPlat(r.plats[r.plats.length-1].y + ST.GAP));
    r.inv = Math.max(0, r.inv - dt); r.flash = Math.max(0, r.flash - dt); r.skipT = Math.max(0, r.skipT - dt); if(r.skipT <= 0) r.skip = null;
    // 左右
    const mv = (r.r - r.l) * ST.MV; if(mv) r.face = mv > 0 ? 1 : -1;
    r.x += mv * dt;
    const p = r.on;
    if(p){
      if(p.k === 'cl') r.x -= ST.BELT * dt; else if(p.k === 'cr') r.x += ST.BELT * dt;
      r.x = Math.max(12, Math.min(ST.W - 12, r.x));
      if(p.gone || p.flipT > 0 || r.x < p.x - 10 || r.x > p.x + ST.PW + 10) r.on = null;
      else {
        r.y = p.y; p.tOn += dt;
        if(p.k === 'f' && p.tOn > 0.35){ p.flipT = 0.8; r.on = null; try{ sfx('tap'); }catch(e){} }
        if(p.k === 'h' && p.tOn > 0.45){ p.gone = 0.01; r.on = null; }
      }
    } else r.x = Math.max(12, Math.min(ST.W - 12, r.x));
    if(!r.on){
      const y0 = r.y; r.vy = Math.min(ST.FALL, r.vy + ST.G * dt); r.y += r.vy * dt;
      if(r.vy > 0) for(const q of r.plats){
        if(q.gone || q.flipT > 0 || q === r.skip) continue;
        if(r.x >= q.x - 8 && r.x <= q.x + ST.PW + 8 && y0 <= q.y + d + 1 && r.y >= q.y){ stairLand(q); break; }
      }
    }
    // 天花板尖刺：扣血，從平台上被擠下去
    if(r.y - ST.PETH < ST.CEIL){
      stairHurt(5);
      if(r.on){ r.skip = r.on; r.skipT = 0.6; r.on = null; }
      r.y = ST.CEIL + ST.PETH + 1; r.vy = Math.max(r.vy, 60);
    }
    if(r.y - ST.PETH > ST.H + 10) stairDie();
  }
  stairDraw(r, cv, now);
  if(SR) requestAnimationFrame(stairLoop);
}

/* ---------- 畫 ---------- */
function stairDraw(r, cv, now){
  const ctx = cv.getContext('2d'), cw = cv.width, ch = cv.height;
  const sc = Math.min(ch / ST.H, cw / ST.W), ox = (cw - ST.W * sc) / 2, oy = (ch - ST.H * sc) / 2;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = '#3A2516'; ctx.fillRect(0, 0, cw, ch);
  ctx.setTransform(sc, 0, 0, sc, ox, oy);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, ST.W, ST.H); ctx.clip();
  // 穀倉木板牆（跟著捲動）
  const bg = ctx.createLinearGradient(0, 0, 0, ST.H); bg.addColorStop(0, '#F3D9A8'); bg.addColorStop(1, '#E2BB7C');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, ST.W, ST.H);
  ctx.strokeStyle = 'rgba(140,90,40,.18)'; ctx.lineWidth = 2;
  for(let x = 40; x < ST.W; x += 40){ ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ST.H); ctx.stroke(); }
  const off = -(r.scroll * 0.5 % 130);
  ctx.fillStyle = 'rgba(140,90,40,.14)';
  for(let y = off; y < ST.H; y += 130) for(let x = 20; x < ST.W; x += 80){ ctx.beginPath(); ctx.arc(x + ((y - off) / 130 % 2) * 40, y + 30, 3, 0, Math.PI*2); ctx.fill(); }
  // 平台
  for(const p of r.plats) stairDrawPlat(ctx, p, now);
  // 寵物
  const pet = r.pet, ph = ST.PETH, pw = pet.naturalWidth ? ph * pet.naturalWidth / pet.naturalHeight : 34;
  if(!(r.inv > 0 && Math.floor(now / 90) % 2)){
    ctx.save(); ctx.translate(r.x, r.y);
    if(r.over) ctx.rotate(Math.min(Math.PI, (now % 100000) / 300));
    ctx.scale(-r.face, 1);
    if(pet.complete && pet.naturalWidth) ctx.drawImage(pet, -pw/2, -ph, pw, ph);
    ctx.restore();
  }
  // 天花板尖刺
  ctx.fillStyle = '#6B4A2E'; ctx.fillRect(0, 0, ST.W, 8);
  for(let x = 0; x < ST.W; x += 16){
    const g = ctx.createLinearGradient(x, 0, x + 16, 0); g.addColorStop(0, '#E8EDF2'); g.addColorStop(1, '#8D99A6');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x + 8, ST.CEIL); ctx.lineTo(x + 16, 8); ctx.fill();
  }
  if(r.flash > 0){ ctx.fillStyle = `rgba(255,60,60,${r.flash})`; ctx.fillRect(0, 0, ST.W, ST.H); }
  ctx.restore();
  // 兩邊的木框
  ctx.fillStyle = '#7A4B25'; ctx.fillRect(-8, 0, 8, ST.H); ctx.fillRect(ST.W, 0, 8, ST.H);
  // HUD（有變才改）
  const f = Math.floor(r.scroll / ST.GAP);
  if(f !== r.fShown){ r.fShown = f; const e = $('stF'); if(e) e.textContent = `地下 ${f.toLocaleString()} 層`; }
  if(r.hp !== r.hpShown){ r.hpShown = r.hp; const e = $('stHp'); if(e) e.innerHTML = Array.from({length: ST.HP}, (_, i) => `<i class="${i < r.hp ? 'on' : ''}${r.hp <= 4 ? ' lo' : ''}"></i>`).join(''); }
}
function rrect(ctx, x, y, w, h, rad){ ctx.beginPath(); ctx.moveTo(x+rad, y); ctx.arcTo(x+w, y, x+w, y+h, rad); ctx.arcTo(x+w, y+h, x, y+h, rad); ctx.arcTo(x, y+h, x, y, rad); ctx.arcTo(x, y, x+w, y, rad); ctx.closePath(); }
function stairDrawPlat(ctx, p, now){
  const W = ST.PW, H = ST.PH;
  ctx.save(); ctx.translate(p.x, p.y);
  if(p.gone > 0){ ctx.globalAlpha = Math.max(0, 1 - p.gone * 2); ctx.translate(0, p.gone * 40); }
  if(p.k === 'h' && p.tOn > 0 && !p.gone) ctx.translate(Math.sin(now / 25) * 2, 0);
  if(p.flipT > 0){ ctx.translate(W/2, H/2); ctx.scale(1, Math.cos((0.8 - p.flipT) / 0.8 * Math.PI * 2)); ctx.translate(-W/2, -H/2); }
  if(p.k === 'n'){   // 田埂：泥土＋草皮
    ctx.fillStyle = '#9A6B3F'; rrect(ctx, 0, 0, W, H, 6); ctx.fill();
    ctx.fillStyle = '#6CC04A'; rrect(ctx, 0, -2, W, 7, 4); ctx.fill();
    ctx.fillStyle = '#4FA232'; for(let x = 8; x < W; x += 14){ ctx.beginPath(); ctx.moveTo(x, -1); ctx.lineTo(x + 3, -7); ctx.lineTo(x + 6, -1); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,.12)'; for(let x = 10; x < W; x += 22) { ctx.beginPath(); ctx.arc(x, 9, 2, 0, Math.PI*2); ctx.fill(); }
  } else if(p.k === 's'){   // 尖刺板
    ctx.fillStyle = '#7D858F'; rrect(ctx, 0, 0, W, H, 4); ctx.fill();
    for(let x = 0; x < W; x += 12){ const g = ctx.createLinearGradient(x, 0, x + 12, 0); g.addColorStop(0, '#F2F5F8'); g.addColorStop(1, '#97A3AF');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 1); ctx.lineTo(x + 6, -12); ctx.lineTo(x + 12, 1); ctx.fill(); }
  } else if(p.k === 'cl' || p.k === 'cr'){   // 輸送帶：箭頭會動
    ctx.fillStyle = '#4A4F57'; rrect(ctx, 0, 0, W, H, 7); ctx.fill();
    ctx.save(); rrect(ctx, 3, 3, W - 6, H - 6, 4); ctx.clip();
    const dir = p.k === 'cr' ? 1 : -1, o = (now / 1000 * ST.BELT * dir) % 18;
    ctx.strokeStyle = '#FFC93C'; ctx.lineWidth = 2.5;
    for(let x = -18 + o; x < W + 18; x += 18){ ctx.beginPath(); ctx.moveTo(x - 3*dir, 4); ctx.lineTo(x + 3*dir, H/2); ctx.lineTo(x - 3*dir, H - 4); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#2E3238'; ctx.beginPath(); ctx.arc(5, H/2, 4, 0, Math.PI*2); ctx.arc(W - 5, H/2, 4, 0, Math.PI*2); ctx.fill();
  } else if(p.k === 'f'){   // 翻轉板
    ctx.fillStyle = '#E9C88E'; rrect(ctx, 0, 0, W, H, 4); ctx.fill();
    ctx.strokeStyle = '#B58646'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#B58646'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for(let x = 14; x < W; x += 28) ctx.fillText('↻', x, H/2 + 1);
  } else if(p.k === 'j'){   // 彈簧板
    const sq = p.sq > 0 ? Math.sin(p.sq / 0.2 * Math.PI) * 4 : 0;
    ctx.strokeStyle = '#8D99A6'; ctx.lineWidth = 2.5; ctx.beginPath();
    for(let i = 0; i <= 6; i++){ const x = 10 + (i % 2) * 8; ctx.lineTo(x, 4 + sq + i * (10 - sq) / 6); } ctx.stroke();
    ctx.beginPath(); for(let i = 0; i <= 6; i++){ const x = W - 18 + (i % 2) * 8; ctx.lineTo(x, 4 + sq + i * (10 - sq) / 6); } ctx.stroke();
    ctx.fillStyle = '#E8534A'; rrect(ctx, 0, sq, W, 6, 3); ctx.fill();
    ctx.fillStyle = '#6B4A2E'; rrect(ctx, 0, H - 2, W, 4, 2); ctx.fill();
  } else if(p.k === 'h'){   // 稻草堆（會塌）
    ctx.fillStyle = '#F1C84B'; rrect(ctx, 0, 0, W, H, 6); ctx.fill();
    ctx.strokeStyle = '#C99A1E'; ctx.lineWidth = 1.5;
    for(let x = 4; x < W; x += 7){ ctx.beginPath(); ctx.moveTo(x, 2); ctx.lineTo(x + 3, H - 2); ctx.stroke(); }
    ctx.fillStyle = '#B5651D'; ctx.fillRect(W*0.3, 0, 3, H); ctx.fillRect(W*0.7, 0, 3, H);
  }
  ctx.restore();
}

/* ---------- 結束 ---------- */
async function stairDie(){
  const r = SR; if(!r || r.over) return; r.over = true; r.flash = 0; try{ sfx('poof'); }catch(e){}
  const floors = Math.floor(r.scroll / ST.GAP);
  let res = null, err = null;
  try{ res = await rpc('farm_stair_end', { p_id: r.id, p_floors: floors }); if(res.state){ applyState(res.state); try{ refresh(); }catch(e){} } }catch(e){ err = e.message; }
  if(!SR) return;
  $('stEnd').innerHTML = `<div class="rnres"><h3>${res && res.newbest ? '🎉 新紀錄！' : '下樓結束！'}</h3>
    <div class="rnbig">地下 ${floors.toLocaleString()} <small>層</small></div>
    ${res ? `<div class="rnline">獲得 <b>${(+res.gold).toLocaleString()}</b> 農場金幣${res.capped ? `<small>（今天已經換滿 ${(+res.cap).toLocaleString()} 金）</small>` : `<small>（今天 ${(+res.today).toLocaleString()} / ${(+res.cap).toLocaleString()}）</small>`}</div>
      <div class="rnline">本週最佳 ${(+res.best).toLocaleString()} 層・全服第 ${res.rank} 名</div>` : `<div class="rnline" style="color:#D9534F">${esc(err||'結算失敗')}</div>`}
    <div class="rnbtn"><button class="btn o" id="stAgain">再玩一次</button><button class="btn sub" id="stBack">回大廳</button></div></div>`;
  $('stAgain').onclick = () => { stairQuit(true); stairStart(); };
  $('stBack').onclick = () => { stairQuit(); openStairLobby(); };
}
function stairQuit(keep){
  const r = SR; SR = null;
  if(r){ removeEventListener('resize', r.fit); removeEventListener('keydown', r.kd); removeEventListener('keyup', r.ku); }
  const el = $('stair'); if(el){ el.classList.remove('on'); el.innerHTML = ''; }
  if(!keep) document.body.classList.remove('mjon');
}
