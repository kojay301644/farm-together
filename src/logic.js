
/* ================= 連線設定 ================= */
const SB_URL = 'https://qnxnuyfvkrvhnaewvrik.supabase.co';
const SB_KEY = 'sb_publishable_nX97hqqEgiGRwKQMOz56ow_uvMEAdht';
const GOOGLE_ON = true;    // Google 登入已開通
const SITE_URL = location.origin + location.pathname;
const sb = window.supabase.createClient(SB_URL, SB_KEY, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});

function zhErr(m){
  m = String(m||'');
  if(/Failed to fetch|NetworkError|Load failed/i.test(m)) return '連線失敗，請檢查網路後再試';
  if(/Invalid login credentials/i.test(m)) return '帳號或密碼錯誤';
  if(/already registered|already been registered|already exists/i.test(m)) return '這個帳號已經有人使用了';
  if(/anonymous/i.test(m) && /disabled|not enabled|not allowed/i.test(m)) return '伺服器還沒開啟免註冊試玩，請先建立帳號';
  if(/Email not confirmed/i.test(m)) return '還沒完成 Email 驗證，請到信箱點驗證連結';
  if(/at least 6 characters/i.test(m)) return '密碼至少要 6 個字';
  if(/rate limit|too many/i.test(m)) return '操作太頻繁了，請稍後再試';
  if(/valid email|invalid format|Unable to validate email/i.test(m)) return 'Email 格式不正確';
  if(/JWT|not authenticated|請先登入/i.test(m)) return '登入已過期，請重新登入';
  if(/provider is not enabled/i.test(m)) return 'Google 登入還沒開通';
  return m;
}
async function rpc(fn, args){
  if(SESS.kicked) throw new Error('帳號已在其他裝置登入');
  const {data, error} = await sb.rpc(fn, args||{});
  if(error){ if(/KICKED/.test(error.message)){ showKicked(); throw new Error('帳號已在其他裝置登入'); }
    if(/維護中：/.test(error.message)){ showMaint(error.message.replace(/^.*維護中：/,'')); throw new Error('伺服器維護中'); }
    throw new Error(zhErr(error.message)); }
  return data;
}
/* ================= 單一裝置登入：新登入的裝置會擠掉舊的 ================= */
const SESS = {sid:null, kicked:false};
let CFG_SET = {};
function devName(){ const u=navigator.userAgent; const os=/iPhone/.test(u)?'iPhone':/iPad/.test(u)?'iPad':/Android/.test(u)?'Android 手機':/Mac/.test(u)?'Mac':/Windows/.test(u)?'Windows 電腦':'其他裝置';
  const br=/Line\//.test(u)?'LINE':/FBAN|FBAV/.test(u)?'Facebook':/CriOS|Chrome/.test(u)?'Chrome':/Safari/.test(u)?'Safari':/Firefox/.test(u)?'Firefox':'瀏覽器'; return os+'・'+br; }
function setSidHeader(v){ try{ const h=sb.rest.headers; if(typeof Headers!=='undefined' && h instanceof Headers){ v?h.set('x-farm-sid',v):h.delete('x-farm-sid'); } else if(h){ if(v) h['x-farm-sid']=v; else delete h['x-farm-sid']; } }catch(e){} }
async function sessionStart(){
  try{ const {data} = await sb.rpc('farm_session_start', {p_dev:devName()}); if(data && data.sid){ SESS.sid=data.sid; SESS.kicked=false; setSidHeader(data.sid); } }catch(e){}
}
async function sessionPing(){
  if(!SESS.sid || SESS.kicked) return;
  try{ const {data} = await sb.rpc('farm_session_ping', {p_sid:SESS.sid}); if(data && data.ok===false) showKicked(data.dev); }catch(e){}
}
function showMaint(msg){
  if(document.getElementById('maintOv')) return;
  const d=document.createElement('div'); d.className='kick'; d.id='maintOv';
  d.innerHTML=`<div class="kbox"><div style="font-size:40px">🛠️</div><h3>伺服器維護中</h3><p>${esc(msg||'請稍後再來')}</p><button class="btn" id="maintGo">重新整理</button></div>`;
  document.body.appendChild(d); $('maintGo').onclick=()=>location.reload();
}
function showKicked(dev){
  if(SESS.kicked) return; SESS.kicked=true;
  const d=document.createElement('div'); d.className='kick';
  d.innerHTML=`<div class="kbox"><div style="font-size:40px">⚠️</div><h3>帳號已在其他裝置登入</h3><p>你的帳號剛剛在${dev?`「${esc(dev)}」`:'另一台裝置'}開啟，這台已經暫停，避免兩邊同時玩造成進度錯亂。</p><p class="mut">如果不是你本人登入，請盡快修改密碼。</p><button class="btn" id="kickGo">在這台繼續玩</button></div>`;
  document.body.appendChild(d); $('kickGo').onclick=()=>location.reload();
}
setInterval(sessionPing, 30000);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) sessionPing(); });

/* ================= 遊戲狀態 ================= */
let S = null;          // 自己：{me, plots, off}
let V = null;          // 拜訪中的好友農場：{owner, plots, off}
let mode = 'home';
const ui = {tool:'hand', seed:'radish', busy:false};

function applyState(st){ if(!st) return; const old=S; S = {me:st.me, plots:st.plots, ranch:st.ranch||[], off:st.now - Date.now()}; S.me._stAt = Date.now();
  try{ if(old && mode==='home' && Date.now()-(ui.lastLocal||0) > 3000) autoJobs(old, S); }catch(e){} }
/* 比對前後狀態，看出是寵物裝備自動做的事 → 叫對應的寵物跑過去 */
function autoJobs(a, b){
  if(typeof petDo!=='function') return;
  const A={}; (a.plots||[]).forEach(p=>A[p.i]=p);
  (b.plots||[]).forEach(p=>{ const o=A[p.i]; if(!o) return;
    if(o.s==='empty' && p.s==='grow') petDo('plant', p.i);
    else if(o.s==='grow' && p.s==='empty') petDo('harvest', p.i);
    else if(o.s==='grow' && p.s==='grow' && o.c===p.c){
      if((p.wu||0) > (o.wu||0) + 1000 && (o.wu||0) < Date.now()+(b.off||0)) petDo('water', p.i);
      if((p.w||0) < (o.w||0)) petDo('weed', p.i);
      if((p.b||0) < (o.b||0)) petDo('bug', p.i); } });
  const R={}; (a.ranch||[]).forEach(r=>R[r.slot]=r);
  (b.ranch||[]).forEach(r=>{ const o=R[r.slot]; if(!o) return;
    if(!o.ra && r.ra) petDo('feed', 'ranch');
    else if(o.ra && !r.ra) petDo('harvest', 'ranch');
    if((r.f||0) < (o.f||0)) petDo('swat', 'ranch'); });
}
function applyVisit(v){ if(v) V = {owner:v.owner, plots:v.plots, ranch:v.ranch||[], bin:v.bin||{}, off:v.now - Date.now(), friend:!!v.friend, protected:!!v.protected}; }

// 依伺服器時間預測目前生長進度（實際以伺服器為準）
function pred(p, off){
  const q = Object.assign({}, p); q.dry = false;
  if(p.s !== 'grow') return q;
  const c = CROP[p.c], now = Date.now() + off;
  if(p.g < c.time){
    const el = Math.max(0, (now - p.t)/1000);
    const wet = Math.min(el, Math.max(0, ((p.wu||p.t) - p.t)/1000));
    q.g = Math.min(c.time, p.g + (wet + (el-wet)*0.5) * pestMul(p));
    q.dry = q.g < c.time && now > (p.wu||0);
  }
  return q;
}
function isDry(p){ return !!p.dry; }
function curPlots(){ const src = mode==='visit' ? V : S; return src.plots.map(p=>pred(p, src.off)); }
const partyMul = () => { const ow = mode==='visit' && V ? V.owner : (S && S.me), b = (ow && ow.buffs) || {}, now = Date.now() + ((mode==='visit'&&V?V.off:S&&S.off)||0);
  return (+(b.party||0) > now ? +(CFG_SET.party_grow ?? 1.2) : 1) * (+(b.grow||0) > now ? +(CFG_SET.speed_grow ?? 2) : 1); };
const pestMul = p => Math.max(1 - +(CFG_SET.pest_slow_max ?? 0.6), 1 - +(CFG_SET.pest_slow ?? 0.1) * ((p.w||0) + (p.b||0))) * partyMul();
const leftSec = p => { const c=CROP[p.c]; return (c.time - p.g)/((p.dry?0.5:1) * pestMul(p)); };

