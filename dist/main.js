import * as THREE from 'three';
import { ForestWorld, LANDMARKS, ROUTE, groundHeight, streamX } from './world.js';
import { ForestAudio } from './audio.js';

const $=id=>document.getElementById(id);
const show=(id,value=true)=>$(id).classList.toggle('hidden',!value);
const clamp=THREE.MathUtils.clamp;
const fmt=s=>`${Math.floor(Math.max(0,s)/60).toString().padStart(2,'0')}:${Math.floor(Math.max(0,s)%60).toString().padStart(2,'0')}`;
const STORAGE='wildsignal-expedition-v1',SETTINGS='wildsignal-settings-v1';
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback;}catch{return fallback;}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
function remove(key){try{localStorage.removeItem(key);}catch{}}
let settings={quality:matchMedia('(pointer:coarse)').matches?'low':'medium',volume:.55,sensitivity:1,invert:false,...read(SETTINGS,{})};
let world,audio=new ForestAudio(settings.volume),screen='loading',modal=null,modalOrigin='title',mode='expedition',state=null;
let globalTime=0,lastTime=0,uiTick=0,saveTick=0,toastUntil=0,pulseCooldown=0,stepTimer=0,damageTimer=0,tutorialTimer=0;
let keys=new Set(),isDragging=false,lookTouch=null,moveTouch=null,touchMove={x:0,y:0},touchSprint=false,isTouch=matchMedia('(pointer:coarse)').matches;
let interaction=null,interactionProgress=0,lastInteractionKey='',jumpY=0,jumpVelocity=0,walkBob=0,photo=false,lastSafe=3;
const destinationProjection=new THREE.Vector3();
const mapCanvas=$('field-map'),miniCanvas=$('minimap'),mapContext=mapCanvas.getContext('2d'),miniContext=miniCanvas.getContext('2d');
const mapBase=document.createElement('canvas');mapBase.width=680;mapBase.height=680;
let save=read(STORAGE,null);
if(!validSave(save))save=null;
function validSave(s){return !!s&&!s.completed&&s.version===1&&['expedition','wander'].includes(s.mode)&&Number.isFinite(s.x)&&Number.isFinite(s.z)&&Number.isFinite(s.yaw)&&Number.isFinite(s.health)&&s.health>0&&s.remaining>0&&Array.isArray(s.relays)&&s.relays.length===3;}

