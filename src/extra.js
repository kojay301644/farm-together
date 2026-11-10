
/* ================= 新手教學 ================= */
const GAME_URL = 'https://kojay301644.github.io/farm-together/';
const bEl = id => document.querySelector(`[data-b="${id}"]`);
const TUT_STEPS = [
  {text:'歡迎來到你的農場！先點一塊<b>空地</b>，選「白蘿蔔」種下去吧 🌱', target:()=>plotEls[S.plots.findIndex(p=>p.s==='empty'||p.s==='grow')], done:()=>S.plots.some(p=>p.s==='grow'), next:true},
  {text:'下面是<b>工具列</b>：田裡缺水、長草或有蟲時，選對應的工具點田地。缺水和草、蟲都會讓作物<b>長得比較慢</b>，草和蟲還會讓<b>收成變少</b>喔', target:()=>$('tools'), next:true},
  {text:'白蘿蔔大約 <b>2 分鐘</b>成熟。成熟後選「收成」點它，作物就會收進穀倉', target:()=>plotEls[S.plots.findIndex(p=>p.s==='grow')], done:()=>Object.values(S.me.crops||{}).some(n=>n>0), next:true},
  {text:'點<b>穀倉</b>可以把作物賣掉換金幣；穀倉裡的<b>種子商店</b>可以買更多、更高級的種子', target:()=>bEl('barn'), next:true},
  {text:'這是<b>你的家</b>：最上面的<b>⚙️ 自動農場設定</b>可以管理寵物的自動功能；這裡也能幫寵物插裝備、打開背包、<b>擺放城鎮</b>裝飾、換<b>稱號・頭像框</b>，還有<b>成就</b>可以拿鑽石 💎', target:()=>bEl('home'), next:true},
  {text:'<b>寵物園</b>可以買新寵物、讓牠們上場當夥伴。夥伴會在農場陪你，插上裝備還會<b>自動幫你做事</b>', target:()=>bEl('pen'), next:true},
  {text:'<b>綜合商店</b>賣寵物、寵物造型、寵物裝備和道具。裝備會自動播種、澆水、收成、除草、除蟲…插滿 9 種就是<b>全自動農場</b>，休息時間也在賺錢！', target:()=>bEl('decor'), next:true},
  {text:'上面的功能條：點<b>頭像</b>換頭像，📬 <b>禮物信箱</b>收獎勵，📖 <b>遊戲說明</b>，⚙️ 設定（可以開關🎵音樂）。左邊 ✍️ <b>每日簽到</b>（連續 7 天有大獎）和 🎟️ <b>每日轉盤</b>（每天免費轉 1 次）！', target:()=>$('bGift'), next:true},
  {text:'最後，點中間的<b>好友廣場</b>用暱稱加好友、拜訪鄰居，成熟的菜可以偷喔！被偷或被惡作劇時，好友廣場會出現<b>紅點</b>，可以去「動態」看是誰還能<b>復仇</b>。按「開始玩！」還有一隻<b>寵物夥伴</b>送給你 🎁', target:()=>bEl('board'), next:true, last:true},
];
/* 新功能開放時的一次性教學 */
const FEAT_TUTS = [
  {id:'till', when:()=>S.plots.some(p=>p.s==='wild' && LAND[p.i] && S.me.lv>=LAND[p.i].lv && S.me.gold>=LAND[p.i].cost),
   text:'🪓 有<b>荒地</b>可以開墾了！點荒地花一點金幣開墾，就能種更多田', target:()=>plotEls[S.plots.findIndex(p=>p.s==='wild' && LAND[p.i] && S.me.lv>=LAND[p.i].lv)]},
  {id:'party2', when:()=>(S.me.party_cap||1)>=2,
   text:'🐾 <b>第 2 個夥伴格</b>開放了！到<b>寵物園</b>買新寵物，按「上場當夥伴」讓牠一起幫忙', target:()=>bEl('pen')},
  {id:'gear', when:()=>S.me.lv>=3 && !Object.values(S.me.gear||{}).some(n=>n>0),
   text:'🛡️ <b>綜合商店</b>可以買裝備了！買完選一隻寵物插上，牠就會自動幫你做事（例如自動澆水、自動收成）', target:()=>bEl('decor')},
  {id:'ranch', when:()=>S.me.lv>=RANCH_LV,
   text:'🐔 <b>牧場</b>開放了！買小雞、用穀倉的作物餵牠，過一段時間就會生產雞蛋，可以拿去賣錢', target:()=>bEl('coop')},
  {id:'auto', when:()=>partyOf(S.me).some(p=>p.g),
   text:'🤖 你的寵物開始用裝備工作了！到<b>我的家</b>最上面的「⚙️ 自動農場設定」可以看每個功能由誰負責、單獨開關，還能設定自動播種要種什麼。開滿 9 隻寵物、插上 9 種裝備，農場就會全自動', target:()=>bEl('home')},
  {id:'autoset', when:()=>{ if(window._autoOld===undefined) window._autoOld=featSeen('auto'); return window._autoOld && partyOf(S.me).some(p=>p.g); },  // 只給之前看過舊版說明的玩家
   text:'⚙️ 新功能：<b>我的家</b>最上面有「<b>自動農場設定</b>」！每個自動功能都能單獨開關，自動播種還能選兩種作物、各種幾塊', target:()=>bEl('home')},
  {id:'rare', when:()=>S.me.lv>=2,
   text:'✨ 穀倉的種子商店最上面有<b>稀有種子</b>（用鑽石買，每天限 3 顆），種下去會發光，賣價特別高！', target:()=>bEl('barn')},
  {id:'bin', when:()=>binCount(S.me.bin)>0,
   text:'🧺 寵物自動收成的東西會先放在<b>收集倉</b>。記得常來點它「收進穀倉」，不然別人可以來偷！', target:()=>bEl('bin')},
  {id:'steal', when:()=>S.me.lv > (+(CFG_SET.newbie_lv??3)),
   text:'⚠️ <b>新手保護</b>結束了！現在鄰居可以來偷你的菜，你也可以去偷別人的。插上<b>看門狗</b>裝備可以擋小偷', target:()=>bEl('board')},
  {id:'shop', when:()=>S.me.lv>=5,
   text:'🏠 <b>建築商店</b>可以買裝飾擺在農場、換建築外觀和城鎮色調，把農場打扮成你喜歡的樣子', target:()=>bEl('shop')},
];
/* 箭頭＋光圈指向目標；目標在地圖上就把畫面捲過去 */
let tutFocused = null;
function tutPoint(el){
  const a=$('tutArrow'), ring=$('tutRing');
  if(!el){ a.style.display='none'; ring.style.display='none'; return; }
  const inMap = map.contains(el);
  if(inMap && tutFocused!==el){
    tutFocused = el;
    const r0=el.getBoundingClientRect(), boxTop=$('tut').getBoundingClientRect().top || innerHeight-300;
    const wantY = 150 + (boxTop-150)/2;
    map.scrollBy({left: r0.left + r0.width/2 - innerWidth/2, top: r0.top + r0.height/2 - wantY, behavior:'smooth'});
  }
  const r=el.getBoundingClientRect();
  const d=Math.max(56, Math.min(150, Math.max(r.width, r.height)*0.75)), cy=r.top+r.height/2;
  const up = cy-d/2 < 110;   // 目標在最上面：箭頭改放下面往上指
  a.textContent = up ? '👆' : '👇';
  a.style.display=''; a.style.left=(r.left+r.width/2)+'px'; a.style.top=(up ? cy+d/2+44 : cy-d/2+10)+'px';
  ring.style.display=''; ring.style.width=ring.style.height=d+'px'; ring.style.left=(r.left+r.width/2)+'px'; ring.style.top=(r.top+r.height/2)+'px';
}
let feat = null;   // 目前顯示中的新功能教學
const featKey = id => 'ytzt_feat_' + (S && S.me.id) + '_' + id;
const featSeen = id => { try{ return localStorage.getItem(featKey(id))==='1'; }catch(e){ return true; } };
function featDone(){ if(feat){ try{ localStorage.setItem(featKey(feat.id),'1'); }catch(e){} } feat=null; $('tut').style.display='none'; $('tutArrow').style.display='none'; $('tutRing').style.display='none'; }
function featTick(){
  if(tut || !S || mode!=='home' || !tutDone()) return;
  if(document.querySelector('#ov.show')) return;
  if(!feat){ feat = FEAT_TUTS.find(f=>!featSeen(f.id) && (()=>{ try{ return f.when(); }catch(e){ return false; } })()) || null;
    if(!feat) return; tutFocused = null;
    $('tut').style.display=''; $('tutText').innerHTML=`<span class="tutn">新功能</span>${feat.text}`;
    $('tutNext').style.display=''; $('tutNext').textContent='知道了'; $('tutSkip').style.display='none'; }
  tutPoint(feat.target && feat.target());
}
let tut = null;   // {step}
const tutKey = () => 'ytzt_tut_' + (S && S.me.id);
function tutDone(){ try{ return localStorage.getItem(tutKey())==='1'; }catch(e){ return false; } }
function tutFinish(){ try{ localStorage.setItem(tutKey(),'1'); }catch(e){} tut=null; $('tut').style.display='none'; $('tutArrow').style.display='none'; $('tutRing').style.display='none';
  // 已經開放的功能，不要一次跳一堆教學：老玩家直接標記為看過
  if(S && S.me.lv > 3) FEAT_TUTS.forEach(f=>{ try{ if(f.when()) localStorage.setItem(featKey(f.id),'1'); }catch(e){} }); }
