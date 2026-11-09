
/* ================= 連線設定 ================= */
const SB_URL = 'https://qnxnuyfvkrvhnaewvrik.supabase.co';
const SB_KEY = 'sb_publishable_nX97hqqEgiGRwKQMOz56ow_uvMEAdht';
const GOOGLE_ON = true;    // Google 登入已開通
const SITE_URL = location.origin + location.pathname;
const sb = window.supabase.createClient(SB_URL, SB_KEY, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});

function zhErr(m){
  m = String(m||'');
  if(/Failed to fetch|NetworkError|Load failed/i.test(m)) return '連線失敗，請檢查網路後再試';
  if(/Invalid login credentials/i.test(m)) return 'Email 或密碼錯誤';
  if(/already registered|already been registered/i.test(m)) return '這個 Email 已經註冊過了，請直接登入';
  if(/Email not confirmed/i.test(m)) return '還沒完成 Email 驗證，請到信箱點驗證連結';
  if(/at least 6 characters/i.test(m)) return '密碼至少要 6 個字';
  if(/rate limit|too many/i.test(m)) return '操作太頻繁了，請稍後再試';
  if(/valid email|invalid format|Unable to validate email/i.test(m)) return 'Email 格式不正確';
  if(/JWT|not authenticated|請先登入/i.test(m)) return '登入已過期，請重新登入';
  if(/provider is not enabled/i.test(m)) return 'Google 登入還沒開通';
  return m;
}
async function rpc(fn, args){
  const {data, error} = await sb.rpc(fn, args||{});
  if(error) throw new Error(zhErr(error.message));
  return data;
}

/* ================= 遊戲狀態 ================= */
let S = null;          // 自己：{me, plots, off}
let V = null;          // 拜訪中的好友農場：{owner, plots, off}
let mode = 'home';
const ui = {tool:'hand', seed:'radish', busy:false};

function applyState(st){ if(st) S = {me:st.me, plots:st.plots, off:st.now - Date.now()}; }
function applyVisit(v){ if(v) V = {owner:v.owner, plots:v.plots, off:v.now - Date.now()}; }

// 依伺服器時間預測目前生長進度（實際以伺服器為準）
function pred(p, off){
  const q = Object.assign({}, p); q.dry = false;
  if(p.s !== 'grow') return q;
  const c = CROP[p.c], now = Date.now() + off;
  if(p.g < c.time){
    const el = Math.max(0, (now - p.t)/1000);
    const wet = Math.min(el, Math.max(0, ((p.wu||p.t) - p.t)/1000));
    q.g = Math.min(c.time, p.g + wet + (el-wet)*0.5);
    q.dry = q.g < c.time && now > (p.wu||0);
  }
  return q;
}
function isDry(p){ return !!p.dry; }
function curPlots(){ const src = mode==='visit' ? V : S; return src.plots.map(p=>pred(p, src.off)); }
const leftSec = p => { const c=CROP[p.c]; return (c.time - p.g)/(p.dry?0.5:1); };

/* ================= 回饋 ================= */
function showLevelUp(){
  const lv = S.me.lv;
  const un = CROPS.filter(c=>c.lv===lv).map(c=>c.name);
  const w = LAND.filter(x=>x && x.lv===lv).length;
  modal('升級了！', `<div style="text-align:center;padding:10px 0 4px">
    <div style="font-size:46px;font-weight:900;color:var(--green-d)">Lv${lv}</div>
    ${un.length?`<div style="font-weight:700;margin-top:6px">解鎖新作物：<b style="color:var(--orange-d)">${un.join('、')}</b></div>`:''}
    ${w?`<div style="font-weight:700;margin-top:4px">可以開墾新的荒地了</div>`:''}
    <div style="color:var(--ink2);font-size:13px;margin-top:8px">到種子商店看看新種子吧</div></div>`, [['太好了','',closeModal]]);
}
function xpFloat(el, xp){ if(xp>0 && el) setTimeout(()=>floatAt(el, `+${xp} 經驗`, '#C8F7A0'), 160); }

/* ================= 自己農場的動作 ================= */
async function doAct(action, i, crop, n){
  if(ui.busy) return null;
  ui.busy = true;
  try{
    const r = await rpc('farm_act', {p_action:action, p_idx:(i==null?null:i), p_crop:crop||null, p_n:n||1});
    applyState(r.state); refresh();
    if(r.lvup) setTimeout(showLevelUp, 400);
    return r;
  }catch(e){ toast(e.message); return null; }
  finally{ ui.busy = false; }
}