function freshState(chosenMode){return {version:1,mode:chosenMode,x:0,z:60,yaw:.63,pitch:-.015,health:100,energy:100,stamina:100,noise:0,remaining:480,elapsed:0,relays:[false,false,false],collected:[],lures:3,pulses:0,flowers:0,target:0,lastSafe:3,running:true};}
function safeInputState(){keys.clear();touchMove={x:0,y:0};touchSprint=false;isDragging=false;interactionProgress=0;jumpVelocity=0;}
function saveGame(){if(!state||state.completed||screen==='end'||state.health<=0||state.remaining<=0)return;write(STORAGE,{...state,running:false});save={...state};show('continue',true);}
function toast(message,kicker='FIELD NOTE',duration=5){$('toast-message').textContent=message;$('toast-kicker').textContent=kicker;show('event-toast');toastUntil=globalTime+duration;}
function title(){if(state&&screen==='game')saveGame();screen='title';photo=false;safeInputState();if(document.pointerLockElement)document.exitPointerLock();show('title-screen');show('hud',false);show('touch-controls',false);show('modal-backdrop',false);show('drag-hint',false);show('photo-label',false);modal=null;world.cinematic(globalTime);show('continue',!!save);}
function start(continuing=false){
  if(!world)return;audio.start();world.reset();state=continuing&&save?{...freshState(save.mode),...save,running:true}:freshState(mode);mode=state.mode;
  state.x=clamp(state.x,-135,135);state.z=clamp(state.z,-135,135);state.pitch=clamp(state.pitch||0,-1.3,1.3);state.energy=clamp(state.energy||0,0,100);state.stamina=100;state.noise=0;
  state.relays.forEach((active,i)=>world.activate(i,active));for(const id of state.collected||[]){if(world.flowers[id]){world.flowers[id].collected=true;world.flowers[id].group.visible=false;}}
  lastSafe=state.lastSafe??3;screen='game';modal=null;photo=false;jumpY=0;jumpVelocity=0;safeInputState();pulseCooldown=0;saveTick=0;tutorialTimer=0;
  show('title-screen',false);show('modal-backdrop',false);show('hud');show('touch-controls',isTouch);show('tutorial');show('photo-label',false);show('event-toast',false);
  $('clock-label').textContent=mode==='wander'?'WANDER MODE':'STORM ARRIVAL';$('tutorial-text').innerHTML=isTouch?'Left thumb to move · Drag the world to look · Tap Pulse to find the trail':'<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move · Mouse to look · <kbd>Shift</kbd> run';
  $('tutorial').querySelector('.tutorial-number').textContent='01 / FIELD BASICS';
  updateObjectives();updateHud();world.pulse(state.x,state.z,LANDMARKS[state.target]);saveGame();captureMouse();
}
function captureMouse(){if(isTouch||screen!=='game'||modal)return;try{const p=world.renderer.domElement.requestPointerLock?.();if(p?.catch)p.catch(()=>show('drag-hint'));}catch{show('drag-hint');}}
function openModal(which){if(screen==='loading')return;safeInputState();if(!modal)modalOrigin=screen==='title'?'title':'game';modal=which;if(document.pointerLockElement)document.exitPointerLock();document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden'));show(which+'-modal');show('modal-backdrop');show('touch-controls',false);show('drag-hint',false);if(which==='map'){buildMapDestinations();drawMap(mapContext,680,false);}if(which==='settings')syncSettings();if(which==='pause')saveGame();}
function closeModal(){if(!modal)return;modal=null;show('modal-backdrop',false);if(modalOrigin==='game'&&screen==='game'){show('touch-controls',isTouch);captureMouse();}}
function syncSettings(){for(const key of['quality','sensitivity','volume'])$(key).value=settings[key];$('invert').checked=settings.invert;}
function persistSettings(){write(SETTINGS,settings);$('sound-top').querySelector('span').textContent=settings.volume>0?'Sound on':'Sound off';}
function pulse(){if(!state||modal||screen!=='game'||photo)return;if(pulseCooldown>0){toast('Let the last echo settle.','RESONANCE',2);return;}if(state.energy<12){toast('Resonance is recovering. Give it a moment.','LOW RESONANCE',3);return;}state.energy-=12;state.noise=Math.min(100,state.noise+34);state.pulses++;world.pulse(state.x,state.z,LANDMARKS[state.target]);pulseCooldown=3;audio.pulse();$('pulse-screen').style.opacity='.65';setTimeout(()=>$('pulse-screen').style.opacity='0',450);if(state.pulses===1)toast('The fireflies lead to your marked destination. Storm wisps can hear the pulse too.','THE FOREST ANSWERS',6);}
function lure(){if(!state||modal||screen!=='game'||photo)return;if(state.lures<=0){toast('Gather a blue lumen flower to replenish your lures.','PACK EMPTY',3);return;}state.lures--;world.dropLure(state.x+Math.sin(state.yaw)*3,state.z+Math.cos(state.yaw)*3);audio.lure();toast('An echo is singing behind you. Keep moving.','LURE DEPLOYED',3);}
function jump(){if(!state||modal||photo||jumpY>.02)return;jumpVelocity=5;}
function togglePhoto(){if(screen!=='game'||modal)return;photo=!photo;safeInputState();show('hud',!photo);show('touch-controls',!photo&&isTouch);show('photo-label',photo);show('drag-hint',false);}

function selectTarget(index){state.target=index;updateObjectives();world.pulse(state.x,state.z,LANDMARKS[index]);buildMapDestinations();}
function nextTarget(){const left=LANDMARKS.slice(0,3).map((l,i)=>({i,d:Math.hypot(l.x-state.x,l.z-state.z)})).filter(x=>!state.relays[x.i]).sort((a,b)=>a.d-b.d);state.target=left.length?left[0].i:3;updateObjectives();world.pulse(state.x,state.z,LANDMARKS[state.target]);}
function updateObjectives(){if(!state)return;const done=state.relays.filter(Boolean).length;state.relays.forEach((v,i)=>$('relay-'+i).classList.toggle('done',v));$('objective-title').textContent=done===3?'Send the signal home':'Restore the forest relays';$('objective-hint').textContent=done===3?'Return to Base Camp and hold E at the transmitter.':`${done} of 3 restored · ${LANDMARKS[state.target].name} marked`;$('waypoint-name').textContent=LANDMARKS[state.target].name.toUpperCase();}
function nearbyInteraction(){let result=null,best=Infinity;for(let i=0;i<3;i++){const l=LANDMARKS[i],d=Math.hypot(state.x-l.x,state.z-l.z);if(d<3.7&&d<best){result={type:state.relays[i]?'shelter':'relay',index:i,duration:state.relays[i]?1:3,key:'relay'+i};best=d;}}
  const camp=LANDMARKS[3],cd=Math.hypot(state.x-camp.x,state.z-camp.z);if(cd<3.5&&cd<best){result={type:state.relays.every(Boolean)?'rescue':'camp',index:3,duration:state.relays.every(Boolean)?2:1,key:'camp'};best=cd;}
  for(const f of world.flowers){if(f.collected)continue;const d=Math.hypot(state.x-f.x,state.z-f.z);if(d<2.3&&d<best){result={type:'flower',index:f.id,duration:.3,key:'flower'+f.id};best=d;}}
  return result;
}
function doInteraction(inter){switch(inter.type){
  case'relay':if(state.energy<20){toast('You need 20 resonance to tune this relay. Rest a moment or find a blue flower.','LOW RESONANCE',5);return;}state.energy-=20;state.relays[inter.index]=true;world.activate(inter.index);state.health=Math.min(100,state.health+30);lastSafe=inter.index;state.lastSafe=lastSafe;audio.relay();toast(LANDMARKS[inter.index].note,`${LANDMARKS[inter.index].short} RELAY RESTORED`,7);nextTarget();saveGame();break;
  case'flower':{const f=world.flowers[inter.index];if(f.collected)return;f.collected=true;f.group.visible=false;state.collected.push(f.id);state.flowers++;state.energy=Math.min(100,state.energy+35);state.health=Math.min(100,state.health+20);state.lures=Math.min(9,state.lures+1);audio.collect();toast('+35 resonance · +20 vitality · +1 echo lure','LUMEN FLOWER GATHERED',3);break;}
  case'shelter':case'camp':state.health=100;state.energy=100;state.stamina=100;state.noise=0;lastSafe=inter.index;state.lastSafe=lastSafe;audio.collect();toast(inter.type==='camp'?'Supplies replenished. Three forest relays still need your signal.':'The light is holding back the storm. You can breathe here.','RESTORED AT SHELTER',4);saveGame();break;
  case'rescue':end(true);break;
}}
function updateInteraction(dt){interaction=nearbyInteraction();show('interaction',!!interaction);if(!interaction){interactionProgress=0;lastInteractionKey='';return;}if(lastInteractionKey!==interaction.key){interactionProgress=0;lastInteractionKey=interaction.key;}
  const labels={relay:['Restore relay','Hold E to tune · 20 resonance'],flower:['Gather lumen flower','Vitality + resonance + an echo lure'],camp:['Rest at Base Camp','Hold E to replenish your supplies'],shelter:['Rest in the light','A safe place to recover'],rescue:['Send rescue signal','Hold E · Let the forest guide you home']};
  $('interaction-title').textContent=labels[interaction.type][0];$('interaction-sub').textContent=labels[interaction.type][1];
  if(keys.has('KeyE')){if(interaction.type==='relay'&&state.energy<20){$('interaction-sub').textContent='20 resonance needed · recharging…';interactionProgress=0;}else{interactionProgress+=dt;if(interactionProgress>=interaction.duration){doInteraction(interaction);interactionProgress=0;keys.delete('KeyE');}}}else interactionProgress=Math.max(0,interactionProgress-dt*3);
  $('interact-progress').style.width=`${clamp(interactionProgress/interaction.duration*100,0,100)}%`;
}
function updateGame(dt){
  state.running=true;state.elapsed+=dt;if(state.mode==='expedition')state.remaining-=dt;
  pulseCooldown=Math.max(0,pulseCooldown-dt);state.energy=Math.min(100,state.energy+dt*1.45);state.noise=Math.max(0,state.noise-dt*4);damageTimer=Math.max(0,damageTimer-dt);
  let forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-touchMove.y;
  let right=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touchMove.x;
  if(keys.has('ArrowLeft'))state.yaw+=dt*1.4;if(keys.has('ArrowRight'))state.yaw-=dt*1.4;
  const length=Math.hypot(forward,right);if(length>1){forward/=length;right/=length;}
  const moving=length>.06;const sprint=moving&&(keys.has('ShiftLeft')||keys.has('ShiftRight')||touchSprint)&&state.stamina>2;
  let speed=sprint?8.2:4.6;const wet=Math.abs(state.x-streamX(state.z))<2.8&&!world.bridges.some(b=>Math.abs(state.z-b.z)<2);if(wet)speed*=.65;
  state.stamina=clamp(state.stamina+dt*(sprint?-17:23),0,100);if(sprint)state.noise=Math.min(100,state.noise+dt*8.5);
  if(moving){const dx=(-Math.sin(state.yaw)*forward+Math.cos(state.yaw)*right)*speed*dt,dz=(-Math.cos(state.yaw)*forward-Math.sin(state.yaw)*right)*speed*dt;const p=world.move(state.x,state.z,dx,dz);state.x=p.x;state.z=p.z;walkBob+=dt*(sprint?12:8);stepTimer-=dt;if(stepTimer<=0){audio.step(sprint);stepTimer=sprint?.32:.5;}}
  jumpVelocity-=dt*13;jumpY+=jumpVelocity*dt;if(jumpY<0){jumpY=0;jumpVelocity=0;}
  const safety=LANDMARKS.some((l,i)=>(i===3||state.relays[i])&&Math.hypot(state.x-l.x,state.z-l.z)<7);
  if(safety){state.health=Math.min(100,state.health+dt*12);state.energy=Math.min(100,state.energy+dt*15);state.noise=Math.max(0,state.noise-dt*12);}
  let threat=false;
  for(const w of world.wisps){const d=Math.hypot(state.x-w.x,state.z-w.z);let target=null;let lureDist=Infinity;for(const l of world.lures){const ld=Math.hypot(l.x-w.x,l.z-w.z);if(ld<46&&ld<lureDist){target=l;lureDist=ld;}}
    w.chase=!target&&!safety&&(d<15||d<32+state.noise*.25&&state.noise>22);
    if(!target){if(w.chase)target=state;else target={x:w.home.x+Math.sin(globalTime*.12+w.index)*10,z:w.home.z+Math.cos(globalTime*.09+w.index)*10};}
    const dx=target.x-w.x,dz=target.z-w.z,td=Math.hypot(dx,dz);const ws=w.chase?3.4:target.life?4.4:1.6;if(td>1){w.x+=dx/td*dt*ws;w.z+=dz/td*dt*ws;}
    if(w.chase&&d<35)threat=true;
    if(d<3.4&&!safety&&state.mode==='expedition'){state.health-=dt*15;threat=true;if(damageTimer<=0){audio.hurt();damageTimer=.9;}}
  }
  state.threat=threat;state.safety=safety;
  $('damage').style.opacity=state.mode==='wander'?'0':String(damageTimer>0?.25+(1-state.health/100)*.18:state.health<30?.12:0);
  updateInteraction(dt);
  if(state.health<=0||state.remaining<=0){state.health=Math.max(0,state.health);end(false);return;}
  world.camera.position.set(state.x,world.playerGround(state.x,state.z)+1.72+jumpY+(moving?Math.sin(walkBob)*.035:Math.sin(globalTime*1.1)*.007),state.z);
  world.camera.rotation.set(state.pitch,state.yaw,moving?Math.sin(walkBob*.5)*.002:0,'YXZ');world.camera.fov=THREE.MathUtils.lerp(world.camera.fov,sprint?71:66,dt*4);world.camera.updateProjectionMatrix();
  tutorialTimer+=dt;if(tutorialTimer>13&&tutorialTimer<13+dt*2){$('tutorial').querySelector('.tutorial-number').textContent='02 / THE FOREST ANSWERS';$('tutorial-text').innerHTML='<kbd>Q</kbd> reveals your route · Hold <kbd>E</kbd> near a relay or blue flower';}
  if(tutorialTimer>28)show('tutorial',false);
  if(state.mode==='expedition'&&state.remaining<120&&!state.warnedStorm){state.warnedStorm=true;toast('The storm is closing in. Two minutes until the signal disappears.','STORM WARNING',6);}
  saveTick+=dt;if(saveTick>6){saveTick=0;saveGame();}
}
function updateHud(){if(!state)return;$('clock').textContent=state.mode==='wander'?'∞':fmt(state.remaining);$('storm-indicator').style.transform=`scaleX(${state.remaining/480})`;$('health-value').textContent=Math.ceil(state.health);$('energy-value').textContent=Math.floor(state.energy);$('health-bar').style.width=state.health+'%';$('energy-bar').style.width=state.energy+'%';$('stamina-bar').style.width=state.stamina+'%';$('lure-count').textContent=state.lures;
  $('threat-label').textContent=state.safety?'Sheltered in the light':state.mode==='wander'?'The wild is yours to explore':state.threat?'The storm is following you':state.noise>40?'Your signal is carrying far':'The forest is quiet';$('threat-label').style.color=state.threat&&state.mode!=='wander'?'#efac90':'#b4c8ab';
  let nearest=LANDMARKS.map((l,i)=>({i,d:Math.hypot(state.x-l.x,state.z-l.z)})).sort((a,b)=>a.d-b.d)[0];$('zone').textContent=nearest.d<26?LANDMARKS[nearest.i].name.toUpperCase():'THE VERDANT BASIN';
  const heading=(((-state.yaw*180/Math.PI)%360)+360)%360;const directions=['N','NE','E','SE','S','SW','W','NW'];$('heading').textContent=`${directions[Math.round(heading/45)%8]} · ${Math.round(heading).toString().padStart(3,'0')}°`;
  const compass=$('compass-labels');let html='';for(let i=0;i<8;i++){let diff=i*45-heading;while(diff>180)diff-=360;while(diff< -180)diff+=360;const x=50+diff*.8;if(x>-10&&x<110)html+=`<span style="left:calc(${x}% - 5px)">${directions[i]}</span><i style="left:${x}%"></i>`;}compass.innerHTML=html;
  const dest=LANDMARKS[state.target],dist=Math.hypot(state.x-dest.x,state.z-dest.z);destinationProjection.set(dest.x,groundHeight(dest.x,dest.z)+5.7,dest.z).project(world.camera);const wp=$('waypoint');const behind=destinationProjection.z>1;
  const targetAngle=Math.atan2(-(dest.x-state.x),-(dest.z-state.z));let diff=targetAngle-state.yaw;while(diff>Math.PI)diff-=Math.PI*2;while(diff< -Math.PI)diff+=Math.PI*2;
  let px=(destinationProjection.x*.5+.5)*innerWidth,py=(-destinationProjection.y*.5+.5)*innerHeight;
  if(behind){px=diff>0?innerWidth*.1:innerWidth*.9;py=innerHeight*.49;}
  wp.style.left=clamp(px,100,innerWidth-100)+'px';wp.style.top=clamp(py,innerHeight*.28,innerHeight*.62)+'px';wp.style.opacity=dist<5?'0':'1';wp.querySelector('span').textContent=behind?'↶':'◇';$('waypoint-distance').textContent=Math.round(dist)+' m';drawMap(miniContext,260,true);
}
function end(won){screen='end';state.completed=won;state.running=false;safeInputState();if(document.pointerLockElement)document.exitPointerLock();show('hud',false);show('touch-controls',false);show('drag-hint',false);show('event-toast',false);$('damage').style.opacity='0';
  $('end-kicker').textContent=won?'TRANSMISSION RECEIVED':'EXPEDITION INTERRUPTED';$('end-title').innerHTML=won?'The forest<br>remembered you.':state.remaining<=0?'The storm<br>found you first.':'Your signal<br>grew quiet.';$('end-description').textContent=won?'Three lights in the dark. One signal home. You made it.':'The basin keeps its secrets for now. Take another path, or try again from your last shelter.';$('end-time').textContent=fmt(state.elapsed);$('end-flowers').textContent=state.flowers;$('end-pulses').textContent=state.pulses;show('checkpoint',!won);openModal('end');if(won){audio.relay();remove(STORAGE);save=null;}else{remove(STORAGE);save=null;}}
function checkpoint(){const l=LANDMARKS[lastSafe];state={...state,x:l.x+2,z:l.z+3,yaw:0,pitch:0,health:100,energy:100,stamina:100,noise:0,remaining:Math.max(180,state.remaining),running:true};save={...state};start(true);toast('Your restored relays are still shining. You have another chance.','BACK AT SHELTER',5);}

function buildMapBase(){const c=mapBase.getContext('2d'),size=680,span=290;c.fillStyle='#1b3125';c.fillRect(0,0,size,size);
  for(let y=0;y<170;y++)for(let x=0;x<170;x++){const wx=(x/170-.5)*span,wz=(y/170-.5)*span,h=groundHeight(wx,wz);const l=22+h*1.4+Math.sin(wx*.1)*2;c.fillStyle=`hsl(104 18% ${l}%)`;c.fillRect(x*4,y*4,4,4);}
  c.strokeStyle='#aabd8c13';c.lineWidth=1;for(let i=0;i<12;i++){c.beginPath();c.moveTo(i*size/11,0);c.lineTo(i*size/11,size);c.moveTo(0,i*size/11);c.lineTo(size,i*size/11);c.stroke();}
  const to=v=>(v/span+.5)*size;
  for(let level=-4;level<=6;level+=.7){c.beginPath();for(let z=-145;z<145;z+=4)for(let x=-145;x<145;x+=4){const heights=[groundHeight(x,z),groundHeight(x+4,z),groundHeight(x+4,z+4),groundHeight(x,z+4)],points=[[x,z],[x+4,z],[x+4,z+4],[x,z+4]],cross=[];for(let j=0;j<4;j++){const a=heights[j],b=heights[(j+1)%4];if((a<level)!==(b<level)){const t=(level-a)/(b-a),pa=points[j],pb=points[(j+1)%4];cross.push([to(pa[0]+(pb[0]-pa[0])*t),to(pa[1]+(pb[1]-pa[1])*t)]);}}if(cross.length>=2){c.moveTo(...cross[0]);c.lineTo(...cross[1]);}}c.strokeStyle='#b9cfa821';c.lineWidth=.7;c.stroke();}
  c.strokeStyle='#729e9266';c.lineWidth=12;c.beginPath();for(let z=-145;z<=145;z+=2){const x=streamX(z);if(z===-145)c.moveTo(to(x),to(z));else c.lineTo(to(x),to(z));}c.stroke();
  c.strokeStyle='#c7b28b88';c.lineWidth=2;c.setLineDash([4,5]);c.beginPath();ROUTE.forEach(([x,z],i)=>{if(i===0)c.moveTo(to(x),to(z));else c.lineTo(to(x),to(z));});c.stroke();c.setLineDash([]);
  c.fillStyle='#bdc5a270';c.font='9px Arial';c.letterSpacing='2px';c.fillText('VERDANT BASIN',35,38);c.font='8px Arial';c.fillText('SURVEY 01 / TRAIL NETWORK',35,55);c.fillText('N',size/2-3,25);c.fillText('50 m',size-85,size-28);c.strokeStyle='#bdc5a270';c.beginPath();c.moveTo(size-135,size-40);c.lineTo(size-135+size*50/span,size-40);c.stroke();
}
function drawMap(c,size,mini){if(!state)return;c.clearRect(0,0,size,size);c.drawImage(mapBase,0,0,size,size);const to=v=>(v/290+.5)*size;
  LANDMARKS.forEach((l,i)=>{const x=to(l.x),z=to(l.z),active=i===3||state.relays[i];if(state.target===i){c.beginPath();c.arc(x,z,mini?8:15,0,Math.PI*2);c.strokeStyle='#e3c08c99';c.lineWidth=1;c.stroke();}c.fillStyle=i===3?'#dfa471':active?'#bddd9c':'#e5c18b';c.save();c.translate(x,z);c.rotate(Math.PI/4);const r=mini?3:5;c.fillRect(-r,-r,r*2,r*2);c.restore();if(!mini){c.font='10px Arial';c.fillStyle='#d7e1c6';c.textAlign='center';c.fillText(l.short,x,z+25);}});
  for(const w of world.wisps){c.fillStyle='#df876e9c';c.beginPath();c.arc(to(w.x),to(w.z),mini?2:4,0,Math.PI*2);c.fill();}
  c.save();c.translate(to(state.x),to(state.z));c.rotate(-state.yaw);c.fillStyle='#f4f0d7';c.beginPath();c.moveTo(0,mini?-6:-10);c.lineTo(mini?4:6,mini?5:7);c.lineTo(0,mini?3:4);c.lineTo(mini?-4:-6,mini?5:7);c.closePath();c.fill();c.restore();
}
function buildMapDestinations(){if(!state)return;$('map-destinations').innerHTML=LANDMARKS.map((l,i)=>`<button data-destination="${i}" class="${state.target===i?'selected':''}">${i===3?'⌂':'◇'} &nbsp;${l.name}<small>${i===3?(state.relays.every(Boolean)?'READY FOR EXTRACTION':'RESUPPLY & SHELTER'):state.relays[i]?'RESTORED · SAFE SHELTER':'SIGNAL LOST'} · ${Math.round(Math.hypot(state.x-l.x,state.z-l.z))} m</small></button>`).join('');$('map-destinations').querySelectorAll('button').forEach(b=>b.onclick=()=>{selectTarget(Number(b.dataset.destination));drawMap(mapContext,680,false);});}
mapCanvas.addEventListener('click',e=>{if(!state)return;const r=mapCanvas.getBoundingClientRect(),x=((e.clientX-r.left)/r.width-.5)*290,z=((e.clientY-r.top)/r.height-.5)*290;const targets=LANDMARKS.map((l,i)=>({i,d:Math.hypot(l.x-x,l.z-z)})).sort((a,b)=>a.d-b.d);if(targets[0].d<18){selectTarget(targets[0].i);drawMap(mapContext,680,false);}});

function moveLook(dx,dy){if(!state||screen!=='game'||modal)return;state.yaw-=dx*.0022*settings.sensitivity;state.pitch=clamp(state.pitch-dy*.0022*settings.sensitivity*(settings.invert?-1:1),-1.35,1.35);}
document.addEventListener('mousemove',e=>{if(document.pointerLockElement||isDragging)moveLook(e.movementX,e.movementY);});
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement){show('drag-hint',false);}else if(screen==='game'&&!modal&&!isTouch){openModal('pause');}});
document.addEventListener('pointerlockerror',()=>{if(screen==='game')show('drag-hint');});
document.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
  const handled=['KeyW','KeyA','KeyS','KeyD','KeyE','KeyQ','KeyF','KeyM','KeyP','Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft','ShiftRight','Escape'];if(handled.includes(e.code)&&screen!=='title')e.preventDefault();
  if(e.code==='Escape'){if(modal)closeModal();else if(screen==='game')openModal('pause');return;}
  if(e.code==='KeyM'&&screen==='game'&&!photo){if(modal==='map')closeModal();else if(!modal)openModal('map');return;}
  if(screen!=='game'||modal)return;if(e.repeat){if(['KeyW','KeyA','KeyS','KeyD','KeyE','ShiftLeft','ShiftRight'].includes(e.code))keys.add(e.code);return;}
  keys.add(e.code);if(e.code==='KeyQ')pulse();if(e.code==='KeyF')lure();if(e.code==='KeyP')togglePhoto();if(e.code==='Space')jump();
});
document.addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{safeInputState();if(screen==='game'&&!modal)openModal('pause');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='game'&&!modal)openModal('pause');});
addEventListener('pagehide',saveGame);