/* ================= 回饋 ================= */
function showLevelUp(){
  fxConfetti();
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

/* ================= 動作佇列：點了馬上有反應，伺服器在背景依序確認 ================= */
let actPending=0, actChain=Promise.resolve(), actErr=false;
function queueRpc(fn, args, onLast){
  actPending++; ui.lastLocal=Date.now();
  const p = actChain.then(()=>rpc(fn, args)).then(r=>({r}), e=>({e}));
  actChain = p.then(()=>{});
  return p.then(res=>{
    actPending--; ui.lastLocal=Date.now();
    if(res.e){ sfx('err'); toast(res.e.message); actErr=true; }
    if(actPending===0){
      if(actErr){ actErr=false; resyncNow(); }
      else if(res.r && onLast) onLast(res.r);
    }
    return res.r || null;
  });
}
async function resyncNow(){
  try{ if(mode==='visit' && V) applyVisit(await rpc('farm_visit', {p_owner:V.owner.id}));
       else { const st=await rpc('farm_me'); if(st) applyState(st); } refresh(); }catch(e){}
}
/* 先在畫面上改好（預測），伺服器回來再以伺服器為準 */
const srvNow = () => Date.now() + ((mode==='visit' && V ? V.off : S.off) || 0);
function optPlot(i, fn){
  const src = mode==='visit' ? V : S, p = src && src.plots[i]; if(!p) return;
  if(p.s==='grow' && p.c && CROP[p.c]){ const q=pred(p, src.off); p.g=q.g; p.t=srvNow(); }
  fn(p, CROP[p.c]); try{ renderPlots(); renderHUD(); }catch(e){}
}

/* ================= 自己農場的動作 ================= */
async function doAct(action, i, crop, n, opt){
  if(opt) opt();
  const r = await queueRpc('farm_act', {p_action:action, p_idx:(i==null?null:i), p_crop:crop||null, p_n:n||1}, r=>{ applyState(r.state); refresh(); });
  if(r){
    if(r.lvup) setTimeout(showLevelUp, 400);
    if(r.gift) setTimeout(()=>showGift(r.gift), r.lvup?1600:500);
  }
  return r;
}

async function act(i){
  if(mode==='visit') return actVisit(i);
  const p = curPlots()[i], el = plotEls[i], c = p.c && CROP[p.c], tool = ui.tool;
  if(p.s==='wild') return askTill(i);
  let r;
  const clearIt = ()=>optPlot(i, q=>{ q.s='empty'; q.c=null; q.g=0; q.w=0; q.b=0; q.st=0; });
  if(tool==='hand'){
    if(p.s==='empty') return openSeedPicker(i);
    if(p.s==='dead'){ fxDirt(i); floatAt(el,'整地完成'); r = await doAct('clear', i, null, 1, clearIt); if(r) xpFloat(el,r.xp); return; }
    if(p.g >= c.time){
      const est = Math.max(1, Math.max(Math.ceil(c.yield*(+(CFG_SET.pest_floor??0.5))), c.yield-(p.w||0)-(p.b||0)) - (p.st||0));
      fxHarvest(i, c, est);
      r = await doAct('harvest', i, null, 1, ()=>{ S.me.crops[c.id]=(S.me.crops[c.id]||0)+est; clearIt(); });
      if(r){ floatAt(el, `${c.name} +${r.amt}`, '#FFE066'); xpFloat(el, r.xp);
        if(r.amt < c.yield) setTimeout(()=>toast(`雜草、蟲害或被偷，產量少了 ${c.yield-r.amt} 個`), 300); }
      return;
    }
    return openFertPlot(i);
  }
  if(tool==='seed'){
    if(p.s!=='empty') return toast('這塊地已經種了東西');
    if(!SEED_KEEP || !(S.me.seeds[ui.seed]>0)) return openSeedPicker(i);   // 沒開連續播種：每塊地都重新選
    return plant(i, ui.seed);
  }
  if(tool==='water'){
    if(p.s!=='grow' || p.g>=c.time) return toast('這塊地不需要澆水');
    if(!p.dry) return toast('土壤還很濕潤，晚點再澆');
    fxWater(i); floatAt(el,'澆水！','#BDE6FF');
    r = await doAct('water', i, null, 1, ()=>optPlot(i, (q,cc)=>{ q.wu = srvNow() + wetDur(cc)*1000; }));
    if(r) xpFloat(el,r.xp); return;
  }
  if(tool==='weed'){
    if(p.s!=='grow' || !p.w) return toast('這裡沒有雜草');
    fxPoof(i,'weed'); floatAt(el,'除草！');
    r = await doAct('weed', i, null, 1, ()=>optPlot(i, q=>{ q.w=Math.max(0,(q.w||0)-1); }));
    if(r) xpFloat(el,r.xp); return;
  }
  if(tool==='bug'){
    if(p.s!=='grow' || !p.b) return toast('這裡沒有蟲');
    fxPoof(i,'bug'); floatAt(el,'除蟲！');
    r = await doAct('bug', i, null, 1, ()=>optPlot(i, q=>{ q.b=Math.max(0,(q.b||0)-1); }));
    if(r) xpFloat(el,r.xp); return;
  }
  if(tool==='shovel'){
    if(p.s==='dead'){ fxDirt(i); floatAt(el,'整地完成'); r = await doAct('clear', i, null, 1, clearIt); if(r) xpFloat(el,r.xp); return; }
    if(p.s==='grow') return modal('剷除作物', `<p style="font-weight:700">確定要剷除還沒收成的<b>${c.name}</b>嗎？種子不會退回。</p>`,
      [['取消','sub',closeModal],['剷除','r',async()=>{ closeModal(); fxDirt(i); await doAct('dig', i, null, 1, clearIt); }]]);
    return toast('這塊地是空的');
  }
}
async function plant(i, id){
  const cc = CROP[id];
  if(!(S.me.seeds[id] > 0)) return toast(`沒有${cc.name}的種子了`);
  fxSeed(i); floatAt(plotEls[i], `種下${cc.name}`);
  await doAct('plant', i, id, 1, ()=>{ S.me.seeds[id] = (S.me.seeds[id]||0) - 1;
    optPlot(i, q=>{ const t=srvNow(); q.s='grow'; q.c=id; q.g=0; q.t=t; q.wu=t+wetDur(cc)*1000; q.w=0; q.b=0; q.st=0; q.mine=false; }); });
}
function askTill(i){
  const w = LAND[i];
  if(S.me.lv < w.lv) return toast(`需要 Lv${w.lv} 才能開墾這塊荒地`);
  modal('開墾荒地', `<p style="font-weight:700;text-align:center">花 <b style="color:var(--orange-d)">${w.cost}</b> 金幣開墾這塊荒地？</p>`,
    [['取消','sub',closeModal],['開墾','o',async()=>{
      if(S.me.gold < w.cost) return toast('金幣不夠喔');
      closeModal(); fxDirt(i); fxPoof(i,'weed'); floatAt(plotEls[i],'開墾成功！');
      const r = await doAct('till', i, null, 1, ()=>{ S.me.gold -= w.cost; optPlot(i, q=>{ q.s='empty'; }); });
      if(r) xpFloat(plotEls[i], r.xp);
    }]]);
}

/* ================= 好友農場的動作 ================= */
async function actVisit(i){
  const p = curPlots()[i], el = plotEls[i], c = p.c && CROP[p.c], t = ui.tool;
  const growing = p.s==='grow', ripe = growing && p.g >= c.time;
  let action, opt;
  if(t==='steal'){
    if(!ripe) return toast(growing ? `${c.name}還沒成熟，約 ${fmt(leftSec(p))} 後` : '這塊地沒有可以偷的作物');
    if(p.mine) return toast('這塊地你已經偷過了');
    if(p.st >= p.cap) return toast('這塊地已經被偷光了，留點給主人吧');
    action = 'steal'; opt = q=>{ q.mine=true; };
  } else if(t==='hwater'){ if(!growing || ripe) return toast('這塊地不需要澆水'); if(!p.dry) return toast('土壤還很濕潤'); action='help_water'; opt=(q,cc)=>{ q.wu=srvNow()+wetDur(cc)*1000; }; }
  else if(t==='hweed'){ if(!growing || !p.w) return toast('這裡沒有雜草'); action='help_weed'; opt=q=>{ q.w=Math.max(0,(q.w||0)-1); }; }
  else if(t==='hbug'){ if(!growing || !p.b) return toast('這裡沒有蟲'); action='help_bug'; opt=q=>{ q.b=Math.max(0,(q.b||0)-1); }; }
  else if(t==='pweed' || t==='pbug'){
    if(!growing || ripe) return toast('只能在還沒成熟的作物上惡作劇');
    if(S.me.prank_left < 1) return toast(`惡作劇體力用完了${S.me.prank_regen>0?`，每 ${S.me.prank_regen} 分鐘回 1 點`:''}`);
    if(t==='pweed' && p.w>=3) return toast('這裡的草已經夠多了');
    if(t==='pbug' && p.b>=3) return toast('這裡的蟲已經夠多了');
    action = t==='pweed' ? 'prank_weed' : 'prank_bug';
    opt = q=>{ if(t==='pweed') q.w=(q.w||0)+1; else q.b=(q.b||0)+1; S.me.prank_left=Math.max(0,(S.me.prank_left||0)-1); };
  }
  // 先播動畫、改畫面
  if(action==='steal'){ try{ farmerDo(i,'steal'); }catch(e){} sfx('steal'); }
  else if(action==='help_water') fxWater(i);
  else if(action.startsWith('help')) fxPoof(i, action==='help_bug'?'bug':'weed');
  else fxSmoke(i);
  if(action.startsWith('help')) floatAt(el, action==='help_weed'?'幫忙除草！':action==='help_bug'?'幫忙除蟲！':'幫忙澆水！', action==='help_water'?'#BDE6FF':null);
  else if(action!=='steal') floatAt(el, action==='prank_weed'?'放了一棵草 😈':'放了一隻蟲 😈', '#FFD6E5');
  optPlot(i, opt);
  const owner = V.owner.id;
  const r = await queueRpc('farm_friend_act', {p_owner:owner, p_action:action, p_idx:i}, r=>{ applyState(r.state); if(mode==='visit' && V && V.owner.id===owner){ applyVisit(r.visit); } refresh(); });
  if(!r) return;
  if(r.ab==='dog'){ sfx('err'); vib(60); floatAt(el, '被看門狗趕走了！🐶', '#FFD6E5'); }
  else if(r.ab==='scare'){ sfx('err'); floatAt(el, '被稻草人擋下了！🎃', '#FFD6E5'); }
  else if(action==='steal'){ fxSteal(i, c); floatAt(el, `偷到 ${c.name} ×${r.qty}`, '#FFE066'); }
  xpFloat(el, r.xp);
  if(r.lvup) setTimeout(showLevelUp, 400);
  if(r.gift) setTimeout(()=>showGift(r.gift), r.lvup?1600:500);
}

/* ================= 視窗：商店、倉庫、播種 ================= */
let SEED_KEEP = PREF('seedkeep', false);
function openSeedPicker(i){
  if(mode==='visit') return;
  const own = Object.entries(S.me.seeds).filter(([,n])=>n>0);
  if(!own.length) return modal('沒有種子', `<div class="empty">倉庫裡沒有種子了，<br>先去種子商店買一些吧！</div>`, [['去商店','o',()=>openShop()]]);
  const keep = `<label class="skeep${SEED_KEEP?' on':''}"><input type="checkbox" id="seedKeep" ${SEED_KEEP?'checked':''}><span><b>🔁 連續播種</b><br><small>${SEED_KEEP?'選一次後點空地就一直種同一種，想換就再點下面的「播種」':'沒打勾：每塊地都會問你要種什麼'}</small></span></label>`;
  const body = keep + own.map(([id,n])=>{ const c=CROP[id], cur=SEED_KEEP && ui.seed===id;
    return `<div class="row${cur?' scur':''}"><div class="ic">${iconSVG(c)}</div><div class="tx"><b>${c.name}</b> <span class="tag">×${n}</span>${cur?' <span class="tag" style="background:#E8F8EE;color:#2E9660">連續播種中</span>':''}<div>成熟 ${dur(c.time)}・收成 ${c.yield} 個</div></div><button class="mini" data-seed="${id}">${i==null?'選擇':'種下'}</button></div>`;
  }).join('');
  modal(i==null?'選擇要播的種子':'要種什麼？', body);
  $('seedKeep').onchange = e => { SEED_KEEP = e.target.checked; SETPREF('seedkeep', SEED_KEEP); openSeedPicker(i); };
  $('md').querySelectorAll('[data-seed]').forEach(b=>b.onclick=()=>{
    ui.seed = b.dataset.seed; setTool('seed'); closeModal();
    if(i!=null) plant(i, ui.seed);
    else toast(SEED_KEEP ? `連續播種：點空地就能一直種${CROP[ui.seed].name}` : `點空地種下${CROP[ui.seed].name}`);
    if(i!=null && SEED_KEEP) toast(`連續播種：接著點空地就能一直種${CROP[ui.seed].name}`);
  });
}
const barnNav = cur => `<div class="snav"><button data-bn="bag" class="${cur==='bag'?'on':''}">📦 倉庫</button><button data-bn="seed" class="${cur==='seed'?'on':''}">🌱 種子商店</button></div>`;
function bindBarnNav(){ document.querySelectorAll('[data-bn]').forEach(b=>b.onclick=()=> b.dataset.bn==='seed' ? openShop() : b.dataset.bn==='item' ? openItemShop() : openBag()); }
function openShop(){
  if(mode==='visit') return toast('回到自己的農場才能買東西');
  const me = S.me;
  const rLim = +(CFG_SET.rare_seed_daily ?? 3), rLeft = Math.max(0, rLim - dailyN(me,'rare_seed'));
  const rare = CROPS.filter(c=>c.rare).map(c=>`<div class="row rare"><div class="ic">${iconSVG(c)}</div>
      <div class="tx"><b>✨ ${c.name}</b><span class="tag">💎${c.seed_gems}</span>${(me.seeds[c.id]||0)?` <span class="tag">有 ${me.seeds[c.id]}</span>`:''}
      <div>成熟 ${dur(c.time)}・收成 ${c.yield}×${c.price} 金 = ${(c.yield*c.price).toLocaleString()} 金・經驗 ${c.exp}</div></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;max-width:130px">${[...new Set([1,Math.max(1,rLim)])].map(n=>`<button class="mini gem" data-buy="${c.id}" data-n="${n}" ${(me.gems||0)<c.seed_gems*n||n>rLeft?'disabled':''}>${n===1?'買1':'×'+n}</button>`).join(' ')}</div></div>`).join('');
  const body = `<div class="sec">✨ 稀有種子（鑽石購買，4 種合計每天限買 ${rLim} 顆，今天還能買 ${rLeft} 顆）</div>` + rare + `<div class="sec">一般種子</div>` + CROPS.filter(c=>!c.rare).map(c=>{
    const locked = me.lv < c.lv;
    const btn = locked ? `<span class="lock">Lv${c.lv} 解鎖</span>`
      : [1,5,10].map(n=>`<button class="mini ${n===1?'':'o'}" data-buy="${c.id}" data-n="${n}" ${me.gold<c.seed*n?'disabled':''}>${n===1?'買1':'×'+n}</button>`).join(' ');
    return `<div class="row" style="${locked?'opacity:.55':''}"><div class="ic">${iconSVG(c)}</div>
      <div class="tx"><b>${c.name}</b><span class="tag">${c.seed} 金</span>
      <div>成熟 ${dur(c.time)}・收成 ${c.yield}×${c.price} 金 = ${c.yield*c.price} 金</div></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;max-width:130px">${btn}</div></div>`;
  }).join('');
  modal(`穀倉　<span style="font-size:14px;color:var(--ink2)">金幣 ${me.gold}</span>`, barnNav('seed')+body); bindBarnNav();
  $('md').querySelectorAll('[data-buy]').forEach(b=>b.onclick=async()=>{
    const c = CROP[b.dataset.buy], n = +b.dataset.n;
    const r = await doAct('buy', null, c.id, n);
    if(r){ sfx('coin'); toast(`買了 ${n} 包${c.name}種子`); ui.seed = c.id; openShop(); }
  });
}
function openBag(){
  if(mode==='visit') return toast('回到自己的農場才能打開倉庫');
  const me = S.me;
  const cr = Object.entries(me.crops).filter(([,n])=>n>0);
  const sd = Object.entries(me.seeds).filter(([,n])=>n>0);
  const total = cr.reduce((a,[id,n])=>a+n*CROP[id].price, 0);
  let body = barnNav('bag')+`<div class="sec">作物</div>`;
  body += cr.length ? cr.map(([id,n])=>{ const c=CROP[id];
    return `<div class="row"><div class="ic">${iconSVG(c)}</div><div class="tx"><b>${c.name}</b> <span class="tag">×${n}</span><div>每個 ${c.price} 金・共 ${n*c.price} 金</div></div>
      <button class="mini o" data-sell="${id}">全部賣出</button></div>`; }).join('')
    : `<div class="empty">還沒有收成的作物</div>`;
  body += `<div class="sec">種子</div>`;
  body += sd.length ? sd.map(([id,n])=>{ const c=CROP[id];
    return `<div class="row"><div class="ic">${iconSVG(c)}</div><div class="tx"><b>${c.name}種子</b> <span class="tag">×${n}</span><div>成熟 ${dur(c.time)}</div></div><button class="mini" data-use="${id}">拿來種</button></div>`; }).join('')
    : `<div class="empty">沒有種子</div>`;
  body += goodsHTML(me);
  modal('穀倉', body, cr.length?[[`一鍵全部賣出（${total} 金）`,'o',async()=>{ const r=await doAct('sell_all'); if(r){ sfx('coin'); toast(`全部賣出，獲得 ${r.amt} 金`); closeModal(); } }]]:null); bindBarnNav();
  $('md').querySelectorAll('[data-sell]').forEach(b=>b.onclick=async()=>{
    const id=b.dataset.sell; const r = await doAct('sell', null, id);
    if(r){ sfx('coin'); toast(`賣出 ${CROP[id].name}，獲得 ${r.amt} 金`); openBag(); }
  });
  if($('sellGoods')) $('sellGoods').onclick=()=>ranchAct('sell_goods');
  $('md').querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>{ ui.seed=b.dataset.use; setTool('seed'); closeModal(); toast(`點空地就能種下${CROP[ui.seed].name}`); });
}
async function openHome(){
  if(mode==='visit') return toast('這是好友的家喔');
  const {data:{user}} = await sb.auth.getUser();
  modal(`🏠 ${esc(S.me.nickname)}的家`, `<div class="homebtns"><button class="btn" id="hPlace">🖐️ 擺放城鎮</button><button class="btn sub" id="hCos">🏷️ 稱號・頭像框</button></div>
    <div class="sec">成就（拿鑽石）</div>${achHTML(S.me)}`);
  if($('hAch')) $('hAch').onclick = ()=>openAchs();
  if($('hCos')) $('hCos').onclick = ()=>openCos();
  if($('hPlace')) $('hPlace').onclick = ()=>{ closeModal(); enterDecorEdit(); };
}
/* ================= 設定頁 ================= */
async function openSettings(){
  const {data:{user}} = await sb.auth.getUser(); const me=S.me;
  let body = `<div class="sec">帳號</div>
    <div style="display:flex;align-items:center;gap:12px;margin-top:6px">${avImg(me,'avatar')}<div style="font-weight:800;line-height:1.6">${esc(me.nickname)}・Lv${me.lv}<br><span style="color:var(--ink2);font-size:13px">${esc(acctLabel(user))}</span></div></div>
    ${user && user.is_anonymous ? `<div class="guestbox"><b>⚠️ 試玩中</b>：清除瀏覽器資料或換手機，進度就會不見。綁定帳號後進度、鑽石全部保留，也才能儲值。
      <div class="homebtns"><button class="btn o" id="sBind">🔒 綁定帳號（保留進度）</button>${GOOGLE_ON?'<button class="btn sub" id="sBindG">用 Google 綁定</button>':''}</div></div>` : ''}
    <div class="homebtns"><button class="btn sub" id="sSwitch">🔄 切換帳號</button><button class="btn sub" id="sOut" style="background:#F2545B;color:#fff;box-shadow:0 3px 0 #C23A40">登出</button></div>
    <div class="sec">遊戲設定</div>
    <div class="seg" style="margin-top:6px"><button id="tBgm" class="${BGM_ON?'on':''}">🎵 音樂</button><button id="tSfx" class="${SFX_ON?'on':''}">🔊 音效</button><button id="tVib" class="${VIB_ON?'on':''}">📳 震動</button><button id="tLow" class="${LOWFX?'on':''}">🔋 省電模式</button></div>
    <div class="rhint">手機容易發燙或耗電快，可以開「🔋 省電模式」：畫面更新變慢、關掉裝飾動畫和大部分特效</div>
    <div class="homebtns"><button class="btn o" id="sA2hs">📱 加到桌面</button><button class="btn sub" id="sInv">💌 邀請朋友</button></div>
    ${pushBoxHTML()}
    <div class="sec">兌換碼</div><div class="redeem"><input id="rCode" placeholder="輸入兌換碼" maxlength="20" autocomplete="off"><button class="btn" id="rGo">兌換</button></div>`;
  if(me.admin) body += `<div class="sec">🛠️ 管理員</div><div class="admbox">
    <div class="admrow"><span>等級</span><input id="aLv" type="number" min="1" max="30" value="${me.lv}"><span>金幣</span><input id="aGold" type="number" min="0" value="${me.gold}"><span>鑽石</span><input id="aGems" type="number" min="0" value="${me.gems||0}"></div>
    <div class="admquick"><button class="mini" data-q="lv">等級 30</button><button class="mini" data-q="gold">金幣 +10萬</button><button class="mini" data-q="gems">鑽石 +1000</button><button class="mini o" data-q="seeds">每種種子 +20</button></div>
    <div class="homebtns"><button class="btn" id="aSave">儲存</button><a class="btn sub" href="admin.html" target="_blank" style="text-align:center;text-decoration:none">營運後台</a></div>
    <div class="rhint">只會改到你自己的帳號，每次修改都記錄在後台的操作紀錄</div></div>`;
  body += `<div style="text-align:center;margin-top:12px"><a class="plink" href="privacy.html" target="_blank" rel="noopener">隱私權政策</a></div>`;
  modal('設定', body); renderPushBox();
  $('tBgm').onclick = ()=>{ BGM_ON=!BGM_ON; SETPREF('bgm',BGM_ON); bgmSync(); openSettings(); };
  $('tSfx').onclick = ()=>{ SFX_ON=!SFX_ON; SETPREF('sfx',SFX_ON); if(SFX_ON) sfx('coin'); openSettings(); };
  $('tVib').onclick = ()=>{ VIB_ON=!VIB_ON; SETPREF('vib',VIB_ON); vib(30); openSettings(); };
  $('tLow').onclick = ()=>{ LOWFX=!LOWFX; SETPREF('low',LOWFX); document.body.classList.toggle('lowfx',LOWFX); openSettings(); };
  $('sInv').onclick = invite; $('sA2hs').onclick = openA2HS;
  $('rGo').onclick = async()=>{ const c=$('rCode').value.trim(); if(!c) return toast('請輸入兌換碼');
    try{ const r=await rpc('farm_redeem',{p_code:c}); applyState(r.state); refresh(); sfx('lvup'); fxConfetti(); closeModal(); modal('🎁 兌換成功！', `<div class="rwbox">${rewardHTML(r.reward)}</div>`); if(r.gift) toast(r.gift); }catch(e){ toast(e.message); } };
  if($('sBind')) $('sBind').onclick = openBind;
  if($('sBindG')) $('sBindG').onclick = async()=>{ const {error} = await sb.auth.linkIdentity({provider:'google', options:{redirectTo:SITE_URL}}); if(error) toast(/manual linking/i.test(error.message)?'伺服器還沒開啟 Google 綁定':zhErr(error.message)); };
  $('sOut').onclick = async()=>{ if(user && user.is_anonymous && !confirm('試玩帳號登出後就找不回來了，確定要登出嗎？')) return; closeModal(); await sb.auth.signOut(); };
  $('sSwitch').onclick = async()=>{ closeModal(); await sb.auth.signOut(); toast('已登出，請用另一個帳號登入'); };
  if(me.admin){
    const save = async(lv,gold,gems)=>{ try{ const old=S.me.lv; applyState(await rpc('adm_self_set',{p_lv:lv,p_gold:gold,p_gems:gems})); refresh(); sfx('coin'); toast('已更新'); if(S.me.lv!==old) loadConfig(); openSettings(); }catch(e){ toast(e.message); } };
    $('aSave').onclick = ()=>save(+$('aLv').value, +$('aGold').value, +$('aGems').value);
    document.querySelectorAll('[data-q]').forEach(b=>b.onclick=async()=>{ const q=b.dataset.q;
      if(q==='lv') return save(30, me.gold, me.gems||0);
      if(q==='gold') return save(me.lv, me.gold+100000, me.gems||0);
      if(q==='gems') return save(me.lv, me.gold, (me.gems||0)+1000);
      try{ for(const c of CROPS) await rpc('adm_give',{p_id:me.id,p_crop:c.id,p_seeds:20,p_reason:'管理員自己測試'}); applyState(await rpc('farm_me')); refresh(); toast('每種種子 +20'); }catch(e){ toast(e.message); } });
  }
}
const esc = s => String(s).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

