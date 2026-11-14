
/* ================= 寵物進化與裝備 ================= */
let GEAR = {}, GEAR_LIST = [], EVO = [10,20];
const GEAR_FUNC = {plant:['自動播種','🌱'], water:['自動澆水','💧'], dog:['看門狗','🐶'], bug:['自動除蟲','🐛'],
  weed:['自動除草','🌿'], feed:['自動餵食','🥕'], clear:['自動餵食','🥕'], harvest:['自動收成','🧺'], swat:['自動拍蚊子','🦟'], scare:['稻草人','🎃']};
const ROMAN = ['','I','II','III','IV'];
function gearDesc(g){ const v=+g.val, pc=Math.round(v*100);
  return ({plant:`空地自動種下你指定的種子（第 1～${v} 塊地）`, water:`自動幫 ${v} 塊正在長的田保持濕潤（從前面的田開始）`,
    dog:`小偷來偷菜時 ${pc}% 被咬跑（小偷要付醫藥費，還會嚇掉作物給你）`, bug:`蟲一出現 ${pc}% 馬上除掉，沒除到每 ${+(CFG_SET.pest_retry_min??10)} 分鐘再試一次`, weed:`雜草一長出 ${pc}% 馬上拔掉，沒拔到每 ${+(CFG_SET.pest_retry_min??10)} 分鐘再試一次`,
    feed:`牧場動物餓了自動拿倉庫作物餵（最賺錢的 ${v} 隻優先，飼料不夠的先跳過）`, clear:`牧場動物餓了自動拿倉庫作物餵（最賺錢的 ${v} 隻優先，飼料不夠的先跳過）`, harvest:`作物和牧場產品好了 ${v} 分鐘後自動收進收集倉`,
    swat:`牧場的蚊子每 10 分鐘有 ${pc}% 被拍掉一隻`, scare:`別人惡作劇 ${pc}% 被擋下`})[g.func] || ''; }
function setGearConfig(list, st, sk){ if(sk) SKINS=sk; GEAR_LIST = list||[]; GEAR = {}; GEAR_LIST.forEach(g=>GEAR[g.id]=g);
  if(st){ EVO = [+(st.evo_lv2 ?? 10), +(st.evo_lv3 ?? 20)]; } }
const chrStage = lv => 1;  // 不進化：一律第一階
const chrSpecies = k => (/^([a-z]+)/.exec(k||'bunny')||[0,'bunny'])[1];
const chrKey = (k, lv) => chrSpecies(k) + chrStage(lv||1);
const chrName = key => { const c=chrInfo(key); return (CHR_NAMES[c.sp]||[])[c.st-1] || c.name; };
const gearImg = (g, sz=40) => g ? `<img src="${A(g.icon)}" style="width:${sz}px;height:${sz}px;object-fit:contain" alt="">` : '';
const gearTitle = g => `${g.name} ${ROMAN[g.tier]}`;

/* 我的寵物面板（我的家裡） */
const AUTO_FUNCS=['plant','water','harvest','feed','weed','bug','swat','dog','scare'];
function autoProgress(me){ const pt=partyOf(me), on=new Set(pt.map(p=>GEAR[p.g]&&GEAR[p.g].func).filter(Boolean).map(f=>f==='clear'?'feed':f));
  return {pets:pt.length, funcs:AUTO_FUNCS.filter(f=>on.has(f)).length, missing:AUTO_FUNCS.filter(f=>!on.has(f))}; }
function autoProgressHTML(me){ const a=autoProgress(me); if(a.pets>=9 && a.funcs>=9) return `<div class="autobar done">🎉 <b>全自動農場</b>完成！休息的時候農場也在幫你賺錢</div>`;
  return `<div class="autobar"><b>🤖 全自動農場進度</b>：寵物 ${a.pets}/9・裝備 ${a.funcs}/9 種<br><small>開滿 9 隻寵物、插上 9 種不同功能的裝備（${a.missing.map(f=>GEAR_FUNC[f]?GEAR_FUNC[f][1]+GEAR_FUNC[f][0]:f).join('、')||'—'}），休息時間也在賺錢！</small></div>`; }
