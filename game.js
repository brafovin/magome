'use strict';
/* ═══════════════════════════════════════════════════════
   OCTAGON 5 — UFC-style MMA game
   All HTML IDs match index.html / style.css exactly.
   ═══════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────
   ROSTER  (realistic MMA archetypes)
   ───────────────────────────────────────────────────── */
const ROSTER = [
  { name:'IGOR MAKAROV', nick:'"THE BEAR"', style:'WRESTLER', ai:'wrestler',
    record:'28-4-0', strike:74, grapple:96, stamina:90, chin:86,
    skin:'#c89a70', shorts:'#1a3d7a', trim:'#ffffff',
    hair:'shaved', hairCol:'#2a1e14', beard:'stubble',
    eyeCol:'#4a3020', body:'stocky', tattoo:[] },

  { name:'MARCO COSTA', nick:'"EL TORO"', style:'STRIKER', ai:'striker',
    record:'22-2-0', strike:95, grapple:68, stamina:86, chin:80,
    skin:'#b87848', shorts:'#1a1a1a', trim:'#d4232c',
    hair:'short', hairCol:'#1a1008', beard:'none',
    eyeCol:'#3d2510', body:'lean', tattoo:['leftArm','chest'] },

  { name:'DERRICK HOLT', nick:'"THE BEAST"', style:'BRAWLER', ai:'brawler',
    record:'19-5-0', strike:90, grapple:66, stamina:74, chin:94,
    skin:'#70402a', shorts:'#8a0000', trim:'#ffd34d',
    hair:'fade', hairCol:'#1a0e08', beard:'none',
    eyeCol:'#2a1a10', body:'massive', tattoo:['rightArm','back'] },

  { name:'CARLOS VEGA', nick:'"EL FANTASMA"', style:'COUNTER', ai:'counter',
    record:'21-1-1', strike:88, grapple:76, stamina:88, chin:90,
    skin:'#c09060', shorts:'#0a5c1a', trim:'#ffd700',
    hair:'short', hairCol:'#140e08', beard:'mustache',
    eyeCol:'#3a2418', body:'athletic', tattoo:['leftArm'] },

  { name:'ZUBAIR ALIEV', nick:'"THE EAGLE"', style:'WRESTLER', ai:'wrestler',
    record:'24-3-0', strike:80, grapple:92, stamina:84, chin:88,
    skin:'#c49870', shorts:'#2a2a2a', trim:'#e8e8e8',
    hair:'short', hairCol:'#1c1208', beard:'beard',
    eyeCol:'#3c2816', body:'stocky', tattoo:[] },

  { name:'MARCUS OKONKWO', nick:'"THE LION"', style:'BRAWLER', ai:'brawler',
    record:'23-0-0', strike:97, grapple:62, stamina:80, chin:78,
    skin:'#5a3018', shorts:'#0d0d1c', trim:'#ffffff',
    hair:'bald', hairCol:'#0e0a06', beard:'none',
    eyeCol:'#241810', body:'massive', tattoo:['chest','leftArm','rightArm'] },
];

/* ─────────────────────────────────────────────────────
   MOVES
   ───────────────────────────────────────────────────── */
const MOVES = {
  jab:      {dur:16, hit:6,  range:135, dmg:5,  flash:3,  stam:4,  knock:0.0,  type:'punch', label:'JAB'},
  cross:    {dur:22, hit:9,  range:145, dmg:9,  flash:7,  stam:7,  knock:0.15, type:'punch', label:'CROSS'},
  hook:     {dur:24, hit:10, range:125, dmg:11, flash:9,  stam:9,  knock:0.2,  type:'punch', label:'HOOK'},
  uppercut: {dur:26, hit:11, range:112, dmg:13, flash:11, stam:10, knock:0.22, type:'punch', label:'UPPERCUT'},
  bodykick: {dur:30, hit:13, range:180, dmg:10, flash:5,  stam:12, knock:0.1,  type:'kick',  label:'BODY KICK', body:true},
  headkick: {dur:38, hit:18, range:190, dmg:18, flash:16, stam:18, knock:0.4,  type:'kick',  label:'HEAD KICK'},
  spinkick: {dur:42, hit:22, range:185, dmg:20, flash:18, stam:20, knock:0.45, type:'kick',  label:'SPINNING KICK'},
  knee:     {dur:20, hit:9,  range:95,  dmg:13, flash:10, stam:9,  knock:0.2,  type:'kick',  label:'KNEE'},
  dirtybox: {dur:14, hit:6,  range:90,  dmg:6,  flash:4,  stam:5,  knock:0.05, type:'punch', label:'DIRTY BOXING'},
  gnp:      {dur:18, hit:8,  range:65,  dmg:7,  flash:6,  stam:6,  knock:0.12, type:'punch', label:'GROUND & POUND'},
};

/* ─────────────────────────────────────────────────────
   AUDIO ENGINE
   ───────────────────────────────────────────────────── */
class AudioEngine {
  constructor(){ this._ctx=null; }
  _init(){
    if(!this._ctx) try{ this._ctx=new(window.AudioContext||window.webkitAudioContext)(); }catch(e){}
    if(this._ctx&&this._ctx.state==='suspended') this._ctx.resume();
  }
  _tone(f,dur,type,gain,slide){
    this._init(); if(!this._ctx) return;
    const t=this._ctx.currentTime, o=this._ctx.createOscillator(), g=this._ctx.createGain();
    o.type=type||'sine'; o.frequency.setValueAtTime(f,t);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(10,slide),t+dur);
    g.gain.setValueAtTime(gain||0.3,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(g).connect(this._ctx.destination); o.start(t); o.stop(t+dur+0.02);
  }
  _noise(dur,gain,fc){
    this._init(); if(!this._ctx) return;
    const t=this._ctx.currentTime, sr=this._ctx.sampleRate;
    const buf=this._ctx.createBuffer(1,sr*dur,sr), d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1);
    const src=this._ctx.createBufferSource(); src.buffer=buf;
    const fl=this._ctx.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=fc||1000;
    const g=this._ctx.createGain(); g.gain.setValueAtTime(gain||0.3,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    src.connect(fl).connect(g).connect(this._ctx.destination); src.start(t);
  }
  punch(p){ this._noise(0.08,0.28*(p||1),1400); this._tone(160,0.1,'triangle',0.2*(p||1),50); }
  kick(p){  this._noise(0.13,0.35*(p||1),700);  this._tone(90, 0.15,'sine',   0.28*(p||1),35); }
  block(){  this._noise(0.05,0.18,2500); }
  takedown(){ this._noise(0.24,0.4,500); this._tone(65,0.28,'sine',0.3,28); }
  crowd(i){ const d=0.6+(i||0.5)*0.8; this._noise(d,0.1+(i||0.5)*0.15,1100); }
  bell(){ this._tone(880,0.5,'sine',0.3,820); setTimeout(()=>this._tone(880,0.4,'sine',0.22,820),130); }
}
const Audio = new AudioEngine();

/* ─────────────────────────────────────────────────────
   PARTICLE
   ───────────────────────────────────────────────────── */
