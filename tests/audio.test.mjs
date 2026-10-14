import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {analyze,stretchAudio,alignPhase,mixAudio,encodeWav,encodeMp3,fft,demoAudio,clickPreviewGain} from '../dist/audio-engine.js';
const sr=44100;
mkdirSync('test-output',{recursive:true});
const demo=demoAudio(sr),detected=analyze(demo,sr);
console.log('Demo detection',detected);
assert.ok(Math.abs(detected.bpm-125)<.15);
for(const bpm of [160,170,177,180,190,200,210]){
 const music=stretchAudio(demo,sr,bpm/125);
 assert.ok(Math.abs(music[0].length/sr-20*125/bpm)<.01);
 const phase=alignPhase(music,sr,bpm),mix=mixAudio(music,sr,bpm,40,phase);
 const a=analyze(music,sr);
 console.log('Target',bpm,'measured music',a.bpm,'duration',music[0].length/sr,'clicks',mix.indices.length);
 assert.ok(Math.abs(a.bpm-bpm)<.7);
 for(let i=1;i<mix.indices.length;i++)assert.ok(Math.abs((mix.indices[i]-mix.indices[i-1])/sr-60/bpm)<1.1/sr);
 const wav=encodeWav(mix.channels,sr);assert.equal(new DataView(wav).getUint32(24,true),sr);
 if(bpm===180){const mp3=encodeMp3(mix.channels,sr);assert.ok(mp3.byteLength>10000);writeFileSync('test-output/demo-180.mp3',new Uint8Array(mp3));writeFileSync('test-output/demo-180.wav',new Uint8Array(wav));}
 const silent=mixAudio(music,sr,bpm,0,phase),loud=mixAudio(music,sr,bpm,100,phase);assert.ok(loud.channels[0].every(Number.isFinite));let peak=0,diff=0;for(let i=0;i<music[0].length;i++){peak=Math.max(peak,Math.abs(loud.channels[0][i]));diff+=Math.abs(silent.channels[0][i]-mix.channels[0][i]);}assert.ok(peak<=.861);assert.ok(diff>1);
}
const sine=new Float32Array(sr*8);for(let i=0;i<sine.length;i++)sine[i]=.5*Math.sin(2*Math.PI*440*i/sr);
const shifted=stretchAudio([sine,sine],sr,1.6),real=new Float64Array(32768),imag=new Float64Array(32768);for(let i=0;i<real.length;i++)real[i]=shifted[0][sr+i]*(.5-.5*Math.cos(2*Math.PI*i/real.length));fft(real,imag);let max=0,bin=0;for(let k=10;k<2000;k++){let m=Math.hypot(real[k],imag[k]);if(m>max){max=m;bin=k;}}assert.ok(Math.abs(bin*sr/real.length-440)<2);console.log('Preserved pitch Hz',bin*sr/real.length);
assert.throws(()=>analyze([new Float32Array(sr*10)],sr),/静音/);
assert.throws(()=>mixAudio(demo,sr,150,40,0),/无效/);
assert.throws(()=>mixAudio(demo,sr,180,301,0),/无效/);
const normal=mixAudio(demo,sr,180,100,.1),boost=mixAudio(demo,sr,180,300,.1);
let normalTick=0,boostTick=0,boostPeak=0;
for(let i=sr;i<demo[0].length-sr;i++){
 normalTick=Math.max(normalTick,Math.abs(normal.channels[0][i]/normal.mixGain-demo[0][i]*normal.musicGain));
 boostTick=Math.max(boostTick,Math.abs(boost.channels[0][i]/boost.mixGain-demo[0][i]*boost.musicGain));
 boostPeak=Math.max(boostPeak,Math.abs(boost.channels[0][i]));
}
assert.ok(Math.abs(boostTick/normalTick-3)<.001,'300% must triple the click relative to music');
assert.ok(boostPeak<=.861);
assert.ok(boostTick*boost.mixGain>normalTick*normal.mixGain,'Boost must increase the exported click amplitude');
for(let v=1;v<=300;v++){assert.ok(clickPreviewGain(v)>clickPreviewGain(v-1));assert.ok(clickPreviewGain(v)<=.86);}
if(existsSync('test-output/reference.f32')){
 const raw=readFileSync('test-output/reference.f32'),stereo=new Float32Array(raw.buffer,raw.byteOffset,raw.length/4),channels=[new Float32Array(stereo.length/2),new Float32Array(stereo.length/2)];for(let i=0;i<channels[0].length;i++){channels[0][i]=stereo[i*2];channels[1][i]=stereo[i*2+1];}
 const a=analyze(channels,sr);console.log('USER SONG DETECTION',a);assert.ok(Math.abs(a.bpm-125.01)<.15);
 const music=stretchAudio(channels,sr,180/a.bpm),b=analyze(music,sr);console.log('USER SONG OUTPUT',b);assert.ok(Math.abs(b.bpm-180)<.2);
 const phase=alignPhase(music,sr,180),mix=mixAudio(music,sr,180,40,phase);writeFileSync('test-output/reference-180.wav',new Uint8Array(encodeWav(mix.channels,sr)));writeFileSync('test-output/reference-180.mp3',new Uint8Array(encodeMp3(mix.channels,sr)));
}
console.log('All audio checks passed.');