function beastPanelHTML(){
  const me=S.me, pt=partyOf(me);
  return autoProgressHTML(me) + partyRowHTML(me, true) + `<div class="rhint" style="text-align:center">夥伴 ${pt.length}/${me.party_cap||1} 隻・👑 第一隻是隊長・點寵物下方的格子可以插裝備</div>
    <div class="homebtns"><button class="btn sub" id="hCh">🐾 換夥伴</button><button class="btn o" id="hBag">🎒 背包</button></div>
    <div class="homebtns"><button class="btn" id="hPlace">🖐️ 擺放城鎮</button></div>`;
}
function bindBeastPanel(){ document.querySelectorAll('#md [data-pg]').forEach(b=>b.onclick=()=>openGearBag(+b.dataset.pg)); $('hCh').onclick=()=>openBeastPark('mine'); $('hBag').onclick=()=>openPack(); if($('hPlace')) $('hPlace').onclick=()=>{ closeModal(); enterDecorEdit(); }; }

/* 自動播種要種什麼、自動餵食要拿什麼餵 */
function autoSeedN(me){ return Math.max(0, ...partyOf(me).map(p=>GEAR[p.g]).filter(g=>g&&g.func==='plant').map(g=>+g.val)); }
function autoSeedHTML(){ const me=S.me, N=autoSeedN(me);
  const opt = sel => CROPS.filter(c=>me.lv>=c.lv || c.id===sel).map(c=>`<option value="${c.id}" ${sel===c.id?'selected':''}>${c.rare?'✨':''}${c.name}（${me.seeds[c.id]||0} 包）</option>`).join('');
  const n1 = me.auto_seed ? (me.auto_n1!=null ? me.auto_n1 : N) : '', n2 = me.auto_seed2 ? (me.auto_n2||0) : '';
  return `<div class="autoseed2">
    <div class="autoseed">🌱 1️⃣<select id="aSeed"><option value="">（不種）</option>${opt(me.auto_seed)}</select> 種 <input id="aN1" type="number" min="0" max="${N||99}" value="${n1}" class="anum"> 塊</div>
    <div class="autoseed">🌱 2️⃣<select id="aSeed2"><option value="">（不選）</option>${opt(me.auto_seed2)}</select> 種 <input id="aN2" type="number" min="0" max="${N||99}" value="${n2}" class="anum"> 塊</div>
    <div class="rhint">自動播種範圍：共 <b>${N}</b> 塊田${N?'':'（要先讓夥伴戴上自動播種裝備）'}。前面幾塊種 1️⃣，接下來種 2️⃣；某一種的種子用完會改種另一種，兩種都沒有才空著。</div>
    <div style="text-align:right"><button class="btn" id="aSeedSave">儲存自動播種</button></div></div>`; }
function autoFeedHTML(){ const me=S.me;
  const opts = CROPS.filter(c=>(me.crops[c.id]||0)>0 || me.auto_feed===c.id).map(c=>`<option value="${c.id}" ${me.auto_feed===c.id?'selected':''}>${c.name}（穀倉 ${me.crops[c.id]||0} 個）</option>`).join('');
  return `<div class="autoseed">🥕 餵動物要用：<select id="aFeed"><option value="">（自動挑最便宜的作物）</option>${opts}</select></div><div class="rhint">手動餵食和自動餵食裝備都會用這個；指定的作物不夠就不會餵</div>`; }
function bindAutoSel(){
  if($('aSeed')){ const N=autoSeedN(S.me);
    $('aSeed').onchange=()=>{ if($('aSeed').value && $('aN1').value==='') $('aN1').value = Math.max(0, N - (+$('aN2').value||0)); };
    $('aSeed2').onchange=()=>{ if($('aSeed2').value && $('aN2').value==='') $('aN2').value = Math.max(0, N - (+$('aN1').value||0)); };
    $('aSeedSave').onclick=async()=>{ const c1=$('aSeed').value||null, c2=c1?($('aSeed2').value||null):null, n1=c1?Math.max(0,+$('aN1').value||0):null, n2=c2?Math.max(0,+$('aN2').value||0):null;
      if(c2 && c2===c1) return toast('第二種要選不同的作物');
      if(N && (n1||0)+(n2||0) > N) return toast(`兩種加起來最多 ${N} 塊`);
      try{ applyState(await rpc('farm_set_auto_seed2',{p_c1:c1,p_n1:n1,p_c2:c2,p_n2:n2})); refresh(); sfx('coin');
        toast(!c1?'不自動播種':`會自動種${CROP[c1].name} ${n1} 塊${c2?`、${CROP[c2].name} ${n2} 塊`:''}`); }catch(err){ toast(err.message); } };
  }
  if($('aFeed')) $('aFeed').onchange=async e=>{ try{ applyState(await rpc('farm_set_auto_feed',{p_crop:e.target.value||null})); refresh(); toast(e.target.value?`會用${CROP[e.target.value].name}餵動物`:'自動挑最便宜的作物來餵'); }catch(err){ toast(err.message); } };
}

