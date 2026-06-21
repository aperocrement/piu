// BitPiuPiu — WeChat Mini Game
var info = wx.getSystemInfoSync();
var W = info.screenWidth || info.windowWidth || 375;
var H = info.screenHeight || info.windowHeight || 667;
var canvas = wx.createCanvas();
canvas.width = W;
canvas.height = H;
var ct = canvas.getContext('2d');

// Draw immediately to confirm canvas works
ct.fillStyle = '#0a0a1a';
ct.fillRect(0, 0, W, H);
ct.fillStyle = '#00c6ff';
ct.font = '24px monospace';
ct.textAlign = 'center';
ct.fillText('BITPIUPIU', W/2, H/2-20);
ct.fillStyle = '#f0f0f0';
ct.font = '16px monospace';
ct.fillText('LOADING...', W/2, H/2+20);

// === CONSTANTS ===
var BR=22,PW=100,PH=12,PY=70,GC=12,GR=20,WS=130,WR=120,BS=4.5,BM=9,PUS=30,PUI=6000,MPU=2,WIN=5,CFW=3,CMW=6;

// === STATE ===
var g=null,sk=0,gv=[],gcw,gch,pts=[],apts=[];
var showLobby=false,showGO=false,goData=null,showExit=false;
var msgText='',msgTimer=0,msgColor='#f0f0f0';
var t1=null,t2=null,tx=null;

function ig(){gcw=W/(GC-1);gch=H/(GR-1);gv=[];for(var r=0;r<GR;r++){gv[r]=[];for(var c=0;c<GC;c++)gv[r][c]={bx:c*gcw,by:r*gch,dx:0,dy:0}}}

function mk(){
  var cp=(gm==='couple');
  return{ball:{x:W/2,y:H/2,vx:(Math.random()-.5)*2,vy:BS*(Math.random()>.5?1:-1),r:BR,st:1,sa:1,trail:[],state:'normal'},
    pad:{x:W/2-PW/2,y:H-PY,w:cp?PW*.85:PW,h:PH},
    ai:{x:W/2-PW/2,y:PY-PH,w:PW,h:PH,tx:W/2,sp:4.5},
    pus:[],sc:[0,0],rsc:[0,0],round:1,phase:'cd',pt:0,cd:3,ls:null,diff:df,mode:gm,hits:0,gt:0,couple:cp};
}

function spu(){if(!g||g.phase!=='playing'||g.pus.length>=MPU)return;g.pus.push({x:40+Math.random()*(W-80),y:100+Math.random()*(H-200),type:['grow','shrink'][Math.random()*2|0],sz:PUS,pl:Math.random()*Math.PI*2})}

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
function iac(){if(!AC){try{AC=wx.createWebAudioContext()}catch(e){}}}
function bp(f,ty,d,v,ge){
  if(!AC)return;
  try{
    var t=AC.currentTime,o=AC.createOscillator(),gn=AC.createGain();
    o.type=ty;o.frequency.setValueAtTime(f,t);
    if(ge)o.frequency.linearRampToValueAtTime(f*ge,t+d);
    gn.gain.setValueAtTime(Math.min(v,.3),t);gn.gain.setValueAtTime(.001,t+d-.01);
    o.connect(gn);gn.connect(AC.destination);o.start(t);o.stop(t+d);
  }catch(e){}
}
function sfxH(){bp(800,'sine',.06,.22,1.8);bp(400,'sine',.03,.10,2.2)}
function sfxW(){bp(130,'square',.04,.06,null)}
function sfxG(){bp(523,'square',.06,.25,1.6);setTimeout(function(){bp(659,'square',.06,.2,1.5)},80);setTimeout(function(){bp(784,'square',.05,.18,null)},160)}
function sfxL(){bp(330,'sawtooth',.06,.3,.5);setTimeout(function(){bp(220,'sawtooth',.05,.25,.4)},100)}
function sfxPU(){bp(600,'sine',.04,.09,2);setTimeout(function(){bp(900,'sine',.04,.09,1.5)},50);setTimeout(function(){bp(1200,'sine',.03,.1,null)},100)}
function sfxCD(){bp(200,'sine',.05,.12,null)}
function sfxGO(){bp(520,'triangle',.08,.22,2)}
function sfxWin(){bp(523,'square',.08,.3,1.5);setTimeout(function(){bp(659,'square',.08,.28,1.4)},120);setTimeout(function(){bp(784,'square',.08,.26,1.3)},240);setTimeout(function(){bp(1047,'square',.10,.4,null)},360)}
function sfxLose(){bp(330,'sawtooth',.08,.35,.5);setTimeout(function(){bp(220,'sawtooth',.08,.35,.4)},150);setTimeout(function(){bp(165,'sawtooth',.10,.5,.3)},300)}

