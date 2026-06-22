// 噗一嘭 — WeChat Mini Game v1.4
// High-DPI + Home screen + Sound toggle + Background demo
try{wx.clearStorageSync()}catch(e){} // fresh start
// DEBUG: show version on screen
var info = wx.getSystemInfoSync();
var dpr = Math.min(info.pixelRatio || 2, 2);
var W = info.screenWidth || info.windowWidth || 375;
var H = info.screenHeight || info.windowHeight || 667;
var topSafe = (info.statusBarHeight || 44) + 8;
var bottomSafe = (info.safeArea ? H - info.safeArea.bottom : 34) + 8;
var canvas = wx.createCanvas();
canvas.width = W * dpr;
canvas.height = H * dpr;
var ct = canvas.getContext('2d');
ct.setTransform(dpr, 0, 0, dpr, 0, 0);
ct.imageSmoothingEnabled = false;

// === SCREEN STATE ===
var screen = 'home'; // home | playing | gameover
var showHelp = false;
var winStreak = 0; // 连胜计数
var soundOn = true;
var vibOn = true;
var goData = null;
var showExit = false;
var homeMsg = '';

// === CONSTANTS ===
var BR=22,PW=100,PH=12,PY=130,GC2=12,GR2=20,WS2=80,WR2=140,BS2=5.5,BM2=10,PUS=30,PUI=6000,MPU=2,WIN=5,CFW=3,CMW=6;

// === GAME STATE ===
var g=null,sk2=0,gv=[],gcw,gch,pts=[],apts=[];
var combo=0,comboTimer=0,isMatchPoint=false;
var rally=0, hitStop=0;
var msgText='',msgTimer=0,msgColor='#fff';
// Power-up queue system: collect → store → double-tap to activate
var puStored=null,puActive=null,puTimer=0,aiStored=null,aiTimer=0,lastTap=0,tapCount=0;
var flipSide=0,flipTimer=0,flipOld=0; // score flip animation
var t1=null,t2=null,tx=null;

// === ADVERTISEMENTS ===
// 去 mp.weixin.qq.com → 流量主 → 广告管理 创建广告位，替换下面的 adUnitId
var bannerAd = null;
var interstitialAd = null;
var rewardedVideoAd = null;

function initAds() {
  // 广告位 ID 是占位符时不创建（等有真实 ID 后替换 xxxxxxxx）
  var placeholder = 'adunit-xxxxxxxxxxxxxxxx';
  // Banner 广告
  if (placeholder.indexOf('xxxx') < 0) {
    try {
      bannerAd = wx.createBannerAd({
        adUnitId: placeholder,
        style: { left: 0, top: H - 60, width: W }
      });
      bannerAd.onError(function(err){})
    } catch(e) {}
  }
  // 插屏广告
  var itlId = 'adunit-xxxxxxxxxxxxxxxx';
  if (itlId.indexOf('xxxx') < 0) {
    try { interstitialAd = wx.createInterstitialAd({ adUnitId: itlId }) } catch(e) {}
  }
  // 激励视频
  var rvId = 'adunit-xxxxxxxxxxxxxxxx';
  if (rvId.indexOf('xxxx') < 0) {
    try { rewardedVideoAd = wx.createRewardedVideoAd({ adUnitId: rvId }) } catch(e) {}
  }
}

function showBanner() {
  if (bannerAd) try { bannerAd.show() } catch(e) {}
}
function hideBanner() {
  if (bannerAd) try { bannerAd.hide() } catch(e) {}
}
function showInterstitial() {
  if (interstitialAd) try { interstitialAd.show() } catch(e) { if (g) startGame(g.mode, g.diff) }
}
function showRewarded(callback) {
  if (!rewardedVideoAd) { callback && callback(false); return }
  rewardedVideoAd.onClose(function(res) {
    if (res && res.isEnded) { callback && callback(true) }
    else { callback && callback(false) }
  });
  try { rewardedVideoAd.show() } catch(e) { callback && callback(false) }
}

// === LAUNCH PARAMS ===
var gm='ai',df='medium';
try{var lopts=wx.getLaunchOptionsSync();if(lopts.query){gm=lopts.query.mode||'ai';df=lopts.query.diff||'medium'}}catch(e){}

function ig(){gcw=W/(GC2-1);gch=H/(GR2-1);gv=[];for(var r=0;r<GR2;r++){gv[r]=[];for(var c=0;c<GC2;c++)gv[r][c]={bx:c*gcw,by:r*gch,dx:0,dy:0}}}

function mk(){
  var cp=(gm==='couple');
  return{ball:{x:W/2,y:H/2,vx:(Math.random()-.5)*2,vy:BS2*(Math.random()>.5?1:-1),r:BR,st:1,sa:1,trail:[],state:'normal'},
    pad:{x:W/2-PW/2,y:H-PY,w:cp?PW*.85:PW,h:PH},
    ai:{x:W/2-PW/2,y:PY-PH,w:PW,h:PH,tx:W/2,sp:4.5},
    pus:[],sc:[0,0],rsc:[0,0],round:1,phase:'playing',pt:0,cd:0,ls:null,diff:df,mode:gm,hits:0,gt:0,couple:cp};
}

function spu(){if(!g||g.phase!=='playing'||g.pus.length>=MPU)return;var my=PY+30,mh=H-2*PY-60;g.pus.push({x:40+Math.random()*(W-80),y:my+Math.random()*mh,type:['grow','shrink','extend','speed'][Math.random()*4|0],sz:PUS,pl:Math.random()*Math.PI*2})}