/* 這件裝備現在是誰在穿 */
function gearWearTag(id, except){ const me=S.me, pt=partyOf(me), who=pt.map((p,i)=>({p,i})).filter(x=>x.p.g===id && x.i!==except);
  if(!who.length) return except==null ? '<span class="tag wear none">沒有寵物穿</span>' : '';
  return who.map(x=>`<span class="tag wear"><img src="${petSrc(x.p.s, me)}" alt="">${x.i===0?'👑':''}${esc(bName(x.p.s))} 穿著</span>`).join(' '); }
/* 裝備背包 */
/* 下一階裝備與升級按鈕（裝備欄、背包裡都能直接升級） */
const gearNext = g => g && GEAR_LIST.find(x=>x.func===g.func && x.tier===g.tier+1);
function gearUpBtn(g){ const me=S.me, n=gearNext(g); if(!n) return '<span class="tag" style="background:#E8F8EE;color:#2E9660">已滿階</span>';
  if(n.gold!=null && me.lv<n.lv) return `<span class="lock">Lv${n.lv} 可升級</span>`;
  const poor = n.gold!=null ? me.gold<n.gold : (me.gems||0)<n.gems, cost = n.gold!=null ? `${n.gold.toLocaleString()} 金` : `💎${n.gems}`;
  return `<button class="mini ${n.gems!=null?'gem':''}" data-gup="${n.id}" ${poor?'disabled':''}>⬆️ 升 ${ROMAN[n.tier]} 階<br>${cost}</button>`; }
function openGearBag(slot){
  slot=slot||0; const me=S.me, pt=JSON.parse(JSON.stringify(partyOf(me))), mem=pt[slot]||pt[0], own=Object.entries(me.gear||{}).filter(([id,n])=>n>0 && GEAR[id]).map(([id,n])=>[GEAR[id],n]).sort((a,b)=>GEAR_LIST.indexOf(a[0])-GEAR_LIST.indexOf(b[0]));
  const cur=GEAR[mem.g], used={}; pt.forEach(p=>{ if(p.g) used[p.g]=(used[p.g]||0)+1; });
  let body = `<div class="sec">${bName(mem.s)}${slot===0?'（👑隊長）':''}的裝備欄</div>`;
  body += cur ? `<div class="row gon"><div class="ic">${gearImg(cur,44)}</div><div class="tx"><b>${gearTitle(cur)}</b> <span class="tag">${GEAR_FUNC[cur.func][1]} ${GEAR_FUNC[cur.func][0]}</span><div>${gearDesc(cur)}</div>${gearNext(cur)?`<div class="gnext">下一階 ${esc(gearTitle(gearNext(cur)))}：${gearDesc(gearNext(cur))}</div>`:''}</div><div class="ibtns">${gearUpBtn(cur)}<button class="mini o" data-uneq>卸下</button></div></div>`
    : `<div class="empty" style="padding:8px 0">還沒有插上裝備</div>`;
  if(cur && cur.func==='plant') body += autoSeedHTML();
  if(cur && (cur.func==='feed'||cur.func==='clear')) body += autoFeedHTML();
  body += `<div class="sec">背包裡的裝備</div>`;
  body += own.length ? own.map(([g,n])=>`<div class="row"><div class="ic">${gearImg(g,44)}</div><div class="tx"><b>${gearTitle(g)}</b> <span class="tag">×${n}</span> ${gearWearTag(g.id, slot)}<div>${GEAR_FUNC[g.func][1]} ${GEAR_FUNC[g.func][0]}：${gearDesc(g)}</div></div>
      <div class="ibtns">${mem.g===g.id?'<span class="tag" style="background:#E8F8EE;color:#2E9660">裝備中</span>':`<button class="mini" data-eq="${g.id}">${(used[g.id]||0)>=n?'換過來':'插上'}</button>`}${mem.g===g.id?'':gearUpBtn(g)}</div></div>`).join('')
    : `<div class="empty">還沒有裝備<br><small>可以在綜合商店買、收成時撿到寶箱，或升到 Lv5／10／15／20 領禮物</small></div>`;
  modal('寵物裝備', body, [['🛒 買裝備','o',()=>openGearShop()]]);
  const md=$('md');
  md.querySelectorAll('[data-eq]').forEach(b=>b.onclick=async()=>{ const id=b.dataset.eq, n=(me.gear||{})[id]||0;
    // 數量不夠就從別隻夥伴身上拿過來
    if((used[id]||0)>=n){ for(let i=pt.length-1;i>=0;i--){ if(i!==slot && pt[i].g===id){ pt[i].g=null; break; } } }
    pt[slot].g=id; await saveParty(pt,'裝備好了！'); openGearBag(slot); });
  md.querySelectorAll('[data-uneq]').forEach(b=>b.onclick=async()=>{ pt[slot].g=null; await saveParty(pt); openGearBag(slot); });
  md.querySelectorAll('[data-gup]').forEach(b=>b.onclick=async()=>{ const g=GEAR[b.dataset.gup];
    try{ applyState(await rpc('farm_buy_gear',{p_id:g.id})); refresh(); sfx('lvup'); fxConfetti(); toast(`升級成 ${gearTitle(g)}！`); openGearBag(slot); }catch(e){ toast(e.message); } });
  bindAutoSel();
}