// === VIBRATION ===
function vb(p){try{if(p&&p.length)wx.vibrateLong();else wx.vibrateShort()}catch(e){}}
function vh(){vb([8])}function vw(){vb([4])}function vg(){vb([18,40,18,40,35])}
function vpu(){vb([12,25,12])}function vcd(){vb([20])}function vGO(){vb([25,50,45])}

// === LAUNCH PARAMS ===
var gm='ai',df='medium';
try{var lopts=wx.getLaunchOptionsSync();if(lopts.query){gm=lopts.query.mode||'ai';df=lopts.query.diff||'medium'}}catch(e){}

// === PHYSICS ===
function up(dt){
  if(!g)return;
  var b=g.ball,pp=g.pad,ai=g.ai;
  if(sk>0)sk*=.82;if(sk<.05)sk=0;
  b.sa+=(b.st-b.sa)*.28;

  if(g.phase==='cd'){g.pt+=dt;if(g.pt>1000){g.pt=0;g.cd--;if(g.cd<=0){g.phase='playing';if(g.ls)b.vy=g.ls===1?BS:-BS}}return}
  if(g.phase==='goal'){g.pt+=dt;if(g.pt>2600){g.phase='cd';g.pt=0;g.cd=3;rb()}return}
  if(g.phase!=='playing')return;

  if(g.mode!=='local'&&g.mode!=='couple'){ai.tx=b.x;var d=ai.tx-(ai.x+ai.w/2);var sp=g.diff==='hard'?7:g.diff==='easy'?3:4.8;if(Math.abs(d)>5)ai.x+=d>0?sp:-sp;if(g.diff==='easy')ai.x+=(Math.random()-.5)*4;else if(g.diff==='medium')ai.x+=(Math.random()-.5)*1.8;ai.x=Math.max(0,Math.min(W-ai.w,ai.x))}

  b.x+=b.vx;b.y+=b.vy;
  if(Math.abs(b.vx)+Math.abs(b.vy)>2){b.trail.push({x:b.x,y:b.y,life:1,r:b.r*b.sa,st:b.state});if(b.trail.length>14)b.trail.shift()}
  b.trail.forEach(function(t){t.life-=.07});b.trail=b.trail.filter(function(t){return t.life>0});

  if(b.x-b.r<0){b.x=b.r;b.vx*=-.86;ew()}
  if(b.x+b.r>W){b.x=W-b.r;b.vx*=-.86;ew()}

  var r=b.r*b.sa;
  if(b.vy>0&&b.y+r>=pp.y&&b.y+r<=pp.y+pp.h+10&&b.x>pp.x-r*.5&&b.x<pp.x+pp.w+r*.5)eh(pp,1);
  if(b.vy<0&&b.y-r<=ai.y+ai.h&&b.y-r>=ai.y-10&&b.x>ai.x-r*.5&&b.x<ai.x+ai.w+r*.5)eh(ai,2);
  if(b.y-r>H){gl(2);return}if(b.y+r<0){gl(1);return}

  for(var i=g.pus.length-1;i>=0;i--){var pu=g.pus[i];if(Math.sqrt((b.x-pu.x)*(b.x-pu.x)+(b.y-pu.y)*(b.y-pu.y))<r+pu.sz/2){epu(pu);g.pus.splice(i,1)}}
  pts.forEach(function(pt){pt.x+=pt.vx;pt.y+=pt.vy;pt.life-=.022});pts=pts.filter(function(pt){return pt.life>0});
  apts.forEach(function(a){a.x+=a.vx;a.y+=a.vy;if(a.x<0)a.x=W;if(a.x>W)a.x=0;if(a.y<0)a.y=H;if(a.y>H)a.y=0;a.pl+=.01;if(g){var dx2=a.x-b.x,dy2=a.y-b.y,dd=Math.sqrt(dx2*dx2+dy2*dy2);if(dd<200){var f=(1-dd/200)*.6;a.vx+=dx2/dd*f*.02;a.vy+=dy2/dd*f*.02}a.vx*=.995;a.vy*=.995}});
  if(msgTimer>0){msgTimer-=dt;if(msgTimer<=0)msgText=''}
}

