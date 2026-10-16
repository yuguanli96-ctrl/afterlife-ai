// Cache only static assets; NEVER cache private chat responses or requests.
const VERSION='afterlife-china-shell-v1';
const ASSETS=['/','/index.html','/style.css','/app.js','/favicon.svg','/icon-192.png','/icon-512.png','/manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(VERSION).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const url=new URL(e.request.url);
 if(url.origin!==self.location.origin||!ASSETS.includes(url.pathname))return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok){const clone=r.clone();caches.open(VERSION).then(c=>c.put(e.request,clone));}return r;}).catch(()=>caches.match(e.request)));
});
