
/* ================= 小鎮地圖：斜角座標 ================= */
const TW=72, TH=36, OX=1268, OY=126.8, VX=-90, VY=-70, WW=1780, WH=1030, IW=1600, IH=895.2;
const IS=1600/1344; // 萌獸主頁座標(1344寬)→世界座标
const W2G=(x,y)=>{ const a=(x-OX)/(TW/2), b=(y-OY)/(TH/2); return [(a+b)/2,(b-a)/2]; };
const HG=(x,y)=>W2G(x*IS,y*IS); // 萌獸主頁座標→格座標
const PAD={t:0,b:0,l:0,r:0};
const iso=(x,y)=>[OX+(x-y)*TW/2, OY+(x+y)*TH/2];
const P=a=>a.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
const up=(p,h)=>[p[0],p[1]-h];
const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
const poly=(pts,f,extra='')=>`<polygon points="${P(pts)}" fill="${f}" ${extra}/>`;
const dia=(x,y,w,d)=>[iso(x,y),iso(x+w,y),iso(x+w,y+d),iso(x,y+d)];
let seed=7; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
const A = n => `assets/${n}.webp?v=${typeof BUILD!=='undefined'?BUILD:''}`;

/* 田地位置（格座標，3 排 × 6 塊） */
const PS=1.45, PG=1.65;
// 第 1～4 塊在穀倉右邊、農田上方 2×2（一開始就有）；其餘 18 塊是原本 3 排 × 6
const PLOTS=[[0,2],[0,1]].map(([c,r])=>[4.35+c*PG, 6.75-r*PG]).concat(Array.from({length:18},(_,i)=>[4.35+(i%6)*PG, 6.75+Math.floor(i/6)*PG]));
const plotCenter=i=>iso(PLOTS[i][0]+PS/2, PLOTS[i][1]+PS/2);
const FARM_C=[9.2,9.2];