// === PARTICLES ===
function spt(x,y,n,ty,dir){
  var m={blue:[0,168,224],red:[224,64,96],green:[0,255,110],orange:[255,140,40],wall:[200,200,220],heart:[255,105,180]};
  var c=m[ty]||[255,255,255];
  for(var i=0;i<n;i++){
    var vx,vy;
    if(dir!=null){var a=dir+Math.random()*1.2-.6,s=1+Math.random()*5;vx=Math.cos(a)*s;vy=Math.sin(a)*s}
    else{var a2=Math.random()*Math.PI*2,s2=1+Math.random()*4;vx=Math.cos(a2)*s2;vy=Math.sin(a2)*s2}
    pts.push({x:x,y:y,vx:vx,vy:vy,r:1.5+Math.random()*4,life:.5+Math.random()*.5,rgb:c});
  }
}
function sptAmb(){for(var i=0;i<20;i++)apts.push({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3,r:.6+Math.random()*1.2,a:.15+Math.random()*.2,pl:Math.random()*Math.PI*2})}
sptAmb();

// === AUDIO ===
var AC=null;
// Bypass phone silent switch
try{wx.setInnerAudioOption&&wx.setInnerAudioOption({mixWithOther:true,obeyMuteSwitch:false})}catch(e){}
function iac(){if(!AC&&soundOn){try{AC=wx.createWebAudioContext()}catch(e){};if(AC){if(AC.state==='suspended')AC.resume();AC.onstatechange=function(){if(AC.state==='suspended'&&soundOn)AC.resume()}}}}
function bp(f,ty,d,v,ge){
  if(!AC||!soundOn)return;
  try{var t2=AC.currentTime,o=AC.createOscillator(),gn=AC.createGain();
    o.type=ty;o.frequency.setValueAtTime(f,t2);if(ge)o.frequency.linearRampToValueAtTime(f*ge,t2+d);
    gn.gain.setValueAtTime(Math.min(v,.25),t2);gn.gain.setValueAtTime(.001,t2+d-.01);
    o.connect(gn);gn.connect(AC.destination);o.start(t2);o.stop(t2+d)}catch(e){}
}
// Ambient home loop — subtle rhythmic pulse
var homeBeatTimer=0;
function homeBeat(){
  if(!soundOn||screen!=='home')return;
  homeBeatTimer++;if(homeBeatTimer>90){homeBeatTimer=0;bp(300,'sine',.08,.12,1.4);setTimeout(function(){if(screen==='home')bp(400,'sine',.06,.10,1.5)},150)}
}
function sfxH(){if(!soundOn)return;bp(800,'sine',.06,.22,1.8);bp(400,'sine',.03,.10,2.2)}
function sfxW(){if(!soundOn)return;bp(130,'square',.04,.06,null)}
function sfxG(){if(!soundOn)return;bp(523,'square',.06,.25,1.6);setTimeout(function(){bp(659,'square',.06,.2,1.5)},80);setTimeout(function(){bp(784,'square',.05,.18,null)},160)}
function sfxL(){if(!soundOn)return;bp(330,'sawtooth',.06,.3,.5);setTimeout(function(){bp(220,'sawtooth',.05,.25,.4)},100)}
function sfxPU(){if(!soundOn)return;bp(600,'sine',.04,.09,2);setTimeout(function(){bp(900,'sine',.04,.09,1.5)},50);setTimeout(function(){bp(1200,'sine',.03,.1,null)},100)}
function sfxCD(){if(!soundOn)return;bp(200,'sine',.05,.12,null)}
function sfxGO(){if(!soundOn)return;bp(520,'triangle',.08,.22,2)}
function sfxWin(){if(!soundOn)return;bp(523,'square',.08,.3,1.5);setTimeout(function(){bp(659,'square',.08,.28,1.4)},120);setTimeout(function(){bp(784,'square',.08,.26,1.3)},240);setTimeout(function(){bp(1047,'square',.10,.4,null)},360)}
function sfxLose(){if(!soundOn)return;bp(330,'sawtooth',.08,.35,.5);setTimeout(function(){bp(220,'sawtooth',.08,.35,.4)},150);setTimeout(function(){bp(165,'sawtooth',.10,.5,.3)},300)}
function sfxSmash(){if(!soundOn)return;bp(300,'square',.15,.18,null);bp(100,'sawtooth',.12,.2,null);bp(50,'triangle',.10,.22,null);bp(800,'sine',.08,.12,2);setTimeout(function(){bp(500,'sine',.06,.08,null)},60)}

// === VIBRATION ===
function vb(p){if(!vibOn)return;try{wx.vibrateShort({type:'light'})}catch(e){}}
function vh(){vb()}function vw(){}function vg(){vb()}
function vpu(){vb()}function vcd(){}function vGO(){vb()}

