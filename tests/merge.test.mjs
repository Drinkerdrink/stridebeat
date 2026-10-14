import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {encodeWav} from '../dist/audio-engine.js';
import {joinWavBlobs,wavInfo,ContinuousMp3Encoder} from '../dist/merge-engine.js';
import {playlistSegments,reorderSelected,validCadence,gapFrames} from '../dist/playlist.js';
const sr=44100;
function tone(seconds,hz){const c=Float32Array.from({length:sr*seconds},(_,i)=>.3*Math.sin(2*Math.PI*hz*i/sr));return [c,c];}
const first=encodeWav(tone(2,330),sr),second=encodeWav(tone(3,660),sr),a=new Blob([first]),b=new Blob([second]);
const merged=await joinWavBlobs([a,b]),bytes=await merged.arrayBuffer(),info=wavInfo(bytes);
assert.equal(info.frames,5*sr);assert.equal(bytes.byteLength,44+5*sr*4);
assert.deepEqual(new Uint8Array(bytes,44,first.byteLength-44),new Uint8Array(first,44));
assert.deepEqual(new Uint8Array(bytes,first.byteLength),new Uint8Array(second,44));
const reverse=await (await joinWavBlobs([b,a])).arrayBuffer();assert.deepEqual(new Uint8Array(reverse,44,second.byteLength-44),new Uint8Array(second,44));
for(const gap of [0,.1,2.5,60]){
 const out=await (await joinWavBlobs([a,b],[gap])).arrayBuffer(),frames=gapFrames(gap);
 assert.equal(wavInfo(out).frames,5*sr+frames);
 assert.deepEqual(new Uint8Array(out,44,first.byteLength-44),new Uint8Array(first,44));
 assert.ok(new Uint8Array(out,first.byteLength,frames*4).every(x=>x===0));
 assert.deepEqual(new Uint8Array(out,first.byteLength+frames*4),new Uint8Array(second,44));
}
const silenceEncoder=new ContinuousMp3Encoder();silenceEncoder.addWav(first);silenceEncoder.addSilence(2.5);silenceEncoder.addWav(second);assert.equal(silenceEncoder.frames,7.5*sr);assert.ok(silenceEncoder.finish().byteLength>10000);
for(const value of [-1,61,NaN,Infinity]){await assert.rejects(()=>joinWavBlobs([a,b],[value]),/0–60/);assert.throws(()=>new ContinuousMp3Encoder().addSilence(value),/0–60/);}
const items=[{id:'a',duration:2,selected:true},{id:'x',duration:9,selected:false},{id:'b',duration:3,selected:true},{id:'c',duration:4,selected:true}],gaps=new Map([['a',2.5],['b',1],['c',60]]);
const reordered=reorderSelected(items,'c',0);assert.deepEqual(reordered.map(o=>o.id),['c','x','a','b']);
const timeline=playlistSegments(reordered.filter(o=>o.selected),gaps);assert.equal(timeline.at(-1).next,71.5);assert.equal(timeline.at(-1).gap,0);assert.deepEqual(timeline.map(s=>s.start),[0,64,68.5]);
for(const value of [160,177,210])assert.ok(validCadence(value));for(const value of [159,211,180.5,NaN])assert.ok(!validCadence(value));
const encoder=new ContinuousMp3Encoder();encoder.addWav(first);encoder.addWav(second);const mp3=encoder.finish();assert.equal(encoder.frames,5*sr);assert.ok(mp3.byteLength>10000);assert.throws(()=>encoder.finish(),/结束/);
await assert.rejects(()=>joinWavBlobs([a]),/至少/);await assert.rejects(()=>joinWavBlobs([a,new Blob([second.slice(0,-4)])]),/完整/);
mkdirSync('test-output',{recursive:true});writeFileSync('test-output/merged-test.mp3',new Uint8Array(mp3));writeFileSync('test-output/merged-test.wav',new Uint8Array(bytes));console.log('Merged WAV contents, order, duration, continuous MP3 encoding and invalid-input checks passed.');
