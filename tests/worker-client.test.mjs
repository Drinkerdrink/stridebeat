import assert from 'node:assert/strict';
import {createWorkerClient} from '../dist/worker-client.js';
class FakeWorker{
 constructor(init,reply){this.reply=reply;this.sent=0;this.timers=[];this.later(()=>init(this),0);}
 later(fn,ms){this.timers.push(setTimeout(fn,ms));}
 emit(data){this.onmessage?.({data});}
 postMessage(data){this.sent++;this.reply?.(this,data);}
 terminate(){this.terminated=true;this.timers.forEach(clearTimeout);}
}
function client(init,reply,options={}){
 let worker;const api=createWorkerClient('test-worker',{factory:()=>worker=new FakeWorker(init,reply),startupMs:80,idleMs:80,totalMs:400,...options});
 return {api,worker:()=>worker};
}
const ready=w=>w.emit({type:'ready'});
const success=(w,d)=>w.later(()=>w.emit({id:d.id,type:'done'}),1);
{
 const c=client(w=>w.onerror({preventDefault(){}}),success);
 await assert.rejects(c.api.request('load'),{code:'WORKER_FAILED'});
 assert.equal(c.worker().sent,0);assert.equal(c.worker().terminated,true);
 await assert.rejects(c.api.request('load'),{code:'WORKER_FAILED'});
}
{
 const c=client(()=>{},success,{startupMs:20});
 await assert.rejects(c.api.request('load'),{code:'WORKER_START_TIMEOUT'});assert.equal(c.worker().sent,0);
}
{
 const c=client(ready,w=>w.onerror({preventDefault(){}}));
 await assert.rejects(c.api.request('load'),{code:'WORKER_FAILED'});
}
{
 const c=client(ready,()=>{},{idleMs:20});
 await assert.rejects(c.api.request('load'),{code:'WORKER_IDLE_TIMEOUT'});assert.equal(c.worker().terminated,true);
}
{
 const c=client(ready,(w,d)=>{for(let t=10;t<=100;t+=10)w.later(()=>w.emit({id:d.id,type:'progress'}),t);w.later(()=>w.emit({id:d.id,type:'done'}),110);},{idleMs:40});
 let progress=0;await c.api.request('load',{},()=>progress++);assert.ok(progress>=5);c.api.stop();
}
{
 const c=client(ready,(w,d)=>{for(let t=5;t<150;t+=5)w.later(()=>w.emit({id:d.id,type:'progress'}),t);},{idleMs:60,totalMs:35});
 await assert.rejects(c.api.request('load'),{code:'WORKER_TOTAL_TIMEOUT'});
}
{
 const c=client(ready,()=>{throw new Error('postMessage failed');});
 await assert.rejects(c.api.request('load'),{code:'WORKER_SEND_FAILED'});
}
for(const stage of ['startup','processing']){
 const c=client(stage==='startup'?()=>{}:ready,()=>{}),p=c.api.request('load');
 const rejection=assert.rejects(p,{code:'CANCELLED'});
 if(stage==='processing')await new Promise(r=>setTimeout(r,5));
 c.api.stop();await rejection;
}
{
 const c=client(ready,(w,d)=>w.emit(d.type==='bad'?{id:d.id,type:'error',message:'invalid file'}:{id:d.id,type:'done'}));
 await assert.rejects(c.api.request('bad'),/invalid file/);await c.api.request('load');c.api.stop();
}
{
 const c=client(ready,success);await c.api.request('load');
 c.worker().onmessageerror();await assert.rejects(c.api.request('generate'),{code:'WORKER_MESSAGE_ERROR'});
}
console.log('Worker startup errors, ready handshake, inactivity/total timeouts, progress, cancellation, send failures and recovery passed.');
