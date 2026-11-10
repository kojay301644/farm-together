/* ================= 道具：道具商店、背包道具、生效狀態 ================= */
let ITEMS = [], ITEM = {};
function setItemConfig(list){ ITEMS = list||[]; ITEM = {}; ITEMS.forEach(x=>ITEM[x.id]=x); }
const itemIcon = (x, s=44) => !x ? '' : x.icon.startsWith('emoji:') ? `<span class="itemoji" style="font-size:${Math.round(s*0.72)}px;width:${s}px;height:${s}px">${x.icon.slice(6)}</span>` : `<img src="${A(x.icon)}" style="width:${s}px;height:${s}px;object-fit:contain" alt="">`;
const BUFF_TXT = {shield:['🛡️','防盜罩'], harvest:['🌟','豐收 +50%'], exp:['📈','經驗 ×2'], party:['🎉','派對中']};
const buffLeft = (me, k) => Math.max(0, Math.floor((+((me.buffs||{})[k]||0) - (Date.now() + (S?S.off:0)))/1000));
const hms = s => `${Math.floor(s/3600)}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

function openItemShop(){
  if(mode==='visit') return toast('回到自己的農場才能買東西');
  const me=S.me, dly=me.daily||{};
  const rows = ITEMS.map(x=>{ const left = x.buy_daily!=null ? x.buy_daily - (+dly['buy_'+x.id]||0) : null;
    const btns = [x.gems!=null?`<button class="mini gem" data-ib="${x.id}" data-pay="gems" ${(me.gems||0)<x.gems||left===0?'disabled':''}>💎${x.gems}</button>`:'',
                  x.gold!=null?`<button class="mini" data-ib="${x.id}" data-pay="gold" ${me.gold<x.gold||left===0?'disabled':''}>${x.gold.toLocaleString()} 金</button>`:''].join('');
    return `<div class="row"><div class="ic">${itemIcon(x)}</div><div class="tx"><b>${esc(x.name)}</b>${(me.items||{})[x.id]?` <span class="tag">有 ${(me.items||{})[x.id]} 個</span>`:''}
      <div>${esc(x.descr)}${x.buy_daily!=null?`（每天限買 ${x.buy_daily} 個，今天還能買 ${Math.max(0,left)} 個）`:''}${x.use_daily!=null?`（每天最多用 ${x.use_daily} 次）`:''}</div></div><div class="ibtns">${btns}</div></div>`; }).join('');
  modal(`穀倉　<span style="font-size:14px;color:var(--ink2)">${me.gold.toLocaleString()} 金・💎${(me.gems||0).toLocaleString()}</span>`,
    barnNav('item') + `<div class="rhint">買了會放進「背包 → 🧪 道具」，要用的時候再按「使用」。單塊田的肥料：用「收成」點還沒成熟的作物就能用。</div>` + rows);
  bindBarnNav();
  document.querySelectorAll('#md [data-ib]').forEach(b=>b.onclick=async()=>{ const x=ITEM[b.dataset.ib];
    try{ applyState(await rpc('farm_item_buy',{p_id:x.id,p_pay:b.dataset.pay,p_n:1})); refresh(); sfx('coin'); toast(`買了「${x.name}」，放在背包裡`); openItemShop(); }catch(e){ toast(e.message); } });
}

function itemBagHTML(){
  const me=S.me, own=ITEMS.filter(x=>(me.items||{})[x.id]>0);
  return own.length ? own.map(x=>`<div class="row"><div class="ic">${itemIcon(x)}</div><div class="tx"><b>${esc(x.name)}</b> <span class="tag">×${me.items[x.id]}</span><div>${esc(x.descr)}</div></div><button class="mini o" data-iu="${x.id}">使用</button></div>`).join('')
    : `<div class="empty">還沒有道具<br><small>到穀倉的「🧪 道具商店」買</small></div>`;
}
function bindItemBag(){ document.querySelectorAll('#md [data-iu]').forEach(b=>b.onclick=()=>useItem(b.dataset.iu)); }

async function useItem(id, arg){
  const x=ITEM[id]; if(!x) return;
  if(id==='shout' && arg==null){
    modal('📢 大聲公', `<div class="rhint">說一句話（最多 30 字），會放上全服跑馬燈 ${+(CFG_SET.shout_min??10)} 分鐘。請友善發言，不當內容會被刪除。</div>
      <input id="shoutTxt" maxlength="30" placeholder="想對大家說什麼？" style="width:100%;font-size:16px;padding:10px;border-radius:12px;border:2px solid #E6D9C3;margin-top:8px">`,
      [['取消','sub',()=>openPack('item')],['📢 送出','',()=>{ const t=$('shoutTxt').value.trim(); if(!t) return toast('請輸入內容'); useItem('shout', t); }]]);
    setTimeout(()=>$('shoutTxt') && $('shoutTxt').focus(), 100); return;
  }
  if((id==='shield4'||id==='shield12'||id==='harvest'||id==='expx2'||id==='party') && arg==null){
    const k={shield4:'shield',shield12:'shield',harvest:'harvest',expx2:'exp',party:'party'}[id], left=buffLeft(S.me,k);
    if(left>0 && id!=='party') return modal(x.name, `<p style="font-weight:700">${BUFF_TXT[k][0]} ${BUFF_TXT[k][1]}還有 ${hms(left)}，再用會把時間往後加。</p>`, [['取消','sub',()=>openPack('item')],['使用','',()=>useItem(id,'')]]);
  }
  try{
    const r = await rpc('farm_item_use',{p_id:id,p_arg:arg||null}); applyState(r.state); refresh(); sfx('lvup'); toast(r.msg||'使用了');
    if(id==='detector') return showDetector(r.res||[]);
    if(id==='fert_all') fxConfetti();
    openPack('item');
  }catch(e){ toast(e.message); }
}
function showDetector(list){
  modal('🔍 探測結果', list.length ? `<div class="rhint">現在可以偷最多的農場（估計值，有開防盜罩的不會出現）</div>` + list.map((f,i)=>`<div class="row"><div class="rkn">${['🥇','🥈','🥉','4','5'][i]}</div>${avImg(f)}<div class="tx"><b>${esc(f.nickname)}</b> <span class="tag">Lv${f.lv}</span>${f.friend?' <span class="tag">好友</span>':''}<div>${f.ripe?`${f.ripe} 塊地成熟`:'收集倉有東西'}・約 ${(+f.val).toLocaleString()} 金</div></div><button class="mini o" data-visit="${f.id}">去偷！</button></div>`).join('')
    : `<div class="empty">現在沒有找到可以偷的農場，晚點再試試</div>`);
  document.querySelectorAll('#md [data-visit]').forEach(b=>b.onclick=()=>{ closeModal(); visit(b.dataset.visit); });
}

/* 單塊田的肥料：用收成點還沒成熟的作物 */
function openFertPlot(i){
  const p=curPlots()[i], c=CROP[p.c], rem=Math.max(0, c.time - p.g), h=rem/3600;
  const gem=Math.min(20, Math.max(2, Math.ceil(h)*2)), gold=Math.min(8000, Math.max(500, Math.ceil(h*500)));
  const issues=[p.w?`雜草×${p.w}`:'', p.b?`蟲×${p.b}`:'', p.dry?'缺水':''].filter(Boolean).join('、');
  modal(`${c.name}`, `<div style="text-align:center;font-weight:800;margin-bottom:8px">約 ${fmt(leftSec(p))} 後成熟${issues?`<div style="color:#D63B42;font-size:13px">${issues}</div>`:''}</div>
    <div class="row"><div class="ic">${itemIcon({icon:'i_ore2'})}</div><div class="tx"><b>神奇肥料</b><div>立刻成熟</div></div><button class="mini gem" id="fGem" ${(S.me.gems||0)<gem?'disabled':''}>💎${gem}</button></div>
    <div class="row"><div class="ic">${itemIcon({icon:'i_sta'})}</div><div class="tx"><b>金幣肥料</b><div>剩下的時間減半</div></div><button class="mini" id="fGold" ${S.me.gold<gold?'disabled':''}>${gold.toLocaleString()} 金</button></div>`);
  const go = async pay => { try{ const r=await rpc('farm_fert_plot',{p_idx:i,p_pay:pay}); applyState(r.state); refresh(); closeModal(); sfx('lvup'); floatAt(plotEls[i], pay==='gems'?'立刻成熟！':'加速！','#B8F5A0'); }catch(e){ toast(e.message); } };
  $('fGem').onclick=()=>go('gems'); $('fGold').onclick=()=>go('gold');
}

/* 畫面上方：正在生效的道具 */
function renderBuffs(){
  const el=$('buffs'); if(!el || !S) return;
  const me = mode==='visit' && V ? null : S.me;
  let h='';
  if(me) for(const k of ['shield','harvest','exp','party']){ const s=buffLeft(me,k); if(s>0) h+=`<span class="buff">${BUFF_TXT[k][0]} ${BUFF_TXT[k][1]} ${hms(s)}</span>`; }
  if(mode==='visit' && V && V.owner){ const o=V.owner, b=o.buffs||{}, now=Date.now()+(S.off||0);
    if(+b.shield>now) h+=`<span class="buff bad">🛡️ 對方開了防盜罩</span>`;
    if(+b.party>now) h+= o.party_got ? `<span class="buff">🎉 派對中（已領過）</span>` : `<button class="buff party" id="partyGo">🎉 派對中！領派對禮物</button>`; }
  if(el.innerHTML!==h) el.innerHTML=h;
  const pg=$('partyGo'); if(pg) pg.onclick=async()=>{ try{ const r=await rpc('farm_party_join',{p_owner:V.owner.id}); applyState(r.state); if(r.visit) applyVisit(r.visit); refresh(); sfx('lvup'); fxConfetti(); toast(`🎉 派對禮物：${r.gold} 金、經驗 +${r.exp}`); if(r.gift) toast(r.gift); }catch(e){ toast(e.message); } };
}
setInterval(renderBuffs, 1000);

/* ================= 送禮給好友 ================= */
let giftKind='crop';
function openGiftFriend(fid, name, kind){
  if(kind) giftKind=kind; const me=S.me, left=Math.max(0, +(CFG_SET.gift_daily??10) - (+(me.daily||{}).gift_sent||0));
  const list = giftKind==='crop' ? CROPS.filter(c=>(me.crops[c.id]||0)>0).map(c=>[c.id, c.name, me.crops[c.id], iconSVG(c)])
    : giftKind==='seed' ? CROPS.filter(c=>(me.seeds[c.id]||0)>0).map(c=>[c.id, c.name+'種子', me.seeds[c.id], iconSVG(c)])
    : ITEMS.filter(x=>(me.items||{})[x.id]>0).map(x=>[x.id, x.name, me.items[x.id], itemIcon(x,40)]);
  const tabs=`<div class="snav">${[['crop','🥕 作物'],['seed','🌱 種子'],['item','🧪 道具']].map(([k,t])=>`<button data-gk="${k}" class="${giftKind===k?'on':''}">${t}</button>`).join('')}</div>`;
  const rows = list.length ? list.map(([id,nm,n,ic])=>`<div class="row"><div class="ic">${ic}</div><div class="tx"><b>${esc(nm)}</b> <span class="tag">有 ${n}</span></div>
      <input type="number" class="gnum" data-gid="${id}" min="1" max="${Math.min(99,n)}" value="1" style="width:56px;font-size:15px;padding:4px;border-radius:8px;border:2px solid #E6D9C3"><button class="mini" data-gs="${id}" ${left<1?'disabled':''}>送</button></div>`).join('')
    : `<div class="empty">沒有可以送的東西</div>`;
  modal(`💌 送禮給 ${esc(name)}`, `<div class="rhint">對方會在 📬 禮物信箱收到。今天還能送 ${left} 次（不能送金幣和鑽石）</div>${tabs}${rows}`, [['← 回好友廣場','sub',()=>openBoard('friends')]]);
  document.querySelectorAll('#md [data-gk]').forEach(b=>b.onclick=()=>openGiftFriend(fid,name,b.dataset.gk));
  document.querySelectorAll('#md [data-gs]').forEach(b=>b.onclick=async()=>{ const id=b.dataset.gs, n=+document.querySelector(`#md [data-gid="${id}"]`).value||1;
    try{ const r=await rpc('farm_gift_friend',{p_to:fid,p_kind:giftKind,p_id:id,p_n:n}); applyState(r.state); refresh(); sfx('coin'); toast(r.msg); openGiftFriend(fid,name); }catch(e){ toast(e.message); } });
}

