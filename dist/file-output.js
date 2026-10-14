const $=id=>document.getElementById(id);
let directory=null;
const supported=typeof window.showDirectoryPicker==='function'&&window.isSecureContext;
function status(text,error=false){$('folder-status').textContent=text;$('folder-status').classList.toggle('error',error);}
export function setupOutputFolder(){
 $('choose-folder').disabled=!supported;
 if(!supported){$('folder-status').textContent='当前浏览器不支持选择文件夹，下载时使用浏览器默认目录。';$('choose-folder').textContent='当前浏览器不支持选择';}
 $('choose-folder').onclick=async()=>{try{const selected=await window.showDirectoryPicker({id:'stridebeat-output',mode:'readwrite'});directory=selected;$('folder-name').textContent=selected.name;$('folder-name').title='已授权的本地文件夹：'+selected.name;$('reset-folder').hidden=false;$('auto-save').disabled=false;$('auto-save').checked=true;status('已选择本地文件夹。浏览器仅显示文件夹名称；同名文件会自动编号。');}catch(error){if(error.name!=='AbortError')status('无法选择文件夹，可继续使用浏览器下载：'+error.message,true);}};
 $('reset-folder').onclick=()=>{directory=null;$('folder-name').textContent='浏览器默认下载目录';$('folder-name').title='';$('reset-folder').hidden=true;$('auto-save').checked=false;$('auto-save').disabled=true;status('点击输出列表中的下载按钮，将使用浏览器的下载目录。');};
}
async function writeUnique(blob,name){const chosen=directory;if(!chosen)return false;name=name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_');const dot=name.lastIndexOf('.'),base=(dot<0?name:name.slice(0,dot)).slice(0,180).replace(/[. ]+$/,''),ext=dot<0?'':name.slice(dot);name=base+ext;let candidate=name,handle;
 for(let i=1;i<1000;i++){try{await chosen.getFileHandle(candidate);candidate=`${base} (${i+1})${ext}`;}catch(error){if(error.name!=='NotFoundError')throw error;handle=await chosen.getFileHandle(candidate,{create:true});break;}}
 if(!handle)throw new Error('同名文件过多，请更换文件夹。');
 const writable=await handle.createWritable();try{await writable.write(blob);await writable.close();}catch(error){try{await writable.abort();}catch{}throw error;}return candidate;
}
export function attachDownload(anchor,blob,filename){anchor.download=filename;anchor.onclick=async event=>{if(anchor.getAttribute('aria-disabled')==='true'||anchor.getAttribute('aria-busy')==='true'){event.preventDefault();return;}if(!directory)return;event.preventDefault();try{anchor.setAttribute('aria-busy','true');const saved=await writeUnique(blob,filename);status(`已保存：${saved}`);}catch(error){status('保存失败，音频仍保留在输出列表。可切回默认下载目录后重试。',true);}finally{anchor.removeAttribute('aria-busy');}};}
export async function autoSave(files,baseName){if(!directory||!$('auto-save').checked)return false;const format=$('save-format').value;try{let count=0;for(const kind of ['mp3','wav']){if(format!=='both'&&format!==kind)continue;await writeUnique(files[kind],`${baseName}.${kind}`);count++;}status(`已自动保存 ${count} 个文件：${baseName}`);return true;}catch{status('自动保存未完成，音频已保留，可从输出列表重新下载。',true);return false;}}