async function act(i){
  if(mode==='visit') return actVisit(i);
  const p = curPlots()[i], el = plotEls[i], c = p.c && CROP[p.c], tool = ui.tool;
  if(p.s==='wild') return askTill(i);
  let r;
  if(tool==='hand'){
    if(p.s==='empty') return openSeedPicker(i);
    if(p.s==='dead'){ r = await doAct('clear', i); if(r){ floatAt(el,'整地完成'); xpFloat(el,r.xp); } return; }
    if(p.g >= c.time){
      r = await doAct('harvest', i);
      if(r){ floatAt(el, `${c.name} +${r.amt}`, '#FFE066'); xpFloat(el, r.xp);
        if(r.amt < c.yield) setTimeout(()=>toast(`雜草、蟲害或被偷，產量少了 ${c.yield-r.amt} 個`), 300); }
      return;
    }
    const issues = [p.w?`雜草×${p.w}`:'', p.b?`蟲×${p.b}`:'', p.dry?'缺水':''].filter(Boolean).join('、');
    return toast(`${c.name}：約 ${fmt(leftSec(p))} 後成熟${issues?'｜'+issues:''}`);
  }
  if(tool==='seed'){
    if(p.s!=='empty') return toast(p.s==='dead'?'先用鏟子剷除枯萎的作物':'這塊地已經種了東西');
    if(!(S.me.seeds[ui.seed]>0)) return openSeedPicker(i);
    return plant(i, ui.seed);
  }
  if(tool==='water'){
    if(p.s!=='grow' || p.g>=c.time) return toast('這塊地不需要澆水');
    if(!p.dry) return toast('土壤還很濕潤，晚點再澆');
    r = await doAct('water', i); if(r){ floatAt(el,'澆水！','#BDE6FF'); xpFloat(el,r.xp); } return;
  }
  if(tool==='weed'){
    if(p.s!=='grow' || !p.w) return toast('這裡沒有雜草');
    r = await doAct('weed', i); if(r){ floatAt(el,'除草！'); xpFloat(el,r.xp); } return;
  }
  if(tool==='bug'){
    if(p.s!=='grow' || !p.b) return toast('這裡沒有蟲');
    r = await doAct('bug', i); if(r){ floatAt(el,'除蟲！'); xpFloat(el,r.xp); } return;
  }
  if(tool==='shovel'){
    if(p.s==='dead'){ r = await doAct('clear', i); if(r){ floatAt(el,'整地完成'); xpFloat(el,r.xp); } return; }
    if(p.s==='grow') return modal('剷除作物', `<p style="font-weight:700">確定要剷除還沒收成的<b>${c.name}</b>嗎？種子不會退回。</p>`,
      [['取消','sub',closeModal],['剷除','r',async()=>{ closeModal(); await doAct('dig', i); }]]);
    return toast('這塊地是空的');
  }
}
async function plant(i, id){
  const r = await doAct('plant', i, id);
  if(r) floatAt(plotEls[i], `種下${CROP[id].name}`);
}
function askTill(i){
  const w = LAND[i];
  if(S.me.lv < w.lv) return toast(`需要 Lv${w.lv} 才能開墾這塊荒地`);
  modal('開墾荒地', `<p style="font-weight:700;text-align:center">花 <b style="color:var(--orange-d)">${w.cost}</b> 金幣開墾這塊荒地？</p>`,
    [['取消','sub',closeModal],['開墾','o',async()=>{
      if(S.me.gold < w.cost) return toast('金幣不夠喔');
      closeModal(); const r = await doAct('till', i);
      if(r){ floatAt(plotEls[i],'開墾成功！'); xpFloat(plotEls[i], r.xp); }
    }]]);
}

/* ================= 好友農場的動作 ================= */
async function actVisit(i){
  if(ui.busy) return;
  const p = curPlots()[i], el = plotEls[i], c = p.c && CROP[p.c], t = ui.tool;
  const growing = p.s==='grow', ripe = growing && p.g >= c.time;
  let action;
  if(t==='steal'){
    if(!ripe) return toast(growing ? `${c.name}還沒成熟，約 ${fmt(leftSec(p))} 後` : '這塊地沒有可以偷的作物');
    if(p.mine) return toast('這塊地你已經偷過了');
    if(p.st >= p.cap) return toast('這塊地已經被偷光了，留點給主人吧');
    action = 'steal';
  } else if(t==='hweed'){ if(!growing || !p.w) return toast('這裡沒有雜草'); action='help_weed'; }
  else if(t==='hbug'){ if(!growing || !p.b) return toast('這裡沒有蟲'); action='help_bug'; }
  else if(t==='pweed' || t==='pbug'){
    if(!growing || ripe) return toast('只能在還沒成熟的作物上惡作劇');
    if(S.me.prank_left < 1) return toast('今天的惡作劇次數用完了');
    if(t==='pweed' && p.w>=3) return toast('這裡的草已經夠多了');
    if(t==='pbug' && p.b>=3) return toast('這裡的蟲已經夠多了');
    action = t==='pweed' ? 'prank_weed' : 'prank_bug';
  }
  ui.busy = true;
  try{
    const r = await rpc('farm_friend_act', {p_owner:V.owner.id, p_action:action, p_idx:i});
    applyState(r.state); applyVisit(r.visit); refresh();
    if(action==='steal') floatAt(el, `偷到 ${c.name} ×${r.qty}`, '#FFE066');
    else if(action.startsWith('help')) floatAt(el, action==='help_weed'?'幫忙除草！':'幫忙除蟲！');
    else floatAt(el, action==='prank_weed'?'放了一棵草 😈':'放了一隻蟲 😈', '#FFD6E5');
    xpFloat(el, r.xp);
    if(r.lvup) setTimeout(showLevelUp, 400);
  }catch(e){ toast(e.message); }
  finally{ ui.busy = false; }
}