/* ================= 美術元件 ================= */
const INK='#4B3423';
let HOME_LBL=null, homeLblCur='', BIN_LBL=null, binLblCur='';
const binItems = () => (mode==='visit' && typeof V!=='undefined' && V) ? ((V.bin||{}).items||{}) : ((typeof S!=='undefined' && S && S.me && S.me.bin)||{});
const binCount = b => ['c','g'].reduce((a,t)=>a+Object.values((b||{})[t]||{}).reduce((x,y)=>x+(+y||0),0),0);
const binLblText = () => { const n=binCount(binItems()); return n ? `🧺 收集倉 ${n}` : '🧺 收集倉'; };
function setBinLabel(){ const el=$('binLbl'), t=binLblText(); if(!el||!BIN_LBL||t===binLblCur) return; binLblCur=t; el.innerHTML=labelPill(BIN_LBL[0], BIN_LBL[1], t, {bg:'#FFF1DC'}); }
const homeLblName = () => (mode==='visit' && typeof V!=='undefined' && V) ? V.owner.nickname : (typeof S!=='undefined' && S && S.me ? S.me.nickname : '我的家');
function setHomeLabel(){ const el=$('homeLbl'), n=homeLblName(); if(!el||!HOME_LBL||n===homeLblCur) return; homeLblCur=n; el.innerHTML=labelPill(HOME_LBL[0], HOME_LBL[1], '🏠 '+esc(n)+'的家', {big:1}); }
function labelPill(x,y,text,opt={}){
  if(opt.big){ const w=[...text.replace(/&[a-z]+;/g,'x')].reduce((a,ch)=>a+(ch.charCodeAt(0)>255?18:10),0)+30, bg='#FF8A3D';
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" style="pointer-events:none"><g class="bob">
    <rect x="${-w/2}" y="-18" width="${w}" height="36" rx="18" fill="${bg}" stroke="${INK}" stroke-width="2.5"/>
    <path d="M-7 17 L0 25 L7 17" fill="${bg}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><rect x="-8" y="14" width="16" height="4" fill="${bg}"/>
    <text x="0" y="7" text-anchor="middle" font-size="18" font-weight="900" fill="#fff" stroke="${INK}" stroke-width="3" paint-order="stroke" font-family="Noto Sans TC,sans-serif">${text}</text></g></g>`; }
  const w = text.length*13+26;
  const bg = opt.locked?'#E2DACB':(opt.bg||'#FFFFFF');
  const fg = opt.locked?'#7A6E5D':(opt.fg||'#3A3226');
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" style="pointer-events:none">
    <rect x="${-w/2}" y="-13" width="${w}" height="26" rx="13" fill="${bg}" stroke="${INK}" stroke-width="2"/>
    <path d="M-5 12.5 L0 18 L5 12.5" fill="${bg}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><rect x="-6" y="10" width="12" height="3" fill="${bg}"/>
    <text x="0" y="5" text-anchor="middle" font-size="13" font-weight="900" fill="${fg}" font-family="Noto Sans TC,sans-serif">${opt.locked?'🔒 ':''}${text}</text></g>`;
}
// 圖片精靈：以格座標為底部中心
function sprite(name, gx, gy, w, opt={}){
  const [x,y]=iso(gx,gy), h=w*(opt.ratio||1);
  const yy = y - h*(opt.foot ?? 0.82);
  return `<image href="${A(name)}" x="${(x-w/2).toFixed(1)}" y="${yy.toFixed(1)}" width="${w}" height="${h.toFixed(1)}" ${opt.cls?`class="${opt.cls}"`:''}/>`;
}
/* 建築外觀（寵物 7 種樣式） */
const SKIN_R = {"b_forge": 1.0885, "bb_forge": 1.0687, "bc_forge": 1.0928, "bf_forge": 1.061, "bi_forge": 1.0782, "bj_forge": 1.0668, "bl_forge": 1.0649, "b_play": 0.6936, "bb_play": 0.6959, "bc_play": 0.7324, "bf_play": 0.6988, "bi_play": 0.6965, "bj_play": 0.698, "bl_play": 0.709, "b_academy": 1.0, "bb_academy": 1.0423, "bc_academy": 1.1761, "bf_academy": 1.0387, "bi_academy": 1.1156, "bj_academy": 1.0387, "bl_academy": 1.0479, "b_farm": 0.9729, "bb_farm": 0.9677, "bc_farm": 1.0159, "bf_farm": 0.9899, "bi_farm": 1.0665, "bj_farm": 0.998, "bl_farm": 0.984, "b_shop": 1.0395, "bb_shop": 1.0573, "bc_shop": 1.0827, "bf_shop": 1.0479, "bi_shop": 1.0567, "bj_shop": 1.0498, "bl_shop": 1.0629, "b_fountain": 1.1107, "bb_fountain": 1.0804, "bc_fountain": 1.0537, "bf_fountain": 1.0765, "bi_fountain": 1.084, "bj_fountain": 1.0745, "bl_fountain": 1.0884, "b_train": 1.0774, "bb_train": 1.1151, "bc_train": 1.0884, "bf_train": 1.119, "bi_train": 1.1348, "bj_train": 1.119, "bl_train": 1.1369, "b_play": 1.1599};
const SKIN_PART = {home:'academy', barn:'farm', shop:'shop', fountain:'fountain', pen:'play', decor:'forge'};
const SKIN_DEF = {home:'b', barn:'b', shop:'b', fountain:'b', pen:'b', decor:'b'};
const SKIN_NAME = {b:'原版', bb:'紅磚', bc:'糖果', bf:'森林', bi:'冰雪', bj:'翡翠', bl:'熔岩'};
const skinImg = (k, st) => (st||SKIN_DEF[k]) + '_' + SKIN_PART[k];
function skinSprite(k, gx, gy, w, foot){ const [x,y]=iso(gx,gy), img=skinImg(k), h=w*(SKIN_R[img]||1);
  const im=`<image class="skin" data-sk="${k}" data-fy="${y}" data-w="${w}" data-foot="${foot}" href="${A(img)}" x="${(x-w/2).toFixed(1)}" y="${(y-h*foot).toFixed(1)}" width="${w}" height="${h.toFixed(1)}"/>`;
  return SKIN_FLIP[k] ? `<g transform="translate(${2*x} 0) scale(-1 1)">${im}</g>` : im; }
const SKIN_FLIP = {};
let skinSig='';
function applySkins(on){ on=on||{}; const sig=JSON.stringify(on); if(sig===skinSig) return; skinSig=sig;
  document.querySelectorAll('#world image.skin').forEach(el=>{ const k=el.dataset.sk, img=skinImg(k, on[k]), w=+el.dataset.w, h=w*(SKIN_R[img]||1);
    el.setAttribute('href', A(img)); el.setAttribute('height', h.toFixed(1)); el.setAttribute('y', (+el.dataset.fy - h*(+el.dataset.foot)).toFixed(1)); }); }
const RATIO = {bc_forge:1.0928, b_play:0.6936, bf_train:564/504, b_shop:690/627, b_farm:522/504, b_academy:690/645, bc_shop:690/594, b_fountain:690/591, b_sail:1,
  dc_flower:0.796, dc_lamp:1.969, dc_bench:0.83, dc_pond:0.819, dc_hay:0.898, dc_mail:1.291, dc_kennel:0.966, dc_lantree:1.1, dc_swing:1.113, dc_sakura:1.109, dc_picnic:0.713, dc_balloon:1.249,
  bunny1:396/310, bear1:1, fox1:1, penguin1:1, otter1:1, mouse1:1};

// 建築（萌獸星球素材），footprint 用來算前後順序與點擊
const BLD = [
  {id:'home',  name:'我的家',   img:'b_academy',  c:HG(668,128),  w:290, foot:0.80},
  {id:'shop',  name:'建築商店', img:'b_shop',     c:HG(366,200),  w:230, foot:0.80},
  {id:'barn',  name:'穀倉',     img:'b_farm',     c:[2.0,4.4],  w:380, foot:0.80},
  {id:'decor', name:'裝備商店',   img:'bc_forge',    c:HG(322,362),  w:200, foot:0.80},
  {id:'coop',  name:'牧場',     img:'dc_hay',     c:[4.1+6.2, 11.85+1.6], w:120, foot:0.78},
  {id:'bin',   name:'收集倉',   img:'dc_hay',   c:[3.0,11.3], w:104, foot:0.80},
  {id:'pen',   name:'寵物園',   img:'b_play',   c:HG(440,560), w:440, foot:0.58},
];

// 描邊：把向量圖形加上粗咖啡色外框，統一成手繪風
function ol(s, w=2, c=INK){
  return s.replace(/<(circle|ellipse|rect|polygon|path)\b([^>]*?)(\/?)>/g, (m,tag,attrs,sl)=>{
    if(/stroke=|fill="none"|rgba\(0,0,0|class="nool"|opacity=/.test(attrs)) return m;
    return `<${tag}${attrs} stroke="${c}" stroke-width="${w}" stroke-linejoin="round"${sl}>`;
  });
}

function tree(gx,gy,k=1,still,dark){ const [x,y]=iso(gx,gy); const d=(-(gx*0.7+gy*0.3)%4).toFixed(2); const c1=dark?'#3F9A3E':'#4FA845', c2=dark?'#4CA845':'#5DB54A';
  return {depth:gx+gy, svg:`<g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="0" cy="2" rx="18" ry="7" fill="rgba(0,0,0,.15)"/>
    ${ol(`<path d="M-4 2 L-3 -22 Q0 -26 3 -22 L4 2Z" fill="#9C6B43"/>`,2.2)}
    <g${still?'':` class="tsway" style="animation-delay:${d}s"`}>${ol(`<circle cx="-11" cy="-27" r="13" fill="${c1}"/><circle cx="11" cy="-29" r="14" fill="${c1}"/><circle cx="0" cy="-40" r="18" fill="${c2}"/>`,2.4,'#2F6B2A')}
    <circle class="nool" cx="-6" cy="-46" r="7" fill="#8ED46B" opacity=".75"/><circle class="nool" cx="8" cy="-34" r="4" fill="#8ED46B" opacity=".6"/><circle class="nool" cx="-14" cy="-30" r="3.5" fill="#8ED46B" opacity=".6"/></g></g>`}; }
function bush(gx,gy,fc){ const [x,y]=iso(gx,gy); return {depth:gx+gy, svg:`<g transform="translate(${x} ${y})"><ellipse cx="0" cy="1" rx="15" ry="5" fill="rgba(0,0,0,.14)"/>
  ${ol(`<circle cx="-7" cy="-6" r="8" fill="#55AE45"/><circle cx="7" cy="-6" r="8" fill="#55AE45"/><circle cx="0" cy="-11" r="9" fill="#66C255"/>`,2,'#2F6B2A')}
  ${fc?[[-6,-11],[5,-14],[8,-5],[-2,-4]].map(([a,b])=>`<circle cx="${a}" cy="${b}" r="2.6" fill="${fc}" stroke="${INK}" stroke-width="1"/>`).join(''):''}</g>`}; }
function board(gx,gy){ const [x,y]=iso(gx,gy); return {depth:gx+gy, svg:`<g transform="translate(${x} ${y})"><ellipse cx="0" cy="2" rx="28" ry="8" fill="rgba(0,0,0,.14)"/>
  ${ol(`<rect x="-22" y="-38" width="5" height="40" rx="2" fill="#9C6B43"/><rect x="17" y="-38" width="5" height="40" rx="2" fill="#9C6B43"/><rect x="-27" y="-46" width="54" height="34" rx="5" fill="#C98B5E"/><rect x="-22" y="-41" width="44" height="24" rx="3" fill="#EBC9A0"/>
  <rect x="-18" y="-38" width="12" height="14" fill="#fff" transform="rotate(-5 -12 -30)"/><rect x="-2" y="-39" width="12" height="10" fill="#FFF6C9"/><rect x="11" y="-34" width="8" height="12" fill="#D9F2FF" transform="rotate(6 15 -27)"/><path d="M-31 -46 L0 -57 L31 -46Z" fill="#8B5E3C"/>`,2.2)}
  <image href="${A('n_friends')}" x="-17" y="-80" width="34" height="34"/></g>`}; }

function personSVG(o){
  const skin=o.skin||'#FFD7B5', pants=o.pants||'#4A6FA5';
  return ol(`<ellipse class="nool" cx="0" cy="1" rx="9" ry="3.5" fill="rgba(0,0,0,.18)"/>
  <rect class="lg1" x="-5" y="-11" width="4" height="11" rx="2" fill="${pants}"/><rect class="lg2" x="1" y="-11" width="4" height="11" rx="2" fill="${pants}"/>
  <g class="bd"><rect x="-7.5" y="-23" width="15" height="14" rx="5" fill="${o.shirt}"/>
  ${o.overall?`<rect x="-6" y="-17" width="12" height="8" rx="2" fill="${o.overall}"/>`:''}
  <circle cx="0" cy="-30" r="8.5" fill="${skin}"/>
  <path d="M-8.5 -29 Q-9 -41 0 -40 Q9 -41 8.5 -29 Q5 -35 -1 -35 Q-6 -35 -8.5 -29Z" fill="${o.hair}"/>
  <circle class="nool" cx="2.5" cy="-29" r="1.3" fill="#3A3226"/><circle class="nool" cx="6.2" cy="-29" r="1.3" fill="#3A3226"/>
  <circle class="nool" cx="4.5" cy="-25.8" r="1.7" fill="#FF9AA2" opacity=".8"/>
  ${o.hat?`<ellipse cx="0" cy="-36" rx="14" ry="4" fill="#E8C766"/><path d="M-7.5 -36 Q-7 -46 0 -46 Q7 -46 7.5 -36Z" fill="#F2D57E"/><rect x="-7.5" y="-39" width="15" height="2.6" fill="#E2574C"/>`:''}
  ${o.tool==='hoe'?`<path d="M-9 -20 L-14 -46" stroke="#A86F45" stroke-width="2.5" stroke-linecap="round"/><path d="M-14 -46 l-6 2" stroke="#9AA6B2" stroke-width="4" stroke-linecap="round"/>`:''}</g>`, 1.4);
}
const CHICK = ol(`<ellipse class="nool" cy="1" rx="6" ry="2" fill="rgba(0,0,0,.15)"/><path d="M-2 -1 v2.5 M2 -1 v2.5" stroke="#F0A030" stroke-width="1.5"/><g class="bd"><ellipse cx="0" cy="-6" rx="7.5" ry="5.5" fill="#fff"/><circle cx="5" cy="-11" r="3.8" fill="#fff"/><path d="M3.5 -14.5 q1 -2.5 2 0 q1 -2.5 2.2 0z" fill="#F2545B"/><path d="M8.6 -11.2 l3.2 1 l-3.2 1z" fill="#F0A030"/><circle class="nool" cx="6.2" cy="-11.6" r=".9" fill="#333"/></g>`, 1.2);
const BUTTERFLY = c => `<g class="bfly"><ellipse cx="-4" cy="-2" rx="4.5" ry="3.5" fill="${c}" stroke="${INK}" stroke-width="1"/><ellipse cx="4" cy="-2" rx="4.5" ry="3.5" fill="${c}" stroke="${INK}" stroke-width="1"/><ellipse cx="-3" cy="2.5" rx="3" ry="2.5" fill="${c}" stroke="${INK}" stroke-width="1"/><ellipse cx="3" cy="2.5" rx="3" ry="2.5" fill="${c}" stroke="${INK}" stroke-width="1"/><rect x="-.8" y="-4" width="1.6" height="8" rx=".8" fill="${INK}"/></g>`;

/* ================= 組合地圖 ================= */
let plotEls=[], plotSig=[], plotLabs=[];
const movers=[];
let OBST=[], RANCH=null;  // 不能踩的範圍（畫面座標橢圓）
const addObst=(gx,gy,rx,ry,dy=0)=>{ const [x,y]=iso(gx,gy); OBST.push([x,y+dy,rx,ry]); };
let farmerMover=null, farmerAv=null, partyMovers=[];
/* 玩家角色＝寵物（動作仿萌獸星球：腿部切片擺動、搖擺、漂浮、呼吸） */
const CHR_RATIO={"bunny1":0.782,"bunny2":0.771,"bunny3":0.812,"mouse1":1.341,"mouse2":1.276,"mouse3":1.1,"mole1":0.882,"mole2":0.976,"mole3":0.976,"puffer1":1.0,"puffer2":0.982,"puffer3":0.965,"owl1":0.888,"owl2":0.841,"owl3":0.853,"lizard1":1.453,"lizard2":1.288,"lizard3":1.259,"deer1":0.747,"deer2":0.647,"deer3":0.712,"moth1":0.924,"moth2":0.988,"moth3":0.865,"armad1":1.112,"armad2":1.035,"armad3":0.971,"seal1":1.1,"seal2":1.059,"seal3":0.994,"marten1":1.006,"marten2":1.212,"marten3":1.276,"phoenix1":0.841,"phoenix2":0.947,"phoenix3":0.882,"fox1":1.018,"fox2":0.994,"fox3":1.0,"otter1":0.9,"otter2":0.865,"otter3":0.841,"penguin1":0.871,"penguin2":0.953,"penguin3":0.929,"pango1":1.188,"pango2":1.365,"pango3":1.147,"ferret1":0.971,"ferret2":1.053,"ferret3":1.012,"whale1":1.376,"whale2":1.182,"whale3":1.088,"bear1":0.965,"bear2":0.9,"bear3":0.935,"dragon1":0.941,"dragon2":0.935,"dragon3":0.947};
const CHR_NAMES={"bunny":["蘑菇兔","孢子兔","森菇賢者"],"mouse":["火花鼠","電光鼠","雷霆鼠"],"mole":["礦石鼴","礦工鼴","晶甲鼴王"],"puffer":["泡泡豚","珊瑚豚","鎧刺豚"],"owl":["雪絨鴞","霜羽鴞","冰冠鴞"],"lizard":["火蜥寶","熔岩蜥","岩漿蜥王"],"deer":["雷光鹿","雷角鹿","霆冠鹿王"],"moth":["花芽蝶","花仙蝶","虹彩花后"],"armad":["小鋼甲","鐵甲犰狳","鋼堡犰狳"],"seal":["雪球海豹","極光海豹","極光女王"],"marten":["影絨貂","影刺貂","雷影忍貂"],"phoenix":["火鳥雛","烈焰鳥","不死鳳凰"],"fox":["小焰狐","焰尾狐","炎陽狐王"],"otter":["泡泡獺","浪花獺","潮汐獺王"],"penguin":["雪糰企鵝","霜羽企鵝","冰冠企鵝帝"],"pango":["小石甲","滾石甲","山岳甲王"],"ferret":["靜電毛球","雷絨貂","雷霆貂"],"whale":["小鯨鈴","鳴鈴鯨","天籟鯨"],"bear":["苔苔熊","藤甲熊","古森熊王"],"dragon":["星晶龍寶","星晶龍","創星龍"]};
const CHR_SP={bunny:['蘑菇兔',.9,'quad',.74,.5],mouse:['小鼠',1.3,'quad',.72,.5],mole:['鼴鼠',.6,'biped',.8,.48],
  owl:['貓頭鷹',.6,'waddle'],lizard:['蜥蜴',1,'quad',.72,.5],deer:['小鹿',1.1,'quad',.62,.5],moth:['飛蛾',.8,'float'],armad:['犰狳',.55,'quad',.74,.5],
  seal:['海豹',.5,'waddle'],marten:['貂',1.35,'quad',.7,.5],phoenix:['鳳凰',.9,'float'],fox:['狐狸',1.2,'quad',.7,.5],otter:['水獺',.8,'biped',.8,.48],
  penguin:['企鵝',.65,'waddle'],pango:['穿山甲',.55,'quad',.7,.5],ferret:['雪貂',1.35,'quad',.68,.5],bear:['熊',.6,'biped',.8,.48],dragon:['龍',.85,'quad',.74,.5]};
const chrInfo=k=>{ const m=/^([a-z]+)([1-3])$/.exec(k||'')||[0,'bunny','1']; const sp=CHR_SP[m[1]]?m[1]:'bunny', d=CHR_SP[sp];
  return {k:sp+m[2], sp, st:+m[2], name:d[0], spd:d[1], type:d[2], legY:d[3]||.8, mid:d[4]||.5}; };
const chrSrc=k=>A('c_'+k);
function charSVG(k){
  const c=chrInfo(k), n=48+c.st*9, b=n*(CHR_RATIO[c.k]||1), src=chrSrc(c.k), id='ck'+c.k;
  const img=clip=>`<image href="${src}" x="${-b/2}" y="${-n}" width="${b}" height="${n}"${clip?` clip-path="url(#${clip})"`:''}/>`;
  let body;
  if(c.type==='float'||c.type==='waddle') body=img();
  else { const v=c.legY, m=c.mid;
    body=`<clipPath id="${id}a"><rect x="${-b/2}" y="${-n+n*v}" width="${b*(m+.07)}" height="${n*(1-v)}"/></clipPath>
      <clipPath id="${id}b"><rect x="${-b/2+b*(m-.07)}" y="${-n+n*v}" width="${b*(1-m+.07)}" height="${n*(1-v)}"/></clipPath>
      <clipPath id="${id}t"><rect x="${-b/2}" y="${-n}" width="${b}" height="${n*(v+.09)}"/></clipPath>
      <g class="cp-a">${img(id+'a')}</g><g class="cp-b">${img(id+'b')}</g><g class="cp-t">${img(id+'t')}</g>`; }
  return `<ellipse class="cp-sh" cx="0" cy="0" rx="${b*.3}" ry="${n*.08}" fill="rgba(0,0,0,.2)"/><g class="cp-root">${body}</g>`;
}
function setFarmer(k, gid){ setMoverChar(farmerMover, k, gid); }
function setMoverChar(m, k, gid){ const sig=k+'|'+((typeof GEAR!=='undefined'&&GEAR[gid])?gid:''); if(!m || m.sig===sig) return; m.sig=sig; m.el.firstChild.innerHTML=charSVG(k);
  const g=(typeof GEAR!=='undefined')&&GEAR[gid]; if(g){ const c=chrInfo(k), n=48+c.st*9, sz=Math.round(n*.26), bx=0, by=-n-sz*.35, tgt=m.el.querySelector('.cp-t')||m.el.querySelector('.cp-root');  // 小小一顆浮在寵物頭上，不擋臉
    tgt.insertAdjacentHTML('beforeend',`<g class="gbadge"><circle cx="${bx}" cy="${by}" r="${sz*.58}" fill="#FFF8E6" stroke="#4B3423" stroke-width="1.4"/><image href="${A(g.icon)}" x="${bx-sz/2}" y="${by-sz/2}" width="${sz}" height="${sz}"/></g>`); }
  m.c=chrInfo(k); m.n=48+m.c.st*9; m.ph=0; m.anim=Math.random()*9; m.jump=0;
  m.parts={root:m.el.querySelector('.cp-root'), a:m.el.querySelector('.cp-a'), b:m.el.querySelector('.cp-b'), t:m.el.querySelector('.cp-t'), sh:m.el.querySelector('.cp-sh')}; }
/* 每幀姿勢（照寵物的算法） */
function farmerPose(m, dt, moving){
  const P=m.parts; if(!P||!P.root) return; const c=m.c, n=m.n, act=m.act;
  m.anim+=dt; if(moving) m.ph+=dt*c.spd*(m.task?14:9);
  let f=0,u=1,p=1,h=0;
  if(moving){ if(c.type==='waddle'){ h=Math.sin(m.ph)*.13; f=Math.abs(Math.sin(m.ph))*n*.03; }
    else if(c.type==='float') h=Math.sin(m.ph)*.05;
    else { const k=Math.cos(m.ph*2)*.012; p=1+k; u=1-k; } }
  if(c.type==='float') f+=n*(.12+Math.sin(m.anim*2.2)*.04);
  if(!moving){ const k=Math.sin(m.anim*2.6)*.025; u=1+k; p=1-k;
    if(act==='work'||act==='water') h=Math.sin(m.anim*10)*.06;
    if(act==='angry') h=Math.sin(m.anim*40)*.05;
    if(act==='look') h=Math.sin(m.anim*2.5)*.1; }
  if(!moving && (act==='cheer'||act==='wave'||act==='stretch')){ m.jump=(m.jump||0)+dt; if(m.jump>(act==='cheer'?.55:.9)) m.jump=0; } else m.jump=0;
  if(m.jump>0 && m.jump<.45){ const k=Math.sin(m.jump/.45*Math.PI); f+=k*n*(act==='cheer'?.35:.18); p*=1+k*.08; u*=1-k*.05; }
  P.root.setAttribute('transform',`translate(0 ${(-f).toFixed(2)}) rotate(${(h*57.3).toFixed(2)}) scale(${u.toFixed(3)} ${p.toFixed(3)})`);
  P.sh.setAttribute('transform',`scale(${Math.max(.3,1-f/n*.6).toFixed(3)} 1)`);
  if(P.a){ const E=c.type==='quad'?1:1.15, i=m.ph;
    const leg=(el,kk,ph)=>{ const lift=moving?Math.max(0,kk)*n*.075*E:0, dx=moving?Math.cos(ph)*n*.045*E:0; el.setAttribute('transform',`translate(${dx.toFixed(2)} ${(-lift).toFixed(2)})`); };
    leg(P.a,Math.sin(i),Math.sin(i)>0?i:i+Math.PI); leg(P.b,Math.sin(i+Math.PI),Math.sin(i+Math.PI)>0?i:i+Math.PI);
    P.t.setAttribute('transform',`translate(0 ${moving?(-Math.abs(Math.cos(i))*n*.03).toFixed(2):0})`); }
}
function openCharPicker(){
  const cur=(S.me.chara)||'bunny1';
  const evo=(typeof EVO!=='undefined')?EVO:[10,20];
  modal('選擇寵物', `<p class="mut" style="margin:0 0 8px">選一隻寵物當你的農場夥伴，牠會在農場裡走來走去幫你做事。</p><div class="chgrid">${Object.keys(CHR_SP).map(sp=>{ const k=sp+'1';
    return `<button class="chpick${sp===chrSpecies(cur)?' on':''}" data-ch="${k}"><img src="${chrSrc(sp+'1')}" alt=""><span>${(CHR_NAMES[sp]||[])[0]||CHR_SP[sp][0]}</span></button>`; }).join('')}</div>`);
  document.querySelectorAll('[data-ch]').forEach(b=>b.onclick=async()=>{
    try{ applyState(await rpc('farm_set_chara', {p_c:b.dataset.ch})); refresh(); sfx('coin'); toast('寵物已更換'); closeModal(); }catch(e){ toast(e.message); }
  });
}
/* 角色動作 */
function setAct(m, a){ if(m.act===a) return; if(m.act) m.el.classList.remove('a-'+m.act); m.act=a; if(a) m.el.classList.add('a-'+a); }
function emote(m, e){ if(!e || typeof spawn!=='function') return; const r=m.el.getBoundingClientRect(); if(!r.width) return;
  spawn(`<span>${e}</span>`, r.left+r.width/2-14, r.top-18, 'emo', 1500); }
const FARMER_ACT = {harvest:['work','✨'], water:['water','💧'], seed:['work','🌱'], dig:['work','💪'], weed:['work','👍'], bug:['work','👍'],
  steal:['angry','💢'], prank:['angry','😤'], help:['cheer','❤️']};
function farmerDo(i, kind){
  const m=farmerMover; if(!m || !kind) return;
  let [act,emo] = FARMER_ACT[kind] || ['work','✨'];
  if(typeof mode!=='undefined' && mode==='visit'){ // 好友的角色在原地反應
    if(kind!=='steal' && kind!=='prank') [act,emo]=FARMER_ACT.help;
    setAct(m,null); m.task={pos:[m.x,m.y], act, emo, dur:1.6, started:false}; return; }
  const P=PLOTS[i]; if(!P) return;
  m.task={pos:[P[0]+PS*0.5, P[1]+PS+0.12], act, emo, dur:1.5, started:false, look:[P[0]+PS/2,P[1]+PS/2]};
  setAct(m,null); m.wait=0; m.goal=null;
}

/* 寵物身上的裝備自動做事時，帶那件裝備的寵物會跑過去做動作 */
const PET_JOB = {plant:['work','🌱'], water:['water','💧'], harvest:['work','🧺'], weed:['work','🌿'], bug:['work','🐛'], feed:['work','🥕']};
function petDo(func, target){
  if(typeof mode!=='undefined' && mode!=='home') return;
  const pt=(typeof partyOf==='function' && S && S.me) ? partyOf(S.me) : [];
  let i=pt.findIndex(p=>{ const g=GEAR[p.g]; return g && (g.func===func || (func==='feed' && g.func==='clear')); }); if(i<0) i=0;
  const m = i===0 ? farmerMover : (partyMovers[i-1] || farmerMover); if(!m) return;
  const [act,emo]=PET_JOB[func]||['work','✨'];
  let pos, look;
  if(target==='ranch'){ if(!RANCH) return; pos=[RANCH[0]+RANCH[2]*(0.2+Math.random()*0.6), RANCH[1]-0.5]; look=[pos[0], RANCH[1]+1]; }
  else { const P=PLOTS[target]; if(!P) return; pos=[P[0]+PS*0.5, P[1]+PS+0.12]; look=[P[0]+PS/2, P[1]+PS/2]; }
  m.jobs=m.jobs||[]; if(m.jobs.length>=6) return;
  m.jobs.push({pos, act, emo, dur:1.3, started:false, look});
}

function buildWorld(){
  toneCur=null;
  OBST=[];
  skinSig='';
  const W=$('world');
  W.setAttribute('viewBox',`${VX} ${VY} ${WW} ${WH}`);
  seed=11;
  let defs='', sea='', island='', ground='', objs=[], lab='', cloud='';

  defs = `<defs>
    <linearGradient id="gGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A5DB72"/><stop offset="1" stop-color="#7EC452"/></linearGradient>
    <linearGradient id="gCliffL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C08A5A"/><stop offset="1" stop-color="#8E5E38"/></linearGradient>
    <linearGradient id="gCliffR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A2703F"/><stop offset="1" stop-color="#704526"/></linearGradient>
    <linearGradient id="gRiver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6FCBF2"/><stop offset="1" stop-color="#3FA6E0"/></linearGradient>
    <pattern id="pGrass" patternUnits="userSpaceOnUse" width="176" height="152"><image href="${A('grass_tile')}" width="176" height="152"/></pattern>
    <radialGradient id="gGlow"><stop offset="0" stop-color="#FFE9A8" stop-opacity=".9"/><stop offset="1" stop-color="#FFE9A8" stop-opacity="0"/></radialGradient>
    <linearGradient id="gSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ADBF7"/><stop offset="1" stop-color="#6EC3EE"/></linearGradient>
  </defs>`;

  // 天空（同萌獸主頁：漸層＋陽光＋遠方浮島）
  defs = defs.replace('</defs>',`<linearGradient id="gSky" gradientUnits="userSpaceOnUse" x1="0" y1="${VY}" x2="0" y2="${VY+WH}"><stop offset="0" stop-color="#3f9be8"/><stop offset=".55" stop-color="#8fcdfb"/><stop offset="1" stop-color="#d6efff"/></linearGradient>
    <radialGradient id="gSun"><stop offset="0" stop-color="rgba(255,250,220,.95)"/><stop offset=".25" stop-color="rgba(255,240,180,.5)"/><stop offset="1" stop-color="rgba(255,240,180,0)"/></radialGradient></defs>`);
  sea += `<rect x="${VX-1500}" y="${VY-1500}" width="${WW+3000}" height="${WH+3000}" fill="url(#gSky)"/>`;
  // 遠景：用萌獸主頁圖四周的山、瀑布、浮島、森林拼成
  sea += `<g id="starL"></g>`;
  sea += `<image href="${A('backdrop')}" x="-400" y="-300" width="2400" height="1400" preserveAspectRatio="none"/>`;
  // 萌獸主頁浮空島
  island += `<image href="${A('home_island')}" x="0" y="0" width="${IW}" height="${IH}"/>`;
  // 瀑布水花
  island += `<ellipse class="wave" cx="${105*IS}" cy="${600*IS}" rx="28" ry="8" fill="#fff" opacity=".7"/>`;

  // 田區底＋木圍欄
  ground += poly(dia(4.1,6.5,10.15,5.35),'url(#pGrass)',`stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"`);
  const fence=(x0,y0,x1,y1,col='#E8D3A2')=>{ let s=''; const n=Math.ceil(Math.hypot(x1-x0,y1-y0)/0.55);
    const a=iso(x0,y0), b=iso(x1,y1); s+=`<path d="M${P([up(a,9),up(b,9)])} M${P([up(a,16),up(b,16)])}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M${P([up(a,9),up(b,9)])} M${P([up(a,16),up(b,16)])}" stroke="${col}" stroke-width="2.6" stroke-linecap="round"/>`;
    for(let k=0;k<=n;k++){ const p=iso(x0+(x1-x0)*k/n, y0+(y1-y0)*k/n); s+=`<rect x="${p[0]-2.5}" y="${p[1]-21}" width="5" height="21" rx="2" fill="#F3E3BF" stroke="${INK}" stroke-width="1.5"/>`; } return s; };

  // 圍欄草地（後兩邊畫在地面層，前兩邊依深度排序）
  const pen=(x,y,w,d,col,base,gate)=>{ ground += poly(dia(x,y,w,d),base,`stroke="${INK}" stroke-width="2" stroke-linejoin="round"`);
    // 靠農田那一邊要畫在田的前面，不然會被田擋住
    objs.push({depth:x+w+y+0.05, svg: fence(x,y,x+w,y,col)});
    objs.push({depth:x+y+d, svg: fence(x,y,x,y+d,col)});
    if(gate==='front'){ const g0=x+w*0.32-0.5, g1=x+w*0.32+0.5, a=iso(g0,y+d), b=iso(g1,y+d);
      const post=p=>ol(`<rect x="${p[0]-4}" y="${p[1]-30}" width="8" height="30" rx="3" fill="#A86F45"/><circle cx="${p[0]}" cy="${p[1]-32}" r="5" fill="#F4D35E"/>`,1.8);
      // 關著的木門（兩片）
      const gate=(p,q)=>{ const m=[(p[0]+q[0])/2,(p[1]+q[1])/2]; const leaf=(u,v)=>ol(`<polygon points="${u[0]},${u[1]-6} ${v[0]},${v[1]-6} ${v[0]},${v[1]-24} ${u[0]},${u[1]-24}" fill="#C98B5E"/>`,1.8)+`<path d="M${u[0]} ${u[1]-15} L${v[0]} ${v[1]-15} M${u[0]} ${u[1]-6} L${v[0]} ${v[1]-24}" stroke="#8B5E3C" stroke-width="2"/>`;
        return leaf([p[0]+3,p[1]],[m[0]-1,m[1]]) + leaf([m[0]+1,m[1]],[q[0]-3,q[1]]); };
      objs.push({depth:x+w+y+d+0.2, svg: fence(x,y+d,g0,y+d,col) + fence(g1,y+d,x+w,y+d,col) + fence(x+w,y,x+w,y+d,col) + gate(a,b) + post(a) + post(b)}); }
    else objs.push({depth:x+w+y+d+0.2, svg: fence(x,y+d,x+w,y+d,col) + fence(x+w,y,x+w,y+d,col)}); };
  // 牧場（農田左邊、島的下方中間）
  const RX=4.1, RY=11.85, RW=10.15, RD=3.0;  // 農田左下邊，長度跟農田切齊
  pen(RX,RY,RW,RD,'#E8D3A2','url(#pGrass)','front');
  const GATE=[RX+RW*0.32, RY+RD]; RANCH=[RX,RY,RW,RD];  // 牧場門（寵物從這裡進出）
  { const [tx,ty]=iso(RX+RW-0.7, RY+0.6); objs.push({depth:RX+RW+RY, svg: ol(`<path d="M${tx-22} ${ty-6} l22 -11 l22 11 l-22 11z" fill="#8B5E3C"/><path d="M${tx-18} ${ty-6} l18 -9 l18 9 l-18 9z" fill="#F4D35E"/>`,2)}); }

  // 建築
  BLD.forEach(o=>{ if(o.skip) return;
    if(o.id!=='pen' && o.id!=='coop'){ // 擋住整個建築圖的範圍（含後面），寵物才不會走到屋頂上
      const hh=o.w*(SKIN_PART[o.id] ? (SKIN_R[skinImg(o.id)]||1.1) : (RATIO[o.img]||1))*o.foot;
      addObst(o.c[0],o.c[1],o.w*0.52,hh/2+16,-hh/2+8); }
    const [gx,gy]=o.c, h=o.w*(RATIO[o.img]||1);
    let s = (SKIN_PART[o.id] ? skinSprite(o.id, gx, gy, o.w, o.foot) : sprite(o.img, gx, gy, o.w, {ratio:RATIO[o.img], foot:o.foot}));
    if(o.id==='barn'){ // 風車葉片
      const [x,y]=iso(gx,gy), top=y-h*o.foot; const cx=x-o.w*0.5+o.w*0.235, cy=top+h*0.2;
      s += `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})"><g class="blades"><image href="${A('b_sail')}" x="-55" y="-55" width="110" height="110"/></g></g>`;
    }
    if(o.id==='home'){ const [x,y]=iso(gx,gy), top=y-h*o.foot; s += `<circle class="smoke" cx="${x+o.w*0.24}" cy="${top+h*0.02}" r="6" fill="#fff" opacity=".75"/><circle class="smoke" style="animation-delay:1.5s" cx="${x+o.w*0.26}" cy="${top}" r="5" fill="#fff" opacity=".75"/>`; }
    if(o.id==='coop'){ // 牧場：乾草車不接受點擊（避免擋到農田），改成點牧場草地
      ground += `<g class="tap" data-b="coop"><polygon points="${P(dia(RX,RY,RW,RD))}" fill="rgba(0,0,0,0)"/></g>`;
    } else if(o.id==='pen'){ // 寵物園圖很大：只有地面那一圈可以點，才不會蓋到上面的商店
      const [x,y]=iso(gx,gy);
      objs.push({depth:gx+gy, svg:`<g class="tap" data-b="pen"><g style="pointer-events:none">${s}</g><ellipse cx="${x.toFixed(1)}" cy="${(y-h*0.1).toFixed(1)}" rx="${(o.w*0.44).toFixed(1)}" ry="${(o.w*0.2).toFixed(1)}" fill="rgba(0,0,0,0)"/></g>`});
    } else objs.push({depth:gx+gy, svg:`<g class="tap" data-b="${o.id}">${s}</g>`});
    const [lx,ly]=iso(gx,gy);
    if(o.id==='home'){ HOME_LBL=[lx, ly - h*0.12]; homeLblCur=homeLblName(); lab += `<g id="homeLbl">${labelPill(lx, ly - h*0.12, '🏠 '+esc(homeLblCur)+'的家', {big:1})}</g>`; }  // 放在大門前面，不會被上方玩家欄擋住
    else if(o.id==='bin'){ BIN_LBL=[lx, ly-h*o.foot-18]; lab += `<g id="binLbl">${labelPill(lx, ly-h*o.foot-18, binLblText(), {bg:'#FFF1DC'})}</g>`; }
    else lab += labelPill(lx, ly - (o.id==='coop'?20:h*o.foot-18), o.name, {locked:!!o.locked, bg:o.id==='shop'?'#FFF1DC':null});
  });

  // 裝飾（萌獸星球素材）
  const deco=(n,gx,gy,w,extra='')=>(addObst(gx,gy,w*0.38,w*0.2,-w*0.06), objs.push({depth:gx+gy, svg:`<g ${extra}>${sprite(n,gx,gy,w,{ratio:RATIO[n],foot:0.8})}</g>`}));
  const FC=HG(645,352); addObst(FC[0],FC[1],80,70,-40); objs.push({depth:FC[0]+FC[1], svg:`<g class="tap" data-b="board">${skinSprite('fountain', FC[0], FC[1], 150, 0.8)}</g>`});
  lab += labelPill(iso(...FC)[0], iso(...FC)[1]-150, '好友廣場', {bg:'#E3F6EA',fg:'#2E9660'});
  [[560,318],[730,318],[560,378],[730,378]].map(([x,y])=>HG(x,y)).forEach(([x,y])=>{ deco('dc_lamp',x,y,46); const [px,py]=iso(x,y); objs.push({depth:x+y+0.01, svg:`<circle class="lampglow" cx="${px}" cy="${py-34}" r="30" fill="url(#gGlow)"/>`}); });
  deco('dc_flower', ...HG(505,262), 58); deco('dc_flower', ...HG(845,300), 52); deco('dc_balloon', ...HG(545,470), 64, 'class="floaty"');
  // 島下方空地的裝飾
  [[650,640,'#FF9AA2'],[770,650,'#FFFFFF'],[880,640,null],[590,530,'#FFE066'],[860,520,'#B9A6FF']].forEach(([x,y,f])=>{ const g=HG(x,y); objs.push(bush(g[0],g[1],f)); });

  // 田地（可點）
  PLOTS.forEach((_,i)=>{ objs.push({depth:PLOTS[i][0]+PLOTS[i][1]+PS, svg:`<g class="tap plot" data-p="${i}"><g class="pg"></g><g class="ps"></g></g>`}); });

  // 農夫與商店老闆
  const stand=(gx,gy,o,flip)=>{ const [x,y]=iso(gx,gy); objs.push({depth:gx+gy, svg:`<g transform="translate(${x} ${y}) scale(${flip?-1.2:1.2} 1.2)">${personSVG(o)}</g>`}); };

  objs.sort((a,b)=>a.depth-b.depth);

  // 雲
  for(let k=0;k<4;k++){ const y=40+k*150+rnd()*60, d=55+rnd()*40, s=0.8+rnd()*0.7;
    cloud+=`<g class="cloud" style="animation-duration:${d}s;animation-delay:${-rnd()*d}s"><g transform="translate(0 ${y}) scale(${s})" opacity=".8">${ol(`<ellipse cx="0" cy="0" rx="40" ry="14" fill="#fff"/><ellipse cx="18" cy="-10" rx="22" ry="14" fill="#fff"/><ellipse cx="-14" cy="-6" rx="16" ry="11" fill="#fff"/>`,2,'#BFDCEB')}</g></g>`; }
  // 飛鳥
  for(let k=0;k<2;k++) cloud += `<g class="bird" style="animation-delay:${-k*17}s"><g transform="translate(0 ${120+k*90})"><path d="M0 0 q6 -6 12 0 q6 -6 12 0" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path transform="translate(26 14) scale(.8)" d="M0 0 q6 -6 12 0 q6 -6 12 0" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/></g></g>`;

  W.innerHTML = `${defs}<g>${sea}</g><g>${island}</g><g>${ground}</g><g id="objs">${objs.map(o=>o.svg).join('')}</g><g id="decorL"></g><g id="movers" style="pointer-events:none"></g><g id="toneL" style="pointer-events:none"></g><g id="fxw"></g><g class="sky" style="pointer-events:none">${cloud}</g><g id="labels">${lab}<g id="plabs"></g></g>`;

  OBST_FIXED=OBST.slice(); decorSig=''; bindDecorLayer();
  // 田地元素與標籤
  plotEls=[]; plotSig=[]; plotLabs=[];
  const pl=$('plabs');
  W.querySelectorAll('[data-p]').forEach(g=>{ const i=+g.dataset.p; plotEls[i]=g; plotSig[i]=''; g.addEventListener('click',()=>act(i)); });
  PLOTS.forEach((_,i)=>{ const [cx,cy]=plotCenter(i);
    const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('class','plab'); g.setAttribute('transform',`translate(${cx} ${cy-44})`);
    g.innerHTML=`<rect x="-38" y="-11" width="76" height="22" rx="10" fill="#fff" stroke="${INK}" stroke-width="1.6"/><text x="0" y="2" text-anchor="middle" font-size="11" font-weight="900" fill="#3A3226" font-family="Noto Sans TC,sans-serif"></text><rect class="bb" x="-28" y="5" width="56" height="3" rx="1.5" fill="#EEE6D6"/><rect class="bf" x="-28" y="5" width="0" height="3" rx="1.5" fill="#7ED957"/>`;
    pl.appendChild(g); plotLabs[i]=g; });
  W.querySelectorAll('[data-b]').forEach(g=>g.addEventListener('click',()=>tapBuilding(g)));

  // 會動的萌寵、小雞、蝴蝶
  movers.length=0;
  const mv=$('movers');
  const addMover=(html,o)=>{ const g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.innerHTML=`<g class="mvin">${html}</g>`; mv.appendChild(g); movers.push(Object.assign({el:g,wait:0,face:1},o)); };
  const pet=(n,w)=>{ const h=w*(RATIO[n]||1); return `<ellipse cx="0" cy="1" rx="${w*0.32}" ry="${w*0.1}" fill="rgba(0,0,0,.16)"/><g class="hop"><image href="${A(n)}" x="${-w/2}" y="${-h*0.96}" width="${w}" height="${h}"/></g>`; };
  // 農場主人（用頭像做的人物，自己家＝自己，拜訪＝好友）
  const H_=([x,y])=>HG(x,y), C0=HG(645,425);
  const out=[GATE[0],GATE[1]+0.9], gin=[GATE[0],GATE[1]-0.1], inside=[GATE[0]+0.4,GATE[1]-1.6], inside2=[GATE[0]+2.6,GATE[1]-1.4];
  const WP=[[645,425],[560,430],[420,265],[545,285],[600,235],[690,235],[745,285],[890,268],[760,300],[730,430],[650,480],[760,520]].map(H_)
    .concat([out,gin,inside,inside2,inside,gin,out]).concat([[620,520],[690,500]].map(H_));
  addMover('',{x:C0[0],y:C0[1],path:WP,tgt:1,speed:0.55,s:1.25,farmer:true});
  farmerMover=movers[movers.length-1]; farmerAv=null; partyMovers=[];
  ranchMovers=[]; ranchSig='';
  { const pc=BLD.find(b=>b.id==='pen').c; PARK=[pc[0]-0.6, pc[1]-0.9, 2.5]; parkMovers=[]; parkSig=''; }
  ['#FFD6E5','#FFE066','#BDE6FF'].forEach((c,k)=>addMover(BUTTERFLY(c),{x:5+k*3,y:8+k,fly:true,area:[3,6,15,12],speed:0.9,s:1.1,wait:rnd()}));
}

/* 自由走動：整座島都能走，不踩建築與裝飾；偶爾從牧場門進出 */
const ISL=[672*IS,360*IS,545*IS,292*IS];
function walkable(gx,gy){ const [x,y]=iso(gx,gy);
  if(((x-ISL[0])/ISL[2])**2+((y-ISL[1])/ISL[3])**2>1) return false;
  for(const [ox,oy,rx,ry] of OBST) if(((x-ox)/rx)**2+((y-oy)/ry)**2<1) return false;
  if(RANCH && gx>RANCH[0]-0.15 && gx<RANCH[0]+RANCH[2]+0.15 && gy>RANCH[1]-0.15 && gy<RANCH[1]+RANCH[3]+0.15) return false;
  return true; }
function clearLine(a,b){ const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/0.25); for(let k=1;k<=n;k++){ if(!walkable(a[0]+(b[0]-a[0])*k/n, a[1]+(b[1]-a[1])*k/n)) return false; } return true; }
function inRanch(gx,gy){ return RANCH && gx>RANCH[0]-0.2 && gx<RANCH[0]+RANCH[2]+0.2 && gy>RANCH[1]-0.2 && gy<RANCH[1]+RANCH[3]+0.2; }
function ranchClear(a,b){ const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/0.2); for(let k=1;k<=n;k++){ if(inRanch(a[0]+(b[0]-a[0])*k/n, a[1]+(b[1]-a[1])*k/n)) return false; } return true; }
/* 繞過牧場的路線（回傳途經點，不含終點） */
function viaAround(from, to){
  if(!RANCH || ranchClear(from,to)) return [];
  const [X,Y,W,D]=RANCH, m=0.6, C=[[X-m,Y-m],[X+W+m,Y-m],[X-m,Y+D+m],[X+W+m,Y+D+m]], L=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
  let best=null, bl=1e9;
  for(const c of C) if(ranchClear(from,c) && ranchClear(c,to)){ const l=L(from,c)+L(c,to); if(l<bl){ bl=l; best=[c]; } }
  if(best) return best;
  for(const c1 of C) for(const c2 of C) if(c1!==c2 && ranchClear(from,c1) && ranchClear(c1,c2) && ranchClear(c2,to)){ const l=L(from,c1)+L(c1,c2)+L(c2,to); if(l<bl){ bl=l; best=[c1,c2]; } }
  return best||[];
}
function pickRoam(m){
  if(!walkable(m.x,m.y)){ // 卡在不能走的地方（例如牧場裡），先走到最近的空地
    for(let r=0.4;r<8;r+=0.4) for(let a=0;a<16;a++){ const g=[m.x+Math.cos(a/16*Math.PI*2)*r, m.y+Math.sin(a/16*Math.PI*2)*r]; if(walkable(g[0],g[1]) && !inRanch(g[0],g[1])){ m.route=viaAround([m.x,m.y],g).slice(1); return g; } }
  }
  for(let k=0;k<40;k++){ const a=Math.random()*Math.PI*2, r=1.5+Math.random()*5, g=[m.x+Math.cos(a)*r, m.y+Math.sin(a)*r];
    if(walkable(g[0],g[1]) && clearLine([m.x,m.y],g)) return g; }
  return [m.x,m.y]; }