// === PHYSICS ===
function up(dt){
  if(!g)return;
  var b=g.ball,pp=g.pad,ai=g.ai;
  if(sk2>0)sk2*=.82;if(sk2<.05)sk2=0;
  b.sa+=(b.st-b.sa)*.28;
  // Extend timer (speed is one-shot, no timer)
  if(puActive){puTimer--;if(puTimer<=0)puActive=null}
  // Combo decay + match point speed
  if(comboTimer>0){comboTimer--;if(comboTimer<=0)combo=0}
  if(msgTimer>0){msgTimer-=dt;if(msgTimer<=0)msgText=''}
  // AI power-up auto-use
  if(aiStored){aiTimer++;if(aiTimer>120){aiActivate();aiTimer=0}}
  if(g.phase!=='playing')return;

  if(g.mode!=='local'&&g.mode!=='couple'){ai.tx=b.x;var d=ai.tx-(ai.x+ai.w/2);var sp=g.diff==='hard'?11:g.diff==='easy'?3:4.8;if(Math.abs(d)>5)ai.x+=d>0?sp:-sp;if(g.diff==='easy')ai.x+=(Math.random()-.5)*4;else if(g.diff==='medium')ai.x+=(Math.random()-.5)*1.8;ai.x=Math.max(0,Math.min(W-ai.w,ai.x))}

  // 闪电弹模式：球速×1.3
  var spdMul=g.diff==='hard'?2.0:1;
  b.x+=b.vx*spdMul;b.y+=b.vy*spdMul;
  if(Math.abs(b.vx)+Math.abs(b.vy)>2){b.trail.push({x:b.x,y:b.y,life:1,r:b.r*b.sa,st:b.state});if(b.trail.length>16)b.trail.shift()}
  b.trail.forEach(function(t){t.life-=.07});b.trail=b.trail.filter(function(t){return t.life>0});

  if(b.x-b.r<0){b.x=b.r;b.vx*=-.86;if(screen==='playing')ew()}
  if(b.x+b.r>W){b.x=W-b.r;b.vx*=-.86;if(screen==='playing')ew()}

  var r=b.r*b.sa;
  if(b.vy>0&&b.y+r>=pp.y&&b.y+r<=pp.y+pp.h+10&&b.x>pp.x-r*.5&&b.x<pp.x+pp.w+r*.5)eh(pp,1);
  if(b.vy<0&&b.y-r<=ai.y+ai.h&&b.y-r>=ai.y-10&&b.x>ai.x-r*.5&&b.x<ai.x+ai.w+r*.5)eh(ai,2);
  if(b.y-r>H){if(screen==='playing')gl(2);else rb()}if(b.y+r<0){if(screen==='playing')gl(1);else rb()}

  for(var i=g.pus.length-1;i>=0;i--){var pu=g.pus[i];if(Math.sqrt((b.x-pu.x)*(b.x-pu.x)+(b.y-pu.y)*(b.y-pu.y))<r+pu.sz/2){if(screen==='playing')epu(pu);g.pus.splice(i,1)}}
  pts.forEach(function(pt){pt.x+=pt.vx;pt.y+=pt.vy;pt.life-=.022});pts=pts.filter(function(pt){return pt.life>0});
  apts.forEach(function(a){a.x+=a.vx;a.y+=a.vy;if(a.x<0)a.x=W;if(a.x>W)a.x=0;if(a.y<0)a.y=H;if(a.y>H)a.y=0;a.pl+=.01;if(g){var dx2=a.x-b.x,dy2=a.y-b.y,dd=Math.sqrt(dx2*dx2+dy2*dy2);if(dd<200){var f=(1-dd/200)*.6;a.vx+=dx2/dd*f*.02;a.vy+=dy2/dd*f*.02}a.vx*=.995;a.vy*=.995}});
  if(msgTimer>0){msgTimer-=dt;if(msgTimer<=0)msgText=''}
}

