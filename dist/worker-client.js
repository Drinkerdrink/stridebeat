const issue=(message,code)=>Object.assign(new Error(message),{code});
export function createWorkerClient(url,{factory=u=>new Worker(u,{type:'module'}),startupMs=20000,idleMs=60000,totalMs=240000}={}){
  let worker=null,starting=null,pending=null,readyPromise=null,ready=false,failure=null,sequence=0,running=false;
  function clearRequest(){if(!pending)return null;const p=pending;pending=null;clearTimeout(p.idle);clearTimeout(p.total);return p;}
  function stop(error=issue('已取消','CANCELLED')){
    failure=error;ready=false;
    const old=worker;worker=null;
    if(old){old.onmessage=old.onerror=old.onmessageerror=null;old.terminate();}
    if(starting){clearTimeout(starting.timer);starting.reject(error);starting=null;}
    clearRequest()?.reject(error);
  }
  function resetIdle(){if(!pending)return;clearTimeout(pending.idle);pending.idle=setTimeout(()=>stop(issue('音频处理暂时没有响应，请重新识别或重试。','WORKER_IDLE_TIMEOUT')),idleMs);}
  function ensureReady(){
    if(failure)return Promise.reject(failure);
    if(ready)return Promise.resolve();
    if(readyPromise)return readyPromise;
    readyPromise=new Promise((resolve,reject)=>{
      starting={resolve,reject,timer:setTimeout(()=>stop(issue('音频组件加载超时，请检查网络后重新识别。','WORKER_START_TIMEOUT')),startupMs)};
      try{
        worker=factory(url);
        worker.onerror=e=>{e.preventDefault?.();stop(issue('音频组件加载或运行失败，请点击“重新识别”重试。','WORKER_FAILED'));};
        worker.onmessageerror=()=>stop(issue('音频处理结果未能读取，请重试。','WORKER_MESSAGE_ERROR'));
        worker.onmessage=({data})=>{
          if(data.type==='ready'){
            ready=true;if(starting){clearTimeout(starting.timer);starting.resolve();starting=null;}return;
          }
          if(!pending||data.id!==pending.id)return;
          if(data.type==='progress'){resetIdle();pending.progress?.(data);return;}
          const p=clearRequest();if(data.type==='error')p.reject(new Error(data.message));else p.resolve(data);
        };
      }catch{stop(issue('浏览器未能启动音频组件，请重新识别。','WORKER_START_FAILED'));}
    });
    return readyPromise;
  }
  async function request(type,data={},progress){
    if(running)throw new Error('上一项音频处理尚未完成。');
    running=true;
    try{
      // Readiness is awaited before transferring the audio; early startup
      // errors cannot be lost while the main thread is decoding a new file.
      await ensureReady();
      if(failure)throw failure;
      return await new Promise((resolve,reject)=>{
        const id=++sequence;
        pending={id,resolve,reject,progress,total:setTimeout(()=>stop(issue('这次音频处理耗时过长，请重试。','WORKER_TOTAL_TIMEOUT')),totalMs)};
        resetIdle();
        const transfer=data.channels?data.channels.map(c=>c.buffer):data.wav?[data.wav]:[];
        try{worker.postMessage({type,id,...data},transfer);}catch{stop(issue('音频数据读取中断，请重新识别。','WORKER_SEND_FAILED'));}
      });
    }finally{running=false;}
  }
  return {request,stop};
}
