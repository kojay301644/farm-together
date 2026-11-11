
/* ================= 回報問題＋自動記錄錯誤 ================= */
const ERRS = [];   // 最近 20 筆錯誤（回報時自動附上）
function logErr(msg){ try{ ERRS.push({t:new Date().toLocaleTimeString('zh-TW',{hour12:false}), m:String(msg).slice(0,300)}); if(ERRS.length>20) ERRS.shift(); }catch(e){} }
function reportMeta(){
  let scr = mode==='visit' ? '拜訪好友' : '自己的農場';
  try{ if(document.querySelector('#ov.show')) scr += '／視窗：' + (document.querySelector('#md h3 span')||{}).textContent; }catch(e){}
  return { ua:navigator.userAgent.slice(0,200), dev:(typeof devName==='function'?devName():''), build:(typeof BUILD!=='undefined'?BUILD:''),
    screen:scr, size:`${innerWidth}x${innerHeight}`, app:(typeof isStandalone==='function'&&isStandalone())?'主畫面':'瀏覽器',
    lv:(S&&S.me&&S.me.lv)||0, errs:ERRS.slice(-20) };
}
/* 遊戲發生錯誤：自動記到後台（同一個錯誤這次開遊戲只送一次） */
const crashSent = new Set();
function autoCrash(msg){
  logErr(msg);
  const k = String(msg).slice(0,200); if(crashSent.has(k) || crashSent.size>=10) return; crashSent.add(k);
  setTimeout(()=>{ try{ if(S && S.me) sb.rpc('farm_crash', {p_msg:String(msg).slice(0,500), p_meta:reportMeta()}); }catch(e){} }, 1500);
}
window.addEventListener('error', e=>{ if(!e || !e.message) return; if(/ResizeObserver|Script error/i.test(e.message)) return;
  autoCrash(`${e.message}${e.filename?` @ ${String(e.filename).split('/').pop()}:${e.lineno}:${e.colno}`:''}`); });
window.addEventListener('unhandledrejection', e=>{ const m = e && e.reason ? (e.reason.message||String(e.reason)) : ''; if(!m) return;
  if(/Failed to fetch|NetworkError|Load failed|帳號已在其他裝置|伺服器維護中/i.test(m)) return logErr(m); autoCrash('Promise: '+m); });

const REP_KIND = [['bug','🐞 遊戲錯誤'],['idea','💡 建議'],['pay','💎 儲值問題'],['abuse','🚨 檢舉玩家'],['other','💬 其他']];
const REP_ST = {new:'🕐 已收到', doing:'🔧 處理中', done:'✅ 已解決'};
let repImg = null;
async function shrinkImg(file){
  const url = URL.createObjectURL(file);
  try{ const im = await new Promise((ok,no)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=no; i.src=url; });
    const k = Math.min(1, 1280/Math.max(im.width, im.height)), cv=document.createElement('canvas');
    cv.width=Math.round(im.width*k); cv.height=Math.round(im.height*k); cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);
    return await new Promise(ok=>cv.toBlob(ok,'image/jpeg',0.82));
  } finally{ URL.revokeObjectURL(url); }
}
function openReport(kind){
  repImg = null; let k = kind || 'bug';
  modal('🐞 回報問題', `<div class="rhint">遇到錯誤、有建議或要檢舉都可以告訴我們，系統會自動附上你的手機型號和最近的錯誤訊息，方便我們查。</div>
    <div class="repk">${REP_KIND.map(([id,t])=>`<button class="chip${id===k?' on':''}" data-rk="${id}">${t}</button>`).join('')}</div>
    <textarea id="repTx" maxlength="500" placeholder="發生了什麼事？在哪個畫面、做了什麼動作？（最多 500 字）"></textarea>
    <div class="repc"><span id="repN">0 / 500</span></div>
    <label class="btn sub repimg"><input type="file" id="repF" accept="image/*" hidden>📷 附上截圖（可不附）</label>
    <div id="repPv"></div>
    <div class="homebtns"><button class="btn sub" id="repMine">📋 我的回報</button></div>`,
    [['取消','sub',closeModal],['送出','',async()=>{
      const tx=$('repTx').value.trim(); if(tx.length<2) return toast('請寫一下發生了什麼事');
      const b=document.querySelector('#mft button:last-child'); b.disabled=true; b.textContent='送出中…';
      try{
        let img=null;
        if(repImg){ const {data:{user}} = await sb.auth.getUser(); const path=`${user.id}/${Date.now()}.jpg`;
          const {error} = await sb.storage.from('reports').upload(path, repImg, {contentType:'image/jpeg'});
          if(error) throw new Error('截圖上傳失敗：'+error.message);
          img = sb.storage.from('reports').getPublicUrl(path).data.publicUrl; }
        await rpc('farm_report', {p_kind:k, p_body:tx, p_img:img, p_meta:reportMeta()});
        sfx('coin'); modal('謝謝你的回報！', `<div style="text-align:center;font-weight:800;line-height:1.8">我們收到了，會盡快處理<br><small style="color:var(--ink2)">有回覆時會通知你，也可以到「📋 我的回報」查看</small></div>`, [['好','',closeModal]]);
      }catch(e){ toast(e.message); b.disabled=false; b.textContent='送出'; }
    }]]);
  document.querySelectorAll('#md [data-rk]').forEach(c=>c.onclick=()=>{ k=c.dataset.rk; document.querySelectorAll('#md [data-rk]').forEach(x=>x.classList.toggle('on', x===c)); });
  $('repTx').oninput=()=>{ $('repN').textContent=`${$('repTx').value.length} / 500`; };
  $('repF').onchange=async e=>{ const f=e.target.files[0]; if(!f) return;
    try{ repImg = await shrinkImg(f); $('repPv').innerHTML=`<div class="reppv"><img src="${URL.createObjectURL(repImg)}"><button class="mini sub" id="repX">移除</button></div>`;
      $('repX').onclick=()=>{ repImg=null; $('repPv').innerHTML=''; $('repF').value=''; }; }catch(err){ toast('這張圖片讀不到，換一張試試'); } };
  $('repMine').onclick=openMyReports;
}
async function openMyReports(){
  let L=[]; try{ L = await rpc('farm_reports_mine'); }catch(e){ return toast(e.message); }
  const K = Object.fromEntries(REP_KIND);
  modal('📋 我的回報', L.length ? L.map(r=>`<div class="reprow"><div class="rh"><b>${K[r.kind]||r.kind}</b><span class="tag st-${r.status}">${REP_ST[r.status]||r.status}</span><small>${new Date(r.at).toLocaleString('zh-TW',{hour12:false})}</small></div>
      <div class="rb">${esc(r.body)}</div>${r.img?`<a href="${esc(r.img)}" target="_blank"><img class="rimg" src="${esc(r.img)}"></a>`:''}
      ${r.reply?`<div class="rr"><b>💬 回覆</b>${esc(r.reply)}</div>`:''}</div>`).join('') : `<div class="empty">還沒有回報過</div>`,
    [['← 回報問題','sub',()=>openReport()],['關閉','',closeModal]]);
}