function ew(){spt(g.ball.x,g.ball.y<H/2?0:H,8,'wall',g.ball.y<H/2?Math.PI/2:-Math.PI/2);sk2=Math.min(sk2+1,4);sfxW();vw()}
function eh(pad,pl){
  var b=g.ball;var hx=b.x-(pad.x+pad.w/2);var rx=hx/(pad.w/2);
  var ang=rx*.75;var sp=Math.min(Math.sqrt(b.vx*b.vx+b.vy*b.vy)*1.06,BM2);
  b.vx=Math.sin(ang)*sp;b.vy=(pl===1?-1:1)*Math.abs(Math.cos(ang)*sp);
  if(pl===1)b.y=pad.y-b.r*b.sa-1;else b.y=pad.y+pad.h+b.r*b.sa+1;
  // Squash & stretch
  b.st=.7;setTimeout(function(){if(g)g.ball.st=1.35},50);setTimeout(function(){if(g)g.ball.st=1.0},160);
  if(screen!=='playing')return;
  var absRx=Math.abs(rx);
  var isPerfect=absRx<.15;
  // Center hit: slightly faster, golden particles
  if(isPerfect){var b2=b;setTimeout(function(){b2.vx*=1.1;b2.vy*=1.1},40)}
  var pty=isPerfect?'wall':pl===1?'blue':'red';
  spt(b.x,b.y,isPerfect?25:16,pty,pl===1?-Math.PI/2:Math.PI/2);
  sk2=Math.min(sk2+2,5);
  rally++;g.hits++;combo++;comboTimer=90;sfxH();vh();
}
function epu(pu){
  var b=g.ball;
  if(pu.type==='grow'){b.r=BR*1.9;b.st=1.9;b.state='grow';spt(pu.x,pu.y,20,'green')}
  else if(pu.type==='shrink'){b.r=BR*.65;b.st=.65;b.state='shrink';spt(pu.x,pu.y,18,'orange')}
  else if(pu.type==='extend'||pu.type==='speed'){
    if(g.ball.vy<0){aiStored=pu.type;aiTimer=0} // ball going up → AI gets it
    else{puStored=pu.type} // ball going down → player gets it
    spt(pu.x,pu.y,16,pu.type==='speed'?'blue':'wall');
  }
  b.sa=b.st;sfxPU();vpu();
  setTimeout(function(){if(g){g.ball.r=BR;g.ball.st=1.0;g.ball.state='normal'}},2500);
}
function gl(sc){
  g.phase='goal';g.ball.vx=0;g.ball.vy=0;
  if(g.couple){if(sc===2){g.sc[1]++;g.rsc[1]++}else{g.rsc[0]+=.5;g.sc[0]=Math.floor(g.rsc[0])}}
  else{g.sc[sc-1]++}
  g.ls=sc;g.hits=0;g.pus=[];rally=0;
  isMatchPoint=(g.sc[0]===WIN-1&&g.sc[1]===WIN-1);
  sk2=12;spt(g.ball.x,g.ball.y,45,sc===1?'blue':'red');
  if(sc===1){sfxG();vg()}else{sfxL()}
  // Combo display (bonus already added above)
  flipOld=g.sc[sc-1]-1;flipSide=sc;flipTimer=55;msgText='+1';combo=0;
  var wt=g.couple?(sc===2?CFW:CMW):WIN;
  var chk=g.couple?(sc===2?g.sc[1]:Math.floor(g.rsc[0])):g.sc[sc-1];
  if(chk>=wt){setTimeout(function(){if(sc===1)winStreak++;else winStreak=0;screen='gameover';goData={w:sc};if(sc===1)sfxWin();else sfxLose()},1400)}
  else{setTimeout(function(){rb()},2400)}
  g.round++;
}
function rb(){var b=g.ball;b.x=W/2;b.y=H/2;b.vx=(Math.random()-.5)*2;b.vy=BS2*(g.ls===1?-1:1);b.r=BR;b.st=1;b.sa=1;b.trail=[];b.state='normal';g.phase='playing'}

// === GRID ===
function ug(){
  if(!g)return;var b=g.ball;
  for(var r=0;r<GR2;r++)for(var c=0;c<GC2;c++){
    var v=gv[r][c];var dx=v.bx-b.x,dy=v.by-b.y;var d=Math.sqrt(dx*dx+dy*dy);
    if(d<WR2){var s=WS2/(1+d*d/800);var f=1-d/WR2;var st=s*f*f;var ndx=dx/(d+.01),ndy=dy/(d+.01);
      var maxD=gcw*.5;v.dx=Math.max(-maxD,Math.min(maxD,ndx*st*(b.sa*1.1)));
      v.dy=Math.max(-maxD,Math.min(maxD,ndy*st*(b.sa*1.1)))}
    else{v.dx*=.9;v.dy*=.9}
    v.dx*=.95;v.dy*=.95;
  }
}