/* ================= 好友廣場 ================= */
let boardTab = 'friends', rankScope = 'f', rankKind = 'lv';
function ago(ms){ const s=Math.max(0,(Date.now()+(S?S.off:0)-ms)/1000); if(s<60) return '剛剛'; if(s<3600) return `${Math.floor(s/60)} 分鐘前`; if(s<86400) return `${Math.floor(s/3600)} 小時前`; return `${Math.floor(s/86400)} 天前`; }
const LOG_TXT = {
  party: l=>`來參加你的派對 🎉，你們都拿到經驗`,help_water:(l)=>`幫你的${CROP[l.crop]?.name||'作物'}澆了水`, steal:(l)=>`偷走了你 ${l.qty} 個${CROP[l.crop]?.name||''}`, help_weed:(l)=>`幫你的${CROP[l.crop]?.name||'作物'}除了草`, help_bug:(l)=>`幫你的${CROP[l.crop]?.name||'作物'}除了蟲`,
  prank_weed:(l)=>`在你的${CROP[l.crop]?.name||'田'}放了一棵草 😈`, prank_bug:(l)=>`在你的${CROP[l.crop]?.name||'田'}放了一隻蟲 😈`,
  r_steal:(l)=>`偷走了你牧場的 ${l.qty} 個${(ANIMALS.find(a=>a.good===l.crop)||{}).good_name||'產品'}`, r_feed:(l)=>`幫你餵了${(ANI[l.crop]||{}).name||'動物'} 🌾`, r_swat:(l)=>`幫你的${(ANI[l.crop]||{}).name||'動物'}拍掉蚊子`, r_prank:(l)=>`在你的${(ANI[l.crop]||{}).name||'動物'}旁邊放了蚊子 😈`,
  dog:(l)=>`想偷你的${CROP[l.crop]?.name||'作物'}，被看門狗趕走了 🐶`, scare:(l)=>`想惡作劇，被稻草人擋下了 🎃`, auto_harvest:(l)=>`幫你自動收成了 ${l.qty} 個${CROP[l.crop]?.name||''} 🧺`, auto_collect:(l)=>`幫你自動收了牧場的 ${l.qty} 個${(ANIMALS.find(a=>a.good===l.crop)||{}).good_name||'產品'} 🧺`};

