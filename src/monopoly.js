/* ---------- 大富翁（農場版）：連線，跟麻將共用牌桌外框、連線流程、結算 ---------- */
const MF_ICON = {n:'🌱', m:'🌻', h:'🏆'};
const MF_PC = ['#E84B4B', '#3B82F6', '#22A55B', '#F59E0B'];   // 四個座位的顏色
const MF_SP = {go:'🏁', chance:'❓', fate:'🎴', tax:'🏪', rest:'🛏️', park:'🅿️', barn:'🌾', storm:'🌀'};
let mfLastPos = null, mfLastHand = 0;

function openMfLobby(){
  const gold = S.me.gold;
  modal('🎲 大富翁', `<div class="rhint">農場版大富翁，2～4 人連線，人不夠由農場電腦補位。每人付報名費進獎池，每人走 ${MF.ROUNDS} 輪後比總資產：第 1 名拿 70%、第 2 名拿 30%（娛樂廳抽 ${Math.round(MF.RAKE*100)}%）。中途離開，這局由系統代打、照樣結算</div>
    <div id="mfBack"></div>
    ${Object.entries(MF.TABLES).map(([k,t])=>{ const poor = gold<t.min, win = Math.floor(t.fee*4*(1-MF.RAKE)*0.7); return `<div class="mjtb"><div class="mjtbi">${MF_ICON[k]}</div><div class="tx"><b>${t.name}</b>
      <div>報名費 ${t.fee.toLocaleString()} 金</div><div>4 人桌第 1 名拿 ${win.toLocaleString()} 金</div></div>
      <div class="mjtbb"><button class="mini" data-mfq="${k}" ${poor?'disabled':''}>${poor?'金幣不夠':'快速配對'}</button><button class="mini sub" data-mfc="${k}" ${poor?'disabled':''}>開房間</button></div></div>`; }).join('')}
    <div class="mjjoin"><input id="mfCode" inputmode="numeric" maxlength="4" placeholder="輸入 4 位數房號"><button class="mini" id="mfJoin">加入朋友的房間</button></div>
    <button class="link" id="mfRules">📖 怎麼玩？</button>`, [['回寵物娛樂廳','sub',()=>openHall('casino')]]);
  const busy = b => { document.querySelectorAll('#md .mini').forEach(x=>x.disabled = b); };
  const go = async (a, extra) => { busy(true); try{ const r = await mjCall(a, extra); if(!r.view) throw new Error('進不去，等等再試'); closeModal(); mjOnlineEnter(r.view); }catch(e){ toast(e.message); busy(false); } };
  document.querySelectorAll('#md [data-mfq]').forEach(b=>b.onclick=()=>go('quick', {lvl:b.dataset.mfq, game:'mf'}));
  document.querySelectorAll('#md [data-mfc]').forEach(b=>b.onclick=()=>mjAskVis(pub=>go('create', {lvl:b.dataset.mfc, game:'mf', pub}), openMfLobby));
  $('mfJoin').onclick = ()=>{ const c = ($('mfCode').value||'').trim(); if(!/^\d{4}$/.test(c)) return toast('房號是 4 位數字'); go('join', {code:c}); };
  $('mfRules').onclick = mfRules;
  mjCall('state').then(r=>{ if(r.view && r.view.status && $('mfBack')) { $('mfBack').innerHTML = `<button class="btn o" id="mfBackB" style="width:100%;margin:6px 0">🎲 你還有一桌在玩，回到牌桌</button>`; $('mfBackB').onclick = ()=>{ closeModal(); mjOnlineEnter(r.view); }; } }).catch(()=>{});
}
function mfRules(){
  const body = `<div class="help">
    <p><b>怎麼玩：</b>輪到你時擲兩顆骰子往前走。每經過起點領 ${MF.PASS_GO.toLocaleString()}（大富翁幣，跟農場金幣分開，每人起始 ${MF.START_CASH.toLocaleString()}）。</p>
    <p><b>菜園：</b>走到沒人的菜園可以買下來；別人走到你的地要付過路費。同一種顏色全部買齊，過路費加倍，還可以蓋溫室（最多 ${MF.MAXH} 間），每多一間過路費大幅提高。</p>
    <p><b>特殊格：</b>❓機會、🎴命運抽卡（有好有壞）；🏪菜市場繳稅；🌾穀倉領錢；🛏️休息站休息一回合；🌀颱風每間溫室要付修理費；🅿️免費停車沒事。</p>
    <p><b>錢不夠：</b>系統會自動賣掉溫室、把地抵押給銀行換錢；還是不夠就破產出局。抵押的地之後可以付 55% 贖回。</p>
    <p><b>結束：</b>每人走 ${MF.ROUNDS} 輪，或只剩一人沒破產。比總資產（現金＋地＋溫室）排名。</p>
    <p><b>獎池：</b>每人付的報名費（農場金幣）進獎池，娛樂廳抽 ${Math.round(MF.RAKE*100)}%，剩下第 1 名拿 70%、第 2 名拿 30%。</p>
    <p><b>時間：</b>每個動作 15 秒，沒動作系統自動幫你（擲骰子、不買、結束回合）。</p></div>`;
  if(mjOn()) return mjPanel('📖 大富翁怎麼玩', body, [['知道了','',mjPanelClose]]);
  modal('📖 大富翁怎麼玩', body, [['知道了','',openMfLobby]]);
}

