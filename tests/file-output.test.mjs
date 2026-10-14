import assert from 'node:assert/strict';
const elements=new Map();
function el(id){if(!elements.has(id))elements.set(id,{textContent:'',value:id==='save-format'?'mp3':'',checked:false,disabled:false,hidden:false,title:'',classList:{toggle(){}},attrs:new Map(),setAttribute(k,v){this.attrs.set(k,v)},getAttribute(k){return this.attrs.get(k)||null},removeAttribute(k){this.attrs.delete(k)}});return elements.get(id);}
const files=new Map([['song.mp3',new Blob(['existing'])]]);
const directory={name:'测试输出',async getFileHandle(name,options){if(!files.has(name)&&!options?.create){const e=new Error('missing');e.name='NotFoundError';throw e;}if(!files.has(name))files.set(name,new Blob());return {async createWritable(){return {async write(blob){files.set(name,blob)},async close(){},async abort(){}}}}}};
globalThis.document={getElementById:el};globalThis.window={isSecureContext:true,showDirectoryPicker:async()=>directory};
const {setupOutputFolder,autoSave,attachDownload}=await import('../dist/file-output.js');setupOutputFolder();await el('choose-folder').onclick();assert.equal(el('folder-name').textContent,'测试输出');assert.equal(el('auto-save').checked,true);
const blobs={mp3:new Blob(['new mp3']),wav:new Blob(['new wav'])};await autoSave(blobs,'song');assert.equal(await files.get('song.mp3').text(),'existing');assert.equal(await files.get('song (2).mp3').text(),'new mp3');assert.equal(files.has('song.wav'),false);
el('save-format').value='both';await autoSave(blobs,'second');assert.ok(files.has('second.mp3')&&files.has('second.wav'));
const anchor=el('download-test');attachDownload(anchor,blobs.wav,'manual.wav');let prevented=false;await anchor.onclick({preventDefault(){prevented=true}});assert.ok(prevented&&files.has('manual.wav'));
anchor.setAttribute('aria-disabled','true');attachDownload(anchor,blobs.wav,'blocked.wav');await anchor.onclick({preventDefault(){}});assert.equal(files.has('blocked.wav'),false);
el('reset-folder').onclick();assert.equal(await autoSave(blobs,'not-saved'),false);assert.equal(files.has('not-saved.mp3'),false);console.log('Output folder selection, automatic formats, unique names, explicit download and fallback checks passed with a mock directory.');
