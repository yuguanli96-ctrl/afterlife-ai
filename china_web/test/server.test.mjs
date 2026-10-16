import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
const url='http://127.0.0.1:33182';
let server;
test.before(async()=>{
  server=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,HOST:'127.0.0.1',PORT:'33182',DEEPSEEK_API_KEY:'sk-test-key-only',APP_ACCESS_TOKEN:'unit-test-very-long-passphrase'},stdio:'ignore'});
  for(let i=0;i<40;i++){try{const r=await fetch(url+'/health');if(r.ok)return;}catch{}await delay(100);}
  throw Error('Test server failed to start');
});
test.after(()=>server?.kill());
test('health and static HTML work',async()=>{
 const r=await fetch(url+'/health');assert.equal(r.status,200);assert.equal((await r.json()).provider,'DeepSeek');
 const h=await fetch(url+'/');assert.equal(h.status,200);assert.match(await h.text(),/数字分身/);
});
test('requires access token before forwarding messages',async()=>{
 const r=await fetch(url+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'hi'}]})});
 assert.equal(r.status,401);
});
test('validates content and model before upstream',async()=>{
 const r=await fetch(url+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json','X-Access-Token':'unit-test-very-long-passphrase'},body:JSON.stringify({messages:[{role:'system',content:'hi'}]})});
 assert.equal(r.status,400);
});
test('blocks cross-origin browser requests',async()=>{
 const r=await fetch(url+'/api/chat',{method:'POST',headers:{'Origin':'https://attacker.example','Content-Type':'application/json','X-Access-Token':'unit-test-very-long-passphrase'},body:JSON.stringify({messages:[{role:'user',content:'hi'}]})});
 assert.equal(r.status,403);
});
