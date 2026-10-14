import {analyze,stretchAudio,alignPhase,mixAudio,encodeWav,encodeMp3} from './audio-engine.js';
let original=null,sampleRate=44100,cache=null;
self.onmessage=({data})=>{const {id,type}=data;const progress=(value,label)=>self.postMessage({id,type:'progress',value,label});try{
  if(type==='load'){original=data.channels;sampleRate=data.sampleRate;cache=null;const analysis=analyze(original,sampleRate,p=>progress(p*100,'正在识别歌曲节奏'));self.postMessage({id,type:'analyzed',analysis});}
  if(type==='generate'){
    if(!original)throw new Error('请先选择歌曲。');
    const {target,sourceBpm,volume}=data;if(!Number.isFinite(sourceBpm)||sourceBpm<40||sourceBpm>260)throw new Error('原曲 BPM 请输入 40 到 260 之间的数字。');
    if(!Number.isInteger(target)||target<160||target>210)throw new Error('目标步频请输入 160–210 之间的整数。');const key=`${target}/${sourceBpm}`;
    if(cache?.key!==key){progress(1,'正在保留音高调整节奏');const music=stretchAudio(original,sampleRate,target/sourceBpm,p=>progress(3+p*50,'正在保留音高调整节奏'));progress(55,'正在对齐歌曲与点声');const phase=alignPhase(music,sampleRate,target);cache={key,music,phase};}
    progress(64,'正在叠加点声');const mixed=mixAudio(cache.music,sampleRate,target,volume,cache.phase);
    const wav=encodeWav(mixed.channels,sampleRate);progress(68,'正在生成 MP3');const mp3=encodeMp3(mixed.channels,sampleRate,p=>progress(68+p*32,'正在生成 MP3'));
    self.postMessage({id,type:'generated',wav,mp3,duration:cache.music[0].length/sampleRate,target,volume,sourceBpm,clickCount:mixed.indices.length},[wav,mp3]);
  }
}catch(error){self.postMessage({id,type:'error',message:error.message||'处理失败，请重新选择歌曲。'});}};