function tutMaybeStart(){
  if(!S || tutDone()) return;
  if(S.me.lv > 2) return tutFinish();   // 老玩家不顯示
  tut = {step:0}; tutRender();
}
function tutRender(){
  if(!tut) return; tutFocused = null;
  const st = TUT_STEPS[tut.step];
  $('tut').style.display = ''; $('tutSkip').style.display = '';
  $('tutText').innerHTML = `<span class="tutn">${tut.step+1}/${TUT_STEPS.length}</span>${st.text}`;
  $('tutNext').style.display = ''; $('tutSkip').textContent = '跳過教學'; tutSkipArm = 0;
  $('tutNext').textContent = st.last ? '開始玩！' : '下一步';
  tutTick();
}
function tutTick(){
  if(!tut){ featTick(); return; }
  if(mode!=='home'){ if($('tutArrow')) $('tutArrow').style.display='none'; $('tutRing').style.display='none'; return; }
  const st = TUT_STEPS[tut.step];
  if(st.done && st.done() && !st.last){ tut.step++; return tutRender(); }
  tutPoint(st.target && st.target());
}
let tutSkipArm = 0;
function tutSkip(){ // 按兩下才跳過，避免一按就整個教學沒了
  if(feat) return featDone();
  if(Date.now() - tutSkipArm < 3000) return tutFinish();
  tutSkipArm = Date.now(); $('tutSkip').textContent = '再按一次跳過';
  setTimeout(()=>{ if($('tutSkip') && Date.now()-tutSkipArm>=2900) $('tutSkip').textContent='跳過教學'; }, 3000); }
