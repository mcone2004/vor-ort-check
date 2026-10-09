// Service Worker: App-Dateien werden beim ersten Besuch gespeichert und danach auch ohne Netz geliefert.
// Mit Netz wird zuerst der Server gefragt (neueste Version), bei Ausfall oder langsamer Leitung der Speicher.
// Build: 2026-10-09 17:25 UTC
const CACHE='ocheck-202610091725';
const SHELL=["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "fonts/inter-500.woff2", "fonts/inter-600.woff2", "fonts/manrope-400.woff2", "fonts/manrope-500.woff2", "fonts/manrope-700.woff2", "fonts/manrope-800.woff2"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('ocheck-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin) return;
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const fromCache=()=>cache.match(r,{ignoreSearch:true}).then(x=>x||(r.mode==='navigate'?cache.match('index.html'):undefined));
    try{
      const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),4000);
      const res=await fetch(r,{signal:ctl.signal,cache:'no-cache'});clearTimeout(t);
      if(res&&res.ok){cache.put(r,res.clone())}
      return res;
    }catch(err){
      const hit=await fromCache();
      if(hit) return hit;
      return new Response('Offline und noch nicht gespeichert.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});