async function openBoard(tab){
  if(tab) boardTab = tab;
  modal('好友廣場', `<div class="empty">讀取中…</div>`);
  let F, logs, R, NB;
  try{ [F, logs, R] = await Promise.all([rpc('farm_friends'), boardTab==='logs'?rpc('farm_logs_get'):[], boardTab==='rank'?(rankKind==='lv'?rpc('farm_rank'):rpc('farm_rank_by',{p_kind:rankKind})):null]);
    if(boardTab==='near') NB = await rpc('farm_neighbors');
    if(boardTab==='logs'){ stealSeen(logs); $('stealAlert').classList.remove('show'); } }
  catch(e){ return modal('好友廣場', `<div class="empty">${esc(e.message)}</div>`); }
  const nIn = F.incoming.length;
  const tabs = `<div class="tabs">
    <button data-tab="friends" class="${boardTab==='friends'?'on':''}">好友</button>
    <button data-tab="add" class="${boardTab==='add'?'on':''}">加好友${nIn?` <i class="dot">${nIn}</i>`:''}</button>
    <button data-tab="near" class="${boardTab==='near'?'on':''}">鄰居</button>
    <button data-tab="rank" class="${boardTab==='rank'?'on':''}">排行</button>
    <button data-tab="logs" class="${boardTab==='logs'?'on':''}">動態${stealNew?`<i class="nbadge">${stealNew}</i>`:''}</button></div>`;
  let body = '';
  if(boardTab==='friends'){
    body = F.friends.length ? F.friends.map(f=>`<div class="row">
        ${avImg(f)}
        <div class="tx"><b>${esc(f.nickname)}</b>${ttlTag(f)} <span class="tag">Lv${f.lv}</span>
          <div>${(f.ripe||f.bin)?`<span style="color:var(--orange-d)">${f.ripe?`🥕 有 ${f.ripe} 塊地可以偷`:''}${f.ripe&&f.bin?'・':''}${f.bin?'🧺 收集倉可以偷':''}</span>`:'目前沒有可偷的菜'}${f.issues?`・🐛 需要幫忙 ${f.issues}`:''}</div></div>
        <div class="ibtns"><button class="mini ${(f.ripe||f.bin)?'o':''}" data-visit="${f.id}">拜訪</button><button class="mini sub" data-gift="${f.id}" data-gn="${esc(f.nickname)}">💌 送禮</button></div></div>`).join('')
      : `<div class="empty">還沒有好友，<br>到「加好友」輸入朋友的暱稱吧！</div><button class="btn o" id="invBtn" style="width:100%">💌 邀請朋友來玩</button>`;
  } else if(boardTab==='add'){
    body = `<button class="btn o" id="invBtn" style="width:100%;margin:4px 0 6px">💌 邀請朋友來玩</button><div class="sec">用暱稱加好友</div>
      <div style="display:flex;gap:8px;margin-top:6px"><input id="fnick" class="inp" maxlength="10" placeholder="輸入朋友的暱稱"><button class="mini" id="fsend" style="padding:0 16px">送出</button></div>
      <div style="font-size:12px;color:var(--ink2);font-weight:700;margin-top:6px">你的暱稱是「${esc(S.me.nickname)}」，把它告訴朋友吧</div>`;
    body += `<div class="sec">等你確認的邀請</div>` + (F.incoming.length ? F.incoming.map(f=>`<div class="row">
        ${avImg(f)}<div class="tx"><b>${esc(f.nickname)}</b>${ttlTag(f)} <span class="tag">Lv${f.lv}</span><div>想成為你的好友</div></div>
        <button class="mini" data-acc="${f.id}">接受</button><button class="mini sub" data-rej="${f.id}">拒絕</button></div>`).join('') : `<div class="empty" style="padding:10px 0">沒有新的邀請</div>`);
    if(F.outgoing.length) body += `<div class="sec">已送出、等對方確認</div>` + F.outgoing.map(f=>`<div class="row">${avImg(f)}<div class="tx"><b>${esc(f.nickname)}</b><div>等待確認中</div></div></div>`).join('');
  } else if(boardTab==='near'){
    body = `<div style="font-size:12px;color:var(--ink2);font-weight:700;margin:2px 0 6px">隨機列出小鎮上的玩家，不是好友也能偷菜、惡作劇（偷陌生人要用偷菜體力：<b style="color:var(--orange-d)">⚡${S.me.steal_left}</b>${S.me.steal_max?' / '+S.me.steal_max:''}${stealRegenTxt(S.me)}）</div>`;
    body += NB.length ? NB.map(f=>`<div class="row">${avImg(f)}
        <div class="tx"><b>${esc(f.nickname)}</b>${ttlTag(f)} <span class="tag">Lv${f.lv}</span>${f.friend?' <span class="tag">好友</span>':''}
          <div>${(f.ripe||f.bin)?`<span style="color:var(--orange-d)">${f.ripe?`🥕 有 ${f.ripe} 塊地可以偷`:''}${f.ripe&&f.bin?'・':''}${f.bin?'🧺 收集倉可以偷':''}</span>`:'目前沒有可偷的菜'}</div></div>
        <button class="mini ${(f.ripe||f.bin)?'o':''}" data-visit="${f.id}">拜訪</button></div>`).join('') + `<button class="btn sub" id="nbMore" style="width:100%;margin-top:8px">換一批</button>`
      : `<div class="empty">附近還沒有其他玩家種菜，<br>邀請朋友一起來玩吧！</div><button class="btn o" id="invBtn" style="width:100%">💌 邀請朋友來玩</button>`;
  } else if(boardTab==='rank'){
    const medal = r => r===1?'🥇':r===2?'🥈':r===3?'🥉':r;
    const val = x => rankKind==='gold' ? `💰 ${(+x.sc).toLocaleString()} 金` : rankKind==='pros' ? `🏙️ 繁榮度 ${(+x.sc).toLocaleString()}` : rankKind==='steal' ? `🥕 ${(+x.sc).toLocaleString()} 金・${(+x.n||0)} 次` : `Lv${x.lv}`;
    const row = (rk, x) => `<div class="row rk${x.me?' mine':''}"${x.me?'':` data-visit="${x.id}" style="cursor:pointer"`}><div class="rkn">${medal(rk)}</div>${avImg(x)}
        <div class="tx"><b>${esc(x.nickname)}</b>${ttlTag(x)}${x.me?' <span class="tag">我</span>':''}<div>${rankKind==='lv'?`經驗 ${x.exp}`:`Lv${x.lv}`}</div></div><span class="tag" style="font-size:13px">${val(x)}</span></div>`;
    body = `<div class="seg rkk" style="margin:4px 0 6px">${[['lv','🏆 等級'],['gold','💰 財富'],['pros','🏙️ 繁榮'],['steal','🥕 偷菜']].map(([k,t])=>`<button data-rk="${k}" class="${rankKind===k?'on':''}">${t}</button>`).join('')}</div>`
      + (rankKind==='pros' ? `<div class="rhint" style="margin-bottom:6px">繁榮度：寵物、寵物造型、建築外觀、城鎮色調、裝飾、裝備階數、開墾的田地越多越高</div>` : rankKind==='steal' ? `<div class="rhint" style="margin-bottom:6px">比偷到的東西總價值（田地、收集倉、牧場都算），一樣多再比偷的次數</div>` : '');
    body += `<div class="seg" style="margin:4px 0 6px"><button data-rs="f" class="${rankScope==='f'?'on':''}">好友排行</button><button data-rs="a" class="${rankScope==='a'?'on':''}">全服前 50 名</button></div>`;
    if(rankScope==='f') body += R.friends.map((x,k)=>row(k+1, x)).join('') + (R.friends.length<2?`<div class="empty" style="padding:10px 0">加更多好友一起比賽吧！</div>`:'');
    else body += R.top.map(x=>row(x.rk, x)).join('');
    body += `<div class="myrank">你在全服排第 <b>${R.my_rank}</b> 名（共 ${R.total} 位玩家）</div>`;
  } else {
    const BAD = {steal:1, r_steal:1, dog:1, prank_weed:1, prank_bug:1, r_prank:1, scare:1};
    body = logs.length ? logs.map(l=>{ const bad=BAD[l.kind], theft=l.kind==='steal'||l.kind==='r_steal', can=l.aid && l.aid!==S.me.id && bad;
      return `<div class="row${theft?' lsteal':bad?' lbad':''}"><div class="avatar sm" style="background:${l.kind.startsWith('prank')||l.kind==='r_prank'?'#F78FB3':theft?'#F2545B':l.kind==='dog'?'#FF9F43':'#3BB273'}">${theft?'🦹':esc((l.who||'?').slice(0,1))}</div>
        <div class="tx"><b>${esc(l.who||'')}</b> ${(LOG_TXT[l.kind]||(()=>''))(l)}<div>${ago(l.at)}</div></div>${can?`<button class="mini revenge" data-visit="${l.aid}">😤 復仇</button>`:''}</div>`; }).join('')
      : `<div class="empty">還沒有任何動態</div>`;
  }
  modal('好友廣場', tabs + body);
  const md = $('md');
  md.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>openBoard(b.dataset.tab));
  md.querySelectorAll('[data-rs]').forEach(b=>b.onclick=()=>{ rankScope=b.dataset.rs; openBoard('rank'); });
  md.querySelectorAll('[data-rk]').forEach(b=>b.onclick=()=>{ rankKind=b.dataset.rk; openBoard('rank'); });
  if($('nbMore')) $('nbMore').onclick = ()=>openBoard('near');
  md.querySelectorAll('[data-visit]').forEach(b=>b.onclick=()=>visit(b.dataset.visit));
  md.querySelectorAll('[data-gift]').forEach(b=>b.onclick=()=>openGiftFriend(b.dataset.gift, b.dataset.gn));
  md.querySelectorAll('[data-acc]').forEach(b=>b.onclick=async()=>{ try{ toast(await rpc('farm_friend_respond',{p_from:b.dataset.acc,p_accept:true})); openBoard(); }catch(e){ toast(e.message); } });
  md.querySelectorAll('[data-rej]').forEach(b=>b.onclick=async()=>{ try{ toast(await rpc('farm_friend_respond',{p_from:b.dataset.rej,p_accept:false})); openBoard(); }catch(e){ toast(e.message); } });
  if($('invBtn')) $('invBtn').onclick = invite;
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
  if(id==='bin') return openBin();
  if(mode==='visit' && ['shop','barn','home','decor'].includes(id)) return toast('回到自己的農場才能使用');
  if(id==='shop') return openShopTab('decor');
  if(id==='barn') return openBag();
  if(id==='home') return openHome();
  if(id==='coop') return openRanch();
  if(id==='decor') return openPetShop();
  if(id==='pen') return openBeastPark();
  const o = BLD.find(b=>b.id===id); if(o && o.locked) toast(o.locked);
}