// === RENDER ===
function dr(){
  ct.clearRect(0,0,W,H);
  var sx=0,sy=0;if(sk2>.2){sx=(Math.random()-.5)*sk2*2;sy=(Math.random()-.5)*sk2*2}
  ct.save();ct.translate(sx,sy);

  var isHome = (screen==='home');
  var dim = isHome ? 0.35 : 1; // dim game on home screen

  // Background
  ct.fillStyle='#0a0a1a';ct.fillRect(-10,-10,W+20,H+20);
  ct.globalAlpha = dim;

  // Ambient
  for(var ai2=0;ai2<apts.length;ai2++){var a=apts[ai2];ct.beginPath();ct.arc(a.x,a.y,a.r,0,Math.PI*2);ct.fillStyle='rgba(0,168,224,'+(a.a+.05*Math.sin(a.pl))+')';ct.fill()}
  dg();
  if(g){for(var j=0;j<g.pus.length;j++){var pu=g.pus[j];pu.pl+=.05;dp(pu)}}
  if(g){var tcols=['#ffd740','#ffaa00','#ffe080','#ffc040','#fff0c0'];for(var k=0;k<g.ball.trail.length;k++){var t=g.ball.trail[k];var sz=t.r*t.life*.25;var ci=k%5;ct.fillStyle=tcols[ci];ct.fillRect(t.x-sz,t.y-sz,sz*2,sz*2)}}
  if(g)db();
  if(g){dpd(g.pad,1);dpd(g.ai,2)}
  dl();
  for(var p=0;p<pts.length;p++){var pt=pts[p];ct.beginPath();ct.arc(pt.x,pt.y,pt.r*pt.life,0,Math.PI*2);ct.fillStyle='rgba('+pt.rgb[0]+','+pt.rgb[1]+','+pt.rgb[2]+','+(pt.life*.7)+')';ct.fill()}

  ct.globalAlpha = 1;
  ct.restore();

  // === HOME SCREEN ===
  if(screen==='home'){
    // Dim overlay
    ct.fillStyle='rgba(10,10,26,.75)';ct.fillRect(0,0,W,H);

    // Pixel title with blocky outline
    var titleY=H*.22,fs=46;
    ct.font='bold '+fs+'px monospace';ct.textAlign='center';ct.textBaseline='middle';
    var fullText='噗一嘭',tw=ct.measureText(fullText).width,cx=W/2,cy=titleY+24;
    // Pixel outline: draw black offset in 4 directions
    ct.fillStyle='#000';
    ct.fillText(fullText,cx+4,cy);ct.fillText(fullText,cx-4,cy);
    ct.fillText(fullText,cx,cy+4);ct.fillText(fullText,cx,cy-4);
    ct.fillText(fullText,cx+4,cy+4);ct.fillText(fullText,cx-4,cy-4);
    ct.fillText(fullText,cx+4,cy-4);ct.fillText(fullText,cx-4,cy+4);
    // Colored text on top
    ct.fillStyle='#00c6ff';ct.fillText('噗',cx-tw/2+ct.measureText('噗').width/2,cy);
    ct.fillStyle='#e04060';ct.fillText('一嘭',cx+tw/2-ct.measureText('一嘭').width/2,cy);
    // Pixel decorations
    var decoY=titleY-8;
    ct.fillStyle='#ffd740';ct.fillRect(cx-30,decoY,6,6);ct.fillRect(cx+24,decoY,6,6);
    ct.fillStyle='#00c6ff';ct.fillRect(cx-18,decoY+6,4,4);ct.fillRect(cx+12,decoY+6,4,4);
    ct.fillStyle='#e04060';ct.fillRect(cx-6,decoY+4,4,4);ct.fillRect(cx+36,decoY+4,4,4);
    ct.fillStyle='#888';ct.font='bold 11px monospace';ct.textBaseline='alphabetic';
    ct.fillText('一起噗一嘭',W/2,titleY+68);
    // Help button
    drawBtn('?',W/2-14,titleY+80,28,28,'#555',false);

    // Mode buttons
    var by=H*.45;
    drawBtn('慢慢玩',W/2-120,by,240,46,'#00c6ff',true);by+=54;
    drawBtn('闪电手',W/2-120,by,240,46,'#e04060',true);by+=54;
    drawBtn('双人大屏',W/2-120,by,240,46,'#f0f0f0',true);by+=54;

    // Sound + Vibe toggles
    var tglY=by+18;
    drawSpeaker(W/2-30,tglY,soundOn);
    drawVibIcon(W/2+30,tglY,vibOn);

    // Exit (tiny)
    ct.fillStyle='#444';ct.font='14px monospace';ct.textAlign='center';ct.fillText('×',W/2,by+58);
  }

  // === PLAYING HUD ===
  if(screen==='playing'&&g){
    // Scores + round in center top
    ct.textAlign='center';
    ct.fillStyle='#f0f0f0';ct.font='bold 26px monospace';
    ct.fillText(g.sc[0]+'  :  '+g.sc[1],W/2,topSafe+42);
    ct.fillStyle='#888';ct.font='bold 11px monospace';
    ct.fillText('回合 '+g.round,W/2,topSafe+60);
    // Match point: screen border pulse (via grid color already red)
    // Combo & rally: silent — expressed through particles, shake, and ball trail
    // Power-up indicators
    if(puStored&&!puActive){ct.fillStyle='#ffd740';ct.font='bold 10px monospace';ct.textAlign='center';
      ct.fillText('双击: '+(puStored==='extend'?'加长板':'大力球'),W/2,topSafe+76)}
    if(puActive){ct.fillStyle='#ffd740';ct.font='bold 11px monospace';ct.textAlign='center';
      ct.fillText('加长板 '+Math.ceil(puTimer/60)+'s',W/2,topSafe+76)}
    if(aiStored&&g&&g.mode!=='local'){ct.fillStyle='#e04060';ct.font='bold 9px monospace';ct.textAlign='center';
      ct.fillText('电脑: '+(aiStored==='extend'?'加长板':'大力球'),W/2,topSafe+88)}
  }

  // Feedback popup (太远 etc)
  if(msgTimer>0&&screen==='playing'&&!flipTimer){
    ct.fillStyle=msgColor;ct.font='bold 18px monospace';ct.textAlign='center';
    ct.fillText(msgText,W/2,H*.42);
  }
  // Score flip animation
  if(flipTimer>0&&screen==='playing'){
    flipTimer--;
    var fp=flipTimer/60;
    var bounce=Math.abs(Math.sin(fp*Math.PI*2))*24*(1-fp);
    // Both scores large, side by side
    ct.textAlign='center';
    // Left score (P1)
    ct.fillStyle=flipSide===1?'#00c6ff':'#666';
    ct.font='bold 40px monospace';
    ct.fillText(g.sc[0],W*.32,H/2+(flipSide===1?bounce:0));
    // Right score (P2)
    ct.fillStyle=flipSide===2?'#e04060':'#666';
    ct.fillText(g.sc[1],W*.68,H/2+(flipSide===2?bounce:0));
    // Divider
    ct.fillStyle='#888';ct.font='bold 20px monospace';
    ct.fillText(':',W/2,H/2-2);
  }

  // Game over overlay
  if(screen==='gameover')drawGO();

  // Help overlay
  if(showHelp)drawHelp();
  // Exit confirm
  if(showExit)drawExitConfirm();

  // Exit + speaker buttons (bottom, above home indicator)
  if(screen==='playing'){
    var exY=H-bottomSafe-22;
    ct.fillStyle='rgba(10,10,26,.3)';ct.fillRect(6,exY,16,16);
    ct.fillStyle='#333';ct.font='10px monospace';ct.textAlign='center';ct.fillText('x',14,exY+12);
    // Sound + Vibe bottom-right
    drawSpeaker(W-56,exY+18,soundOn);
    drawVibIcon(W-22,exY+18,vibOn);
  }
}

