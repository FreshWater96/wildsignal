import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';

export const LANDMARKS = [
  {name:'The Sunken Grove', short:'GROVE', x:-42, z:10, color:0xe4b773, note:'The roots are carrying a signal. It sounds almost like a heartbeat.'},
  {name:'The Stone Crown', short:'CROWN', x:23, z:-59, color:0xe4b773, note:'The old surveyors heard it too. This place was never silent.'},
  {name:'Whispering Falls', short:'FALLS', x:79, z:22, color:0xe4b773, note:'Through water and stone, the basin is speaking again.'},
  {name:'Base Camp', short:'CAMP', x:0, z:65, color:0xf4a26e, note:'A signal home.'}
];
export const ROUTE = [[0,65],[-17,48],[-32,28],[-42,10],[-38,-10],[-15,-35],[23,-59],[48,-49],[69,-18],[79,22],[63,43],[39,55],[0,65]];
const UP = new THREE.Vector3(0,1,0);
const TAU=Math.PI*2;
let randomSeed=4177;
function rnd(){randomSeed=(randomSeed*1664525+1013904223)>>>0;return randomSeed/4294967296;}
function range(a,b){return a+(b-a)*rnd();}
export function streamX(z){return 34+Math.sin(z*.037)*14;}
export function pathDistance(x,z){let best=1e9;for(let i=0;i<ROUTE.length-1;i++){const a=ROUTE[i],b=ROUTE[i+1],dx=b[0]-a[0],dz=b[1]-a[1],t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);best=Math.min(best,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));}return best;}
export function groundHeight(x,z){
  let h=Math.sin(x*.032)*Math.cos(z*.038)*2.6+Math.sin(x*.09+z*.052)*.55+Math.cos(z*.12-x*.047)*.27;
  const sd=Math.abs(x-streamX(z));h-=2.2*Math.exp(-sd*sd/38);
  h+=4.8*Math.exp(-((x-22)**2+(z+59)**2)/1200);
  return h;
}
function textureCanvas(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
function glowTexture(){return textureCanvas(128,128,(c,w,h)=>{const g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,235,1)');g.addColorStop(.08,'rgba(255,255,225,.9)');g.addColorStop(.23,'rgba(255,255,225,.25)');g.addColorStop(1,'rgba(255,255,225,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});}
function leafTexture(){return textureCanvas(512,512,c=>{
  const leaves=[];
  function stem(x,y,len,angle,depth){const tx=x+Math.cos(angle)*len,ty=y+Math.sin(angle)*len;c.strokeStyle=depth>1?'#536c34':'#6c7f40';c.lineWidth=depth+1;c.beginPath();c.moveTo(x,y);c.lineTo(tx,ty);c.stroke();for(let j=1;j<=6;j++){const t=j/6,px=x+(tx-x)*t,py=y+(ty-y)*t;for(const side of [-1,1]){const a=angle+side*.65;const l=range(24,42)*(1-t*.35);leaves.push([px,py,l,a]);if(depth>0&&j%2===0)stem(px,py,len*.39,a,depth-1);}}}
  stem(255,490,325,-Math.PI/2,1);
  for(const[x,y,len,a]of leaves){c.save();c.translate(x,y);c.rotate(a);const g=c.createLinearGradient(0,-len*.25,0,len*.25);g.addColorStop(0,'#829950');g.addColorStop(.48,'#49692d');g.addColorStop(1,'#638142');c.fillStyle=g;c.beginPath();c.moveTo(0,0);c.bezierCurveTo(len*.35,-len*.42,len*.78,-len*.2,len,0);c.bezierCurveTo(len*.7,len*.3,len*.2,len*.32,0,0);c.fill();c.strokeStyle='#acb76c66';c.lineWidth=.8;c.beginPath();c.moveTo(0,0);c.lineTo(len*.9,0);c.stroke();c.restore();}
});}
function grassTexture(){return textureCanvas(128,256,c=>{for(let i=0;i<22;i++){const x=range(5,123),height=range(65,230),bend=range(-35,35);const g=c.createLinearGradient(0,256-height,0,256);g.addColorStop(0,'#a8ab60');g.addColorStop(.5,'#5c7738');g.addColorStop(1,'#31432a');c.fillStyle=g;c.beginPath();c.moveTo(x-3,256);c.quadraticCurveTo(x+bend*.3,256-height*.65,x+bend,256-height);c.quadraticCurveTo(x+bend*.1,256-height*.3,x+4,256);c.fill();}});}
function waterMaterial(vertical=false){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uTime:{value:0},uVertical:{value:vertical?1:0}},vertexShader:`varying vec2 vUv; varying vec3 vWorld; void main(){vUv=uv; vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,fragmentShader:`precision highp float;uniform float uTime;uniform float uVertical;varying vec2 vUv;varying vec3 vWorld;void main(){float rip=sin(vWorld.x*3.+vWorld.z*1.8-uTime*2.8)*sin(vWorld.z*5.+uTime*.8);float line=pow(max(0.,sin(vWorld.z*1.8-uTime*1.4+sin(vWorld.x*2.))),18.);vec3 c=mix(vec3(.10,.25,.22),vec3(.59,.75,.64),rip*.16+.26+line*.45);float a=.72;if(uVertical>.5){float f=sin(vUv.x*73.+sin(vUv.y*30.-uTime*5.))*sin(vUv.x*18.+uTime*.2);c=mix(vec3(.36,.62,.58),vec3(.82,.91,.83),f*.5+.5);a=(.3+f*.19)*smoothstep(0.,.07,vUv.x)*smoothstep(1.,.92,vUv.x);}gl_FragColor=vec4(c,a);}`});}

export class ForestWorld {
  constructor(container,settings,onProgress){
    this.container=container;this.settings=settings;this.colliders=[];this.relays=[];this.flowers=[];this.wisps=[];this.lures=[];this.time=0;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x879d8c);this.scene.fog=new THREE.FogExp2(0x829b89,.0105);
    this.camera=new THREE.PerspectiveCamera(66,innerWidth/innerHeight,.12,520);this.camera.rotation.order='YXZ';
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});
    this.renderer.setSize(innerWidth,innerHeight);this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    container.appendChild(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Wildsignal 3D wilderness');
    this.glow=glowTexture();this.sun=new THREE.DirectionalLight(0xffe8b3,3.4);this.sun.position.set(70,100,-55);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-105;this.sun.shadow.camera.right=105;this.sun.shadow.camera.top=105;this.sun.shadow.camera.bottom=-105;this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=260;this.sun.shadow.bias=-.0004;this.sun.shadow.normalBias=.06;this.scene.add(this.sun);
    this.ambient=new THREE.HemisphereLight(0xd5e2ce,0x37402b,2.0);this.scene.add(this.ambient);
    this.loader=new THREE.TextureLoader();this.ready=this.build(onProgress);this.setQuality(settings.quality);addEventListener('resize',()=>this.resize());
  }
  async build(progress){
    progress(.08,'Finding a clearing…');
    const paths=['forest-floor.jpg','ground-normal.jpg','bark.jpg','rock.jpg'];
    const textures=await Promise.all(paths.map(p=>this.loader.loadAsync('./assets/'+p).catch(()=>null)));
    [this.floorMap,this.floorNormal,this.barkMap,this.rockMap]=textures;
    for(const t of textures){if(t){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;}}
    if(this.floorMap){this.floorMap.colorSpace=THREE.SRGBColorSpace;this.floorMap.repeat.set(110,110);}if(this.floorNormal)this.floorNormal.repeat.set(110,110);
    if(this.barkMap){this.barkMap.colorSpace=THREE.SRGBColorSpace;this.barkMap.repeat.set(2,5);}if(this.rockMap){this.rockMap.colorSpace=THREE.SRGBColorSpace;this.rockMap.repeat.set(1.3,1.3);}
    this.makeTerrain();this.makeSky();progress(.25,'Growing the canopy…');await new Promise(r=>setTimeout(r,20));
    this.makeForest();this.makeRocks();this.makeGrass();progress(.5,'Following the river…');await new Promise(r=>setTimeout(r,20));
    this.makeWater();this.makeLandmarks();this.makeFlowers();this.makeParticles();this.makeWisps();progress(.7,'Unfolding the ferns…');
    await this.loadScannedPlants();progress(.95,'Tuning the last signal…');this.cinematic(0);this.render();progress(1,'The forest is ready.');
  }
  makeTerrain(){
    const geo=new THREE.PlaneGeometry(400,400,180,180);geo.rotateX(-Math.PI/2);const p=geo.attributes.position,colors=[];const c=new THREE.Color();
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,groundHeight(x,z));const path=pathDistance(x,z);const water=Math.abs(x-streamX(z));let light=.7+Math.sin(x*.18)*Math.sin(z*.18)*.11;if(path<3.3)light+=.25*(1-path/3.3);if(water<4)light*=.65;c.setRGB(light*.75,light*.89,light*.6);colors.push(c.r,c.g,c.b);}
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();const mat=new THREE.MeshStandardMaterial({map:this.floorMap,normalMap:this.floorNormal,normalScale:new THREE.Vector2(.65,.65),roughness:.96,vertexColors:true,color:0xc9d1b0});this.terrain=new THREE.Mesh(geo,mat);this.terrain.receiveShadow=true;this.scene.add(this.terrain);
    this.barkMat=new THREE.MeshStandardMaterial({map:this.barkMap,color:0x888b72,roughness:.98});this.stoneMat=new THREE.MeshStandardMaterial({map:this.rockMap,color:0x839179,roughness:.94});
  }
  makeSky(){
    const sky=new THREE.Mesh(new THREE.SphereGeometry(450,24,12),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(0x809d9a)},bottom:{value:new THREE.Color(0xc2ceb0)}},vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vP;uniform vec3 top;uniform vec3 bottom;void main(){float h=normalize(vP).y;float s=pow(max(0.,dot(normalize(vP),normalize(vec3(70.,100.,-55.)))),64.);gl_FragColor=vec4(mix(bottom,top,pow(max(0.,h),.45))+vec3(1.,.8,.4)*s*.6,1.);}`}));this.scene.add(sky);
    const sun=this.makeGlow(0xffdd92,34,.48);sun.position.set(120,178,-100);this.scene.add(sun);
  }
  makeForest(){
    const positions=[];
    for(let i=0;i<780;i++){const x=range(-175,175),z=range(-175,175);if(pathDistance(x,z)<4.4||Math.abs(x-streamX(z))<6||LANDMARKS.some(l=>Math.hypot(x-l.x,z-l.z)<8.5))continue;positions.push({x,z,h:range(12,25),r:range(.3,.76)});}
    positions.push({x:-10,z:53,h:24,r:1.1},{x:14,z:44,h:27,r:1.25},{x:-21,z:33,h:23,r:1.0},{x:23,z:74,h:24,r:.9},{x:-13,z:78,h:25,r:1.1});
    const trunkGeo=new THREE.CylinderGeometry(.54,1,1,9,5);const a=trunkGeo.attributes.position;for(let i=0;i<a.count;i++){const y=a.getY(i);a.setX(i,a.getX(i)*(1+.08*Math.sin(y*19+a.getZ(i)*11)));}trunkGeo.computeVertexNormals();
    const trunks=new THREE.InstancedMesh(trunkGeo,this.barkMat,positions.length);trunks.castShadow=true;trunks.receiveShadow=true;
    const branches=new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.4,1,6),this.barkMat,positions.length*6);branches.castShadow=true;branches.receiveShadow=true;
    const roots=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,5),this.barkMat,positions.length*3);roots.castShadow=true;
    const leafMat=new THREE.MeshStandardMaterial({map:leafTexture(),color:0xb8c58a,roughness:.86,alphaTest:.35,side:THREE.DoubleSide});
    leafMat.onBeforeCompile=shader=>{shader.uniforms.uWind={value:0};this.leafShader=shader;shader.vertexShader='uniform float uWind;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += sin(uWind*.6+position.y*2.+instanceMatrix[3].x*.1)*.035*max(0.,position.y+.5);');};
    const leaves=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),leafMat,positions.length*13);leaves.castShadow=true;leaves.receiveShadow=true;
    const m=new THREE.Object3D();const color=new THREE.Color();let bi=0,li=0,ri=0;
    for(let i=0;i<positions.length;i++){const t=positions[i],y=groundHeight(t.x,t.z);m.position.set(t.x,y+t.h/2,t.z);m.rotation.set(range(-.04,.04),rnd()*TAU,range(-.03,.03));m.scale.set(t.r,t.h,t.r);m.updateMatrix();trunks.setMatrixAt(i,m.matrix);color.setRGB(range(.65,.95),range(.73,.95),range(.65,.83));trunks.setColorAt(i,color);this.colliders.push({x:t.x,z:t.z,r:t.r*.9});
      for(let j=0;j<3;j++){const theta=j*TAU/3+i;m.position.set(t.x+Math.sin(theta)*t.r*.5,y+.7,t.z+Math.cos(theta)*t.r*.5);m.rotation.set(.24*Math.sin(theta),theta,.24*Math.cos(theta));m.scale.set(t.r*1.5,3,t.r*.42);m.updateMatrix();roots.setMatrixAt(ri++,m.matrix);}
      for(let j=0;j<6;j++){const theta=j*2.4+i,height=t.h*(.45+j*.078),len=range(3,5.7),end=new THREE.Vector3(t.x+Math.sin(theta)*len,y+height+len*.5,t.z+Math.cos(theta)*len),start=new THREE.Vector3(t.x,y+height,t.z);const dir=end.clone().sub(start);m.position.copy(start).addScaledVector(dir,.5);m.quaternion.setFromUnitVectors(UP,dir.clone().normalize());m.scale.set(t.r*.6,dir.length(),t.r*.6);m.updateMatrix();branches.setMatrixAt(bi++,m.matrix);
        for(let k=0;k<2;k++){m.position.set(end.x+range(-1,1),end.y+range(-.5,1.3),end.z+range(-1,1));m.rotation.set(-Math.PI/2+range(-.65,.65),range(-2,2),theta+k*1.5);m.scale.set(6.5,7.5,1);m.updateMatrix();leaves.setMatrixAt(li,m.matrix);color.setHSL(range(.21,.26),range(.2,.35),range(.35,.65));leaves.setColorAt(li++,color);}
      }
      m.position.set(t.x,y+t.h+1,t.z);m.rotation.set(-1.2,0,i);m.scale.set(7,7,1);m.updateMatrix();leaves.setMatrixAt(li,m.matrix);color.set(0xa9b67c);leaves.setColorAt(li++,color);
    }
    for(const mesh of[trunks,branches,roots,leaves]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();this.scene.add(mesh);}this.canopy=leaves;
    // A fallen trunk frames the approach to the grove without blocking its trail.
    const log=new THREE.Mesh(new THREE.CylinderGeometry(.65,.8,17,12),this.barkMat);log.rotation.z=1.42;log.rotation.y=-.6;log.position.set(-22,groundHeight(-22,20)+1.2,20);log.castShadow=true;log.receiveShadow=true;this.scene.add(log);
  }
  makeRocks(){
    const geo=new THREE.IcosahedronGeometry(1,2);const p=geo.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),s=1+.13*Math.sin(x*9+z*6)*Math.cos(y*8);p.setXYZ(i,x*s,y*s,z*s);}geo.computeVertexNormals();
    const pts=[];for(let i=0;i<230;i++){const x=range(-160,160),z=range(-160,160);if(pathDistance(x,z)<4.4||LANDMARKS.some(l=>Math.hypot(x-l.x,z-l.z)<6))continue;pts.push({x,z,s:range(.6,3.1)});}
    for(let i=0;i<32;i++){const a=i/32*TAU;pts.push({x:Math.sin(a)*158,z:Math.cos(a)*158,s:range(10,20)});}
    for(let i=0;i<12;i++)pts.push({x:72+range(-6,20),z:-1+range(-8,7),s:range(4,8)});
    const rocks=new THREE.InstancedMesh(geo,this.stoneMat,pts.length);rocks.castShadow=true;rocks.receiveShadow=true;const m=new THREE.Object3D();
    pts.forEach((p,i)=>{m.position.set(p.x,groundHeight(p.x,p.z)+p.s*.2,p.z);m.rotation.set(range(-1,1),range(0,TAU),range(-.3,.3));m.scale.set(p.s*1.2,p.s*.8,p.s);m.updateMatrix();rocks.setMatrixAt(i,m.matrix);this.colliders.push({x:p.x,z:p.z,r:p.s*.83});});rocks.computeBoundingSphere();this.scene.add(rocks);
  }
  makeGrass(){
    const mat=new THREE.MeshStandardMaterial({map:grassTexture(),alphaTest:.4,side:THREE.DoubleSide,color:0xb9c68d,roughness:1});const spots=[];
    for(let i=0;i<5600;i++){const x=range(-125,125),z=range(-125,125),pd=pathDistance(x,z);if(pd<2.2||Math.abs(x-streamX(z))<3.1||LANDMARKS.some(l=>Math.hypot(x-l.x,z-l.z)<3))continue;spots.push({x,z,s:range(.5,1.3)});}
    const grass=new THREE.InstancedMesh(new THREE.PlaneGeometry(1.3,1.2),mat,spots.length);grass.receiveShadow=true;const m=new THREE.Object3D();spots.forEach((p,i)=>{m.position.set(p.x,groundHeight(p.x,p.z)+p.s*.55,p.z);m.rotation.set(0,rnd()*TAU,0);m.scale.setScalar(p.s);m.updateMatrix();grass.setMatrixAt(i,m.matrix);});grass.computeBoundingSphere();this.scene.add(grass);this.grass=grass;
  }
  makeWater(){
    const verts=[],uvs=[],idx=[];for(let i=0;i<=190;i++){const z=-190+i*2,x=streamX(z);for(const s of[-1,1]){verts.push(x+s*2.65,groundHeight(x,z)+.42,z);uvs.push(s===-1?0:1,i/190); }if(i<190){const j=i*2;idx.push(j,j+2,j+1,j+1,j+2,j+3);}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(idx);geo.computeVertexNormals();this.waterMat=waterMaterial();this.scene.add(new THREE.Mesh(geo,this.waterMat));
    const pool=new THREE.Mesh(new THREE.CircleGeometry(8,48),this.waterMat);pool.rotation.x=-Math.PI/2;pool.position.set(80,groundHeight(80,11)+.1,11);this.scene.add(pool);
    this.fallMat=waterMaterial(true);const waterfall=new THREE.Mesh(new THREE.PlaneGeometry(5,14,6,12),this.fallMat);waterfall.position.set(80,groundHeight(80,5)+6,5);this.scene.add(waterfall);
    const plank=new THREE.MeshStandardMaterial({map:this.barkMap,color:0xa7986c,roughness:1});for(const z of[55,-57]){const x=streamX(z);for(let j=0;j<14;j++){const m=new THREE.Mesh(new THREE.BoxGeometry(.53,.15,3.2),plank);m.position.set(x-3.5+j*.55,groundHeight(x,z)+1.35,z);m.castShadow=true;m.receiveShadow=true;this.scene.add(m);}const y=groundHeight(x,z)+1.32;this.bridges=this.bridges||[];this.bridges.push({x,z,y});}
    // Soft shafts of morning light between the canopy layers.
    const beamGeo=new THREE.PlaneGeometry(5,44);const beamTex=textureCanvas(32,128,(c,w,h)=>{const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'#ffffff00');g.addColorStop(.5,'#ffffff25');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,w,h);});
    this.beams=new THREE.Group();for(let i=0;i<13;i++){const mat=new THREE.MeshBasicMaterial({map:beamTex,color:0xe7e6a5,transparent:true,opacity:.15,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});const beam=new THREE.Mesh(beamGeo,mat);beam.position.set(-35+i*8,17,range(-48,50));beam.rotation.z=-.47;beam.rotation.y=.7;this.beams.add(beam);}this.scene.add(this.beams);
  }
  makeGlow(color,size,opacity=.7){const m=new THREE.SpriteMaterial({map:this.glow,color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending});const s=new THREE.Sprite(m);s.scale.set(size,size,1);return s;}
  mesh(geometry,material,position,parent=this.scene){const m=new THREE.Mesh(geometry,material);if(position)m.position.copy(position);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  makeLandmarks(){
    const dark=new THREE.MeshStandardMaterial({color:0x35443b,metalness:.72,roughness:.6});const bronze=new THREE.MeshStandardMaterial({color:0x94714b,metalness:.65,roughness:.48});
    LANDMARKS.slice(0,3).forEach((l,i)=>{
      const group=new THREE.Group();group.position.set(l.x,groundHeight(l.x,l.z),l.z);this.scene.add(group);
      this.mesh(new THREE.CylinderGeometry(1.65,1.9,.4,10),this.stoneMat,new THREE.Vector3(0,.1,0),group);this.mesh(new THREE.CylinderGeometry(.62,.8,2.3,8),dark,new THREE.Vector3(0,1.35,0),group);
      const ring=this.mesh(new THREE.TorusGeometry(1.25,.11,8,40),bronze,new THREE.Vector3(0,3.1,0),group);ring.rotation.y=i*.9;
      const crystalMat=new THREE.MeshStandardMaterial({color:0xe4bf79,emissive:0xe4ad58,emissiveIntensity:1.7,metalness:.4,roughness:.2});const core=this.mesh(new THREE.OctahedronGeometry(.45,0),crystalMat,new THREE.Vector3(0,3.1,0),group);core.scale.y=1.5;
      const glow=this.makeGlow(0xf2bc70,7,.68);glow.position.set(0,3.1,0);group.add(glow);const light=new THREE.PointLight(0xffbf67,14,12,2);light.position.set(0,3,0);group.add(light);
      for(let j=0;j<5;j++){const a=j/5*TAU;const stone=this.mesh(new THREE.BoxGeometry(.65,range(2,3.4),.5),this.stoneMat,new THREE.Vector3(Math.sin(a)*3.6,1,Math.cos(a)*3.6),group);stone.rotation.set(.05,a,.1);}
      const shelter=this.mesh(new THREE.TorusGeometry(6.7,.055,5,80),new THREE.MeshBasicMaterial({color:0xb8e9a2,transparent:true,opacity:0}),new THREE.Vector3(0,.18,0),group);shelter.rotation.x=-Math.PI/2;shelter.visible=false;
      const beam=new THREE.Mesh(new THREE.CylinderGeometry(.025,.11,34,6,1,true),new THREE.MeshBasicMaterial({color:0xf3cb89,transparent:true,opacity:.14,depthWrite:false,blending:THREE.AdditiveBlending}));beam.position.y=20;group.add(beam);
      this.relays.push({group,ring,core,glow,light,shelter,beam,active:false});
    });
    // An old stone arch above the first relay.
    const a=LANDMARKS[0],ay=groundHeight(a.x,a.z);for(const side of[-1,1]){const m=this.mesh(new THREE.BoxGeometry(2,8,2),this.stoneMat,new THREE.Vector3(a.x+side*5,ay+3,a.z-3));m.rotation.z=side*.13;}
    const lintel=this.mesh(new THREE.BoxGeometry(12,2.3,2.7),this.stoneMat,new THREE.Vector3(a.x,ay+7.3,a.z-3));lintel.rotation.z=.035;
    // Stone crown silhouettes on the high ridge.
    for(let i=0;i<6;i++){const theta=i/6*TAU,x=23+Math.sin(theta)*7.5,z=-59+Math.cos(theta)*7.5;const m=this.mesh(new THREE.CylinderGeometry(.5,1.1,5+i%3,5),this.stoneMat,new THREE.Vector3(x,groundHeight(x,z)+2,z));m.rotation.z=Math.sin(theta)*.14;}
    this.makeCamp();
  }
  makeCamp(){
    const camp=LANDMARKS[3];this.camp=new THREE.Group();this.camp.position.set(camp.x,groundHeight(camp.x,camp.z),camp.z);this.scene.add(this.camp);
    const pole=new THREE.MeshStandardMaterial({color:0x38483e,metalness:.65,roughness:.5});const orange=new THREE.MeshStandardMaterial({color:0xb76b3a,roughness:.85,side:THREE.DoubleSide});
    this.mesh(new THREE.CylinderGeometry(.09,.13,7,8),pole,new THREE.Vector3(0,3.5,0),this.camp);
    const dish=this.mesh(new THREE.TorusGeometry(.85,.06,6,24),pole,new THREE.Vector3(0,5.7,0),this.camp);dish.rotation.x=.4;this.mesh(new THREE.BoxGeometry(2,.08,.08),pole,new THREE.Vector3(0,6.4,0),this.camp);
    const light=this.makeGlow(0xffa65a,5,.9);light.position.y=7;this.camp.add(light);this.campLight=light;
    this.mesh(new THREE.BoxGeometry(1.1,1.4,.65),orange,new THREE.Vector3(.5,.9,0),this.camp);
    const tentGeo=new THREE.BufferGeometry();tentGeo.setAttribute('position',new THREE.Float32BufferAttribute([-1.9,0,-2,0,2,-2,-1.9,0,2,0,2,-2,0,2,2,-1.9,0,2,0,2,-2,1.9,0,-2,0,2,2,1.9,0,-2,1.9,0,2,0,2,2,-1.9,0,-2,1.9,0,-2,0,2,-2],3));tentGeo.computeVertexNormals();const tent=this.mesh(tentGeo,orange,new THREE.Vector3(6,0,1),this.camp);tent.rotation.y=-.35;
    for(let i=0;i<3;i++)this.mesh(new THREE.BoxGeometry(1.1,.65,.7),pole,new THREE.Vector3(3+i*.75,.4,-2+i*.2),this.camp);
    const lamp=new THREE.PointLight(0xffae5f,18,13);lamp.position.set(0,2,0);this.camp.add(lamp);
  }
  makeFlowers(){
    const stalkMat=new THREE.MeshStandardMaterial({color:0x527745,roughness:1});const petalMat=new THREE.MeshStandardMaterial({color:0x92dfdf,emissive:0x3aacae,emissiveIntensity:1.7,roughness:.45});
    const flowerPositions=[[-7,57],[-23,37],[-39,23],[-40,-5],[-20,-28],[12,-53],[42,-51],[64,-30],[77,4],[73,36],[48,50],[19,60]];
    for(let i=0;i<18;i++)flowerPositions.push([range(-80,100),range(-85,85)]);
    flowerPositions.forEach(([x,z],i)=>{if(Math.abs(x-streamX(z))<4)x-=6;const group=new THREE.Group();group.position.set(x,groundHeight(x,z),z);this.scene.add(group);for(let j=0;j<4;j++){const theta=j*2.1;const h=.7+(j%2)*.3;this.mesh(new THREE.CylinderGeometry(.018,.035,h,4),stalkMat,new THREE.Vector3(Math.sin(theta)*.35,h/2,Math.cos(theta)*.35),group);const petal=this.mesh(new THREE.OctahedronGeometry(.17),petalMat,new THREE.Vector3(Math.sin(theta)*.35,h,Math.cos(theta)*.35),group);petal.scale.set(1.4,.7,1.4);}const glow=this.makeGlow(0x8ee7d2,2.2,.5);glow.position.y=.8;group.add(glow);this.flowers.push({x,z,group,glow,collected:false,id:i});});
  }
  makeParticles(){
    const count=480,pos=new Float32Array(count*3),col=new Float32Array(count*3);this.flyBase=[];
    for(let i=0;i<count;i++){const x=range(-100,120),z=range(-110,110),y=groundHeight(x,z)+range(.5,9);pos.set([x,y,z],i*3);col.set([1,.82+Math.random()*.14,.42],i*3);this.flyBase.push({x,y,z,phase:range(0,TAU)});}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));this.fireflies=new THREE.Points(geo,new THREE.PointsMaterial({map:this.glow,size:.55,transparent:true,vertexColors:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.8}));this.scene.add(this.fireflies);
    const trailPos=new Float32Array(120*3);const trailGeo=new THREE.BufferGeometry();trailGeo.setAttribute('position',new THREE.BufferAttribute(trailPos,3));this.trail=new THREE.Points(trailGeo,new THREE.PointsMaterial({map:this.glow,color:0xffdb8b,size:.7,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));this.trail.frustumCulled=false;this.scene.add(this.trail);this.trailLife=0;
    this.pulseRing=new THREE.Mesh(new THREE.RingGeometry(.96,1,96),new THREE.MeshBasicMaterial({color:0xddf6ba,side:THREE.DoubleSide,transparent:true,opacity:0,depthWrite:false}));this.pulseRing.rotation.x=-Math.PI/2;this.scene.add(this.pulseRing);this.pulseAge=100;
    const rainPos=new Float32Array(700*6);for(let i=0;i<700;i++){rainPos.set([range(-45,45),range(0,30),range(-45,45),0,0,0],i*6);rainPos[i*6+3]=rainPos[i*6];rainPos[i*6+4]=rainPos[i*6+1]-.8;rainPos[i*6+5]=rainPos[i*6+2];}const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));this.rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:0xc8d9c6,transparent:true,opacity:0,depthWrite:false}));this.rain.frustumCulled=false;this.scene.add(this.rain);
  }
  makeWisps(){
    const homes=[{x:-65,z:-15},{x:38,z:-24},{x:94,z:46},{x:7,z:-93}];
    homes.forEach((h,i)=>{const group=new THREE.Group();group.position.set(h.x,groundHeight(h.x,h.z)+2,h.z);this.scene.add(group);const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.28,1),new THREE.MeshBasicMaterial({color:0xe69179}));group.add(core);const glow=this.makeGlow(0xef7353,4,.7);group.add(glow);for(let j=0;j<3;j++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.7+j*.22,.013,4,40),new THREE.MeshBasicMaterial({color:0xe38b71,transparent:true,opacity:.45}));ring.rotation.set(j*1.2,.5+j,0);group.add(ring);}this.wisps.push({group,x:h.x,z:h.z,home:h,index:i,chase:false});});
  }
  async loadScannedPlants(){
    const loader=new GLTFLoader();
    try{const asset=await loader.loadAsync('./assets/fern_02/fern_02.gltf');asset.scene.updateMatrixWorld(true);const variants=[];asset.scene.traverse(obj=>{if(obj.isMesh)variants.push(obj);});const positions=[];for(let i=0;i<500;i++){const x=range(-105,115),z=range(-110,105);if(pathDistance(x,z)<3||Math.abs(x-streamX(z))<4||LANDMARKS.some(l=>Math.hypot(x-l.x,z-l.z)<3))continue;positions.push({x,z,s:range(.9,2.1),r:range(0,TAU)});}for(const [variantIndex,src] of variants.entries()){const geom=src.geometry.clone();geom.applyMatrix4(src.matrixWorld);geom.computeBoundingBox();const bounds=geom.boundingBox,center=bounds.getCenter(new THREE.Vector3());geom.translate(-center.x,-bounds.min.y,-center.z);const subset=positions.filter((_,i)=>i%variants.length===variantIndex);const mat=src.material.clone();mat.side=THREE.DoubleSide;mat.roughness=1;mat.color.multiplyScalar(.85);const mesh=new THREE.InstancedMesh(geom,mat,subset.length);const m=new THREE.Object3D();subset.forEach((p,i)=>{m.position.set(p.x,groundHeight(p.x,p.z),p.z);m.rotation.set(0,p.r,0);m.scale.setScalar(p.s);m.updateMatrix();mesh.setMatrixAt(i,m.matrix);});mesh.receiveShadow=true;mesh.computeBoundingSphere();this.scene.add(mesh);}}
    catch(e){console.warn('Fern asset unavailable; procedural undergrowth remains.',e.message);}
    try{const asset=await loader.loadAsync('./assets/rock_moss_set_01/rock_moss_set_01.gltf');asset.scene.updateMatrixWorld(true);let parts=[];asset.scene.traverse(obj=>{if(obj.isMesh)parts.push(obj);});for(let i=0;i<18;i++){const src=parts[i%parts.length];if(!src)break;const geo=src.geometry.clone();geo.applyMatrix4(src.matrixWorld);geo.computeBoundingBox();const b=geo.boundingBox,center=b.getCenter(new THREE.Vector3());geo.translate(-center.x,-b.min.y,-center.z);const mesh=new THREE.Mesh(geo,src.material);const z=-85+i*10,x=streamX(z)+(i%2?5:-5);mesh.position.set(x,groundHeight(x,z)-.1,z);mesh.rotation.y=rnd()*TAU;mesh.scale.setScalar(range(.5,1.1));mesh.receiveShadow=true;mesh.castShadow=true;this.scene.add(mesh);}}
    catch(e){console.warn('Scanned rocks unavailable; terrain rocks remain.',e.message);}
  }
  activate(index,active=true){const r=this.relays[index];r.active=active;r.core.material.color.set(active?0xc5f5ad:0xe4bf79);r.core.material.emissive.set(active?0x92e78a:0xe4ad58);r.glow.material.color.set(active?0xbdf5a5:0xf2bc70);r.light.color.set(active?0xb8ed9d:0xffbf67);r.shelter.visible=active;r.shelter.material.opacity=active?.45:0;r.beam.material.color.set(active?0xbbef9a:0xf3cb89);r.beam.material.opacity=active?.25:.14;}
  pulse(x,z,target){this.pulseAge=0;this.pulseRing.position.set(x,groundHeight(x,z)+.35,z);this.trailLife=12;this.trailOrigin={x,z};this.trailTarget=target;}
  dropLure(x,z){const sprite=this.makeGlow(0xc4e3a0,4,.85);sprite.position.set(x,groundHeight(x,z)+.7,z);this.scene.add(sprite);this.lures.push({x,z,sprite,life:18});}
  reset(){this.relays.forEach((_,i)=>this.activate(i,false));this.flowers.forEach(f=>{f.collected=false;f.group.visible=true;});this.wisps.forEach(w=>{w.x=w.home.x;w.z=w.home.z;w.chase=false;});this.lures.forEach(l=>{this.scene.remove(l.sprite);l.sprite.material.dispose();});this.lures=[];this.trailLife=0;this.pulseAge=100;}
  playerGround(x,z){let y=groundHeight(x,z);for(const b of this.bridges||[])if(Math.abs(x-b.x)<4&&Math.abs(z-b.z)<1.7)y=Math.max(y,b.y+.1);return y;}
  move(x,z,dx,dz){let nx=THREE.MathUtils.clamp(x+dx,-137,137),nz=THREE.MathUtils.clamp(z+dz,-137,137);for(const c of this.colliders){const vx=nx-c.x,vz=nz-c.z,d2=vx*vx+vz*vz,min=c.r+.36;if(d2<min*min&&d2>.00001){const d=Math.sqrt(d2);nx=c.x+vx/d*min;nz=c.z+vz/d*min;}}return {x:nx,z:nz};}
  setQuality(q){this.settings.quality=q;const ratios={low:1,medium:1.35,high:1.8};this.renderer.setPixelRatio(Math.min(devicePixelRatio,ratios[q]||1.35));this.renderer.shadowMap.enabled=q!=='low';this.sun.shadow.mapSize.set(q==='high'?2048:1024,q==='high'?2048:1024);if(this.sun.shadow.map){this.sun.shadow.map.dispose();this.sun.shadow.map=null;}}
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);}
  cinematic(t){this.camera.position.set(7+Math.sin(t*.035)*1.5,groundHeight(7,74)+4.3,74+Math.cos(t*.027)*1.5);this.camera.lookAt(-20,groundHeight(-20,24)+4.6,24);}
  update(dt,t,state){
    this.time=t;if(this.leafShader)this.leafShader.uniforms.uWind.value=t;if(this.waterMat)this.waterMat.uniforms.uTime.value=t;if(this.fallMat)this.fallMat.uniforms.uTime.value=t;
    this.relays.forEach((r,i)=>{r.core.rotation.y=t*.55;r.core.position.y=3.1+Math.sin(t*1.3+i)*.09;r.glow.material.opacity=.6+Math.sin(t*1.3+i)*.12;r.ring.rotation.y=t*.08+i;});
    const fp=this.fireflies.geometry.attributes.position;this.flyBase.forEach((f,i)=>{fp.setXYZ(i,f.x+Math.sin(t*.32+f.phase)*1.3,f.y+Math.cos(t*.6+f.phase)*.4,f.z+Math.cos(t*.25+f.phase));});fp.needsUpdate=true;
    this.flowers.forEach((f,i)=>{f.glow.material.opacity=.38+Math.sin(t*2+i)*.13;});
    this.pulseAge+=dt;const size=1+this.pulseAge*30;this.pulseRing.scale.setScalar(size);this.pulseRing.material.opacity=Math.max(0,1-this.pulseAge/2)*.5;
    this.trailLife=Math.max(0,this.trailLife-dt);this.trail.material.opacity=Math.min(1,this.trailLife/2)*.9;
    if(this.trailLife>0&&this.trailTarget){const a=state?{x:state.x,z:state.z}:this.trailOrigin,b=this.trailTarget,p=this.trail.geometry.attributes.position;for(let i=0;i<120;i++){const d=i/119,x=THREE.MathUtils.lerp(a.x,b.x,d)+Math.sin(t*1.6+i*1.5)*.6,z=THREE.MathUtils.lerp(a.z,b.z,d)+Math.cos(t+i)*.6;p.setXYZ(i,x,this.playerGround(x,z)+.7+Math.sin(t*2+i)*.3,z);}p.needsUpdate=true;}
    this.lures=this.lures.filter(l=>{if(state?.running)l.life-=dt;l.sprite.material.opacity=Math.min(.9,l.life*.4)*(.7+Math.sin(t*8)*.3);if(l.life<=0){this.scene.remove(l.sprite);l.sprite.material.dispose();return false;}return true;});
    const storm=state&&state.mode==='expedition'?Math.max(0,1-state.remaining/480):0;
    this.rain.material.opacity=storm>.48?(storm-.48)*.32:0;
    if(state){this.rain.position.set(state.x,this.playerGround(state.x,state.z),state.z);const p=this.rain.geometry.attributes.position;for(let i=0;i<700;i++){let y=p.getY(i*2)-dt*17;if(y<0)y=30;p.setY(i*2,y);p.setY(i*2+1,y-.8);}p.needsUpdate=true;}
    const fogColor=new THREE.Color(0x829b89).lerp(new THREE.Color(0x435862),storm*.65);this.scene.fog.color.copy(fogColor);this.scene.fog.density=.0105+storm*.0045;this.sun.intensity=3.4-storm*1.7;
    this.wisps.forEach(w=>{w.group.position.set(w.x,this.playerGround(w.x,w.z)+1.8+Math.sin(t*1.4+w.index)*.3,w.z);w.group.rotation.y=t*.6;w.group.children.slice(2).forEach((r,j)=>{r.rotation.x=t*.4+j;r.rotation.z=t*.3-j;});});
  }
  render(){this.renderer.render(this.scene,this.camera);}
}
