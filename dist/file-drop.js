export function setupFileDrop(panel,{isBusy,onFiles,onMessage}){
  let depth=0;
  const hasFiles=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
  const reset=()=>{depth=0;panel.classList.remove('file-dragover');};
  panel.addEventListener('dragenter',e=>{if(!hasFiles(e))return;e.preventDefault();depth++;if(!isBusy())panel.classList.add('file-dragover');});
  panel.addEventListener('dragover',e=>{if(!hasFiles(e))return;e.preventDefault();e.dataTransfer.dropEffect=isBusy()?'none':'copy';});
  panel.addEventListener('dragleave',e=>{if(!hasFiles(e))return;depth=Math.max(0,depth-1);if(!depth)reset();});
  panel.addEventListener('drop',e=>{
    if(!hasFiles(e))return;e.preventDefault();e.stopPropagation();reset();
    if(isBusy()){onMessage('正在处理歌曲，完成后即可继续拖入。');return;}
    onFiles(Array.from(e.dataTransfer.files));
  });
  // Prevent an accidental drop elsewhere from navigating away with unsaved audio.
  document.addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault();});
  document.addEventListener('drop',e=>{if(!hasFiles(e))return;e.preventDefault();reset();onMessage('请把歌曲拖到左侧输入列表中。');});
  window.addEventListener('dragend',reset);
  window.addEventListener('blur',reset);
}
