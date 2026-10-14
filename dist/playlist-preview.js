import {joinWavBlobs} from './merge-engine.js';
const time=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
export function createPlaylistPreview({audio,play,seek,elapsed,total,status}) {
  let version=0,key='',url=null,segments=[],ready=false;
  function refresh(){
    const duration=Number.isFinite(audio.duration)?audio.duration:segments.at(-1)?.next||0;
    const position=Number.isFinite(audio.currentTime)?audio.currentTime:0;
    seek.max=String(duration||1);seek.value=String(Math.min(position,duration));
    seek.style.setProperty('--played',`${duration?position/duration*100:0}%`);
    elapsed.textContent=time(position);total.textContent=time(duration);
    seek.setAttribute('aria-valuetext',`${time(position)}，共 ${time(duration)}`);
    play.textContent=audio.paused?'▷ 播放歌单':'Ⅱ 暂停';play.setAttribute('aria-label',audio.paused?'播放歌单':'暂停歌单');
    if(ready){const s=segments.find(s=>position>=s.start&&position<s.next);status.textContent=audio.ended?'已播放完毕，可拖动进度条重新试听。':s?(position<s.end?`当前歌曲：${s.item.name}`:`静音过渡 · ${s.gap} 秒`):'拖动进度条，从任意位置试听。';}
  }
  function release(){audio.pause();audio.removeAttribute('src');audio.load();if(url)URL.revokeObjectURL(url);url=null;ready=false;play.disabled=true;seek.disabled=true;refresh();}
  async function update(next){
    const nextKey=JSON.stringify(next.map(s=>[s.item.id,s.item.urls[1],s.gap]));
    if(nextKey===key)return;key=nextKey;const run=++version;segments=next;release();
    if(!next.length){status.textContent='生成并勾选歌曲后，即可在这里试听。';return;}
    status.textContent='正在准备歌单试听…';
    try{
      const blob=next.length===1?next[0].item.files.wav:await joinWavBlobs(next.map(s=>s.item.files.wav),next.slice(0,-1).map(s=>s.gap));
      if(run!==version)return;
      url=URL.createObjectURL(blob);audio.src=url;audio.load();
    }catch(error){if(run===version){key='';status.textContent='试听准备失败，请调整勾选后重试：'+error.message;}}
  }
  audio.addEventListener('loadedmetadata',()=>{if(!url||!Number.isFinite(audio.duration))return;ready=true;play.disabled=false;seek.disabled=false;refresh();});
  audio.addEventListener('error',()=>{if(!url)return;ready=false;play.disabled=true;seek.disabled=true;status.textContent='浏览器未能读取试听音频，请调整勾选后重试。';key='';});
  for(const event of ['timeupdate','play','pause','ended','seeked'])audio.addEventListener(event,refresh);
  play.onclick=async()=>{if(!ready)return;if(!audio.paused){audio.pause();return;}const run=version;try{if(audio.ended||audio.currentTime>=audio.duration)audio.currentTime=0;await audio.play();}catch{if(run===version)status.textContent='暂时无法播放，请再次点击播放歌单。';}};
  seek.oninput=()=>{if(!ready)return;audio.currentTime=Math.min(audio.duration,Math.max(0,Number(seek.value)));refresh();};
  return {update,dispose(){version++;segments=[];release();}};
}
