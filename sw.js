const PREFIX='pork-industrial-',CACHE=PREFIX+'4.0.0';
const ASSETS=['./','./index.html','./style.css','./game.js','./mayhem.js','./pwa.js','./industrial.wav','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE),cached=await cache.match(event.request);if(cached)return cached;
  try{const response=await fetch(event.request);if(response.ok&&/\.(mp3|wav|ogg)$/.test(new URL(event.request.url).pathname))await cache.put(event.request,response.clone());return response;}catch{if(event.request.mode==='navigate')return await cache.match('./index.html');return Response.error();}
 })());
});