/* ================= 畫面 ================= */
const TOOLS_FRIEND = [['steal','偷菜'],['hwater','幫澆水'],['hweed','幫除草'],['hbug','幫除蟲'],['pweed','放草'],['pbug','放蟲']];
const TOOLS_STRANGER = [['steal','偷菜'],['pweed','放草'],['pbug','放蟲']];
ICONS.steal = `<svg viewBox="0 0 32 32"><path d="M9 14 Q8 6 13 6 L13 15 M13 8 Q13 4 17 4 Q19 4 19 8 L19 15 M19 8 Q19 5 22 5.5 Q24 6 24 9 L24 16 Q24 26 16 27 Q9 27 7 20 L5 15 Q5 12 8 13 L10 17" fill="#FFD7B5" stroke="#C98B5E" stroke-width="1.6" stroke-linejoin="round"/><circle cx="25" cy="24" r="5" fill="#F2545B"/></svg>`;
ICONS.hweed = ICONS.weed; ICONS.hbug = ICONS.bug; ICONS.hwater = ICONS.water;
ICONS.pweed = `<svg viewBox="0 0 32 32"><path d="M8 26 L4 12 L10 20 L12 6 L15 20 L20 10 L18 26Z" fill="#3E9B3E"/><circle cx="23" cy="22" r="7" fill="#F78FB3"/><path d="M20 22 h6 M23 19 v6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`;
ICONS.pbug = `<svg viewBox="0 0 32 32"><g transform="translate(12 16) scale(1.5)"><ellipse rx="6" ry="4.5" fill="#7A4F2A"/><circle cx="-6" cy="-1" r="3" fill="#4E331C"/><circle cx="-2.5" cy="-1.5" r="1.1" fill="#F4C27A"/><circle cx="2.5" cy="1.5" r="1.1" fill="#F4C27A"/></g><circle cx="24" cy="23" r="7" fill="#F78FB3"/><path d="M21 23 h6 M24 20 v6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`;