// 格子 i 在 8×8 外圈的位置（起點在右下，往左走）
function mfXY(i){ if(i <= 7) return [7 - i, 7]; if(i <= 14) return [0, 7 - (i - 7)]; if(i <= 21) return [i - 14, 0]; return [7, i - 21]; }
function mfLog(e, V){
  const nm = j => j===V.me ? '你' : esc((V.seats[j]||{}).name||''), B = MF.B;
  switch(e.k){
    case 'roll': return `${nm(e.s)} 擲出 ${e.d[0]}＋${e.d[1]}`;
    case 'buy': return `${nm(e.s)} 買下 ${B[e.p].n}`;
    case 'rent': return `${nm(e.s)} 付 ${nm(e.to)} 過路費 ${e.amt.toLocaleString()}`;
    case 'build': return `${nm(e.s)} 在 ${B[e.p].n} 蓋溫室`;
    case 'tax': return `${nm(e.s)} 在菜市場繳稅 ${e.amt.toLocaleString()}`;
    case 'barn': return `${nm(e.s)} 在穀倉領 ${e.amt.toLocaleString()}`;
    case 'go': return `${nm(e.s)} 經過起點領 ${MF.PASS_GO.toLocaleString()}`;
    case 'rest': return `${nm(e.s)} 在休息站休息一回合`;
    case 'skip': return `${nm(e.s)} 休息中，這輪略過`;
    case 'storm': return `🌀 ${nm(e.s)} 遇到颱風，修溫室付 ${e.amt.toLocaleString()}`;
    case 'storm0': return `🌀 ${nm(e.s)} 遇到颱風，還好沒有溫室`;
    case 'card': return `${nm(e.s)} 抽到：${esc(e.t)}`;
    case 'mort': return `${nm(e.s)} 把 ${B[e.p].n} 抵押換錢`;
    case 'unmort': return `${nm(e.s)} 贖回 ${B[e.p].n}`;
    case 'sellh': return `${nm(e.s)} 賣掉 ${B[e.p].n} 的溫室`;
    case 'bk': return `💥 ${nm(e.s)} 破產了！`;
    case 'start': return `遊戲開始，${nm(e.s)} 先擲`;
    case 'end': return '🏁 遊戲結束！';
  }
  return '';
}
function mfTileIcon(b){ if(b.k !== 'p') return `<span class="mfsp">${MF_SP[b.k]||''}</span>`; const c = typeof CROP!=='undefined' && CROP[b.crop]; return c ? iconSVG(c) : '🌱'; }

