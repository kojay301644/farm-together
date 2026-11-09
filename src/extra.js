
/* ================= 新手教學 ================= */
const GAME_URL = 'https://kojay301644.github.io/farm-together/';
const TUT_STEPS = [
  {text:'歡迎來到小鎮！先點一塊<b>空地</b>，選「白蘿蔔」種下去吧', target:()=>plotEls[S.plots.findIndex(p=>p.s==='empty'||p.s==='grow')], done:()=>S.plots.some(p=>p.s==='grow'||p.s==='dead')},
  {text:'下面是<b>工具列</b>：田裡缺水、長草或有蟲時，選對應的工具點田地。放著不管，收成會變少喔', target:()=>$('tools'), next:true},
  {text:'白蘿蔔大約 <b>2 分鐘</b>成熟。成熟後選「收成」點它，就能收進倉庫', target:()=>plotEls[S.plots.findIndex(p=>p.s==='grow'||p.s==='dead')], done:()=>Object.keys(S.me.crops).length>0 || S.plots.some(p=>p.s==='dead'), next:true},
  {text:'點<b>穀倉</b>可以把作物賣掉換金幣，再到<b>種子商店</b>買更多種子', target:()=>document.querySelector('[data-b="barn"]'), next:true},
  {text:'最後，點<b>好友布告欄</b>用暱稱加好友，就能去朋友的農場偷菜了！', target:()=>document.querySelector('[data-b="board"]'), next:true, last:true},
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
    <p>到穀倉把作物賣掉換金幣，再到種子商店買種子。收成、澆水、除草除蟲都會拿到經驗，升級後可以買更高級的作物、開墾更多荒地（最多 18 塊）。</p>
    <h4>🧺 好友與偷菜</h4>
    <p>在好友布告欄用暱稱加好友，就能拜訪對方農場：</p>
    <ul><li><b>偷菜</b>：成熟的作物每塊地每人只能偷一次，每塊地最多被偷走 4 成，主人一定拿得到 6 成</li>
    <li><b>幫忙</b>：幫好友除草除蟲可以拿經驗</li>
    <li><b>惡作劇</b>：在好友還沒成熟的作物放草放蟲，每天 10 次</li></ul>
    <p>作物成熟後要快點收，不然會被好友偷走喔！誰偷了你的菜，都會記在「動態」裡。</p>
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