/* ================= 視窗：商店、倉庫、播種 ================= */
function openSeedPicker(i){
  if(mode==='visit') return;
  const own = Object.entries(S.me.seeds).filter(([,n])=>n>0);
  if(!own.length) return modal('沒有種子', `<div class="empty">倉庫裡沒有種子了，<br>先去種子商店買一些吧！</div>`, [['去商店','o',()=>openShop()]]);
  const body = own.map(([id,n])=>{ const c=CROP[id];
    return `<div class="row"><div class="ic">${iconSVG(c)}</div><div class="tx"><b>${c.name}</b> <span class="tag">×${n}</span><div>成熟 ${dur(c.time)}・收成 ${c.yield} 個</div></div><button class="mini" data-seed="${id}">${i==null?'選擇':'種下'}</button></div>`;
  }).join('');
  modal(i==null?'選擇要播的種子':'要種什麼？', body);
  $('md').querySelectorAll('[data-seed]').forEach(b=>b.onclick=()=>{
    ui.seed = b.dataset.seed; setTool('seed'); closeModal();
    if(i!=null) plant(i, ui.seed); else toast(`點空地就能種下${CROP[ui.seed].name}`);
  });
}
function openShop(){
  if(mode==='visit') return toast('回到自己的農場才能買東西');
  const me = S.me;
  const body = CROPS.map(c=>{
    const locked = me.lv < c.lv;
    const btn = locked ? `<span class="lock">Lv${c.lv} 解鎖</span>`
      : [1,5,10].map(n=>`<button class="mini ${n===1?'':'o'}" data-buy="${c.id}" data-n="${n}" ${me.gold<c.seed*n?'disabled':''}>${n===1?'買1':'×'+n}</button>`).join(' ');
    return `<div class="row" style="${locked?'opacity:.55':''}"><div class="ic">${iconSVG(c)}</div>
      <div class="tx"><b>${c.name}</b><span class="tag">${c.seed} 金</span>
      <div>成熟 ${dur(c.time)}・收成 ${c.yield}×${c.price} 金 = ${c.yield*c.price} 金</div></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;max-width:130px">${btn}</div></div>`;
  }).join('');
  modal(`種子商店　<span style="font-size:14px;color:var(--ink2)">金幣 ${me.gold}</span>`, body);
  $('md').querySelectorAll('[data-buy]').forEach(b=>b.onclick=async()=>{
    const c = CROP[b.dataset.buy], n = +b.dataset.n;
    const r = await doAct('buy', null, c.id, n);
    if(r){ toast(`買了 ${n} 包${c.name}種子`); ui.seed = c.id; openShop(); }
  });
}
function openBag(){
  if(mode==='visit') return toast('回到自己的農場才能打開倉庫');
  const me = S.me;
  const cr = Object.entries(me.crops).filter(([,n])=>n>0);
  const sd = Object.entries(me.seeds).filter(([,n])=>n>0);
  const total = cr.reduce((a,[id,n])=>a+n*CROP[id].price, 0);
  let body = `<div class="sec">作物</div>`;
  body += cr.length ? cr.map(([id,n])=>{ const c=CROP[id];
    return `<div class="row"><div class="ic">${iconSVG(c)}</div><div class="tx"><b>${c.name}</b> <span class="tag">×${n}</span><div>每個 ${c.price} 金・共 ${n*c.price} 金</div></div>
      <button class="mini o" data-sell="${id}">全部賣出</button></div>`; }).join('')
    : `<div class="empty">還沒有收成的作物</div>`;
  body += `<div class="sec">種子</div>`;
  body += sd.length ? sd.map(([id,n])=>{ const c=CROP[id];
    return `<div class="row"><div class="ic">${iconSVG(c)}</div><div class="tx"><b>${c.name}種子</b> <span class="tag">×${n}</span><div>成熟 ${dur(c.time)}</div></div><button class="mini" data-use="${id}">拿來種</button></div>`; }).join('')
    : `<div class="empty">沒有種子</div>`;
  modal('穀倉（倉庫）', body, cr.length?[[`一鍵全部賣出（${total} 金）`,'o',async()=>{ const r=await doAct('sell_all'); if(r){ toast(`全部賣出，獲得 ${r.amt} 金`); closeModal(); } }]]:null);
  $('md').querySelectorAll('[data-sell]').forEach(b=>b.onclick=async()=>{
    const id=b.dataset.sell; const r = await doAct('sell', null, id);
    if(r){ toast(`賣出 ${CROP[id].name}，獲得 ${r.amt} 金`); openBag(); }
  });
  $('md').querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>{ ui.seed=b.dataset.use; setTool('seed'); closeModal(); toast(`點空地就能種下${CROP[ui.seed].name}`); });
}
async function openHome(){
  if(mode==='visit') return toast('這是好友的家喔');
  const {data:{user}} = await sb.auth.getUser();
  modal('我的家', `
    <div class="sec">玩家</div>
    <div style="font-weight:700;line-height:1.8">${esc(S.me.nickname)}・Lv${S.me.lv}<br><span style="color:var(--ink2);font-size:13px">${esc(user?.email||'')}</span></div>
    <div class="sec">玩法小提醒</div>
    <div style="font-size:13px;font-weight:700;color:var(--ink2);line-height:1.8">
      ・作物缺水會長得比較慢，記得澆水<br>・雜草和蟲沒處理，收成會變少<br>・成熟後要快點收，好友可以來偷菜（最多偷走 4 成）<br>・到「好友布告欄」加好友、拜訪好友農場</div>
    <div style="display:flex;gap:8px;margin-top:16px"><button class="btn sub" id="logout">登出</button></div>`);
  $('logout').onclick = async()=>{ closeModal(); await sb.auth.signOut(); };
}
const esc = s => String(s).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