function tutNext(){ if(feat) return featDone(); if(!tut) return; if(TUT_STEPS[tut.step].last){ tutFinish(); return setTimeout(openTutPet, 300); } tut.step++; tutRender(); }
/* 完成新手教學：3 隻隨機寵物挑 1 隻 */
let tutPetPick = null;
function openTutPet(){
  if(!S || S.me.tut_pet || mode==='visit') return;
  const own=S.me.beasts||{};
  if(!tutPetPick) tutPetPick = BEASTS.filter(b=>b.gold!=null && own[b.id]==null).sort(()=>Math.random()-0.5).slice(0,3).map(b=>b.id);
  if(!tutPetPick.length) return;
  modal('🎉 完成新手教學！', `<div style="text-align:center;font-weight:800;margin-bottom:8px">送你一隻寵物夥伴，挑一隻帶回家吧！</div>
    <div class="bgrid">${tutPetPick.map(id=>`<div class="bcard"><img src="${chrSrc(id+'1')}" alt=""><b>${bName(id)}</b><button class="mini o" data-tp="${id}">就是你了！</button></div>`).join('')}</div>
    <div class="rhint" style="text-align:center">選好會住進寵物園，夥伴格有空位就直接上場；插上裝備就會自動幫你做事</div>`);
  document.querySelectorAll('#md [data-tp]').forEach(b=>b.onclick=async()=>{ const id=b.dataset.tp;
    try{ applyState(await rpc('farm_tut_pet',{p_id:id})); refresh(); fxConfetti(); sfx('lvup'); tutPetPick=null;
      modal('新夥伴加入！', `<div style="text-align:center;padding:6px 0"><img src="${chrSrc(id+'1')}" style="width:140px;height:140px;object-fit:contain;animation:floaty 3s ease-in-out infinite"><div style="font-weight:900;font-size:20px;margin-top:6px">${bName(id)}</div><div style="color:var(--ink2);font-weight:700">${partyOf(S.me).some(p=>p.s===id)?'已經上場當你的夥伴了':'已經住進寵物園了（夥伴格滿了，升級開放新格子就能讓牠上場）'}</div></div>`, [['太好了！','',closeModal]]);
    }catch(e){ toast(e.message); } });
}
setInterval(tutTick, 500);
addEventListener('scroll', tutTick, true);

