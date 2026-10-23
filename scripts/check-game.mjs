import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';

// Logic and scene-structure checks. This does not replace WebGL/browser QA.
const noop=()=>{};
const gradient={addColorStop:noop};
const drawing=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
const elements=new Map();
function element(id){if(elements.has(id))return elements.get(id);const e={id,style:{},classList:{toggle:noop,add:noop,remove:noop},textContent:'',innerHTML:'',value:'',checked:false,width:680,height:680,addEventListener:noop,querySelector:()=>element(id+'-child'),querySelectorAll:()=>[],getContext:()=>drawing,appendChild:noop,setAttribute:noop,requestPointerLock:noop};elements.set(id,e);return e;}
const storage=new Map();
const sandbox={THREE,console,assert,Math,Float32Array,Uint32Array,Uint16Array,ArrayBuffer,setTimeout:noop,clearTimeout:noop,innerWidth:1366,innerHeight:900,devicePixelRatio:1,window:{},document:{getElementById:element,createElement:tag=>element(tag+Math.random()),querySelectorAll:()=>[],addEventListener:noop,pointerLockElement:null,exitPointerLock:noop},matchMedia:()=>({matches:false}),addEventListener:noop,requestAnimationFrame:noop,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
const worldSource=fs.readFileSync(new URL('../dist/world.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const audioSource=fs.readFileSync(new URL('../dist/audio.js',import.meta.url),'utf8').replace(/^export /gm,'');
const mainSource=fs.readFileSync(new URL('../dist/main.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/\nboot\(\);\s*$/,'');
const checks=`
  let count=0;
  function check(value,label){assert.ok(value,label);count++;}
  world=Object.create(ForestWorld.prototype);
  Object.assign(world,{scene:new THREE.Scene(),colliders:[],relays:[],flowers:[],wisps:[],lures:[],settings:{quality:'medium'},floorMap:null,floorNormal:null,barkMap:null,rockMap:null,camera:new THREE.PerspectiveCamera(66,1.5,.1,500),renderer:{domElement:element('canvas')},glow:new THREE.Texture()});
  world.makeTerrain();world.makeForest();world.makeRocks();world.makeGrass();world.makeWater();world.makeLandmarks();world.makeFlowers();world.makeParticles();world.makeWisps();
  check(world.relays.length===3,'Three relays are created');
  check(world.flowers.length>=20,'Supply flowers populate the forest');
  check(world.wisps.length===4,'Four storm wisps patrol the map');
  check(world.colliders.length>500,'Trees and rocks have collision shapes');
  let meshes=0,triangles=0;
  world.scene.traverse(o=>{if(o.isMesh){meshes++;const p=o.geometry.attributes.position;for(const value of p.array)assert.ok(Number.isFinite(value),'Finite geometry');triangles+=(o.geometry.index?.count||p.count)/3*(o.isInstancedMesh?o.count:1);if(o.isInstancedMesh)for(const value of o.instanceMatrix.array)assert.ok(Number.isFinite(value),'Finite instance transforms');}});
  check(meshes>100,'Detailed scene contains scenery and equipment');
  for(const l of LANDMARKS){check(!world.colliders.some(c=>Math.hypot(c.x-l.x,c.z-l.z)<c.r+.6),l.name+' is accessible at its center');}
  const obstacles=world.colliders;
  for(const l of LANDMARKS){const visited=new Set(),queue=[[0,64]];let reachable=false;while(queue.length){const [x,z]=queue.shift();if(Math.hypot(x-l.x,z-l.z)<5){reachable=true;break;}for(const [dx,dz]of[[4,0],[-4,0],[0,4],[0,-4]]){const nx=x+dx,nz=z+dz,key=nx+','+nz;if(visited.has(key)||Math.abs(nx)>125||Math.abs(nz)>125)continue;visited.add(key);if(obstacles.some(c=>Math.hypot(nx-c.x,nz-c.z)<c.r+.8))continue;queue.push([nx,nz]);}}check(reachable,'Walkable route to '+l.name);}
  screen='game';modal=null;state=freshState('expedition');
  const before=state.remaining;updateGame(.5);check(state.remaining===before-.5,'Expedition countdown advances');
  state=freshState('wander');updateGame(.5);check(state.remaining===480,'Wander has no countdown');
  state=freshState('expedition');state.energy=10;doInteraction({type:'relay',index:0});check(!state.relays[0],'Insufficient energy cannot activate a relay');
  state.energy=100;doInteraction({type:'relay',index:0});check(state.relays[0]&&world.relays[0].active,'Relay activation updates gameplay and scene');check(state.energy===80,'Relay costs 20 resonance');
  state.energy=20;state.health=40;const luresBefore=state.lures;doInteraction({type:'flower',index:0});check(state.energy===55&&state.health===60,'Flowers restore resonance and vitality');check(state.lures===luresBefore+1,'Flowers replenish lures');doInteraction({type:'flower',index:0});check(state.flowers===1,'A flower cannot be collected twice');
  for(const i of[1,2]){state.energy=100;doInteraction({type:'relay',index:i});}check(state.target===3&&state.relays.every(Boolean),'After all relays, Base Camp becomes the objective');
  doInteraction({type:'rescue',index:3});check(screen==='end'&&state.completed,'Rescue reaches the victory screen');saveGame();check(!storage.has(STORAGE),'Completed expeditions are not resaved');
  screen='game';modal=null;state=freshState('expedition');world.reset();state.x=world.wisps[0].x;state.z=world.wisps[0].z;const healthBefore=state.health;updateGame(.1);check(state.health<healthBefore,'Storm contact damages vitality');
  state.mode='wander';const wanderHealth=state.health;updateGame(.1);check(state.health===wanderHealth,'Wander disables storm damage');
  state=freshState('expedition');state.remaining=.01;updateGame(.1);check(screen==='end'&&!state.completed,'Timeout reaches the failure screen');
  screen='game';modal=null;state=freshState('expedition');state.relays=[true,false,false];state.lastSafe=0;lastSafe=0;state.remaining=0;state.health=0;checkpoint();check(state.relays[0]&&state.remaining===180&&state.health===100,'Checkpoint preserves relays and restores survival resources');
  state.energy=100;const oldPulses=state.pulses;pulseCooldown=0;pulse();check(state.pulses===oldPulses+1&&state.energy===88,'Pulse costs energy and records its use');pulse();check(state.pulses===oldPulses+1,'Pulse cooldown prevents repeated spending');
  const oldLures=state.lures;lure();check(state.lures===oldLures-1&&world.lures.length===1,'Echo lure consumes a charge and creates a distraction');
  saveGame();check(validSave(JSON.parse(storage.get(STORAGE))),'Saved progress is resumable');
  console.log(JSON.stringify({checks:count,sceneMeshes:meshes,proceduralTriangles:Math.round(triangles),status:'passed',visualQA:'Not verified: managed preview WebGL is disabled'},null,2));
`;
sandbox.element=element;sandbox.storage=storage;
vm.runInNewContext(worldSource+'\n'+audioSource+'\n'+mainSource+'\n'+checks,sandbox,{timeout:25000});
