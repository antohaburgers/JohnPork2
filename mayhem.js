/* INDUSTRIAL MAYHEM / 4.0. Core movement remains the tested 3.8 controller. */
(()=>{
const el=id=>document.getElementById(id);
const original={start:Game.prototype.start,update:Game.prototype.update,kill:Game.prototype.kill,fire:Game.prototype.fire,end:Game.prototype.end,upgrades:Game.prototype.showUpgrades,draw:Game.prototype.draw,background:Game.prototype.drawBackground,enemyUpdate:Enemy.prototype.update,enemyDraw:Enemy.prototype.draw,playerUpdate:Player.prototype.update};
const safeGet=(k,f='0')=>{try{return localStorage.getItem(k)||f}catch{return f}};
const safeSet=(k,v)=>{try{localStorage.setItem(k,String(v))}catch{}};
let kit=safeGet('porkKit','assault'),muted=false;
const tones=(freq=170,duration=.15)=>{if(!audioCtx||muted)return;const o=audioCtx.createOscillator(),v=audioCtx.createGain(),t=audioCtx.currentTime;o.type='triangle';o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(freq*.45,t+duration);v.gain.setValueAtTime(.13,t);v.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(v).connect(audioCtx.destination);o.start(t);o.stop(t+duration);};
function ring(g,x,y,r,color){g.rings.push({x,y,r,color,life:.55,max:.55});}
function note(g,text,x,y,color='#f6df84'){g.floaters.push({text,x,y,color,life:1.2});}
function announce(g,title,text){g.banner=1.8;g.bannerTitle=title;g.bannerText=text;}
const baseGunSound=gunSound;gunSound=function(n){if(!muted)baseGunSound(n)};
const baseAudio=startAudio;startAudio=function(){try{baseAudio()}catch{/* Audio never blocks the game. */}};
music.addEventListener('error',()=>{if(music.src.endsWith('music.mp3')){music.src='industrial.wav';music.load();if(game.state==='play')music.play().catch(()=>{});}});
for(const b of document.querySelectorAll('[data-kit]')){b.classList.toggle('selected',b.dataset.kit===kit);b.onclick=()=>{kit=b.dataset.kit;safeSet('porkKit',kit);for(const other of document.querySelectorAll('[data-kit]'))other.classList.toggle('selected',other===b);};}

// Permanent build choices survive weapon changes; basic weapon upgrades still reset.
upgradePool.push(
 {name:'ДРОН «ХРЮ-1»',desc:'Орбитальный дрон стреляет сам. До 3 дронов.',apply:p=>p.drones=Math.min(3,(p.drones||0)+1)},
 {name:'ЦЕПНАЯ МОЛНИЯ',desc:'Убийство бьёт током соседнего зондби. До 3 целей.',apply:p=>p.chain=Math.min(3,(p.chain||0)+1)},
 {name:'НЕСТАБИЛЬНЫЙ ГЕНОМ',desc:'Каждое 6-е убийство взрывает соседей. Больше уровень — шире взрыв.',apply:p=>p.genome=Math.min(3,(p.genome||0)+1)}
);
Game.prototype.start=function(){
 original.start.call(this);
 this.score=0;this.combo=0;this.comboLife=0;this.maxCombo=0;this.rage=35;this.overdrive=0;this.dashCd=0;this.dashMax=4;
 this.floaters=[];this.rings=[];this.bolts=[];this.corpses=[];this.deathQueue=[];this.droneCd=0;this.eventCd=30;this.eventIndex=0;this.event=null;this.pendingUpgrade=false;this.killedBosses=0;this.chainBudget=0;this.musicBeat=0;this.nextBeat=0;this.bursting=false;
 this.supportTime=0;this.player.drones=0;this.player.chain=0;this.player.genome=0;this.player.lastMove=-Math.PI/2;
 if(kit==='engineer')this.player.drones=1;
 else if(kit==='runner'){this.player.speed=250;this.dashMax=2.8;}
 else {this.player.maxHp=125;this.player.hp=125;this.rage=55;}
 this.bestScore=Number(safeGet('porkMayhemBest'))||0;this.extraBarrelCd=6;
 for(let i=0;i<3;i++)this.spawnBarrel();
 announce(this,'ОПЕРАЦИЯ «УТИЛИЗАЦИЯ»','ПАРКОВКА ДОЛЖНА БЫТЬ ЧИСТОЙ');
 this.updateMayhemHUD();
};
Game.prototype.showUpgrades=function(){this.pendingUpgrade=true;};
Game.prototype.kill=function(e){
 if(e.dead)return;
 const before=this.weaponLevel;
 original.kill.call(this,e);
 this.combo=this.comboLife>0?this.combo+1:1;this.comboLife=3.8;this.maxCombo=Math.max(this.maxCombo,this.combo);
 const mult=Math.min(5,1+Math.floor(this.combo/10));this.score+=(e.type==='boss'?1000:e.elite?120:10)*mult;
 this.rage=Math.min(100,this.rage+(this.bursting?.2:e.type==='boss'?25:2.4));
 this.corpses.push({x:e.x,y:e.y,a:rand(0,TAU),life:12,c:e.body});
 this.deathQueue.push({x:e.x,y:e.y,genome:this.kills%6===0});
 if(this.combo%10===0){note(this,`${this.combo} ПОДРЯД!`,this.player.x,this.player.y-55);tones(220+this.combo*2,.1);}
 if(e.type==='boss'){this.killedBosses++;this.rage=Math.min(100,this.rage+20);this.spawnMedkit();this.spawnBonus();announce(this,'НАЧАЛЬНИК УВОЛЕН','БОСС УНИЧТОЖЕН');}
 if(e.elite){this.medkits.push(new Medkit(clamp(e.x,35,W-35),clamp(e.y,150,H-35),false));note(this,'ПРЕМИЯ!',e.x,e.y,'#75efff');}
 if(before!==this.weaponLevel){this.spawnRelief=10;this.player.hp=Math.min(this.player.maxHp,this.player.hp+12);ring(this,this.player.x,this.player.y,100,'#72ffac');}
};
// All weapon families contribute to the same progression; bosses cannot be one-tapped by fire.
Game.prototype.flameKill=function(e){if(e.dead)return;e.hp-=32*this.player.damageMult*(1+this.time/600);e.flash=.05;if(e.hp<=0)this.kill(e);};
Game.prototype.fire=function(w){original.fire.call(this,this.overdrive>0?{...w,damage:w.damage*1.5,pierce:w.pierce+1}:w);};
Player.prototype.update=function(dt,g){original.playerUpdate.call(this,dt,g);if(Math.hypot(this.vx,this.vy)>15)this.lastMove=Math.atan2(this.vy,this.vx);if(g.overdrive>0)this.fireCd-=dt*.65;};
Game.prototype.dash=function(){
 if(this.state!=='play'||this.dashCd>0)return;
 const p=this.player,a=p.lastMove??p.aim,dx=Math.cos(a)*9,dy=Math.sin(a)*9;
 for(let i=0;i<17;i++){const next={x:clamp(p.x+dx,20,W-20),y:clamp(p.y+dy,135,H-28),w:p.w,h:p.h};if(this.obstacles.some(o=>hit(next,o)))break;this.particles.push(new Particle(p.x,p.y,'#7bedff'));p.x=next.x;p.y=next.y;}
 p.invuln=Math.max(p.invuln,.4);this.dashCd=this.dashMax;ring(this,p.x,p.y,44,'#7bedff');tones(300,.1);
};
Game.prototype.ultimate=function(){
 if(this.state!=='play'||this.rage<100)return;
 this.rage=0;this.overdrive=7;this.player.invuln=1.4;this.bursting=true;
 for(const e of this.enemies)if(!e.dead&&Math.hypot(e.x-this.player.x,e.y-this.player.y)<470){e.hp-=650*this.hpScale();if(e.hp<=0)this.kill(e);else e.flash=.3;}
 for(const b of this.barrels)if(!b.dead&&Math.hypot(b.x-this.player.x,b.y-this.player.y)<470)this.explodeBarrel(b);
 this.bursting=false;this.acidShots=[];ring(this,this.player.x,this.player.y,470,'#ffe18a');ring(this,this.player.x,this.player.y,320,'#ff6d49');this.shake=8;
 announce(this,'ПОРКАЛИПСИС','7 СЕКУНД ПРОМЫШЛЕННОЙ МОЩНОСТИ');tones(65,.5);
};
Game.prototype.beginEvent=function(){
 if(this.eventIndex++%2===0){
  const locations=[{x:640,y:265},{x:195,y:525},{x:1055,y:535}],p=locations[Math.floor(rand(0,3))];
  this.event={type:'cargo',...p,life:24,progress:0};announce(this,'ПОСЫЛКА ИЗ ДАБАЛАТОРИИ','СТОЙ В КРУГЕ: ЗАБЕРИ ГРУЗ');
 }else {this.event={type:'horde',life:18,spawn:0};announce(this,'СМЕНА ПРИБЫЛА','ПРОРЫВ ОРДЫ · 18 СЕКУНД');}
};
Game.prototype.updateMayhemHUD=function(){
 el('mayhem-score').textContent=`${this.score||0} ОЧКОВ · ×${Math.min(5,1+Math.floor((this.combo||0)/10))}`;
 el('mayhem-combo').textContent=this.comboLife>0?`${this.combo} ПОДРЯД`:'ПРОМЫШЛЕННАЯ УТИЛИЗАЦИЯ';
 el('ultimate-button').textContent=this.rage>=100?'ПОРКАЛИПСИС!':`ПОРК ${Math.floor(this.rage||0)}%`;
 el('ultimate-button').classList.toggle('ready',this.rage>=100);el('dash-button').textContent=this.dashCd>0?`РЫВОК ${this.dashCd.toFixed(1)}`:'РЫВОК';
 el('combat-controls').hidden=this.state!=='play';el('mayhem-hud').hidden=!this.player||this.state==='menu';
 el('event-text').textContent=this.event?this.event.type==='cargo'?`ГРУЗ: ${Math.round(this.event.progress/4*100)}% · ${Math.ceil(this.event.life)}с`:`ОРДА · ${Math.ceil(this.event.life)}с`:this.overdrive>0?`ПЕРЕГРУЗКА ${Math.ceil(this.overdrive)}с`:'';
};
Game.prototype.update=function(dt){
 if(this.state!=='play')return;
 this.dashCd=Math.max(0,this.dashCd-dt);this.overdrive=Math.max(0,this.overdrive-dt);this.comboLife=Math.max(0,this.comboLife-dt);if(this.comboLife===0)this.combo=0;
 original.update.call(this,dt);
 if(this.state!=='play'){this.updateMayhemHUD();return;}
 this.eventCd-=dt;
 if(!this.event&&this.eventCd<=0){this.beginEvent();this.eventCd=52;}
 if(this.event){const ev=this.event;ev.life-=dt;
  if(ev.type==='cargo'){
    if(Math.hypot(ev.x-this.player.x,ev.y-this.player.y)<65)ev.progress+=dt;
    else ev.progress=Math.max(0,ev.progress-dt*.35);
    if(ev.progress>=4){this.score+=400;this.rage=Math.min(100,this.rage+35);this.player.hp=Math.min(this.player.maxHp,this.player.hp+30);this.supportTime=22;this.shieldTime=Math.max(this.shieldTime,5);note(this,'+400 · ПОДДЕРЖКА!',ev.x,ev.y);ring(this,ev.x,ev.y,130,'#7bedff');this.event=null;}
  }else{ev.spawn-=dt;if(ev.spawn<=0&&this.enemies.length<170){this.spawn('normal');this.spawn('fast');ev.spawn=1.25;}}
  if(ev.life<=0){if(ev.type==='horde'){this.rage=Math.min(100,this.rage+25);this.spawnMedkit();note(this,'СМЕНА ЗАКРЫТА',this.player.x,this.player.y-55);}this.event=null;}
 }
 this.supportTime=Math.max(0,(this.supportTime||0)-dt);
 this.droneCd-=dt;
 const drones=Math.min(4,(this.player.drones||0)+(this.supportTime>0?2:0));
 if(drones&&this.droneCd<=0){for(let i=0;i<drones;i++){const a=this.time*1.5+i*TAU/drones,x=this.player.x+Math.cos(a)*58,y=this.player.y+Math.sin(a)*58;let target=null,d=460;for(const e of this.enemies)if(!e.dead){const l=Math.hypot(e.x-x,e.y-y);if(l<d){target=e;d=l;}}if(target){this.bullets.push(new Bullet(x,y,Math.atan2(target.y-y,target.x-x),{damage:24*(1+this.time/300),speed:720,range:520,pierce:1},this.player));}}this.droneCd=.42;}
 // Bounded queue: chain reactions may continue next frame without recursion.
 for(let budget=0;budget<6&&this.deathQueue.length;budget++){
  const death=this.deathQueue.shift();let links=this.player.chain||0;
  for(const e of this.enemies){if(e.dead)continue;const d=Math.hypot(e.x-death.x,e.y-death.y);
   if(links>0&&d<150){this.bolts.push({x:death.x,y:death.y,tx:e.x,ty:e.y,life:.2});e.hp-=18*(1+this.time/240);links--;if(e.hp<=0)this.kill(e);}
   if(death.genome&&this.player.genome&&d<65+this.player.genome*15){e.hp-=28*this.hpScale();if(e.hp<=0)this.kill(e);}
  }
  if(death.genome&&this.player.genome)ring(this,death.x,death.y,65+this.player.genome*15,'#a0ff82');
 }
 for(const f of this.floaters){f.life-=dt;f.y-=dt*25;}this.floaters=this.floaters.filter(f=>f.life>0).slice(-30);
 for(const r of this.rings)r.life-=dt;this.rings=this.rings.filter(r=>r.life>0).slice(-16);
 for(const b of this.bolts)b.life-=dt;this.bolts=this.bolts.filter(b=>b.life>0).slice(-24);
 for(const c of this.corpses)c.life-=dt;this.corpses=this.corpses.filter(c=>c.life>0).slice(-70);
 this.particles=this.particles.slice(-550);this.bullets=this.bullets.slice(-220);this.deathQueue=this.deathQueue.slice(-180);
 this.player.speed=Math.min(330,this.player.speed);this.player.bonusBullets=Math.min(6,this.player.bonusBullets);this.player.bonusPierce=Math.min(6,this.player.bonusPierce);this.player.rateMult=Math.min(3,this.player.rateMult);this.player.armor=Math.min(.7,this.player.armor);
 this.fallbackMusic(dt);
 if(this.pendingUpgrade){this.pendingUpgrade=false;original.upgrades.call(this);}
 this.updateMayhemHUD();
};
Game.prototype.fallbackMusic=function(dt){
 if(muted||!audioCtx||audioCtx.state!=='running'||!music.error)return;
 this.nextBeat-=dt;if(this.nextBeat>0)return;this.nextBeat=.25;const notes=[65.41,65.41,77.78,58.27,65.41,98,87.31,58.27];tones(notes[this.musicBeat++%notes.length],.13);
};
Game.prototype.end=function(){
 if(this.state!=='play')return;original.end.call(this);
 this.bestScore=Math.max(this.bestScore||0,this.score||0);safeSet('porkMayhemBest',this.bestScore);
 ui.stats.innerHTML+=`<span>Очки / рекорд</span><strong>${this.score} / ${this.bestScore}</strong><span>Лучшая серия / боссы</span><strong>${this.maxCombo} / ${this.killedBosses}</strong>`;
 this.updateMayhemHUD();
};
const spawn38=Game.prototype.spawn;
Game.prototype.spawn=function(type=null){if(this.enemies.length>=190)return;spawn38.call(this,type);const e=this.enemies.at(-1);if(!type&&this.time>50&&Math.random()<.075&&e.type!=='boss'){e.elite=true;e.hp*=2.2;e.maxHp=e.hp;e.speed*=1.13;}if(e.type==='boss')e.slamCd=5;};
Enemy.prototype.update=function(dt,g){
 if(this.dead)return;
 if(this.type==='boss'){
   this.slamCd=(this.slamCd??5)-dt;
   if(this.slamCd<=0){this.slamCd=7;this.warning=1.2;this.slamX=this.x;this.slamY=this.y;}
   if(this.warning>0){this.warning-=dt;if(this.warning<=0){ring(g,this.slamX,this.slamY,160,'#ff714f');if(Math.hypot(g.player.x-this.slamX,g.player.y-this.slamY)<160)g.player.hurt(28,g);tones(48,.3);}}
 }
 original.enemyUpdate.call(this,dt,g);
};
Enemy.prototype.draw=function(){
 if(this.warning>0){ctx.save();ctx.globalAlpha=.25+.2*Math.sin(this.warning*20);ctx.fillStyle='#ff694b';ctx.beginPath();ctx.arc(this.slamX,this.slamY,160,0,TAU);ctx.fill();ctx.restore();}
 original.enemyDraw.call(this);
 if(this.type==='boss'){
  ctx.save();ctx.translate(this.x,this.y);ctx.fillStyle='#1c2727';ctx.fillRect(-66,-22,132,70);ctx.fillStyle='#a5854b';for(let i=0;i<7;i++)ctx.fillRect(-59+i*18,10,10,14);ctx.fillStyle='#b6bbaa';ctx.font='bold 14px monospace';ctx.textAlign='center';ctx.fillText('ОХРАНА',0,-3);ctx.fillStyle='#17201f';ctx.fillRect(-65,60,48,22);ctx.fillRect(17,60,48,22);ctx.fillStyle='#e05f41';ctx.fillRect(-42,-64,14,5);ctx.fillRect(28,-64,14,5);ctx.restore();
 }
 if(this.elite){ctx.strokeStyle='#ffdc76';ctx.lineWidth=2;ctx.strokeRect(this.x-this.w/2-4,this.y-this.h/2-5,this.w+8,this.h+10);ctx.fillStyle='#ffdc76';ctx.fillRect(this.x-7,this.y-this.h/2-12,14,4);}
};
Game.prototype.drawBackground=function(){
 original.background.call(this);
 ctx.save();
 if(this.player&&!matchMedia('(pointer: coarse), (max-width: 900px)').matches){ctx.fillStyle='#111b1d';ctx.fillRect(0,8,W,70);}
 for(const [x,y,rx] of [[130,390,70],[920,180,55],[660,645,80]]){ctx.fillStyle='#15292b';ctx.beginPath();ctx.ellipse(x,y,rx,14,-.2,0,TAU);ctx.fill();ctx.strokeStyle='#436a68';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y,rx-6,8,-.2,0,Math.PI);ctx.stroke();}
 ctx.fillStyle='#f5c96a';ctx.font='bold 15px monospace';ctx.textAlign='left';ctx.fillText('СЕКТОР 07 // УТИЛИЗАЦИЯ',30,152);
 for(let i=0;i<12;i++){ctx.fillStyle=i%2?'#d3a64e':'#1b2221';ctx.fillRect(530+i*18,110,18,8);}
 for(const c of this.corpses||[]){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.a);ctx.globalAlpha=Math.min(.32,c.life/8);ctx.fillStyle='#173e2a';ctx.fillRect(-18,-9,36,18);ctx.fillStyle=c.c;ctx.fillRect(-10,-4,20,8);ctx.restore();}
 const ev=this.event;if(ev?.type==='cargo'){ctx.strokeStyle='#79e8ef';ctx.lineWidth=3;ctx.setLineDash([9,7]);ctx.beginPath();ctx.arc(ev.x,ev.y,65,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#ffdf8c';ctx.lineWidth=6;ctx.beginPath();ctx.arc(ev.x,ev.y,65,-Math.PI/2,-Math.PI/2+TAU*ev.progress/4);ctx.stroke();ctx.fillStyle='#487478';ctx.fillRect(ev.x-18,ev.y-18,36,36);ctx.fillStyle='#c7f4e9';ctx.fillRect(ev.x-3,ev.y-18,6,36);ctx.fillRect(ev.x-18,ev.y-3,36,6);}
 ctx.restore();
};
Player.prototype.draw=function(g){
 ctx.save();ctx.translate(this.x,this.y);if(this.invuln>0)ctx.globalAlpha=.6+.4*Math.sin(g.time*35);
 ctx.fillStyle='#091211';ctx.beginPath();ctx.ellipse(0,21,21,8,0,0,TAU);ctx.fill();
 const walk=Math.sin(g.time*16)*(Math.hypot(this.vx,this.vy)>20?3:0);ctx.fillStyle='#151b21';ctx.fillRect(-11,9,9,19+walk);ctx.fillRect(2,9,9,19-walk);ctx.fillStyle='#080b0d';ctx.fillRect(-12,-9,24,30);ctx.fillStyle='#fff2d6';ctx.fillRect(-4,-8,8,14);ctx.fillStyle='#ed6548';ctx.fillRect(-2,-5,4,20);
 ctx.fillStyle='#da9291';ctx.fillRect(-11,-26,22,19);ctx.fillRect(-15,-29,8,9);ctx.fillRect(7,-29,8,9);ctx.fillStyle='#f5b2a4';ctx.fillRect(-9,-24,18,13);ctx.fillStyle='#141e22';ctx.fillRect(-12,-22,24,5);ctx.fillStyle='#77dfde';ctx.fillRect(-9,-21,5,2);ctx.fillStyle='#be747a';ctx.fillRect(-6,-15,12,7);ctx.fillStyle='#6d3d4e';ctx.fillRect(-4,-13,2,2);ctx.fillRect(2,-13,2,2);
 ctx.rotate(this.aim);ctx.fillStyle='#4c6162';ctx.fillRect(10,-4,26,8);ctx.fillStyle='#c3d5ca';ctx.fillRect(29,-3,9,6);ctx.restore();
 const n=Math.min(4,(this.drones||0)+(g.supportTime>0?2:0));for(let i=0;i<n;i++){const a=g.time*1.5+i*TAU/n,x=this.x+Math.cos(a)*58,y=this.y+Math.sin(a)*58;ctx.fillStyle='#173536';ctx.fillRect(x-10,y-7,20,14);ctx.strokeStyle='#8ce9eb';ctx.strokeRect(x-10,y-7,20,14);ctx.fillStyle='#fbdb7a';ctx.fillRect(x-3,y-3,6,6);}
};
Game.prototype.draw=function(){
 original.draw.call(this);this.updateMayhemHUD();if(!this.player)return;
 ctx.save();for(const r of this.rings||[]){ctx.globalAlpha=r.life/r.max;ctx.strokeStyle=r.color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(r.x,r.y,r.r*(1-r.life/r.max),0,TAU);ctx.stroke();}
 for(const b of this.bolts||[]){ctx.globalAlpha=b.life/.2;ctx.strokeStyle='#8aecff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo((b.x+b.tx)/2+12,(b.y+b.ty)/2-9);ctx.lineTo(b.tx,b.ty);ctx.stroke();}
 ctx.textAlign='center';ctx.font='bold 20px monospace';for(const f of this.floaters||[]){ctx.globalAlpha=Math.min(1,f.life*2);ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y);}
 ctx.restore();this.updateMayhemHUD();
};
for(const [id,method] of [['dash-button','dash'],['ultimate-button','ultimate']])el(id).addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();game[method]();});
addEventListener('keydown',e=>{if(e.repeat)return;if(e.code==='Space'){e.preventDefault();game.dash();}if(e.code==='KeyQ')game.ultimate();});
el('sound-button').onclick=()=>{muted=!muted;music.muted=muted;for(const a of ambientEffects)a.muted=muted;el('sound-button').textContent=muted?'ЗВУК: ВЫКЛ':'ЗВУК: ВКЛ';};
})();