/* ================= 每日轉盤 ================= */
let SPIN = [];
const spinFree = () => S && !(+(S.me.daily||{}).spin_free>0);
function spinBadge(){ const b=$('bSpin'); if(b) b.classList.toggle('dot', spinFree()); }
function openSpin(hl){
  if(!S) return; if(mode==='visit') return toast('回到自己的農場才能轉');
  const me=S.me, d=me.daily||{}, gL=Math.max(0,+(CFG_SET.spin_gems_daily??10)-(+d.spin_gems||0)), oL=Math.max(0,+(CFG_SET.spin_gold_daily??5)-(+d.spin_gold||0));
  const tot=SPIN.reduce((a,x)=>a+(+x.weight),0)||1;
  const cells=SPIN.map((x,i)=>`<div class="spc${hl===i?' on':''}" data-si="${i}">${itemIcon(x,40)}<b>${esc(x.name)}</b></div>`).join('');
  const odds=SPIN.map(x=>`<tr><td>${esc(x.name)}</td><td>${(+x.weight/tot*100).toFixed(1).replace(/\.0$/,'')}%</td></tr>`).join('');
  modal('🎟️ 每日轉盤', `<div class="spgrid">${cells}</div>
    <div class="spbtns"><button class="btn" id="spFree" ${spinFree()?'':'disabled'}>${spinFree()?'🎁 免費轉一次':'今天的免費已用'}</button>
    <button class="btn gem" id="spGem" ${gL<1||(me.gems||0)<+(CFG_SET.spin_gems??5)?'disabled':''}>💎${+(CFG_SET.spin_gems??5)} 轉（剩 ${gL}）</button>
    <button class="btn o" id="spGold" ${oL<1||me.gold<+(CFG_SET.spin_gold??3000)?'disabled':''}>${(+(CFG_SET.spin_gold??3000)).toLocaleString()} 金轉（剩 ${oL}）</button></div>
    <details class="odds"><summary>獎品機率</summary><table>${odds}</table></details>`);
  const go = async pay => {
    document.querySelectorAll('#md .spbtns button').forEach(b=>b.disabled=true);
    let r; try{ r=await rpc('farm_spin',{p_pay:pay}); }catch(e){ toast(e.message); return openSpin(); }
    const target=SPIN.findIndex(x=>x.id===r.prize), cs=[...document.querySelectorAll('#md .spc')], N=cs.length;
    let k=0, steps=N*3+((target-0+N)%N), dl=40;
    const tick=()=>{ cs.forEach(c=>c.classList.remove('on')); cs[k%N].classList.add('on'); sfx && sfx('tap');
      if(k>=steps){ applyState(r.state); refresh(); spinBadge(); sfx('lvup'); if(['gem200','gem20','rare'].includes(r.prize)) fxConfetti();
        setTimeout(()=>{ toast(`🎉 轉到：${r.name}`); if(r.gift) toast(r.gift); openSpin(target); }, 500); return; }
      k++; dl = k>steps-8 ? dl*1.25 : dl; setTimeout(tick, dl); };
    tick();
  };
  $('spFree').onclick=()=>go('free'); $('spGem').onclick=()=>go('gems'); $('spGold').onclick=()=>go('gold');
}