function dg(){
  var gc=isMatchPoint?'224,64,96':'0,140,200';
  for(var r=0;r<GR2;r++){ct.beginPath();var sz=false;
    for(var c=0;c<GC2;c++){var v=gv[r][c],x=v.bx+v.dx,y=v.by+v.dy;
      if(!sz){ct.moveTo(x,y);sz=true}
      else{var pv=gv[r][c-1];ct.quadraticCurveTo((pv.bx+pv.dx+x)/2,(pv.by+pv.dy+y)/2,x,y)}
    }
    var a=.05,lw=.8;if(g){var b=g.ball;var px=1-Math.abs(r-(b.y/H*GR2))/(GR2*.35);if(px>0){a+=px*.2;lw+=px*.8}}
    ct.strokeStyle='rgba('+gc+','+Math.min(a,.35)+')';ct.lineWidth=Math.max(.6,Math.min(lw,1.6));ct.stroke()}
  for(var c2=0;c2<GC2;c2++){ct.beginPath();var sz2=false;
    for(var r2=0;r2<GR2;r2++){var v2=gv[r2][c2],x2=v2.bx+v2.dx,y2=v2.by+v2.dy;
      if(!sz2){ct.moveTo(x2,y2);sz2=true}
      else{var pv2=gv[r2-1][c2];ct.quadraticCurveTo((pv2.bx+pv2.dx+x2)/2,(pv2.by+pv2.dy+y2)/2,x2,y2)}
    }
    var a2=.05,lw2=.8;if(g){var b2=g.ball;var px2=1-Math.abs(c2-(b2.x/W*GC2))/(GC2*.35);if(px2>0){a2+=px2*.2;lw2+=px2*.8}}
    ct.strokeStyle='rgba('+gc+','+Math.min(a2,.35)+')';ct.lineWidth=Math.max(.6,Math.min(lw2,1.6));ct.stroke()}
}

function db(){
  var b=g.ball,r=b.r*b.sa,x=b.x,y=b.y,ps=6,pr=Math.floor(r/ps);
  var col=b.state==='grow'?'#00e870':b.state==='shrink'?'#ff8c28':'#ffd740';
  ct.fillStyle=col;
  for(var py=-pr;py<=pr;py++)for(var px=-pr;px<=pr;px++)
    if(px*px+py*py<=pr*pr)ct.fillRect(Math.floor((x+px*ps)/ps)*ps,Math.floor((y+py*ps)/ps)*ps,ps,ps);
}

function dpd(pd,pl){
  var px=pd.x,py=pd.y,pw=(puActive==='extend'&&pl===1)?PW*2:pd.w,ph=pd.h,isB=pl===1,ps=4;
  var sx=Math.floor(px/ps)*ps,sy=Math.floor(py/ps)*ps,sw=Math.ceil(pw/ps)*ps,sh=Math.ceil(ph/ps)*ps;
  ct.fillStyle=(puActive==='extend'&&pl===1)?'#ffd740':isB?'#00a8e0':'#e04060';
  ct.fillRect(sx,sy,sw,sh);
  if(puStored&&pl===1){ct.strokeStyle='#ffd740';ct.lineWidth=2;ct.strokeRect(sx-2,sy-2,sw+4,sh+4)}
}

function dl(){
  var y1=g.pad.y+g.pad.h+6;ct.strokeStyle='#00a8e0';ct.lineWidth=2;
  for(var x=0;x<W;x+=16){ct.beginPath();ct.moveTo(x,y1);ct.lineTo(x+8,y1);ct.stroke()}
  var y2=g.ai.y-6;ct.strokeStyle='#e04060';ct.lineWidth=2;
  for(var x2=0;x2<W;x2+=16){ct.beginPath();ct.moveTo(x2,y2);ct.lineTo(x2+8,y2);ct.stroke()}
}

function dp(pu){
  var s=pu.sz/2,isG=pu.type==='grow',isE=pu.type==='extend',isS=pu.type==='speed';
  var cr=isE?'255,215,64':isS?'0,168,224':isG?'0,255,110':'255,140,40',ps=4;
  var px=Math.floor(pu.x/ps)*ps,py=Math.floor(pu.y/ps)*ps,sz=Math.ceil(s/ps)*ps;
  ct.save();ct.translate(px,py);
  ct.fillStyle='rgba('+cr+',1)';ct.fillRect(-sz,-sz,sz*2,sz*2);
  ct.strokeStyle='rgba('+cr+',.9)';ct.lineWidth=ps;ct.strokeRect(-sz,-sz,sz*2,sz*2);
  var ic=Math.floor(sz*.6/ps)*ps;ct.fillStyle='#0a0a1a';
  if(isE){ct.fillRect(-ic*1.2,-ps,ic*2.4,ps*2)}
  else if(isS){ct.fillRect(-ic,-ps,ic*2,ps);ct.fillRect(-ps,-ic*2,ps*2,ic);ct.fillRect(0,-ic*2,ps*2,ic)}
  else if(isG){ct.fillRect(-ps,-ic,ps*2,ic*2);ct.fillRect(-ic,-ps,ic*2,ps*2)}else{ct.fillRect(-ic,-ps,ic*2,ps*2)}
  ct.restore();
}

