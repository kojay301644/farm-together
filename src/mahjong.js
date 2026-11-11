/* ================= 遊戲廳・麻將 ================= */

/* ---------- 牌面（SVG 自己畫，不用圖檔） ---------- */
const MJC = { blue:'#2F6FB8', green:'#23915A', red:'#D3403A', ink:'#22304A' };
const MJ_DOT = {
  1:[[22,29,13]], 2:[[22,16,8.5],[22,43,8.5]], 3:[[11,13,7],[22,29,7],[33,45,7]], 4:[[13,16,7.5],[31,16,7.5],[13,42,7.5],[31,42,7.5]],
  5:[[12,13,6.5],[32,13,6.5],[22,29,6.5],[12,45,6.5],[32,45,6.5]], 6:[[13,11,6],[31,11,6],[13,29,6],[31,29,6],[13,47,6],[31,47,6]],
  7:[[10,9,5.2],[22,14,5.2],[34,19,5.2],[14,33,5.6],[30,33,5.6],[14,47,5.6],[30,47,5.6]], 8:[[13,9,5.3],[31,9,5.3],[13,22,5.3],[31,22,5.3],[13,36,5.3],[31,36,5.3],[13,49,5.3],[31,49,5.3]],
  9:[[10,12,5.4],[22,12,5.4],[34,12,5.4],[10,29,5.4],[22,29,5.4],[34,29,5.4],[10,46,5.4],[22,46,5.4],[34,46,5.4]],
};
const MJ_DOTC = {1:[0], 2:[1,0], 3:[0,2,1], 4:[0,1,1,0], 5:[0,1,2,1,0], 6:[1,1,2,2,2,2], 7:[1,1,1,2,2,2,2], 8:[0,0,0,0,0,0,0,0], 9:[0,0,0,2,2,2,1,1,1]};
const MJ_BAM = {  // [x, y中心, 高, 紅?]
  2:[[22,16,20],[22,43,20]], 3:[[22,16,20],[12,43,20],[32,43,20]], 4:[[13,16,20],[31,16,20],[13,43,20],[31,43,20]],
  5:[[11,16,20],[33,16,20],[22,29,20,1],[11,43,20],[33,43,20]], 6:[[10,16,20],[22,16,20],[34,16,20],[10,43,20],[22,43,20],[34,43,20]],
  7:[[22,10,15,1],[10,30,15],[22,30,15],[34,30,15],[10,48,15],[22,48,15],[34,48,15]],
  8:[[8,16,20],[17,16,20],[27,16,20],[36,16,20],[8,43,20],[17,43,20],[27,43,20],[36,43,20]],
  9:[[10,11,15],[22,11,15,1],[34,11,15],[10,29,15],[22,29,15,1],[34,29,15],[10,47,15],[22,47,15,1],[34,47,15]],
};
const MJ_FLC = {51:'#2E9660',52:'#D3403A',53:'#E0861E',54:'#2F6FB8',55:'#D24A7A',56:'#7A4FB8',57:'#23915A',58:'#D99A12'};
const mjCache = {};
function mjFace(t){
  const T = (x,y,s,c,txt)=>`<text x="${x}" y="${y}" font-size="${s}" fill="${c}" text-anchor="middle" font-weight="900" font-family="Noto Sans TC,sans-serif">${txt}</text>`;
  if(t>50){ const c=MJ_FLC[t], n=(t-51)%4+1;
    return T(22,40,26,c,MJ.name(t)) + T(9,15,11,c,n) + `<circle cx="34" cy="11" r="4.5" fill="${c}" opacity=".85"/><circle cx="34" cy="11" r="1.8" fill="#FFE27A"/>`; }
  if(t>40){ const c = t===45?MJC.red : t===46?MJC.green : MJC.ink;
    if(t===47) return `<rect x="9" y="9" width="26" height="38" rx="3" fill="none" stroke="${MJC.blue}" stroke-width="3"/><rect x="14" y="14" width="16" height="28" rx="2" fill="none" stroke="${MJC.blue}" stroke-width="1.6"/>`;
    return T(22,39,29,c,MJ.name(t)); }
  const s=Math.floor(t/10), n=t%10;
  if(s===1) return T(22,25,20,MJC.ink,['','一','二','三','四','五','六','七','八','九'][n]) + T(22,49,20,MJC.red,'萬');
  if(s===2){ const cs=[MJC.blue,MJC.green,MJC.red];
    if(n===1) return `<circle cx="22" cy="29" r="15" fill="${MJC.green}"/><circle cx="22" cy="29" r="11.5" fill="#fff"/><circle cx="22" cy="29" r="9" fill="${MJC.red}"/><circle cx="22" cy="29" r="5.5" fill="#fff"/><circle cx="22" cy="29" r="3" fill="${MJC.blue}"/>`;
    return MJ_DOT[n].map(([x,y,r],i)=>{ const c=cs[MJ_DOTC[n][i]]; return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x}" cy="${y}" r="${(r*0.62).toFixed(1)}" fill="#fff"/><circle cx="${x}" cy="${y}" r="${(r*0.32).toFixed(1)}" fill="${c}"/>`; }).join(''); }
  // 條
  if(n===1) return `<ellipse cx="21" cy="33" rx="11" ry="9" fill="${MJC.green}"/><circle cx="29" cy="19" r="7" fill="${MJC.green}"/><circle cx="31" cy="17.5" r="1.8" fill="#fff"/><circle cx="31.4" cy="17.5" r="0.9" fill="#222"/>
    <path d="M35.5 19 L41 20.5 L35.5 22.5Z" fill="#E8A21E"/><path d="M11 30 L3 22 L6 34 L2 40 L13 38Z" fill="${MJC.red}"/><path d="M17 31 Q22 36 28 31" stroke="#fff" stroke-width="1.6" fill="none"/>
    <path d="M18 41 L16 50 M24 41 L25 50" stroke="#B8701E" stroke-width="2" stroke-linecap="round"/>`;
  return MJ_BAM[n].map(([x,y,h,r])=>{ const c=r?MJC.red:MJC.green, w=5.6;
    return `<rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="2.6" fill="${c}"/><rect x="${x-w/2-0.6}" y="${y-0.9}" width="${w+1.2}" height="1.8" rx=".9" fill="${c}" opacity=".7"/><line x1="${x}" y1="${y-h/2+2.5}" x2="${x}" y2="${y+h/2-2.5}" stroke="#fff" stroke-width=".9" opacity=".55"/>`; }).join('');
}
// 牌的底圖（Higgsfield 生成：空白正面、背面），牌面上的字和圖案用程式畫，保證正確
const mjArt = n => (window.MJ_ABASE||'assets/') + n + '.webp' + (typeof BUILD!=='undefined' ? '?v='+BUILD : '');
function mjTile(t, cls=''){
  const k = t==null ? 'back' : t;
  if(!mjCache[k]) mjCache[k] = t==null
    ? `<svg viewBox="0 0 44 58"><image href="${mjArt('mj_back')}" x="0" y="0" width="44" height="58" preserveAspectRatio="none"/></svg>`
    : `<svg viewBox="0 0 44 61"><image href="${mjArt('mj_front')}" x="0" y="0" width="44" height="61" preserveAspectRatio="none"/><g transform="translate(0 0.5)">${mjFace(t)}</g></svg>`;
  return `<i class="mt ${cls}" ${t!=null?`data-t="${t}"`:''}>${mjCache[k]}</i>`;
}
const mjMeldTiles = m => m.k==='chi' ? [m.t,m.t+1,m.t+2] : m.k==='pon' ? [m.t,m.t,m.t] : m.k==='ankan' ? [null,m.t,m.t,null] : [m.t,m.t,m.t,m.t];
const mjMeld = (m, cls='') => `<span class="mmeld">${mjMeldTiles(m).map((t,i)=>mjTile(t, cls + ((m.k==='chi'&&t===m.got) || (m.k!=='chi'&&m.k!=='ankan'&&i===1&&m.from!=null) ? ' got':''))).join('')}</span>`;

/* ---------- 音效 ---------- */
function mjSfx(n){ if(typeof SFX_ON!=='undefined' && !SFX_ON) return; try{
  if(n==='tile'){ noise(0.06, 3200, 0.22); tone(1600, 900, 0.05, 'triangle', 0.06); }
  else if(n==='call'){ tone(660, 990, 0.12, 'triangle', 0.16); tone(990, 0, 0.14, 'triangle', 0.12, 0.1); }
  else if(n==='win'){ [523,659,784,1047,1319].forEach((f,k)=>tone(f, 0, 0.25, 'triangle', 0.15, k*0.09)); }
  else if(n==='dice'){ for(let k=0;k<7;k++) noise(0.04, 2400+Math.random()*1200, 0.12, k*0.09); }
  else if(n==='lose'){ [523,440,349,262].forEach((f,k)=>tone(f, 0, 0.32, 'triangle', 0.14, k*0.22)); }
  else if(n==='pick'){ tone(1200, 0, 0.04, 'sine', 0.07); }
  else if(n==='myturn'){ tone(784, 0, 0.12, 'triangle', 0.16); tone(1175, 0, 0.18, 'triangle', 0.14, 0.11); }
  else if(n==='turn'){ tone(880, 0, 0.06, 'sine', 0.08); }
}catch(e){} }

/* 語音：用瀏覽器內建的中文語音念出來，不用音檔；沒有中文語音就只放音效 */
let mjVoice = null, mjVoiceOn = (()=>{ try{ return localStorage.getItem('ytzt_mjvoice')!=='0'; }catch(e){ return true; } })();
function mjPickVoice(){ try{ const vs = speechSynthesis.getVoices(); mjVoice = vs.find(v=>/zh[-_]TW/i.test(v.lang)) || vs.find(v=>/zh[-_](HK|Hant)/i.test(v.lang)) || vs.find(v=>/^zh/i.test(v.lang)) || null; }catch(e){} }
try{ mjPickVoice(); speechSynthesis.onvoiceschanged = mjPickVoice; }catch(e){}
/* 錄好的男女聲（Higgsfield 生成）：每個座位固定一種聲音；放不出來才改用瀏覽器語音 */
const MJ_VKEY = {'碰':'pon','吃':'chi','槓':'kan','聽':'ting'};   // 胡、自摸不念，改用畫面慶祝
let mjMyGender = (()=>{ try{ return localStorage.getItem('ytzt_mjvg')||'f'; }catch(e){ return 'f'; } })();
const mjVsrc = (g,k) => (window.MJ_VBASE||'assets/voice/') + g + '_' + k + '.mp3' + (typeof BUILD!=='undefined' ? '?v='+BUILD : '');
const mjVcache = {};
function mjSeatGender(j){ const rel = (j - mjMe + 4) % 4; return rel===0 ? mjMyGender : (rel===2 ? (mjMyGender==='f'?'m':'f') : (rel===1 ? 'm' : 'f')); }   // 自己用選單選的聲音，其他人男女混合
// 用 Web Audio 播（第一次點畫面後就解鎖，電腦出牌時也能播；HTML Audio 在 iPhone 常被擋）
const mjVbuf = {};
function mjLoadVoice(src){
  if(mjVbuf[src]) return mjVbuf[src];
  const a = typeof audio==='function' ? audio() : null; if(!a) return null;
  mjVbuf[src] = fetch(src).then(r=>r.arrayBuffer()).then(b=>new Promise((ok,no)=>a.decodeAudioData(b, ok, no))).catch(()=>{ delete mjVbuf[src]; return null; });
  return mjVbuf[src];
}
function mjPlayVoice(word, j){
  if(!mjVoiceOn || (typeof SFX_ON!=='undefined' && !SFX_ON)) return true;
  const k = MJ_VKEY[word]; if(!k) return true;
  const src = mjVsrc(mjSeatGender(j||0), k), p = mjLoadVoice(src); if(!p) return true;
  p.then(buf=>{ if(!buf) return; const a = audio(); if(!a) return; const n = a.createBufferSource(), g = a.createGain(); g.gain.value = 1; n.buffer = buf; n.connect(g).connect(a.destination); n.start(); });
  return true;   // 只播音檔，不改用手機內建語音
}
function mjPreloadVoice(){ ['f','m'].forEach(g=>Object.values(MJ_VKEY).forEach(k=>mjLoadVoice(mjVsrc(g,k)))); }
function mjSay(txt){
  if(!mjVoiceOn || (typeof SFX_ON!=='undefined' && !SFX_ON) || !window.speechSynthesis) return false;
  if(!mjVoice) mjPickVoice(); if(!mjVoice) return false;
  try{ speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.voice = mjVoice; u.lang = mjVoice.lang; u.rate = 1.15; u.pitch = 1.15; u.volume = 1; speechSynthesis.speak(u); return true; }catch(e){ return false; }
}

/* ---------- 遊戲廳大廳 ---------- */
const HALL_GAMES = [
  {id:'mj', icon:'🀄', name:'麻將', desc:'台灣 16 張，跟朋友或電腦一起打', open:true},
  {id:'big2', icon:'🃏', name:'大老二', desc:'敬請期待'},
  {id:'niu', icon:'🐮', name:'妞妞', desc:'敬請期待'},
  {id:'holdem', icon:'♠️', name:'德州撲克', desc:'敬請期待'},
];
function openHall(){
  modal('🎰 寵物娛樂廳', `<div class="rhint">用農場金幣跟大家同樂！每局贏家的獎金，娛樂廳會抽 ${Math.round(MJ.RAKE*100)}% 當場地費</div>
    <div class="hallg">${HALL_GAMES.map(g=>`<button class="hgc${g.open?'':' off'}" data-hg="${g.id}"><span class="hgi">${g.icon}</span><b>${g.name}</b><small>${g.desc}</small></button>`).join('')}</div>`);
  document.querySelectorAll('#md [data-hg]').forEach(b=>b.onclick=()=>{ if(b.dataset.hg==='mj') openMjLobby(); else toast('這個遊戲還在做，敬請期待！'); });
}
function openMjLobby(){
  const gold = S.me.gold;
  modal('🀄 麻將', `<div class="rhint">台灣 16 張麻將，輸贏用農場金幣。人不夠時由電腦補位；中途離開，這局由電腦代打、輸贏照算</div>
    <div id="mjBack"></div>
    ${Object.entries(MJ.TABLES).map(([k,t])=>{ const poor = gold<t.min; return `<div class="mjtb"><div class="mjtbi">${{n:'🌱',m:'🌻',h:'🏆'}[k]}</div><div class="tx"><b>${t.name}</b>
      <div>底 ${t.base.toLocaleString()}・每台 ${t.tai.toLocaleString()} 金</div><div>需要 ${t.min.toLocaleString()} 金幣才能坐下</div></div>
      <div class="mjtbb"><button class="mini" data-mjq="${k}" ${poor?'disabled':''}>${poor?'金幣不夠':'快速配對'}</button><button class="mini sub" data-mjc="${k}" ${poor?'disabled':''}>開房找朋友</button></div></div>`; }).join('')}
    <div class="mjjoin"><input id="mjCode" inputmode="numeric" maxlength="4" placeholder="輸入 4 位數房號"><button class="mini" id="mjJoin">加入朋友的房間</button></div>
    <button class="link" id="mjRules">📖 台數怎麼算？</button>`, [['回寵物娛樂廳','sub',openHall]]);
  const busy = b => { document.querySelectorAll('#md .mini').forEach(x=>x.disabled = b); };
  const go = async (a, extra) => { busy(true); try{ const r = await mjCall(a, extra); if(!r.view) throw new Error('進不去，等等再試'); closeModal(); mjOnlineEnter(r.view); }catch(e){ toast(e.message); busy(false); } };
  document.querySelectorAll('#md [data-mjq]').forEach(b=>b.onclick=()=>go('quick', {lvl:b.dataset.mjq}));
  document.querySelectorAll('#md [data-mjc]').forEach(b=>b.onclick=()=>go('create', {lvl:b.dataset.mjc}));
  $('mjJoin').onclick = ()=>{ const c = ($('mjCode').value||'').trim(); if(!/^\d{4}$/.test(c)) return toast('房號是 4 位數字'); go('join', {code:c}); };
  $('mjRules').onclick = mjRules;
  mjCall('state').then(r=>{ if(r.view && r.view.status && $('mjBack')) { $('mjBack').innerHTML = `<button class="btn o" id="mjBackB" style="width:100%;margin:6px 0">🀄 你還有一桌在打，回到牌桌</button>`; $('mjBackB').onclick = ()=>{ closeModal(); mjOnlineEnter(r.view); }; } }).catch(()=>{});
}
function mjRules(){
  const R = [['門清自摸',3],['門清（沒吃碰）',1],['自摸',1],['莊家',1],['連莊（每連一次）',2],['平胡',2],['全求人',2],['碰碰胡',4],['三暗刻',2],['四暗刻',5],['五暗刻',8],
    ['混一色',4],['清一色',8],['字一色',16],['中／發／白 刻子',1],['小三元',4],['大三元',8],['圈風／門風 刻子',1],['小四喜',8],['大四喜',16],['正花',1],['花槓（四張同組花）',2],
    ['獨聽（單吊、邊張、中洞）',1],['槓上開花',1],['搶槓',1],['海底撈月／河底撈魚',1],['天胡／地胡',16]];
  const body = `<div class="help"><p>胡牌要有 5 組（順子或刻子）加 1 對眼睛，共 17 張。</p><p><b>每家要付：底 + 台數 × 每台</b>。自摸三家都付，放槍只有放槍的人付；莊家相關的台數只算在莊家那一家。</p></div>
    <div class="mjrl">${R.map(([n,v])=>`<div><span>${n}</span><b>${v} 台</b></div>`).join('')}</div>`;
  if(mjOn()) return mjPanel('📖 台數表', body, [['知道了','',mjPanelClose]]);
  modal('📖 台數表', body, [['知道了','',openMjLobby]]);
}

/* ---------- 牌桌控制：練習場（本機跟電腦）／連線（伺服器） ---------- */
const MJ_BOTS = [{name:'小兔',av:3},{name:'阿熊',av:7},{name:'狐狸妹',av:15},{name:'企鵝哥',av:21},{name:'水獺',av:24},{name:'小鼠',av:9}];
const MJ_TURN_SEC = 15, MJ_CLAIM_SEC = 5;
let mjChiPick = null, mjTingMode = false, mjAnimKey = {};   // 動畫只在第一次出現時播，重畫畫面不要重播
let mjDiceHand = 0, mjDiceUntil = 0, mjMe = 0;
let MJG = null, MJO = null, mjSel = null, mjTimer = 0, mjDeadline = 0, mjDue = '', mjBotT = 0, mjMiss = 0, mjLastLog = 0, mjNextT = 0;
const mjOn = () => !!(MJG || MJO);
async function mjCall(a, extra){
  const { data, error } = await sb.functions.invoke('mahjong', { body: Object.assign({ a }, extra||{}) });
  if(error) throw new Error('連線不穩，請再試一次');
  if(data && data.error) throw new Error(data.error);
  return data || {};
}
/* 麻將背景音樂（Higgsfield 生成，20 秒無縫循環）：進牌桌換成這首，離開換回農場音樂 */
let MJ_BGM = null, mjBgmOn = (()=>{ try{ return localStorage.getItem('ytzt_mjbgm')!=='0'; }catch(e){ return true; } })();
function mjBgmSync(){
  const want = mjOn() && mjBgmOn && !document.hidden && (typeof BGM_ON==='undefined' || BGM_ON);
  if(want){ if(!MJ_BGM){ MJ_BGM = new Audio(mjArt('mj_bgm').replace('.webp','.mp3')); MJ_BGM.loop = true; MJ_BGM.volume = 0.4; } const p = MJ_BGM.play(); if(p && p.catch) p.catch(()=>{}); }
  else if(MJ_BGM) MJ_BGM.pause();
  if(typeof BGM!=='undefined' && BGM){ if(mjOn()) BGM.pause(); }
}
document.addEventListener('visibilitychange', mjBgmSync);
addEventListener('pointerdown', ()=>{ if(mjOn() && MJ_BGM && MJ_BGM.paused && mjBgmOn) mjBgmSync(); }, {passive:true});
function mjOpenReset(){ mjAnimKey = {}; }
function mjOpen(){ mjOpenReset(); $('mj').classList.add('on', 'tech'); document.body.classList.add('mjon'); mjFit(); mjPreloadVoice(); mjSel = null; mjLastLog = null; mjDiceHand = 0; mjBgmSync(); }
function mjClose(){
  clearTimeout(mjBotT); clearTimeout(mjNextT); clearInterval(mjTimer); mjTimer=0;
  if(MJO){ clearTimeout(MJO.tick); clearInterval(MJO.poll); try{ MJO.ch && sb.removeChannel(MJO.ch); }catch(e){} }
  MJG = null; MJO = null; $('mj').classList.remove('on'); document.body.classList.remove('mjon');
  mjBgmSync(); try{ if(typeof bgmSync==='function') bgmSync(); }catch(e){}
}

// 練習場
function mjEnter(table){
  const bots = MJ_BOTS.slice().sort(()=>Math.random()-0.5).slice(0,3);
  const me = {id:'me', name:S.me.nickname, av:S.me.avatar||11, gold:50000};
  MJG = MJ.newGame([me, ...bots.map((b,i)=>({id:'b'+i, name:b.name, av:b.av, bot:true, gold:50000}))], {table, dealer:Math.floor(Math.random()*4)});
  MJG.practice = true; mjMiss = 0; mjOpen(); mjTick(true);
}
function mjLocalView(){ return Object.assign(MJ.view(MJG, 0), { dice: MJG.dice, status:'play', practice:true }); }
function mjTick(first){
  if(!MJG) return;
  mjRender(first);
  clearTimeout(mjBotT);
  if(MJG.phase==='end'){ mjDue=''; return; }
  const w = MJ.waitingOn(MJG), bots = w.filter(j=>MJG.seats[j].bot || MJG.seats[j].auto || MJG.seats[j].ting);
  const wait0 = Math.max(0, mjDiceUntil - Date.now());
  const due = w.includes(0) ? MJG.phase+':'+MJG.handNo+':'+MJG.log.length : '';
  if(due && due!==mjDue){ mjDeadline = Date.now() + wait0 + (MJG.phase==='play'?MJ_TURN_SEC:MJ_CLAIM_SEC)*1000; }
  mjDue = due;
  if(bots.length){ const j = bots[0], fast = MJG.phase==='claim';
    mjBotT = setTimeout(()=>{ if(!MJG) return; try{ MJ.autoAct(MJG, j, true); }catch(e){ console.warn(e); } mjTick(); }, wait0 + (fast ? 380 : 650 + Math.random()*450)); }
  if(!mjTimer) mjTimer = setInterval(mjClock, 250);
}

// 連線
async function mjOnlineEnter(view){
  mjClose();
  MJO = { V: null, seq: -1, off: 0, tick: 0, poll: 0, ch: null, busy: false };
  mjOpen(); mjApply(view, 0, true);
  try{ const { data:{ user } } = await sb.auth.getUser();
    if(user && MJO){ MJO.ch = sb.channel('mjv-' + user.id).on('postgres_changes', { event:'*', schema:'public', table:'mj_views', filter:'uid=eq.' + user.id },
      p => { const r = p.new; if(MJO && r && r.seq >= MJO.seq) mjApply(r.view, r.seq); }).subscribe(); } }catch(e){}
  MJO.poll = setInterval(()=>{ if(MJO && !MJO.busy && Date.now() - (MJO.at||0) > 5000) mjCall('state').then(r=>MJO && mjApply(r.view, null)).catch(()=>{}); }, 3000);
  if(!mjTimer) mjTimer = setInterval(mjClock, 250);
}
function mjApply(view, seq, first, own){
  if(!MJO) return;
  if(view && seq==null && view.ver!=null) seq = view.ver;
  // 自己的動作還在送：先把別人的更新存起來，等回覆再一起套用（避免畫面跳回去）
  if(MJO.busy && !own){ if(view && seq!=null && (!MJO.queued || seq > MJO.queued.seq)) MJO.queued = { view, seq }; return; }
  if(own && MJO.queued){ const q = MJO.queued; MJO.queued = null; if(q.seq > (seq ?? -1)){ view = q.view; seq = q.seq; } }
  if(!view){ mjClose(); toast('已經離開牌桌'); sync && sync(); return; }
  if(view.status==='kicked' && view.broke) return mjBroke();
  if(view.status==='kicked' || view.status==='closed'){ mjClose(); toast(view.msg || '牌桌已經關了'); sync && sync(); return; }
  if(seq!=null && seq < MJO.seq) return;
  if(seq!=null) MJO.seq = seq;
  MJO.V = view; MJO.at = Date.now(); MJO.off = Date.now() - (view.now || Date.now());
  if(view.me!=null && view.seats){ const g = view.seats[view.me].gold; if(S && S.me && typeof g==='number') S.me.gold = g; }
  mjRender(first);
  // 下一個事件（電腦出牌、超時、開局…）到的時候請伺服器推進；指定一個人負責，其他人晚一點當備援
  clearTimeout(MJO.tick);
  if(view.due){ const wait = view.due + MJO.off - Date.now() + (view.ticker || view.status==='wait' || view.pending ? 60 : 1500);
    MJO.tick = setTimeout(()=>{ if(!MJO) return; mjCall('tick').then(r=>MJO && mjApply(r.view, null)).catch(()=>{}); }, Math.max(60, wait)); }
}
async function mjOnline(a, extra){
  if(!MJO || MJO.busy) return;
  MJO.busy = true;
  try{ const r = await mjCall(a, extra); if(MJO){ MJO.busy = false; mjApply(r.view, null, false, true); } }
  catch(e){ mjToast(e.message); if(MJO){ MJO.busy = false; MJO.seq = -1; const q = MJO.queued; MJO.queued = null; if(q) mjApply(q.view, q.seq); mjCall('state').then(r=>MJO && mjApply(r.view, null)).catch(()=>{}); } }
  finally{ if(MJO) MJO.busy = false; }
}
function mjCurView(){ return MJG ? mjLocalView() : MJO && MJO.V; }

function mjLeave(force){
  const V = mjCurView();
  if(!force && V && V.phase && V.phase!=='end' && V.status==='play' && V.me!=null) return mjConfirmLeave();
  if(MJO){ const o = MJO; o.busy = true; mjCall('leave').then(r=>{ if(typeof r.gold==='number' && S && S.me) S.me.gold = r.gold; try{ refresh(); }catch(e){} }).catch(()=>{}); mjClose(); return; }
  mjClose();
}
function mjConfirmLeave(){
  mjPanel('要離開牌桌嗎？', `<div class="help"><p>這一局還沒打完，現在離開會由電腦幫你打完這一局，${MJG?'練習場不算輸贏。':'輸贏照算。'}</p></div>`,
    [['繼續打','sub',mjPanelClose],['離開','r',()=>{ mjPanelClose(); mjLeave(true); }]]);
}
function mjDo(a){
  const V = mjCurView(); if(!V || V.phase==='end') return;
  if(a.a!=='ting' && a.a!=='pass') mjSel = null;
  if(MJO){
    // 自己的動作先顯示在畫面上，伺服器確認是在背景做
    if(MJO.busy) return;
    const me = V.seats[V.me];
    if(a.a==='discard'){ const i = me.hand.lastIndexOf(a.t);
      if(i>=0){ me.hand.splice(i,1); me.n = me.hand.length; me.river.push(a.t); if(a.ting) me.ting = true; V.last = { t:a.t, from:V.me }; V.drawn = null; V.waiting = []; V.opts = {}; V.turn = -1;
        mjSfx('tile'); MJO.skipSig = 'discard:' + V.me + ':' + a.t; mjRender(); } }
    else if(['chi','pon','kan','hu'].includes(a.a)){
      // 馬上喊出來、按鈕收掉；伺服器確認在背景做（之後同一個事件不再重播）
      V.waiting = (V.waiting||[]).filter(j=>j!==V.me); V.opts = {};
      mjShout(V.me, {chi:'吃！',pon:'碰！',kan:'槓！',hu:'胡了！'}[a.a]); MJO.skipShout = a.a + ':' + V.me;
      const ui = $('mjUi'); if(ui){ const ac = ui.querySelector('.mjacts'); if(ac) ac.innerHTML = ''; const ch = $('mjChi'); if(ch) ch.innerHTML = ''; }
    }
    else if(a.a==='ting'){ me.ting = true; V.opts = Object.assign({}, V.opts, { canTing:false }); mjRender(); }
    else if(a.a==='pass'){ V.waiting = (V.waiting||[]).filter(j=>j!==V.me); V.opts = {}; mjRender(); }
    return mjOnline('act', { act: a });
  }
  try{ MJ.act(MJG, 0, a); mjMiss = 0; mjTick(); }catch(e){ mjToast(e.message); }
}
function mjClock(){
  if(!mjOn()){ clearInterval(mjTimer); mjTimer=0; return; }
  const V = mjCurView(), el = $('mjSec');
  if(V && V.status==='wait' && $('mjWs') && MJO){ const sec = Math.max(0, Math.ceil((V.wait.startAt + MJO.off - Date.now())/1000)); $('mjWs').textContent = V.priv ? '人到齊或房主按開始就開打' : sec > 0 ? `${sec} 秒後開始，人不夠由電腦補位` : '準備開始…'; return; }
  if(!V || !V.waiting) { if(el) el.textContent=''; return; }
  if(!V.waiting.includes(V.me) || V.phase==='end'){ if(el) el.textContent=''; return; }
  const dl = MJG ? mjDeadline : (V.deadline ? V.deadline + MJO.off : 0);
  if(!dl){ if(el) el.textContent=''; return; }
  const left = Math.max(0, Math.ceil((dl-Date.now())/1000));
  if(el){ el.textContent = left; el.classList.toggle('hurry', left<=5); }
  if(MJG && left<=0){ if(MJG.phase==='play') mjMiss++; try{ MJ.autoAct(MJG, 0, false); }catch(e){} if(mjMiss>=2){ MJG.seats[0].auto = true; mjToast('超時太多次，先幫你託管'); } mjSel=null; mjTick(); }
}

/* ---------- 畫面（橫向牌桌；手機直拿時整桌轉 90 度） ---------- */
const mjSeatPos = j => ['b','r','t','l'][(j - mjMe + 8) % 4];   // 我永遠在下方；1=下家(右) 2=對家 3=上家(左)
let mjW = 844, mjH = 390;
function mjFit(){
  const el = $('mj'); if(!el) return;
  const W = innerWidth, H = innerHeight, rot = H > W;
  mjW = rot ? H : W; mjH = rot ? W : H;
  el.classList.toggle('rot', rot);
  el.style.width = mjW + 'px'; el.style.height = mjH + 'px';
  el.style.transform = rot ? `translateX(${W}px) rotate(90deg)` : '';
}
function mjToast(msg){ const t = $('mjToast'); if(!t) return toast(msg); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(()=>t.classList.remove('show'), 1800); }
function mjPanel(title, body, btns){
  const p = $('mjPanel'); if(!p) return;
  p.innerHTML = `<div class="mjpc"><div class="mjph"><b>${title}</b><button class="x" id="mjPx">×</button></div><div class="mjpb">${body}</div><div class="mjpf"></div></div>`;
  (btns||[]).forEach(([t,cls,fn])=>{ const b=document.createElement('button'); b.className='btn '+(cls||''); b.textContent=t; b.onclick=fn; p.querySelector('.mjpf').appendChild(b); });
  $('mjPx').onclick = mjPanelClose; p.classList.add('on');
}
function mjPanelClose(){ const p=$('mjPanel'); if(p) p.classList.remove('on'); }
function mjMenu(){
  mjPanel('選單', `<div class="mjmn">
    <button class="mjmi" id="mmRules">📖<span>台數表</span></button>
    <button class="mjmi" id="mmBgm">${mjBgmOn?'🎵':'🔕'}<span>音樂${mjBgmOn?'：開':'：關'}</span></button>
    <button class="mjmi" id="mmVg">${mjMyGender==='f'?'👧':'👦'}<span>我的聲音：${mjMyGender==='f'?'女生':'男生'}</span></button>
    <button class="mjmi" id="mmVo">${mjVoiceOn?'🔊':'🔇'}<span>語音${mjVoiceOn?'：開':'：關'}</span></button>
    <button class="mjmi r" id="mmExit">🚪<span>離開牌桌</span></button></div>`, []);
  $('mmRules').onclick = mjRules;
  $('mmVo').onclick = ()=>{ mjVoiceOn=!mjVoiceOn; try{ localStorage.setItem('ytzt_mjvoice', mjVoiceOn?'1':'0'); }catch(e){} if(mjVoiceOn) mjPlayVoice('碰', 0); mjMenu(); };
  $('mmVg').onclick = ()=>{ mjMyGender = mjMyGender==='f'?'m':'f'; try{ localStorage.setItem('ytzt_mjvg', mjMyGender); }catch(e){} mjPlayVoice('碰', mjMe); mjMenu(); };
  $('mmBgm').onclick = ()=>{ mjBgmOn = !mjBgmOn; try{ localStorage.setItem('ytzt_mjbgm', mjBgmOn?'1':'0'); }catch(e){} mjBgmSync(); mjMenu(); };
  $('mmExit').onclick = ()=>{ mjPanelClose(); mjLeave(); };
}

function mjRender(first){
  if(first || !$('mjFelt')) mjShell();
  const V = mjCurView(); if(!V) return;
  if(V.status==='wait' || V.pending || V.me==null || V.me<0) return mjRenderWait(V);
  mjMe = V.me;
  // 每局開始：莊家先擲骰子
  if(V.dice && V.handNo !== mjDiceHand && V.phase!=='end' && (MJG || V.startAt)){ mjDiceHand = V.handNo; mjDiceUntil = Date.now() + 2200; setTimeout(()=>mjDice(V.dice, V.dealer), 30); }
  const ME = V.me, T = MJ.TABLES[V.table], me = V.seats[ME], wl = V.waiting;
  const posOf = {b:ME,r:(ME+1)%4,t:(ME+2)%4,l:(ME+3)%4};
  const seatCard = j => { const s = V.seats[j], on = wl.includes(j) && V.phase!=='end';
    return `<div class="mjs mjs-${mjSeatPos(j)}${on?' on':''}"><div class="mjav"><img src="${avSrc(s.av)}" alt="">${j===V.dealer?`<span class="mjdl">莊${V.lian?`<small>${V.lian}</small>`:''}</span>`:''}<span class="mjwd">${MJ.WIND[s.wind]}</span>${s.ting?'<span class="mjtg">聽</span>':''}</div>
      <div class="mjtx"><div class="mjnm">${esc(s.name)}</div><div class="mjgd">${s.gold.toLocaleString()}</div></div></div>`; };
  // 對手：頭像、沒打的牌、吃碰的牌放在同一個區塊裡排好，不會疊到桌上的牌
  const others = j => { const s = V.seats[j], p = mjSeatPos(j);
    const ml = s.melds.map(m=>mjMeld(m,'xs')).join('') + (s.flowers.length?`<span class="mjfl">${s.flowers.map(t=>mjTile(t,'xs')).join('')}</span>`:'');
    if(p==='t') return `<div class="mjtz">${seatCard(j)}<div class="mjhid">${Array.from({length:s.n},()=>mjTile(null,'xs')).join('')}</div>${ml?`<div class="mjx">${ml}</div>`:''}</div>`;
    return `<div class="mjsz mjsz-${p}">${seatCard(j)}<div class="mjx">${ml}</div></div><div class="mjhid mjhid-${p}">${Array.from({length:s.n},()=>'<i class="mjbar"></i>').join('')}</div>`; };
  const dropKey = V.last ? `${V.handNo}:${V.last.from}:${V.last.t}:${(V.seats[V.last.from]||{river:[]}).river.length}` : '';
  const dropAnim = dropKey && dropKey !== mjAnimKey.drop; mjAnimKey.drop = dropKey;
  const river = j => { const s = V.seats[j], lastJ = V.last && V.last.from===j && V.phase!=='end';
    return `<div class="mjr mjr-${mjSeatPos(j)}">${s.river.map((t,i)=>mjTile(t, 'rv' + (lastJ && i===s.river.length-1 ? ' last' + (dropAnim ? ' anim' : '') : ''))).join('')}</div>`; };
  const compass = `<div class="mjc">${['b','r','t','l'].map(p=>{ const j=posOf[p], on=wl.includes(j) && V.phase==='play'; return `<span class="mjcw mjcw-${p}${on?' on':''}${j===V.dealer?' dl':''}">${MJ.WIND[V.seats[j].wind]}</span>`; }).join('')}
    <div class="mjcc"><small class="mjrd">${MJ.WIND[V.wind]}風${MJ.WIND[(V.dealer - V.firstDealer + 4) % 4]}局</small><b id="mjSec"></b><small>剩 ${V.left} 張</small></div></div>`;

  // 我的手牌（一排）：吃碰的牌在左邊，剛摸到的牌放最右邊
  let hand = me.hand.slice(), drawn = null;
  if(V.drawn!=null && V.turn===ME && V.phase==='play'){ const i = hand.lastIndexOf(V.drawn); if(i>=0){ hand.splice(i,1); drawn = V.drawn; } }
  const canDis = V.phase==='play' && V.turn===ME && V.opts.discard && !me.auto && !me.ting;
  // 聽牌指示：打哪張會聽、聽什麼、還剩幾張
  const seen = {}; const see = t => seen[t] = (seen[t]||0) + 1;
  me.hand.forEach(see); V.seats.forEach(x=>{ x.river.forEach(see); x.melds.forEach(m=>mjMeldTiles(m).forEach(t=>t!=null && see(t))); });
  const leftOf = t => Math.max(0, 4 - (seen[t]||0));
  const tt = canDis && !me.ting ? MJ.tingTiles({ hand: me.hand }) : null;
  if(!tt) mjTingMode = false;
  const myWaits = me.ting || (!canDis && me.hand.length % 3 === 1) ? MJ.waits(me.hand.length % 3 === 2 && drawn!=null ? (()=>{ const h=me.hand.slice(); h.splice(h.lastIndexOf(drawn),1); return h; })() : me.hand) : [];
  const waitTxt = w => w.map(t=>`${MJ.name(t)}<small>剩${leftOf(t)}</small>`).join('、');
  const meldN = me.melds.reduce((a,m)=>a+(m.k==='chi'||m.k==='pon'?3:4),0);
  const units = hand.length + (drawn!=null?1.3:0) + meldN*0.62 + me.melds.length*0.2;
  const tw = Math.max(24, Math.min(58, Math.floor(mjH*0.19*44/60), Math.floor((mjW - 30) / Math.max(units, 17.6))));   // 固定用 17 張＋間隔來算，摸牌打牌時牌的大小和桌面位置才不會跳
  // 中間（方位盤＋四家打出的牌）夾在對家那排和我的手牌之間，依螢幕高度自動算大小
  const Fh = mjH - 36, handTop = Fh - tw*60/44 - 6, TOPH = 50, avail = handTop - TOPH;
  const rv = Math.max(13, Math.min(25, Math.floor(((avail - 8 - 104) / 4 - 1) * 44 / 61)));
  const rowH = rv*61/44 + 1, cScale = Math.min(1, Math.max(0.65, (avail - 4*rowH - 8) / 104));
  const cy = TOPH + 2*rowH + 4 + 52*cScale;
  // 有人打牌、我可以吃／碰時：把手上能配的牌標出來
  const oo = V.phase==='claim' && wl.includes(0) ? (V.opts||{}) : {}, lt = V.last && V.last.t;
  const chiSet = new Set((oo.chi||[]).flat()), ponOn = oo.pon || oo.kan;
  const marked = {};   // 每種牌只標一張（碰標兩張）
  const mark = t => { if(ponOn && t===lt && (marked[t]||0) < 2){ marked[t]=(marked[t]||0)+1; return ' hp'; } if(chiSet.has(t) && !marked[t]){ marked[t]=1; return ' hc'; } return ''; };
  const tMarked = {};
  const tingCls = t => { if(!tt || !tt[t] || tMarked[t]) return ''; tMarked[t] = 1; return ' ht'; };
  const newKey = drawn!=null ? `${V.handNo}:${me.river.length}:${me.melds.length}:${drawn}` : '';
  const newAnim = newKey && newKey !== mjAnimKey.draw; mjAnimKey.draw = newKey;
  const claimMine = V.phase==='claim' && wl.includes(ME) && !me.ting;
  if(!claimMine) mjChiPick = null;   // 可以吃碰胡：不要的話直接點手牌就當作不要
  const one = (t,k,extra='')=>mjTile(t, 'hd' + extra + (mjSel===k?' sel':'') + (canDis||claimMine?'':' idle') + mark(t) + tingCls(t)).replace('<i ', `<i data-k="${k}" `);
  const handHtml = (me.melds.length?`<div class="mjmy">${me.melds.map(m=>mjMeld(m,'mm')).join('')}</div>`:'')
    + hand.map((t,i)=>one(t,'h'+i)).join('') + (drawn!=null ? `<span class="mjgap"></span>` + one(drawn,'d', newAnim ? ' new' : '') : '');

  const o = V.opts || {}, acts = [];
  if(o.canTing && !me.auto) acts.push(['ting','聽','t']);   // 打出去之後聽牌了：按「聽」就報聽，不按就不聽
  if(V.phase==='claim' && wl.includes(0)){
    if(o.hu) acts.push(['hu','胡','w']); if(o.kan) acts.push(['kan','槓','k']); if(o.pon) acts.push(['pon','碰','p']); if(o.chi) acts.push(['chi', o.chi.length>1 ? `吃<small>${o.chi.length}種</small>` : '吃','c']);   // 沒有「過」：不點就是不要
  } else if(V.phase==='play' && V.turn===ME && !me.auto){
    if(o.zimo) acts.push(['zimo','自摸','w']); if(o.ankan) acts.push(['ankan','暗槓','k']); if(o.kakan) acts.push(['kakan','加槓','k']);   // 不想胡就直接打牌

  }
  const claimTile = V.phase==='claim' && V.last && wl.includes(0) ? `<div class="mjct">${esc(V.seats[V.last.from].name)} 打出 ${mjTile(V.last.t,'md')}</div>` : '';
  const selT = mjSel==null ? null : (mjSel==='d' ? drawn : hand[+String(mjSel).slice(1)]);
  const hint = me.auto ? `<button class="mjauto" id="mjAuto">🤖 託管中・點這裡自己打</button>`
    : me.ting ? `<div class="mjhint ting">🀄 已報聽・聽：${waitTxt(myWaits) || '—'}</div>`
    : canDis && tt && selT!=null && tt[selT] ? `<div class="mjhint ting">聽：${waitTxt(tt[selT])}</div>`
    : o.canTing ? `<div class="mjhint ting">聽：${waitTxt(myWaits)}　按「聽」報聽多 1 台</div>`
    : claimMine ? `<div class="mjhint">要的話點按鈕或亮起來的牌，不要就點其他手牌</div>`
    : !canDis && myWaits.length ? `<div class="mjhint ting">聽：${waitTxt(myWaits)}</div>`
    : canDis && !acts.length ? `<div class="mjhint">輪到你了！點一張牌選起來，再點一次打出</div>` : '';
  const myOn = wl.includes(0) && V.phase!=='end';

  $('mjFelt').innerHTML = [1,2,3].map(others).join('') + `<div class="mjmid" style="top:${cy.toFixed(0)}px;--rv:${rv}px;--cs:${cScale.toFixed(2)}">${compass}${[0,1,2,3].map(river).join('')}</div>`;
  // 輪到自己：跳出「輪到你了！」＋提示音＋震動（每次輪到只提醒一次）
  const turnKey = canDis ? V.handNo + ':' + (V.logN != null ? V.logN : (V.log||[]).length) : '';
  if(turnKey && turnKey !== mjAnimKey.turn){ const d = Math.max(0, mjDiceUntil - Date.now()); setTimeout(()=>{ const VV = mjCurView(); if(VV && VV.phase==='play' && VV.turn===VV.me) mjTurnAlert(); }, d + 50); }
  mjAnimKey.turn = turnKey;
  const actKey = acts.map(a=>a[0]).join(',') + '|' + V.handNo + ':' + V.phase + ':' + (V.last ? V.last.t + ':' + V.last.from : '') + ':' + me.river.length;
  const actStill = actKey === mjAnimKey.acts; mjAnimKey.acts = actKey;
  const hintKey = hint.replace(/<[^>]+>/g,''); const hintStill = hintKey === mjAnimKey.hint; mjAnimKey.hint = hintKey;
  $('mjUi').innerHTML = `<div class="mjacts${actStill?' still':''}">${claimTile}${acts.map(([k,t,c])=>`<button class="mja mja-${c}" data-ma="${k}">${t}</button>`).join('')}</div><div class="mjchi" id="mjChi"></div>${hintStill ? hint.replace('class="mjhint', 'class="mjhint still').replace('class="mjauto', 'class="mjauto still') : hint}
    <div class="mjhand${canDis?' can':''}" style="--tw:${tw}px;--mw:${Math.round(tw*0.62)}px">${handHtml}</div>`;
  $('mjBar').innerHTML = `<div class="mjbt">底台：${T.base.toLocaleString()} / ${T.tai.toLocaleString()}</div>
    <div class="mjbme${myOn?' on':''}"><img src="${avSrc(me.av)}" alt=""><span class="mjbw">${MJ.WIND[me.wind]}</span>${me.ting?'<span class="mjbd" style="background:#F08A1C">聽</span>':''}${V.dealer===ME?`<span class="mjbd">莊${V.lian?V.lian:''}</span>`:''}<b>${esc(me.name)}</b><span class="mjbg">${me.gold.toLocaleString()}</span></div>
    <div class="mjbf">${me.flowers.map(t=>mjTile(t,'xs')).join('')}</div><div class="mjbt r">${T.name}・第 ${V.handNo} 局</div>`;
  // 結算視窗：第一次出現時等慶祝動畫播完才淡入；之後畫面更新不要重播
  const endKey = V.phase==='end' ? V.handNo + ':' + (V.result && V.result.draw ? 'd' : 'w') : '';
  const endHtml = V.phase==='end' ? mjResultHtml(V) : '';
  $('mjEnd').innerHTML = endKey && endKey === mjAnimKey.end ? endHtml.replace('class="mjres"', 'class="mjres still"') : (V.result && V.result.draw ? endHtml.replace('class="mjres"', 'class="mjres fast"') : endHtml);
  mjAnimKey.end = endKey;

  if($('mjAuto')) $('mjAuto').onclick = ()=>{ if(MJO) return mjOnline('auto', {on:false}); MJG.seats[0].auto=false; mjMiss=0; mjTick(); };
  document.querySelectorAll('#mj .mjhand .mt.hd').forEach(el=>el.onclick=()=>{
    if(claimMine){
      const tt0 = +el.dataset.t;
      // 點有標「碰」「吃」的牌：直接碰／吃
      if(el.classList.contains('hp') && o.pon) return mjDo({a:'pon'});
      if(el.classList.contains('hc') && o.chi){
        // 吃法不只一種：點的牌只出現在一種吃法 → 直接吃；不然先選起來，再點第二張決定吃法
        const cand = o.chi.filter(c=>c.includes(tt0));
        if(mjChiPick!=null && mjChiPick!==tt0){ const u = o.chi.find(c=>c.includes(mjChiPick) && c.includes(tt0)); if(u){ mjChiPick = null; return mjDo({a:'chi', use:u}); } }
        if(cand.length===1){ mjChiPick = null; return mjDo({a:'chi', use:cand[0]}); }
        if(cand.length>1){ mjChiPick = tt0; mjSfx('pick'); document.querySelectorAll('#mj .mjhand .mt.hd').forEach(x=>x.classList.toggle('sel', x===el));
          const hEl = document.querySelector('#mjUi .mjhint'); if(hEl){ hEl.className='mjhint still'; hEl.textContent = `再點一張要跟${MJ.name(tt0)}配的牌`; } return; }
      }
      mjSel = el.dataset.k; mjSfx('pick'); return mjDo({a:'pass'});   // 點其他牌：當作不要，並先把這張牌選起來
    }
    if(!canDis) return;
    const k = el.dataset.k, t = +el.dataset.t;
    if(mjSel===k){ if(!MJO) mjSfx('tile'); return mjDo({a:'discard', t}); }
    mjSel = k; mjSfx('pick');
    document.querySelectorAll('#mj .mjhand .mt.hd').forEach(x=>x.classList.toggle('sel', x.dataset.k===k));
    const hEl = document.querySelector('#mjUi .mjhint');
    if(tt && tt[t]){ const html = `聽：${waitTxt(tt[t])}`; if(hEl){ hEl.className = 'mjhint ting still'; hEl.innerHTML = html; } else $('mjUi').insertAdjacentHTML('afterbegin', `<div class="mjhint ting still">${html}</div>`); }
    else if(hEl && hEl.classList.contains('ting') && !me.ting) hEl.remove();
  });
  document.querySelectorAll('#mj [data-ma]').forEach(b=>b.onclick=()=>{
    const k = b.dataset.ma;
    if(k==='ting') return mjDo({a:'ting'});
    if(k==='hu') return mjDo({a:'hu'});
    if(k==='zimo') return mjDo({a:'zimo'});
    if(k==='pon'||k==='kan') return mjDo({a:k});
    if(k==='ankan'||k==='kakan'){ const L=o[k]; if(L.length===1) return mjDo({a:k, t:L[0]}); return mjPick(L.map(t=>({h:[t,t,t,t].map(x=>mjTile(x,'sm')).join(''), a:{a:k,t}}))); }
    if(k==='chi'){ const L=o.chi; if(L.length===1) return mjDo({a:'chi', use:L[0]});
      // 好幾種吃法：不跳選單，改成點亮起來的牌來選
      const hEl = document.querySelector('#mjUi .mjhint'), msg = '點亮起來的牌選吃法（點兩張決定怎麼吃）';
      if(hEl){ hEl.className='mjhint still'; hEl.textContent = msg; } else $('mjUi').insertAdjacentHTML('afterbegin', `<div class="mjhint">${msg}</div>`);
      document.querySelectorAll('#mj .mjhand .mt.hc').forEach(x=>{ x.classList.remove('blink'); void x.offsetWidth; x.classList.add('blink'); });
      return;
      return mjPick(L.map(u=>({h:sortChi(u, V.last.t).map(t=>mjTile(t,'sm'+(t===V.last.t?' got':''))).join(''), a:{a:'chi', use:u}}))); }
  });
  if(V.phase==='end') mjBindResult(V);
  // 把這次更新新增的事件都播出來（槓之後會馬上補牌，只看最後一筆會漏掉「槓」）
  const L = V.log || [], N = V.logN != null ? V.logN : L.length;
  if(!mjLastLog || mjLastLog.h !== V.handNo || N < mjLastLog.n) mjLastLog = { h: V.handNo, n: Math.max(0, N - 1) };
  const fresh = L.slice(Math.max(0, L.length - (N - mjLastLog.n)));
  mjLastLog.n = N;
  let shouted = false;
  for(const e of fresh){
    if(['pon','chi','kan','ankan','kakan','hu','zimo','ting'].includes(e.k)){ if(MJO && MJO.skipShout === e.k + ':' + e.s){ MJO.skipShout = null; shouted = true; continue; } mjShout(e.s, {pon:'碰！',chi:'吃！',kan:'槓！',ankan:'暗槓！',kakan:'加槓！',hu:'胡了！',zimo:'自摸！',ting:'聽！'}[e.k]); shouted = true; }
    else if(e.k==='discard'){ const k = 'discard:' + e.s + ':' + e.t; if(MJO && MJO.skipSig === k) MJO.skipSig = null; else mjSfx('tile'); }
    else if(e.k==='flower' && !shouted) mjShout(e.s, '補花', true);
  }
}
function mjRenderWait(V){
  const T = MJ.TABLES[V.lvl] || MJ.TABLES.n;
  let inner;
  const shoutN = (S && S.me && S.me.items && S.me.items.shout) || 0;
  if(V.status==='wait'){
    const P = (V.wait && V.wait.players) || [];
    inner = `<div class="mjwt">${V.priv ? '🏠 朋友房間' : '🔍 正在找牌友…'}</div>
      ${V.priv ? `<div class="mjcode">房號 <b>${esc(V.code||'')}</b><small>把房號告訴朋友，在「麻將」輸入就能加入</small></div>` : ''}
      <div class="mjwp">${[0,1,2,3].map(i=>{ const p=P[i]; return p ? `<div class="mjwq"><img src="${avSrc(p.av)}" alt=""><span>${esc(p.name)}</span></div>` : `<div class="mjwq e"><i>？</i><span>${V.priv?'等朋友加入':'等待中'}</span></div>`; }).join('')}</div>
      <div class="mjws" id="mjWs"></div>
      ${V.priv && P.length < 4 ? `<button class="btn o mjshb" id="mjShout" ${shoutN>0?'':'disabled'}>📢 用大聲公找人${shoutN>0?`（剩 ${shoutN} 個）`:'（沒有大聲公，可到綜合商店買）'}</button>` : ''}
      <div class="mjwb">${V.priv && V.host ? `<button class="btn" id="mjStart">立即開始（空位由電腦補）</button>` : ''}<button class="btn sub" id="mjWl">離開</button></div>`;
  } else {
    inner = `<div class="mjwt">⏳ 牌桌正在打</div><div class="mjws">這一局結束後你就會入座，請稍等…</div><div class="mjwb"><button class="btn sub" id="mjWl">離開</button></div>`;
  }
  $('mjFelt').innerHTML = `<div class="mjwait">${inner}</div>`;
  $('mjUi').innerHTML = ''; $('mjEnd').innerHTML = '';
  $('mjBar').innerHTML = `<div class="mjbt">底台：${T.base.toLocaleString()} / ${T.tai.toLocaleString()}</div><div class="mjbt r">${T.name}</div>`;
  if($('mjStart')) $('mjStart').onclick = ()=>mjOnline('start');
  if($('mjShout')) $('mjShout').onclick = ()=>{
    const miss = 4 - ((V.wait && V.wait.players) || []).length;
    const def = `麻將缺${miss}!!! 房號:${V.code}`;
    mjPanel('📢 大聲公找人', `<div class="help"><p>會放上全服跑馬燈，大家都看得到。可以改字（最多 30 字）</p></div>
      <input id="mjShTx" maxlength="30" value="${esc(def)}" style="width:100%;font-family:inherit;font-size:17px;font-weight:900;padding:10px 12px;border-radius:12px;border:2px solid #E6D9C3;margin-top:6px">`,
      [['取消','sub',mjPanelClose],['📢 送出','o',async()=>{ const t = ($('mjShTx').value||'').trim(); if(!t) return mjToast('請輸入內容');
        try{ const r = await rpc('farm_item_use', { p_id:'shout', p_arg:t }); applyState(r.state); try{ refresh(); }catch(e){} mjPanelClose(); mjToast('大聲公已送出！'); mjRender(); }catch(e){ mjToast(e.message); } }]]);
  };
  $('mjWl').onclick = ()=>mjLeave(true);
}
function mjShell(){
  $('mj').style.setProperty('--mjtable', `url("${mjArt('mj_table')}")`); $('mj').style.setProperty('--mjconsole', `url("${mjArt('mj_console')}")`);
  $('mj').innerHTML = `<div class="mjfelt" id="mjFelt"></div><button class="mjmenu" id="mjMenuB">☰</button>
    <div class="mjcall" id="mjCall"></div><div class="mjui" id="mjUi"></div><div class="mjbar2" id="mjBar"></div>
    <div id="mjEnd"></div><div class="mjpanel" id="mjPanel"></div><div class="mjtoast" id="mjToast"></div>`;
  $('mjMenuB').onclick = mjMenu;
}
const MJ_PIP = {1:[[50,50]],2:[[28,28],[72,72]],3:[[25,25],[50,50],[75,75]],4:[[28,28],[72,28],[28,72],[72,72]],5:[[27,27],[73,27],[50,50],[27,73],[73,73]],6:[[28,24],[72,24],[28,50],[72,50],[28,76],[72,76]]};
const mjDie = n => `<svg viewBox="0 0 100 100"><rect x="4" y="4" width="92" height="92" rx="22" fill="#FFFDF4" stroke="#D9CBAA" stroke-width="3"/>${MJ_PIP[n].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="${n===1?15:10}" fill="${n===1||n===4?'#D3403A':'#22304A'}"/>`).join('')}</svg>`;
function mjDice(d, dealer){
  const box = $('mjCall'); if(!box || !d) return;
  const el = document.createElement('div'); el.className = 'mjdice';
  el.innerHTML = `<div class="mjdr">${d.map((n,i)=>`<i class="mjdi" style="animation-delay:${i*0.08}s" data-n="${n}">${mjDie(1+Math.floor(Math.random()*6))}</i>`).join('')}</div><div class="mjdt"></div>`;
  box.appendChild(el); mjSfx('dice');
  let k = 0; const spin = setInterval(()=>{ el.querySelectorAll('.mjdi').forEach(x=>x.innerHTML = mjDie(1+Math.floor(Math.random()*6))); if(++k>=9){ clearInterval(spin);
    el.querySelectorAll('.mjdi').forEach(x=>x.innerHTML = mjDie(+x.dataset.n)); el.classList.add('done');
    el.querySelector('.mjdt').textContent = `${dealer===mjMe?'你':((mjCurView()||{seats:[]}).seats[dealer]||{}).name||''}（莊家）擲出 ${d[0]+d[1]+d[2]} 點`; } }, 90);
  setTimeout(()=>el.remove(), 2200);
}
function mjTurnAlert(){
  const box = $('mjCall'); if(!box) return;
  box.querySelectorAll('.mjturn').forEach(x=>x.remove());
  const d = document.createElement('div'); d.className = 'mjturn'; d.textContent = '輪到你了！';
  box.appendChild(d); setTimeout(()=>d.remove(), 1900);
  mjSfx('myturn'); try{ if(typeof vib==='function') vib(60); }catch(e){}
}
const sortChi = (u, t) => [u[0], u[1], t].sort((a,b)=>a-b);
function mjPick(list){
  const box = $('mjChi'); box.innerHTML = `<div class="mjpkt">選一種吃法</div>` + list.map((x,i)=>`<button class="mjpk" data-pk="${i}">${x.h}</button>`).join('') + `<button class="mja mja-x" data-pk="-1">取消</button>`;
  box.querySelectorAll('[data-pk]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.pk; box.innerHTML=''; if(i>=0) mjDo(list[i].a); });
}
const MJ_MASCOT = {'聽！':'owl1','碰！':'bunny1','吃！':'fox1','槓！':'bear1','暗槓！':'bear1','加槓！':'bear1','胡了！':'dragon1','自摸！':'phoenix1'};
function mjShout(j, txt, small){
  const box = $('mjCall'); if(!box) return;
  const pos = mjSeatPos(j), d = document.createElement('div'), big = /胡|自摸/.test(txt), pet = !small && MJ_MASCOT[txt];
  d.className = `mjsh mjsh-${pos}${small?' sm':''}${big?' big':''}`;
  d.innerHTML = `<span>${txt.replace('！','')}</span>${pet && typeof chrSrc==='function' ? `<img src="${chrSrc(pet)}" alt="">` : ''}`;
  box.appendChild(d); setTimeout(()=>d.remove(), 1400);
  if(big){ d.remove(); return mjCelebrate(j, txt); }
  if(!small){ mjSfx(big ? 'win' : 'call'); const w = {'碰！':'碰','吃！':'吃','槓！':'槓','暗槓！':'槓','加槓！':'槓','胡了！':'胡啦','自摸！':'自摸','聽！':'聽'}[txt] || txt; if(!mjPlayVoice(w, j)) mjSay(w); }
}
// 胡牌／自摸：全螢幕慶祝（金光、大字、寵物、彩帶），結算視窗晚一點才出來
function mjCelebrate(j, txt){
  const box = $('mj'); if(!box) return;
  box.querySelectorAll('.mjwin').forEach(x=>x.remove());
  const self = /自摸/.test(txt), mine = j === mjMe, V = mjCurView() || { seats: [] }, who = mine ? '你' : ((V.seats[j]||{}).name || '');
  const pet = self ? 'phoenix1' : 'dragon1', cols = ['#FFD43B','#FF6B6B','#4ECDC4','#FF9F43','#A55EEA','#26DE81','#fff'];
  const conf = Array.from({length: 46}, (_, i)=>`<i style="left:${(Math.random()*100).toFixed(1)}%;background:${cols[i%cols.length]};animation-delay:${(Math.random()*0.6).toFixed(2)}s;animation-duration:${(1.6+Math.random()*1.2).toFixed(2)}s;transform:rotate(${Math.floor(Math.random()*360)}deg)"></i>`).join('');
  const d = document.createElement('div'); d.className = 'mjwin' + (mine ? ' mine' : '');
  d.innerHTML = `<div class="mjwrays"></div><div class="mjwconf">${conf}</div>
    <div class="mjwbox"><img src="${typeof chrSrc==='function' ? chrSrc(pet) : ''}" alt=""><div class="mjwint">${self ? '自摸' : '胡了'}</div><div class="mjwwho">${esc(who)}${mine ? ' 贏了！' : ''}</div></div>`;
  box.appendChild(d); setTimeout(()=>d.remove(), 2600);
  mjSfx('win'); setTimeout(()=>mjSfx('win'), 450); try{ if(mine && typeof vib==='function') vib([60,40,120]); }catch(e){}
}
function mjResultHtml(V){
  const r = V.result, T = MJ.TABLES[V.table];
  const btns = `<div class="mjrb"><button class="btn sub" id="mjOut">離開</button><button class="btn" id="mjNext">下一局 <span id="mjNs"></span></button></div>`;
  if(r.draw) return `<div class="mjres"><div class="mjrc one"><div class="mjrt">流局</div><div class="mjrs">牌摸完了，沒有人胡。莊家連莊！</div>${btns}</div></div>`;
  const w = V.seats[r.win], hand = r.hands[r.win].slice(), wi = hand.lastIndexOf(r.t); if(wi>=0) hand.splice(wi,1);
  const title = r.self ? `${esc(w.name)} 自摸！` : `${esc(w.name)} 胡牌！<small>${esc(V.seats[r.from].name)} 放槍</small>`;
  const dIn = r.win===r.dealer || r.lines.some(l=>l.s===r.dealer);
  const tai = r.tai.map(([n,v])=>`<span class="mjtai">${esc(n)} <b>${v}</b></span>`).join('') + (dIn ? `<span class="mjtai d">莊家${r.lian?`・連${r.lian}拉${r.lian}`:''} <b>${1+2*r.lian}</b></span>` : '');
  const rows = [0,1,2,3].map(j=>{ const s=V.seats[j], v=r.pay[j];
    return `<div class="mjpr${j===V.me?' me':''}"><img src="${avSrc(s.av)}" alt=""><span>${esc(s.name)}${j===r.win?' 🏆':''}</span><b class="${v>0?'up':v<0?'dn':''}">${v>0?'+':''}${v.toLocaleString()}</b></div>`; }).join('');
  return `<div class="mjres"><div class="mjrc${r.win===V.me?' mine':''}"><div class="mjrl1"><div class="mjrt">${title}</div>
    <div class="mjrh">${w.melds.map(m=>mjMeld(m,'sm')).join('')}<span class="mmeld">${hand.map(t=>mjTile(t,'sm')).join('')}</span>${mjTile(r.t,'sm win')}</div>
    ${w.flowers.length?`<div class="mjrfl">${w.flowers.map(t=>mjTile(t,'xs')).join('')}</div>`:''}
    <div class="mjtais">${tai || '<span class="mjtai">屁胡 <b>0</b></span>'}</div>
    <div class="mjrs">${mjTotalTxt(r)}・每家付 底 ${T.base.toLocaleString()} + 台數 × ${T.tai.toLocaleString()}</div></div>
    <div class="mjrl2"><div class="mjpay">${rows}</div>${r.rake?`<div class="mjrk">娛樂廳場地費 ${Math.round(MJ.RAKE*100)}%：${r.rake.toLocaleString()} 金</div>`:''}${btns}</div></div></div>`;
}
function mjTotalTxt(r){
  const dt = 1 + 2*r.lian;
  if(r.win===r.dealer || (!r.self && r.from===r.dealer)) return `共 <b>${r.total + dt}</b> 台`;
  if(r.self) return `共 <b>${r.total}</b> 台（莊家多付 ${dt} 台）`;
  return `共 <b>${r.total}</b> 台`;
}
// 輸光了：強制離桌，回去種田
function mjBroke(){
  if(!$('mj').classList.contains('on')) return;
  if($('mjBroke')) return;
  if(MJO){ clearTimeout(MJO.tick); clearInterval(MJO.poll); MJO.busy = true; }
  const d = document.createElement('div'); d.id = 'mjBroke'; d.className = 'mjbroke';
  d.innerHTML = `<div class="mjbk"><img src="${typeof chrSrc==='function' ? chrSrc('bunny1') : ''}" alt=""><div class="mjbt1">你輸光了……</div>
    <div class="mjbt2">金幣一毛都不剩，回去種田吧！🌾</div><button class="btn" id="mjBrokeGo">🌾 回去種田</button></div>`;
  $('mj').appendChild(d); mjSfx('lose');
  $('mjBrokeGo').onclick = ()=>{ if(MJO) mjCall('leave').catch(()=>{}); mjClose(); try{ sync(); }catch(e){} try{ if(typeof FARM_C!=='undefined') centerOn(...FARM_C); }catch(e){} };
}
function mjBindResult(V){
  if(MJO && V.broke){ setTimeout(mjBroke, 1800); }
  $('mjOut').onclick = ()=>mjLeave(true);
  const T = MJ.TABLES[V.table], go = ()=>{ clearTimeout(mjNextT);
    if(MJO){ const b=$('mjNext'); if(b){ b.disabled=true; b.textContent='等其他人…'; } return mjOnline('ready'); }
    if(!MJG) return; if(MJG.seats[0].gold <= 0){ MJG.seats[0].gold = 50000; mjToast("練習場的金幣補滿了"); }
    MJG.seats.forEach(s=>{ if(s.bot && s.gold < T.min) s.gold += T.min*5; }); MJ.nextHand(MJG); mjSel=null; mjTick(); };
  $('mjNext').onclick = go;
  if(MJO && (V.ready||[]).includes(V.me)){ const b=$('mjNext'); b.disabled=true; b.textContent='等其他人…'; }
  let n = MJO && V.endAt ? Math.ceil((V.endAt + MJO.off - Date.now())/1000) : 12;
  const tick = ()=>{ const el=$('mjNs'); if(!el) return; el.textContent = `(${Math.max(0,n)})`; if(n--<=0){ if(!MJO) go(); return; } mjNextT = setTimeout(tick, 1000); };
  clearTimeout(mjNextT); tick();
}
addEventListener('resize', ()=>{ if(mjOn()){ mjFit(); mjRender(); } });