/* 農場主人的移動與動作 */
function farmerStep(m, dt){
  let moving=false;
  if(m.wait>0){ m.wait-=dt; if(m.wait<=0){ setAct(m,null); if(m.task && m.task.started) m.task=null; } }
  else {
    if(!m.task && m.jobs && m.jobs.length){ m.task=m.jobs.shift(); m.goal=null; }
    if(!m.task && !m.goal) m.goal = (m.route && m.route.length) ? m.route.shift() : pickRoam(m);
    if(m.task && !m.task.via){ m.task.via = viaAround([m.x,m.y], m.task.pos); }
    const goal = m.task ? (m.task.via.length ? m.task.via[0] : m.task.pos) : m.goal;
    const dx=goal[0]-m.x, dy=goal[1]-m.y, dist=Math.hypot(dx,dy), step=(m.task?2.4:m.speed*(m.c?Math.max(.6,Math.min(1.3,m.c.spd)):1))*dt;
    if(dist<=step && m.task && m.task.via.length){ m.x=goal[0]; m.y=goal[1]; m.task.via.shift(); moving=true; }
    else if(dist<=step){ m.x=goal[0]; m.y=goal[1];
      if(m.task){ m.task.started=true; if(m.task.look){ const sd=(m.task.look[0]-m.x)-(m.task.look[1]-m.y); if(Math.abs(sd)>0.05) m.face=sd>0?1:-1; }
        setAct(m,m.task.act); m.wait=m.task.dur; emote(m,m.task.emo); }
      else { m.goal=null; if(m.route && m.route.length){ m.wait=0.2+Math.random()*0.6; } else { m.wait=1+Math.random()*3;
        const r=Math.random(); if(r<0.5) setAct(m, ['wave','stretch','look','wave'][Math.floor(Math.random()*4)]); } }
    } else { m.x+=dx/dist*step; m.y+=dy/dist*step; moving=true; const sdx=dx-dy; if(Math.abs(sdx)>0.01) m.face=sdx>0?1:-1; }
  }
  farmerPose(m, dt, moving);
  const [sx,sy]=iso(m.x,m.y);
  m.el.setAttribute('transform',`translate(${sx.toFixed(1)} ${sy.toFixed(1)}) scale(${m.face*m.s} ${m.s})`);
  if(m.moving!==moving){ m.moving=moving; m.el.classList.toggle('walk',moving); m.el.classList.toggle('run',moving && !!m.task); }
}
/* 移動動畫 */
let lastF=performance.now();
function animate(now){
  const dt=Math.min(0.1,(now-lastF)/1000); lastF=now;
  for(const m of movers){
    if(m.fly && LOWFX){ m.el.style.display='none'; continue; }
    if(m.farmer){ farmerStep(m, dt); continue; }
    let moving=false;
    if(m.wait>0){ m.wait-=dt; }
    else {
      if(!m.goal){
        if(m.chick || m.fly){ const a=m.area; m.goal=[a[0]+Math.random()*(a[2]-a[0]), a[1]+Math.random()*(a[3]-a[1])]; }
        else { m.goal=m.path[m.tgt]; }
      }
      const dx=m.goal[0]-m.x, dy=m.goal[1]-m.y, dist=Math.hypot(dx,dy), step=m.speed*dt;
      if(dist<=step){ m.x=m.goal[0]; m.y=m.goal[1]; m.goal=null;
        if(m.chick) m.wait=0.6+Math.random()*2.5; else if(m.fly) m.wait=Math.random()*0.6; else { m.tgt=(m.tgt+1)%m.path.length; m.wait=(m.farmer?0.8:1)+Math.random()*3; } }
      else { m.x+=dx/dist*step; m.y+=dy/dist*step; moving=true;
        const sdx=(dx-dy); if(Math.abs(sdx)>0.01) m.face = (sdx>0?1:-1) * (m.petFace||1); }
    }
    let [sx,sy]=iso(m.x,m.y); if(m.fly) sy -= 30 + Math.sin(now/400 + m.x)*8;
    m.el.setAttribute('transform',`translate(${sx.toFixed(1)} ${sy.toFixed(1)}) scale(${m.face*m.s} ${m.s})`);
    if(m.tag) m.tag.setAttribute('transform',`scale(${m.face} 1)`);
    if(m.moving!==moving){ m.moving=moving; m.el.classList.toggle('walk',moving); }
  }
  requestAnimationFrame(animate);
}

