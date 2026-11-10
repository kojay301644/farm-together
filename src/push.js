
/* ================= 推播通知 ================= */
const PUSH_KEY = 'BGxgt6CzE6IEzZjJ3waulj8-qSXUpfUWVTMas2uynuqStvMllrqqI3gupKolpdB2HbgHIvFEFMHSSwZkj6bnf1I';
const PUSH_KINDS = [['ripe','🌾 作物成熟'],['steal','🦹 被偷菜'],['prank','😈 被惡作劇'],['ranch','🐔 牧場可以收'],['bin','🧺 收集倉堆太多'],['friend','👋 好友邀請'],['gift','🎁 收到禮物'],['sign','✍️ 簽到提醒（晚上 8 點）'],['party','🎉 好友開派對']];
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone===true;
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function b64ToU8(s){ const p='='.repeat((4-s.length%4)%4), b=(s+p).replace(/-/g,'+').replace(/_/g,'/'), r=atob(b); return Uint8Array.from([...r].map(c=>c.charCodeAt(0))); }
async function pushReg(){ return navigator.serviceWorker.register('sw.js', {scope:'./'}); }
async function pushSub(){ try{ const reg = await navigator.serviceWorker.getRegistration('./'); return reg ? await reg.pushManager.getSubscription() : null; }catch(e){ return null; } }
async function pushSave(sub){ const j=sub.toJSON(); await rpc('farm_push_sub', {p_endpoint:j.endpoint, p_p256dh:j.keys.p256dh, p_auth:j.keys.auth, p_ua:navigator.userAgent.slice(0,200)}); }
async function pushEnable(){
  if(!pushSupported()){
    if(isIOS() && !isStandalone()) return pushIOSGuide();
    return toast('這個瀏覽器不支援通知，建議用 Chrome');
  }
  try{
    const perm = await Notification.requestPermission();
    if(perm !== 'granted'){ toast('通知被封鎖了，要到瀏覽器設定裡允許「通知」'); return false; }
    const reg = await pushReg(); await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub) sub = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64ToU8(PUSH_KEY)});
    await pushSave(sub); sfx('coin'); toast('🔔 通知開啟了！'); return true;
  }catch(e){ toast('開啟通知失敗：' + (e.message||e)); return false; }
}
async function pushDisable(){
  const sub = await pushSub();
  if(sub){ try{ await rpc('farm_push_unsub', {p_endpoint:sub.endpoint}); }catch(e){} try{ await sub.unsubscribe(); }catch(e){} }
  toast('🔕 已關閉通知');
}
function pushIOSGuide(){
  modal('🔔 iPhone 開啟通知', `<div class="help">
    <p>iPhone 要先把遊戲<b>加到主畫面</b>，從主畫面的圖示打開，才能收到通知（需要 iOS 16.4 以上）。</p>
    <ul><li>用 <b>Safari</b> 打開遊戲</li><li>點下方的<b>分享</b>按鈕（方框加向上箭頭）</li><li>選「<b>加入主畫面</b>」</li><li>從主畫面的圖示打開遊戲，再到「設定 → 🔔 通知」開啟</li></ul></div>`, [['知道了','',closeModal]]);
}
/* 設定頁的通知區塊 */
function pushBoxHTML(){ return `<div class="sec">🔔 通知</div><div id="pushBox"><div class="rhint">讀取中…</div></div>`; }
async function renderPushBox(){
  const el=$('pushBox'); if(!el) return;
  const sub = pushSupported() ? await pushSub() : null, on = !!sub && Notification.permission==='granted';
  const off = S.me.push_off || {};
  let h = '';
  if(!pushSupported() && isIOS() && !isStandalone()) h = `<div class="rhint">iPhone 要先「加到主畫面」並從主畫面打開，才能收到通知。</div><div class="homebtns"><button class="btn o" id="pOn">📱 怎麼開啟</button></div>`;
  else if(!pushSupported()) h = `<div class="rhint">這個瀏覽器不支援通知，建議用 Chrome。</div>`;
  else if(!on) h = `<div class="rhint">開啟後，就算沒開遊戲，作物熟了、被偷菜時也會通知你。晚上 11 點到早上 8 點不會吵你。</div><div class="homebtns"><button class="btn o" id="pOn">🔔 開啟通知</button></div>`;
  else h = `<div class="rhint">這台裝置已開啟通知。可以選要收哪些（同一種 30 分鐘內最多 1 則，晚上 11 點到早上 8 點不推）：</div>
    <div class="pkinds">${PUSH_KINDS.map(([k,t])=>`<div class="pk"><span>${t}</span><button class="sw${off[k]?'':' on'}" data-pk="${k}" aria-label="${t}"><i></i></button></div>`).join('')}</div>
    <div class="homebtns"><button class="btn" id="pTest">📨 傳一則測試通知</button><button class="btn sub" id="pOff">🔕 這台關閉通知</button></div>`;
  el.innerHTML = h;
  if($('pOn')) $('pOn').onclick = async()=>{ await pushEnable(); renderPushBox(); };
  if($('pTest')) $('pTest').onclick = async()=>{ try{ await rpc('farm_push_test'); toast('已送出，幾秒內會收到（先把遊戲切到背景看看）'); }catch(e){ toast(e.message); } };
  if($('pOff')) $('pOff').onclick = async()=>{ await pushDisable(); renderPushBox(); };
  el.querySelectorAll('[data-pk]').forEach(b=>b.onclick=async()=>{ const k=b.dataset.pk, turnOn=!!(S.me.push_off||{})[k];
    try{ applyState(await rpc('farm_push_pref',{p_kind:k,p_on:turnOn})); renderPushBox(); }catch(e){ toast(e.message); } });
}
/* 登入後：已開過通知的裝置，重新綁定目前帳號；還沒開的，過一陣子問一次 */
async function pushOnLogin(){
  try{
    if(pushSupported() && Notification.permission==='granted'){ await pushReg(); const sub = await pushSub(); if(sub) await pushSave(sub); return; }
  }catch(e){}
  setTimeout(pushAskMaybe, 90000);
}
function pushAskMaybe(){
  if(!S || mode!=='home' || document.querySelector('#ov.show') || (typeof tut!=='undefined' && tut)) return setTimeout(pushAskMaybe, 60000);
  if(pushSupported() && Notification.permission!=='default') return;
  if(!pushSupported() && !(isIOS() && !isStandalone())) return;
  let last=0; try{ last=+localStorage.getItem('ytzt_push_ask')||0; }catch(e){}
  if(Date.now()-last < 3*86400e3) return;
  try{ localStorage.setItem('ytzt_push_ask', String(Date.now())); }catch(e){}
  modal('🔔 開啟通知？', `<div style="text-align:center;font-weight:800;line-height:1.7">作物熟了、有人偷你的菜、好友開派對時<br>就算沒開遊戲也會通知你！<br><small style="color:var(--ink2)">晚上 11 點到早上 8 點不會吵你，也可以隨時在設定裡關掉</small></div>`,
    [['之後再說','sub',closeModal],['🔔 開啟','',async()=>{ closeModal(); await pushEnable(); }]]);
}