/* ================= 好友布告欄 ================= */
let boardTab = 'friends', rankScope = 'f';
function ago(ms){ const s=Math.max(0,(Date.now()+(S?S.off:0)-ms)/1000); if(s<60) return '剛剛'; if(s<3600) return `${Math.floor(s/60)} 分鐘前`; if(s<86400) return `${Math.floor(s/3600)} 小時前`; return `${Math.floor(s/86400)} 天前`; }
const LOG_TXT = {steal:(l)=>`偷走了你 ${l.qty} 個${CROP[l.crop]?.name||''}`, help_weed:(l)=>`幫你的${CROP[l.crop]?.name||'作物'}除了草`, help_bug:(l)=>`幫你的${CROP[l.crop]?.name||'作物'}除了蟲`,
  prank_weed:(l)=>`在你的${CROP[l.crop]?.name||'田'}放了一棵草 😈`, prank_bug:(l)=>`在你的${CROP[l.crop]?.name||'田'}放了一隻蟲 😈`};

async function openBoard(tab){
  if(tab) boardTab = tab;
  modal('好友布告欄', `<div class="empty">讀取中…</div>`);
  let F, logs, R;
  try{ [F, logs, R] = await Promise.all([rpc('farm_friends'), boardTab==='logs'?rpc('farm_logs_get'):[], boardTab==='rank'?rpc('farm_rank'):null]); }
  catch(e){ return modal('好友布告欄', `<div class="empty">${esc(e.message)}</div>`); }
  const nIn = F.incoming.length;
  const tabs = `<div class="tabs">
    <button data-tab="friends" class="${boardTab==='friends'?'on':''}">好友 ${F.friends.length}</button>
    <button data-tab="add" class="${boardTab==='add'?'on':''}">加好友${nIn?` <i class="dot">${nIn}</i>`:''}</button>
    <button data-tab="rank" class="${boardTab==='rank'?'on':''}">排行榜</button>
    <button data-tab="logs" class="${boardTab==='logs'?'on':''}">動態</button></div>`;
  let body = '';
  if(boardTab==='friends'){
    body = F.friends.length ? F.friends.map(f=>`<div class="row">
        <div class="avatar sm">${esc(f.nickname.slice(0,1))}</div>
        <div class="tx"><b>${esc(f.nickname)}</b> <span class="tag">Lv${f.lv}</span>
          <div>${f.ripe?`<span style="color:var(--orange-d)">🧺 有 ${f.ripe} 塊地可以偷</span>`:'目前沒有可偷的菜'}${f.issues?`・🐛 需要幫忙 ${f.issues}`:''}</div></div>
        <button class="mini ${f.ripe?'o':''}" data-visit="${f.id}">拜訪</button></div>`).join('')
      : `<div class="empty">還沒有好友，<br>到「加好友」輸入朋友的暱稱吧！</div>`;
  } else if(boardTab==='add'){
    body = `<div class="sec">用暱稱加好友</div>
      <div style="display:flex;gap:8px;margin-top:6px"><input id="fnick" class="inp" maxlength="10" placeholder="輸入朋友的暱稱"><button class="mini" id="fsend" style="padding:0 16px">送出</button></div>
      <div style="font-size:12px;color:var(--ink2);font-weight:700;margin-top:6px">你的暱稱是「${esc(S.me.nickname)}」，把它告訴朋友吧</div>`;
    body += `<div class="sec">等你確認的邀請</div>` + (F.incoming.length ? F.incoming.map(f=>`<div class="row">
        <div class="avatar sm">${esc(f.nickname.slice(0,1))}</div><div class="tx"><b>${esc(f.nickname)}</b> <span class="tag">Lv${f.lv}</span><div>想成為你的好友</div></div>
        <button class="mini" data-acc="${f.id}">接受</button><button class="mini sub" data-rej="${f.id}">拒絕</button></div>`).join('') : `<div class="empty" style="padding:10px 0">沒有新的邀請</div>`);
    if(F.outgoing.length) body += `<div class="sec">已送出、等對方確認</div>` + F.outgoing.map(f=>`<div class="row"><div class="avatar sm">${esc(f.nickname.slice(0,1))}</div><div class="tx"><b>${esc(f.nickname)}</b><div>等待確認中</div></div></div>`).join('');
  } else if(boardTab==='rank'){
    const medal = r => r===1?'🥇':r===2?'🥈':r===3?'🥉':r;
    const row = (rk, x) => `<div class="row rk${x.me?' mine':''}"><div class="rkn">${medal(rk)}</div><div class="avatar sm">${esc(x.nickname.slice(0,1))}</div>
        <div class="tx"><b>${esc(x.nickname)}</b>${x.me?' <span class="tag">我</span>':''}<div>經驗 ${x.exp}</div></div><span class="tag" style="font-size:13px">Lv${x.lv}</span></div>`;
    body = `<div class="seg" style="margin:4px 0 6px"><button data-rs="f" class="${rankScope==='f'?'on':''}">好友排行</button><button data-rs="a" class="${rankScope==='a'?'on':''}">全服前 50 名</button></div>`;
    if(rankScope==='f') body += R.friends.map((x,k)=>row(k+1, x)).join('') + (R.friends.length<2?`<div class="empty" style="padding:10px 0">加更多好友一起比賽吧！</div>`:'');
    else body += R.top.map(x=>row(x.rk, x)).join('');
    body += `<div class="myrank">你在全服排第 <b>${R.my_rank}</b> 名（共 ${R.total} 位玩家）</div>`;
  } else {
    body = logs.length ? logs.map(l=>`<div class="row"><div class="avatar sm" style="background:${l.kind.startsWith('prank')?'#F78FB3':l.kind==='steal'?'#FF9F43':'#3BB273'}">${esc((l.who||'?').slice(0,1))}</div>
        <div class="tx"><b>${esc(l.who||'')}</b> ${(LOG_TXT[l.kind]||(()=>''))(l)}<div>${ago(l.at)}</div></div></div>`).join('')
      : `<div class="empty">還沒有任何動態</div>`;
  }
  modal('好友布告欄', tabs + body);
  const md = $('md');
  md.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>openBoard(b.dataset.tab));
  md.querySelectorAll('[data-rs]').forEach(b=>b.onclick=()=>{ rankScope=b.dataset.rs; openBoard('rank'); });
  md.querySelectorAll('[data-visit]').forEach(b=>b.onclick=()=>visit(b.dataset.visit));
  md.querySelectorAll('[data-acc]').forEach(b=>b.onclick=async()=>{ try{ toast(await rpc('farm_friend_respond',{p_from:b.dataset.acc,p_accept:true})); openBoard(); }catch(e){ toast(e.message); } });
  md.querySelectorAll('[data-rej]').forEach(b=>b.onclick=async()=>{ try{ toast(await rpc('farm_friend_respond',{p_from:b.dataset.rej,p_accept:false})); openBoard(); }catch(e){ toast(e.message); } });
  const fs = $('fsend');
  if(fs){ const send = async()=>{ const v=$('fnick').value.trim(); if(!v) return toast('請輸入暱稱');
      try{ toast(await rpc('farm_friend_request',{p_nick:v})); openBoard(); }catch(e){ toast(e.message); } };
    fs.onclick = send; $('fnick').addEventListener('keydown', e=>{ if(e.key==='Enter') send(); }); }
}