function ew(){spt(g.ball.x,g.ball.y<H/2?0:H,8,'wall',g.ball.y<H/2?Math.PI/2:-Math.PI/2);sk=Math.min(sk+1,4);sfxW();vw()}
function eh(pad,pl){
  var b=g.ball;var hx=b.x-(pad.x+pad.w/2);var rx=hx/(pad.w/2);
  var ang=rx*.75;var sp=Math.min(Math.sqrt(b.vx*b.vx+b.vy*b.vy)*1.06,BM);
  b.vx=Math.sin(ang)*sp;b.vy=(pl===1?-1:1)*Math.abs(Math.cos(ang)*sp);
  if(pl===1)b.y=pad.y-b.r*b.sa-1;else b.y=pad.y+pad.h+b.r*b.sa+1;
  b.st=.7;setTimeout(function(){if(g)g.ball.st=1.35},50);setTimeout(function(){if(g)g.ball.st=1.0},160);
  spt(b.x,b.y,18,pl===1?'blue':'red',pl===1?-Math.PI/2:Math.PI/2);
  sk=Math.min(sk+2,6);g.hits++;sfxH();vh();
}
function epu(pu){
  var b=g.ball;
  if(pu.type==='grow'){b.r=BR*1.9;b.st=1.9;b.state='grow';spt(pu.x,pu.y,20,'green')}
  else{b.r=BR*.65;b.st=.65;b.state='shrink';spt(pu.x,pu.y,18,'orange')}
  b.sa=b.st;sfxPU();vpu();
  setTimeout(function(){if(g){g.ball.r=BR;g.ball.st=1.0;g.ball.state='normal'}},2500);
}
function gl(sc){
  g.phase='goal';g.pt=0;g.ball.vx=0;g.ball.vy=0;
  if(g.couple){if(sc===2){g.sc[1]++;g.rsc[1]++}else{g.rsc[0]+=.5;g.sc[0]=Math.floor(g.rsc[0])}}
  else g.sc[sc-1]++;
  g.ls=sc;g.hits=0;g.pus=[];
  sk=12;spt(g.ball.x,g.ball.y,45,sc===1?'blue':'red');
  if(sc===1){sfxG();vg()}else{sfxL()}
  msgText='+1';msgColor=sc===1?'#00c6ff':'#e04060';msgTimer=1800;
  var wt=g.couple?(sc===2?CFW:CMW):WIN;
  var chk=g.couple?(sc===2?g.sc[1]:Math.floor(g.rsc[0])):g.sc[sc-1];
  if(chk>=wt){setTimeout(function(){g.phase='gameover';goData={w:sc};showGO=true;if(sc===1)sfxWin();else sfxLose()},1400)}
  g.round++;
}
function rb(){var b=g.ball;b.x=W/2;b.y=H/2;b.vx=(Math.random()-.5)*2;b.vy=BS*(g.ls===1?-1:1);b.r=BR;b.st=1;b.sa=1;b.trail=[];b.state='normal'}

// === GRID ===
function ug(){
  if(!g)return;var b=g.ball;
  for(var r=0;r<GR;r++)for(var c=0;c<GC;c++){
    var v=gv[r][c];var dx=v.bx-b.x,dy=v.by-b.y;var d=Math.sqrt(dx*dx+dy*dy);
    if(d<WR){var s=WS/(1+d*d/700);var f=1-d/WR;var st=s*f*f;var ndx=dx/(d+.01),ndy=dy/(d+.01);
      v.dx=ndx*st*(b.sa*1.15);v.dy=ndy*st*(b.sa*1.15)}
    else{v.dx*=.88;v.dy*=.88}
    v.dx*=.93;v.dy*=.93;
  }
}