// === UI ===
function drawBtn(text,x,y,w,h,color,primary){
  ct.fillStyle=primary?color:'#0a0a1a';ct.fillRect(x,y,w,h);
  ct.strokeStyle=primary?color:'#555';ct.lineWidth=2;ct.strokeRect(x,y,w,h);
  ct.fillStyle=primary?'#0a0a1a':color;ct.font='bold 13px monospace';ct.textAlign='center';
  ct.fillText(text,x+w/2,y+h/2+5);
}
function drawSpeaker(cx,cy,on){
  var s=12;
  ct.fillStyle=on?'#00c6ff':'#555';
  ct.fillRect(cx-s,cy-s,s*1.2,s*2);
  ct.fillRect(cx-s*1.4,cy-s*.5,s*.6,s);
  if(on){ct.strokeStyle='#00c6ff';ct.lineWidth=2;
    ct.beginPath();ct.arc(cx+s*.5,cy,s*.4,-Math.PI*.4,Math.PI*.4);ct.stroke();
    ct.beginPath();ct.arc(cx+s*.5,cy,s*.8,-Math.PI*.35,Math.PI*.35);ct.stroke();}
}
function drawVibIcon(cx,cy,on){
  var s=12;
  ct.fillStyle=on?'#ffd740':'#555';
  // Phone outline
  ct.strokeStyle=on?'#ffd740':'#555';ct.lineWidth=2;
  ct.strokeRect(cx-s*.8,cy-s*1.2,s*1.6,s*2.4);
  // Vibration lines
  if(on){ct.fillStyle='#ffd740';
    ct.fillRect(cx-s*.3,cy-s*.7,s*.6,3);
    ct.fillRect(cx-s*.3,cy-s*.1,s*.6,3);
    ct.fillRect(cx-s*.3,cy+s*.5,s*.6,3);
  }
}
function drawGO(){
  ct.fillStyle='rgba(10,10,26,.95)';ct.fillRect(0,0,W,H);
  ct.fillStyle='#f0f0f0';ct.font='bold 26px monospace';ct.textAlign='center';
  ct.fillText(goData.w===1?'你赢了！':'你输了',W/2,H/2-80);
  if(goData.w===1&&winStreak>=1){ct.fillStyle='#ffd740';ct.font='bold 14px monospace';
    ct.fillText('连胜'+winStreak+'局！',W/2,H/2-50)}
  ct.font='bold 40px monospace';ct.fillText(g.sc[0]+' : '+g.sc[1],W/2,H/2-10);
  drawBtn('再来',W/2-100,H/2+30,200,44,'#00c6ff',true);
  if(rewardedVideoAd) drawBtn('继续',W/2-100,H/2+82,200,44,'#ffd740',true);
  drawBtn('退出',W/2-60,H/2+(rewardedVideoAd?138:90),120,36,'#555',false);
}
function drawExitConfirm(){
  ct.fillStyle='rgba(10,10,26,.95)';ct.fillRect(0,0,W,H);
  ct.fillStyle='#f0f0f0';ct.font='bold 18px monospace';ct.textAlign='center';
  ct.fillText('退出？',W/2,H/2-30);
  drawBtn('是',W/2-100,H/2+10,90,40,'#00c6ff',true);
  drawBtn('否',W/2+10,H/2+10,90,40,'#555',false);
}
function drawHelp(){
  ct.fillStyle='rgba(10,10,26,.95)';ct.fillRect(0,0,W,H);
  var lines=['拖拽底部挡板 拦截弹球','球出底线 对方得分','先到5分获胜','','黄色方块 = 加长挡板','蓝色方块 = 大力击球','双击屏幕 使用道具','','球到板子正中 弹回更快','连续接球 得分翻倍'];
  var startY=H*.5-lines.length*11;
  ct.fillStyle='#f0f0f0';ct.font='bold 18px monospace';ct.textAlign='center';
  ct.fillText('游戏说明',W/2,startY-16);
  ct.fillStyle='#888';ct.font='12px monospace';
  for(var i=0;i<lines.length;i++){ct.fillText(lines[i],W/2,startY+18+i*22)}
  drawBtn('知道了',W/2-50,H-bottomSafe-80,100,36,'#00c6ff',true);
}
function hitTest(x,y,rx,ry,rw,rh){return x>=rx&&x<=rx+rw&&y>=ry&&y<=ry+rh}

// === Start game ===
function startGame(mode,diff){
  gm=mode;df=diff;
  g=mk();g.mode=gm;g.diff=df;g.sc=[0,0];g.round=1;
  ig();pts=[];sk2=0;
  flipTimer=0;flipSide=0;
  puStored=null;puActive=null;puTimer=0;aiStored=null;aiTimer=0;
  combo=0;comboTimer=0;isMatchPoint=false;rally=0;hitStop=0;
  screen='playing';
  showBanner();
  iac();
}

// === Double-tap power-up activation ===
function activatePU(){
  if(!puStored||puActive)return;
  iac();
  if(puStored==='speed'){
    // 大力球只在球靠近玩家板子时生效
    var b=g.ball,padY=H-PY,distToPad=Math.abs(b.y-padY);
    if(distToPad>H*.4){msgText='太远';msgColor='#ff5252';msgTimer=600;sfxL();return}
    b.vy=-Math.abs(b.vy)*2.8;b.vx*=1.5;b.st=.6;b.sa=.6; // always upward
    sk2=8;sfxSmash();spt(b.x,b.y,25,'blue');puStored=null;
  }else{
    puActive=puStored;puStored=null;puTimer=180;sfxPU();
  }
}
function aiActivate(){
  if(!aiStored||puActive)return;
  if(aiStored==='speed'){var b=g.ball;b.vy=Math.abs(b.vy)*2.8;b.vx*=1.5;b.st=.6;b.sa=.6;sk2=6;sfxSmash();spt(b.x,b.y,20,'red')}
  else{var ai2=g.ai;ai2.w=PW*2;setTimeout(function(){if(g)g.ai.w=PW},3000)}
  aiStored=null;
}

