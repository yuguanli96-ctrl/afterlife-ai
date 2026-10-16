import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';

// Afterlife China Web — zero third-party runtime dependencies.
// Deploy the Node process behind HTTPS, preferably on an audited mainland host.
const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, 'public');
const port = Number(process.env.PORT || 3000);
const key = (process.env.DEEPSEEK_API_KEY || '').trim();
const gate = process.env.APP_ACCESS_TOKEN || '';
const host = process.env.HOST || '127.0.0.1';
const modelIds = new Set(['deepseek-flash', 'deepseek-v4-pro']);
const ipHits = new Map();
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/favicon.svg': ['favicon.svg', 'image/svg+xml'],
  '/icon-192.png': ['icon-192.png', 'image/png'],
  '/icon-512.png': ['icon-512.png', 'image/png'],
  '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json'],
  '/sw.js': ['sw.js', 'text/javascript; charset=utf-8'],
};
if (!key || !gate || gate.length < 12) {
  console.error('Set DEEPSEEK_API_KEY and APP_ACCESS_TOKEN (>=12 characters) in the server environment.');
  process.exit(1);
}
function send(res, status, obj) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'});
  res.end(JSON.stringify(obj));
}
function sameToken(a,b) {
  if (typeof a !== 'string') return false;
  const x=Buffer.from(a), y=Buffer.from(b);
  return x.length===y.length && timingSafeEqual(x,y);
}
function rateLimit(ip) {
  const t=Date.now();
  if (ipHits.size > 5000) for (const [k,v] of ipHits) if (t-v.since>60000) ipHits.delete(k);
  const value=ipHits.get(ip);
  if (!value || t-value.since>60000) {ipHits.set(ip,{since:t,count:1});return true;}
  value.count+=1;
  return value.count<=12;
}
function readJson(req) {
  return new Promise((resolve,reject)=>{
    let data='';let size=0;
    req.on('data',ch=>{size+=ch.length;if(size>64000){reject(new Error('too_large'));req.destroy();return;}data+=ch;});
    req.on('end',()=>{try{resolve(JSON.parse(data));}catch{reject(new Error('invalid_json'));}});
    req.on('error',reject);
  });
}
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  const route=req.url?.split('?')[0] || '/';
  if(req.method==='GET' && route==='/health') return send(res,200,{ok:true,provider:'DeepSeek'});
  if(req.method==='GET' && files[route]) {
    const [f,type]=files[route];
    try{const body=await readFile(path.join(dir,f));res.writeHead(200,{'Content-Type':type,'Cache-Control':'public, max-age=120'});res.end(body);}
    catch{send(res,500,{error:'静态文件加载失败'});}
    return;
  }
  if(req.method==='POST' && route==='/api/chat') {
    if(req.headers.origin) {
      const ownOrigin=`${req.socket.encrypted?'https':'http'}://${req.headers.host}`;
      // reverse proxies typically terminate HTTPS; compare host instead.
      try {if(new URL(req.headers.origin).host !== req.headers.host) return send(res,403,{error:'只允许同源请求'});}
      catch{return send(res,403,{error:'来源不合法'});}
    }
    if(!sameToken(req.headers['x-access-token'],gate)) return send(res,401,{error:'访问口令不正确'});
    // When behind Nginx, configure proxy IP protection; do not blindly trust X-Forwarded-For.
    if(!rateLimit(req.socket.remoteAddress||'unknown')) return send(res,429,{error:'请求太频繁，请稍后重试'});
    let data;
    try{data=await readJson(req);}catch{return send(res,400,{error:'请求格式错误或内容过大'});}
    if(!data || typeof data!=='object')return send(res,400,{error:'参数不合法'});
    const model=modelIds.has(data.model)?data.model:'deepseek-flash';
    const prompt=typeof data.systemPrompt==='string'?data.systemPrompt.slice(0,7000):'';
    if(!Array.isArray(data.messages) || data.messages.length<1 || data.messages.length>60) return send(res,400,{error:'聊天记录不合法'});
    const msgs=[];
    for(const msg of data.messages){
      if(!msg || !['user','assistant'].includes(msg.role) || typeof msg.content!=='string' || msg.content.length>8000) return send(res,400,{error:'消息内容不合法'});
      msgs.push({role:msg.role,content:msg.content});
    }
    if(msgs.at(-1).role!=='user')return send(res,400,{error:'缺少用户消息'});
    const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),90000);
    try {
      const upstream=await fetch('https://api.deepseek.com/chat/completions',{
        method:'POST',signal:controller.signal,
        headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
        body:JSON.stringify({model,thinking:{type:'disabled'},temperature:0.7,max_tokens:1800,stream:false,messages:[
          {role:'system',content:`你正在模拟一位用户创建的数字人物。必须承认这是 AI 模拟而不是真人；不要声称具备真人意识。用用户所选语言自然对话。\n${prompt}`},...msgs.slice(-32)
        ]})
      });
      const result=await upstream.json().catch(()=>null);
      if(!upstream.ok) {
        const errors={400:'请求被 DeepSeek 拒绝',401:'服务端密钥验证失败',402:'DeepSeek 账户余额不足',429:'DeepSeek 请求过于频繁'};
        return send(res,upstream.status===429?429:502,{error:errors[upstream.status]||`DeepSeek 暂不可用 (${upstream.status})`});
      }
      const reply=result?.choices?.[0]?.message?.content;
      if(typeof reply!=='string'||!reply.trim())return send(res,502,{error:'DeepSeek 返回了空回复'});
      return send(res,200,{reply:reply.slice(0,16000),model});
    }catch(e){return send(res,504,{error:e?.name==='AbortError'?'AI 响应超时':'无法连接 DeepSeek，请检查服务器网络'});}
    finally{clearTimeout(timeout);}
  }
  send(res,404,{error:'不存在的路径'});
});
server.listen(port,host,()=>console.log(`Afterlife China Web listening on http://${host}:${port}`));