/* ================= 拜訪 / 回家 ================= */
async function visit(id){
  try{ applyVisit(await rpc('farm_visit', {p_owner:id})); }
  catch(e){ return toast(e.message); }
  closeModal(); mode = 'visit'; plotSig = plotSig.map(()=> '');
  buildTools(); setTool('steal'); refresh();
  $('bHome').textContent = '🏠 回我的農場';
  centerOn(...FARM_C, true);
  toast(`來到 ${V.owner.nickname} 的農場`);
}
async function goHome(){
  if(mode==='home'){ centerOn(...FARM_C, true); return; }
  mode = 'home'; V = null; plotSig = plotSig.map(()=> '');
  buildTools(); setTool('hand'); refresh();
  $('bHome').textContent = '🌾 回到農田';
  centerOn(...FARM_C, true);
  sync();
}

function tapBuilding(g){
  g.classList.remove('hit'); void g.getBBox(); g.classList.add('hit');
  const id = g.dataset.b;
  if(id==='board') return openBoard();
  if(mode==='visit' && ['shop','barn','home'].includes(id)) return toast('回到自己的農場才能使用');
  if(id==='shop') return openShop();
  if(id==='barn') return openBag();
  if(id==='home') return openHome();
  const o = BLD.find(b=>b.id===id); if(o && o.locked) toast(o.locked);
}