/* 裝備商店（升級制）：每種功能先買 I 階，再一階一階升級；I、II 階用金幣，III、IV 階用鑽石 */
const gearOwned = (me, f) => GEAR_LIST.filter(g=>g.func===f && ((me.gear||{})[g.id]||0)>0).sort((a,b)=>b.tier-a.tier)[0] || null;
function openGearShop(){
  if(mode==='visit') return toast('回到自己的農場才能買東西');
  const me=S.me, funcs=[...new Set(GEAR_LIST.map(g=>g.func==='clear'?'feed':g.func))];
  petShopTab='gear';
  let body=petShopTabs()+`<div class="rhint" style="margin-bottom:6px">每種裝備只能有 1 件。先買 I 階，之後升級會直接變成下一階（插在寵物身上的也會自動換新）。<br>🎁 自己動手收成有機會掉出 I／II 階裝備寶箱（成熟 1 小時以上的作物 ${Math.round((+(CFG_SET.gear_drop??0.01))*1000)/10}%${+(CFG_SET.gear_drop_daily??0)>0?`，每天最多 ${+CFG_SET.gear_drop_daily} 個`:''}）。</div>`;
  funcs.forEach(f=>{ const tiers=GEAR_LIST.filter(g=>(g.func==='clear'?'feed':g.func)===f).sort((a,b)=>a.tier-b.tier); if(!tiers.length) return;
    const cur=gearOwned(me, tiers[0].func), next=cur ? tiers.find(g=>g.tier===cur.tier+1) : tiers[0], show=cur||tiers[0];
    const pips=tiers.map(g=>`<span class="tp${cur&&g.tier<=cur.tier?' on':''}">${ROMAN[g.tier]}</span>`).join('');
    const prices=tiers.map(g=>`<span class="tpr${cur&&g.tier<=cur.tier?' on':''}">${ROMAN[g.tier]} ${g.gold!=null?`${g.gold.toLocaleString()}金`:`💎${g.gems}`}</span>`).join('');
    let btn;
    if(!next) btn=`<span class="tag" style="background:#E8F8EE;color:#2E9660">已滿階</span>`;
    else { const lock=next.gold!=null && me.lv<next.lv, poor=next.gold!=null ? me.gold<next.gold : (me.gems||0)<next.gems, cost=next.gold!=null?`${next.gold.toLocaleString()} 金`:`💎${next.gems}`;
      btn = lock ? `<span class="lock">Lv${next.lv} 解鎖</span>` : `<button class="mini ${next.gems!=null?'gem':''}" data-bg="${next.id}" ${poor?'disabled':''}>${cur?'升到 '+ROMAN[next.tier]+' 階':'購買'}<br>${cost}</button>`; }
    body+=`<div class="row gshop"><div class="ic">${gearImg(show,44)}</div><div class="tx"><b>${GEAR_FUNC[f][1]} ${GEAR_FUNC[f][0]}</b> <span class="tps">${pips}</span>
      <div>${cur?`目前 ${esc(gearTitle(cur))}：${gearDesc(cur)}`:'還沒有'}</div>${cur?`<div style="margin-top:3px">${gearWearTag(cur.id)}</div>`:''}${next?`<div class="gnext">下一階 ${esc(gearTitle(next))}：${gearDesc(next)}</div>`:''}<div class="tprs">${prices}</div></div>${btn}</div>`;
  });
  modal(`綜合商店　<span style="font-size:14px;color:var(--ink2)">${S.me.gold.toLocaleString()} 金・💎${(S.me.gems||0).toLocaleString()}</span>`, body);
  const md=$('md'); bindPetShopTabs();
  md.querySelectorAll('[data-bg]').forEach(b=>b.onclick=async()=>{ const g=GEAR[b.dataset.bg], upgrade=g.tier>1;
    try{ applyState(await rpc('farm_buy_gear',{p_id:g.id})); refresh(); sfx(upgrade?'lvup':'coin');
      if(upgrade){ fxConfetti(); toast(`升級成 ${gearTitle(g)}！`); return openGearShop(); }
      const pt=JSON.parse(JSON.stringify(partyOf(S.me)));
      const pick=pt.map((p,i)=>{ const cg=GEAR[p.g]; return `<button class="eqpick" data-eqto="${i}"><img src="${petSrc(p.s, S.me)}" alt=""><b>${i===0?'👑 ':''}${esc(bName(p.s))}</b><small>${cg?`換下 ${esc(gearTitle(cg))}`:'空的裝備格'}</small></button>`; }).join('');
      modal('買到了！', `<div style="text-align:center;padding:6px 0">${gearImg(g,80)}<div style="font-weight:900;font-size:18px;margin-top:6px">${gearTitle(g)}</div><div style="color:var(--ink2);font-weight:700;margin-top:4px">${gearDesc(g)}</div></div>
        <div class="sec">要插在哪一隻寵物身上？</div><div class="eqgrid">${pick}</div>`,
        [['先放背包','sub',()=>openGearShop()]]);
      document.querySelectorAll('[data-eqto]').forEach(b=>b.onclick=async()=>{ const i=+b.dataset.eqto;
        for(let j=0;j<pt.length;j++) if(j!==i && pt[j].g===g.id) pt[j].g=null;
        pt[i].g=g.id; await saveParty(pt, `${bName(pt[i].s)} 裝備好了！`); closeModal(); });
    }catch(e){ toast(e.message); } });
}

