
/* ================= 新手教學 ================= */
const GAME_URL = 'https://kojay301644.github.io/farm-together/';
const TUT_STEPS = [
  {text:'歡迎來到小鎮！先點一塊<b>空地</b>，選「白蘿蔔」種下去吧', target:()=>plotEls[S.plots.findIndex(p=>p.s==='empty'||p.s==='grow')], done:()=>S.plots.some(p=>p.s==='grow'||p.s==='dead')},
  {text:'下面是<b>工具列</b>：田裡缺水、長草或有蟲時，選對應的工具點田地。放著不管，收成會變少喔', target:()=>$('tools'), next:true},
  {text:'白蘿蔔大約 <b>2 分鐘</b>成熟。成熟後選「收成」點它，就能收進倉庫', target:()=>plotEls[S.plots.findIndex(p=>p.s==='grow'||p.s==='dead')], done:()=>Object.keys(S.me.crops).length>0 || S.plots.some(p=>p.s==='dead'), next:true},
  {text:'點<b>穀倉</b>可以把作物賣掉換金幣，裡面的<b>種子商店</b>可以買更多種子', target:()=>document.querySelector('[data-b="barn"]'), next:true},
  {text:'最後，點中間的<b>好友廣場</b>（噴水池）用暱稱加好友，就能去朋友的農場偷菜了！', target:()=>document.querySelector('[data-b="board"]'), next:true, last:true},
];
let tut = null;   // {step}
const tutKey = () => 'ytzt_tut_' + (S && S.me.id);
function tutDone(){ try{ return localStorage.getItem(tutKey())==='1'; }catch(e){ return false; } }
function tutFinish(){ try{ localStorage.setItem(tutKey(),'1'); }catch(e){} tut=null; $('tut').style.display='none'; $('tutArrow').style.display='none'; }
function tutMaybeStart(){
  if(!S || tutDone()) return;
  if(S.me.lv > 2) return tutFinish();   // 老玩家不顯示
  tut = {step:0}; tutRender();
}
function tutRender(){
  if(!tut) return;
  const st = TUT_STEPS[tut.step];
  $('tut').style.display = '';
  $('tutText').innerHTML = `<span class="tutn">${tut.step+1}/${TUT_STEPS.length}</span>${st.text}`;
  $('tutNext').style.display = st.next ? '' : 'none';
  $('tutNext').textContent = st.last ? '開始玩！' : '下一步';
  tutTick();
}
function tutTick(){
  if(!tut || mode!=='home'){ if($('tutArrow')) $('tutArrow').style.display='none'; return; }
  const st = TUT_STEPS[tut.step];
  if(st.done && st.done() && !st.last){ tut.step++; return tutRender(); }
  const el = st.target && st.target();
  const a = $('tutArrow');
  if(!el){ a.style.display='none'; return; }
  const r = el.getBoundingClientRect();
  a.style.display = '';
  a.style.left = (r.left + r.width/2) + 'px';
  a.style.top = Math.max(110, r.top - 6) + 'px';
}
function tutNext(){ if(!tut) return; if(TUT_STEPS[tut.step].last) return tutFinish(); tut.step++; tutRender(); }
setInterval(tutTick, 500);
addEventListener('scroll', tutTick, true);

/* ================= 遊戲說明 ================= */
function openHelp(){
  modal('遊戲說明', `<div class="help">
    <h4>🌱 種田</h4>
    <p>點空地選種子種下，作物會隨著真實時間長大，關掉網頁也會繼續長。成熟後用「收成」點它，作物會進到穀倉。</p>
    <h4>💧 照顧作物</h4>
    <p>土壤乾掉時作物會<b>長得比較慢</b>（速度減半），記得澆水。田裡長出的雜草和蟲，每一個都會讓收成少 1 個，用「除草」「除蟲」清掉就沒事。</p>
    <h4>💰 賺錢與升級</h4>
    <p>到穀倉把作物賣掉換金幣，穀倉裡也有種子商店可以買種子。收成、澆水、除草除蟲都會拿到經驗，升級後可以買更高級的作物、開墾更多荒地（最多 20 塊）。</p>
    <h4>🧺 好友與偷菜</h4>
    <p>在好友廣場用暱稱加好友，就能拜訪對方農場：</p>
    <ul><li><b>偷菜</b>：成熟的作物每塊地每人只能偷一次，每塊地最多被偷走 4 成，主人一定拿得到 6 成</li>
    <li><b>幫忙</b>：幫好友除草除蟲可以拿經驗</li>
    <li><b>惡作劇</b>：在好友還沒成熟的作物放草放蟲，每天 10 次</li></ul>
    <p>作物成熟後要快點收，不然會被好友偷走喔！誰偷了你的菜，都會記在「動態」裡。</p>
    <h4>🐔 牧場</h4>
    <p>Lv3 開放。在牧場買小雞、小鴨、綿羊、乳牛、小豬，用倉庫裡的作物餵牠們，過一段時間就會產出雞蛋、牛奶、羊毛等，收成後到穀倉賣錢。好友可以來偷、幫忙餵食和拍蚊子，惡作劇的人會放蚊子讓產量變少。</p>
    <h4>🐾 寵物夥伴</h4>
    <p>在「我的家」選一隻寵物當夥伴，牠會在農場走來走去，你收成澆水時牠會跑過去幫忙。</p>
    <p>寵物身上有 <b>1 格裝備欄</b>，插上裝備就會幫你自動做事：自動澆水、自動播種、自動除蟲、自動除草、自動餵食、自動收成、自動拍蚊子、看門狗（趕走小偷）、稻草人（擋下惡作劇）。每種裝備只能有 1 件，在裝備商店先買 I 階，再一階一階升級（I、II 階用金幣，III、IV 階用鑽石）；收成時也可能撿到寶箱，或升到 Lv5／10／15／20 領禮物。</p>
    <h4>🏆 排行榜</h4>
    <p>依等級排名，同等級再比經驗。可以看好友排行和全服前 50 名。</p></div>`,
    [['重新看新手教學','sub',()=>{ closeModal(); try{ localStorage.removeItem(tutKey()); }catch(e){} tut={step:0}; tutRender(); }],['知道了','',closeModal]]);
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
  let body = `<div class="soon">💎 儲值功能即將開放，敬請期待！</div>`;
  body += `<div class="gemcard" style="background:#F7F5FF;margin-bottom:10px"><div class="bonus">首儲 ×2</div><div style="font-weight:900">🌟 農夫月卡　NT$150</div>
    <div style="font-size:12px;font-weight:700;color:var(--ink2);margin-top:4px">立刻拿 💎300，30 天內每天登入再領 💎50（共 💎1,800）</div></div>`;
  body += `<div class="gemgrid">${GEM_PACKS.map(p=>`<div class="gemcard"><div class="bonus">首儲 ×2</div><div>💎</div><b>${p.gems.toLocaleString()}</b><div style="font-size:12px;color:var(--ink2);font-weight:700">NT$${p.price}${p.extra?`・${p.extra}`:''}</div></div>`).join('')}</div>`;
  body += `<div style="font-size:12px;color:var(--ink2);font-weight:700;margin-top:10px;text-align:center">每個方案第一次購買，鑽石加倍送</div>`;
  modal(`💎 儲值　<span style="font-size:14px;color:#5B4ED6">目前 💎 ${(S.me.gems||0).toLocaleString()}</span>`, body);
}