/* ================= 畫面 ================= */
const TOOLS_VISIT = [['steal','偷菜'],['hweed','幫除草'],['hbug','幫除蟲'],['pweed','放草'],['pbug','放蟲']];
ICONS.steal = `<svg viewBox="0 0 32 32"><path d="M9 14 Q8 6 13 6 L13 15 M13 8 Q13 4 17 4 Q19 4 19 8 L19 15 M19 8 Q19 5 22 5.5 Q24 6 24 9 L24 16 Q24 26 16 27 Q9 27 7 20 L5 15 Q5 12 8 13 L10 17" fill="#FFD7B5" stroke="#C98B5E" stroke-width="1.6" stroke-linejoin="round"/><circle cx="25" cy="24" r="5" fill="#F2545B"/></svg>`;
ICONS.hweed = ICONS.weed; ICONS.hbug = ICONS.bug;
ICONS.pweed = `<svg viewBox="0 0 32 32"><path d="M8 26 L4 12 L10 20 L12 6 L15 20 L20 10 L18 26Z" fill="#3E9B3E"/><circle cx="23" cy="22" r="7" fill="#F78FB3"/><path d="M20 22 h6 M23 19 v6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`;
ICONS.pbug = `<svg viewBox="0 0 32 32"><g transform="translate(12 16) scale(1.5)"><ellipse rx="6" ry="4.5" fill="#7A4F2A"/><circle cx="-6" cy="-1" r="3" fill="#4E331C"/><circle cx="-2.5" cy="-1.5" r="1.1" fill="#F4C27A"/><circle cx="2.5" cy="1.5" r="1.1" fill="#F4C27A"/></g><circle cx="24" cy="23" r="7" fill="#F78FB3"/><path d="M21 23 h6 M24 20 v6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`;

function buildTools(){
  const list = mode==='visit' ? TOOLS_VISIT : TOOLS;
  $('tools').style.gridTemplateColumns = `repeat(${list.length},1fr)`;
  $('tools').innerHTML = list.map(([k,n])=>`<button class="tool" data-tool="${k}">${ICONS[k]}<span>${n}</span>${k==='seed'?'<span class="badge" id="seedBadge"></span>':''}${k==='pweed'?'<span class="badge" id="prankBadge"></span>':''}</button>`).join('');
  $('tools').querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{
    if(b.dataset.tool==='seed') return openSeedPicker(null);
    setTool(b.dataset.tool);
  });
}
function setTool(t){ ui.tool=t; document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('on', b.dataset.tool===t)); }