/* 得到裝備（寶箱／升級禮物） */
function showGift(txt){
  const names = String(txt).split('、');
  const items = names.map(s=>{ const nm=s.replace(/^.*：/,''); return GEAR_LIST.find(g=>g.name===nm); }).filter(Boolean);
  fxConfetti(); sfx('lvup');
  modal('🎁 獲得裝備！', `<div style="text-align:center;padding:6px 0">${items.map(g=>`<div class="giftg">${gearImg(g,72)}<div><b>${gearTitle(g)}</b><small>${GEAR_FUNC[g.func][1]} ${gearDesc(g)}</small></div></div>`).join('')}
    <div style="color:var(--ink2);font-weight:700;margin-top:6px">${names.map(s=>s.replace(/：.*/,'')).join('、')}</div></div>`,
    [['去裝備','',openGearBag],['好','sub',closeModal]]);
}

/* 進化動畫 */
function playEvolve(fromKey, toKey){
  const ov=document.createElement('div'); ov.className='evo';
  ov.innerHTML=`<div class="evo-rays"></div><div class="evo-stage"><img class="evo-old" src="${chrSrc(fromKey)}" alt=""><img class="evo-new" src="${chrSrc(toKey)}" alt=""></div>
    <div class="evo-flash"></div><div class="evo-txt"><div class="t1">咦？${chrName(fromKey)} 的樣子……</div><div class="t2">進化成功！</div><div class="t3">${chrName(fromKey)} → <b>${chrName(toKey)}</b></div><button class="btn">太好了！</button></div>`;
  document.body.appendChild(ov); sfx('tap');
  setTimeout(()=>{ sfx('lvup'); vib([40,40,80]); }, 2300);
  setTimeout(()=>{ fxConfetti(); for(let k=0;k<14;k++) spawn('⭐', innerWidth/2+(Math.random()-.5)*260, innerHeight*0.42+(Math.random()-.5)*200, 'emo', 1500); }, 2450);
  ov.querySelector('.btn').onclick=()=>{ ov.classList.add('out'); setTimeout(()=>ov.remove(), 400); };
}
function checkEvolve(){
  if(!S || mode!=='home') return;
  const k='ytzt_stage_'+S.me.id, st=chrStage(S.me.lv);
  let prev=null; try{ prev=+localStorage.getItem(k)||null; }catch(e){}
  if(prev && st>prev){ const sp=chrSpecies(S.me.chara); setTimeout(()=>playEvolve(sp+prev, sp+st), 900); }
  try{ localStorage.setItem(k, st); }catch(e){}
}

