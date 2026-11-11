/* ---------- 百家樂（多人同桌，跟系統對賭；共用麻將的牌桌外框、連線流程） ---------- */
let bcShufShown = false, bcSlid = 0, bcPrevShown = {}, bcChip = 0, bcTimer = 0, bcStage = '', bcFlash = {};
const BC_ICON = {n:'🌱',m:'🌻',h:'🏆',r:'💰'};
const BC_ORDER = ['pp','p','t','b','bp'];

function openBcLobby(){
  const gold = S.me.gold;
  modal('🎴 百家樂', `<div class="rhint">押「莊」或「閒」誰的點數比較接近 9，跟娛樂廳對賭，輸贏用農場金幣。進入系統桌，最多 ${BC.MAXP} 人同桌，大家一起看開牌</div>
    <div id="bcBack"></div>
    <div class="mjtb"><div class="mjtbi">🎴</div><div class="tx"><b>百家樂</b>
      <div>莊、閒：每注 100～20,000 金</div><div>和、對子：每注 100～10,000 金</div></div>
      <div class="mjtbb"><button class="mini" data-bcq="n">進入牌桌</button></div></div>
    <button class="link" id="bcRules">📖 怎麼玩、怎麼賠？</button>`, [['回寵物娛樂廳','sub',openHall]]);
  const busy = b => { document.querySelectorAll('#md .mini').forEach(x=>x.disabled = b); };
  const go = async (a, extra) => { busy(true); try{ const r = await mjCall(a, extra); if(!r.view) throw new Error('進不去，等等再試'); closeModal(); mjOnlineEnter(r.view); }catch(e){ toast(e.message); busy(false); } };
  document.querySelectorAll('#md [data-bcq]').forEach(b=>b.onclick=()=>go('quick', {lvl:b.dataset.bcq, game:'bc'}));
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
    <p><b>下注限制：</b>每注最低 100 金；莊、閒每局最多各押 20,000 金，和、閒對、莊對每局最多各押 10,000 金。</p></div>`;
  if(mjOn()) return mjPanel('📖 百家樂怎麼玩', body, [['知道了','',mjPanelClose]]);
  modal('📖 百家樂怎麼玩', body, [['知道了','',openBcLobby]]);
}
const BC_BET_SEC = 15;

// 開牌動畫：照時間一張一張翻（閒、莊、閒、莊，再補牌）
function bcReveal(V){
  if(!V.cards) return { p:0, b:0, done:false };
  const t = Date.now() - ((V.dealAt||0) + (MJO ? MJO.off : 0));
  const seq = [['p',0],['b',0],['p',1],['b',1]]; if(V.cards.p.length>2) seq.push(['p',2]); if(V.cards.b.length>2) seq.push(['b',2]);
  const S0 = 900;   // 前 0.9 秒是把牌從牌靴滑出來
  const times = [S0,S0+700,S0+1400,S0+2100]; let last = S0+2100; for(let i=4;i<seq.length;i++){ last += 1500; times.push(last); }
  if(V.phase==='end') return { p:V.cards.p.length, b:V.cards.b.length, done:true, t, dl:{ p:true, b:true } };
  const n = times.filter(x=>t >= x + 300).length, shown = { p:0, b:0 };
  seq.slice(0, n).forEach(([s])=>shown[s]++);
  // 補牌：要補的那一家，前面四張都翻完才從牌靴發出第三張（沒要補就只有兩張，不會先擺一張蓋著的牌）
  const dl = { p:false, b:false }; seq.forEach(([s,i],k)=>{ if(i===2 && t >= times[k] - 300) dl[s] = true; });
  return { ...shown, done: n >= seq.length, t, dl };
}
let bcDl3 = {};   // 第三張滑出來的動畫只播一次
function bcRender(V){
  const T = BC.TABLES[V.lvl] || BC.TABLES.n;
  if(!T.chips.includes(bcChip)) bcChip = T.chips[0];
  if(S && S.me && typeof V.myGold==='number') S.me.gold = V.myGold;
  $('mj').style.setProperty('--b2pet', `url("${typeof chrSrc==='function' ? chrSrc((V.pet||'bunny')+'1') : ''}")`);
  const felt = $('mjFelt'); if(!felt) return;
  const rv = bcReveal(V), bet = V.phase==='bet';
  // 翻牌動畫只給剛翻開的那張，翻好的不要每次重畫都再跳
  const prev = bcPrevShown.round === V.round ? bcPrevShown : { p:0, b:0 };
  bcPrevShown = { round: V.round, p: rv.p, b: rv.b };
  const shuffling = bet && (V.shufUntil||0) + (MJO?MJO.off:0) > Date.now(); bcShufShown = shuffling;
  const slide = V.phase==='deal' && rv.p + rv.b === 0 && bcSlid !== V.round;   // 這局第一次畫：牌從牌靴滑出來
  const cards = side => { const cs = (V.cards && V.cards[side]) || [], n = side==='p' ? rv.p : rv.b;
    const shown = cs.slice(0, n), pt = shown.length ? BC.pts(shown) : null;
    const slots = [0,1,2].map(i=> i < cs.length && (i < 2 || rv.dl[side]) ? (i < n ? b2Card(cs[i], 'bcc' + (i===2?' third':'') + (i >= prev[side] ? ' new' : '')) : b2Card(null, 'bcc' + (i===2?' third' + (bcDl3[V.round+side] ? '' : (bcDl3[V.round+side]=1, ' in3')):'') + (i<2 && slide ? ` in d${side==='p'?i*2:i*2+1}` : ''))) : `<i class="b2c bcc ghost${i===2?' third':''}"></i>`).join('');   // 沒牌的格子畫虛線，第三張補進來時牌不會跳
    const won = V.result && (V.result.win===side);
    return `<div class="bcside bc-${side}${won?' won':''}"><div class="bcsh"><b>${side==='p'?'閒':'莊'}</b>${pt!=null?`<span class="bcpt">${pt} 點</span>`:''}</div><div class="bccs">${slots}</div></div>`; };
  const road = bcRoad(V.hist||[]);
  const players = `<div class="bcpl">${(V.players||[]).map(p=>`<div class="bcpp${p.me?' me':''}"><img src="${avSrc(p.av)}" alt=""><span>${esc(p.name)}</span><b>${p.win!=null && p.bet ? (p.win>0?`<em class="up">+${p.win.toLocaleString()}</em>`:p.win<0?`<em class="dn">${p.win.toLocaleString()}</em>`:'退回') : p.bet ? p.bet.toLocaleString() : '—'}</b></div>`).join('')}</div>`;
  const left = Math.max(0, Math.ceil(((V.tEnd||0) + (MJO?MJO.off:0) - Date.now())/1000));
  const status = bet && shuffling ? `<div class="bcst deal"><span>洗牌中</span></div>` : bet ? `<div class="bcst bet"><b id="bcSec">${left}</b><span>請下注</span></div>`
    : V.phase==='deal' ? `<div class="bcst deal"><span>停止下注・開牌中</span></div>`
    : V.result ? `<div class="bcst res r-${V.result.win}"><b>${V.result.win==='t'?'和局':V.result.win==='b'?'莊贏':'閒贏'}</b><span>${V.result.pt} : ${V.result.bt}${V.result.pp?'・閒對':''}${V.result.bp?'・莊對':''}</span></div>` : '';
  if(slide) bcSlid = V.round;
  // 洗牌動畫：換新牌靴時播
  const shufLeft = (V.shufUntil||0) + (MJO?MJO.off:0) - Date.now();
  const shuffle = bet && shufLeft > 0 ? `<div class="bcshuf"><div class="bcsl">${b2Card(null,'sh')}${b2Card(null,'sh')}${b2Card(null,'sh')}</div><div class="bcsr">${b2Card(null,'sh')}${b2Card(null,'sh')}${b2Card(null,'sh')}</div><b>洗牌中⋯</b><small>換一副新的 8 副牌，牌路從頭開始</small></div>` : '';
  felt.style.setProperty('--bcw', (mjW < 760 ? 40 : 46) + 'px');
  felt.innerHTML = `${road}${players}<div class="bcshoe">${b2Card(null,'shoe')}<small>${V.shoeLeft!=null?`剩 ${V.shoeLeft} 張`:''}</small></div>${shuffle}<div class="bctable">${cards('p')}${status}${cards('b')}</div>`;

  // 押注區
  const my = V.myBets || {}, tot = V.totals || {};
  const res = V.result, winArea = k => res && (k===res.win || (k==='pp'&&res.pp) || (k==='bp'&&res.bp));
  const areas = BC_ORDER.map(k=>{ const A = BC.AREAS[k], m = my[k]||0, all = tot[k]||0;
    const fk = V.round + ':' + k + ':' + m, flash = m && bcFlash[k] !== fk; bcFlash[k] = fk;
    return `<button class="bca bca-${k}${winArea(k)?' win':''}${res && !winArea(k) && m ? ' lose':''}" data-bca="${k}" ${bet && !shuffling?'':'disabled'}>
      <b>${A.name}</b><small>1 賠 ${A.pay}・上限 ${BC.LIMIT[k]/10000} 萬</small>${all?`<span class="bcall">全桌 ${all.toLocaleString()}</span>`:''}${m?`<span class="bcmy${flash?' pop':''}">${m.toLocaleString()}</span>`:''}</button>`; }).join('');
  const myTot = Object.values(my).reduce((s,x)=>s+x,0);
  const winTxt = V.phase==='end' && V.myWin!=null && myTot ? (V.myWin>0?`<span class="bcwin up">贏 +${V.myWin.toLocaleString()}</span>`:V.myWin<0?`<span class="bcwin dn">輸 ${V.myWin.toLocaleString()}</span>`:`<span class="bcwin">押注退回</span>`) : '';
  $('mjUi').innerHTML = `<div class="bcareas">${areas}</div>
    <div class="bcchips">${T.chips.map(c=>`<button class="bcchip${c===bcChip?' on':''}" data-chip="${c}" ${bet?'':'disabled'}>${c>=10000?(c/10000)+'萬':c>=1000?(c/1000)+'K':c}</button>`).join('')}
      <button class="bcclr" id="bcClr" ${bet && myTot?'':'disabled'}>清除</button><span class="bcmine">這局押 <b>${myTot.toLocaleString()}</b></span>${winTxt}</div>`;
  $('mjBar').innerHTML = `<div class="mjbt">莊閒 100～2萬・和對 最高1萬</div>
    <div class="mjbme"><img src="${avSrc(S.me.avatar||11)}" alt=""><b>${esc(S.me.nickname||'')}</b><span class="mjbg">${(V.myGold||0).toLocaleString()}</span></div>
    <div class="mjbt r">百家樂・第 ${V.round} 局</div>`;
  $('mjEnd').innerHTML = '';

  document.querySelectorAll('#mj [data-chip]').forEach(b=>b.onclick=()=>{ bcChip = +b.dataset.chip; mjSfx('pick'); bcRender(mjCurView()); });
  document.querySelectorAll('#mj [data-bca]').forEach(b=>b.onclick=()=>bcBet(b.dataset.bca));
  if($('bcClr')) $('bcClr').onclick = ()=>{ const VV = mjCurView(); if(!VV || !MJO) return; VV.myBets = {}; mjSfx('pick'); bcRender(VV); bcSend({ a:'clear' }); };

  // 開牌：照時間重畫；有人中獎放音效
  const stage = V.round + ':' + V.phase + ':' + rv.p + ':' + rv.b + ':' + (rv.dl?(+rv.dl.p)+''+(+rv.dl.b):'');
  if(stage !== bcStage){
    if(V.phase==='deal' && (rv.p + rv.b) > 0) mjSfx('tile');
    if(V.phase==='end' && bcStage.indexOf(V.round + ':end') !== 0 && V.myWin > 0){ mjSfx('win'); }
    bcStage = stage;
  }
  clearInterval(bcTimer);
  bcTimer = setInterval(()=>{
    const VV = mjCurView(); if(!VV || VV.game!=='bc' || !mjOn()){ clearInterval(bcTimer); return; }
    if(VV.phase==='bet' && (VV.shufUntil||0) && bcShufShown !== (VV.shufUntil + (MJO?MJO.off:0) > Date.now())){ bcRender(VV); return; }
    if(VV.phase==='bet'){ const el = $('bcSec'); if(el){ const l = Math.max(0, Math.ceil(((VV.tEnd||0) + (MJO?MJO.off:0) - Date.now())/1000)); el.textContent = l; el.classList.toggle('hurry', l<=5); } return; }
    if(VV.phase==='deal'){ const r = bcReveal(VV); if(VV.round + ':deal:' + r.p + ':' + r.b + ':' + (+r.dl.p) + (+r.dl.b) !== bcStage) bcRender(VV); }
  }, 200);
}
function bcBet(k){
  const V = mjCurView(); if(!V || V.phase!=='bet' || !MJO) return;
  const T = BC.TABLES[V.lvl] || BC.TABLES.n, my = V.myBets || (V.myBets = {});
  const tot = Object.values(my).reduce((s,x)=>s+x,0) + bcChip;
  if((my[k]||0) + bcChip > BC.LIMIT[k]) return mjToast(`${BC.AREAS[k].name}每局最多押 ${BC.LIMIT[k].toLocaleString()} 金`);
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

// 牌路：珠盤路（每局一格，紅＝莊、藍＝閒、綠＝和）＋大路（同一邊連贏往下排，換邊就換一行；和局畫斜線）
function bcRoad(hist){
  const n = { b:0, p:0, t:0 }; hist.forEach(h=>n[h[0]]++);
  const bead = hist.slice(-48);
  const beadHtml = bead.map(h=>`<i class="r-${h[0]}">${h[0]==='b'?'莊':h[0]==='p'?'閒':'和'}${/P/.test(h)?'<u class="pp"></u>':''}${/B/.test(h)?'<u class="bp"></u>':''}</i>`).join('');
  // 大路
  const cols = []; let last = null;
  hist.forEach(h=>{
    const w = h[0];
    if(w==='t'){ if(cols.length){ const c = cols[cols.length-1]; c[c.length-1].t++; } else { cols.push([{ w:'t0', t:1 }]); } return; }
    if(last === w && cols.length && cols[cols.length-1].length < 6) cols[cols.length-1].push({ w, t:0 });
    else cols.push([{ w, t:0 }]);
    last = w;
  });
  const big = cols.slice(-14);
  const bigHtml = big.map(c=>`<div class="bcbc">${c.map(x=>`<i class="b-${x.w}">${x.t?`<s></s>${x.t>1?`<em>${x.t}</em>`:''}`:''}</i>`).join('')}</div>`).join('');
  return `<div class="bcroadw"><div class="bcrh"><b>牌路</b><span class="r-b">莊 ${n.b}</span><span class="r-p">閒 ${n.p}</span><span class="r-t">和 ${n.t}</span></div>
    <div class="bcroad">${beadHtml || '<small>還沒開過牌</small>'}</div><div class="bcbig">${bigHtml}</div></div>`;
}