/* ================= 遊戲說明 ================= */
function openHelp(){
  modal('遊戲說明', `<div class="help">
    <h4>🌱 種田</h4>
    <p>點空地選種子種下，作物會隨著真實時間長大，關掉網頁也會繼續長。成熟後用「收成」點它，作物會進到穀倉。</p>
    <p>選種子的視窗最上面有「🔁 連續播種」：打勾後選一次就能一直點空地種同一種，想換種子就點下方工具列的「播種」重新選；沒打勾時每塊地都會問你要種什麼。</p>
    <h4>💧 照顧作物</h4>
    <p>土壤乾掉時作物會<b>長得比較慢</b>（速度減半），記得澆水。</p>
    <p>作物長到一成以後，田裡會隨機長出雜草和蟲（別人惡作劇也會放）。每塊田草、蟲最多各 3 個，<b>每一個</b>都會：</p>
    <ul><li>讓收成<b>少 1 個</b>（最少還是拿得到原本的 ${Math.round(+(CFG_SET.pest_floor??0.5)*100)}%）</li><li>讓作物<b>長慢 ${Math.round(+(CFG_SET.pest_slow??0.1)*100)}%</b>（最多慢 ${Math.round(+(CFG_SET.pest_slow_max??0.6)*100)}%）</li></ul>
    <p>用「除草」「除蟲」清掉就馬上恢復，每清一個拿 2 經驗。田上的血條就是被破壞的程度。</p>
    <h4>💰 賺錢與升級</h4>
    <p>到穀倉把作物賣掉換金幣，穀倉裡也有種子商店可以買種子。收成、澆水、除草除蟲都會拿到經驗，升級後可以買更高級的作物、開墾更多荒地（最多 20 塊）。</p>
    <h4>🧺 好友與偷菜</h4>
    <p>在好友廣場用暱稱加好友，就能拜訪對方農場：</p>
    <ul><li><b>偷菜</b>：成熟的作物每塊地每人只能偷一次，每塊地最多被偷走 4 成，主人一定拿得到 6 成</li>
    <li><b>幫忙</b>：幫好友除草除蟲可以拿經驗</li>
    <li><b>惡作劇</b>：在別人還沒成熟的作物放草、放蟲，或在牧場放蚊子，每次用 1 點 😈惡作劇體力。上限 ${+(CFG_SET.prank_daily??10)} 點，用掉後每 ${+(CFG_SET.prank_regen_min??10)} 分鐘回 1 點，每天凌晨補滿</li>
    <li><b>偷陌生人</b>：在「鄰居」可以偷不是好友的玩家（偷好友不用體力）。每偷一次用 1 點 ⚡偷菜體力，上限 ${+(CFG_SET.stranger_steal_daily??30)} 點，用掉後每 ${+(CFG_SET.steal_regen_min??10)} 分鐘回 1 點，每天凌晨補滿；擺出鳥居、龍雕像等裝飾可以提高體力上限</li></ul>
    <p>Lv${+(CFG_SET.newbie_lv??3)} 以下是<b>新手保護</b>，別人偷不了你，你也偷不了別人。</p>
    <p>作物成熟後要快點收，不然會被偷走喔！有人偷你的菜、放草放蟲時，畫面上方會跳出提醒，<b>好友廣場</b>也會出現紅點；到「動態」可以看是誰做的，按「😤 復仇」直接去他的農場。</p>
    <h4>🐔 牧場</h4>
    <p>Lv3 開放。在牧場買小雞、小鴨、綿羊、乳牛、小豬，用倉庫裡的作物餵牠們，過一段時間就會產出雞蛋、牛奶、羊毛等，收成後到穀倉賣錢。好友可以來偷、幫忙餵食和拍蚊子，惡作劇的人會放蚊子讓產量變少。動物頭上有 🦟 時，在主畫面<b>直接點那隻動物</b>就能拍掉；有蚊子時「牧場」標籤旁會出現紅點。</p>
    <h4>🐾 寵物夥伴</h4>
    <p>在<b>綜合商店</b>或寵物園買寵物（全部一開始就能買），再到寵物園按「上場」當夥伴。夥伴格會隨等級開放，最多 9 隻；夥伴會在農場走來走去，用裝備自動做事時會跑過去幫忙。</p>
    <p>每隻寵物都有 3 款特別造型（🪄 魔法、🤖 機甲、✨ 星辰），在綜合商店買；到寵物園點寵物就能隨時換造型或換回原本的樣子。</p>
    <h4>🛡️ 寵物裝備</h4>
    <p>每隻夥伴有 <b>1 格裝備欄</b>，插上裝備就會幫你自動做事：自動澆水、自動播種、自動除蟲、自動除草、自動餵食、自動收成、自動拍蚊子、看門狗（趕走小偷）、稻草人（擋下惡作劇）。開滿 9 隻夥伴、插上 9 種裝備，就是<b>全自動農場</b>。裝備在<b>離線時也會一直工作</b>（伺服器每 2 分鐘幫你的農場跑一次）。</p>
    <p><b>⚙️ 自動農場設定</b>：在「我的家」最上面，可以看每個自動功能由哪隻夥伴負責，也能單獨開關（例如想自己收成拿寶箱，就關掉自動收成）。</p>
    <p><b>🌱 自動播種可以選兩種作物</b>：在「⚙️ 自動農場設定」（或點戴著自動播種裝備的夥伴）選 1️⃣、2️⃣ 兩種作物和各種幾塊。前面幾塊種 1️⃣，接下來種 2️⃣；某一種的種子用完會改種另一種。</p>
    <p>每種裝備只能有 1 件，在綜合商店先買 I 階，再一階一階升級（I、II 階用金幣，III、IV 階用鑽石），升級後寵物身上的也會自動換新。</p>
    <p><b>🎁 裝備寶箱</b>：<b>自己動手收成</b>時有機會掉出寶箱（寵物自動收成不會掉）。成熟要 1 小時以上的作物，每次收成 <b>${Math.round((+(CFG_SET.gear_drop??0.01))*1000)/10}%</b>；成熟越快的作物機率越低（例如白蘿蔔只有約 1/30）。${+(CFG_SET.gear_drop_daily??0)>0?`每人每天最多 <b>${+CFG_SET.gear_drop_daily}</b> 個。`:''}寶箱只會開出 I 階（約 2/3）或 II 階（約 1/3）的隨機裝備；比你現有的高階就直接升級，同階或更低階會換成金幣（500 × 階數）。升到 Lv5／10／15／20 也有裝備禮物。</p>
    <h4>🧺 收集倉</h4>
    <p>寵物自動收成的作物、牧場產品會先放在收集倉，要自己點收集倉「收進穀倉」。還沒收走前，別人可以來偷（最多偷走 4 成），記得常收！</p>
    <h4>✍️ 每日簽到・🎁 禮物</h4>
    <p>每天點左邊的「簽到」領獎，連續 7 天第 7 天有大獎，中斷一天會從第 1 天重新開始。每天第一次上線、每升 1 級、完成成就都會送鑽石；上方 📬 禮物信箱可以領活動禮物。</p>
    <h4>🧪 道具</h4>
    <p>綜合商店的「🧪 道具」可以買道具，買了放在「背包 → 🧪 道具」，要用時按「使用」。有：⚡ 偷菜體力補滿（每天限買 1 個）、🌱 全田神奇肥料（每天限買 1 個）、🌟 豐收卡（收成 +50%）、📈 經驗加倍卡、🔍 探測器（找出最好偷的農場）、📢 大聲公（在跑馬燈說一句話）、🎉 派對（1 小時，開始時全服跑馬燈會幫你廣播；每位來拜訪的人可以領 ${+(CFG_SET.party_gold??300)} 金＋${+(CFG_SET.party_exp??20)} 經驗，每來一人你拿 ${+(CFG_SET.party_host_exp??50)} 經驗；派對期間你的收成 +${Math.round((+(CFG_SET.party_harvest??1.3)-1)*100)}%、作物長快 ${Math.round((+(CFG_SET.party_grow??1.2)-1)*100)}%）。正在生效的效果會顯示在畫面右上方。</p>
    <p>用「收成」點還沒成熟的作物，可以用金幣肥料讓剩下的時間減半。</p>
    <h4>🎟️ 每日轉盤</h4>
    <p>畫面左邊的「轉盤」每天可以免費轉 1 次，也能用鑽石或金幣多轉幾次。各獎品的機率寫在轉盤頁下面的「獎品機率」。</p>
    <h4>💌 送禮給好友</h4>
    <p>在好友廣場的好友旁邊按「💌 送禮」，可以送作物、種子、道具給好友（不能送金幣和鑽石），每天最多 ${+(CFG_SET.gift_daily??10)} 次，對方在禮物信箱領取。</p>
    <h4>🏷️ 稱號・頭像框</h4>
    <p>在「我的家」按「🏷️ 稱號・頭像框」。稱號會顯示在名字旁邊，頭像框會套在你的頭像上，每次買 30 天（稱號 7 天），到期可以續。頭像框有 5 款：青銅、白銀用金幣買，黃金、鑽石、星耀用鑽石買。有些稱號要完成成就才拿得到，而且永久有效。</p>
    <h4>✨ 稀有種子</h4>
    <p>種子商店最上面的稀有種子要用鑽石買（4 種合計每天限買 3 顆），種下去會閃閃發光，收成的賣價特別高——但別人也可以偷喔！</p>
    <h4>🏅 成就</h4>
    <p>在「我的家」按「🏆 查看全部成就」。等級、種田、牧場、好友、偷菜、寵物、城鎮、簽到各有一系列成就，達成就自動送鑽石。</p>
    <h4>🔔 通知</h4>
    <p>到「⚙️ 設定 → 🔔 通知」按「開啟通知」，就算沒開遊戲，作物成熟、被偷菜、被惡作劇、牧場可以收、收集倉堆太多、好友邀請、收到禮物、簽到提醒、好友開派對時都會通知你，每一種都可以單獨開關。同一種通知 30 分鐘內最多 1 則（期間的會合併），晚上 11 點到早上 8 點不推，正在玩的時候也不推。</p>
    <p><b>iPhone</b> 要先把遊戲「加到主畫面」，從主畫面的圖示打開才能開啟通知（iOS 16.4 以上）；Android 和電腦用 Chrome 就可以。</p>
    <h4>🔄 遊戲更新</h4>
    <p>遊戲有新版本時，畫面上方會出現「✨ 有新版本！點這裡更新」，點一下就會換成最新版。</p>
    <h4>🏆 排行榜</h4>
    <p>在好友廣場的「排行」，有四種排行榜：🏆 等級（同等級比經驗）、💰 財富（金幣）、🏙️ 繁榮（寵物、寵物造型、建築外觀、城鎮色調、裝飾、裝備階數、開墾的田地越多越高）、🥕 偷菜（偷到的東西總價值，田地、收集倉、牧場都算，一樣多再比次數）。每種都可以看好友排行和全服前 50 名。</p></div>`,
    [['重新看新手教學','sub',()=>{ closeModal(); try{ localStorage.removeItem(tutKey()); FEAT_TUTS.forEach(f=>localStorage.removeItem(featKey(f.id))); }catch(e){} feat=null; tut={step:0}; tutRender(); }],['知道了','',closeModal]]);
}
function openA2HS(){
  modal('加到手機桌面', `<div class="help">
    <p>加到桌面後，點圖示就能直接全螢幕開遊戲，像 App 一樣方便。</p>
    <h4>📱 iPhone（Safari）</h4>
    <ul><li>用 <b>Safari</b> 打開遊戲網址</li><li>點下方的<b>分享</b>按鈕（方框加向上箭頭）</li><li>往下滑，選「<b>加入主畫面</b>」→ 右上角「新增」</li></ul>
    <h4>🤖 Android（Chrome）</h4>
    <ul><li>用 <b>Chrome</b> 打開遊戲網址</li><li>點右上角 <b>⋮</b> 選單</li><li>選「<b>加到主畫面</b>」或「安裝應用程式」</li></ul>
    <div class="urlbox">${GAME_URL}</div></div>`, [['複製遊戲網址','sub',()=>copyText(GAME_URL,'已複製遊戲網址')],['知道了','',closeModal]]);
}
async function copyText(t, okMsg){
  try{ await navigator.clipboard.writeText(t); toast(okMsg||'已複製'); }
  catch(e){ toast('複製失敗，請手動選取文字'); }
}

