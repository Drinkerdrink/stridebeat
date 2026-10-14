import { SoundTouch, SimpleFilter } from './vendor/soundtouch.js';
import { lamejs } from './vendor/lame.js';

const TAU = 2 * Math.PI;
export function fft(real, imag) {
  const n = real.length;
  for (let i=1,j=0;i<n;i++) { let bit=n>>1; for(;j&bit;bit>>=1) j^=bit; j^=bit; if(i<j){[real[i],real[j]]=[real[j],real[i]];[imag[i],imag[j]]=[imag[j],imag[i]];} }
  for(let len=2;len<=n;len<<=1){const angle=-TAU/len, wr=Math.cos(angle),wi=Math.sin(angle);for(let i=0;i<n;i+=len){let ur=1,ui=0;for(let j=0;j<len/2;j++){const a=i+j,b=a+len/2,vr=real[b]*ur-imag[b]*ui,vi=real[b]*ui+imag[b]*ur;real[b]=real[a]-vr;imag[b]=imag[a]-vi;real[a]+=vr;imag[a]+=vi;const next=ur*wr-ui*wi;ui=ur*wi+ui*wr;ur=next;}}}
}
function quantile(values, p){const sorted=Array.from(values).sort((a,b)=>a-b);return sorted[Math.floor((sorted.length-1)*p)]||1e-8;}
export function onsetPeaks(channels, sr, progress=()=>{}) {
  const ratio=4, fs=sr/ratio, n=1024, hop=128;
  const mono=new Float32Array(Math.floor(channels[0].length/ratio));
  let rms=0;
  for(let i=0;i<mono.length;i++){let v=0;for(let c=0;c<channels.length;c++)for(let k=0;k<ratio;k++)v+=channels[c][i*ratio+k]||0;mono[i]=v/(ratio*channels.length);rms+=mono[i]*mono[i];}
  if(Math.sqrt(rms/mono.length)<1e-5)throw new Error('这段音频接近静音，无法识别节拍。请换一首有清晰节奏的歌曲。');
  const count=Math.ceil(mono.length/hop), broad=new Float32Array(count),bass=new Float32Array(count),re=new Float64Array(n),im=new Float64Array(n),prev=new Float32Array(n/2),win=Float32Array.from({length:n},(_,i)=>.5-.5*Math.cos(TAU*i/n));
  for(let frame=0;frame<count;frame++){
    const start=frame*hop-n/2;
    for(let j=0;j<n;j++){re[j]=(mono[start+j]||0)*win[j];im[j]=0;}
    fft(re,im);
    for(let k=4;k<n/2;k++){const mag=Math.log1p(Math.hypot(re[k],im[k])*200/n),diff=Math.max(0,mag-prev[k]);broad[frame]+=diff;if(k*fs/n<=150)bass[frame]+=diff;prev[k]=mag;}
    if(frame%2000===0)progress(frame/count);
  }
  const bn=quantile(broad,.95),ln=quantile(bass,.95),env=Float32Array.from(broad,(x,i)=>ln>1e-5?bass[i]/ln+.08*x/bn:x/bn);
  const candidates=[];
  for(let i=1;i<count-1;i++)if(env[i]>env[i-1]&&env[i]>=env[i+1]&&env[i]>.32)candidates.push(i);
  candidates.sort((a,b)=>env[b]-env[a]);
  const blocked=new Uint8Array(count),chosen=[],radius=Math.floor(.16*fs/hop);
  for(const i of candidates){if(blocked[i])continue;chosen.push(i);blocked.fill(1,Math.max(0,i-radius),Math.min(count,i+radius+1));}
  chosen.sort((a,b)=>a-b);
  const dur=channels[0].length/sr,trim=dur>30?5:.5;
  const points=chosen.filter(i=>i*hop/fs>=trim&&i*hop/fs<dur-trim).map(i=>({t:i*hop/fs,w:Math.min(env[i],8)}));
  if(points.length<6)throw new Error('这段音乐的节奏太短或不够清晰。请使用至少 8 秒、有明显鼓点的歌曲。');
  return {points,duration:dur};
}
function projection(points,bpm){let re=0,im=0,sum=0;const freq=TAU*bpm/60;for(const p of points){re+=p.w*Math.cos(p.t*freq);im+=p.w*Math.sin(p.t*freq);sum+=p.w;}return {score:Math.hypot(re,im)/sum,phase:((Math.atan2(im,re)/freq)%(60/bpm)+60/bpm)%(60/bpm)};}
export function analyze(channels,sr,progress=()=>{}){
  const data=onsetPeaks(channels,sr,p=>progress(p*.45)), peaks=[];
  for(let bpm=65;bpm<=210;bpm+=.04){peaks.push({bpm,...projection(data.points,bpm)});if(peaks.length%100===0)progress(.45+.5*(bpm-65)/145);}
  peaks.sort((a,b)=>b.score-a.score);let best=peaks[0];
  const half=peaks.find(p=>Math.abs(p.bpm-best.bpm/2)<.15&&p.score>best.score*.88);
  if(half)best=half;
  const center=best.bpm;
  for(let b=center-.07;b<=center+.07;b+=.0005){const p=projection(data.points,b);if(p.score>best.score)best={bpm:b,...p};}
  const period=60/best.bpm, offsets=[];
  for(let start=5;start<data.duration-15;start+=20){const pts=data.points.filter(p=>p.t>=start&&p.t<start+20);if(pts.length<5)continue;const p=projection(pts,best.bpm);let diff=p.phase-best.phase;diff-=Math.round(diff/period)*period;offsets.push(diff);}
  const drift=offsets.length?Math.max(...offsets)-Math.min(...offsets):0;
  progress(1);return {...best,drift,stable:best.score>=.18&&drift<.09};
}
export function stretchAudio(channels,sr,rate,progress=()=>{}){
  if(!Number.isFinite(rate)||rate<.25||rate>5.25)throw new Error('变速比例超出范围，请检查原曲 BPM。');
  const len=channels[0].length,outLength=Math.round(len/rate),out=[new Float32Array(outLength),new Float32Array(outLength)];
  if(Math.abs(rate-1)<1e-7){out[0].set(channels[0]);out[1].set(channels[1]||channels[0]);return out;}
  const soundtouch=new SoundTouch();soundtouch.stretch.setParameters(sr,0,0,8);soundtouch.stretch.quickSeek=false;soundtouch.tempo=rate;soundtouch.pitch=1;
  // Explicit zero padding flushes the final algorithm window without cutting off the song.
  const paddedLength=len+Math.ceil(sr*.8);
  const source={extract(target,frames,pos){const got=Math.max(0,Math.min(frames,paddedLength-pos));for(let i=0;i<got;i++){target[2*i]=channels[0][pos+i]||0;target[2*i+1]=(channels[1]||channels[0])[pos+i]||0;}return got;}};
  const filter=new SimpleFilter(source,soundtouch),chunk=new Float32Array(8192);let offset=0;
  while(offset<outLength){const got=filter.extract(chunk,Math.min(4096,outLength-offset));if(!got)break;for(let i=0;i<got;i++){out[0][offset+i]=chunk[2*i];out[1][offset+i]=chunk[2*i+1];}offset+=got;if(offset%65536<4096)progress(offset/outLength);}
  if(offset<outLength-1024)throw new Error('音频变速未能完整完成，请重新选择歌曲后重试。');
  progress(1);return out;
}
export function alignPhase(channels,sr,bpm){const {points}=onsetPeaks(channels,sr);return projection(points,bpm).phase;}
export function tickSamples(sr){const tick=new Float32Array(Math.round(sr*.032));let peak=0;for(let i=0;i<tick.length;i++){const t=i/sr;tick[i]=(1-Math.exp(-t/.00025))*Math.exp(-t/.006)*(Math.sin(TAU*1550*t)+.35*Math.sin(TAU*2470*t))*Math.min(1,(tick.length-1-i)/(sr*.004));peak=Math.max(peak,Math.abs(tick[i]));}for(let i=0;i<tick.length;i++)tick[i]/=peak;return tick;}
export function mixAudio(channels,sr,bpm,volume,phase){
  if(!Number.isInteger(bpm)||bpm<160||bpm>210||!Number.isFinite(volume)||volume<0||volume>100)throw new Error('步频或点声音量无效。');
  const length=channels[0].length,out=channels.map(c=>new Float32Array(c)),tick=tickSamples(sr),indices=[];let peak=0;
  for(const c of out)for(const x of c)peak=Math.max(peak,Math.abs(x));
  const musicGain=peak>.76?.76/peak:1;
  for(const c of out)for(let i=0;i<c.length;i++)c[i]*=musicGain;
  const step=sr*60/bpm,gain=volume/100*.55;
  for(let k=0;;k++){const index=Math.round(phase*sr+k*step);if(index>=length-.02*sr)break;if(index<0)continue;indices.push(index);for(let i=0;i<tick.length&&index+i<length;i++)for(const c of out)c[index+i]+=tick[i]*gain;}
  peak=0;for(const c of out)for(const x of c)peak=Math.max(peak,Math.abs(x));
  const mixGain=peak>.86?.86/peak:1;
  for(const c of out){for(let i=0;i<c.length;i++){c[i]*=mixGain;const fade=Math.min(1,i/(sr*.004),(length-1-i)/(sr*.008));c[i]*=fade;}}
  return {channels:out,indices,musicGain,mixGain};
}
export function encodeWav(channels,sr){const len=channels[0].length,bytes=new ArrayBuffer(44+len*channels.length*2),v=new DataView(bytes);const str=(pos,s)=>{for(let i=0;i<s.length;i++)v.setUint8(pos+i,s.charCodeAt(i));};str(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels.length,true);v.setUint32(24,sr,true);v.setUint32(28,sr*channels.length*2,true);v.setUint16(32,channels.length*2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,bytes.byteLength-44,true);let pos=44;for(let i=0;i<len;i++)for(const c of channels){const x=Math.max(-1,Math.min(1,c[i]));v.setInt16(pos,Math.round(x*(x<0?32768:32767)),true);pos+=2;}return bytes;}
export function encodeMp3(channels,sr,progress=()=>{}){const encoder=new lamejs.Mp3Encoder(2,sr,192),chunks=[];const n=channels[0].length;for(let off=0;off<n;off+=1152){const count=Math.min(1152,n-off),l=new Int16Array(count),r=new Int16Array(count);for(let i=0;i<count;i++){l[i]=Math.round(Math.max(-1,Math.min(1,channels[0][off+i]))*32767);r[i]=Math.round(Math.max(-1,Math.min(1,(channels[1]||channels[0])[off+i]))*32767);}const buf=encoder.encodeBuffer(l,r);if(buf.length)chunks.push(new Uint8Array(buf));if(off%46080===0)progress(off/n);}const end=encoder.flush();if(end.length)chunks.push(new Uint8Array(end));const total=chunks.reduce((s,c)=>s+c.length,0),result=new Uint8Array(total);let pos=0;for(const c of chunks){result.set(c,pos);pos+=c.length;}progress(1);return result.buffer;}
export function demoAudio(sr=44100){const duration=20,n=duration*sr,l=new Float32Array(n),r=new Float32Array(n),bpm=125;for(let i=0;i<n;i++){const t=i/sr,beat=t*bpm/60,p=beat%1,e=Math.exp(-p*18),kick=Math.sin(TAU*(46*t+2.5*(1-Math.exp(-p*30))))*e*.4;const notes=[220,261.63,329.63,293.66],hz=notes[Math.floor(beat/4)%4],pad=(Math.sin(TAU*hz*t)+.3*Math.sin(TAU*hz*2*t))*.06;const pluck=Math.sin(TAU*hz*2*t)*Math.exp(-(beat*2%1)*8)*.07;const hat=Math.sin(TAU*6500*t)*Math.exp(-(beat*2%1)*55)*.04;const fade=Math.min(1,t/.01,(duration-t)/.2);l[i]=(kick+pad+pluck+hat)*fade;r[i]=(kick+pad+pluck*.85+hat)*fade;}return [l,r];}
