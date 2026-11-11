/* ---------- 百家樂（多人同桌，跟系統對賭；共用麻將的牌桌外框、連線流程） ---------- */
let bcChip = 0, bcTimer = 0, bcStage = '', bcFlash = {};
const BC_ICON = {n:'🌱',m:'🌻',h:'🏆',r:'💰'};
const BC_ORDER = ['pp','p','t','b','bp'];

function openBcLobby(){
  const gold = S.me.gold;
  modal('🎴 百家樂', `<div class="rhint">押「莊」或「閒」誰的點數比較接近 9，跟娛樂廳對賭，輸贏用農場金幣。最多 ${BC.MAXP} 人同桌，大家一起看開牌</div>
    <div id="bcBack"></div>
    ${Object.entries(BC.TABLES).map(([k,t])=>{ const poor = gold<t.min; return `<div class="mjtb"><div class="mjtbi">${BC_ICON[k]}</div><div class="tx"><b>${t.name}</b>
      <div>每局最多押 ${t.max.toLocaleString()} 金</div><div>需要 ${t.min.toLocaleString()} 金幣才能坐下</div></div>
      <div class="mjtbb"><button class="mini" data-bcq="${k}" ${poor?'disabled':''}>${poor?'金幣不夠':'進入牌桌'}</button><button class="mini sub" data-bcc="${k}" ${poor?'disabled':''}>開房找朋友</button></div></div>`; }).join('')}
    <div class="mjjoin"><input id="bcCode" inputmode="numeric" maxlength="4" placeholder="輸入 4 位數房號"><button class="mini" id="bcJoin">加入朋友的房間</button></div>
    <button class="link" id="bcRules">📖 怎麼玩、怎麼賠？</button>`, [['回寵物娛樂廳','sub',openHall]]);
  const busy = b => { document.querySelectorAll('#md .mini').forEach(x=>x.disabled = b); };
  const go = async (a, extra) => { busy(true); try{ const r = await mjCall(a, extra); if(!r.view) throw new Error('進不去，等等再試'); closeModal(); mjOnlineEnter(r.view); }catch(e){ toast(e.message); busy(false); } };
  document.querySelectorAll('#md [data-bcq]').forEach(b=>b.onclick=()=>go('quick', {lvl:b.dataset.bcq, game:'bc'}));
  document.querySelectorAll('#md [data-bcc]').forEach(b=>b.onclick=()=>go('create', {lvl:b.dataset.bcc, game:'bc'}));
  $('bcJoin').onclick = ()=>{ const c = ($('bcCode').value||'').trim(); if(!/^\d{4}$/.test(c)) return toast('房號是 4 位數字'); go('join', {code:c}); };
  $('bcRules').onclick = bcRules;
  mjCall('state').then(r=>{ if(r.view && r.view.status && $('bcBack')) { $('bcBack').innerHTML = `<button class="btn o" id="bcBackB" style="width:100%;margin:6px 0">🎴 你還有一桌在玩，回到牌桌</button>`; $('bcBackB').onclick = ()=>{ closeModal(); mjOnlineEnter(r.view); }; } }).catch(()=>{});
}
function bcRules(){
  const body = `<div class="help">
    <p><b>怎麼玩：</b>每局有 ${BC_BET_SEC} 秒下注，押「莊」或「閒」哪一邊的點數比較大（最大 9），時間到就開牌。</p>
    <p><b>點數：</b>A 算 1，2～9 照數字，10、J、Q、K 算 0，加起來只看個位數（例如 7＋8＝15 算 5 點）。</p>
    <p><b>補牌：</b>兩邊先各拿 2 張，誰拿到 8 或 9 點就直接比；不然照固定規則自動補第 3 張，不用自己決定。</p>
    <p><b>賠率：</b></p>
    <ul><li>閒：1 賠 1</li><li>莊：1 賠 0.95（贏了抽 5%）</li><li>和（兩邊一樣大）：1 賠 8；開和時押莊、閒的錢退回</li><li>閒對／莊對（那邊前兩張是對子）：1 賠 11</li></ul>
    <p>每局可以押好幾個地方，合計不能超過這桌的上限。</p></div>`;
  if(mjOn()) return mjPanel('📖 百家樂怎麼玩', body, [['知道了','',mjPanelClose]]);
  modal('📖 百家樂怎麼玩', body, [['知道了','',openBcLobby]]);
}
const BC_BET_SEC = 15;

