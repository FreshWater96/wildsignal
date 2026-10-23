export class ForestAudio {
  constructor(volume=.55){this.volume=volume;this.ctx=null;this.lastBird=0;}
  start(){if(this.ctx){this.ctx.resume().catch(()=>{});return;}try{const A=window.AudioContext||window.webkitAudioContext;this.ctx=new A();this.master=this.ctx.createGain();this.master.gain.value=this.volume*.5;this.master.connect(this.ctx.destination);const length=this.ctx.sampleRate*4,buffer=this.ctx.createBuffer(1,length,this.ctx.sampleRate),data=buffer.getChannelData(0);let v=0;for(let i=0;i<length;i++){v=(v+Math.random()*.1-.05)*.985;data[i]=v;}const wind=this.ctx.createBufferSource();wind.buffer=buffer;wind.loop=true;const low=this.ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=700;const gain=this.ctx.createGain();gain.gain.value=.18;wind.connect(low).connect(gain).connect(this.master);wind.start();this.noiseBuffer=buffer;}catch(e){this.ctx=null;}}
  setVolume(v){this.volume=v;if(this.master)this.master.gain.setTargetAtTime(v*.5,this.ctx.currentTime,.2);}
  tone(freq,duration=.5,type='sine',vol=.25,delay=0,endFreq=null){if(!this.ctx||this.ctx.state!=='running')return;const at=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,at);if(endFreq)o.frequency.exponentialRampToValueAtTime(endFreq,at+duration);g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(vol,at+.02);g.gain.exponentialRampToValueAtTime(.001,at+duration);o.connect(g).connect(this.master);o.start(at);o.stop(at+duration+.1);}
  pulse(){this.tone(180,1.8,'sine',.5,0,70);[440,660,880,1320].forEach((f,i)=>this.tone(f,1.3,'sine',.12,i*.11));}
  collect(){[550,824,1100].forEach((f,i)=>this.tone(f,.5,'sine',.18,i*.08));}
  relay(){[220,330,440,550,660,880].forEach((f,i)=>this.tone(f,2.5,'sine',.16,i*.2));}
  hurt(){this.tone(96,.4,'triangle',.3,0,42);}
  lure(){this.tone(680,.8,'sine',.2,0,220);}
  step(sprint=false){if(!this.ctx||!this.noiseBuffer)return;const s=this.ctx.createBufferSource(),g=this.ctx.createGain();s.buffer=this.noiseBuffer;g.gain.setValueAtTime(sprint?.12:.07,this.ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,this.ctx.currentTime+.15);s.connect(g).connect(this.master);s.start(0,Math.random()*2,.17);}
  ambient(t){if(!this.ctx||t-this.lastBird<5.5+Math.random()*4)return;this.lastBird=t;const f=1500+Math.random()*1400;this.tone(f,.18,'sine',.028,0,f*1.35);this.tone(f*1.1,.2,'sine',.02,.3,f*.9);}
}