// === TOUCH ===
wx.onTouchStart(function(e){
  iac();
  var touch=e.touches[0];
  var cx=touch.clientX,cy=touch.clientY;

  var exY2=H-bottomSafe-22;
  // Sound + Vibe toggles (playing mode)
  if(screen==='playing'&&hitTest(cx,cy,W-60,exY2-10,28,44)){soundOn=!soundOn;if(!soundOn)AC=null;else iac();return}
  if(screen==='playing'&&hitTest(cx,cy,W-30,exY2-10,28,44)){vibOn=!vibOn;return}
  // Exit button
  if(screen==='playing'&&hitTest(cx,cy,6,exY2,16,16)){
    if(showExit){showExit=false;return}showExit=true;return;
  }
  if(showExit){
    if(hitTest(cx,cy,W/2-100,H/2+10,90,40)){hideBanner();screen='home';showExit=false;goData=null;g=mk();ig();return}
    if(hitTest(cx,cy,W/2+10,H/2+10,90,40)){showExit=false;return}return;
  }

  // Help overlay close
  if(showHelp){showHelp=false;return}
  // Home screen
  if(screen==='home'){
    var by=H*.45;
    if(hitTest(cx,cy,W/2-120,by,240,46)){startGame('ai','easy');return}by+=54;
    if(hitTest(cx,cy,W/2-120,by,240,46)){startGame('ai','hard');return}by+=54;
    if(hitTest(cx,cy,W/2-120,by,240,46)){startGame('local','medium');return}by+=54;
    var tglY2=H*.45+54*3+8;
    if(hitTest(cx,cy,W/2-44,tglY2,42,32)){soundOn=!soundOn;if(!soundOn)AC=null;else iac();return}
    if(hitTest(cx,cy,W/2+2,tglY2,42,32)){vibOn=!vibOn;return}
    var titleY2=H*.25;
    if(hitTest(cx,cy,W/2-14,titleY2+68,28,28)){showHelp=true;return}
    if(hitTest(cx,cy,W/2-14,by+50,28,20)){wx.exitMiniProgram();return}
    return;
  }

  // Game over
  if(screen==='gameover'){
    if(hitTest(cx,cy,W/2-100,H/2+30,200,44)){hideBanner();screen='playing';g=mk();ig();pts=[];sk2=0;goData=null;showBanner();return}
    if(rewardedVideoAd&&hitTest(cx,cy,W/2-100,H/2+82,200,44)){showRewarded(function(watched){hideBanner();screen='playing';g=mk();ig();pts=[];sk2=0;goData=null;showBanner();});return}
    var qy=rewardedVideoAd?138:90;
    if(hitTest(cx,cy,W/2-60,H/2+qy,120,36)){hideBanner();screen='home';g=mk();ig();goData=null;return}
    return;
  }

  if(!g||g.phase!=='playing'||screen!=='playing')return;
  // Double-tap to activate stored power-up
  var now=Date.now();
  if(now-lastTap<350&&tapCount===1){activatePU();tapCount=0}
  else{tapCount++;lastTap=now;setTimeout(function(){tapCount=0},400)}
  if(g.mode==='local'||g.mode==='couple'){
    if(cy<H/2&&t2===null)t2=e.touches[0].identifier;
    else if(cy>=H/2&&t1===null){t1=e.touches[0].identifier;tx=cx}
  }else{t1=e.touches[0].identifier;tx=cx}
});

wx.onTouchMove(function(e){
  if(!g||g.phase!=='playing'||screen!=='playing')return;
  for(var i=0;i<e.touches.length;i++){
    var t=e.touches[i];var cx=t.clientX,cy=t.clientY;
    if(g.mode==='local'||g.mode==='couple'){
      if(t.identifier===t1){var d=cx-(tx||cx);g.pad.x+=d;g.pad.x=Math.max(0,Math.min(W-g.pad.w,g.pad.x));tx=cx}
      else if(t.identifier===t2){g.ai.x=cx-g.ai.w/2;g.ai.x=Math.max(0,Math.min(W-g.ai.w,g.ai.x))}
    }else if(t.identifier===t1){var d2=cx-tx;g.pad.x+=d2;g.pad.x=Math.max(0,Math.min(W-g.pad.w,g.pad.x));tx=cx}
  }
});

wx.onTouchEnd(function(e){
  for(var i=0;i<e.changedTouches.length;i++){var t=e.changedTouches[i];
    if(t.identifier===t1)t1=null;if(t.identifier===t2)t2=null;}
});

// === LOOP ===
var homeResetTimer=0;
function lp(){try{if(g){ug();up(16);if(screen==='home'){homeResetTimer++;if(homeResetTimer>300){homeResetTimer=0;g=mk();ig()}}}dr();homeBeat()}catch(e){}}
setInterval(lp,16);
setInterval(function(){spu()},PUI);
g=mk();ig();initAds();