function buildTools(){
  const list = mode==='visit' ? (V && V.friend ? TOOLS_FRIEND : TOOLS_STRANGER) : TOOLS;
  $('tools').style.gridTemplateColumns = `repeat(${list.length},1fr)`;
  $('tools').innerHTML = list.map(([k,n])=>`<button class="tool" data-tool="${k}">${ICONS[k]}<span>${n}</span>${k==='seed'?'<span class="badge" id="seedBadge"></span>':''}${k==='pweed'?'<span class="badge" id="prankBadge"></span>':''}</button>`).join('');
  $('tools').querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{
    if(b.dataset.tool==='seed') return openSeedPicker(null);
    if(b.dataset.tool==='bag') return openPack();
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
          else { txt='可以偷！'; bg='#F2545B'; fg='#fff'; }
        } else { txt='可收成！'; bg='#FF9F43'; fg='#fff'; }
      } else { txt = fmtS(leftSec(p)); if(p.dry) bg='#DDF0FF'; }
      // 血條＝作物完整度：雜草、蟲越多收成越少（最多少 4 成），滿血＝沒被破壞
      if(!(mode==='visit' && st===4)){ const maxLoss=Math.max(1, c.yield - Math.ceil(c.yield*0.6)), lost=Math.min(maxLoss, (p.w||0)+(p.b||0)); pct = 1 - lost/maxLoss; }
    }
    if(t.textContent !== txt){ t.textContent = txt; const w=[...txt].reduce((a,ch)=>a+(ch.charCodeAt(0)>255?15:8.5),0)+20; r.setAttribute('width', w.toFixed(0)); r.setAttribute('x', (-w/2).toFixed(0)); }
    r.setAttribute('fill', bg); t.setAttribute('fill', fg); t.setAttribute('stroke', fg==='#fff' ? '#3A3226' : '#fff'); t.setAttribute('y', pct>=0?2:5);
    bb.style.display = bf.style.display = pct>=0 ? '' : 'none';
    if(pct>=0){ bf.setAttribute('width', (60*Math.max(0.02,pct)).toFixed(1)); bf.setAttribute('fill', pct>0.66?'#4CC26A':pct>0.33?'#F5B731':'#F2545B'); bb.setAttribute('fill', pct<1?'#F7D2D2':'#E6EEDF'); }
  });
}
function renderHUD(){
  if(!S) return;
  const me = S.me;
  { const nh=esc(me.nickname)+ttlTag(me); if($('pname').innerHTML!==nh) $('pname').innerHTML=nh; } const avs = avSrc(me.avatar); if(!$('avatar').src.endsWith(avs)) $('avatar').src = avs; $('avatar').className='avatar avimg'+(me.frame?' fr '+me.frame:'');
  $('plv').textContent = 'Lv'+me.lv; tweenNum($('pgold'), me.gold);
  const need = needExp(me.lv);
  $('pexp').style.width = (me.lv>=MAX_LV?100:Math.min(100, me.exp/need*100))+'%';
  $('pexpt').textContent = me.lv>=MAX_LV ? 'MAX' : `${me.exp}/${need}`;
  tweenNum($('pgems'), me.gems||0);
  const n = Object.values(me.seeds).reduce((a,b)=>a+b,0);
  const bd = $('seedBadge'); if(bd){ bd.textContent=n; bd.style.display=n?'':'none'; }
  const pb = $('prankBadge'); if(pb){ pb.textContent=me.prank_left; }
  const PL = curPlots(); let h;
  if(mode==='visit'){
    const can = PL.filter(p=>p.s==='grow' && p.g>=CROP[p.c].time && !p.mine && p.st<p.cap).length;
    h = `你在 <b>${esc(V.owner.nickname)}</b>${ttlTag(V.owner)}（Lv${V.owner.lv}${V.friend?'・好友':''}）的農場・`;
    if(V.protected) h += '對方在<b>新手保護</b>中，不能偷菜和惡作劇';
    else { const vb=V.bin||{}, binOk=binCount(vb.items)>0 && !vb.mine && vb.left>0;
      h += (can ? `有 <b>${can}</b> 塊地可以偷！` : binOk ? '' : `惡作劇體力 😈${me.prank_left}${me.prank_max?'/'+me.prank_max:''}${regenTxt(me,'prank')}`) + (binOk ? `<b>收集倉</b>也可以偷！` : '') + (V.friend ? '' : `（偷菜體力 ⚡${me.steal_left}${me.steal_max?'/'+me.steal_max:''}${stealRegenTxt(me)}）`); }
    setHint(`<span>🧺</span><span>${h}</span>`); return;
  }
  const bn=binCount(me.bin), hungry=(S.ranch||[]).filter(r=>!r.ra).map(r=>(ANI[r.k]||{}).feed||0), crops=Object.values(me.crops||{}).reduce((a,b)=>a+b,0);
  if(hungry.length && crops < Math.min(...hungry) && bn>0) h=`🐔 穀倉的作物不夠餵牧場了！記得點<b>收集倉</b>把東西<b>收進穀倉</b>`;
  else if(bn>0) h=`🧺 <b>收集倉</b>有 ${bn} 個東西，記得點收集倉<b>收進穀倉</b>，避免被偷！`;
  else if(PL.some(p=>p.s==='grow'&&stageOf(p)===4)) h='有作物<b>成熟</b>了，快收成，小心被好友偷走！';
  else if(PL.some(p=>p.s==='grow'&&(p.w||p.b))) h='田裡長了<b>雜草或蟲</b>，不處理會減少收成';
  else if(PL.some(isDry)) h='有田地<b>缺水</b>了，澆水才能長得快';
  else if(PL.some(p=>p.s==='dead')) h='收成後的枯萎作物，用<b>鏟子</b>剷除就能再種';
  else if(PL.some(p=>p.s==='empty')) h = n?'點<b>空地</b>選種子種下去吧':'沒有種子了，到<b>穀倉的種子商店</b>買一些吧';
  else { const a=autoProgress(me);
    h = (a.pets<9||a.funcs<9) ? `🤖 寵物 ${a.pets}/9・裝備 ${a.funcs}/9 種：開滿 9 隻寵物、插上 9 種裝備，打造<b>全自動農場</b>，休息時間也在賺錢！` : '作物正在長大中…去<b>好友廣場</b>看看誰的菜可以偷'; }
  setHint(`<span>🌱</span><span>${h}</span>`);
}
/* 提示欄：內容變了才閃現 4 秒，然後自動收起 */
let hintLast='', hintT=null;
function setHint(html){ if(html===hintLast) return; hintLast=html; const el=$('hint'); el.innerHTML=html; el.classList.remove('hide'); clearTimeout(hintT); hintT=setTimeout(()=>el.classList.add('hide'), 4000); }
function refresh(){ renderPlots(); renderHUD(); try{ setHomeLabel(); setBinLabel();  syncParty(); if(mode==='visit' && V){ applySkins(V.owner.skin_on); applyTone(V.owner.tone); } else if(S){ applySkins(S.me.skin_on); applyTone(S.me.tone); } syncRanchMovers(); setCoopDot(); syncParkMovers(); renderDecor(); signBadge(); spinBadge(); $('bSign').style.display = $('bSpin').style.display = $('bBag').style.display = $('bPals').style.display = mode==='visit'?'none':''; }catch(e){} }

/* ================= 同步 ================= */
let syncing = false;
async function sync(){
  if(!S || syncing || document.hidden || actPending>0) return;
  syncing = true;
  try{
    if(mode==='visit' && V) applyVisit(await rpc('farm_visit', {p_owner:V.owner.id}));
    else { const st = await rpc('farm_me'); if(st){ applyState(st); dailyToast(st); } }
    refresh();
  }catch(e){ if(/還不是好友/.test(e.message)){ toast(e.message); goHome(); } }
  finally{ syncing = false; }
}
setInterval(()=>{ if(S && $('map').style.display!=='none'){ renderPlots(); renderHUD(); try{ syncRanchMovers(); setCoopDot(); syncParkMovers(); }catch(e){} } }, 1000);
setInterval(sync, 15000);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) sync(); });

/* ================= 登入流程 ================= */
let authMode = 'login';
function showScreen(which){
  $('login').style.display = (which==='login'||which==='nick') ? 'flex' : 'none';
  $('loginCard').style.display = which==='login' ? '' : 'none';
  $('nickCard').style.display = which==='nick' ? '' : 'none';
  ['map','hud','dock'].forEach(k=>$(k).style.display = which==='game' ? '' : 'none');
  document.body.classList.toggle('ingame', which==='game'); setTimeout(()=>{ try{ panSync(); }catch(e){} }, 300);
}
function setAuthMode(m){
  authMode = m;
  document.querySelectorAll('[data-am]').forEach(b=>b.classList.toggle('on', b.dataset.am===m));
  $('authBtn').textContent = m==='login' ? '登入' : '註冊新帳號';
  $('pw2').style.display = m==='signup' ? '' : 'none';
  $('authMsg').textContent = '';
}
function authMsg(t, ok){ const m=$('authMsg'); m.textContent=t; m.style.color = ok?'var(--green-d)':'var(--red)'; }

/* 帳號密碼：沒有 @ 的帳號會對應成內部信箱（不會寄信） */
const ACCT_DOMAIN = '@player.farm-together.app';
const isAcctMail = e => String(e||'').toLowerCase().endsWith(ACCT_DOMAIN);
function acctToEmail(v, signup){
  v = String(v||'').trim();
  if(v.includes('@')) return v;
  const u = v.toLowerCase();
  if(!/^[a-z0-9_]{4,16}$/.test(u)) return signup ? null : u + ACCT_DOMAIN;
  return u + ACCT_DOMAIN;
}
async function doAuth(){
  const raw = $('email').value.trim(), pw = $('pw').value;
  if(!raw || !pw) return authMsg('請輸入帳號（或 Email）和密碼');
  const email = acctToEmail(raw, authMode==='signup');
  if(!email) return authMsg('帳號要 4–16 個英文小寫、數字或底線');
  const btn = $('authBtn'); btn.disabled = true;
  try{
    if(authMode==='signup'){
      if(pw.length < 6) return authMsg('密碼至少要 6 個字');
      if(pw !== $('pw2').value) return authMsg('兩次輸入的密碼不一樣');
      const {data, error} = await sb.auth.signUp({email, password:pw, options:{emailRedirectTo:SITE_URL}});
      if(error) return authMsg(zhErr(error.message));
      if(data.user && data.user.identities && data.user.identities.length===0) return authMsg('這個帳號已經有人使用了，請直接登入');
      if(!data.session) return authMsg(isAcctMail(email) ? '伺服器還沒開啟帳號密碼註冊，請先用試玩或 Google' : `驗證信已寄到 ${email}，請點信中的連結完成註冊`, !isAcctMail(email));
    } else {
      const {error} = await sb.auth.signInWithPassword({email, password:pw});
      if(error) return authMsg(zhErr(error.message));
    }
  } finally { btn.disabled = false; }
}
async function forgotPw(){
  const email = $('email').value.trim();
  if(!email) return authMsg('請先在上面輸入你的 Email');
  if(!email.includes('@')) return authMsg('用帳號註冊的沒有綁 Email，沒辦法寄信重設密碼，請聯絡客服');
  const {error} = await sb.auth.resetPasswordForEmail(email, {redirectTo:SITE_URL});
  if(error) return authMsg(zhErr(error.message));
  authMsg(`重設密碼的信已寄到 ${email}`, true);
}
function showResetPw(){
  modal('設定新密碼', `<input id="npw" class="inp" type="password" placeholder="新密碼（至少 6 個字）" style="width:100%">`,
    [['確定','',async()=>{ const v=$('npw').value; if(v.length<6) return toast('密碼至少要 6 個字');
      const {error} = await sb.auth.updateUser({password:v}); if(error) return toast(zhErr(error.message)); closeModal(); toast('密碼已更新'); }]]);
}
/* 帳號顯示、試玩綁定 */
function acctLabel(u){ if(!u) return ''; if(u.is_anonymous) return '試玩帳號（還沒綁定）'; const e=u.email||''; if(isAcctMail(e)) return '帳號：' + e.slice(0, -ACCT_DOMAIN.length); return e || 'Google 帳號'; }
function openBind(){
  modal('🔒 綁定帳號', `<div class="rhint">設定帳號和密碼，之後換手機用這組帳號登入就能找回進度。</div>
    <input id="bdU" class="inp" placeholder="帳號（4–16 個英文小寫、數字或底線）" maxlength="16" autocapitalize="off" spellcheck="false" style="width:100%;margin-top:6px">
    <input id="bdP" class="inp" type="password" placeholder="密碼（至少 6 個字）" style="width:100%;margin-top:6px">
    <input id="bdP2" class="inp" type="password" placeholder="再輸入一次密碼" style="width:100%;margin-top:6px">`,
    [['取消','sub',()=>openSettings()],['綁定','',async()=>{
      const u=$('bdU').value.trim().toLowerCase(), p=$('bdP').value;
      if(!/^[a-z0-9_]{4,16}$/.test(u)) return toast('帳號要 4–16 個英文小寫、數字或底線');
      if(p.length<6) return toast('密碼至少要 6 個字'); if(p!==$('bdP2').value) return toast('兩次輸入的密碼不一樣');
      const {data, error} = await sb.auth.updateUser({email:u+ACCT_DOMAIN, password:p});
      if(error) return toast(zhErr(error.message));
      if(!data.user || !isAcctMail(data.user.email)) return toast('伺服器還沒開啟帳號綁定，請稍後再試');
      sfx('lvup'); fxConfetti(); toast('綁定成功！之後用「' + u + '」登入就能找回進度'); openSettings(); }]]);
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
    startGame(st); setTimeout(()=>dailyToast(st), 3500); setTimeout(signMaybePop, 4500); setTimeout(pushOnLogin, 6000);
  }catch(e){ showScreen('login'); authMsg(e.message); if(/停權/.test(e.message)) sb.auth.signOut(); }
  finally{ entering = false; }
}
async function loadConfig(){
  try{
    const c = await rpc('farm_config');
    c.crops.forEach(x=>{ const k = CROP[x.id]; if(k) Object.assign(k, {lv:x.lv, seed:x.seed, time:x.time, yield:x.yield, price:x.price, exp:x.exp, seed_gems:x.seed_gems}); });
    c.land.forEach(l=>{ LAND[l.idx] = {lv:l.lv, cost:l.cost}; });
    setGearConfig(c.gear, c.settings, c.skins); setRanchConfig(c.animals, c.settings); setDecorConfig(c.decor, c.settings); setBeastConfig(c.beasts, c.pet_skins); setItemConfig(c.items); SPIN=c.spin||[]; COS=c.cosmetics||[]; window.PACKS=c.packs||[]; setToneConfig(c.tones); CFG_SET=c.settings||{};
  }catch(e){}
}
async function showNotices(){
  let L; try{ L = await rpc('farm_notices'); }catch(e){ return; }
  let seen = []; try{ seen = JSON.parse(localStorage.getItem('ytzt_seen_notices')||'[]'); }catch(e){}
  const n = L.find(x=>!seen.includes(x.id)); if(!n) return;
  seen.push(n.id); try{ localStorage.setItem('ytzt_seen_notices', JSON.stringify(seen.slice(-50))); }catch(e){}
  modal('📢 ' + esc(n.title), `<div style="white-space:pre-wrap;font-size:14px;font-weight:500;line-height:1.8">${esc(n.body)}</div>`, [['知道了','',()=>{ closeModal(); setTimeout(showNotices, 300); }]]);
}
function startGame(st){
  applyState(st); mode = 'home'; V = null;
  sessionStart(); setTimeout(loadTicker, 1500);
  loadConfig().then(()=>{ if(S) refresh(); setTimeout(()=>openGifts(true), 2500); });
  showScreen('game');
  if(!built){ buildWorld(); requestAnimationFrame(animate); built = true; }
  plotSig = plotSig.map(()=> '');
  buildTools(); layout(); setTool('hand'); refresh();
  $('bHome').textContent = '🌾 回到農田';
  requestAnimationFrame(()=>centerOn(...FARM_C));
  toast(`歡迎回到小鎮，${S.me.nickname}！`);
  setTimeout(tutMaybeStart, 900);
  setTimeout(showNotices, 1200);
}

