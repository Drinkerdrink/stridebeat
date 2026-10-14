// Optional private recordings stay in ignored test-output; never distribute them.
import assert from 'node:assert/strict';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {analyze,stretchAudio,alignPhase,mixAudio,encodeMp3} from '../dist/audio-engine.js';
const sr=44100;
function readPcm(path){const bytes=readFileSync(path),raw=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4),channels=[new Float32Array(raw.length/2),new Float32Array(raw.length/2)];for(let i=0;i<channels[0].length;i++){channels[0][i]=raw[2*i];channels[1][i]=raw[2*i+1];}return channels;}
if(existsSync('test-output/zhiwo-original.f32')){
 const original=readPcm('test-output/zhiwo-original.f32'),detected=analyze(original,sr);
 assert.ok(Math.abs(detected.bpm-168)<.1,'Syncopated bass must not force the 210 BPM boundary');
 const music=stretchAudio(original,sr,190/detected.bpm),measured=analyze(music,sr);
 // Measure music before clicks are added, so the metronome cannot mask a failure.
 assert.ok(Math.abs(measured.bpm-190)<.2);assert.ok(measured.drift<.06);
 const phase=alignPhase(music,sr,190),mixed=mixAudio(music,sr,190,200,phase);
 assert.ok(mixed.channels.every(c=>c.every(x=>Number.isFinite(x)&&Math.abs(x)<=.861)));
 for(let i=1;i<mixed.indices.length;i++)assert.ok(Math.abs((mixed.indices[i]-mixed.indices[i-1])/sr-60/190)<1.1/sr);
 assert.ok(Math.abs(music[0].length/sr-original[0].length/sr*168/190)<.01);
 writeFileSync('test-output/zhiwo-fixed-190-click200.mp3',new Uint8Array(encodeMp3(mixed.channels,sr)));
 console.log(JSON.stringify({original:detected,musicBeforeClicks:measured,duration:music[0].length/sr,phase,clickCount:mixed.indices.length,mixGain:mixed.mixGain},null,2));
}else console.log('Private recording regression skipped: no local fixture.');
