import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
const root=path.resolve(process.argv[2]||'dist'),port=Number(process.argv[3]||4190);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.wasm':'application/wasm','.woff2':'font/woff2','.ttf':'font/ttf','.svg':'image/svg+xml','.mp4':'video/mp4'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');let pathname=decodeURIComponent(url.pathname);
    if(pathname.endsWith('/'))pathname+='index.html';const file=path.resolve(root,'.'+pathname);
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404).end();}
});
server.listen(port,'127.0.0.1',()=>console.log(`QA preview http://127.0.0.1:${port}/`));