// === RENDER ===
function dr(){
  ct.clearRect(0,0,W,H);
  var sx=0,sy=0;if(sk>.2){sx=(Math.random()-.5)*sk*2;sy=(Math.random()-.5)*sk*2}
  ct.save();ct.translate(sx,sy);
  ct.fillStyle='#0a0a1a';ct.fillRect(-10,-10,W+20,H+20);
  for(var i=0;i<apts.length;i++){var a=apts[i];ct.beginPath();ct.arc(a.x,a.y,a.r,0,Math.PI*2);ct.fillStyle='rgba(0,168,224,'+(a.a+.05*Math.sin(a.pl))+')';ct.fill()}
  dg();
  if(g){for(var j=0;j<g.pus.length;j++){var pu=g.pus[j];pu.pl+=.05;dp(pu)}}
  if(g){for(var k=0;k<g.ball.trail.length;k++){var t=g.ball.trail[k];ct.beginPath();ct.arc(t.x,t.y,t.r*t.life*.7,0,Math.PI*2);ct.fillStyle='rgba(0,168,224,'+(t.life*.35)+')';ct.fill()}}
  if(g)db();
  if(g){dpd(g.pad,1);dpd(g.ai,2)}
  dl();
  for(var p=0;p<pts.length;p++){var pt=pts[p];ct.beginPath();ct.arc(pt.x,pt.y,pt.r*pt.life,0,Math.PI*2);ct.fillStyle='rgba('+pt.rgb[0]+','+pt.rgb[1]+','+pt.rgb[2]+','+(pt.life*.7)+')';ct.fill()}
  ct.restore();

  // HUD
  if(g){
    ct.fillStyle='#f0f0f0';ct.font='bold 22px monospace';ct.textAlign='left';
    ct.fillText(g.sc[0],16,40);
    ct.textAlign='right';
    ct.fillText(g.sc[1],W-16,40);
    ct.textAlign='center';ct.fillStyle='#ccc';ct.font='bold 13px monospace';
    ct.fillText('ROUND '+g.round,W/2,30);
  }

  // Center message
  if(msgText&&msgTimer>0){
    ct.fillStyle=msgColor;ct.font='bold 36px monospace';ct.textAlign='center';
    var bounce=Math.sin(msgTimer/200)*4;
    ct.fillText(msgText,W/2,H/2-40+bounce);
  }

  // Countdown
  if(g&&g.phase==='cd'&&g.cd>0){
    ct.fillStyle='#f0f0f0';ct.font='bold 72px monospace';ct.textAlign='center';
    ct.fillText(g.cd,W/2,H/2+20);
  }

  // Overlays
  if(showLobby)drawLobby();
  if(showGO&&goData)drawGO();
  if(showExit)drawExitConfirm();

  // Exit button
  ct.fillStyle='#0a0a1a';ct.strokeStyle='#555';ct.lineWidth=2;
  ct.fillRect(12,H-48,36,36);ct.strokeRect(12,H-48,36,36);
  ct.fillStyle='#888';ct.font='bold 16px monospace';ct.textAlign='center';
  ct.fillText('X',30,H-24);
}

function dg(){
  for(var r=0;r<GR;r++){ct.beginPath();var s=false;for(var c=0;c<GC;c++){var v=gv[r][c];var x=v.bx+v.dx,y=v.by+v.dy;if(!s){ct.moveTo(x,y);s=true}else ct.lineTo(x,y)}
    var a=.10,lw=2;if(g){var b=g.ball;var px=1-Math.abs(r-(b.y/H*GR))/(GR*.35);if(px>0){a+=px*.30;lw+=px*2}}
    ct.strokeStyle='rgba(0,168,224,'+Math.min(a,.5)+')';ct.lineWidth=Math.max(2,Math.min(lw,4));ct.stroke()}
  for(var c2=0;c2<GC;c2++){ct.beginPath();var s2=false;for(var r2=0;r2<GR;r2++){var v2=gv[r2][c2];var x2=v2.bx+v2.dx,y2=v2.by+v2.dy;if(!s2){ct.moveTo(x2,y2);s2=true}else ct.lineTo(x2,y2)}
    var a2=.10,lw2=2;if(g){var b2=g.ball;var px2=1-Math.abs(c2-(b2.x/W*GC))/(GC*.35);if(px2>0){a2+=px2*.30;lw2+=px2*2}}
    ct.strokeStyle='rgba(0,168,224,'+Math.min(a2,.5)+')';ct.lineWidth=Math.max(2,Math.min(lw2,4));ct.stroke()}
}