// 開牌動畫：照時間一張一張翻（閒、莊、閒、莊，再補牌）
function bcReveal(V){
  if(!V.cards) return { p:0, b:0, done:false };
  const t = Date.now() - ((V.dealAt||0) + (MJO ? MJO.off : 0));
  const seq = [['p',0],['b',0],['p',1],['b',1]]; if(V.cards.p.length>2) seq.push(['p',2]); if(V.cards.b.length>2) seq.push(['b',2]);
  const times = [0,700,1400,2100]; let last = 2100; for(let i=4;i<seq.length;i++){ last += 1000; times.push(last); }
  if(V.phase==='end') return { p:V.cards.p.length, b:V.cards.b.length, done:true };
  const n = times.filter(x=>t >= x + 300).length, shown = { p:0, b:0 };
  seq.slice(0, n).forEach(([s])=>shown[s]++);
  return { ...shown, done: n >= seq.length };
}
function bcRender(V){
  const T = BC.TABLES[V.lvl] || BC.TABLES.n;
  if(!T.chips.includes(bcChip)) bcChip = T.chips[0];
  if(S && S.me && typeof V.myGold==='number') S.me.gold = V.myGold;
  $('mj').style.setProperty('--b2pet', `url("${typeof chrSrc==='function' ? chrSrc((V.pet||'bunny')+'1') : ''}")`);
  const felt = $('mjFelt'); if(!felt) return;
  const rv = bcReveal(V), bet = V.phase==='bet';
  const cards = side => { const cs = (V.cards && V.cards[side]) || [], n = side==='p' ? rv.p : rv.b;
    const shown = cs.slice(0, n), pt = shown.length ? BC.pts(shown) : null;
    const slots = [0,1,2].map(i=> i < cs.length ? (i < n ? b2Card(cs[i], 'bcc' + (i===2?' third':'')) : b2Card(null, 'bcc' + (i===2?' third':''))) : (i<2 && !V.cards ? `<i class="b2c bcc ghost"></i>` : '')).join('');
    const won = V.result && (V.result.win===side);
    return `<div class="bcside bc-${side}${won?' won':''}"><div class="bcsh"><b>${side==='p'?'閒':'莊'}</b>${pt!=null?`<span class="bcpt">${pt} 點</span>`:''}</div><div class="bccs">${slots}</div></div>`; };
  // 路單：最近的結果（紅＝莊、藍＝閒、綠＝和）
  const hist = (V.hist||[]).slice(-36);
  const road = `<div class="bcroad">${hist.map(h=>`<i class="r-${h[0]}">${h[0]==='b'?'莊':h[0]==='p'?'閒':'和'}${/P/.test(h)?'<u class="pp"></u>':''}${/B/.test(h)?'<u class="bp"></u>':''}</i>`).join('')}</div>`;
  const players = `<div class="bcpl">${(V.players||[]).map(p=>`<div class="bcpp${p.me?' me':''}"><img src="${avSrc(p.av)}" alt=""><span>${esc(p.name)}</span><b>${p.win!=null && p.bet ? (p.win>0?`<em class="up">+${p.win.toLocaleString()}</em>`:p.win<0?`<em class="dn">${p.win.toLocaleString()}</em>`:'退回') : p.bet ? p.bet.toLocaleString() : '—'}</b></div>`).join('')}</div>`;
  const left = Math.max(0, Math.ceil(((V.tEnd||0) + (MJO?MJO.off:0) - Date.now())/1000));
  const status = bet ? `<div class="bcst bet"><b id="bcSec">${left}</b><span>請下注</span></div>`
    : V.phase==='deal' ? `<div class="bcst deal"><span>停止下注・開牌中</span></div>`
    : V.result ? `<div class="bcst res r-${V.result.win}"><b>${V.result.win==='t'?'和局':V.result.win==='b'?'莊贏':'閒贏'}</b><span>${V.result.pt} : ${V.result.bt}${V.result.pp?'・閒對':''}${V.result.bp?'・莊對':''}</span></div>` : '';
  felt.innerHTML = `${road}${players}<div class="bctable">${cards('p')}${status}${cards('b')}</div>`;

  // 押注區
  const my = V.myBets || {}, tot = V.totals || {};
  const res = V.result, winArea = k => res && (k===res.win || (k==='pp'&&res.pp) || (k==='bp'&&res.bp));
  const areas = BC_ORDER.map(k=>{ const A = BC.AREAS[k], m = my[k]||0, all = tot[k]||0;
    const fk = V.round + ':' + k + ':' + m, flash = m && bcFlash[k] !== fk; bcFlash[k] = fk;
    return `<button class="bca bca-${k}${winArea(k)?' win':''}${res && !winArea(k) && m ? ' lose':''}" data-bca="${k}" ${bet?'':'disabled'}>
      <b>${A.name}</b><small>1 賠 ${A.pay}</small>${all?`<span class="bcall">全桌 ${all.toLocaleString()}</span>`:''}${m?`<span class="bcmy${flash?' pop':''}">${m.toLocaleString()}</span>`:''}</button>`; }).join('');
  const myTot = Object.values(my).reduce((s,x)=>s+x,0);
  const winTxt = V.phase==='end' && V.myWin!=null && myTot ? (V.myWin>0?`<span class="bcwin up">贏 +${V.myWin.toLocaleString()}</span>`:V.myWin<0?`<span class="bcwin dn">輸 ${V.myWin.toLocaleString()}</span>`:`<span class="bcwin">押注退回</span>`) : '';
  $('mjUi').innerHTML = `<div class="bcareas">${areas}</div>
    <div class="bcchips">${T.chips.map(c=>`<button class="bcchip${c===bcChip?' on':''}" data-chip="${c}" ${bet?'':'disabled'}>${c>=1000?(c/1000)+'K':c}</button>`).join('')}
      <button class="bcclr" id="bcClr" ${bet && myTot?'':'disabled'}>清除</button><span class="bcmine">這局押 <b>${myTot.toLocaleString()}</b> / ${T.max.toLocaleString()}</span>${winTxt}</div>`;
  $('mjBar').innerHTML = `<div class="mjbt">每局最多押 ${T.max.toLocaleString()} 金</div>
    <div class="mjbme"><img src="${avSrc(S.me.avatar||11)}" alt=""><b>${esc(S.me.nickname||'')}</b><span class="mjbg">${(V.myGold||0).toLocaleString()}</span></div>
    <div class="mjbt r">${T.name}${V.code?`・房號 ${esc(V.code)}`:''}・第 ${V.round} 局</div>`;
  $('mjEnd').innerHTML = '';

  document.querySelectorAll('#mj [data-chip]').forEach(b=>b.onclick=()=>{ bcChip = +b.dataset.chip; mjSfx('pick'); bcRender(mjCurView()); });
  document.querySelectorAll('#mj [data-bca]').forEach(b=>b.onclick=()=>bcBet(b.dataset.bca));
  if($('bcClr')) $('bcClr').onclick = ()=>{ const VV = mjCurView(); if(!VV || !MJO) return; VV.myBets = {}; mjSfx('pick'); bcRender(VV); bcSend({ a:'clear' }); };

  // 開牌：照時間重畫；有人中獎放音效
  const stage = V.round + ':' + V.phase + ':' + rv.p + ':' + rv.b;
  if(stage !== bcStage){
    if(V.phase==='deal' && (rv.p + rv.b) > 0) mjSfx('tile');
    if(V.phase==='end' && bcStage.indexOf(V.round + ':end') !== 0 && V.myWin > 0){ mjSfx('win'); }
    bcStage = stage;
  }
  clearInterval(bcTimer);
  bcTimer = setInterval(()=>{
    const VV = mjCurView(); if(!VV || VV.game!=='bc' || !mjOn()){ clearInterval(bcTimer); return; }
    if(VV.phase==='bet'){ const el = $('bcSec'); if(el){ const l = Math.max(0, Math.ceil(((VV.tEnd||0) + (MJO?MJO.off:0) - Date.now())/1000)); el.textContent = l; el.classList.toggle('hurry', l<=5); } return; }
    if(VV.phase==='deal'){ const r = bcReveal(VV); if(VV.round + ':deal:' + r.p + ':' + r.b !== bcStage) bcRender(VV); }
  }, 200);
}
function bcBet(k){
  const V = mjCurView(); if(!V || V.phase!=='bet' || !MJO) return;
  const T = BC.TABLES[V.lvl] || BC.TABLES.n, my = V.myBets || (V.myBets = {});
  const tot = Object.values(my).reduce((s,x)=>s+x,0) + bcChip;
  if(tot > T.max) return mjToast(`每局最多押 ${T.max.toLocaleString()} 金`);
  if(tot > (V.myGold||0)) return mjToast('金幣不夠');
  // 先顯示在畫面上，伺服器確認在背景做
  my[k] = (my[k]||0) + bcChip; V.totals = Object.assign({}, V.totals); V.totals[k] = (V.totals[k]||0) + bcChip;
  mjSfx('pick'); try{ if(typeof vib==='function') vib(15); }catch(e){}
  bcRender(V);
  bcSend({ a:'bet', k, amt: bcChip });
}

// 下注可以連點：每一下都直接送，不用等上一下回來（伺服器用版本號排隊）
let bcPend = 0;
function bcSend(act){
  bcPend++;
  mjCall('act', { act }).then(r=>{ bcPend--; if(MJO && bcPend===0) mjApply(r.view, null, false, true); })
    .catch(e=>{ bcPend--; mjToast(e.message); if(MJO) mjCall('state').then(r=>MJO && mjApply(r.view, null, false, true)).catch(()=>{}); });
}
