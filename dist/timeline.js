import {playlistSegments} from './playlist.js';
const stamp = n => {const tenths=Math.round(n*10);return `${Math.floor(tenths/600)}:${((tenths%600)/10).toFixed(1).padStart(4,'0')}`;};
const el = (tag, cls, text) => {const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
export function createTimeline({root, viewport, gaps, move, changeGap}) {
  let items=[], busy=false, drag=null;
  function render(next, locked=false) {
    items=next;busy=locked;
    const old=new Map([...root.querySelectorAll('.timeline-song')].map(n=>[n.dataset.id,n.getBoundingClientRect().left]));
    root.replaceChildren();
    document.getElementById('timeline-empty').hidden=!!items.length;
    const segments=playlistSegments(items,gaps);
    for (const [i,s] of segments.entries()) {
      const card=el('article','timeline-song');card.dataset.id=s.item.id;
      card.style.setProperty('--song-width',`${Math.min(300,210+s.item.duration/4)}px`);
      card.dataset.color=String(s.item.color || 0);card.classList.toggle('is-dragging',drag?.id===s.item.id);
      const grip=el('button','timeline-grip');grip.type='button';grip.disabled=busy;
      grip.setAttribute('aria-label',`拖动排序：${s.item.name}，也可使用左右方向键`);
      grip.append(el('span','timeline-track-number',`TRACK ${String(i+1).padStart(2,'0')}`),el('span','', '⠿'));
      const name=el('strong','timeline-name',s.item.name.replace(/\.[^.]+$/,''));name.title=s.item.name;
      grip.append(name,el('span','timeline-detail',`${s.item.target} 步 / 分钟 · ${stamp(s.item.duration)}`));
      const wave=el('span','timeline-wave');wave.setAttribute('aria-hidden','true');
      for(let j=0;j<32;j++){const bar=el('i','');bar.style.height=`${5+Math.abs(Math.sin(j*1.8+i)*Math.cos(j*.29))*23}px`;wave.append(bar);}grip.append(wave);
      grip.onpointerdown=e=>start(e,s.item.id,card);
      grip.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(s.item.id,i+(e.key==='ArrowLeft'?-1:1));focus(s.item.id);}};
      const footer=el('div','timeline-card-footer');footer.append(el('span','timeline-stamp',`${stamp(s.start)} — ${stamp(s.end)}`));
      for(const [text,offset] of [['←',-1],['→',1]]){const b=el('button','timeline-arrow',text);b.type='button';b.disabled=busy||i+offset<0||i+offset>=items.length;b.setAttribute('aria-label',`${offset<0?'左移':'右移'}歌曲：${s.item.name}`);b.onclick=()=>{move(s.item.id,i+offset);focus(s.item.id);};footer.append(b);}
      card.append(grip,footer);root.append(card);
      if(i<segments.length-1){
        const box=el('div','timeline-gap');box.style.width=`${100+Math.min(s.gap,60)}px`;
        box.append(el('span','gap-label','静音过渡'),el('span','gap-line','······'));
        const label=el('label','gap-value'),input=el('input','');input.type='number';input.min='0';input.max='60';input.step='0.1';input.value=s.gap;input.disabled=busy;input.setAttribute('aria-label',`${s.item.name}之后的静音过渡（秒）`);
        input.onchange=()=>{const v=Number(input.value);if(input.value===''||!Number.isFinite(v)||v<0||v>60){input.value=s.gap;document.getElementById('timeline-status').textContent='过渡时间请输入 0–60 秒。';return;}changeGap(s.item.id,Math.round(v*10)/10);};
        label.append(input,document.createTextNode('秒'));box.append(label,el('span','gap-range','0–60 秒'));root.append(box);
      }
    }
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)for(const card of root.querySelectorAll('.timeline-song')){const prev=old.get(card.dataset.id);if(prev!==undefined&&card.dataset.id!==drag?.id){const dx=prev-card.getBoundingClientRect().left;if(dx)card.animate([{transform:`translateX(${dx}px)`},{transform:'translateX(0)'}],{duration:210,easing:'ease-out'});}}
  }
  function focus(id){root.querySelector(`[data-id="${id}"] .timeline-grip`)?.focus({preventScroll:true});}
  function start(e,id,card){
    if(busy||e.button!==0||items.length<2)return;e.preventDefault();
    const rect=card.getBoundingClientRect(),ghost=card.cloneNode(true);ghost.classList.add('timeline-ghost');ghost.style.width=`${rect.width}px`;ghost.style.left=`${rect.left}px`;ghost.style.top=`${rect.top}px`;ghost.setAttribute('aria-hidden','true');document.body.append(ghost);card.classList.add('is-dragging');
    drag={id,ghost,pointer:e.pointerId,x:e.clientX,y:e.clientY,dx:e.clientX-rect.left,dy:e.clientY-rect.top,original:items.map(o=>o.id)};
    let frame;
    const reorder=()=>{if(!drag)return;const from=items.findIndex(o=>o.id===id),cards=[...root.querySelectorAll('.timeline-song')],origin=root.getBoundingClientRect().left;let to=from;
      for(const [i,n] of cards.entries()){if(i===from)continue;const center=origin+n.offsetLeft+n.offsetWidth/2;if(i>from&&drag.x>center)to=i;else if(i<from&&drag.x<center){to=i;break;}}
      if(to!==from)move(id,to);
    };
    const tick=()=>{if(!drag)return;const r=viewport.getBoundingClientRect(),before=viewport.scrollLeft;if(drag.x<r.left+48)viewport.scrollLeft-=12;else if(drag.x>r.right-48)viewport.scrollLeft+=12;if(before!==viewport.scrollLeft)reorder();frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
    const moving=ev=>{if(ev.pointerId!==drag?.pointer)return;drag.x=ev.clientX;drag.y=ev.clientY;ghost.style.left=`${ev.clientX-drag.dx}px`;ghost.style.top=`${ev.clientY-drag.dy}px`;
      reorder();
    };
    const end=ev=>{if(ev.pointerId!==undefined&&ev.pointerId!==drag?.pointer)return;cancelAnimationFrame(frame);window.removeEventListener('pointermove',moving);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',escape);ghost.remove();drag=null;render(items,busy);focus(id);};
    const cancel=ev=>{if(!drag)return;const original=drag.original;for(let i=0;i<original.length;i++)move(original[i],i);end(ev);};
    const escape=ev=>{if(ev.key==='Escape')cancel(ev);};
    window.addEventListener('pointermove',moving);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',escape);
  }
  return {render};
}