class Particle {
  constructor(x,y,col,kind){
    this.x=x; this.y=y; this.col=col||'#b5121b'; this.kind=kind||'blood';
    const a=Math.random()*Math.PI*2, sp=kind==='sweat'?1+Math.random()*3:2+Math.random()*5;
    this.vx=Math.cos(a)*sp; this.vy=Math.sin(a)*sp-2;
    this.life=1; this.decay=0.022+Math.random()*0.028;
    this.r=(kind==='sweat'?1.5:2)+Math.random()*3;
  }
  update(){ this.x+=this.vx; this.y+=this.vy; this.vy+=0.35; this.vx*=0.98; this.life-=this.decay; }
  draw(ctx){ ctx.globalAlpha=Math.max(0,this.life); ctx.fillStyle=this.col; ctx.beginPath(); ctx.arc(this.x,this.y,this.r*this.life,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
}

/* ─────────────────────────────────────────────────────
   FIGHTER STATE ENUM
   ───────────────────────────────────────────────────── */
const ST = { STAND:'stand', CLINCH:'clinch', SHOOTING:'shooting',
             TOP:'top', BOT:'bot', STAGGER:'stagger', DOWN:'down', GETUP:'getup' };

/* ─────────────────────────────────────────────────────
   FIGHTER CLASS
   ───────────────────────────────────────────────────── */
class Fighter {
  constructor(data, side){
    this.data=data; this.name=data.name; this.side=side;
    this.facing=side===-1?1:-1;
    this.health=100; this.maxHealth=100; this.stamina=100;
    this.flash=0;
    this.strike=data.strike/100; this.grapple=data.grapple/100;
    this.staminaRate=data.stamina/100; this.chin=data.chin/100;
    this.state=ST.STAND;
    this.attackTimer=0; this.currentMove=null; this.recovery=0;
    this.blocking=false; this.staggerTimer=0; this.downTimer=0;
    this.getupHold=0; this.shootTimer=0; this.hitFlash=0; this.invuln=0;
    this.cuts=[]; this.swelling=0;
    this.breathe=Math.random()*Math.PI*2; this.legPhase=0; this.animFrame=0;
    this.roundsWon=0; this.aiTimer=0; this.aiIntent=null; this.isPlayer=false;
    this.stats={strikes:0,takedowns:0,knockdowns:0,subs:0};
    this.x=0; this.y=0; // set on reset
  }
  get headX(){ return this.x; }
  get headY(){ return this.y-150; }
  canAct(){
    return this.attackTimer<=0&&this.recovery<=0&&
           this.state!==ST.STAGGER&&this.state!==ST.DOWN&&
           this.state!==ST.GETUP&&this.state!==ST.SHOOTING;
  }
  reset(W){
    this.health=this.maxHealth; this.stamina=100; this.flash=0;
    this.state=ST.STAND; this.attackTimer=0; this.recovery=0;
    this.staggerTimer=0; this.downTimer=0; this.getupHold=0;
    this.shootTimer=0; this.blocking=false; this.currentMove=null; this.hitFlash=0;
    this.x = this.side===-1 ? W*0.32 : W*0.68;
    this.y = 0; // set by arena
    this.facing = this.side===-1 ? 1 : -1;
  }
}

/* ─────────────────────────────────────────────────────
   GAME
   ───────────────────────────────────────────────────── */
class Game {
  constructor(){
    this.canvas = document.getElementById('canvas');
    this.ctx    = this.canvas.getContext('2d');
    this.W=0; this.H=0; this.groundY=0;
    this.resize();
    window.addEventListener('resize',()=>this.resize());

    this.keys={};
    this.particles=[];
    this.shake=0; this.flashScreen=0;
    this.running=false; this.round=1; this.maxRounds=3;
    this.roundTime=5*60; this.timeLeft=this.roundTime;
    this.frame=0; this.tickCarry=0;
    this.impacts=[];
    this.roundScores=[];
    this.highlights=[];
    this.selPlayer=0; this.selAI=1;
    this.crowd=this.makeCrowd();

    this.bindUI();
    this.bindKeys();
    this.buildSelect();
  }

  resize(){
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.W=this.canvas.width; this.H=this.canvas.height;
    this.groundY = this.H*0.72;
  }

  /* ── crowd ── */
  makeCrowd(){
    const a=[]; for(let i=0;i<280;i++) a.push({
      x:Math.random()*2000, y:50+Math.random()*130,
      s:5+Math.random()*9, sh:16+Math.floor(Math.random()*24),
      fl:Math.random()*Math.PI*2,
    }); return a;
  }

  /* ═══════════════ UI / SELECT ═══════════════ */
  buildSelect(){
    this._fillRoster('roster-player','sel-red', i=>{this.selPlayer=i; this.buildSelect();});
    this._fillRoster('roster-ai',   'sel-blue', i=>{this.selAI=i;     this.buildSelect();});
    this._fillCard('card-player', ROSTER[this.selPlayer], false);
    this._fillCard('card-ai',     ROSTER[this.selAI],     true);
  }

  _fillRoster(containerId, selClass, cb){
    const el=document.getElementById(containerId); el.innerHTML='';
    const isp = containerId==='player-roster';
    ROSTER.forEach((f,i)=>{
      const d=document.createElement('div');
      const isSel = (isp ? this.selPlayer : this.selAI)===i;
      d.className='roster-item'+(isSel?' selected':'');
      const thumb=document.createElement('div'); thumb.className='ri-thumb';
      const cv=document.createElement('canvas'); cv.width=46; cv.height=46; cv.style.cssText='display:block;width:46px;height:46px;border-radius:5px;';
      thumb.appendChild(cv); d.appendChild(thumb);
      const info=document.createElement('div'); info.className='ri-info';
      info.innerHTML=`<div class="ri-name">${f.name}</div><div class="ri-style">${f.style}</div><div class="ri-rec">${f.record}</div>`;
      d.appendChild(info);
      drawMiniPortrait(cv.getContext('2d'),f,46);
      d.addEventListener('click',()=>cb(i));
      el.appendChild(d);
    });
  }

  _fillCard(id, f, isAI){
    const el=document.getElementById(id); el.innerHTML='';
    const cv=document.createElement('canvas');
    cv.className='fcard-canvas'; cv.width=218; cv.height=170;
    el.appendChild(cv);
    el.innerHTML+=`<div class="fcard-name">${f.name}</div>
      <div class="fcard-style">${f.nick||''} · ${f.style}</div>
      <div class="fcard-rec">RECORD ${f.record}</div>`;
    [['STRIKE',f.strike],['GRAPPLE',f.grapple],['STAMINA',f.stamina],['CHIN',f.chin]].forEach(([lbl,v])=>{
      const row=document.createElement('div'); row.className='stat-row';
      row.innerHTML=`<span class="lbl">${lbl}</span><div class="stat-bar" style="flex:1;height:8px;background:#1b1c25;border-radius:4px;overflow:hidden"><div class="sfill" style="height:100%;width:${v}%;background:${isAI?'linear-gradient(90deg,#e7c66a,#fff0c0)':'linear-gradient(90deg,var(--red),var(--red-glow))'};border-radius:4px"></div></div><span style="color:#fff;font-size:11px;width:26px;text-align:right">${v}</span>`;
      el.appendChild(row);
    });
    // draw card art after DOM insertion
    requestAnimationFrame(()=>{
      const c=el.querySelector('.fcard-canvas');
      if(c){ const g=c.getContext('2d'); g.clearRect(0,0,218,170); g.save(); g.translate(109,168); g.scale(0.62,0.62); const dm=new Fighter(f,isAI?1:-1); dm.facing=isAI?-1:1; dm.state=ST.STAND; dm.cuts=[]; dm.swelling=0; drawFighterBody(g,dm,0,200); g.restore(); }
    });
  }

  /* ═══════════════ KEY / UI ═══════════════ */
  bindUI(){
    document.getElementById('fight-btn').addEventListener('click',()=>this.startFight());
    document.getElementById('rematch-btn').addEventListener('click',()=>this.startFight());
    document.getElementById('menu-btn').addEventListener('click',()=>this.show('select-screen'));
  }
  bindKeys(){
    window.addEventListener('keydown',e=>{
      this.keys[e.key.toLowerCase()]=true;
      if(e.shiftKey) this.keys['shift']=true;
      if(this.running) this.handleInput(e);
    });
    window.addEventListener('keyup',e=>{
      this.keys[e.key.toLowerCase()]=false;
      if(!e.shiftKey) this.keys['shift']=false;
    });
  }
  show(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  /* ═══════════════ START FIGHT ═══════════════ */
  startFight(){
    Audio._init();
    this.p1=new Fighter(ROSTER[this.selPlayer],-1);
    this.p2=new Fighter(ROSTER[this.selAI], 1);
    this.p1.isPlayer=true;
    this.round=1; this.roundScores=[]; this.highlights=[]; this.particles=[];
    this.setupRound();
    this.updateHUDStatic();
    this.show('game-screen');
    this.running=true; this.last=performance.now();
    requestAnimationFrame(t=>this.loop(t));
    Audio.bell();
    this.banner('ROUND 1', 1500);
  }

  setupRound(){
    this.p1.reset(this.W); this.p2.reset(this.W);
    this.p1.y=this.groundY; this.p2.y=this.groundY;
    this.p1.facing=1; this.p2.facing=-1;
    this.timeLeft=this.roundTime; this.frame=0;
  }

  updateHUDStatic(){
    document.getElementById('p1-name').textContent=this.p1.name;
    document.getElementById('p2-name').textContent=this.p2.name;
    document.getElementById('round-num').textContent=`${this.round}`;
    this._hudPortrait('p1-portrait', this.p1.data);
    this._hudPortrait('p2-portrait', this.p2.data);
    const dots=document.getElementById('round-dots'); dots.innerHTML='';
    for(let i=0;i<this.maxRounds;i++){
      const d=document.createElement('div'); d.className='dot';
      const sc=this.roundScores[i];
      if(sc) d.classList.add(sc.p1>sc.p2?'p1':'p2');
      dots.appendChild(d);
    }
  }
  _hudPortrait(id, f){
    const wrap=document.getElementById(id); wrap.innerHTML='';
    const cv=document.createElement('canvas'); cv.width=52; cv.height=52;
    cv.style.cssText='width:100%;height:100%;border-radius:5px;display:block;';
    wrap.appendChild(cv);
    drawMiniPortrait(cv.getContext('2d'),f,52);
  }

  /* ═══════════════ MAIN LOOP ═══════════════ */
  loop(t){
    if(!this.running) return;
    const dt=Math.min(50,t-this.last); this.last=t;
    this.tickCarry+=dt;
    while(this.tickCarry>=16.67){ this.tick(); this.tickCarry-=16.67; }
    this.render();
    requestAnimationFrame(tt=>this.loop(tt));
  }

  tick(){
    this.frame++;
    if(this.frame%60===0&&this.timeLeft>0){ this.timeLeft--; if(this.timeLeft<=0) this.endRound('time'); }
    this.updateFighter(this.p1,this.p2);
    this.updateFighter(this.p2,this.p1);
    this.runAI(this.p2,this.p1);
    this.resolveClinch();
    for(const p of this.particles) p.update();
    this.particles=this.particles.filter(p=>p.life>0);
    if(this.shake>0) this.shake*=0.85;
    if(this.flashScreen>0) this.flashScreen-=0.055;
    this.regen(this.p1); this.regen(this.p2);
    this.updateHUDLive();
    if(this.p1.health<=0) this.finish(this.p2,this.p1,'KO');
    else if(this.p2.health<=0) this.finish(this.p1,this.p2,'KO');
  }

  regen(f){
    if(f.canAct()&&!f.blocking) f.stamina=Math.min(100,f.stamina+0.12*f.staminaRate);
    f.flash=Math.max(0,f.flash-0.14);
  }

  /* ═══════════════ FIGHTER UPDATE ═══════════════ */
  updateFighter(f,opp){
    f.animFrame++; f.breathe+=0.05;
    f.facing=(opp.x>f.x)?1:-1;
    if(f.hitFlash>0) f.hitFlash--;
    if(f.invuln>0) f.invuln--;
    if(f.recovery>0) f.recovery--;
    if(f.attackTimer>0){
      const mv=f.currentMove;
      if(mv.dur-f.attackTimer===mv.hit) this.resolveHit(f,opp,mv);
      f.attackTimer--;
      if(f.attackTimer<=0){ f.currentMove=null; f.recovery=4; }
    }
    if(f.state===ST.STAGGER){ f.staggerTimer--; f.x+=f.facing*-1.4; if(f.staggerTimer<=0) f.state=ST.STAND; }
    if(f.state===ST.DOWN){ f.downTimer--; if(f.downTimer<=0&&f.health>0){ f.state=ST.STAND; f.invuln=40; } }
    if(f.state===ST.GETUP){ f.getupHold++; if(f.getupHold>=60){ f.state=ST.STAND; opp.state=ST.STAND; f.invuln=30; this.banner('UP!',600); } }
    if(f===this.p1) this.playerMove(f);
    f.x=Math.max(this.W*0.08, Math.min(this.W*0.92, f.x));
  }

  playerMove(f){
    if(!f.canAct()) return;
    let mv=0;
    if(this.keys['a']||this.keys['arrowleft']) mv-=1;
    if(this.keys['arrowright']) mv+=1;
    if(mv!==0&&f.state===ST.STAND){ f.x+=mv*3.4; f.legPhase+=0.32; }
    f.blocking=!!this.keys['s']&&f.state===ST.STAND;
  }

  /* ═══════════════ INPUT ═══════════════ */
  handleInput(e){
    const f=this.p1, opp=this.p2, k=e.key.toLowerCase();
    if(f.state===ST.TOP){
      if(k==='j'||k==='k') this.startMove(f,opp,'gnp');
      else if(k==='d') this.passGuard(f,opp);
      else if(k==='v') this.subAttempt(f,opp);
      return;
    }
    if(f.state===ST.BOT){
      if(k==='w'){ if(f.state!==ST.GETUP){f.state=ST.GETUP;f.getupHold=0;} }
      else if(k==='v') this.subAttempt(f,opp);
      return;
    }
    if(f.state===ST.CLINCH){
      if(k==='n') this.startMove(f,opp,'knee');
      else if(k==='j'||k==='k') this.startMove(f,opp,'dirtybox');
      else if(k==='o') this.clinchTD(f,opp);
      else if(k==='s') this.breakClinch();
      return;
    }
    if(!f.canAct()) return;
    switch(k){
      case 'j': this.startMove(f,opp,'jab'); break;
      case 'k': this.startMove(f,opp,'cross'); break;
      case 'u': this.startMove(f,opp,'hook'); break;
      case 'i': this.startMove(f,opp,'uppercut'); break;
      case 'l': this.startMove(f,opp,this.keys['shift']?'headkick':'bodykick'); break;
      case 'b': this.startMove(f,opp,'spinkick'); break;
      case 'o': this.startShoot(f,opp); break;
      case 'n': if(Math.abs(f.x-opp.x)<115) this.enterClinch(f,opp); break;
    }
  }

  /* ═══════════════ MOVES ═══════════════ */
  startMove(f,opp,name){
    const mv=MOVES[name]; if(!mv) return;
    if(f.attackTimer>0||f.recovery>0) return;
    if(f.stamina<mv.stam*0.5) return;
    f.currentMove=mv; f.attackTimer=mv.dur;
    f.stamina=Math.max(0,f.stamina-mv.stam); f.legPhase=0;
  }
  startShoot(f,opp){
    if(!f.canAct()||f.stamina<15) return;
    f.state=ST.SHOOTING; f.stamina-=15;
    this.technique('TAKEDOWN ATTEMPT');
    Audio.takedown();
    setTimeout(()=>this.resolveTD(f,opp),480);
  }
  resolveTD(f,opp){
    if(f.state!==ST.SHOOTING) return; f.state=ST.STAND;
    const sprawled=opp.isPlayer?this.keys['s']:opp.aiIntent==='sprawl';
    const off=f.grapple*0.6+(Math.abs(f.x-opp.x)<120?0.2:-0.3);
    const def=opp.grapple*0.5+(sprawled?0.4:0);
    if(off>def&&Math.random()<0.7) this.completeTD(f,opp);
    else{ this.technique('SPRAWL!'); opp.stamina=Math.max(0,opp.stamina-8); }
  }
  completeTD(f,opp){
    f.state=ST.TOP; opp.state=ST.BOT;
    const cx=(f.x+opp.x)/2; f.x=cx; opp.x=cx;
    f.stats.takedowns++;
    this.technique('TAKEDOWN!');
    this.shake=14; this.flashScreen=0.4;
    Audio.takedown(); Audio.crowd(0.7);
    this.highlights.push(`R${this.round} ${this.fmtClock()} — ${f.name} scores a takedown`);
    this.damage(opp,f,4,6,false);
  }
  passGuard(f,opp){
    if(f.recovery>0) return; f.recovery=20;
    if(Math.random()<f.grapple*0.6){ this.technique('PASS GUARD'); this.damage(opp,f,3,5,false); }
    else this.technique('GUARD HELD');
  }
  subAttempt(f,opp){
    if(f.recovery>0) return; f.recovery=40;
    const label=Math.random()<0.5?'ARMBAR':'REAR-NAKED CHOKE';
    this.technique(label); Audio.crowd(0.8);
    const chance=f.grapple*0.5-opp.grapple*0.3+(1-opp.health/100)*0.5;
    if(Math.random()<Math.max(0.05,chance)){ f.stats.subs++; this.finish(f,opp,'SUBMISSION'); }
    else{ this.technique('DEFENDED!'); f.stamina=Math.max(0,f.stamina-12); }
  }
  enterClinch(f,opp){
    if(f.state!==ST.STAND||opp.state!==ST.STAND) return;
    f.state=ST.CLINCH; opp.state=ST.CLINCH;
    const cx=(f.x+opp.x)/2; f.x=cx-f.facing*40; opp.x=cx+f.facing*40;
    this.technique('CLINCH');
  }
  breakClinch(){
    this.p1.state=ST.STAND; this.p2.state=ST.STAND;
    this.p1.x-=this.p1.facing*30; this.p2.x+=this.p1.facing*30;
  }
  clinchTD(f,opp){
    if(f.recovery>0) return; f.recovery=24;
    if(Math.random()<f.grapple*0.6+0.1) this.completeTD(f,opp);
    else this.technique('DEFENDED TD');
  }
  resolveClinch(){
    const a=this.p1,b=this.p2;
    if(a.state===ST.STAND&&b.state===ST.STAND&&Math.abs(a.x-b.x)<62&&a.attackTimer<=0&&b.attackTimer<=0)
      if(Math.random()<0.04) this.enterClinch(a,b);
  }

  /* ═══════════════ HIT RESOLUTION ═══════════════ */
  resolveHit(f,opp,mv){
    f.stats.strikes++;
    const dist=Math.abs(f.x-opp.x);
    const reach=f.state===ST.TOP?80:f.state===ST.CLINCH?110:mv.range;
    if(dist>reach){ return; }
    if(opp.blocking&&opp.state===ST.STAND&&!mv.body){
      Audio.block();
      this.spawnP(opp.headX,opp.headY,4,'#cfd2da','sweat');
      opp.stamina=Math.max(0,opp.stamina-mv.dmg*0.4);
      this.shake=4; this.impact((f.x+opp.x)/2,opp.headY,0.5); return;
    }
    if(opp.invuln>0) return;
    const power=mv.dmg*(0.7+f.strike*0.5);
    const chinF=2-opp.chin;
    this.damage(opp,f,power,mv.flash*chinF,true,mv);
  }

  damage(opp,f,dmg,flashGain,vis,mv){
    opp.health=Math.max(0,opp.health-dmg);
    opp.flash+=flashGain; opp.hitFlash=8; opp.invuln=6;
    if(mv) opp.x+=f.facing*mv.knock*42;
    if(mv){ mv.type==='kick'?Audio.kick(0.8+mv.dmg/25):Audio.punch(0.7+mv.dmg/20); }
    if(vis){
      const hy=(mv&&mv.body)?opp.y-80:opp.headY;
      const px=opp.x+opp.facing*-10;
      this.impact(px,hy,dmg>9?1:0.55);
      this.spawnP(px,hy,dmg>9?14:6,'#b5121b','blood');
      if(dmg>7) this.spawnP(px,hy,4,'rgba(255,240,220,0.7)','sweat');
      this.shake=Math.min(22,6+dmg);
      if(dmg>9){ this.flashScreen=0.5; Audio.crowd(Math.min(1,dmg/22)); }
      this.addCut(opp,dmg); opp.swelling=Math.min(1,opp.swelling+dmg*0.015);
    }
    if(opp.health<=0) return;
    if(opp.flash>=30&&opp.state===ST.STAND) this.knockCheck(opp,f,dmg,mv);
    else if(opp.flash>=18&&opp.state===ST.STAND&&Math.random()<0.5) this.stagger(opp);
  }

  knockCheck(opp,f,dmg,mv){
    if(mv&&(mv.knock>=0.2||dmg>11)&&Math.random()<0.6){
      opp.state=ST.DOWN; opp.downTimer=120; opp.flash=0;
      f.stats.knockdowns++;
      this.banner('KNOCKDOWN!',1400); this.flashScreen=0.9; this.shake=24;
      Audio.crowd(1);
      this.highlights.push(`R${this.round} ${this.fmtClock()} — ${f.name} drops ${opp.name} (${mv.label})`);
      if(opp.health<22&&Math.random()<0.7)
        setTimeout(()=>{ if(opp.state===ST.DOWN) this.finish(f,opp,'TKO'); },700);
    } else this.stagger(opp);
  }
  stagger(opp){ opp.state=ST.STAGGER; opp.staggerTimer=50; opp.flash=Math.max(0,opp.flash-8); this.banner('ROCKED!',900); this.flashScreen=0.5; }
  addCut(f,dmg){ if(dmg<7||f.cuts.length>6||Math.random()<0.5) return; f.cuts.push({ox:(Math.random()-0.5)*28,oy:-148+(Math.random()-0.5)*28,size:2+Math.random()*3}); }

  /* ═══════════════ EFFECTS ═══════════════ */
  impact(x,y,scale){ this.impacts.push({x,y,life:1,scale:scale||1}); }
  spawnP(x,y,n,col,kind){ for(let i=0;i<n;i++) this.particles.push(new Particle(x,y,col,kind)); }

  technique(txt){
    const el=document.getElementById('technique-label');
    el.textContent=txt; el.style.opacity='1';
    clearTimeout(this._techTO);
    this._techTO=setTimeout(()=>{el.style.opacity='0';},700);
  }
  banner(txt,ms){
    const el=document.getElementById('state-banner');
    el.textContent=txt; el.style.opacity='1'; el.style.transform='translate(-50%,-50%) scale(1)';
    clearTimeout(this._banTO);
    this._banTO=setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translate(-50%,-50%) scale(.6)'; },ms||1000);
  }

  /* ═══════════════ AI ═══════════════ */
  runAI(ai,opp){
    if(!this.running) return;
    if(ai.aiTimer>0){ ai.aiTimer--; }
    const dist=Math.abs(ai.x-opp.x), st=ai.data.ai;

    if(ai.state===ST.TOP){
      if(ai.recovery<=0&&ai.aiTimer<=0){
        const r=Math.random();
        if(r<0.5) this.startMove(ai,opp,'gnp');
        else if(r<0.75) this.passGuard(ai,opp);
        else this.subAttempt(ai,opp);
        ai.aiTimer=40;
      } return;
    }
    if(ai.state===ST.BOT){
      if(ai.aiTimer<=0){
        if(Math.random()<0.4){ ai.state=ST.GETUP; ai.getupHold=0; }
        else this.subAttempt(ai,opp);
        ai.aiTimer=70;
      } return;
    }
    if(ai.state===ST.CLINCH){
      if(ai.recovery<=0&&ai.aiTimer<=0){
        const r=Math.random();
        if(st==='wrestler'&&r<0.5) this.clinchTD(ai,opp);
        else if(r<0.6) this.startMove(ai,opp,'knee');
        else if(r<0.9) this.startMove(ai,opp,'dirtybox');
        else{ ai.state=ST.STAND; opp.state=ST.STAND; ai.x-=ai.facing*30; }
        ai.aiTimer=30;
      } return;
    }
    if(!ai.canAct()) return;

    let desired,agg,shoot=0;
    switch(st){
      case 'striker':  desired=155; agg=0.55; break;
      case 'wrestler': desired=120; agg=0.50; shoot=0.5; break;
      case 'counter':  desired=160; agg=0.30; break;
      case 'brawler':  desired=90;  agg=0.80; break;
      default:         desired=140; agg=0.50;
    }
    ai.aiIntent=(opp.state===ST.SHOOTING&&Math.random()<ai.grapple)?'sprawl':null;
    ai.blocking=false;
    if(Math.abs(dist-desired)>18){ const dir=dist>desired?ai.facing:-ai.facing; ai.x+=dir*(1.8+agg); ai.legPhase+=0.22; }
    if(st==='counter'&&opp.attackTimer>0&&dist<175&&Math.random()<0.6) ai.blocking=true;
    if(ai.stamina<20){ ai.aiTimer=Math.max(ai.aiTimer,20); return; }
    if(ai.aiTimer>0) return;
    if(Math.random()>agg){ ai.aiTimer=18+Math.floor(Math.random()*30); return; }
    if(shoot>0&&dist<145&&Math.random()<shoot&&opp.health<90){ this.startShoot(ai,opp); ai.aiTimer=70; return; }
    if(st==='wrestler'&&dist<90&&Math.random()<0.4){ this.enterClinch(ai,opp); ai.aiTimer=40; return; }
    let pick;
    if(dist>170) pick=['bodykick','headkick','spinkick'][Math.floor(Math.random()*3)];
    else if(dist>125) pick=['jab','cross','bodykick'][Math.floor(Math.random()*3)];
    else pick=['jab','cross','hook','uppercut'][Math.floor(Math.random()*4)];
    this.startMove(ai,opp,pick);
    if(st==='brawler'&&Math.random()<0.6){
      const combo=['cross','hook'][Math.floor(Math.random()*2)];
      setTimeout(()=>{ if(ai.canAct()&&ai.state===ST.STAND) this.startMove(ai,opp,combo); },MOVES[pick].dur*16);
    }
    ai.aiTimer=MOVES[pick].dur+12+Math.floor(Math.random()*22);
  }

  /* ═══════════════ ROUND / FINISH ═══════════════ */
  endRound(reason){
    if(!this.running) return;
    const p1=this.p1, p2=this.p2;
    const s1=p1.health+p1.stats.strikes*0.5+p1.stats.takedowns*4+p1.stats.knockdowns*8;
    const s2=p2.health+p2.stats.strikes*0.5+p2.stats.takedowns*4+p2.stats.knockdowns*8;
    const sc=s1>=s2?{p1:10,p2:9}:{p1:9,p2:10};
    this.roundScores[this.round-1]=sc;
    if(sc.p1>sc.p2) p1.roundsWon++; else p2.roundsWon++;
    Audio.bell();
    if(this.round>=this.maxRounds){ this.decision(); return; }
    this.running=false; this.showRoundCard();
  }

  showRoundCard(){
    document.getElementById('rc-round').textContent=this.round;
    const sc=document.getElementById('scorecards'); sc.innerHTML='';
    this.roundScores.forEach((s,i)=>{
      const el=document.createElement('div');
      el.innerHTML=`<span style="color:var(--red)">${this.p1.name} <b>${s.p1}</b></span>
        &nbsp;—&nbsp;
        <span style="color:var(--gold)"><b>${s.p2}</b> ${this.p2.name}</span>`;
      sc.appendChild(el);
    });
    const adv=['Keep your hands up!','Watch for the takedown.','Use the jab to control range.','Go to the body more.','Stay composed and pick your shots.'];
    document.getElementById('corner-advice').textContent=adv[Math.floor(Math.random()*adv.length)];
    this.show('round-screen');
    let n=5;
    const cd=document.getElementById('round-countdown'); cd.textContent=`Next round in ${n}...`;
    const iv=setInterval(()=>{ n--; cd.textContent=`Next round in ${n}...`; if(n<=0){ clearInterval(iv); this.nextRound(); } },1000);
  }
  nextRound(){
    this.round++; this.setupRound(); this.updateHUDStatic();
    this.show('game-screen'); this.running=true; this.last=performance.now();
    requestAnimationFrame(t=>this.loop(t)); Audio.bell();
    this.banner(`ROUND ${this.round}`,1300);
  }
  finish(winner,loser,method){
    if(!this.running) return;
    this.running=false; Audio.crowd(1); Audio.bell();
    this.flashScreen=1; winner.roundsWon=99;
    this.showResult(winner,loser,method);
  }
  decision(){
    this.running=false;
    const p1=this.p1,p2=this.p2;
    const winner=p1.roundsWon>=p2.roundsWon?p1:p2;
    this.showResult(winner,winner===p1?p2:p1,p1.roundsWon===p2.roundsWon?'DRAW':'DECISION');
  }
  showResult(winner,loser,method){
    const mLbl={KO:'KNOCKOUT',TKO:'TECHNICAL KNOCKOUT',SUBMISSION:'SUBMISSION',DECISION:'UNANIMOUS DECISION',DRAW:'DRAW'};
    document.getElementById('result-method').textContent=mLbl[method]||method;
    document.getElementById('result-winner').textContent=method==='DRAW'?'DRAW':winner.name;
    document.getElementById('result-detail').textContent=
      (method==='DECISION'||method==='DRAW')
        ?`${this.p1.name} ${this.p1.roundsWon} — ${this.p2.roundsWon} ${this.p2.name}`
        :`Round ${this.round} of ${this.maxRounds} · ${this.fmtClock()}`;
    const hl=document.getElementById('highlight-reel');
    const items=this.highlights.slice(-6);
    hl.innerHTML='<div style="color:var(--gold);font-size:12px;letter-spacing:2px;margin-bottom:6px">HIGHLIGHT REEL</div>'
      +(items.length?items.map(h=>`<div>• ${h}</div>`).join(''):'<div>• A back-and-forth war.</div>');
    this.show('result-screen');
  }

  /* ═══════════════ HUD LIVE ═══════════════ */
  updateHUDLive(){
    const hp1=Math.max(0,this.p1.health), hp2=Math.max(0,this.p2.health);
    document.getElementById('p1-health').style.width=hp1+'%';
    document.getElementById('p2-health').style.width=hp2+'%';
    document.getElementById('p1-stamina').style.width=Math.max(0,this.p1.stamina)+'%';
    document.getElementById('p2-stamina').style.width=Math.max(0,this.p2.stamina)+'%';
    document.getElementById('p1-health').style.background=hp1<25?'linear-gradient(90deg,#ff3300,#aa0000)':'';
    document.getElementById('p2-health').style.background=hp2<25?'linear-gradient(90deg,#ff3300,#aa0000)':'';
    document.getElementById('clock').textContent=this.fmtClock();
  }
  fmtClock(){ const m=Math.floor(this.timeLeft/60),s=this.timeLeft%60; return `${m}:${s<10?'0':''}${s}`; }

  /* ═══════════════ RENDER ═══════════════ */
  render(){
    const ctx=this.ctx;
    ctx.save();
    if(this.shake>0.5) ctx.translate((Math.random()-0.5)*this.shake,(Math.random()-0.5)*this.shake);
    this.drawArena(ctx);
    this.drawShadow(ctx,this.p1); this.drawShadow(ctx,this.p2);
    const order=[this.p1,this.p2].sort((a,b)=>a.y-b.y);
    for(const f of order) this.drawFighter(ctx,f);
    this.drawImpacts(ctx);
    for(const p of this.particles) p.draw(ctx);
    ctx.restore();
    if(this.flashScreen>0.02){ ctx.fillStyle=`rgba(255,255,255,${this.flashScreen*0.55})`; ctx.fillRect(0,0,this.W,this.H); }
  }

  /* ─ Arena ─ */
  drawArena(ctx){
    // BG
    const g=ctx.createLinearGradient(0,0,0,this.H);
    g.addColorStop(0,'#08080f'); g.addColorStop(1,'#040408');
    ctx.fillStyle=g; ctx.fillRect(0,0,this.W,this.H);

    // crowd
    for(const c of this.crowd){
      const x=c.x%(this.W+40); const fl=0.5+0.5*Math.sin(this.frame*0.05+c.fl);
      ctx.fillStyle=`rgb(${c.sh},${c.sh},${c.sh+5})`;
      ctx.beginPath(); ctx.arc(x,c.y,c.s*0.44,0,Math.PI*2); ctx.fill();
      ctx.fillRect(x-c.s*0.38,c.y,c.s*0.76,c.s*1.05);
    }

    // spotlights
    [[this.W*0.25,'255,255,255'],[this.W*0.5,'255,240,210'],[this.W*0.75,'255,255,255']].forEach(([sx,rgb])=>{
      const sg=ctx.createRadialGradient(sx,-40,10,sx,this.H*0.45,this.H*0.95);
      sg.addColorStop(0,`rgba(${rgb},0.09)`); sg.addColorStop(1,`rgba(${rgb},0)`);
      ctx.fillStyle=sg;
      ctx.beginPath(); ctx.moveTo(sx,-20); ctx.lineTo(sx-280,this.H); ctx.lineTo(sx+280,this.H); ctx.closePath(); ctx.fill();
    });

    // cage mesh
    ctx.save(); ctx.globalAlpha=0.22; ctx.strokeStyle='#3a3e48'; ctx.lineWidth=1;
    for(let x=0;x<this.W+40;x+=28){ ctx.beginPath(); ctx.moveTo(x,130); ctx.lineTo(x-28,290); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x,130); ctx.lineTo(x+28,290); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle='#1e2128'; ctx.fillRect(100,135,18,190); ctx.fillRect(this.W-118,135,18,190);

    // mat
    this.drawMat(ctx);
  }

  drawMat(ctx){
    const cx=this.W/2, cy=this.groundY+20, rx=this.W*0.44, ry=this.H*0.22;
    const pts=[]; for(let i=0;i<8;i++){ const a=Math.PI/8+i*Math.PI/4; pts.push([cx+Math.cos(a)*rx,cy+Math.sin(a)*ry]); }
    ctx.save(); ctx.beginPath();
    pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
    ctx.closePath();
    const mg=ctx.createRadialGradient(cx,cy-30,30,cx,cy,rx);
    mg.addColorStop(0,'#d4b870'); mg.addColorStop(0.6,'#c4a860'); mg.addColorStop(1,'#9a7e40');
    ctx.fillStyle=mg; ctx.fill();
    ctx.strokeStyle='#5a4620'; ctx.lineWidth=10; ctx.stroke(); ctx.clip();
    ctx.strokeStyle='rgba(110,88,40,0.45)'; ctx.lineWidth=1.5;
    for(let i=0;i<16;i++){ const a=i*Math.PI/8; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*rx*1.2,cy+Math.sin(a)*ry*1.4); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(cx,cy,rx*0.18,ry*0.2,0,0,Math.PI*2);
    ctx.strokeStyle='rgba(80,60,20,0.7)'; ctx.lineWidth=4; ctx.stroke();
    ctx.fillStyle='rgba(212,35,44,0.15)'; ctx.fill();
    ctx.fillStyle='rgba(80,60,20,0.6)'; ctx.font=`bold ${Math.round(this.W*0.018)}px Arial Black`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('OCTAGON',cx,cy);
    ctx.restore();
    // ground shadow
    const sh=ctx.createLinearGradient(0,this.groundY,0,this.groundY+60);
    sh.addColorStop(0,'rgba(0,0,0,0.5)'); sh.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=sh; ctx.fillRect(0,this.groundY,this.W,60);
  }

  drawShadow(ctx,f){
    ctx.save(); ctx.fillStyle='rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(f.x,f.y+8,56,13,0,0,Math.PI*2); ctx.fill(); ctx.restore();
  }

  drawFighter(ctx,f){
    ctx.save(); ctx.translate(f.x,f.y);
    if(f.hitFlash>0&&Math.floor(Date.now()/60)%2===0) ctx.globalAlpha=0.55;
    drawFighterBody(ctx,f,this.frame,this.groundY);
    ctx.restore();
  }

  drawImpacts(ctx){
    for(const im of this.impacts){
      ctx.save(); ctx.globalAlpha=im.life; ctx.translate(im.x,im.y);
      const r=(1-im.life)*32*im.scale+5;
      ctx.strokeStyle='#fff'; ctx.lineWidth=2.5*im.life;
      for(let i=0;i<6;i++){ const a=i*Math.PI/3; ctx.beginPath(); ctx.moveTo(Math.cos(a)*r*0.38,Math.sin(a)*r*0.38); ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r); ctx.stroke(); }
      ctx.fillStyle=`rgba(255,215,120,${im.life*0.55})`; ctx.beginPath(); ctx.arc(0,0,r*0.48,0,Math.PI*2); ctx.fill();
      ctx.restore(); im.life-=0.075;
    }
    this.impacts=this.impacts.filter(i=>i.life>0);
  }
}

/* ═══════════════════════════════════════════════════════
   FIGHTER BODY DRAWING  — realistic MMA athlete
   Origin = fighter feet (0,0), body goes upward.
   ═══════════════════════════════════════════════════════ */
function drawFighterBody(ctx, f, frame, groundY){
  const d=f.data;
  ctx.save();
  ctx.scale(f.facing, 1);   // flip to face direction

  const S   = d.skin;
  const SD  = shade(S,-32); // dark shadow
  const SM  = shade(S,-15); // mid tone
  const SL  = shade(S,22);  // light highlight
  const shorts = d.shorts;
  const SD2 = shade(shorts,-40);
  const trim  = d.trim;

  // pose params
  let leanFwd=0, crouch=0, armEx=0, kickUp=0, spin=0;
  let prog=0;
  const mv=f.currentMove;
  if(mv&&f.attackTimer>0) prog=(mv.dur-f.attackTimer)/mv.dur;
  const p=mv?Math.sin(prog*Math.PI):0; // 0→1→0

  const grounded=(f.state===ST.TOP||f.state===ST.BOT||f.state===ST.DOWN||f.state===ST.GETUP);
  if(grounded){ drawGrounded(ctx,f,d,S,SD,SM,SL,shorts,SD2,trim); ctx.restore(); return; }

  let wob=0;
  if(f.state===ST.STAGGER){ wob=Math.sin(frame*0.5)*7; crouch=12; }

  const breath=Math.sin(f.breathe)*2.2;

  if(mv){
    switch(mv.label){
      case 'JAB':       armEx=p*52; leanFwd=p*6; break;
      case 'CROSS':     armEx=p*68; leanFwd=p*9; break;
      case 'DIRTY BOXING': armEx=p*44; leanFwd=p*5; break;
      case 'HOOK':      armEx=p*38; leanFwd=p*7; spin=p*0.12; break;
      case 'UPPERCUT':  armEx=p*32; crouch+=p*16; break;
      case 'BODY KICK': kickUp=p*52; leanFwd=-p*5; break;
      case 'HEAD KICK': kickUp=p*118; leanFwd=-p*11; break;
      case 'SPINNING KICK': spin=prog*Math.PI*2; kickUp=p*88; break;
      case 'KNEE':      kickUp=p*65; leanFwd=p*9; break;
    }
  }

  ctx.translate(wob,0);

  /* ── feet Y (above canvas feet = y=0 means canvas groundY) ── */
  const footY  = -2;
  const hipY   = -105 - crouch + breath*0.4;
  const torsoH = 74;
  const shoulderY = hipY - torsoH;
  const neckY  = shoulderY - 4;

  /* ── legs ── */
  const legGait=Math.sin(f.legPhase)*9;
  drawLeg(ctx, 14, hipY, -8+legGait, S,SD,SM, footY, d.body);   // rear leg
  if(kickUp>0) drawKickLeg(ctx,-6,hipY,kickUp,S,SD,SM,trim);
  else         drawLeg(ctx,-16,hipY,  6-legGait,S,SD,SM,footY,d.body); // front leg

  /* ── shorts & belt ── */
  ctx.save();
  const sg=ctx.createLinearGradient(-28,hipY-2,28,hipY+44);
  sg.addColorStop(0,shade(shorts,14)); sg.addColorStop(0.6,shorts); sg.addColorStop(1,SD2);
  ctx.fillStyle=sg;
  rr(ctx,-28,hipY-4,56,50,9); ctx.fill();
  // waistband
  const wg=ctx.createLinearGradient(-28,hipY-4,28,hipY-4);
  wg.addColorStop(0,shade(trim,-20)); wg.addColorStop(0.5,trim); wg.addColorStop(1,shade(trim,-20));
  ctx.fillStyle=wg; ctx.fillRect(-28,hipY-4,56,9);
  // side stripe
  ctx.fillStyle=shade(trim,-10); ctx.fillRect(16,hipY+4,6,38);
  ctx.restore();

  /* ── torso ── */
  ctx.save();
  ctx.translate(0,hipY); ctx.rotate(leanFwd*0.012);
  // main body
  const tg=ctx.createLinearGradient(-30,0,34,-torsoH);
  tg.addColorStop(0,SD); tg.addColorStop(0.35,SM); tg.addColorStop(0.7,S); tg.addColorStop(1,SL);
  ctx.fillStyle=tg;
  ctx.beginPath();
  ctx.moveTo(-22,2);
  ctx.bezierCurveTo(-32,-torsoH*0.3,-28,-torsoH+4,-18,-torsoH);
  ctx.bezierCurveTo(-4,-torsoH-10,8,-torsoH-8,20,-torsoH+4);
  ctx.bezierCurveTo(34,-torsoH*0.3,30,-torsoH*0.1,24,4);
  ctx.closePath(); ctx.fill();
  // pec definition
  ctx.strokeStyle=`rgba(0,0,0,0.2)`; ctx.lineWidth=2;
  // sternum line
  ctx.beginPath(); ctx.moveTo(2,-torsoH+6); ctx.lineTo(2,-torsoH*0.35); ctx.stroke();
  // pec arcs
  ctx.beginPath(); ctx.moveTo(2,-torsoH+8); ctx.quadraticCurveTo(18,-torsoH+14,22,-torsoH*0.5); ctx.stroke();
  // abs
  for(let i=0;i<3;i++){
    const ay=-torsoH*0.38+i*13;
    ctx.beginPath(); ctx.moveTo(2,ay); ctx.bezierCurveTo(8,ay-2,14,ay-2,20,ay); ctx.stroke();
  }
  // oblique shadow
  ctx.fillStyle='rgba(0,0,0,0.1)';
  ctx.beginPath(); ctx.moveTo(-20,-2); ctx.lineTo(-26,-torsoH*0.5); ctx.lineTo(-18,-torsoH*0.6); ctx.lineTo(-14,-2); ctx.closePath(); ctx.fill();
  // pec highlight
  ctx.fillStyle='rgba(255,255,255,0.1)';
  ctx.beginPath(); ctx.ellipse(14,-torsoH+20,9,6,0.35,0,Math.PI*2); ctx.fill();
  // deltoid cap highlight
  ctx.beginPath(); ctx.ellipse(22,-torsoH+6,5,8,0.2,0,Math.PI*2); ctx.fill();
  // nipple hints
  ctx.fillStyle=`rgba(0,0,0,0.15)`;
  ctx.beginPath(); ctx.arc(12,-torsoH*0.4,1.8,0,Math.PI*2); ctx.fill();
  // tattoos
  if(d.tattoo&&d.tattoo.includes('chest')){
    ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1.2;
    for(let i=0;i<4;i++){ const ty=-torsoH*0.55+i*8; ctx.beginPath(); ctx.moveTo(2,ty); ctx.bezierCurveTo(8,ty-3,16,ty-3,22,ty); ctx.stroke(); }
  }
  ctx.restore();

  /* ── trapezius / neck base ── */
  ctx.save();
  ctx.fillStyle=SD;
  ctx.beginPath();
  ctx.moveTo(-18,shoulderY+4);
  ctx.bezierCurveTo(-22,shoulderY-2,-12,neckY+2,-8,neckY);
  ctx.bezierCurveTo(-2,neckY-6,4,neckY-6,8,neckY);
  ctx.bezierCurveTo(12,neckY+2,22,shoulderY-2,18,shoulderY+4);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  /* ── rear arm ── */
  drawArm(ctx,16,shoulderY,true,armEx*0.28,mv,S,SD,SM,trim,d.tattoo,leanFwd);
  /* ── head ── */
  drawHead(ctx,6,neckY,S,SD,SM,SL,d,f,leanFwd);
  /* ── front arm ── */
  drawArm(ctx,-8,shoulderY+4,false,armEx,mv,S,SD,SM,trim,d.tattoo,leanFwd);

  ctx.restore();

  // cosmetic damage overlay
  if(f.cuts.length>0||f.swelling>0) drawDamage(ctx,f);
}

/* ─── REALISTIC HEAD ─── */
function drawHead(ctx,x,y,S,SD,SM,SL,d,f,lean){
  ctx.save();
  ctx.translate(x+lean*0.18,y);

  // neck
  const ng=ctx.createLinearGradient(-9,0,10,0);
  ng.addColorStop(0,SD); ng.addColorStop(0.5,SM); ng.addColorStop(1,SD);
  ctx.fillStyle=ng;
  ctx.beginPath(); ctx.moveTo(-9,2); ctx.bezierCurveTo(-11,8,-10,18,-8,20); ctx.lineTo(8,20); ctx.bezierCurveTo(10,18,11,8,9,2); ctx.closePath(); ctx.fill();
  // sternocleidomastoid muscle line
  ctx.strokeStyle=`rgba(0,0,0,0.18)`; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(7,18); ctx.bezierCurveTo(10,10,12,-2,10,-8); ctx.stroke();

  // skull shape — more realistic box/oval
  const hg=ctx.createLinearGradient(-18,-44,18,4);
  hg.addColorStop(0,SD); hg.addColorStop(0.25,SM); hg.addColorStop(0.6,S); hg.addColorStop(1,SL);
  ctx.fillStyle=hg;
  ctx.beginPath();
  ctx.moveTo(-12,-1);                              // jaw left
  ctx.bezierCurveTo(-17,-8,-18,-22,-15,-32);       // cheek / temple
  ctx.bezierCurveTo(-14,-42,-4,-48,6,-48);         // crown back
  ctx.bezierCurveTo(16,-48,22,-44,22,-34);         // crown front
  ctx.bezierCurveTo(23,-26,22,-16,18,-8);          // forehead / brow ridge
  ctx.bezierCurveTo(16,-2,14,4,10,6);              // nose / jaw front
  ctx.bezierCurveTo(4,10,-4,8,-8,4);               // chin
  ctx.closePath(); ctx.fill();

  // jaw shadow
  ctx.fillStyle='rgba(0,0,0,0.1)';
  ctx.beginPath(); ctx.moveTo(-12,-1); ctx.bezierCurveTo(-8,6,-4,10,4,8); ctx.bezierCurveTo(0,4,-6,2,-12,-1); ctx.closePath(); ctx.fill();

  // HAIR
  if(d.hair!=='bald'){
    const hcol=d.hairCol||'#15100c';
    ctx.fillStyle=hcol;
    if(d.hair==='shaved'){
      // very close-cut — slight color on skull top
      ctx.globalAlpha=0.4;
      ctx.beginPath(); ctx.moveTo(-15,-22); ctx.bezierCurveTo(-16,-42,-4,-50,6,-50); ctx.bezierCurveTo(16,-50,23,-44,22,-32); ctx.bezierCurveTo(8,-36,-4,-34,-15,-22); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=1;
    } else if(d.hair==='fade'){
      ctx.beginPath(); ctx.moveTo(-15,-20); ctx.bezierCurveTo(-17,-40,-4,-50,6,-50); ctx.bezierCurveTo(18,-50,23,-42,21,-30); ctx.bezierCurveTo(12,-36,2,-34,-15,-20); ctx.closePath(); ctx.fill();
    } else { // 'short'
      ctx.beginPath(); ctx.moveTo(-15,-18); ctx.bezierCurveTo(-18,-42,-4,-50,6,-50); ctx.bezierCurveTo(18,-50,24,-44,22,-30); ctx.bezierCurveTo(14,-36,2,-32,-6,-28); ctx.bezierCurveTo(-10,-26,-14,-22,-15,-18); ctx.closePath(); ctx.fill();
    }
    // hair highlight
    ctx.fillStyle='rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.ellipse(4,-42,8,5,0.3,0,Math.PI*2); ctx.fill();
  } else {
    // bald head shine
    ctx.fillStyle='rgba(255,255,255,0.07)';
    ctx.beginPath(); ctx.ellipse(4,-40,9,5,0.3,0,Math.PI*2); ctx.fill();
  }

  // ear
  ctx.fillStyle=SM;
  ctx.beginPath(); ctx.ellipse(-15,-20,5,8,-0.15,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=SD;
  ctx.beginPath(); ctx.ellipse(-15,-20,3,5,-0.15,0,Math.PI*2); ctx.fill();
  // inner ear highlight
  ctx.strokeStyle=S; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.arc(-15,-20,3,-0.8,1.6); ctx.stroke();

  // eyebrow
  const browCol=d.hairCol||'#15100c';
  ctx.fillStyle=browCol; ctx.globalAlpha=0.85;
  ctx.beginPath(); ctx.moveTo(8,-30); ctx.bezierCurveTo(11,-33,17,-33,21,-30); ctx.bezierCurveTo(17,-28,11,-28,8,-30); ctx.closePath(); ctx.fill();
  ctx.globalAlpha=1;

  // eye socket shadow
  ctx.fillStyle='rgba(0,0,0,0.14)';
  ctx.beginPath(); ctx.ellipse(14,-26,7,5,0,0,Math.PI*2); ctx.fill();
  // eye white
  ctx.fillStyle='#f0f0e8';
  ctx.beginPath(); ctx.ellipse(14,-25.5,4,2.8,0,0,Math.PI*2); ctx.fill();
  // iris
  const eyeCol=d.eyeCol||'#3d2b1c';
  ctx.fillStyle=eyeCol;
  ctx.beginPath(); ctx.arc(14.5,-25.5,2.2,0,Math.PI*2); ctx.fill();
  // pupil
  ctx.fillStyle='#060606';
  ctx.beginPath(); ctx.arc(14.5,-25.5,1.2,0,Math.PI*2); ctx.fill();
  // highlight
  ctx.fillStyle='rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.arc(15.4,-26.4,0.8,0,Math.PI*2); ctx.fill();
  // upper eyelid crease
  ctx.strokeStyle=shade(S,-22); ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(10,-27.5); ctx.bezierCurveTo(13,-29.5,17,-29,21,-27); ctx.stroke();
  // lower lid
  ctx.beginPath(); ctx.moveTo(10,-23.5); ctx.bezierCurveTo(13,-22,18,-22,21,-23.5); ctx.stroke();

  // nose bridge
  ctx.strokeStyle=SM; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(20,-26); ctx.bezierCurveTo(22,-20,20,-14,17,-10); ctx.stroke();
  // nostril
  ctx.fillStyle=SD;
  ctx.beginPath(); ctx.ellipse(16,-9,3,2,0.4,0,Math.PI*2); ctx.fill();
  // nose tip
  ctx.fillStyle=SM; ctx.beginPath(); ctx.arc(17,-10,2.5,0,Math.PI*2); ctx.fill();

  // lip area
  const lc=shade(S,-18);
  // upper lip
  ctx.fillStyle=lc;
  ctx.beginPath(); ctx.moveTo(8,-5); ctx.bezierCurveTo(10,-6,12,-7,13.5,-6); ctx.bezierCurveTo(15,-7,17,-6,18,-5); ctx.bezierCurveTo(16,-3,10,-3,8,-5); ctx.closePath(); ctx.fill();
  // lower lip
  ctx.fillStyle=shade(S,-12);
  ctx.beginPath(); ctx.moveTo(9,-3); ctx.bezierCurveTo(13,-0,17,0,18,-3); ctx.bezierCurveTo(16,-1,10,-1,9,-3); ctx.closePath(); ctx.fill();
  // lip line
  ctx.strokeStyle=shade(S,-28); ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(9,-4.5); ctx.bezierCurveTo(13,-3.5,15,-3.5,18,-4.5); ctx.stroke();

  // mouthguard hint (just peeking)
  ctx.fillStyle='rgba(220,240,255,0.4)';
  ctx.beginPath(); ctx.moveTo(10,-3); ctx.bezierCurveTo(13,-1.5,16,-1.5,18,-3); ctx.bezierCurveTo(16,-2.5,11,-2.5,10,-3); ctx.closePath(); ctx.fill();

  // chin crease
  ctx.strokeStyle=SD; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(8,4); ctx.bezierCurveTo(11,7,14,6,16,4); ctx.stroke();

  // beard
  if(d.beard==='beard'||d.beard==='stubble'||d.beard==='mustache'){
    const bAlpha=d.beard==='beard'?0.55:0.3;
    ctx.fillStyle=d.hairCol||'#15100c'; ctx.globalAlpha=bAlpha;
    if(d.beard==='mustache'){
      ctx.beginPath(); ctx.moveTo(8,-6); ctx.bezierCurveTo(10,-8,16,-8,18,-6); ctx.bezierCurveTo(16,-5,10,-5,8,-6); ctx.closePath(); ctx.fill();
    } else {
      // chin beard / stubble
      ctx.beginPath(); ctx.ellipse(12,2,7,5,0,0,Math.PI*2); ctx.fill();
      if(d.beard==='beard'){
        ctx.beginPath(); ctx.moveTo(6,-5); ctx.bezierCurveTo(8,-8,18,-8,19,-5); ctx.bezierCurveTo(18,-4,8,-4,6,-5); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.ellipse(12,5,8,6,0,0,Math.PI*2); ctx.fill();
      }
    }
    ctx.globalAlpha=1;
  }

  // swelling eye
  if(f.swelling>0.3){
    ctx.fillStyle=`rgba(130,40,40,${Math.min(0.55,f.swelling*0.6)})`;
    ctx.beginPath(); ctx.ellipse(16,-27,6,4,0,0,Math.PI*2); ctx.fill();
  }

  ctx.restore();
}

/* ─── ARM ─── */
function drawArm(ctx,sx,sy,rear,extend,mv,S,SD,SM,trim,tattoos,lean){
  ctx.save();
  ctx.translate(sx,sy);
  const baseW = rear ? 12 : 13;
  let ex=0, ey=0;

  if(extend>2){
    ex=16+extend; ey=-5-lean*0.1;
    // upper arm
    ctx.strokeStyle=rear?SD:SM; ctx.lineWidth=rear?12:13; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(ex*0.5,ey-3); ctx.stroke();
    // forearm
    ctx.lineWidth=rear?10:11; ctx.strokeStyle=rear?SM:S;
    ctx.beginPath(); ctx.moveTo(ex*0.5,ey-3); ctx.lineTo(ex,ey); ctx.stroke();
  } else {
    // guard position
    ex = rear?10:8; ey=rear?-22:-12;
    ctx.strokeStyle=rear?SD:SM; ctx.lineWidth=rear?12:13; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(ex-5,ey+14); ctx.stroke();
    ctx.lineWidth=rear?10:11; ctx.strokeStyle=rear?SM:S;
    ctx.beginPath(); ctx.moveTo(ex-5,ey+14); ctx.lineTo(ex,ey); ctx.stroke();
  }

  // muscle highlight
  ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(0,-2); ctx.lineTo(ex*(extend>2?0.45:0.4),ey+2); ctx.stroke();

  // forearm wrist wrap
  if(extend>2){
    ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(ex-8,ey-1); ctx.lineTo(ex-4,ey); ctx.stroke();
  }

  // tattoo
  if(tattoos&&tattoos.includes(rear?'rightArm':'leftArm')){
    ctx.strokeStyle='rgba(0,0,0,0.22)'; ctx.lineWidth=1.2;
    for(let t=0;t<3;t++){ const ty=ey+t*10-5; ctx.beginPath(); ctx.moveTo(ex*0.3,ty); ctx.bezierCurveTo(ex*0.5,ty-3,ex*0.7,ty-3,ex*0.85,ty); ctx.stroke(); }
  }

  drawGlove(ctx,ex,ey,trim);
  ctx.restore();
}

/* ─── GLOVE (realistic open-finger MMA glove) ─── */
function drawGlove(ctx,x,y,trim){
  ctx.save(); ctx.translate(x,y);
  // wrist / back of hand
  ctx.fillStyle='#18181e';
  ctx.beginPath(); ctx.ellipse(0,0,10,9,-0.1,0,Math.PI*2); ctx.fill();
  // padded knuckle area
  ctx.fillStyle='#252530';
  ctx.beginPath(); ctx.ellipse(4,-2,7,6,0,0,Math.PI*2); ctx.fill();
  // velcro / back strap
  ctx.fillStyle='#14141a';
  ctx.beginPath(); ctx.roundRect(-8,-6,16,5,2); ctx.fill();
  // strap texture
  ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1;
  for(let i=0;i<4;i++){ ctx.beginPath(); ctx.moveTo(-7+i*4,-5); ctx.lineTo(-7+i*4,-2); ctx.stroke(); }
  // open finger tabs
  ctx.fillStyle='#18181e';
  for(let i=0;i<4;i++){ ctx.beginPath(); ctx.ellipse(8-i*2.5,-4+i*2.8,2.2,1.6,0,0,Math.PI*2); ctx.fill(); }
  // trim color
  ctx.strokeStyle=trim; ctx.lineWidth=1.8;
  ctx.beginPath(); ctx.arc(-2,2,7,-0.5,2.3); ctx.stroke();
  // knuckle sheen
  ctx.fillStyle='rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.ellipse(5,-3,4,2.5,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

/* ─── LEG ─── */
function drawLeg(ctx,hx,hipY,kneeOff,S,SD,SM,footY,bodyType){
  ctx.save(); ctx.lineCap='round';
  const kneeX=hx+kneeOff*0.5, kneeY=hipY+52;
  const ankleX=hx+kneeOff, ankleY=footY||-4;
  const thickThigh = bodyType==='massive'||bodyType==='stocky' ? 22 : 18;
  const thickShin  = thickThigh - 5;
  // thigh
  ctx.lineWidth=thickThigh; ctx.strokeStyle=shade(S,-8);
  ctx.beginPath(); ctx.moveTo(hx,hipY+26); ctx.lineTo(kneeX,kneeY); ctx.stroke();
  // thigh highlight
  ctx.lineWidth=5; ctx.strokeStyle='rgba(255,255,255,0.09)';
  ctx.beginPath(); ctx.moveTo(hx-2,hipY+30); ctx.lineTo(kneeX-2,kneeY-8); ctx.stroke();
  // knee cap
  ctx.fillStyle=SM; ctx.beginPath(); ctx.arc(kneeX,kneeY,8,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=SD; ctx.beginPath(); ctx.arc(kneeX+2,kneeY+2,5,0,Math.PI*2); ctx.fill();
  // shin
  ctx.lineWidth=thickShin; ctx.strokeStyle=S;
  ctx.beginPath(); ctx.moveTo(kneeX,kneeY+4); ctx.lineTo(ankleX,ankleY); ctx.stroke();
  // shin highlight
  ctx.lineWidth=3; ctx.strokeStyle='rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.moveTo(kneeX-1,kneeY+6); ctx.lineTo(ankleX-1,ankleY+3); ctx.stroke();
  // foot
  ctx.fillStyle=SD;
  ctx.beginPath(); ctx.ellipse(ankleX+5,ankleY+5,13,6,0.1,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=SM; ctx.beginPath(); ctx.ellipse(ankleX+6,ankleY+4,8,4,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

/* ─── KICK LEG ─── */
function drawKickLeg(ctx,hx,hipY,height,S,SD,SM,trim){
  ctx.save(); ctx.lineCap='round';
  const ang=-height*0.011;
  const kneeX=hx+28+height*0.22, kneeY=hipY+28-height*0.38;
  const footX=kneeX+34+height*0.22, footY=kneeY-height*0.28;
  ctx.lineWidth=19; ctx.strokeStyle=shade(S,-8);
  ctx.beginPath(); ctx.moveTo(hx,hipY+24); ctx.lineTo(kneeX,kneeY); ctx.stroke();
  ctx.lineWidth=5; ctx.strokeStyle='rgba(255,255,255,0.09)';
  ctx.beginPath(); ctx.moveTo(hx-2,hipY+28); ctx.lineTo(kneeX-2,kneeY-4); ctx.stroke();
  ctx.lineWidth=14; ctx.strokeStyle=S;
  ctx.beginPath(); ctx.moveTo(kneeX,kneeY); ctx.lineTo(footX,footY); ctx.stroke();
  // shin guard shine
  ctx.lineWidth=3; ctx.strokeStyle='rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.moveTo(kneeX,kneeY+2); ctx.lineTo(footX-3,footY+2); ctx.stroke();
  ctx.fillStyle=SD; ctx.beginPath(); ctx.ellipse(footX,footY,12,6,ang,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

/* ─── GROUNDED (takedown position) ─── */
function drawGrounded(ctx,f,d,S,SD,SM,SL,shorts,SD2,trim){
  ctx.save();
  const top=(f.state===ST.TOP);
  ctx.translate(0,top?-72:-36);

  // ground body
  ctx.save(); ctx.rotate(top?-0.14:0.1);
  const bg=ctx.createLinearGradient(-55,-22,55,24);
  bg.addColorStop(0,SD); bg.addColorStop(0.5,S); bg.addColorStop(1,SD);
  ctx.fillStyle=bg; rr(ctx,-52,-24,104,48,14); ctx.fill();
  ctx.fillStyle=shorts; rr(ctx,-56,-4,46,34,8); ctx.fill();
  ctx.fillStyle=trim; ctx.fillRect(-56,26,46,5);
  ctx.restore();

  // legs
  ctx.strokeStyle=S; ctx.lineWidth=15; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-38,16); ctx.bezierCurveTo(-60,24,-80,30,-88,38); ctx.stroke();
  ctx.strokeStyle=shade(S,-10);
  ctx.beginPath(); ctx.moveTo(-38,22); ctx.bezierCurveTo(-58,38,-72,50,-78,60); ctx.stroke();

  // head
  const hg=ctx.createLinearGradient(-10,-36,10,-10);
  hg.addColorStop(0,SD); hg.addColorStop(0.6,S); hg.addColorStop(1,SL);
  ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(42,-20,18,0,Math.PI*2); ctx.fill();
  if(d.hair!=='bald'){
    ctx.fillStyle=d.hairCol||'#15100c';
    ctx.beginPath(); ctx.arc(40,-28,17,Math.PI,Math.PI*2); ctx.fill();
  }
  // arm GnP
  let pch=0;
  if(top&&f.currentMove&&f.attackTimer>0) pch=Math.sin((f.currentMove.dur-f.attackTimer)/f.currentMove.dur*Math.PI)*34;
  ctx.strokeStyle=SD; ctx.lineWidth=13;
  ctx.beginPath(); ctx.moveTo(18,-18); ctx.lineTo(44,-28+(top?-pch:0)); ctx.stroke();
  drawGlove(ctx,48,-30+(top?-pch:0),trim);

  // getup arc
  if(f.state===ST.GETUP){
    ctx.strokeStyle='#ffd34d'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(0,-52,28,-Math.PI/2,-Math.PI/2+(f.getupHold/60)*Math.PI*2); ctx.stroke();
    ctx.fillStyle='rgba(255,211,77,0.2)';
    ctx.beginPath(); ctx.arc(0,-52,28,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

/* ─── COSMETIC DAMAGE ─── */
function drawDamage(ctx,f){
  ctx.save();
  for(const cut of f.cuts){
    ctx.fillStyle='rgba(150,18,18,0.88)';
    ctx.beginPath(); ctx.ellipse(cut.ox*f.facing,cut.oy,cut.size,cut.size*0.45,0.5,0,Math.PI*2); ctx.fill();
    ctx.fillRect(cut.ox*f.facing-0.8,cut.oy,1.6,cut.size*2.2);
  }
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════
   MINI PORTRAIT  (for HUD / roster / cards)
   ═══════════════════════════════════════════════════════ */
function drawMiniPortrait(ctx, f, sz){
  ctx.clearRect(0,0,sz,sz);
  const bg=ctx.createLinearGradient(0,0,0,sz);
  bg.addColorStop(0,'#1a1b26'); bg.addColorStop(1,'#0d0d16');
  ctx.fillStyle=bg; ctx.fillRect(0,0,sz,sz);

  ctx.save(); ctx.translate(sz/2, sz*1.02); ctx.scale(sz/130,sz/130);
  const dummy=new Fighter(f, -1); dummy.facing=1;
  const gY=100;
  dummy.state=ST.STAND; dummy.currentMove=null; dummy.attackTimer=0;
  dummy.breathe=0; dummy.cuts=[]; dummy.swelling=0;
  drawFighterBody(ctx, dummy, 0, gY);
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════ */
function rr(ctx,x,y,w,h,r){
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function shade(hex,amt){
  let h=hex.replace('#','');
  if(h.length===3) h=h.split('').map(c=>c+c).join('');
  let r=parseInt(h.substr(0,2),16), g=parseInt(h.substr(2,2),16), b=parseInt(h.substr(4,2),16);
  r=Math.max(0,Math.min(255,r+amt)); g=Math.max(0,Math.min(255,g+amt)); b=Math.max(0,Math.min(255,b+amt));
  return `rgb(${r|0},${g|0},${b|0})`;
}

/* ═══════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded',()=>{ window.GAME=new Game(); });