function mfRender(V){
  mjMe = V.me;
  const ME = V.me, T = MF.TABLES[V.table] || MF.TABLES.n, me = V.seats[ME], wl = V.waiting || [], B = MF.B;
  const felt = $('mjFelt'); if(!felt) return;
  const myTurn = V.phase==='play' && V.turn===ME && !me.auto;
  // 棋盤大小：高度塞滿（扣掉下面那條），右邊留玩家欄
  const side = Math.max(220, Math.min(mjH - 44, mjW - 250)), ts = side / 8;
  const tiles = B.map((b, i) => { const [x, y] = mfXY(i), o = V.own[i];
    return `<div class="mft${b.k==='p'?'':' sp'}${V.mort[i]?' mort':''}" data-mt="${i}" style="left:${x*ts}px;top:${y*ts}px;width:${ts}px;height:${ts}px;${o>=0?`--oc:${MF_PC[o]}`:''}">
      ${b.k==='p' ? `<i class="mfband" style="background:${MF.COLORS[b.g]}"></i>` : ''}<div class="mfti">${mfTileIcon(b)}</div><small>${b.n}</small>
      ${b.k==='p' ? `<em>${o>=0 ? (V.hs[i] ? '🏠'.repeat(V.hs[i]) : (V.mort[i] ? '抵押' : '')) : b.price.toLocaleString()}</em>` : ''}${o>=0?'<b class="mfown"></b>':''}</div>`; }).join('');
  // 棋子：每格最多 4 個，錯開放
  const tokens = V.seats.map((s, j) => { if(V.bk[j]) return ''; const p = V.pos[j], [x, y] = mfXY(p), same = V.seats.map((q,k)=>k).filter(k=>!V.bk[k] && V.pos[k]===p), n = same.indexOf(j);
    const dx = (n % 2) * ts * 0.42 + ts * 0.08, dy = Math.floor(n / 2) * ts * 0.4 + ts * 0.12;
    return `<img class="mftok${V.turn===j&&V.phase==='play'?' on':''}" data-tok="${j}" src="${avSrc(s.av)}" alt="" style="left:${x*ts+dx}px;top:${y*ts+dy}px;width:${ts*0.5}px;height:${ts*0.5}px;border-color:${MF_PC[j]}">`; }).join('');
  // 中間：骰子、輪次、卡片、最近幾行紀錄、我的按鈕
  const logs = (V.log||[]).slice(-4).map(e=>mfLog(e, V)).filter(Boolean).map(t=>`<div>${t}</div>`).join('');
  const o = V.opts || {}, i = V.pos[ME];
  let acts = '';
  if(myTurn){
    if(o.stage==='roll') acts = `<button class="b2b go" id="mfRoll">🎲 擲骰子</button>`;
    else if(o.stage==='skip') acts = `<button class="b2b go" id="mfRoll">💤 休息中，略過這輪</button>`;
    else if(o.stage==='buy') acts = `<button class="b2b go" id="mfBuy">買下 ${B[i].n}<small>${B[i].price.toLocaleString()}</small></button><button class="b2b pass" id="mfSkip">不買</button>`;
    else if(o.stage==='manage') acts = (o.builds||[]).slice(0,3).map(k=>`<button class="b2b mfbd" data-bd="${k}">🏠 ${B[k].n}<small>${MF.houseCost(k).toLocaleString()}</small></button>`).join('')
      + B.map((b,k)=>k).filter(k=>V.own[k]===ME && V.mort[k]).slice(0,2).map(k=>`<button class="b2b mfbd" data-um="${k}">贖回 ${B[k].n}<small>${Math.round(B[k].price*0.55).toLocaleString()}</small></button>`).join('')
      + `<button class="b2b go" id="mfEnd">結束回合</button>`;
  }
  const cur = V.phase==='play' && V.turn>=0 ? (V.turn===ME ? '輪到你' : `輪到 ${esc(V.seats[V.turn].name)}`) : '';
  const dice = V.dice ? `<div class="mfdice">${mjDie(V.dice[0])}${mjDie(V.dice[1])}</div>` : '';
  const card = V.card ? `<div class="mfcard">${V.card.s===ME?'你':esc(V.seats[V.card.s].name)}抽到：<b>${esc(V.card.t)}</b></div>` : '';
  const center = `<div class="mfmid" style="left:${ts}px;top:${ts}px;width:${ts*6}px;height:${ts*6}px">
    <div class="mfround">第 ${Math.min(V.round, V.rounds)} / ${V.rounds} 輪・${cur} <b id="mjSec"></b></div>${dice}${card}<div class="mflog">${logs}</div><div class="mfacts">${acts}</div></div>`;
  // 右邊：玩家
  const order = [0,1,2,3].map(k=>(ME+k)%4);
  const pw = Math.max(150, Math.min(240, mjW - side - 90));
  const players = `<div class="mfpl" style="left:${side+22}px;width:${pw}px">${order.map(j=>{ const s = V.seats[j];
    return `<div class="mfp${V.turn===j&&V.phase==='play'?' on':''}${V.bk[j]?' out':''}" style="--pc:${MF_PC[j]}"><img src="${avSrc(s.av)}" alt=""><div><b>${j===ME?'你':esc(s.name)}${V.rest[j]?' 💤':''}${s.auto&&!s.bot?' <small>託管</small>':''}</b>
      <span>💵 ${V.bk[j]?'破產':V.cash[j].toLocaleString()}</span><small>總資產 ${V.worth[j].toLocaleString()}</small></div></div>`; }).join('')}</div>`;
  felt.innerHTML = `<div class="mfwrap" style="width:${side}px;height:${side}px">${tiles}${tokens}${center}</div>${players}`;
  $('mjUi').innerHTML = '';
  $('mjBar').innerHTML = `<div class="mjbt">報名費 ${T.fee.toLocaleString()} 金</div>
    <div class="mjbme${wl.includes(ME)&&V.phase==='play'?' on':''}"><img src="${avSrc(me.av)}" alt=""><b>${esc(me.name)}</b><span class="mjbg">${me.gold.toLocaleString()}</span></div>
    <div class="mjbt r">${T.name}・大富翁</div>`;

  // 棋子移動動畫：從上一格一路跳過去
  if(mfLastHand !== V.handNo){ mfLastHand = V.handNo; mfLastPos = null; }
  if(mfLastPos) V.pos.forEach((p, j) => { const q = mfLastPos[j]; if(q == null || q === p || V.bk[j]) return;
    const el = felt.querySelector(`[data-tok="${j}"]`); if(!el) return;
    const steps = (p - q + MF.N) % MF.N; if(steps > 12) return;
    const path = Array.from({length: steps}, (_, k) => mfXY((q + k + 1) % MF.N));
    const [x0, y0] = mfXY(q), left0 = parseFloat(el.style.left) - mfXY(p)[0]*ts, top0 = parseFloat(el.style.top) - mfXY(p)[1]*ts;
    const frames = [[x0, y0]].concat(path).map(([x, y]) => ({ left: (x*ts + left0) + 'px', top: (y*ts + top0) + 'px' }));
    try{ el.animate(frames, { duration: 160 * steps, easing: 'linear' }); }catch(e){}
  });
  mfLastPos = V.pos.slice();

  // 結算
  const endKey = V.phase==='end' ? 'mf:' + V.handNo : '';
  const endHtml = V.phase==='end' && V.result ? mfResultHtml(V) : '';
  $('mjEnd').innerHTML = endKey && endKey === mjAnimKey.end ? endHtml.replace('class="mjres"', 'class="mjres still"') : endHtml;
  mjAnimKey.end = endKey;
  if(V.phase==='end' && V.result) mjBindResult(V);

  // 輪到我：提醒
  const turnKey = myTurn && o.stage==='roll' ? V.handNo + ':' + V.logN : '';
  if(turnKey && turnKey !== mjAnimKey.turn) setTimeout(()=>{ const VV = mjCurView(); if(VV && VV.phase==='play' && VV.turn===VV.me) mjTurnAlert(); }, 60);
  mjAnimKey.turn = turnKey;
  // 新事件的音效
  const L = V.log || [], N = V.logN != null ? V.logN : L.length;
  if(!mjLastLog || mjLastLog.h !== V.handNo || N < mjLastLog.n) mjLastLog = { h: V.handNo, n: Math.max(0, N - 1) };
  const fresh = L.slice(Math.max(0, L.length - (N - mjLastLog.n))); mjLastLog.n = N;
  for(const e of fresh){ if(e.k==='roll') mjSfx('tile'); else if(e.k==='buy' || e.k==='build') mjSfx('pick'); }

  if($('mfRoll')) $('mfRoll').onclick = ()=>mfDo({a:'roll'});
  if($('mfBuy')) $('mfBuy').onclick = ()=>mfDo({a:'buy'});
  if($('mfSkip')) $('mfSkip').onclick = ()=>mfDo({a:'skip'});
  if($('mfEnd')) $('mfEnd').onclick = ()=>mfDo({a:'end'});
  felt.querySelectorAll('[data-bd]').forEach(b=>b.onclick=()=>mfDo({a:'build', p:+b.dataset.bd}));
  felt.querySelectorAll('[data-um]').forEach(b=>b.onclick=()=>mfDo({a:'unmort', p:+b.dataset.um}));
  felt.querySelectorAll('[data-mt]').forEach(t=>t.onclick=()=>mfTileInfo(+t.dataset.mt));
}
function mfDo(a){
  const V = mjCurView(); if(!V || V.phase!=='play' || !MJO || MJO.busy) return;
  document.querySelectorAll('#mj .mfacts button').forEach(b=>b.disabled = true);
  mjOnline('act', { act: a });
}
function mfTileInfo(i){
  const V = mjCurView(); if(!V) return; const b = MF.B[i];
  if(b.k !== 'p') return mjPanel(`${MF_SP[b.k]||''} ${b.n}`, `<div class="help"><p>${{go:`每經過一次領 ${MF.PASS_GO.toLocaleString()}`, chance:'抽一張機會卡', fate:'抽一張命運卡', tax:`繳稅 ${(b.amt||0).toLocaleString()}`, rest:'休息一回合', park:'什麼事都沒有，休息一下', barn:`領 ${(b.amt||0).toLocaleString()}`, storm:`每間溫室付修理費 ${(b.amt||0).toLocaleString()}`}[b.k]||''}</p></div>`, [['知道了','',mjPanelClose]]);
  const base = Math.round(b.price/10), o = V.own[i], hc = MF.houseCost(i);
  mjPanel(`${b.n}`, `<div class="help"><p>價錢 ${b.price.toLocaleString()}・蓋一間溫室 ${hc.toLocaleString()}</p>
    <p>過路費：沒蓋 ${base.toLocaleString()}（同色買齊 ${(base*2).toLocaleString()}）・1 間 ${(base*MF.HMUL[1]).toLocaleString()}・2 間 ${(base*MF.HMUL[2]).toLocaleString()}・3 間 ${(base*MF.HMUL[3]).toLocaleString()}</p>
    <p>${o>=0 ? `主人：${o===V.me?'你':esc(V.seats[o].name)}${V.hs[i]?`，溫室 ${V.hs[i]} 間`:''}${V.mort[i]?'（抵押中，不收過路費）':''}，現在過路費 ${(V.rent[i]||0).toLocaleString()}` : '還沒有人買'}</p></div>`, [['知道了','',mjPanelClose]]);
}
function mfResultHtml(V){
  const r = V.result, T = MF.TABLES[V.table] || MF.TABLES.n, w = V.seats[r.order[0]];
  const btns = `<div class="mjrb"><button class="btn sub" id="mjOut">離開</button><button class="btn" id="mjNext">再玩一局 <span id="mjNs"></span></button></div>`;
  const rows = r.order.map((j, k)=>{ const s = V.seats[j], v = r.pay[j];
    return `<div class="mjpr${j===V.me?' me':''}"><img src="${avSrc(s.av)}" alt=""><span>${['🥇','🥈','3️⃣','4️⃣'][k]} ${esc(s.name)}<small class="b2why">總資產 ${r.worth[j].toLocaleString()}${V.bk[j]?'（破產）':''}</small></span><b class="${v>0?'up':v<0?'dn':''}">${v>0?'+':''}${v.toLocaleString()}</b></div>`; }).join('');
  return `<div class="mjres"><div class="mjrc${r.order[0]===V.me?' mine':''}"><div class="mjrl1"><div class="mjrt">🏆 ${esc(w.name)} 贏了！</div>
    <div class="mjrs">獎池 ${r.pool.toLocaleString()} 金（報名費 ${T.fee.toLocaleString()} × ${V.seats.length}），第 1 名 70%、第 2 名 30%</div></div>
    <div class="mjrl2"><div class="mjpay">${rows}</div>${r.rake?`<div class="mjrk">娛樂廳場地費 ${Math.round(MF.RAKE*100)}%：${r.rake.toLocaleString()} 金</div>`:''}${btns}</div></div></div>`;
}