$('authBtn').onclick = doAuth;
$('tryBtn').onclick = async()=>{ const b=$('tryBtn'); b.disabled=true;
  try{ const {error} = await sb.auth.signInAnonymously(); if(error) authMsg(zhErr(error.message)); }
  finally{ b.disabled=false; } };
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
$('bBag').onclick = ()=>{ if(S && mode!=='visit') openPack(); };
$('bPals').onclick = ()=>{ if(S && mode!=='visit') openBeastPark('mine'); };
$('bSet').onclick = ()=>{ if(S) openSettings(); };
$('bHelp').onclick = ()=>{ if(S) openHelp(); };
$('bSign').onclick = ()=>openSign();
$('bSpin').onclick = ()=>openSpin();
$('bGift').onclick = ()=>{ if(S) openGifts(false); };
$('avatar').onclick = ()=>{ if(S && mode==='home') openAvatarPicker(); };
$('gemBox').onclick = ()=>{ if(S) openTopup(); };
$('tutNext').onclick = ()=>tutNext();
$('tutSkip').onclick = ()=>tutSkip();

sb.auth.onAuthStateChange((ev, session)=>{
  if(ev==='PASSWORD_RECOVERY'){ setTimeout(showResetPw, 300); }
  if(session && (ev==='SIGNED_IN' || ev==='INITIAL_SESSION') && !S) setTimeout(enterGame, 0);
  if(ev==='SIGNED_OUT'){ SESS.sid=null; setSidHeader(null); tut=null; $('tut').style.display='none'; $('tutArrow').style.display='none'; S=null; V=null; mode='home'; showScreen('login'); setAuthMode('login'); }
  if(ev==='INITIAL_SESSION' && !session) showScreen('login');
});
setAuthMode('login');

/* ================= 跑馬燈：誰的菜被誰偷了、誰被狗咬了 ================= */
let tkItems=[], tkX=0, tkW=0, tkLast=0;
function tkText(e){ const a=`<b>${esc(e.a)}</b>`, o=`<b>${esc(e.o)}</b>`;
  if(e.k==='steal') return `🧺 ${a} 偷走了 ${o} 的 ${e.q} 個${CROP[e.c]?.name||'作物'}`;
  if(e.k==='r_steal') return `🥚 ${a} 偷走了 ${o} 牧場的 ${e.q} 個${(ANIMALS.find(x=>x.good===e.c)||{}).good_name||'產品'}`;
  if(e.k==='dog') return `🐶 ${a} 想偷 ${o} 的菜，被看門狗咬了！`;
  if(e.k==='shout') return `<span class="tkshout">📢 ${a}：${esc(e.m||'')}</span>`;
  return ''; }
async function loadTicker(){
  try{ const on=+((CFG_SET||{}).ticker_on ?? 1)!==0, L=on?await rpc('farm_ticker'):[], ev=eventInfo(); const sig=(ev||'')+L.map(e=>e.t+e.a).join();
    if(sig===tkLast) return; tkLast=sig; tkItems=L;
    const el=$('tk'); if(!el) return;
    shoutSet(L.filter(e=>e.k==='shout'));
    const parts=(ev?[ev]:[]).concat(L.filter(e=>e.k!=='shout').map(tkText).filter(Boolean));
    el.innerHTML = parts.join('<span class="sep">｜</span>');
    $('ticker').classList.toggle('off', !parts.length);
    tkW=el.scrollWidth; tkX=$('ticker').clientWidth;
  }catch(e){}
}
let tkT=0;
function tkLoop(now){ requestAnimationFrame(tkLoop); const el=$('tk'); if(!el||!tkW) return;
  if(PAUSED() || now-tkT < 1000/FPS_CAP()-2){ if(PAUSED()) tkT=now; return; }
  const k=Math.min(4,(now-(tkT||now))/16.7); tkT=now;
  tkX -= ((typeof LOWFX!=='undefined'&&LOWFX) ? 0.6 : 0.9) * k; if(tkX < -tkW) tkX = $('ticker').clientWidth;
  el.style.transform=`translateX(${tkX.toFixed(1)}px)`; }
requestAnimationFrame(tkLoop);

/* ================= 大聲公：獨立的金色跑馬燈，一則一則輪流跑 ================= */
let sbList=[], sbIdx=0, sbX=0, sbW=0, sbSeen=new Set(), sbT=0;
function shoutSet(list){
  const bar=$('shoutBar'); if(!bar) return;
  const fresh = list.some(e=>!sbSeen.has(e.t+'|'+e.a));
  list.forEach(e=>sbSeen.add(e.t+'|'+e.a));
  const same = list.length===sbList.length && list.every((e,i)=>sbList[i] && sbList[i].t===e.t && sbList[i].a===e.a);
  sbList = list;
  bar.classList.toggle('off', !list.length);
  if(!list.length){ sbW=0; return; }
  if(fresh){ bar.classList.remove('pop'); void bar.offsetWidth; bar.classList.add('pop'); sbIdx = list.length-1; sbShow(); }
  else if(!same){ sbIdx = Math.min(sbIdx, list.length-1); sbShow(); }
}
function sbShow(){ const e=sbList[sbIdx]; if(!e) return; const el=$('sbTx');
  el.innerHTML = `<b>${esc(e.a)}</b>：${esc(e.m||'')}`; sbW = el.scrollWidth; sbX = el.parentNode.clientWidth; }
function sbLoop(now){ requestAnimationFrame(sbLoop); const el=$('sbTx'); if(!el||!sbW||!sbList.length) return;
  if(PAUSED() || now-sbT < 1000/FPS_CAP()-2){ if(PAUSED()) sbT=now; return; }
  const k=Math.min(4,(now-(sbT||now))/16.7); sbT=now;
  sbX -= ((typeof LOWFX!=='undefined'&&LOWFX) ? 0.8 : 1.2) * k;
  if(sbX < -sbW){ sbIdx = (sbIdx+1) % sbList.length; sbShow(); }
  el.style.transform=`translate(${sbX.toFixed(1)}px,-50%)`; }
requestAnimationFrame(sbLoop);
setInterval(()=>{ if(S && !document.hidden) loadTicker(); }, 45000);

/* ================= 禮物信箱、獎勵顯示、活動 ================= */
function rewardList(rw){ rw=rw||{}; const out=[];
  if(rw.gold) out.push(['i_coin', `${(+rw.gold).toLocaleString()} 金幣`]);
  if(rw.gems) out.push(['i_gem', `💎 ${(+rw.gems).toLocaleString()}`]);
  if(rw.exp) out.push(['', `⭐ 經驗 ${rw.exp}`]);
  Object.entries(rw.seeds||{}).forEach(([k,n])=>out.push(['', `🌱 ${CROP[k]?.name||k}種子 ×${n}`]));
  Object.entries(rw.crops||{}).forEach(([k,n])=>out.push(['', `🧺 ${CROP[k]?.name||k} ×${n}`]));
  Object.entries(rw.gear||{}).forEach(([k,n])=>out.push([GEAR[k]?.icon||'', `${GEAR[k]?gearTitle(GEAR[k]):k} ×${n}`]));
  Object.entries(rw.decor||{}).forEach(([k,n])=>out.push(['dc_'+k, `${(typeof DEC!=='undefined'&&DEC[k]?.name)||k} ×${n}`]));
  (rw.beasts||[]).forEach(k=>out.push(['', `🐾 寵物 ${bName(k)}`]));
  (rw.tones||[]).forEach(k=>out.push(['', `🌈 色調 ${TONE[k]?.name||k}`]));
  (rw.skins||[]).forEach(k=>out.push(['', `🏠 外觀 ${(SKINS.find(x=>x.id===k)||{}).name||k}`]));
  return out; }