function db(){
  var b=g.ball,r=b.r*b.sa,x=b.x,y=b.y,ps=6,pr=Math.floor(r/ps);
  var col=b.state==='grow'?'#00e870':b.state==='shrink'?'#ff8c28':'#00a8e0';
  ct.fillStyle=col;
  for(var py=-pr;py<=pr;py++)for(var px=-pr;px<=pr;px++)
    if(px*px+py*py<=pr*pr)ct.fillRect(Math.floor((x+px*ps)/ps)*ps,Math.floor((y+py*ps)/ps)*ps,ps,ps);
}

function dpd(pd,pl){
  var px=pd.x,py=pd.y,pw=pd.w,ph=pd.h,isB=pl===1,ps=4;
  var sx=Math.floor(px/ps)*ps,sy=Math.floor(py/ps)*ps,sw=Math.ceil(pw/ps)*ps,sh=Math.ceil(ph/ps)*ps;
  ct.fillStyle=isB?'#00a8e0':'#e04060';ct.fillRect(sx,sy,sw,sh);
}

function dl(){
  var y1=g.pad.y+g.pad.h+6;ct.strokeStyle='#00a8e0';ct.lineWidth=2;
  for(var x=0;x<W;x+=16){ct.beginPath();ct.moveTo(x,y1);ct.lineTo(x+8,y1);ct.stroke()}
  var y2=g.ai.y-6;ct.strokeStyle='#e04060';ct.lineWidth=2;
  for(var x2=0;x2<W;x2+=16){ct.beginPath();ct.moveTo(x2,y2);ct.lineTo(x2+8,y2);ct.stroke()}
}

function dp(pu){
  var s=pu.sz/2,isG=pu.type==='grow',cr=isG?'0,255,110':'255,140,40',ps=4;
  var px=Math.floor(pu.x/ps)*ps,py=Math.floor(pu.y/ps)*ps,sz=Math.ceil(s/ps)*ps;
  ct.save();ct.translate(px,py);
  ct.fillStyle='rgba('+cr+',1)';ct.fillRect(-sz,-sz,sz*2,sz*2);
  ct.strokeStyle='rgba('+cr+',.9)';ct.lineWidth=ps;ct.strokeRect(-sz,-sz,sz*2,sz*2);
  var ic=Math.floor(sz*.6/ps)*ps;ct.fillStyle='#0a0a1a';
  if(isG){ct.fillRect(-ps,-ic,ps*2,ic*2);ct.fillRect(-ic,-ps,ic*2,ps*2)}
  else{ct.fillRect(-ic,-ps,ic*2,ps*2)}
  ct.restore();
}

// === UI OVERLAYS ===
function drawBtn(text,x,y,w,h,color,primary){
  ct.fillStyle=primary?color:'#0a0a1a';ct.fillRect(x,y,w,h);
  ct.strokeStyle=primary?color:'#555';ct.lineWidth=2;ct.strokeRect(x,y,w,h);
  ct.fillStyle=primary?'#0a0a1a':color;ct.font='bold 13px monospace';ct.textAlign='center';
  ct.fillText(text,x+w/2,y+h/2+5);
}
function drawLobby(){
  ct.fillStyle='rgba(10,10,26,.95)';ct.fillRect(0,0,W,H);
  ct.fillStyle='#f0f0f0';ct.font='bold 22px monospace';ct.textAlign='center';
  ct.fillText('WIFI BATTLE',W/2,H/2-80);
  drawBtn('CREATE',W/2-100,H/2-20,200,44,'#00c6ff',true);
  drawBtn('JOIN',W/2-100,H/2+36,200,44,'#00c6ff',true);
  drawBtn('BACK',W/2-60,H/2+96,120,36,'#555',false);
}
function drawGO(){
  ct.fillStyle='rgba(10,10,26,.95)';ct.fillRect(0,0,W,H);
  ct.fillStyle='#f0f0f0';ct.font='bold 26px monospace';ct.textAlign='center';
  ct.fillText(goData.w===1?'YOU WIN!':'YOU LOSE',W/2,H/2-60);
  ct.font='bold 40px monospace';
  ct.fillText(g.sc[0]+' : '+g.sc[1],W/2,H/2-10);
  drawBtn('RETRY',W/2-100,H/2+40,200,44,'#00c6ff',true);
  drawBtn('QUIT',W/2-60,H/2+96,120,36,'#555',false);
}
function drawExitConfirm(){
  ct.fillStyle='rgba(10,10,26,.95)';ct.fillRect(0,0,W,H);
  ct.fillStyle='#f0f0f0';ct.font='bold 18px monospace';ct.textAlign='center';
  ct.fillText('QUIT ?',W/2,H/2-30);
  drawBtn('YES',W/2-100,H/2+10,90,40,'#00c6ff',true);
  drawBtn('NO',W/2+10,H/2+10,90,40,'#555',false);
}
function hitTest(x,y,rx,ry,rw,rh){return x>=rx&&x<=rx+rw&&y>=ry&&y<=ry+rh}