/* ================= 邀請朋友 ================= */
async function invite(){
  const text = `我在玩「一起種田吧」🌱 開心農場風格的小鎮種田遊戲！我的暱稱是「${S.me.nickname}」，加我好友來偷菜吧～`;
  if(navigator.share){
    try{ await navigator.share({title:'一起種田吧', text, url:GAME_URL}); return; }
    catch(e){ if(e && e.name==='AbortError') return; }
  }
  copyText(text + '\n' + GAME_URL, '邀請訊息已複製，貼給朋友吧！');
}

/* ================= 儲值（即將開放） ================= */
const GEM_PACKS = [
  {name:'小袋鑽石', price:30, gems:60},
  {name:'中袋鑽石', price:150, gems:330, extra:'多 10%'},
  {name:'大袋鑽石', price:490, gems:1150, extra:'多 17%'},
  {name:'超值鑽石', price:990, gems:2500, extra:'多 26%'},
];

/* 儲值（右上鑽石旁的 +） */
function openTopup(){
  const me=S.me, now=Date.now()+(S.off||0), P=(window.PACKS||[]), got=me.packs||{};
  const newbieOk = !got.newbie && (+me.created||0) > now - 7*86400000, firstOk = !got.first, mLeft = me.month_until && +me.month_until>now ? Math.ceil((+me.month_until-now)/86400000) : 0;
  let body = `<div class="soon">💎 線上付款即將開放！目前想購買請聯絡客服，付款後會直接發到你的帳號</div>`;
  const pk = id => P.find(x=>x.id===id) || {};
  body += `<div class="gemcard pack" style="background:#F7F5FF"><div class="bonus">${mLeft?`剩 ${mLeft} 天`:'最划算'}</div><div style="font-weight:900">${esc(pk('month').name||'🗓️ 農夫月卡')}　NT$${pk('month').price_twd||150}</div>
    <div class="pkd">${esc(pk('month').descr||'')}</div></div>`;
  if(newbieOk) body += `<div class="gemcard pack" style="background:#EFFAF2"><div class="bonus">限時</div><div style="font-weight:900">${esc(pk('newbie').name)}　NT$${pk('newbie').price_twd}</div><div class="pkd">${esc(pk('newbie').descr)}</div></div>`;
  if(firstOk) body += `<div class="gemcard pack" style="background:#FFF6E5"><div class="bonus">首儲</div><div style="font-weight:900">${esc(pk('first').name)}</div><div class="pkd">${esc(pk('first').descr)}</div></div>`;
  body += `<div class="gemgrid">${GEM_PACKS.map(p=>`<div class="gemcard"><div class="bonus">首儲 ×2</div><div>💎</div><b>${p.gems.toLocaleString()}</b><div style="font-size:12px;color:var(--ink2);font-weight:700">NT$${p.price}${p.extra?`・${p.extra}`:''}</div></div>`).join('')}</div>`;
  body += `<div style="font-size:12px;color:var(--ink2);font-weight:700;margin-top:10px;text-align:center">每個方案第一次購買，鑽石加倍送</div>`;
  modal(`💎 儲值　<span style="font-size:14px;color:#5B4ED6">目前 💎 ${(me.gems||0).toLocaleString()}</span>`, body);
}