function rewardHTML(rw){ return rewardList(rw).map(([ic,t])=>`<span class="rw">${ic&&!/^[^a-z]/.test(ic)?`<img src="${A(ic)}" alt="">`:''}${esc(t)}</span>`).join(''); }
async function openGifts(auto){
  let L=[]; try{ L=await rpc('farm_gifts'); }catch(e){ return; }
  if(!L.length){ if(!auto) modal('📬 禮物信箱', `<div class="empty">目前沒有禮物</div>`); return; }
  modal('📬 禮物信箱', L.map(g=>`<div class="gift"><b>${esc(g.title)}</b>${g.body?`<p>${esc(g.body)}</p>`:''}<div class="rwbox">${rewardHTML(g.reward)}</div>
    <button class="btn" data-gc="${g.id}">領取</button></div>`).join(''), L.length>1?[['全部領取','',async()=>{ for(const g of L){ try{ const r=await rpc('farm_gift_claim',{p_id:g.id}); applyState(r.state); }catch(e){} } refresh(); sfx('lvup'); fxConfetti(); toast('全部領好了！'); closeModal(); }]]:null);
  document.querySelectorAll('[data-gc]').forEach(b=>b.onclick=async()=>{ try{ const r=await rpc('farm_gift_claim',{p_id:+b.dataset.gc}); applyState(r.state); refresh(); sfx('coin'); toast('領好了！'); if(r.gift) toast(r.gift); openGifts(true); if(L.length===1) closeModal(); }catch(e){ toast(e.message); } });
}
function eventInfo(){ const c=CFG_SET||{}, now=Date.now()/1000, st=+c.ev_start||0, en=+c.ev_end||0;
  if(!(now>=st && now<=en)) return null;
  const m=[]; if(+c.ev_exp>1) m.push(`經驗 ×${+c.ev_exp}`); if(+c.ev_yield>1) m.push(`收成 ×${+c.ev_yield}`); if(+c.ev_gold>1) m.push(`賣價 ×${+c.ev_gold}`);
  const d=new Date(en*1000), t=`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  return `🎉 <b>${esc(c.ev_name||'限時活動')}</b>${m.length?`：${m.join('、')}`:''}（到 ${t}）`; }

/* ================= 食物收集倉：寵物自動收成的東西先放這裡，要手動收進穀倉；別人可以來偷 ================= */
function binListHTML(b){ const rows=[];
  Object.entries((b||{}).c||{}).forEach(([k,n])=>{ if(n>0) rows.push(`<div class="row"><div class="ic">${CROP[k]?iconSVG(CROP[k]):''}</div><div class="tx"><b>${CROP[k]?.name||k}</b> <span class="tag">×${n}</span></div></div>`); });
  Object.entries((b||{}).g||{}).forEach(([k,n])=>{ if(n>0){ const a=ANIMALS.find(x=>x.good===k)||{}; rows.push(`<div class="row"><div class="ic" style="display:grid;place-items:center;font-size:26px">${GOOD_ICON[k]||'🥚'}</div><div class="tx"><b>${a.good_name||k}</b> <span class="tag">×${n}</span></div></div>`); } });
  return rows.join('') || `<div class="empty">收集倉是空的</div>`; }
function openBin(){
  if(mode==='visit' && V){
    const b=V.bin||{}, n=binCount(b.items);
    const why = !n ? '收集倉是空的' : b.mine ? '這一批你已經偷過了' : !(b.left>0) ? '已經被偷光了，留點給主人吧' : V.protected ? '對方還在新手保護中' : '';
    modal(`🧺 ${esc(V.owner.nickname)} 的收集倉`, `<div class="rhint" style="margin-bottom:6px">寵物自動收成的東西會先放在這裡，主人還沒收走前可以偷一點（每次最多 ${+(CFG_SET.bin_steal_max??2)} 個）</div>${binListHTML(b.items)}`,
      why ? [[why,'sub',closeModal]] : [['🧺 偷一點','r',async()=>{ try{ const r=await rpc('farm_bin_steal',{p_owner:V.owner.id}); applyState(r.state); applyVisit(r.visit); refresh(); closeModal();
        if(r.ab==='dog'){ sfx('err'); toast('被看門狗咬了！什麼都沒偷到 🐶'); } else { sfx('steal'); toast(`偷到 ${r.qty} 個！`); } if(r.gift) toast(r.gift); }catch(e){ toast(e.message); } }]]);
    return;
  }
  const b=S.me.bin||{}, n=binCount(b), cap=+(S.me.bin_cap||200);
  modal('🧺 食物收集倉', `<div class="rhint" style="margin-bottom:6px">寵物自動收成的作物和牧場產品會先放在這裡（${n}/${cap}），要按「收進穀倉」才能賣。放在這裡的東西好友和鄰居可以來偷，記得常來收！滿了寵物就會先停止收成。</div>${binListHTML(b)}`,
    n ? [[`收進穀倉（${n} 個）`,'',async()=>{ try{ const r=await rpc('farm_bin_collect'); applyState(r.state); refresh(); sfx('coin'); toast(`收進穀倉 ${r.n} 個`); closeModal(); }catch(e){ toast(e.message); } }]] : null);
}

/* 每日登入鑽石 */
function dailyToast(st){ if(st && st.daily){ sfx('lvup'); toast(`🎁 每日登入獎勵 💎${st.daily}`); st.daily=0; } }
/* 成就 */
function achHTML(me){ const n=Object.keys(me.ach||{}).length;
  return `<button class="btn achbtn" id="hAch">🏆 查看全部成就 <small>已完成 ${n} 個</small></button>
  <div class="rhint">種田、牧場、好友、偷菜、寵物、城鎮、簽到都有成就，完成自動送鑽石。每升 1 級送 💎${+(CFG_SET.lv_gems??20)}，每天第一次上線送 💎${+(CFG_SET.daily_gems??10)}</div>`; }
let achCat = null;
async function openAchs(cat){
  modal('🏆 成就', `<div class="empty">讀取中…</div>`);
  let L; try{ L = await rpc('farm_achs'); }catch(e){ return modal('🏆 成就', `<div class="empty">${esc(e.message)}</div>`); }
  const cats=[...new Set(L.map(a=>a.cat))]; if(cat) achCat=cat; if(!cats.includes(achCat)) achCat=cats[0];
  const done=L.filter(a=>a.done).length, gem=L.filter(a=>a.done).reduce((x,a)=>x+a.gems,0);
  const tabs=`<div class="achtabs">${cats.map(c=>{ const cl=L.filter(a=>a.cat===c), d=cl.filter(a=>a.done).length;
    return `<button data-ac="${esc(c)}" class="${c===achCat?'on':''}">${esc(c)}<small>${d}/${cl.length}</small></button>`; }).join('')}</div>`;
  const rows=L.filter(a=>a.cat===achCat).sort((x,y)=>(x.done-y.done)).map(a=>{ const pct=Math.min(100, a.v/a.target*100);
    return `<div class="ach2${a.done?' done':''}"><div class="a2t"><b>${a.done?'🏆':'🎯'} ${esc(a.name)}</b><span class="a2g">💎${a.gems}</span></div>
      ${a.done?'<div class="a2d">已完成，鑽石已發放</div>':`<div class="a2bar"><i style="width:${pct.toFixed(1)}%"></i></div><div class="a2v">${(+a.v).toLocaleString()} / ${(+a.target).toLocaleString()}</div>`}</div>`; }).join('');
  modal('🏆 成就', `<div class="achsum">已完成 <b>${done}</b> / ${L.length} 個・共拿到 💎${gem}</div>${tabs}${rows}`, [['← 回我的家','sub',()=>openHome()]]);
  document.querySelectorAll('#md [data-ac]').forEach(b=>b.onclick=()=>openAchs(b.dataset.ac));
}

/* ================= 被偷提醒：有人偷你的菜，畫面上方跳紅色提醒＋復仇按鈕 ================= */
let stealNew = 0, stealAlertT = 0, stealAlerted = 0;
const stealKey = () => 'ytzt_stealseen_' + (S && S.me.id);
function stealSeen(logs){ const t=Math.max(0, ...(logs||[]).map(l=>+l.at||0)); try{ if(t) localStorage.setItem(stealKey(), String(t)); }catch(e){} stealAlerted=Math.max(stealAlerted,t); stealNew=0; setStealBadge(); }
function setStealBadge(){ const lb=document.querySelector('[data-b="board"]'); if(lb) lb.classList.toggle('stolen', stealNew>0);
  const d=$('boardDot'); if(d){ d.style.display = stealNew>0 && mode!=='visit' ? '' : 'none'; const t=$('boardDotN'); if(t) t.textContent = stealNew>9?'9+':String(stealNew||'!'); } }
async function checkSteals(){
  if(!S || mode!=='home' || document.hidden) return;
  let logs; try{ logs = await rpc('farm_logs_get'); }catch(e){ return; }
  let seen=0; try{ seen=+localStorage.getItem(stealKey())||0; }catch(e){}
  if(!seen){ stealSeen(logs); return; }   // 第一次：不跳舊的
  const BADK = {steal:1, r_steal:1, prank_weed:1, prank_bug:1, r_prank:1};
  const fresh = logs.filter(l=>BADK[l.kind] && +l.at>seen && l.aid!==S.me.id);
  stealNew = fresh.length; setStealBadge();
  const newer = fresh.filter(l=>+l.at>stealAlerted);   // 紅點一直留到打開動態；跳出提醒只跳新的
  if(!newer.length) return;
  stealAlerted = Math.max(stealAlerted, ...newer.map(x=>+x.at));
  const l = newer[0], more = newer.length>1 ? `（還有 ${newer.length-1} 筆）` : '', isPrank = !(l.kind==='steal'||l.kind==='r_steal');
  const el = $('stealAlert');
  el.innerHTML = `<div class="sa-in"><span class="sa-ic">${isPrank?'😈':'🦹'}</span><div class="sa-tx"><b>${esc(l.who||'有人')}</b> ${(LOG_TXT[l.kind]||(()=>''))(l)}！${more}</div><button class="mini revenge" id="saGo">😤 復仇</button><button class="sa-x" id="saX">✕</button></div>`;
  el.classList.add('show'); sfx && sfx('err'); vib && vib([60,40,60]);
  $('saGo').onclick = ()=>{ el.classList.remove('show'); try{ localStorage.setItem(stealKey(), String(Math.max(...fresh.map(x=>+x.at)))); }catch(e){} stealNew=0; setStealBadge(); visit(l.aid); };
  $('saX').onclick = ()=>{ el.classList.remove('show'); };
  clearTimeout(stealAlertT); stealAlertT = setTimeout(()=>el.classList.remove('show'), 12000);
}
setInterval(checkSteals, 30000); setTimeout(checkSteals, 6000);

/* 偷陌生人次數：用掉後每 N 分鐘回 1 次 */
function regenTxt(me, k){ if(!me || !(+me[k+'_regen']>0)) return ''; if(me[k+'_next']==null) return `，每 ${+me[k+'_regen']} 分鐘回 1 點`;
  const s=Math.max(0, me[k+'_next'] - Math.floor((Date.now()-(me._stAt||Date.now()))/1000)); return `，${Math.floor(s/60)}:${String(s%60).padStart(2,'0')} 後回 1 點`; }
const stealRegenTxt = me => regenTxt(me, 'steal');