/* ================= 田地繪製 ================= */
const SPR=0.7;
function plotGroundSVG(p,i){
  const [x,y]=PLOTS[i], pts=dia(x,y,PS,PS), B=pts[1], C=pts[2], D=pts[3];
  let top='#9A6743', rim='#B98258', sl='#7A4E30', sr='#663F25';
  if(p.s==='wild'){ top='url(#pGrass)'; rim='#B4E27F'; sl='#8B5E3C'; sr='#76502F'; }
  else if(p.s==='grow'){ if(isDry(p)){ top='#C79563'; rim='#D8AA78'; } else { top='#6E4329'; rim='#845436'; } }
  const k=7;
  let s = poly([D,C,[C[0],C[1]+k],[D[0],D[1]+k]],sl,`stroke="${INK}" stroke-width="2"`) + poly([C,B,[B[0],B[1]+k],[C[0],C[1]+k]],sr,`stroke="${INK}" stroke-width="2"`)
        + poly(pts,top,`stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" class="soil"`);
  const inner=dia(x+0.08,y+0.08,PS-0.16,PS-0.16); s += `<path d="M${P([inner[3],inner[0],inner[1]])}" stroke="${rim}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>`;
  if(p.s!=='wild'){
    for(const t of [0.28,0.52,0.76]) s+=`<path d="M${P([iso(x+0.14,y+PS*t),iso(x+PS-0.14,y+PS*t)])}" stroke="rgba(40,22,10,.28)" stroke-width="4" stroke-linecap="round"/><path d="M${P([iso(x+0.14,y+PS*t-0.06),iso(x+PS-0.14,y+PS*t-0.06)])}" stroke="${rim}" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`;
    const r=(i*13)%7; [[0.25,0.18],[1.1,0.4],[0.6,1.2],[1.25,1.15]].forEach(([a,b],k)=>{ if((k+r)%2) return; const [px,py]=iso(x+a,y+b); s+=`<ellipse cx="${px}" cy="${py}" rx="2.6" ry="1.6" fill="#C9B39A" stroke="${INK}" stroke-width=".8"/>`; });
  }
  if(p.s==='grow' && isDry(p)) s+=`<path d="M${P([iso(x+0.4,y+0.3),iso(x+0.6,y+0.5),iso(x+0.5,y+0.7)])} M${P([iso(x+1.0,y+0.95),iso(x+1.2,y+1.05),iso(x+1.15,y+1.25)])}" stroke="#8C6040" stroke-width="1.8" fill="none"/>`;
  return s;
}
function wildSign(i){ const l=LAND[i]; if(!l || mode==='visit' || !S) return '荒地'; return S.me.lv>=l.lv ? '可開墾' : `Lv${l.lv}`; }
function plotSpriteSVG(p,i){
  let body='';
  const dl = `style="animation-delay:-${((i*0.73)%3.2).toFixed(2)}s"`;
  if(p.s==='wild'){
    body = `<g class="wsway" ${dl}>${weedArt(30,80)}${weedArt(90,70)}${weedArt(56,64)}</g><ellipse cx="76" cy="84" rx="8" ry="5" fill="#B5AFA3" stroke="${INK}" stroke-width="1.5"/><ellipse class="nool" cx="74" cy="82" rx="4" ry="2" fill="#D9D4CB"/>
      <g transform="translate(36 22)"><rect x="22" y="14" width="5" height="28" rx="2" fill="#B07A4F" stroke="${INK}" stroke-width="1.6"/><rect x="0" y="0" width="50" height="21" rx="6" fill="#F3D9A8" stroke="${INK}" stroke-width="2"/><text x="25" y="15" font-size="11" font-weight="900" text-anchor="middle" fill="#8A5A34" font-family="Noto Sans TC,sans-serif">${wildSign(i)}</text></g>`;
  } else if(p.s==='grow'){
    const st=stageOf(p);
    body += `<g class="crop${st===4?'':' sway'}" ${dl}>${cropArt(CROP[p.c],st)}</g>`;
    for(let k=0;k<p.w;k++) body += `<g class="wsway" style="animation-delay:-${k*0.6}s">${weedArt(...WEED_POS[k])}</g>`;
    for(let k=0;k<p.b;k++) body += `<g class="crawl" style="animation-delay:-${k*0.45}s">${bugArt(...BUG_POS[k])}</g>`;
    if(st===4) body += `<g class="spark" fill="#FFF" stroke="${INK}" stroke-width="1"><path d="M100 22 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2z"/><path d="M18 30 l1.4 4 l4 1.4 l-4 1.4 l-1.4 4 l-1.4 -4 l-4 -1.4 l4 -1.4z"/></g>`;
    if(isDry(p)) body += `<g class="drip" transform="translate(98 26)"><path d="M0 0 Q-8 11 0 15 Q8 11 0 0Z" fill="#3DA5F4" stroke="${INK}" stroke-width="1.5"/><path d="M-1 7 h2" stroke="#fff" stroke-width="1.5"/></g>`;
  } else if(p.s==='dead') body = deadArt;
  const [cx,cy]=plotCenter(i);
  return `<g transform="translate(${(cx-60*SPR).toFixed(1)} ${(cy-74*SPR).toFixed(1)}) scale(${SPR})">${body}</g>`;
}
/* ================= 地圖縮放與拖曳 ================= */
const map=$('map'), world=$('world');
let scale=1;
let VBX=VX, VBY=VY, VBW=WW, VBH=WH;
function layout(){
  const vw=innerWidth, vh=innerHeight;
  scale = vw<700 ? Math.max(vw/WW, 0.6) : Math.max(vw/WW, vh/WH, Math.min(vw/1300, vh/800));
  // 畫面比世界大時，用天空往外延伸補滿（不留空白）
  // 上下多留空間：最上面的建築可以拉到上方欄下面、最下面的可以拉到工具列上面
  const padT=70/scale, padB=100/scale, H0=WH+padT+padB;
  VBW=Math.max(WW, vw/scale); VBH=Math.max(H0, vh/scale); VBX=VX-(VBW-WW)/2; VBY=VY-padT-(VBH-H0)/2;
  world.setAttribute('viewBox',`${VBX} ${VBY} ${VBW} ${VBH}`);
  world.setAttribute('width',(VBW*scale).toFixed(0)); world.setAttribute('height',(VBH*scale).toFixed(0));
  world.style.margin='0';
}
function centerOn(gx,gy,smooth){
  const [x,y]=iso(gx,gy), vh=innerHeight, wide=innerWidth>=700, topH=wide?230:110, botH=wide?90:120;
  map.scrollTo({left:(x-VBX)*scale-innerWidth/2, top:(y-VBY)*scale-(topH+(vh-topH-botH)/2), behavior:smooth?'smooth':'auto'});
}
let drag=null, moved=false;
map.addEventListener('pointerdown',e=>{ if(e.pointerType!=='mouse') return; drag={x:e.clientX,y:e.clientY,sl:map.scrollLeft,st:map.scrollTop}; moved=false; });
addEventListener('pointermove',e=>{ if(!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
  if(!moved && Math.abs(dx)+Math.abs(dy)>6){ moved=true; map.classList.add('drag'); }
  if(moved){ map.scrollLeft=drag.sl-dx; map.scrollTop=drag.st-dy; } });
addEventListener('pointerup',()=>{ drag=null; map.classList.remove('drag'); });
map.addEventListener('click',e=>{ if(moved){ e.stopPropagation(); e.preventDefault(); moved=false; } },true);
addEventListener('resize',()=>{ if(S){ layout(); centerOn(...FARM_C); } });