/* ================= 建築外觀商店 ================= */
let SKINS = [], skinTab = 'home';
const SKIN_BLD = {home:'我的家', barn:'穀倉', shop:'種子商店', fountain:'噴水池', pen:'寵物娛樂廳', decor:'裝飾店'};
function openSkinShop(t){
  if(mode==='visit') return toast('回到自己的農場才能換外觀');
  if(t) skinTab=t;
  const me=S.me, owned=me.skins||{}, on=(me.skin_on||{})[skinTab]||SKIN_DEF[skinTab];
  const tabs=`<div class="tabs sktabs">${Object.keys(SKIN_BLD).map(k=>`<button data-skt="${k}" class="${skinTab===k?'on':''}">${SKIN_BLD[k]}</button>`).join('')}</div>`;
  const styles=[SKIN_DEF[skinTab], ...SKINS.filter(x=>x.bld===skinTab).map(x=>x.style)];
  const body=shopNav('skin')+tabs+`<div class="skgrid">${styles.map(st=>{ const def=st===SKIN_DEF[skinTab], k=SKINS.find(x=>x.bld===skinTab&&x.style===st), have=def||owned[skinTab+'_'+st], cur=st===on;
    const price = k ? (k.gold!=null?`${k.gold.toLocaleString()} 金`:`💎${k.gems}`) : '';
    return `<div class="skcard${cur?' on':''}"><img src="${A('th_'+st+'_'+SKIN_PART[skinTab])}" alt=""><b>${def?'預設':(k?k.name:SKIN_NAME[st])}</b>
      ${cur?'<span class="tag" style="background:#E8F8EE;color:#2E9660">使用中</span>':have?`<button class="mini" data-skuse="${def?'def':st}">套用</button>`:`<button class="mini ${k&&k.gems!=null?'gem':''}" data-skbuy="${k.id}" ${(k.gold!=null?me.gold<k.gold:(me.gems||0)<k.gems)?'disabled':''}>${price}</button>`}</div>`; }).join('')}</div>
    <div class="rhint" style="text-align:center;margin-top:8px">買過的外觀可以隨時免費切換，好友來拜訪也看得到</div>`;
  modal(shopTitle(), body); bindShopNav();
  const md=$('md');
  md.querySelectorAll('[data-skt]').forEach(b=>b.onclick=()=>openSkinShop(b.dataset.skt));
  md.querySelectorAll('[data-skuse]').forEach(b=>b.onclick=async()=>{ try{ applyState(await rpc('farm_set_skin',{p_bld:skinTab,p_style:b.dataset.skuse})); refresh(); sfx('coin'); openSkinShop(); }catch(e){ toast(e.message); } });
  md.querySelectorAll('[data-skbuy]').forEach(b=>b.onclick=async()=>{ try{ applyState(await rpc('farm_buy_skin',{p_id:b.dataset.skbuy})); refresh(); fxConfetti(); sfx('lvup'); toast('外觀已套用！'); openSkinShop(); }catch(e){ toast(e.message); } });
}