/* ================= 每日簽到（7 天一輪） ================= */
const signedToday = () => S && S.me.sign_day && S.me.today && String(S.me.sign_day).slice(0,10)===String(S.me.today).slice(0,10);
function signNext(){ // 今天簽的話會是第幾天
  const me=S.me; if(signedToday()) return me.sign_n;
  const y=new Date(String(me.today).slice(0,10)+'T00:00:00Z'); y.setUTCDate(y.getUTCDate()-1);
  return (me.sign_day && String(me.sign_day).slice(0,10)===y.toISOString().slice(0,10) && me.sign_n<7) ? me.sign_n+1 : 1; }
function signBadge(){ const b=$('bSign'); if(b) b.classList.toggle('dot', !!S && !signedToday()); }
function openSign(){
  if(!S) return; const me=S.me, rws=me.sign_rw||[], done=signedToday(), cur=signNext();
  const cells = rws.slice(0,7).map((rw,i)=>{ const d=i+1, got = done ? d<=cur : d<cur, now=!done && d===cur;
    return `<div class="sgd ${got?'got':''} ${now?'now':''} ${d===7?'big':''}"><b>第 ${d} 天</b><div class="sgr">${rewardHTML(rw)}</div>${got?'<i>✓</i>':''}</div>`; }).join('');
  modal('✍️ 每日簽到', `<div class="rhint" style="text-align:center">連續簽到 7 天，第 7 天大獎！中斷一天會從第 1 天重新開始</div><div class="sgrid">${cells}</div>`,
    [[done?'今天簽到過了，明天再來':'✍️ 簽到領獎', done?'sub':'', async()=>{ if(signedToday()) return closeModal();
      try{ const r=await rpc('farm_sign'); applyState(r.state); refresh(); sfx('lvup'); fxConfetti(); signBadge(); openSign(); toast(`第 ${r.day} 天簽到成功！`); if(r.gift) toast(r.gift); }catch(e){ toast(e.message); } }]]);
}
let signAuto = false;
function signMaybePop(){ // 每天第一次進遊戲自動跳出（教學進行中不跳）
  signBadge(); if(signAuto || !S || signedToday() || tut || mode!=='home') return; signAuto = true;
  if(document.querySelector('#ov.show')) return;
  openSign();
}

/* 主畫面左右箭頭：一次往左／右看一段 */
function panSync(){ const max=map.scrollWidth-map.clientWidth;
  $('panL').classList.toggle('off', map.scrollLeft<=4); $('panR').classList.toggle('off', map.scrollLeft>=max-4); }
$('panL').onclick=()=>{ map.scrollBy({left:-innerWidth*0.6, behavior:'smooth'}); sfx && sfx('tap'); };
$('panR').onclick=()=>{ map.scrollBy({left: innerWidth*0.6, behavior:'smooth'}); sfx && sfx('tap'); };
map.addEventListener('scroll', panSync, {passive:true}); addEventListener('resize', panSync); setTimeout(panSync, 1500);
