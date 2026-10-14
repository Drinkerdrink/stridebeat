import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('./dist/',import.meta.url));
const args=process.argv.slice(2),portIndex=args.indexOf('--port');
const port=portIndex>=0?Number(args[portIndex+1]):4173;
if(!Number.isInteger(port)||port<0||port>65535){console.error('Invalid port. Example: node server.mjs --port 4174');process.exit(1);}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.map':'application/json'};
const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    const relative=path.relative(root,target);
    if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(/[\\/]/).some(p=>p.startsWith('.'))){res.writeHead(403).end('Forbidden');return;}
    const content=await readFile(target);
    res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Content-Length':content.byteLength,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:content);
  }catch(error){res.writeHead(error instanceof URIError?400:404).end('Not found');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port is busy. Try: node server.mjs --port 4174':error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
  const url=`http://127.0.0.1:${server.address().port}`;
  console.log(`Stridebeat: ${url}\nKeep this window open. Press Ctrl+C to stop.`);
  if(args.includes('--open')){
    const commands=process.platform==='win32'?['rundll32.exe',['url.dll,FileProtocolHandler',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];
    const opener=spawn(commands[0],commands[1],{stdio:'ignore',windowsHide:true});opener.on('error',()=>console.log(`Open your browser at ${url}`));opener.unref();
  }
});
