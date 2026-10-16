const $=s=>document.querySelector(s);
const STORE='afterlife.cn.twins.v1';
let twins=[];
let selected=null;
let busy=false;
let editing=null;
let notifyTimer=null;
const escapeSimple=s=>String(s||'').slice(0,5000);
try { const saved=JSON.parse(localStorage.getItem(STORE)||'[]');if(Array.isArray(saved))twins=saved.filter(x=>x&&typeof x==='object').slice(0,100); }catch{}
try {selected=localStorage.getItem('afterlife.cn.selected');}catch{}
const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(twins));localStorage.setItem('afterlife.cn.selected',selected||'');}catch{toast('浏览器存储空间不足，请导出备份');}};
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(notifyTimer);notifyTimer=setTimeout(()=>el.classList.remove('show'),3200);}
function current(){return twins.find(x=>x.id===selected)||null;}
function personButton(p){
 const btn=document.createElement('button');btn.className='person'+(p.id===selected?' active':'');
 const av=document.createElement('span');av.className='avatar';av.textContent=(p.name||'人').slice(0,1);
 const v=document.createElement('span');const title=document.createElement('strong');title.textContent=p.name;title.style.fontSize='13px';
 const meta=document.createElement('span');meta.className='meta';meta.textContent=`${(p.history||[]).length} 条消息`;
 v.append(title,meta);btn.append(av,v);btn.onclick=()=>{selected=p.id;save();render();};return btn;
}
function render(){
 const list=$('#characters');list.replaceChildren(...twins.map(personButton));
 const p=current();$('#chat-title').textContent=p?p.name:'我的数字分身';
 $('#chat-subtitle').textContent=p?'这是 AI 模拟对话，并非真人意识':'选择一个人物，开始聊天';
 $('#model').value=p?.model==='deepseek-v4-pro'?'deepseek-v4-pro':'deepseek-flash';
 $('#edit-btn').disabled=!p;$('#send').disabled=!p||busy;$('#message').disabled=!p||busy;
 const conv=$('#conversation');conv.replaceChildren();
 if(!p){const shell=document.createElement('div');shell.className='empty';shell.innerHTML='<div class="empty-glyph">✧</div><h2>让珍贵的记忆，拥有对话的可能</h2><p>为重要的人建立数字人物，记录经历、性格和表达习惯。AI 模拟并不代表本人意识或真实言论。</p>';
 const btn=document.createElement('button');btn.className='primary-btn';btn.textContent='创建第一个数字人物 →';btn.onclick=()=>openEditor();shell.append(btn);conv.append(shell);return;}
 if(!(p.history||[]).length){const e=document.createElement('div');e.className='empty';e.innerHTML='<div class="empty-glyph">✧</div><h2>开始你们的第一段对话</h2><p>数字人物的性格由你填写的人设决定，AI 回复可能与真实人物不同。</p>';conv.append(e);return;}
 for(const m of p.history){const outer=document.createElement('div');outer.className='bubble '+m.role;const who=document.createElement('div');who.className='who';who.textContent=m.role==='user'?'你':p.name+' · AI 模拟';const content=document.createElement('div');content.className='content';content.textContent=m.content;outer.append(who,content);conv.append(outer);}
 conv.scrollTop=conv.scrollHeight;
}
function openEditor(existing=null){editing=existing?.id||null;$('#dialog-title').textContent=existing?'编辑数字人物':'创建数字人物';$('#person-name').value=existing?.name||'';$('#person-prompt').value=existing?.prompt||'';$('#delete-person').hidden=!existing;$('#character-dialog').showModal();}
$('#new-btn').onclick=()=>openEditor();$('#edit-btn').onclick=()=>openEditor(current());
$('#create-hero').onclick=()=>openEditor();$('#cancel-person').onclick=()=>$('#character-dialog').close();
$('#character-form').addEventListener('submit',ev=>{
 ev.preventDefault();const name=$('#person-name').value.trim();const prompt=$('#person-prompt').value.trim();if(!name){toast('请填写人物名称');return;}
 if(editing){const p=twins.find(x=>x.id===editing);if(p){p.name=name;p.prompt=prompt;selected=p.id;}}
 else {const p={id:(globalThis.crypto?.randomUUID?.()||'t'+Date.now()),name,prompt,model:'deepseek-flash',history:[],createdAt:Date.now()};twins.push(p);selected=p.id;}
 $('#character-dialog').close();save();render();
});
$('#delete-person').onclick=()=>{const p=twins.find(x=>x.id===editing);if(!p||!confirm(`确定删除「${p.name}」和全部聊天记录吗？`))return;twins=twins.filter(x=>x.id!==p.id);selected=twins[0]?.id||null;$('#character-dialog').close();save();render();};
$('#model').onchange=ev=>{const p=current();if(p){p.model=ev.target.value;save();toast('已更新 DeepSeek 模型');}};
$('#access-btn').onclick=()=>{ $('#access-value').value='';$('#access-dialog').showModal();};
$('#close-access').onclick=()=>$('#access-dialog').close();
$('#access-form').addEventListener('submit',ev=>{ev.preventDefault();const token=$('#access-value').value.trim();if(!token)return;sessionStorage.setItem('afterlife.cn.access',token);$('#access-dialog').close();toast('访问口令已保存到当前浏览器会话');});
$('#export-btn').onclick=()=>{const blob=new Blob([JSON.stringify({format:'afterlife-cn-v1',twins},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='afterlife-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#import-btn').onclick=()=>$('#import-file').click();$('#import-file').onchange=async ev=>{
 const file=ev.target.files?.[0];if(!file)return;if(file.size>2_000_000){toast('文件过大，请选择小于 2MB 的备份');return;}
 try{const data=JSON.parse(await file.text());if(data.format!=='afterlife-cn-v1'||!Array.isArray(data.twins))throw Error();
 if(!confirm('导入将覆盖当前浏览器中的人物和聊天记录，是否继续？'))return;
 twins=data.twins.slice(0,100).filter(x=>typeof x.name==='string'&&typeof x.prompt==='string').map(x=>({id:escapeSimple(x.id)||'t'+Date.now(),name:escapeSimple(x.name),prompt:escapeSimple(x.prompt),model:x.model==='deepseek-v4-pro'?'deepseek-v4-pro':'deepseek-flash',history:Array.isArray(x.history)?x.history.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-60):[]}));
 selected=twins[0]?.id||null;save();render();toast('已导入备份');}
 catch{toast('文件格式错误，请选择 Afterlife 网页版备份');}finally{ev.target.value='';}
};
async function sendMessage(){
 const p=current();const text=$('#message').value.trim();if(!p||!text||busy)return;
 const password=sessionStorage.getItem('afterlife.cn.access');if(!password){toast('请先在「访问口令」中填写管理员提供的口令');$('#access-btn').click();return;}
 busy=true;p.history=p.history||[];p.history.push({role:'user',content:text});$('#message').value='';save();render();
 const cid=p.id;const model=p.model;const history=p.history.slice(-32);
 try{const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json','X-Access-Token':password},body:JSON.stringify({model,systemPrompt:p.prompt,messages:history})});const data=await response.json();
 if(!response.ok)throw Error(data.error||`服务暂不可用 (${response.status})`);
 const target=twins.find(x=>x.id===cid);if(target){target.history.push({role:'assistant',content:String(data.reply||'')});save();}
 }catch(e){toast(e?.message||'连接失败，请稍后重试');const target=twins.find(x=>x.id===cid);if(target&&target.history.at(-1)?.role==='user'&&target.history.at(-1)?.content===text){target.history.pop();$('#message').value=text;save();}}
 finally{busy=false;render();}
}
$('#composer').addEventListener('submit',ev=>{ev.preventDefault();sendMessage();});
$('#message').addEventListener('keydown',ev=>{if(ev.key==='Enter'&&!ev.shiftKey&&!ev.isComposing){ev.preventDefault();sendMessage();}});
if(!current()&&twins.length)selected=twins[0].id;
render();

if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('/sw.js').catch(()=>{});