// === TOUCH ===
wx.onTouchStart(function(e){
  iac();
  var touch=e.touches[0];
  var cx=touch.clientX,cy=touch.clientY;

  if(hitTest(cx,cy,12,H-48,36,36)){
    if(showExit){showExit=false;return}
    if(showGO||showLobby)return;
    showExit=true;return;
  }

  if(showExit){
    if(hitTest(cx,cy,W/2-100,H/2+10,90,40)){wx.exitMiniProgram()}
    if(hitTest(cx,cy,W/2+10,H/2+10,90,40)){showExit=false;return}
    return;
  }

  if(showLobby){
    if(hitTest(cx,cy,W/2-100,H/2-20,200,44)){cr();return}
    if(hitTest(cx,cy,W/2-100,H/2+36,200,44)){jr();return}
    if(hitTest(cx,cy,W/2-60,H/2+96,120,36)){showLobby=false;return}
    return;
  }

  if(showGO){
    if(hitTest(cx,cy,W/2-100,H/2+40,200,44)){rs();return}
    if(hitTest(cx,cy,W/2-60,H/2+96,120,36)){wx.exitMiniProgram();return}
    return;
  }

  if(!g||(g.phase!=='playing'&&g.phase!=='cd'))return;
  if(g.mode==='local'||g.mode==='couple'){
    if(cy<H/2&&t2===null)t2=e.touches[0].identifier;
    else if(cy>=H/2&&t1===null){t1=e.touches[0].identifier;tx=cx}
  }else{t1=e.touches[0].identifier;tx=cx}
});

wx.onTouchMove(function(e){
  if(!g||g.phase!=='playing')return;
  for(var i=0;i<e.touches.length;i++){
    var t=e.touches[i];
    var cx=t.clientX,cy=t.clientY;
    if(g.mode==='local'||g.mode==='couple'){
      if(t.identifier===t1){var d=cx-(tx||cx);g.pad.x+=d;g.pad.x=Math.max(0,Math.min(W-g.pad.w,g.pad.x));tx=cx}
      else if(t.identifier===t2){g.ai.x=cx-g.ai.w/2;g.ai.x=Math.max(0,Math.min(W-g.ai.w,g.ai.x))}
    }else if(t.identifier===t1){var d2=cx-tx;g.pad.x+=d2;g.pad.x=Math.max(0,Math.min(W-g.pad.w,g.pad.x));tx=cx}
  }
});

wx.onTouchEnd(function(e){
  if(t1!==null||t2!==null){
    for(var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i];
      if(t.identifier===t1)t1=null;
      if(t.identifier===t2)t2=null;
    }
  }
});

// === NETWORK ===
function cr(){showLobby=false;wx.showToast({title:'Coming soon',icon:'none'})}
function jr(){showLobby=false;wx.showToast({title:'Coming soon',icon:'none'})}

// === RESTART ===
function rs(){showGO=false;goData=null;g=mk();pts=[];sk=0;ig()}

// === LOOP (setInterval — more reliable in WeChat) ===
function lp(){
  try{ if(g){ug();up(16);dr()} }catch(e){}
}
setInterval(lp, 16);
setInterval(function(){spu()},PUI);
if(gm==='network'){showLobby=true}
g=mk();ig();