/* ================= 自動更新：發現新版就提示玩家更新 ================= */
let newBuild = null;
function goUpdate(){ const u=new URL(location.href); u.searchParams.set('v', newBuild||Date.now()); location.replace(u.toString()); }
async function checkUpdate(fromWake){
  try{
    const v = ((await (await fetch('version.txt?u='+Date.now(), {cache:'no-store'})).text())||'').trim().match(/^\d+$/)?.[0];
    if(!v || v===BUILD) return;
    newBuild = v;
    // 剛切回遊戲、沒有開視窗、沒在操作：直接換新版
    if(fromWake && !document.querySelector('#ov.show') && !(typeof ui!=='undefined' && ui.busy)) return goUpdate();
    if(!$('updBar')){ const d=document.createElement('button'); d.id='updBar'; d.innerHTML='✨ 有新版本！點這裡更新'; d.onclick=goUpdate; document.body.appendChild(d); }
  }catch(e){}
}
setInterval(()=>{ if(!document.hidden) checkUpdate(false); }, 180000);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) checkUpdate(true); });
setTimeout(()=>checkUpdate(false), 3000);

/* ================= 自動農場設定（我的夥伴最上面） ================= */
const AUTO_ROWS = [['plant',['plant']],['water',['water']],['harvest',['harvest']],['weed',['weed']],['bug',['bug']],['feed',['feed','clear']],['swat',['swat']],['dog',['dog']],['scare',['scare']]];
function autoInfo(me, key, funcs){ // 哪隻夥伴戴著、效果
  const list = partyOf(me).map(p=>({p,g:GEAR[p.g]})).filter(x=>x.g && funcs.includes(x.g.func));
  if(!list.length) return null;
  list.sort((a,b)=> key==='harvest' ? (+a.g.val)-(+b.g.val) : (+b.g.val)-(+a.g.val));
  return list[0];
}
const autoOn = (me, key) => !((me.auto_off||{})[key]);
function autoBarHTML(){ const me=S.me;
  const on = AUTO_ROWS.filter(([k,f])=>autoInfo(me,k,f) && autoOn(me,k)).map(([k])=>GEAR_FUNC[k][1]).join('');
  return `<button class="autobtn" id="hAuto"><b>⚙️ 自動農場設定</b><span>${on || '還沒有開啟的自動功能'}</span><i>›</i></button>`; }
function openAutoFarm(back){
  if(mode==='visit') return;
  const me=S.me;
  const rows = AUTO_ROWS.map(([k,f])=>{ const inf=autoInfo(me,k,f), on=autoOn(me,k), [name,ic]=GEAR_FUNC[k];
    const who = inf ? `<img src="${petSrc(inf.p.s, me)}" alt="">${esc(bName(inf.p.s))}・${ROMAN[inf.g.tier]} 階：${gearDesc(inf.g)}` : '還沒有裝備，可以到綜合商店買';
    const extra = inf && on ? (k==='plant' ? autoSeedHTML() : k==='feed' ? autoFeedHTML() : '') : '';
    return `<div class="arow${inf?'':' off'}"><div class="ahd"><span class="aic">${ic}</span><div class="atx"><b>${name}</b><small>${who}</small></div>
      ${inf?`<button class="sw${on?' on':''}" data-asw="${k}" aria-label="${name}"><i></i></button>`:''}</div>${extra}</div>`; }).join('');
  modal('⚙️ 自動農場設定', `<div class="rhint">裝備戴在夥伴身上才會運作；關掉的功能離線時也不會做（例如想自己收成拿寶箱，就把自動收成關掉）。</div>${rows}`, [back ? ['← 返回','sub',back] : ['← 回我的夥伴','sub',()=>openBeastPark('mine')]]);
  document.querySelectorAll('#md [data-asw]').forEach(b=>b.onclick=async()=>{ const k=b.dataset.asw, off=autoOn(S.me,k);
    try{ applyState(await rpc('farm_set_auto_off',{p_func:k,p_off:off})); refresh(); sfx('coin'); toast(`${GEAR_FUNC[k][0]}：${off?'關閉':'開啟'}`); openAutoFarm(back); }catch(e){ toast(e.message); } });
  bindAutoSel();
}
