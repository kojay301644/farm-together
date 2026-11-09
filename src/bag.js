/* ================= 背包：商店買到的東西都分類放在這裡 ================= */
const BAG_TABS = [['gear','🐾 寵物裝備'],['decor','🎨 裝飾'],['skin','🏠 建築外觀'],['tone','🌈 城鎮色調']];
let bagTab = 'gear';
function openPack(t){
  if(mode==='visit') return toast('回到自己的農場才能打開背包');
  if(t) bagTab=t;
  const me=S.me;
  let body = `<div class="snav">${BAG_TABS.map(([k,n])=>`<button data-bag="${k}" class="${k===bagTab?'on':''}">${n}</button>`).join('')}</div>`;
  if(bagTab==='gear'){
    const pt=partyOf(me), used={}; pt.forEach((p,i)=>{ if(p.g) (used[p.g]=used[p.g]||[]).push(i); });
    const own=Object.entries(me.gear||{}).filter(([id,n])=>n>0&&GEAR[id]).map(([id,n])=>[GEAR[id],n]).sort((a,b)=>GEAR_LIST.indexOf(a[0])-GEAR_LIST.indexOf(b[0]));
    body += own.length ? own.map(([g,n])=>{ const on=(used[g.id]||[]).map(i=>bName(pt[i].s)).join('、');
      return `<div class="row"><div class="ic">${gearImg(g,44)}</div><div class="tx"><b>${gearTitle(g)}</b> <span class="tag">×${n}</span> ${gearWearTag(g.id)}<div>${GEAR_FUNC[g.func][1]} ${GEAR_FUNC[g.func][0]}：${gearDesc(g)}</div></div></div>`; }).join('')
      : `<div class="empty">還沒有裝備<br><small>可以在寵物商店買、收成時撿到寶箱，或升級領禮物</small></div>`;
    body += `<div class="sec">自動設定</div>` + autoSeedHTML() + autoFeedHTML();
    body += `<div class="rhint" style="text-align:center;margin-top:8px">到「我的家」點寵物下面的裝備格就能插上</div>`;
  } else if(bagTab==='decor'){
    const inv=me.decor_inv||{}, placed={}; (me.decor_place||[]).forEach(d=>placed[d.i]=(placed[d.i]||0)+1);
    const own=DECOR.filter(d=>(inv[d.id]||0)>0);
    body += own.length ? own.map(d=>`<div class="row"><div class="ic"><img src="${A('dc_'+d.id)}" style="width:44px;height:44px;object-fit:contain" alt=""></div>
        <div class="tx"><b>${esc(d.name)}</b> <span class="tag">擺了 ${placed[d.id]||0}/${inv[d.id]}</span>${d.bonus?`<div style="color:#7B6CF6">${bonusTxt(d)}</div>`:''}</div>
        <button class="mini" data-pd="${d.id}" ${(placed[d.id]||0)>=inv[d.id]?'disabled':''}>擺放</button></div>`).join('')
      : `<div class="empty">還沒有裝飾，去建築商店買一些吧！</div>`;
  } else if(bagTab==='skin'){
    const owned=me.skins||{}, on=me.skin_on||{};
    body += Object.keys(SKIN_BLD).map(b=>{ const cur=on[b]||SKIN_DEF[b];
      const styles=[SKIN_DEF[b], ...SKINS.filter(x=>x.bld===b && owned[b+'_'+x.style]).map(x=>x.style)];
      return `<div class="sec">${SKIN_BLD[b]}</div><div class="skgrid">${styles.map(st=>{ const def=st===SKIN_DEF[b], k=SKINS.find(x=>x.bld===b&&x.style===st);
        return `<div class="skcard${st===cur?' on':''}"><img src="${A('th_'+st+'_'+SKIN_PART[b])}" alt=""><b>${def?'預設':(k?k.name:SKIN_NAME[st])}</b>
          ${st===cur?'<span class="tag" style="background:#E8F8EE;color:#2E9660">使用中</span>':`<button class="mini" data-sk="${b}|${def?'def':st}">套用</button>`}</div>`; }).join('')}</div>`; }).join('');
  } else {
    const own=me.tones||{}, cur=me.tone||'spring';
    const list=TONES.filter(t=>t.id==='spring'||own[t.id]);
    body += `<div class="skgrid">${list.map(t=>{ const fx=TONE_FX[t.id]||TONE_FX.spring;
      return `<div class="skcard${t.id===cur?' on':''}"><div class="tsw" data-tpv="${t.id}" style="background:linear-gradient(${fx.sky[0]},${fx.sky[1]} 60%,${fx.sky[2]})"><img alt="" src="${A('home_island')}"><span>${TONE_ICON[fx.fx]||'🌼'}</span></div><b>${esc(t.name)}</b>
        ${t.id===cur?'<span class="tag" style="background:#E8F8EE;color:#2E9660">使用中</span>':`<button class="mini" data-tu="${t.id}">套用</button>`}</div>`; }).join('')}</div>`;
  }
  modal('🎒 背包', body, [[bagTab==='gear'?'🛒 去寵物商店':'🛒 去建築商店','o',()=>openShopTab(bagTab==='gear'?'gear':bagTab)]]);
  const md=$('md');
  md.querySelectorAll('[data-bag]').forEach(b=>b.onclick=()=>openPack(b.dataset.bag));
  md.querySelectorAll('[data-pd]').forEach(b=>b.onclick=()=>enterDecorEdit(b.dataset.pd));
  bindAutoSel();
  md.querySelectorAll('[data-sk]').forEach(b=>b.onclick=async()=>{ const [bld,st]=b.dataset.sk.split('|');
    try{ applyState(await rpc('farm_set_skin',{p_bld:bld,p_style:st})); refresh(); sfx('coin'); openPack(); }catch(e){ toast(e.message); } });
  md.querySelectorAll('[data-tu]').forEach(b=>b.onclick=async()=>{ try{ applyState(await rpc('farm_set_tone',{p_id:b.dataset.tu})); refresh(); sfx('coin'); openPack(); }catch(e){ toast(e.message); } });
  md.querySelectorAll('[data-tpv]').forEach(d=>{ const im=d.querySelector('img'), f=TONE_FX[d.dataset.tpv]||{};
    tonedURL(A('home_island'),d.dataset.tpv).then(u=>{ im.src=u; });
    if(f.post) d.insertAdjacentHTML('beforeend',`<i style="position:absolute;inset:0;background:${f.post[1]};opacity:${f.post[2]};mix-blend-mode:${f.post[0]}"></i>`); });
}