$('begin').onclick=()=>start(false);$('continue').onclick=()=>start(true);$('resume').onclick=closeModal;$('menu-button').onclick=()=>openModal('pause');$('quit').onclick=()=>{saveGame();title();};$('restart').onclick=()=>start(false);$('checkpoint').onclick=checkpoint;$('end-title-button').onclick=title;
for(const [id,name]of[['guide-title','guide'],['guide-pause','guide'],['settings-title','settings'],['settings-pause','settings'],['credits-title','credits'],['minimap-button','map'],['map-pause','map']])$(id).onclick=()=>openModal(name);
document.querySelectorAll('.close-modal').forEach(b=>b.onclick=closeModal);$('dismiss-tutorial').onclick=()=>show('tutorial',false);
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(m=>m.classList.toggle('selected',m===b));$('begin').innerHTML=mode==='wander'?'Enter the wild <span>↗</span>':'Begin expedition <span>↗</span>';$('mode-description').textContent=mode==='wander'?'NO CLOCK. NO DAMAGE. JUST DISCOVERY.':'8 MINUTES TO MAKE IT HOME';});
$('sound-top').onclick=()=>{audio.start();settings.volume=settings.volume>0?0:.55;audio.setVolume(settings.volume);persistSettings();};
$('quality').onchange=e=>{settings.quality=e.target.value;world.setQuality(settings.quality);persistSettings();};$('volume').oninput=e=>{audio.start();settings.volume=Number(e.target.value);audio.setVolume(settings.volume);persistSettings();};$('sensitivity').oninput=e=>{settings.sensitivity=Number(e.target.value);persistSettings();};$('invert').onchange=e=>{settings.invert=e.target.checked;persistSettings();};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('fullscreen').textContent='Fullscreen unavailable in this window';}};
const pad=$('move-pad');pad.addEventListener('pointerdown',e=>{e.preventDefault();pad.setPointerCapture(e.pointerId);moveTouch=e.pointerId;updatePad(e);});pad.addEventListener('pointermove',e=>{if(e.pointerId===moveTouch)updatePad(e);});
function updatePad(e){const r=pad.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/40,dy=(e.clientY-r.top-r.height/2)/40,len=Math.max(1,Math.hypot(dx,dy));touchMove={x:dx/len,y:dy/len};pad.querySelector('i').style.transform=`translate(${touchMove.x*28}px,${touchMove.y*28}px)`;}
for(const event of['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(event,()=>{moveTouch=null;touchMove={x:0,y:0};pad.querySelector('i').style.transform='';});
$('touch-pulse').onclick=pulse;$('touch-lure').onclick=lure;
for(const [id,key]of[['touch-interact','KeyE'],['touch-run','ShiftLeft']]){const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(key);});for(const name of['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,()=>keys.delete(key));}

function frame(ms){requestAnimationFrame(frame);const dt=Math.min(.05,(ms-lastTime)/1000||.016);lastTime=ms;globalTime+=dt;if(!world||screen==='loading')return;
  const active=screen==='game'&&!modal&&!photo;if(state)state.running=active;
  if(active)updateGame(dt);else if(screen==='title'||screen==='end')world.cinematic(globalTime);else if(photo&&state)world.camera.rotation.set(state.pitch,state.yaw,0,'YXZ');
  world.update(active?dt:0,globalTime,state);world.render();audio.ambient(globalTime);
  uiTick+=dt;if(uiTick>.09){uiTick=0;if(screen==='game'&&!photo)updateHud();}
  if(toastUntil&&globalTime>toastUntil){toastUntil=0;show('event-toast',false);}
}
async function boot(){try{persistSettings();syncSettings();world=new ForestWorld($('world'),settings,(p,message)=>{$('loading-progress').style.width=p*100+'%';$('loading-label').textContent=message;});
  const canvas=world.renderer.domElement;canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{if(screen!=='game'||modal)return;if(e.pointerType==='touch'){isTouch=true;show('touch-controls',true);lookTouch={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}else{isDragging=true;captureMouse();}});canvas.addEventListener('pointermove',e=>{if(lookTouch?.id===e.pointerId){moveLook(e.clientX-lookTouch.x,e.clientY-lookTouch.y);lookTouch.x=e.clientX;lookTouch.y=e.clientY;}});for(const name of['pointerup','pointercancel'])canvas.addEventListener(name,e=>{isDragging=false;if(lookTouch?.id===e.pointerId)lookTouch=null;});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(screen==='game')saveGame();show('error');$('error-message').textContent='Your graphics context was interrupted. Your latest progress is saved. Reload to return to the forest.';});
  await world.ready;buildMapBase();show('loading',false);title();requestAnimationFrame(frame);
}catch(e){console.error(e);show('loading',false);show('error');$('error-message').textContent='This expedition needs WebGL 2. Try Chrome or Edge with graphics acceleration enabled, then reload. '+e.message;}}
boot();