function renderPlots(){
  if(!S) return;
  const P = curPlots();
  P.forEach(p=>{
    const i = p.i, el = plotEls[i]; if(!el) return;
    const st = p.s==='grow' ? stageOf(p) : -1;
    const sig = [mode, p.s, p.c, st, p.w, p.b, p.dry, p.s==='wild'?S.me.lv:0].join('|');
    if(sig !== plotSig[i]){ el.querySelector('.pg').innerHTML = plotGroundSVG(p,i); el.querySelector('.ps').innerHTML = plotSpriteSVG(p,i); plotSig[i] = sig; }
    el.classList.toggle('ripe', st===4);
    const L = plotLabs[i], t = L.querySelector('text'), r = L.querySelector('rect'), bb = L.querySelector('.bb'), bf = L.querySelector('.bf');
    L.style.display = (p.s==='wild'||p.s==='empty') ? 'none' : '';
    let txt='', pct=-1, bg='#fff', fg='#3A3226';
    if(p.s==='dead'){ txt = mode==='visit' ? '已收成' : '枯萎・剷除'; bg='#E8DCC8'; }
    else if(p.s==='grow'){ const c = CROP[p.c];
      if(st===4){
        if(mode==='visit'){
          if(p.mine){ txt='你偷過了'; bg='#E8DCC8'; }
          else if(p.st >= p.cap){ txt='被偷光了'; bg='#E8DCC8'; }
          else { txt=`${c.name}可以偷！`; bg='#F2545B'; fg='#fff'; }
        } else { txt=`${c.name}可收成！`; bg='#FF9F43'; fg='#fff'; }
      } else { txt = `${c.name} ${fmtS(leftSec(p))}`; pct = p.g/c.time; if(p.dry) bg='#DDF0FF'; }
    }
    if(t.textContent !== txt) t.textContent = txt;
    r.setAttribute('fill', bg); t.setAttribute('fill', fg); t.setAttribute('y', pct>=0?2:4);
    bb.style.display = bf.style.display = pct>=0 ? '' : 'none';
    if(pct>=0) bf.setAttribute('width', (56*pct).toFixed(1));
  });
}
function renderHUD(){
  if(!S) return;
  const me = S.me;
  $('pname').textContent = me.nickname; $('avatar').textContent = me.nickname.slice(0,1);
  $('plv').textContent = 'Lv'+me.lv; $('pgold').textContent = me.gold.toLocaleString();
  const need = needExp(me.lv);
  $('pexp').style.width = (me.lv>=MAX_LV?100:Math.min(100, me.exp/need*100))+'%';
  $('pexpt').textContent = me.lv>=MAX_LV ? 'MAX' : `${me.exp}/${need}`;
  const n = Object.values(me.seeds).reduce((a,b)=>a+b,0);
  const bd = $('seedBadge'); if(bd){ bd.textContent=n; bd.style.display=n?'':'none'; }
  const pb = $('prankBadge'); if(pb){ pb.textContent=me.prank_left; }
  const PL = curPlots(); let h;
  if(mode==='visit'){
    const can = PL.filter(p=>p.s==='grow' && p.g>=CROP[p.c].time && !p.mine && p.st<p.cap).length;
    h = `你在 <b>${esc(V.owner.nickname)}</b>（Lv${V.owner.lv}）的農場・` + (can ? `有 <b>${can}</b> 塊地可以偷！` : `今天惡作劇還剩 ${me.prank_left} 次`);
    $('hint').innerHTML = `<span>🧺</span><span>${h}</span>`; return;
  }
  if(PL.some(p=>p.s==='grow'&&stageOf(p)===4)) h='有作物<b>成熟</b>了，快收成，小心被好友偷走！';
  else if(PL.some(p=>p.s==='grow'&&(p.w||p.b))) h='田裡長了<b>雜草或蟲</b>，不處理會減少收成';
  else if(PL.some(isDry)) h='有田地<b>缺水</b>了，澆水才能長得快';
  else if(PL.some(p=>p.s==='dead')) h='收成後的枯萎作物，用<b>鏟子</b>剷除就能再種';
  else if(PL.some(p=>p.s==='empty')) h = n?'點<b>空地</b>選種子種下去吧':'沒有種子了，點<b>種子商店</b>買一些吧';
  else h='作物正在長大中…去<b>好友布告欄</b>看看誰的菜可以偷';
  $('hint').innerHTML = `<span>🌱</span><span>${h}</span>`;
}
function refresh(){ renderPlots(); renderHUD(); }

/* ================= 同步 ================= */
let syncing = false;
async function sync(){
  if(!S || syncing || document.hidden) return;
  syncing = true;
  try{
    if(mode==='visit' && V) applyVisit(await rpc('farm_visit', {p_owner:V.owner.id}));
    else { const st = await rpc('farm_me'); if(st) applyState(st); }
    refresh();
  }catch(e){ if(/還不是好友/.test(e.message)){ toast(e.message); goHome(); } }
  finally{ syncing = false; }
}
setInterval(()=>{ if(S && $('map').style.display!=='none'){ renderPlots(); renderHUD(); } }, 1000);
setInterval(sync, 15000);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) sync(); });

/* ================= 登入流程 ================= */
let authMode = 'login';
function showScreen(which){
  $('login').style.display = (which==='login'||which==='nick') ? 'flex' : 'none';
  $('loginCard').style.display = which==='login' ? '' : 'none';
  $('nickCard').style.display = which==='nick' ? '' : 'none';
  ['map','hud','dock'].forEach(k=>$(k).style.display = which==='game' ? '' : 'none');
}
function setAuthMode(m){
  authMode = m;
  document.querySelectorAll('[data-am]').forEach(b=>b.classList.toggle('on', b.dataset.am===m));
  $('authBtn').textContent = m==='login' ? '登入' : '註冊新帳號';
  $('pw2').style.display = m==='signup' ? '' : 'none';
  $('authMsg').textContent = '';
}
function authMsg(t, ok){ const m=$('authMsg'); m.textContent=t; m.style.color = ok?'var(--green-d)':'var(--red)'; }

async function doAuth(){
  const email = $('email').value.trim(), pw = $('pw').value;
  if(!email || !pw) return authMsg('請輸入 Email 和密碼');
  const btn = $('authBtn'); btn.disabled = true;
  try{
    if(authMode==='signup'){
      if(pw.length < 6) return authMsg('密碼至少要 6 個字');
      if(pw !== $('pw2').value) return authMsg('兩次輸入的密碼不一樣');
      const {data, error} = await sb.auth.signUp({email, password:pw, options:{emailRedirectTo:SITE_URL}});
      if(error) return authMsg(zhErr(error.message));
      if(data.user && data.user.identities && data.user.identities.length===0) return authMsg('這個 Email 已經註冊過了，請直接登入');
      if(!data.session) return authMsg(`驗證信已寄到 ${email}，請點信中的連結完成註冊`, true);
    } else {
      const {error} = await sb.auth.signInWithPassword({email, password:pw});
      if(error) return authMsg(zhErr(error.message));
    }
  } finally { btn.disabled = false; }
}
async function forgotPw(){
  const email = $('email').value.trim();
  if(!email) return authMsg('請先在上面輸入你的 Email');
  const {error} = await sb.auth.resetPasswordForEmail(email, {redirectTo:SITE_URL});
  if(error) return authMsg(zhErr(error.message));
  authMsg(`重設密碼的信已寄到 ${email}`, true);
}
function showResetPw(){
  modal('設定新密碼', `<input id="npw" class="inp" type="password" placeholder="新密碼（至少 6 個字）" style="width:100%">`,
    [['確定','',async()=>{ const v=$('npw').value; if(v.length<6) return toast('密碼至少要 6 個字');
      const {error} = await sb.auth.updateUser({password:v}); if(error) return toast(zhErr(error.message)); closeModal(); toast('密碼已更新'); }]]);
}
async function createNick(){
  const v = $('nickIn').value.trim(); if(!v) return toast('請輸入暱稱');
  try{ const st = await rpc('farm_create', {p_nick:v}); startGame(st); }
  catch(e){ toast(e.message); }
}

let built = false, entering = false;
async function enterGame(){
  if(entering) return; entering = true;
  try{
    const st = await rpc('farm_me');
    if(!st){ showScreen('nick'); setTimeout(()=>$('nickIn').focus(), 50); return; }
    startGame(st);
  }catch(e){ toast(e.message); showScreen('login'); }
  finally{ entering = false; }
}
function startGame(st){
  applyState(st); mode = 'home'; V = null;
  showScreen('game');
  if(!built){ buildWorld(); requestAnimationFrame(animate); built = true; }
  plotSig = plotSig.map(()=> '');
  buildTools(); layout(); setTool('hand'); refresh();
  $('bHome').textContent = '🌾 回到農田';
  requestAnimationFrame(()=>centerOn(...FARM_C));
  toast(`歡迎回到小鎮，${S.me.nickname}！`);
}

$('authBtn').onclick = doAuth;
$('pw').addEventListener('keydown', e=>{ if(e.key==='Enter') doAuth(); });
$('pw2').addEventListener('keydown', e=>{ if(e.key==='Enter') doAuth(); });
document.querySelectorAll('[data-am]').forEach(b=>b.onclick=()=>setAuthMode(b.dataset.am));
$('forgot').onclick = forgotPw;
$('gBtn').onclick = async()=>{
  if(!GOOGLE_ON) return authMsg('Google 登入正在設定中，請先用 Email 註冊');
  const {error} = await sb.auth.signInWithOAuth({provider:'google', options:{redirectTo:SITE_URL}});
  if(error) authMsg(zhErr(error.message));
};
if(!GOOGLE_ON) $('gBtn').classList.add('off');
$('nickBtn').onclick = createNick;
$('nickIn').addEventListener('keydown', e=>{ if(e.key==='Enter') createNick(); });
$('nickOut').onclick = ()=>sb.auth.signOut();
$('bHome').onclick = goHome;

sb.auth.onAuthStateChange((ev, session)=>{
  if(ev==='PASSWORD_RECOVERY'){ setTimeout(showResetPw, 300); }
  if(session && (ev==='SIGNED_IN' || ev==='INITIAL_SESSION') && !S) setTimeout(enterGame, 0);
  if(ev==='SIGNED_OUT'){ S=null; V=null; mode='home'; showScreen('login'); setAuthMode('login'); }
  if(ev==='INITIAL_SESSION' && !session) showScreen('login');
});
setAuthMode('login');
