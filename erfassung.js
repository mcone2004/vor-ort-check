/* Gebäudeerfassung Bedarfsausweis: Oberfläche (Vollbildansicht im Vor-Ort-Check).
   Ablauf wie die Eingabe im Energieberater: Gebäude, Grundriss mit Wänden, Bauteile mit Schichtaufbau, Anlagentechnik.
   Daten hängen am Kunden (Feld "erf"), Speicherung und Abgleich übernimmt der Vor-Ort-Check. */
(function(){
'use strict';
var C=window.ERFCALC;if(!C) return;
var N=C.N,has=C.has,f2=C.f2,f3=C.f3;
var E=C.newErf();
var step='kunde',KD=null,curFloor=null,selWall=null,selKat=null,selSurf=null,root=null,main=null,nav=null,onChange=function(){},onClose=function(){},isOpen=false,kdName='';
var PH_MAX=30;

function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function clone(o){return JSON.parse(JSON.stringify(o))}

/* ---------- Pfadzugriff: Segmente sind Schlüssel oder Ids in Listen ---------- */
function pget(path){
  var a=path.split('/'),o=E;
  for(var i=0;i<a.length;i++){
    if(o==null) return undefined;
    if(Array.isArray(o)){var s=a[i];o=o.filter(function(x){return x.id===s})[0]}else o=o[a[i]];
  }
  return o;
}
function pset(path,val){
  var a=path.split('/'),o=E;
  for(var i=0;i<a.length-1;i++){
    var s=a[i];
    if(Array.isArray(o)){o=o.filter(function(x){return x.id===s})[0]}
    else{if(o[s]==null) o[s]={};o=o[s]}
    if(!o) return false;
  }
  o[a[a.length-1]]=val;return true;
}

/* ---------- Bausteine für Formulare ---------- */
function F(path,label,o){
  o=o||{};var v=pget(path);if(v==null) v='';
  return '<label class="erf-f'+(o.cls?' '+o.cls:'')+'"><span>'+esc(label)+'</span><input type="text" '+(o.text?'':'inputmode="decimal" ')+'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-p="'+path+'" value="'+esc(v)+'"'+(o.ph?' placeholder="'+esc(o.ph)+'"':'')+'></label>';
}
function S(path,label,opts,o){
  o=o||{};var v=pget(path);if(v==null) v='';
  var h='<label class="erf-f'+(o.cls?' '+o.cls:'')+'"><span>'+esc(label)+'</span><select data-p="'+path+'"'+(o.r?' data-r="1"':'')+(o.mat?' data-mat="1"':'')+'>';
  var found=false;
  if(!o.noblank) h+='<option value="">'+esc(o.blank||'wählen')+'</option>';
  opts.forEach(function(x){
    if(x&&x.g!==undefined&&x.items){h+='<optgroup label="'+esc(x.g)+'">'+x.items.map(function(y){var vv=y.v!==undefined?y.v:y,tt=y.t!==undefined?y.t:y;if(String(vv)===String(v)) found=true;return '<option value="'+esc(vv)+'"'+(String(vv)===String(v)?' selected':'')+'>'+esc(tt)+'</option>'}).join('')+'</optgroup>';return}
    var vv=(x&&x.v!==undefined)?x.v:x,tt=(x&&x.t!==undefined)?x.t:x;
    if(String(vv)===String(v)) found=true;
    h+='<option value="'+esc(vv)+'"'+(String(vv)===String(v)?' selected':'')+'>'+esc(tt)+'</option>';
  });
  if(!found&&v!=='') h+='<option value="'+esc(v)+'" selected>'+esc(o.fmt?o.fmt(v):v)+'</option>';
  return h+'</select></label>';
}
function TA(path,label,rows){
  var v=pget(path);if(v==null) v='';
  return '<label class="erf-f"><span>'+esc(label)+'</span><textarea rows="'+(rows||3)+'" data-p="'+path+'">'+esc(v)+'</textarea></label>';
}
function CK(path,label){
  var v=pget(path);
  return '<label class="erf-ck"><input type="checkbox" data-p="'+path+'"'+(v==='1'?' checked':'')+'><span>'+esc(label)+'</span></label>';
}
function btn(a,label,o){
  o=o||{};
  return '<button type="button" class="'+(o.cls||'ghost')+'" data-a="'+a+'"'+(o.x!=null?' data-x="'+esc(o.x)+'"':'')+(o.y!=null?' data-y="'+esc(o.y)+'"':'')+(o.z!=null?' data-z="'+esc(o.z)+'"':'')+'>'+esc(label)+'</button>';
}

/* ---------- Fotos ---------- */
function photoCount(){var n=0;for(var k in E.photos) n+=(E.photos[k]||[]).length;return n}
function photoMB(){var b=0;for(var k in E.photos)(E.photos[k]||[]).forEach(function(p){b+=String(p.d||'').length*0.75});return b/1048576}
function dropPhotos(key){if(E.photos[key]) delete E.photos[key]}
function photoNum(key){return (E.photos[key]||[]).length}
function photoBox(key,label){
  var arr=E.photos[key]||[];
  return '<div class="erf-ph"><div class="erf-phl">'+esc(label)+'</div><div class="erf-phg">'+arr.map(function(p,i){
    return '<figure><img src="'+p.d+'" alt="'+esc(label)+' '+(i+1)+'"><button type="button" class="ghost" data-a="ph-del" data-x="'+esc(key)+'" data-y="'+i+'" aria-label="Foto entfernen">Entfernen</button></figure>';
  }).join('')+'</div><label class="erf-btn ghost">Foto hinzufügen<input type="file" accept="image/*" data-ph="'+esc(key)+'" hidden></label></div>';
}
function shrink(file){
  return new Promise(function(res,rej){
    var u=URL.createObjectURL(file),im=new Image();
    im.onload=function(){
      try{
        var k=Math.min(1,800/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.max(1,Math.round(im.naturalWidth*k)),h=Math.max(1,Math.round(im.naturalHeight*k));
        var c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);
        URL.revokeObjectURL(u);res(c.toDataURL('image/jpeg',0.5));
      }catch(e){URL.revokeObjectURL(u);rej(e)}
    };
    im.onerror=function(){URL.revokeObjectURL(u);rej(new Error('Bild nicht lesbar'))};
    im.src=u;
  });
}

/* ---------- Suche in den Daten ---------- */
function findWall(id){
  for(var i=0;i<E.gesch.length;i++){var fl=E.gesch[i];for(var j=0;j<fl.walls.length;j++) if(fl.walls[j].id===id) return {fl:fl,w:fl.walls[j],i:j}}
  return null;
}
function findSurf(id){for(var i=0;i<E.surf.length;i++) if(E.surf[i].id===id) return E.surf[i];return null}
function findOwner(id){var r=findWall(id);if(r) return {o:r.w,path:'gesch/'+r.fl.id+'/walls/'+r.w.id,wall:r};var s=findSurf(id);return s?{o:s,path:'surf/'+s.id,surf:s}:null}
function floorObj(){
  for(var i=0;i<E.gesch.length;i++) if(E.gesch[i].id===curFloor) return E.gesch[i];
  if(E.gesch.length){curFloor=E.gesch[0].id;return E.gesch[0]}
  return null;
}
function usage(id){
  var n=0;
  E.gesch.forEach(function(f){f.walls.forEach(function(w){if(w.bt===id) n++;(w.ow||[]).forEach(function(o){if(o.bt===id) n++})})});
  E.surf.forEach(function(s){if(s.bt===id) n++;(s.ow||[]).forEach(function(o){if(o.bt===id) n++})});
  return n;
}
function katOpts(kinds,cur){
  var l=E.kat.filter(function(k){return kinds.indexOf(k.kind)>=0});
  l.sort(function(a,b){return String(a.name).localeCompare(String(b.name),'de')});
  var o=l.map(function(k){var u=C.uOf(k);return {v:k.id,t:(k.name||'ohne Namen')+(u.ok?'  ·  U '+f2(u.u):'')}});
  if(cur){var k2=C.findKat(E,cur);if(k2&&kinds.indexOf(k2.kind)<0) o.unshift({v:cur,t:(k2.name||'ohne Namen')+' (Art passt nicht)'})}
  return o;
}
function wallRefs(id){
  var multi=E.gesch.filter(function(f){return f.walls.length}).length>1,o=[];
  E.gesch.forEach(function(f){f.walls.forEach(function(w,i){if(w.bt===id) o.push('Wand '+(i+1)+(multi?' ('+(f.name||'Geschoss')+')':''))})});
  return o;
}
function wallPick(k){
  var ok=WALLKINDREV[k.kind];if(!ok) return '';
  var multi=E.gesch.filter(function(f){return f.walls.length}).length>1,h='',cnt=0;
  E.gesch.forEach(function(f){
    var items='';
    f.walls.forEach(function(w,i){
      if(ok.indexOf(w.type)<0) return;cnt++;
      var other=(w.bt&&w.bt!==k.id)?C.findKat(E,w.bt):null;
      items+='<label class="erf-ck"><input type="checkbox" data-wb="'+w.id+'" data-wbk="'+k.id+'"'+(w.bt===k.id?' checked':'')+'><span>Wand '+(i+1)+' · '+esc(dirText(bearing(f,i)))+' · '+f2(N(w.len))+' m'+(w.type!=='aussen'?' · '+esc(C.WTYPE[w.type]):'')+(other?' <small style="color:var(--muted)">(derzeit: '+esc(other.name||'anderes Bauteil')+')</small>':'')+'</span></label>';
    });
    if(items) h+=(multi?'<div class="erf-hint" style="margin-top:.3rem"><b>'+esc(f.name||'Geschoss')+'</b></div>':'')+'<div class="erf-g w2">'+items+'</div>';
  });
  if(!cnt) return '<div class="erf-hint">Noch keine passenden Wände. Unter „Grundriss und Wände“ eine Grundrissform erzeugen oder Wände anlegen.</div>';
  return '<div class="erf-hint" style="margin-top:.4rem"><b>Gilt für folgende Wände</b></div>'+h+'<div class="erf-row">'+btn('kat-walls-all',(k.kind==='wand'?'Alle Außenwände ohne Bauteil zuordnen':'Alle passenden Wände ohne Bauteil zuordnen'),{x:k.id})+btn('kat-walls-none','Zuordnung aufheben',{x:k.id})+'</div>';
}
var WALLKIND={aussen:['wand'],unbeh:['wand_u','wand'],erd:['wand_e','wand']};
var WALLPRIM={wand:'aussen',wand_u:'unbeh',wand_e:'erd'};
var WALLKINDREV={wand:['aussen','unbeh','erd'],wand_u:['unbeh'],wand_e:['erd']};

/* ---------- Stil ---------- */
var CSS='\
#erf-root{position:fixed;inset:0;z-index:9000;background:var(--bg-erf,var(--bg));border-top:8px solid var(--c-erf,var(--line));display:flex;flex-direction:column;color:var(--text);font-family:var(--f-body)}\
#erf-root[hidden]{display:none}\
.erf-top{background:var(--dark);color:#fff;display:flex;align-items:center;gap:.8rem;padding:calc(.6rem + env(safe-area-inset-top,0px)) max(14px,env(safe-area-inset-right,0px)) .6rem max(14px,env(safe-area-inset-left,0px))}\
.erf-top .erf-t{flex:1;min-width:0;font-weight:800;font-size:1rem;line-height:1.25}\
.erf-top .erf-t small{display:block;font-weight:600;font-size:.78rem;color:#C9CED3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
.erf-top button{background:transparent;color:#fff;border:1.5px solid #C9CED3;border-radius:999px;padding:.4rem 1rem;min-height:44px}\
.erf-top button:hover{background:rgba(255,255,255,.12)}\
.erf-nav{display:flex;gap:.4rem;overflow-x:auto;padding:.55rem max(14px,env(safe-area-inset-left,0px));background:var(--surface);border-bottom:1px solid var(--line);-webkit-overflow-scrolling:touch}\
.erf-nav button{flex:none;background:transparent;color:var(--ink);border:1px solid var(--line);border-radius:999px;padding:.4rem .95rem;font-weight:600;font-size:.88rem;min-height:44px;white-space:nowrap}\
.erf-nav button:hover{background:var(--tint)}\
.erf-nav button[aria-current=true]{background:var(--green);color:#20252A;border-color:var(--green)}\
.erf-missbox{border:1px solid var(--line);border-radius:6px;padding:.55rem .8rem;font-size:.85rem;margin-bottom:.8rem}.erf-missbox.bad{border-color:#B03A2E;background:#FBEDEB;color:#6E2118}.erf-missbox.ok{border-color:#2E7D32;background:#EAF4EA;color:#1F5A23}.erf-missbox ul{margin:.3rem 0 0;padding-left:1.1rem}.erf-missbox li{margin:.1rem 0}\
.erf-f.miss>span{color:#B03A2E;font-weight:600}.erf-f.miss input,.erf-f.miss select,.erf-f.miss textarea{border-color:#B03A2E!important;box-shadow:0 0 0 2px rgba(176,58,46,.25);background:#FDF3F1}\
.erf-wh.miss{box-shadow:inset 5px 0 0 #B03A2E;background:#FDF3F1;color:#6E2118}\
.erf-num{display:inline-grid;place-items:center;width:1.55rem;height:1.55rem;margin-right:.45rem;border-radius:50%;border:2px solid currentColor;font-size:.8rem;line-height:1;opacity:.75}.erf-num.bad{background:#B03A2E;border-color:#B03A2E;color:#fff;opacity:1}.erf-num.ok{background:#2E7D32;border-color:#2E7D32;color:#fff;opacity:1}\
.erf-bd{display:inline-block;min-width:1.35rem;margin-left:.35rem;padding:0 .35rem;border-radius:999px;background:#B03A2E;color:#fff;font-size:.74rem;line-height:1.35rem;text-align:center}\
.erf-bd.z{background:var(--green);color:#20252A}\
.erf-main{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:1rem max(14px,env(safe-area-inset-right,0px)) 4rem max(14px,env(safe-area-inset-left,0px))}\
.erf-in{max-width:1100px;margin:0 auto;display:grid;gap:1rem}\
.erf-sec{border:1px solid var(--line);border-radius:6px;background:var(--surface);padding:.9rem 1rem 1rem;display:grid;gap:.75rem;min-width:0}\
.erf-sec>h3,.erf-h{font-family:var(--f-data);font-size:.82rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--ink);margin:0;padding-bottom:.4rem;border-bottom:1px solid var(--line)}\
.erf-g{display:grid;gap:.7rem;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))}\
.erf-g.w2{grid-template-columns:repeat(auto-fit,minmax(17rem,1fr))}\
.erf-f{display:grid;align-content:end;gap:.25rem;font-size:.85rem;color:var(--muted);min-width:0}\
.erf-ck{display:flex;align-items:center;gap:.6rem;font-size:.92rem;color:var(--text);min-height:44px}\
.erf-ck input{width:1.35rem;height:1.35rem;min-height:0;flex:none}\
.erf-row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}\
.erf-hint{font-size:.8rem;color:var(--muted)}\
.erf-note{border-left:4px solid #E0A030;background:var(--tint);padding:.55rem .8rem;border-radius:4px;font-size:.86rem;color:var(--text)}\
.erf-ok{color:#4C7A12;font-weight:700}.erf-bad{color:#B03A2E;font-weight:700}\
:root[data-theme=dark] .erf-ok,.erf-dk .erf-ok{color:#A8C24A}\
.erf-floors{display:flex;gap:.4rem;flex-wrap:wrap;align-items:center}\
.erf-floors button[aria-pressed=true]{background:var(--ink);color:var(--bg);border-color:var(--ink)}\
.erf-two{display:grid;gap:1rem;grid-template-columns:minmax(0,1fr)}\
@media (min-width:900px){.erf-two{grid-template-columns:minmax(0,26rem) minmax(0,1fr);align-items:start}.erf-two>.erf-svgbox{position:sticky;top:0}}\
.erf-svgbox{border:1px solid var(--line);border-radius:6px;background:var(--surface);padding:.4rem}\
.erf-svg{width:100%;height:auto;display:block;touch-action:manipulation}\
.erf-svg .fill{fill:var(--tint);stroke:none}\
.erf-svg .w{stroke:var(--ink);stroke-width:3;stroke-linecap:round;fill:none}\
.erf-svg .w.t-unbeh{stroke:#E0A030}.erf-svg .w.t-erd{stroke:#8B6B4A}.erf-svg .w.t-nachbar{stroke:#999;stroke-dasharray:6 4}\
.erf-svg .w.sel{stroke:var(--green);stroke-width:6}\
.erf-svg .hit{stroke:transparent;stroke-width:18;fill:none;cursor:pointer}\
.erf-svg .win{stroke:#2D7DD2;stroke-width:6;stroke-linecap:butt;opacity:.9}\
.erf-svg .gap{stroke:#B03A2E;stroke-width:2;stroke-dasharray:4 3}\
.erf-svg text{fill:var(--ink);font-family:var(--f-data);font-size:11px;font-weight:600}\
    .erf-svg .lab{paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round}.erf-svg .lab.sel{fill:#4C7A12}\
.erf-svg .st{fill:var(--green)}\
.erf-svg .cm{fill:#E0702A;stroke:var(--surface);stroke-width:2}.erf-svg .arc{fill:none;stroke:#E0702A;stroke-width:2.5}\
.erf-svg .cl{fill:#B4501A;paint-order:stroke;stroke:var(--surface);stroke-width:4px;font-size:13px}.erf-svg .cap{fill:#B4501A;font-size:11px}.erf-svg .len{font-weight:400}\
.erf-wall{border:1px solid var(--line);border-radius:6px;background:var(--bg);min-width:0}\
.erf-wall.sel{border-color:var(--green);border-left-width:5px}\
.erf-wh{display:flex;align-items:center;gap:.6rem;width:100%;text-align:left;background:transparent;color:var(--ink);border:0;border-radius:6px;padding:.55rem .7rem;font-weight:600;font-size:.88rem;justify-self:stretch;min-height:48px}\
.erf-wh:hover{background:var(--tint)}\
.erf-wh .chev{flex:none;margin-left:auto;transition:transform .15s}.erf-wh .chev.open{transform:rotate(180deg)}\
.erf-wh .n{flex:none;width:1.7rem;height:1.7rem;border-radius:50%;background:var(--ink);color:var(--bg);display:grid;place-items:center;font-size:.8rem}\
.erf-wb{padding:.2rem .8rem .9rem;display:grid;gap:.75rem}\
.erf-ow{border:1px dashed var(--line);border-radius:6px;padding:.6rem;display:grid;gap:.5rem;background:var(--surface)}\
.erf-ow .erf-g{grid-template-columns:repeat(auto-fit,minmax(7rem,1fr))}\
.erf-g .wide{grid-column:1/-1}\
.erf-kat{border:1px solid var(--line);border-radius:6px;background:var(--surface);min-width:0}\
.erf-kat.sel{border-color:var(--green);border-left-width:5px}\
.erf-layer{border:1px solid var(--line);border-radius:6px;padding:.55rem;display:grid;gap:.5rem;background:var(--bg)}\
.erf-layer .erf-g{grid-template-columns:repeat(auto-fit,minmax(7rem,1fr))}.erf-layer .erf-g .lm{grid-column:1/-1}@media (min-width:760px){.erf-layer .erf-g.lay{grid-template-columns:minmax(14rem,3fr) repeat(auto-fit,minmax(6.5rem,1fr))}.erf-layer .erf-g .lm{grid-column:auto}}\
.erf-layer.vent{border-color:#2D7DD2}.erf-layer .erf-row button{min-height:40px;padding:.3rem .8rem}\
.erf-u{font-family:var(--f-data);font-weight:700;color:var(--ink)}\
.erf-tb{width:100%;border-collapse:collapse;font-size:.84rem}\
.erf-tb th,.erf-tb td{border-bottom:1px solid var(--line);padding:.3rem .45rem;text-align:left;vertical-align:top}\
.erf-tb th{font-family:var(--f-data);font-size:.76rem;font-weight:600;color:var(--muted)}\
.erf-tb td.r,.erf-tb th.r{text-align:right;white-space:nowrap}\
.erf-wrapx{overflow-x:auto}\
.erf-ph{display:grid;gap:.4rem}\
.erf-phl{font-size:.85rem;color:var(--muted)}\
.erf-phg{display:flex;gap:.5rem;flex-wrap:wrap}\
.erf-phg figure{margin:0;display:grid;gap:.25rem;width:7.5rem}\
.erf-phg img{width:100%;height:5.6rem;object-fit:cover;border-radius:4px;border:1px solid var(--line)}\
.erf-phg button{padding:.2rem .4rem;font-size:.75rem;min-height:32px}\
.erf-btn{display:inline-flex;align-items:center;justify-self:start;border:1px solid var(--line);border-radius:4px;padding:.55rem 1rem;font-weight:700;color:var(--ink);cursor:pointer;min-height:44px;font-size:.9rem}\
.erf-btn:hover{background:var(--tint)}\
.erf-list{margin:0;padding:0;list-style:none;display:grid;gap:.35rem}\
.erf-list li{display:flex;gap:.6rem;align-items:flex-start;font-size:.88rem}\
.erf-list button{padding:.25rem .7rem;min-height:36px;font-size:.8rem;flex:none}\
.erf-sheet{background:#fff;color:#20252A;border:1px solid var(--line);border-radius:6px;padding:1.2rem 1.4rem;font-size:.86rem;display:grid;gap:1rem}\
.erf-sheet h2{font-size:1.05rem;color:#20252A}.erf-sheet h4{margin:.2rem 0 .3rem;font-size:.85rem;color:#20252A;font-family:var(--f-data);text-transform:uppercase;letter-spacing:.04em}\
.erf-sheet .erf-tb th{color:#555}.erf-sheet .erf-tb th,.erf-sheet .erf-tb td{border-bottom-color:#C9CED3}\
.erf-sheet .kv{display:grid;grid-template-columns:minmax(10rem,16rem) 1fr;gap:.15rem .8rem}.erf-sheet .kv span:nth-child(odd){color:#555}\
.erf-sheet img{max-width:8rem;max-height:6rem;border:1px solid #C9CED3;border-radius:3px;margin:.2rem .3rem 0 0}\
.erf-shape{border:1px solid var(--line);border-radius:6px;padding:.6rem;display:grid;gap:.5rem;margin:.4rem 0}\
.erf-shp{width:100%;max-width:20rem;height:auto;background:var(--surface);border:1px solid var(--line);border-radius:4px}\
@media (pointer:coarse),(any-pointer:coarse){.erf-main input,.erf-main select,.erf-main textarea{min-height:48px}}\
@media print{\
 html,body{height:auto!important;overflow:visible!important;background:#fff!important}\
 body>*:not(#erf-root){display:none!important}\
 body>#erf-root{position:static!important;display:block!important;background:#fff!important}\
 body>#erf-root:not([hidden]){display:block!important}\
 .erf-top,.erf-nav,.erf-noprint{display:none!important}\
 .erf-main{overflow:visible!important;padding:0!important}\
 .erf-sheet{border:0!important;padding:0!important}\
 .erf-sheet section{break-inside:avoid}\
}';

/* ---------- Ausgaben, die sich beim Tippen aktualisieren ---------- */
function bearing(fl,i){var tr=C.trace(fl,E.g.h0);return tr.n?C.wallBearing(tr,i):0}
function dirText(b){return C.dirName(b)+' ('+Math.round(b)+'°)'}
function outW(id){
  var r=findWall(id);if(!r) return '';
  var g=C.wallGeom(r.fl,r.w,E),k=C.findKat(E,r.w.bt);
  var nm=r.w.type==='nachbar'?'Trennwand zu Nachbar':(k&&k.name?k.name:'Bauteil fehlt');
  var pn=photoNum('w:'+id);
  return '<span style="flex:1;min-width:0">Wand '+(r.i+1)+' · '+esc(C.dirName(bearing(r.fl,r.i))+' · '+f2(N(r.w.len))+' m · '+nm+' · '+f2(g.net)+' m² netto'+(pn?' · '+pn+(pn===1?' Foto':' Fotos'):''))+'</span><svg class="chev'+(r.w.id===selWall?' open':'')+'" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function outU(id){
  var k=C.findKat(E,id);if(!k) return '';
  var u=C.uOf(k);
  return u.ok?'U '+f2(u.u):'U fehlt';
}
function outUDetail(id){
  var k=C.findKat(E,id);if(!k) return '';
  var u=C.uOf(k);if(!u.calc) return '';
  var c=u.calc;
  if(!c.ok) return 'Noch keine Schicht mit Dicke und λ eingetragen.';
  var h='Σ R Schichten '+f3(c.sumR)+' · Rsi '+f2(c.rsi)+' · Rse '+f2(c.rse)+' · R gesamt '+f3(c.rt)+' m²K/W<br><span class="erf-u">U = '+f3(c.u)+' W/(m²K)</span>';
  (c.warn||[]).forEach(function(t){h+='<br><span class="erf-bad">'+esc(t)+'</span>'});
  return h;
}
function outClosure(){
  var fl=floorObj();if(!fl) return '';
  var tr=C.trace(fl,E.g.h0);
  if(!tr.n) return 'Noch keine Wände. Grundrissform erzeugen oder Wand hinzufügen.';
  var h;
  if(tr.closed) h='<span class="erf-ok">Wandzug geschlossen</span>';
  else if(tr.gap>0.02) h='<span class="erf-bad">Nicht geschlossen: Lücke '+f2(tr.gap)+' m</span>';
  else h='<span class="erf-bad">Eckwinkel ergeben keine geschlossene Figur (Summe '+Math.round(tr.turnSum)+'°)</span>';
  h+=' · Grundfläche '+f2(tr.area)+' m² · Umfang '+f2(tr.perim)+' m';
  var net=0,op=0;
  fl.walls.forEach(function(w){var g=C.wallGeom(fl,w,E);if(w.type!=='nachbar'){net+=g.net;op+=g.open}});
  h+=' · Wände netto '+f2(net)+' m² · Öffnungen '+f2(op)+' m²';
  return h;
}
function outCloseBtn(){
  var fl=floorObj();if(!fl||!fl.walls.length) return '';
  var tr=C.trace(fl,E.g.h0);if(tr.closed||tr.gap<=0.02&&tr.turnOk) return '';
  var cf=C.closeFix(fl,E.g.h0);
  if(cf&&cf.ok) return btn('wall-close','Letzte Wand auf '+f2(cf.len)+' m setzen, um zu schließen',{cls:'ghost'});
  return '<span class="erf-hint">Lücke liegt nicht in Richtung der letzten Wand. Länge oder Ecke einer früheren Wand prüfen.</span>';
}
function outSurf(id){
  var s=findSurf(id);if(!s) return '';
  var ow=0;(s.ow||[]).forEach(function(o){ow+=C.oArea(o)});
  return 'netto '+f2(Math.max(0,N(s.a)-ow))+' m²'+(ow?' (Fenster '+f2(ow)+' m²)':'');
}
function outSugg(id){
  var s=findSurf(id);if(!s) return '';
  var a=C.suggestArea(E,s.art,s.neig);
  return a>0?'Fläche aus Grundriss übernehmen: '+f2(a)+' m²':'Kein Vorschlag, Grundriss fehlt noch';
}
function outPflicht(){
  var v=C.bauantragVor1977(E.g);
  if(v==null) return '';
  var we=N(E.g.we);
  if(v&&we>0&&we<5) return 'Hinweis, bitte prüfen: Wohngebäude mit weniger als fünf Wohneinheiten und Bauantrag vor dem 01.11.1977. Hier ist bei Verkauf oder Vermietung grundsätzlich ein Bedarfsausweis verlangt, außer das Gebäude erreicht das Wärmeschutzniveau der Wärmeschutzverordnung 1977 (Nachweis, z. B. durch Sanierung).';
  if(v&&we>=5) return 'Bauantrag vor 1977, aber fünf oder mehr Wohneinheiten: Verbrauchsausweis ist in der Regel zulässig. Bitte prüfen.';
  if(!v) return 'Bauantrag ab 01.11.1977: Verbrauchsausweis ist in der Regel zulässig, Bedarfsausweis freiwillig. Bitte prüfen.';
  return '';
}
function outSvg(){
  var fl=floorObj();
  if(!fl) return '';
  return svgFor(fl);
}
function svgFor(fl,plain){
  var W=460,H=340,padX=62,padY=42,tr=C.trace(fl,E.g.h0),ink=plain?'#20252A':'var(--ink)';
  if(!tr.n) return '<text x="'+W/2+'" y="'+H/2+'" text-anchor="middle">Noch keine Wände</text>';
  var minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;
  tr.pts.forEach(function(p){minx=Math.min(minx,p.x);maxx=Math.max(maxx,p.x);miny=Math.min(miny,p.y);maxy=Math.max(maxy,p.y)});
  var dx=Math.max(1,maxx-minx),dy=Math.max(1,maxy-miny),sc=Math.min((W-2*padX)/dx,(H-2*padY)/dy);
  var ox=(W-dx*sc)/2,oy=(H-dy*sc)/2;
  function X(p){return ox+(p.x-minx)*sc}
  function Y(p){return H-oy-(p.y-miny)*sc}
  var h='',boxes=[];
  var poly=tr.pts.slice(0,tr.n).map(function(p){return X(p).toFixed(1)+','+Y(p).toFixed(1)}).join(' ');
  if(tr.closed) h+='<polygon class="fill" points="'+poly+'"/>';
  fl.walls.forEach(function(w,i){
    var p=tr.pts[i],q=tr.pts[i+1],x1=X(p),y1=Y(p),x2=X(q),y2=Y(q),b=C.wallBearing(tr,i);
    var sel=(!plain&&w.id===selWall)?' sel':'';
    h+='<line class="w t-'+w.type+sel+'" x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'"/>';
    var wl=N(w.len),ww=0;(w.ow||[]).forEach(function(o){if(o.kind!=='tuer') ww+=Math.max(0,N(o.b))*Math.max(1,Math.round(N(o.n)||1))});
    if(wl>0&&ww>0){
      var fr=Math.min(1,ww/wl),mx=(x1+x2)/2,my=(y1+y2)/2,hx=(x2-x1)*fr/2,hy=(y2-y1)*fr/2;
      h+='<line class="win" x1="'+(mx-hx).toFixed(1)+'" y1="'+(my-hy).toFixed(1)+'" x2="'+(mx+hx).toFixed(1)+'" y2="'+(my+hy).toFixed(1)+'"/>';
    }
    if(!plain) h+='<line class="hit" data-a="wall-sel" data-x="'+w.id+'" x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'"/>';
    var nx=Math.sin(rad(b)),ny=-Math.cos(rad(b)),lx=(x1+x2)/2+nx*14,ly=(y1+y2)/2+ny*14;
    var anc=nx>0.4?'start':(nx<-0.4?'end':'middle');
    var yt,k0=0;
    for(;;){
      var ex=k0*12,qx=lx+nx*ex,qy=ly+ny*ex;
      yt=qy-2+(ny>0.4?8:0)+(ny<-0.4?-8:0)+(Math.abs(ny)<=0.4?-4:0);
      var bx0=anc==='start'?qx:(anc==='end'?qx-48:qx-24),bx1=bx0+48,by0=yt-11,by1=yt+17,hit=false;
      for(var m=0;m<boxes.length;m++){var o=boxes[m];if(bx0<o[1]&&bx1>o[0]&&by0<o[3]&&by1>o[2]){hit=true;break}}
      if(!hit||k0>=6){lx=qx;boxes.push([bx0,bx1,by0,by1]);break}
      k0++;
    }
    h+='<text class="lab'+sel+'" x="'+lx.toFixed(1)+'" y="'+yt.toFixed(1)+'" text-anchor="'+anc+'">Wand '+(i+1)+'<tspan class="len" x="'+lx.toFixed(1)+'" dy="12">'+(wl>0?f2(wl)+' m':'')+'</tspan></text>';
  });
  if(tr.gap>0.02){var e=tr.pts[tr.n],s0=tr.pts[0];h+='<line class="gap" x1="'+X(e).toFixed(1)+'" y1="'+Y(e).toFixed(1)+'" x2="'+X(s0).toFixed(1)+'" y2="'+Y(s0).toFixed(1)+'"/>'}
  var si=-1;if(!plain) fl.walls.forEach(function(w,i){if(w.id===selWall) si=i});
  if(si>=0) h+=cornerMark(fl,tr,si,X(tr.pts[si+1]),Y(tr.pts[si+1]),sc);
  h+='<circle class="st" cx="'+X(tr.pts[0]).toFixed(1)+'" cy="'+Y(tr.pts[0]).toFixed(1)+'" r="4.5"/>';
  h+='<g transform="translate('+(W-24)+',22)"><path d="M0,10 L0,-8 M-5,-3 L0,-9 L5,-3" stroke="'+ink+'" stroke-width="1.6" fill="none"/><text x="0" y="22" text-anchor="middle">N</text></g>';
  if(plain) h='<style>svg.sk .fill{fill:#EEF3E4;stroke:none}svg.sk .w{stroke:#20252A;stroke-width:3;stroke-linecap:round;fill:none}svg.sk .w.t-unbeh{stroke:#E0A030}svg.sk .w.t-erd{stroke:#8B6B4A}svg.sk .w.t-nachbar{stroke:#999;stroke-dasharray:6 4}svg.sk .win{stroke:#2D7DD2;stroke-width:6;opacity:.9}svg.sk .gap{stroke:#B03A2E;stroke-width:2;stroke-dasharray:4 3}svg.sk text{fill:#20252A;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700}svg.sk .lab{paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round}svg.sk .len{font-weight:400}svg.sk .st{fill:#4C7A12}</style>'+h;
  return h;
}
function rad(d){return d*Math.PI/180}
/* Markiert die Ecke am Ende der gewählten Wand: dort gilt der eingetragene Winkel. Bogen zeigt den Innenwinkel. */
function cornerMark(fl,tr,i,cx,cy,sc){
  var H_=340;
  var w=fl.walls[i],hin=tr.hds[i],hout=hin+N(w.turn);
  var ux=-Math.sin(rad(hin)),uy=Math.cos(rad(hin));          // Richtung zur vorigen Ecke (Bildschirm, y nach unten)
  var vx=Math.sin(rad(hout)),vy=-Math.cos(rad(hout));        // Richtung zur nächsten Ecke
  var sgn=turnSgn(fl),th=180-sgn*N(w.turn);
  var len=Math.min(N(w.len),N((fl.walls[i+1]||fl.walls[0]||{}).len))*sc;
  var r=Math.max(8,Math.min(22,(len||40)*0.4));
  var h='<circle class="cm" cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="7"/>';
  if(Math.abs(th-180)>0.5&&th>0&&th<360){
    var a=sgn>0?[vx,vy,ux,uy]:[ux,uy,vx,vy];
    h+='<path class="arc" d="M'+(cx+a[0]*r).toFixed(1)+','+(cy+a[1]*r).toFixed(1)+' A'+r+','+r+' 0 '+(th>180?1:0)+' 1 '+(cx+a[2]*r).toFixed(1)+','+(cy+a[3]*r).toFixed(1)+'"/>';
  }
  var bx=ux+vx,by=uy+vy,bl=Math.sqrt(bx*bx+by*by);
  if(bl<0.05){bx=sgn>0?-vy:vy;by=sgn>0?vx:-vx;bl=1;th=180}
  bx/=bl;by/=bl;if(th>180){bx=-bx;by=-by}
  var lx=cx+bx*(r+16),ly=cy+by*(r+16)+4;
  h+='<text class="cl" x="'+lx.toFixed(1)+'" y="'+ly.toFixed(1)+'" text-anchor="middle">'+(has(w.turn)?f1x(th)+'°':'?')+'</text>';
  h+='<text class="cap" x="8" y="'+(H_-6)+'">Winkel: Ecke nach Wand '+(i+1)+'</text>';
  return h;
}
function f1x(v){return String(Math.round(v*10)/10).replace('.',',')}

function hullHTML(){
  var S=C.summary(E),rows=[];
  var multi=E.gesch.filter(function(f){return f.walls.length}).length>1;
  S.walls.forEach(function(ws){
    if(!ws.heated||ws.type==='nachbar') return;
    var r=findWall(ws.id);if(!r) return;
    var kat=C.findKat(E,r.w.bt),fn=multi?' · '+(r.fl.name||'Geschoss'):'';
    rows.push({s:'Wand '+(r.i+1)+fn,n:(kat&&kat.name)||'ohne Bauteil',z:C.WTYPE[ws.type]||ws.type,d:C.DIR8[ws.ori]||'',a:ws.g.net,u:kat?C.uOf(kat).u:null});
    var om={},od={};
    (r.w.ow||[]).forEach(function(o){var m=o.kind==='tuer'?od:om;m[o.bt]=(m[o.bt]||0)+C.oArea(o)});
    [[om,'Fenster'],[od,'Tür']].forEach(function(q){Object.keys(q[0]).forEach(function(bt){
      var ko=C.findKat(E,bt);if(!(q[0][bt]>0)) return;
      rows.push({s:q[1]+' in Wand '+(r.i+1)+fn,n:(ko&&ko.name)||'ohne Bauteil',z:'',d:C.DIR8[ws.ori]||'',a:q[0][bt],u:ko?C.uOf(ko).u:null});
    })});
  });
  S.surf.forEach(function(s){
    var sf=E.surf.filter(function(x){return x.id===s.id})[0],kat=C.findKat(E,sf&&sf.bt);
    rows.push({s:'Fläche',n:(kat&&kat.name)||'ohne Bauteil',z:(C.SURF[s.art]||{}).n||'',d:(s.art==='dach_s'&&sf&&sf.dir)?sf.dir:'',a:s.net,u:kat?C.uOf(kat).u:null});
  });
  function winRows(map,label){
    Object.keys(map).forEach(function(k){
      var p=k.split('|');if(/^\d$/.test(p[1])) return;
      var kat=C.findKat(E,p[0]),sf=findSurf(p[1]);
      var d=(sf&&sf.art==='dach_s'&&sf.dir)?sf.dir:'Dachfläche';
      rows.push({s:label+' in Fläche',n:(kat&&kat.name)||'ohne Bauteil',z:'',d:d,a:map[k],u:kat?C.uOf(kat).u:null});
    });
  }
  winRows(S.win,'Fenster');winRows(S.doors,'Tür');
  var h='<div class="erf-wrapx"><table class="erf-tb"><thead><tr><th>Art</th><th>Bauteil</th><th>Grenzt an</th><th>Richtung</th><th class="r">Fläche m²</th><th class="r">U</th></tr></thead><tbody>';
  rows.forEach(function(r){h+='<tr><td>'+esc(r.s)+'</td><td>'+esc(r.n)+'</td><td>'+esc(r.z)+'</td><td>'+esc(r.d)+'</td><td class="r">'+f2(r.a)+'</td><td class="r">'+(r.u?f2(r.u):'')+'</td></tr>'});
  if(!rows.length) h+='<tr><td colspan="6">Noch keine Flächen.</td></tr>';
  h+='</tbody></table></div>';
  h+='<div class="erf-hint">Hüllfläche A '+f2(S.Ae)+' m² · Volumen der erfassten Geschosse V '+f2(S.V)+' m³ (ohne Dachraum, nur Näherung) · A/V ca. '+f2(S.AV)+' 1/m · Fensteranteil an Wand und Fenster '+Math.round(S.fensterAnteil*100)+' %. Zur Plausibilisierung, die verbindliche Berechnung erfolgt im Energieberater.</div>';
  return h;
}
function outHull(){return hullHTML()}

function updateOuts(){
  if(!main) return;
  var els=main.querySelectorAll('[data-out]');
  for(var i=0;i<els.length;i++){
    var el=els[i],k=el.getAttribute('data-out'),p=k.split(':'),t='';
    if(p[0]==='w') t=outW(p[1]);
    else if(p[0]==='u') t=outU(p[1]);
    else if(p[0]==='ud') t=outUDetail(p[1]);
    else if(p[0]==='closure') t=outClosure();
    else if(p[0]==='closebtn') t=outCloseBtn();
    else if(p[0]==='svg') t=outSvg();
    else if(p[0]==='s') t=outSurf(p[1]);
    else if(p[0]==='sg') t=outSugg(p[1]);
    else if(p[0]==='pflicht'){t=outPflicht();el.hidden=!t}
    else if(p[0]==='hull') t=outHull();
    else if(p[0]==='shprev') t=shapeSvg();
    else if(p[0]==='missbox'){t=missBox();var bad=C.missing(E).some(function(m){return m.step===step});if(el.classList.contains('bad')!==bad) el.classList.toggle('bad',bad);if(el.classList.contains('ok')===bad) el.classList.toggle('ok',!bad)}
    else if(p[0]==='hcalc'){var hf=E.gesch.filter(function(f){return f.id===p[1]})[0];t=hf?esc(outH(hf)):''}
    if(el.innerHTML!==t) el.innerHTML=t;
  }
  updateBadges();applyMiss();
}
function updateBadges(){
  if(!nav) return;
  var M=C.missing(E),cnt={};
  M.forEach(function(m){cnt[m.step]=(cnt[m.step]||0)+1});
  C.STEPS.forEach(function(s){
    var b=nav.querySelector('[data-bd="'+s.k+'"]');if(!b) return;
    var n=cnt[s.k]||0;b.textContent=n?String(n):'✓';b.className='erf-bd'+(n?'':' z');
  });
  C.STEPS.forEach(function(s){
    var q=nav.querySelector('[data-num="'+s.k+'"]');if(!q) return;
    var st='';
    if(s.k==='kunde') st=(KD&&has(KD.get().name))?'ok':'bad';
    else if(s.k!=='abs'&&s.k!=='blatt') st=(cnt[s.k]||0)?'bad':'ok';
    q.className='erf-num'+(st?' '+st:'');
  });
  var t=root.querySelector('#erf-count');if(t) t.textContent=(M.length?('Fehlt noch: '+M.length):'Alle Pflichtangaben vorhanden')+' · Fotos '+photoCount()+' von '+PH_MAX+' ('+f2(photoMB())+' MB)';
}
var touchT=null;
function touch(){
  pdfBlob=null;onChange();
  updateOuts();
}

/* ---------- Schritte ---------- */
function sec(title,body,cls){return '<section class="erf-sec'+(cls?' '+cls:'')+'">'+(title?'<h3>'+esc(title)+'</h3>':'')+body+'</section>'}

function viewStamm(){
  var g='<div class="erf-g">'+
    S('g/typ','Gebäudetyp',['Einfamilienhaus freistehend','Doppelhaushälfte','Reihenendhaus','Reihenmittelhaus','Zweifamilienhaus','Mehrfamilienhaus','Sonstiges'])+
    F('g/bj','Baujahr des Gebäudes (Jahr)',{ph:'z. B. 1968'})+
    F('g/antrag','Bauantrag, Datum oder Jahr',{text:1,ph:'z. B. 14.05.1967'})+
    F('g/we','Wohneinheiten')+
    F('g/vg','Vollgeschosse')+
    S('g/keller','Keller',['kein Keller','unbeheizt','teilweise beheizt','beheizt'])+
    S('g/dachform','Dachform',['Satteldach','Walmdach','Pultdach','Flachdach','Mansarddach','Sonstiges'])+
    S('g/dg','Dachgeschoss',['nicht ausgebaut, Dachraum unbeheizt','teilweise ausgebaut, beheizt','vollständig ausgebaut, beheizt','Flachdach, kein Dachraum'])+
    F('g/wf','Wohnfläche in m², falls bekannt')+
    S('g/denk','Denkmalschutz',['nein','ja'],{noblank:1})+
    '</div>'+
    '<div class="erf-g w2">'+F('g/anbau','Anbauten, Erker, Gauben, Wintergarten',{text:1})+F('g/bem','Bauweise, Besonderheiten',{text:1})+'</div>'+
    '<div class="erf-note" data-out="pflicht" hidden></div>';
  var u='<div class="erf-g w2">'+C.UNTERL.map(function(x){return CK('unterl/'+x[0],x[1])}).join('')+'</div>';
  return sec('Gebäude',g)+sec('Unterlagen, die vorliegen',u)+sec('Fotos',photoBox('gebaeude','Straßenansicht, Fassaden'));
}

var SH={key:'rechteck',P:{}};
function round2s(v){return String(Math.round(v*100)/100).replace('.',',')}
function outH(fl){
  if(fl.hm==='licht'){var s=N(fl.hl)+N(fl.dd);return (N(fl.hl)>0&&N(fl.dd)>0)?('Geschosshöhe OKFF zu OKFF: '+f2(s)+' m (lichte Höhe '+f2(N(fl.hl))+' m plus Decke '+f2(N(fl.dd))+' m)'):'Geschosshöhe wird aus lichter Höhe plus Deckenstärke berechnet.'}
  return '';
}
function syncH(path){
  var m=/^gesch\/([^\/]+)\/(hl|dd)$/.exec(path||'');if(!m) return;
  var fl=E.gesch.filter(function(f){return f.id===m[1]})[0];if(!fl||fl.hm!=='licht') return;
  if(N(fl.hl)>0&&N(fl.dd)>0) fl.h=round2s(N(fl.hl)+N(fl.dd));
}
function shapeSvg(){
  var pts=C.shapePoints(SH.key,SH.P);
  if(!pts) return '<text x="150" y="80" text-anchor="middle" font-size="12">Wände werden einzeln eingegeben</text>';
  var minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;
  pts.forEach(function(q){minx=Math.min(minx,q[0]);maxx=Math.max(maxx,q[0]);miny=Math.min(miny,q[1]);maxy=Math.max(maxy,q[1])});
  var W=300,H=170,pad=24,sc=Math.min((W-2*pad)/Math.max(maxx-minx,0.1),(H-2*pad)/Math.max(maxy-miny,0.1));
  var ox=(W-(maxx-minx)*sc)/2,oy=(H-(maxy-miny)*sc)/2;
  var d=pts.map(function(q,i){return (i?'L':'M')+(ox+(q[0]-minx)*sc).toFixed(1)+','+(oy+(maxy-q[1])*sc).toFixed(1)}).join(' ')+' Z';
  var q0=pts[0],q1=pts[1];
  var ax=ox+(q0[0]-minx)*sc,ay=oy+(maxy-q0[1])*sc;
  return '<path d="'+d+'" fill="var(--tint)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/><circle cx="'+ax.toFixed(1)+'" cy="'+ay.toFixed(1)+'" r="4.5" fill="var(--green)"/><text x="'+(ax+8).toFixed(1)+'" y="'+(ay-6).toFixed(1)+'" font-size="11">Wand 1 →</text>';
}
function shapeBlock(fl){
  var sh=C.SHAPES[SH.key]||C.SHAPES.rechteck;
  var opts=Object.keys(C.SHAPES).map(function(k){return '<option value="'+k+'"'+(k===SH.key?' selected':'')+'>'+esc(C.SHAPES[k].n)+'</option>'}).join('');
  var h='<div class="erf-shape"><div class="erf-row" style="align-items:flex-end"><label class="erf-f" style="min-width:12rem"><span>Grundrissform</span><select data-sh="_key">'+opts+'</select></label></div>';
  h+='<div class="erf-g">'+sh.params.map(function(q){return '<label class="erf-f"><span>'+esc(q.l)+'</span><input type="text" inputmode="decimal" autocomplete="off" data-sh="'+q.k+'" value="'+esc(SH.P[q.k]||'')+'"'+(q.ph?' placeholder="'+esc(q.ph)+'"':'')+'></label>'}).join('')+'</div>';
  h+='<div class="erf-hint">'+esc(sh.hint)+'</div>';
  if(sh.pts) h+='<svg class="erf-shp" viewBox="0 0 300 170" role="img" aria-label="Vorschau der Grundrissform" data-out="shprev">'+shapeSvg()+'</svg>';
  if(sh.pts) h+='<div class="erf-hint">Die Vorschau zeigt Beispielmaße, bis alle Maße eingetragen sind.</div>';
  h+='<div class="erf-row">'+btn('shape-make',sh.n+' erzeugen',{cls:''})+'</div></div>';
  return h;
}

var FLOOR_PRESETS={keller:{n:'Keller',art:'keller',heated:false,h:'2,40'},eg:{n:'Erdgeschoss',art:'voll',heated:true,h:'2,50'},og:{n:'Obergeschoss',art:'voll',heated:true,h:'2,50'},dg:{n:'Dachgeschoss',art:'dach',heated:true,h:'1,20'}};
var TURNS=[{v:'90',t:'Ecke nach rechts (90°)'},{v:'-90',t:'Ecke nach links (90°)'},{v:'45',t:'schräg rechts (45°)'},{v:'-45',t:'schräg links (45°)'},{v:'135',t:'spitz rechts (135°)'},{v:'-135',t:'spitz links (135°)'},{v:'0',t:'gerade weiter (0°)'}];
function openingHTML(ownerPath,ownerId,o,j,isRoof){
  var kinds=o.kind==='tuer'?['tuer']:['fenster'],p=ownerPath+'/ow/'+o.id+'/';
  var h='<div class="erf-ow"><div class="erf-row"><b>'+(o.kind==='tuer'?'Tür ':'Fenster ')+(j+1)+'</b><span class="erf-hint">'+esc(f2(C.oArea(o)))+' m²</span><span style="flex:1"></span>'+btn('ow-del','Entfernen',{x:ownerId,y:o.id})+'</div>';
  h+='<div class="erf-g">'+S(p+'bt','Bauteil',katOpts(kinds,o.bt),{cls:'wide',blank:'Bauteil wählen'})+F(p+'b','Breite m')+F(p+'h','Höhe m')+F(p+'n','Anzahl')+
     (o.kind==='tuer'?'':S(p+'roll','Rollladenkasten',['nein','ja'],{noblank:1}))+'</div></div>';
  return h;
}
function openingsBlock(ownerPath,ownerId,ow,isRoof){
  var h=(ow||[]).map(function(o,j){return openingHTML(ownerPath,ownerId,o,j,isRoof)}).join('');
  h+='<div class="erf-row">'+btn('ow-add','Fenster hinzufügen',{x:ownerId,y:'fenster'})+(isRoof?'':btn('ow-add','Tür hinzufügen',{x:ownerId,y:'tuer'}))+'</div>';
  if(!E.kat.some(function(k){return k.kind==='fenster'})) h+='<div class="erf-hint">Es gibt noch kein Fenster-Bauteil. Unter „Bauteile“ anlegen (Uw, g-Wert), dann hier zuordnen.</div>';
  return h;
}
function turnSgn(fl){var tr=C.trace(fl,E.g.h0);return (tr.n>=3&&tr.signed>0)?-1:1}
function innenW(fl,w){
  if(!C.has(w.turn)&&w.turn!==0) return '';
  var v=Math.round((180-turnSgn(fl)*N(w.turn))*10)/10;
  return String(v).replace('.',',');
}
function wallCard(fl,w,i){
  var sel=(w.id===selWall),p='gesch/'+fl.id+'/walls/'+w.id+'/';
  var h='<div class="erf-wall'+(sel?' sel':'')+'" id="erf-w-'+w.id+'"><button type="button" class="erf-wh" data-a="wall-sel" data-x="'+w.id+'" aria-expanded="'+sel+'" data-out="w:'+w.id+'">'+outW(w.id)+'</button>';
  if(sel){
    var kinds=WALLKIND[w.type]||[];
    h+='<div class="erf-wb"><div class="erf-g">'+
      F(p+'len','Länge in m (Außenmaß)')+
      '<label class="erf-f"><span>Innenwinkel der Ecke danach in Grad (innen gemessen)</span><input type="text" inputmode="decimal" autocomplete="off" data-iw="'+p+'turn" value="'+esc(innenW(fl,w))+'" placeholder="z. B. 90"></label>'+
      S(p+'turn','oder Ecke wählen',TURNS,{noblank:1,fmt:function(v){return 'Drehung '+v+'°'}})+
      S(p+'type','Grenzt an',Object.keys(C.WTYPE).map(function(k){return {v:k,t:C.WTYPE[k]}}),{noblank:1,r:1})+
      (w.type==='nachbar'?'':S(p+'bt','Bauteil',katOpts(kinds,w.bt),{cls:'wide',blank:'Bauteil wählen'}))+
      F(p+'h','Höhe abweichend in m',{ph:'Geschosshöhe '+f2(N(fl.h))})+
      F(p+'giebel','Zusatzfläche Giebel in m²')+
      '</div>';
    if(w.type!=='nachbar'&&!E.kat.some(function(k){return kinds.indexOf(k.kind)>=0})) h+='<div class="erf-row"><span class="erf-hint">Noch kein passendes Bauteil vorhanden.</span>'+btn('step','Zu den Bauteilen',{x:'bt'})+'</div>';
    h+=openingsBlock('gesch/'+fl.id+'/walls/'+w.id,w.id,w.ow,false);
    h+=photoBox('w:'+w.id,'Fotos zu dieser Wand (Aufbau, Schäden, Fenster)');
    h+='<div class="erf-row">'+btn('wall-ins','Wand danach einfügen',{x:w.id})+btn('wall-del','Wand löschen',{x:w.id})+'</div></div>';
  }
  return h+'</div>';
}
function viewGeo(){
  var fl=floorObj();
  var top='<div class="erf-floors">'+E.gesch.map(function(f){return '<button type="button" class="ghost" data-a="floor-sel" data-x="'+f.id+'" aria-pressed="'+(fl&&f.id===fl.id)+'">'+esc(f.name||'Geschoss')+(f.heated==='nein'?' (unbeheizt)':'')+'</button>'}).join('')+'</div>'+
    '<div class="erf-row"><span class="erf-hint">Geschoss hinzufügen:</span>'+Object.keys(FLOOR_PRESETS).map(function(k){return btn('floor-add',FLOOR_PRESETS[k].n,{x:k})}).join('')+btn('floor-add','weiteres',{x:'frei'})+'</div>';
  var h=sec('Geschosse',top+'<div class="erf-g">'+F('g/h0','Laufrichtung der ersten Wand in Grad',{ph:'90 = nach Osten'})+
    '<label class="erf-f"><span>Richtung wählen</span><select data-a="h0-pick"><option value="">Himmelsrichtung wählen</option>'+C.DIR8.map(function(d,i){return '<option value="'+(i*45)+'">'+d+' ('+(i*45)+'°)</option>'}).join('')+'</select></label></div>'+
    '<div class="erf-hint">Die Wände werden im Uhrzeigersinn oder dagegen nacheinander eingegeben, wie auf dem Plan nachgezeichnet. 0° = Nord, 90° = Ost, 180° = Süd, 270° = West. Alle Geschosse gelten für dieselbe Planausrichtung.</div>');
  if(!fl) return h+sec('','<div class="erf-hint">Noch kein Geschoss angelegt. Oben „Erdgeschoss“ wählen.</div>');
  var fp='gesch/'+fl.id+'/';
  var others=E.gesch.filter(function(f){return f.id!==fl.id&&f.walls.length});
  var props='<div class="erf-g">'+F(fp+'name','Name',{text:1})+S(fp+'art','Art',[{v:'keller',t:'Keller'},{v:'voll',t:'Vollgeschoss'},{v:'dach',t:'Dachgeschoss (Kniestock)'}],{noblank:1})+
    S(fp+'heated','Beheizt',[{v:'ja',t:'ja, innerhalb der Hülle'},{v:'nein',t:'nein, außerhalb der Hülle'}],{noblank:1,r:1})+S(fp+'hm','Höhe erfassen als',[{v:'ok',t:'OKFF zu OKFF'},{v:'licht',t:'lichte Höhe + Decke'}],{noblank:1,r:1})+
    (fl.hm==='licht'?F(fp+'hl','Lichte Raumhöhe in m (Fußboden bis Decke, gemessen)')+F(fp+'dd','Deckenstärke in m (Geschossdecke mit Fußbodenaufbau)',{ph:'z. B. 0,30'}):F(fp+'h','Geschosshöhe in m (OKFF zu OKFF)'))+'</div>'+
    (fl.hm==='licht'?'<div class="erf-hint" data-out="hcalc:'+fl.id+'">'+esc(outH(fl))+'</div>':'');
  if(fl.heated==='nein') props+='<div class="erf-hint">Dieses Geschoss liegt außerhalb der thermischen Hülle. Seine Wände zählen nicht zur Hülle, die Decke darüber schon.</div>';
  var tools=shapeBlock(fl)+'<div class="erf-row">'+
    (others.length?'<label class="erf-f" style="min-width:11rem"><span>Wände kopieren von</span><select id="erf-cp">'+others.map(function(f){return '<option value="'+f.id+'">'+esc(f.name)+'</option>'}).join('')+'</select></label><label class="erf-ck"><input type="checkbox" id="erf-cpo"><span>mit Fenstern</span></label>'+btn('floor-copy','Kopieren'):'')+
    btn('floor-del','Geschoss löschen')+'</div>';
  h+=sec('Geschoss '+(fl.name||''),props+tools+photoBox('f:'+fl.id,'Fotos zum Geschoss (Raum, Decke, Gesamteindruck)'));
  var walls=fl.walls.map(function(w,i){return wallCard(fl,w,i)}).join('');
  var left='<div class="erf-svgbox"><svg class="erf-svg" viewBox="0 0 460 340" role="img" aria-label="Skizze des Wandzugs" data-out="svg">'+svgFor(fl)+'</svg></div>';
  var right='<div style="display:grid;gap:.6rem;min-width:0"><div class="erf-row" style="gap:.8rem"><span data-out="closure">'+outClosure()+'</span></div><div data-out="closebtn">'+outCloseBtn()+'</div>'+walls+'<div class="erf-row">'+btn('wall-add','Wand hinzufügen',{cls:''})+'</div></div>';
  h+='<div class="erf-two">'+left+right+'</div>';
  h+=sec('Summen der Hülle (alle Geschosse und Flächen)','<div data-out="hull">'+hullHTML()+'</div>');
  return h;
}

function katCard(k){
  var sel=(k.id===selKat),kd=C.KINDS[k.kind],n=usage(k.id);
  var h='<div class="erf-kat'+(sel?' sel':'')+'" id="erf-k-'+k.id+'"><button type="button" class="erf-wh" data-a="kat-sel" data-x="'+k.id+'"><span style="flex:1;min-width:0">'+esc(k.name||'Neues Bauteil')+'<br><small style="font-weight:400;color:var(--muted)">'+esc(kd.n)+' · '+(n?('verwendet '+n+'×'):'noch nicht verwendet')+(WALLKINDREV[k.kind]&&wallRefs(k.id).length?' · '+esc(wallRefs(k.id).join(', ')):'')+'</small></span><span class="erf-u" data-out="u:'+k.id+'">'+outU(k.id)+'</span></button>';
  if(sel){
    var p='kat/'+k.id+'/',win=(k.kind==='fenster'||k.kind==='tuer');
    h+='<div class="erf-wb"><div class="erf-g">'+F(p+'name','Bezeichnung',{text:1,ph:win?'z. B. Kunststoff 2-fach WSV, 2004':'z. B. Außenwand Vollziegel 36,5 cm'})+
      S(p+'src','Quelle des U-Werts',win?[{v:'plan',t:'Datenblatt, Plan oder Nachweis'},{v:'pausch',t:'Pauschalwert (amtliche Tabelle)'},{v:'schaetz',t:'geschätzt'}]:[{v:'calc',t:'aus Schichtaufbau berechnet'},{v:'plan',t:'Plan oder Nachweis (U-Wert bekannt)'},{v:'pausch',t:'Pauschalwert (amtliche Tabelle)'},{v:'schaetz',t:'geschätzt'}],{noblank:1,r:1})+'</div>';
    if(win){
      h+='<div class="erf-g">'+S(p+'verg','Verglasung',['Einfachverglasung','Kasten- oder Verbundfenster','2-fach Isolierglas','2-fach Wärmeschutzglas','3-fach Wärmeschutzglas','Sonstiges'])+
        S(p+'rahmen','Rahmen',['Holz','Kunststoff','Aluminium ohne thermische Trennung','Aluminium mit thermischer Trennung','Holz-Aluminium','Stahl'])+
        F(p+'u',k.kind==='tuer'?'UD in W/(m²K)':'Uw in W/(m²K)')+(k.kind==='tuer'?'':F(p+'g','g-Wert (Gesamtenergiedurchlassgrad)',{ph:'z. B. 0,60'})+F(p+'fr','Rahmenanteil in %',{ph:'z. B. 30'}))+F(p+'bj','Einbaujahr')+'</div>';
    }else if((k.src||'calc')==='calc'){
      h+='<div class="erf-hint">Schichten von innen nach außen. Die λ-Werte sind Richtwerte, Datenblatt und Norm gehen vor und jede Zeile ist änderbar.</div>';
      h+=(k.layers||[]).map(function(l,j){return layerRow(k,l,j)}).join('');
      h+='<div class="erf-row">'+btn('layer-add','Schicht hinzufügen',{x:k.id,cls:''})+btn('layer-vent','Hinterlüftung ab hier',{x:k.id})+'</div>';
      h+='<details><summary class="erf-hint">Übergangswiderstände ändern (Standard je Bauteilart: Rsi '+f2(kd.rsi)+', Rse '+f2(kd.rse)+')</summary><div class="erf-g" style="margin-top:.5rem">'+F(p+'rsi','Rsi in m²K/W',{ph:f2(kd.rsi)})+F(p+'rse','Rse in m²K/W',{ph:f2(kd.rse)})+'</div></details>';
      h+='<div data-out="ud:'+k.id+'">'+outUDetail(k.id)+'</div>';
    }else{
      h+='<div class="erf-g">'+F(p+'u','U-Wert in W/(m²K)')+'</div>';
      if(k.src==='schaetz') h+='<div class="erf-note">Geschätzte Werte vor der Abgabe belegen oder durch einen Aufbau ersetzen. Das Bauteil wird im Datenblatt als geschätzt markiert.</div>';
      if(k.src==='pausch') h+='<div class="erf-hint">Pauschalwert aus der amtlichen Tabelle für das Baualter eintragen. Die App liefert diese Tabellenwerte nicht selbst.</div>';
    }
    h+=wallPick(k);
    h+=TA(p+'note','Notiz (Quelle, Besonderheiten)',2)+photoBox('kat:'+k.id,'Foto vom Aufbau oder Bauteil');
    h+='<div class="erf-row">'+btn('kat-dup','Duplizieren',{x:k.id})+btn('kat-del','Löschen',{x:k.id})+'</div></div>';
  }
  return h+'</div>';
}
function layerRow(k,l,j){
  var p='kat/'+k.id+'/layers/'+l.id+'/',n=k.layers.length;
  var acts=btn('layer-up','↑',{x:k.id,y:l.id})+btn('layer-down','↓',{x:k.id,y:l.id})+btn('layer-del','✕',{x:k.id,y:l.id});
  if(l.vent) return '<div class="erf-layer vent"><div class="erf-row"><b>Hinterlüftung</b><span class="erf-hint" style="flex:1;min-width:12rem">Schichten, die hier außen folgen, werden nicht angesetzt. Der äußere Übergangswiderstand entspricht dem inneren.</span>'+acts+'</div></div>';
  var m=C.mat(l.m),fixed=m&&m.fixed!=null;
  var groups={},order=[];
  C.MATS.forEach(function(x){if(!groups[x.g]){groups[x.g]=[];order.push(x.g)}groups[x.g].push({v:x.id,t:x.n+(x.l?' ('+String(x.l).replace('.',',')+')':'')})});
  var opts=order.map(function(g){return {g:g,items:groups[g]}});
  var h='<div class="erf-layer"><div class="erf-row"><b>Schicht '+(j+1)+'</b><span style="flex:1"></span>'+(fixed?'':btn('layer-w',l.w?'Anteil entfernen':'Sparren, Ständer')+'')+acts+'</div>';
  h+='<div class="erf-g lay">'+S(p+'m','Material',opts,{r:1,mat:1,blank:'Material wählen',cls:'lm'});
  if(fixed) h+=F(p+'r','R in m²K/W',{ph:f2(m.fixed)});
  else h+=F(p+'d','Dicke in cm')+F(p+'l','λ in W/(mK)');
  if(l.m==='eigen') h+=F(p+'n','Bezeichnung',{text:1,cls:'lm'});
  if(l.w&&!fixed) h+=F(p+'w/a','Anteil Holz o. ä. in %')+F(p+'w/l','λ dieses Anteils');
  return h+'</div></div>';
}
function viewBt(){
  var addOpts=[{g:'Leer anlegen',items:Object.keys(C.KINDS).map(function(k){return {v:'k:'+k,t:C.KINDS[k].n}})},{g:'Vorlagen (Aufbau vor Ort prüfen)',items:C.PRESETS.map(function(p,i){return {v:'p:'+i,t:p.n}})}];
  var add='<div class="erf-g w2"><label class="erf-f"><span>Neues Bauteil anlegen</span><select data-a="kat-new"><option value="">wählen</option>'+addOpts.map(function(g){return '<optgroup label="'+esc(g.g)+'">'+g.items.map(function(x){return '<option value="'+esc(x.v)+'">'+esc(x.t)+'</option>'}).join('')+'</optgroup>'}).join('')+'</select></label></div>';
  var order=Object.keys(C.KINDS),h=sec('Bauteilkatalog',add+'<div class="erf-hint">Jedes Bauteil einmal anlegen, danach in Wänden und Flächen zuordnen. Wie im Energieberater: erst Aufbau, dann Zuordnung. Die U-Werte dienen der Plausibilisierung, rechnen und abgeben tust du im Energieberater.</div>');
  var any=false;
  order.forEach(function(kind){
    var l=E.kat.filter(function(k){return k.kind===kind});if(!l.length) return;any=true;
    l.sort(function(a,b){return String(a.name).localeCompare(String(b.name),'de')});
    h+=sec(C.KINDS[kind].n,'<div style="display:grid;gap:.6rem">'+l.map(katCard).join('')+'</div>');
  });
  if(!any) h+=sec('','<div class="erf-hint">Noch keine Bauteile. Oben eine Vorlage wählen oder leer anlegen.</div>');
  return h;
}

function surfCard(s){
  var sel=(s.id===selSurf),sd=C.SURF[s.art]||{n:'Fläche',kind:'decke_o'},p='surf/'+s.id+'/',roof=(s.art==='dach_s'||s.art==='dach_f');
  var kinds=(s.art==='decke_u'||s.art==='decke_a')?['decke_u','boden']:(s.art==='boden'?['boden','decke_u']:(roof?['dach','decke_o']:['decke_o','dach','decke_u']));
  var h='<div class="erf-kat'+(sel?' sel':'')+'" id="erf-s-'+s.id+'"><button type="button" class="erf-wh" data-a="surf-sel" data-x="'+s.id+'"><span style="flex:1;min-width:0">'+esc(sd.n)+'<br><small style="font-weight:400;color:var(--muted)" data-out="s:'+s.id+'">'+outSurf(s.id)+'</small></span></button>';
  if(sel){
    h+='<div class="erf-wb"><div class="erf-g">'+S(p+'bt','Bauteil',katOpts(kinds,s.bt),{blank:'Bauteil wählen'})+F(p+'a','Fläche in m²')+
      (s.art==='dach_s'?F(p+'neig','Neigung in Grad')+S(p+'dir','Ausrichtung der Fläche',C.DIR8):'')+'</div>';
    h+='<div class="erf-row"><button type="button" class="ghost" data-a="surf-sugg" data-x="'+s.id+'" data-out="sg:'+s.id+'">'+esc(outSugg(s.id)||'Vorschlag nicht möglich')+'</button></div>';
    if(roof) h+=openingsBlock('surf/'+s.id,s.id,s.ow,true);
    h+='<div class="erf-hint">Dachflächen: Fläche ohne Dachüberstand, Dachflächenfenster unten abziehen. Der Vorschlag nutzt die Grundfläche des obersten (bzw. untersten) beheizten Geschosses, bei Dachschrägen geteilt durch den Kosinus der Neigung.</div>';
    h+=photoBox('s:'+s.id,'Fotos zu dieser Fläche (Dachboden, Decke, Boden)');
    h+='<div class="erf-row">'+btn('surf-del','Fläche löschen',{x:s.id})+'</div></div>';
  }
  return h+'</div>';
}
function viewFl(){
  var addOpts=Object.keys(C.SURF).map(function(k){return '<option value="'+k+'">'+esc(C.SURF[k].n)+'</option>'}).join('');
  var h=sec('Dach, Decken, Boden','<div class="erf-g w2"><label class="erf-f"><span>Fläche hinzufügen</span><select data-a="surf-new"><option value="">wählen</option>'+addOpts+'</select></label></div><div class="erf-hint">Oberer und unterer Gebäudeabschluss gegen Außenluft, Erdreich oder unbeheizte Räume. Wände sind im Schritt „Grundriss und Wände“ erfasst.</div>');
  h+=sec('','<div style="display:grid;gap:.6rem">'+(E.surf.length?E.surf.map(surfCard).join(''):'<div class="erf-hint">Noch keine Flächen.</div>')+'</div>');
  return h;
}

function viewAnl(){
  var h='';
  C.ANL.forEach(function(sc){
    var d=E.anl[sc.k]||{},body='<div class="erf-g w2">';
    sc.f.forEach(function(f){
      if(f.c){var v=d[f.c];if(!has(v)||v===(f.cx||'keine')||v==='keiner') return}
      var p='anl/'+sc.k+'/'+f.k;
      if(f.t==='sel') body+=S(p,f.l+(f.req?' *':''),f.o,{r:1});
      else body+=F(p,f.l+(f.req?' *':''),{ph:f.ph});
    });
    body+='</div>';
    if(sc.photo) body+=photoBox('anl:'+sc.k,sc.photo);
    h+=sec(sc.t,body);
  });
  return '<div class="erf-hint">* Pflichtangabe. Die Reihenfolge entspricht der Begehung. Lüftung, Warmwasser, Heizung, Kühlung und erneuerbare Energien gehören im Energieberater zur Anlagentechnik.</div>'+h;
}

function jumpList(items){
  if(!items.length) return '<div class="erf-ok">Nichts offen.</div>';
  return '<ul class="erf-list">'+items.map(function(m){
    var sn=C.STEPS.filter(function(s){return s.k===m.step})[0];
    return '<li>'+btn('jump','Hin',{x:m.step,y:m.ref||''})+'<span><b>'+esc(sn?sn.n:'')+':</b> '+esc(m.t)+'</span></li>';
  }).join('')+'</ul>';
}
/* Kundenerfassung: Kundenstamm der App (Auswahl, neu anlegen, Daten). Die Felder liegen in der App, hier nur Ein- und Ausgabe. */
function isoDe(i){var m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(i||'');return m?m[3]+'.'+m[2]+'.'+m[1]:''}
function kdLine(){
  var K=KD?KD.get():null;if(!K) return kdName;
  var a=[K.str+(K.nr?' '+K.nr:''),(K.plz+' '+K.ort).trim()].filter(function(x){return String(x).trim()}).join(', ');
  return [K.name,a].filter(Boolean).join(', ');
}
function kF(k,label,v,o){
  o=o||{};
  return '<label class="erf-f'+(o.cls?' '+o.cls:'')+'"><span>'+esc(label)+'</span><input type="text" data-k="'+k+'"'+(o.num?' inputmode="numeric"':'')+(o.max?' maxlength="'+o.max+'"':'')+' autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" value="'+esc(v)+'"></label>';
}
function viewKunde(){
  var K=KD?KD.get():null;
  if(!K) return sec('Kunde','<div class="erf-hint">Die Kundenverwaltung ist hier nicht verfügbar.</div>');
  var opts='<option value="">Neuer Kunde</option>'+K.list.map(function(x){return '<option value="'+esc(x.id)+'"'+(x.id===K.id?' selected':'')+'>'+esc(x.label)+'</option>'}).join('');
  var h=sec('Kunde wählen oder neu anlegen','<div class="erf-g"><label class="erf-f wide"><span>Gespeicherte Kunden</span><select data-k="_sel">'+opts+'</select></label></div>'+
    '<div class="erf-row">'+btn('kd-new','Neuer Kunde')+btn('kd-save','Speichern',{cls:''})+'<span class="erf-hint" id="erf-kdmsg" role="status"></span></div>'+
    '<div class="erf-hint">'+(K.id?'Geöffnet: '+esc(K.name||'Ohne Name')+'. Änderungen werden automatisch gespeichert.':'Neuer Kunde. Name oder Adresse eintragen, dann wird automatisch gespeichert.')+'</div>');
  h+=sec('Kunde und Objektadresse','<div class="erf-g">'+kF('name','Name',K.name,{cls:'wide'})+'<label class="erf-f"><span>Datum der Beratung</span><input type="date" data-k="datum" value="'+esc(K.datum||'')+'"></label></div>'+
    '<div class="erf-g">'+kF('str','Straße',K.str)+kF('nr','Nr.',K.nr,{max:10})+kF('plz','PLZ',K.plz,{num:1,max:5})+kF('ort','Ort',K.ort)+'</div>'+
    '<label class="erf-f"><span>Notiz</span><textarea rows="3" data-k="note">'+esc(K.note)+'</textarea></label>');
  var rgA=K.rg==='abw';
  h+=sec('Rechnungsadresse','<label class="erf-f wide"><span>Rechnung an</span><select data-k="rg"><option value=""'+(rgA?'':' selected')+'>wie Objektadresse</option><option value="abw"'+(rgA?' selected':'')+'>abweichend (anderer Empfänger oder andere Anschrift)</option></select></label>'+
    (rgA?'<div class="erf-g">'+kF('rgname','Name oder Firma, falls abweichend',K.rgname,{cls:'wide'})+'</div><div class="erf-g">'+kF('rgstr','Straße',K.rgstr)+kF('rgnr','Nr.',K.rgnr,{max:10})+kF('rgplz','PLZ',K.rgplz,{num:1,max:5})+kF('rgort','Ort',K.rgort)+'</div>':'')+
    '<div class="erf-hint">Nur ausfüllen, wenn die Rechnung nicht an die Objektadresse geht, zum Beispiel bei Vermietung oder Verkauf.</div>');
  return h;
}
function viewAbs(){
  var M=C.missing(E),W=C.warnings(E);
  var h=sec('Mängel, Empfehlungen, offene Punkte',TA('abs/maengel','Mängel und Auffälligkeiten (Feuchte, Wärmebrücken, Undichtigkeiten, Bauschäden)',4)+TA('abs/empf','Sanierungsmöglichkeiten für die Modernisierungsempfehlungen',4)+TA('abs/offen','Offene Punkte: was noch nachgereicht oder geklärt werden muss',3)+photoBox('abs','Fotos zu Mängeln'));
  h+=sec('Fehlt noch ('+M.length+')',jumpList(M));
  h+=sec('Hinweise zur Plausibilität ('+W.length+')',W.length?jumpList(W):'<div class="erf-ok">Keine Auffälligkeiten.</div>');
  return h;
}

/* ---------- Datenblatt ---------- */
function kv(pairs){return '<div class="kv">'+pairs.filter(function(p){return has(p[1])}).map(function(p){return '<span>'+esc(p[0])+'</span><span>'+esc(p[1])+'</span>'}).join('')+'</div>'}
function photosHTML(key){return (E.photos[key]||[]).map(function(p){return '<img src="'+p.d+'" alt="">'}).join('')}
function sheetHTML(){
  var g=E.g,h='<div class="erf-sheet" id="erf-sheet"><h2>Datenerfassung Energieausweis (Bedarf)</h2>';
  h+='<div class="erf-hint" style="color:#555">'+esc(kdLine())+(kdLine()?' · ':'')+(isoDe((KD&&KD.get().datum)||'')?'Datum '+isoDe(KD.get().datum):'Stand '+new Date().toLocaleDateString('de-DE'))+'. Erfassung vor Ort zur Übertragung in den Energieberater, keine Berechnung nach GEG.</div>';
  var K0=KD?KD.get():null;if(K0&&K0.rg==='abw'&&has(K0.rgadr)) h+='<div class="erf-hint" style="color:#555">Rechnungsadresse: '+esc(K0.rgadr)+'</div>';
  h+='<section><h4>1. Gebäude</h4>'+kv([['Gebäudetyp',g.typ],['Baujahr',g.bj],['Bauantrag',g.antrag],['Wohneinheiten',g.we],['Vollgeschosse',g.vg],['Keller',g.keller],['Dachform',g.dachform],['Dachgeschoss',g.dg],['Wohnfläche',has(g.wf)?g.wf+' m²':''],['Denkmalschutz',g.denk],['Anbauten',g.anbau],['Besonderheiten',g.bem],['Laufrichtung 1. Wand',g.h0+'°']]);
  h+='<div style="margin-top:.5rem"><b>Unterlagen</b><br>'+C.UNTERL.map(function(u){return (E.unterl[u[0]]==='1'?'☑ ':'☐ ')+esc(u[1])}).join('<br>')+'</div>'+photosHTML('gebaeude')+'</section>';
  h+='<section><h4>2. Grundriss und Wände</h4>';
  E.gesch.forEach(function(fl){
    var tr=C.trace(fl,g.h0);
    h+='<div><b>'+esc(fl.name)+'</b> · '+(fl.heated==='nein'?'unbeheizt':'beheizt')+' · Höhe '+f2(N(fl.h))+' m'+(fl.hm==='licht'?' (lichte Höhe '+f2(N(fl.hl))+' m plus Decke '+f2(N(fl.dd))+' m)':'')+' · Grundfläche '+f2(tr.area)+' m² · Umfang '+f2(tr.perim)+' m'+(tr.closed?'':' · <b>Wandzug nicht geschlossen</b>')+'</div>'+photosHTML('f:'+fl.id);
    if(tr.n) h+='<div class="erf-keep"><svg class="sk" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 340" width="440" style="max-width:100%;height:auto;display:block" role="img" aria-label="Grundriss '+esc(fl.name)+'">'+svgFor(fl,true)+'</svg><div class="erf-hint" style="color:#555">Grundriss '+esc(fl.name)+', schematisch, nicht maßstäblich genormt. Grüner Punkt: Anfang Wand 1. Blaue Striche: Fenster.</div></div>';
    h+='<div class="erf-wrapx"><table class="erf-tb"><thead><tr><th>Wand</th><th class="r">Länge m</th><th>Richtung</th><th>Grenzt an</th><th>Bauteil</th><th class="r">Höhe m</th><th class="r">Brutto m²</th><th class="r">Öffnungen m²</th><th class="r">Netto m²</th></tr></thead><tbody>';
    fl.walls.forEach(function(w,i){
      var gm=C.wallGeom(fl,w,E),k=C.findKat(E,w.bt);
      h+='<tr><td>Wand '+(i+1)+'</td><td class="r">'+f2(N(w.len))+'</td><td>'+esc(C.dirName(C.wallBearing(tr,i)))+'</td><td>'+esc(C.WTYPE[w.type])+'</td><td>'+esc(w.type==='nachbar'?'':(k?k.name:''))+'</td><td class="r">'+f2(gm.H)+'</td><td class="r">'+f2(gm.gross)+'</td><td class="r">'+f2(gm.open)+'</td><td class="r">'+f2(gm.net)+'</td></tr>';
      if(photoNum('w:'+w.id)) h+='<tr><td></td><td colspan="8">'+photosHTML('w:'+w.id)+'</td></tr>';
      (w.ow||[]).forEach(function(o){
        var ko=C.findKat(E,o.bt);
        h+='<tr><td></td><td colspan="4" style="color:#555">'+(o.kind==='tuer'?'Tür':'Fenster')+': '+esc(ko?ko.name:'ohne Bauteil')+(o.kind==='tuer'?'':(o.roll==='ja'?', mit Rollladenkasten':''))+'</td><td class="r">'+f2(N(o.b))+' × '+f2(N(o.h))+'</td><td class="r">× '+esc(String(Math.max(1,Math.round(N(o.n)||1))))+'</td><td></td><td class="r">'+f2(C.oArea(o))+'</td></tr>';
      });
    });
    h+='</tbody></table></div>';
  });
  h+='</section>';
  h+='<section><h4>3. Bauteile</h4>';
  var ord=Object.keys(C.KINDS);
  E.kat.slice().sort(function(a,b){return ord.indexOf(a.kind)-ord.indexOf(b.kind)}).forEach(function(k){
    var u=C.uOf(k),win=(k.kind==='fenster'||k.kind==='tuer');
    h+='<div style="margin:.4rem 0"><b>'+esc(k.name||'ohne Namen')+'</b> · '+esc(C.KINDS[k.kind].n)+' · '+(u.ok?'<b>U '+(win?f2(u.u):f3(u.u))+' W/(m²K)</b>':'U fehlt')+' · '+esc(C.SRC[k.src||'calc']||'')+(usage(k.id)?'':' · nicht verwendet')+(WALLKINDREV[k.kind]&&wallRefs(k.id).length?' · '+esc(wallRefs(k.id).join(', ')):'')+'</div>';
    if(win) h+='<div>'+esc([k.verg,k.rahmen,has(k.g)?'g '+k.g:'',has(k.fr)?'Rahmenanteil '+k.fr+' %':'',has(k.bj)?'Einbau '+k.bj:''].filter(Boolean).join(' · '))+'</div>';
    else if(u.calc&&u.calc.ok){
      h+='<div class="erf-wrapx"><table class="erf-tb"><thead><tr><th>Schicht, innen nach außen</th><th class="r">Dicke cm</th><th class="r">λ</th><th>Anteil</th></tr></thead><tbody>';
      k.layers.forEach(function(l){
        if(l.vent){h+='<tr><td colspan="4"><i>Hinterlüftung, Schichten außen nicht angesetzt</i></td></tr>';return}
        var m=C.mat(l.m),nm=(l.m==='eigen'?(l.n||'Eigenes Material'):(m?m.n:''));
        h+='<tr><td>'+esc(nm)+'</td><td class="r">'+(m&&m.fixed!=null?'':esc(l.d))+'</td><td class="r">'+(m&&m.fixed!=null?'R '+esc(has(l.r)?l.r:f2(m.fixed)):esc(l.l))+'</td><td>'+(l.w&&has(l.w.a)?esc(l.w.a)+' % λ '+esc(l.w.l):'')+'</td></tr>';
      });
      h+='</tbody></table></div>';
    }
    if(has(k.note)) h+='<div>'+esc(k.note)+'</div>';
    h+=photosHTML('kat:'+k.id);
  });
  h+='</section>';
  h+='<section><h4>4. Dach, Decken, Boden</h4>';
  if(E.surf.length){
    h+='<div class="erf-wrapx"><table class="erf-tb"><thead><tr><th>Fläche</th><th>Bauteil</th><th class="r">Neigung</th><th>Richtung</th><th class="r">Fläche m²</th><th class="r">Fenster m²</th></tr></thead><tbody>';
    E.surf.forEach(function(s){
      var k=C.findKat(E,s.bt),ow=0;(s.ow||[]).forEach(function(o){ow+=C.oArea(o)});
      h+='<tr><td>'+esc((C.SURF[s.art]||{}).n||'')+'</td><td>'+esc(k?k.name:'')+'</td><td class="r">'+(s.art==='dach_s'?esc(s.neig)+'°':'')+'</td><td>'+(s.art==='dach_s'?esc(s.dir):'')+'</td><td class="r">'+f2(N(s.a))+'</td><td class="r">'+f2(ow)+'</td></tr>';
      if(photoNum('s:'+s.id)) h+='<tr><td colspan="6">'+photosHTML('s:'+s.id)+'</td></tr>';
    });
    h+='</tbody></table></div>';
  }else h+='<div>Keine Flächen erfasst.</div>';
  h+='</section>';
  h+='<section><h4>5. Summen</h4>'+hullHTML()+'</section>';
  h+='<section><h4>6. Anlagentechnik</h4>';
  C.ANL.forEach(function(sc){
    var d=E.anl[sc.k]||{},pairs=[];
    sc.f.forEach(function(f){if(has(d[f.k])) pairs.push([f.l,d[f.k]])});
    if(pairs.length||E.photos['anl:'+sc.k]) h+='<div style="margin:.3rem 0 .1rem"><b>'+esc(sc.t)+'</b></div>'+kv(pairs)+photosHTML('anl:'+sc.k);
  });
  h+='</section>';
  var a=E.abs;
  h+='<section><h4>7. Mängel, Empfehlungen, offene Punkte</h4>'+kv([['Mängel',a.maengel],['Sanierungsmöglichkeiten',a.empf],['Offene Punkte',a.offen]])+photosHTML('abs')+'</section>';
  var M=C.missing(E);
  if(M.length) h+='<section><h4>Noch fehlende Angaben</h4><div>'+M.map(function(m){return '• '+esc(m.t)}).join('<br>')+'</div></section>';
  return h+'</div>';
}
/* PDF des Datenblatts: auf dem iPad druckt window.print() in der Home-Bildschirm-App nicht. Deshalb PDF erzeugen (html2canvas + jsPDF)
   und über das Teilen-Menü ausgeben (Sichern, Drucken, Mail). Seitenumbruch an Blockgrenzen. */
var pdfBlob=null,pdfName='',pdfBusy=false;
function loadScript(src){return new Promise(function(res,rej){var el=document.createElement('script');el.src=src;el.onload=res;el.onerror=function(){rej(new Error('Skript '+src+' nicht geladen'))};document.head.appendChild(el)})}
function ensureLibs(){
  var p=Promise.resolve();
  if(!window.html2canvas) p=p.then(function(){return loadScript('vendor/html2canvas.min.js')});
  if(!(window.jspdf&&window.jspdf.jsPDF)) p=p.then(function(){return loadScript('vendor/jspdf.umd.min.js')});
  return p;
}
function sheetPdfBlob(){
  return ensureLibs().then(function(){
    var el=document.getElementById('erf-sheet');if(!el) throw new Error('Kein Datenblatt');
    var wrap=document.createElement('div');wrap.style.cssText='position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1';
    var c=el.cloneNode(true);c.removeAttribute('id');
    c.style.cssText='width:794px;max-width:none;margin:0;border:0;border-radius:0;padding:14px 16px;box-sizing:border-box;position:relative';
    wrap.appendChild(c);document.body.appendChild(wrap);
    var base=c.getBoundingClientRect().top,cuts=[];
    function add(e){var t=Math.round(e.getBoundingClientRect().top-base);if(t>0&&cuts.indexOf(t)<0) cuts.push(t)}
    Array.prototype.forEach.call(c.children,function(ch){
      if(ch.tagName==='SECTION'){
        add(ch);
        Array.prototype.forEach.call(ch.children,function(k,i){if(i>=2&&!k.classList.contains('erf-wrapx')&&!k.classList.contains('erf-keep')) add(k)});
        Array.prototype.forEach.call(ch.querySelectorAll('table'),function(tb){Array.prototype.forEach.call(tb.querySelectorAll('tbody tr'),function(tr,i){if(i>=2) add(tr)})});
      }else add(ch);
    });
    return html2canvas(c,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false,windowWidth:794}).then(function(cv){
      wrap.remove();
      var doc=new window.jspdf.jsPDF({unit:'mm',format:'a4',orientation:'portrait',compress:true});
      var W=cv.width,H=cv.height,mm=210/W,usable=281,sl=Math.floor(usable/mm),kk=W/794,y=0,n=0;
      while(y<H){
        var end=Math.min(H,y+sl);
        if(end<H){var best=0;cuts.forEach(function(t){var tp=Math.round(t*kk);if(tp>y+sl*0.4&&tp<=y+sl&&tp>best) best=tp});if(best) end=best}
        var hh=end-y,t=document.createElement('canvas');t.width=W;t.height=hh;
        var g=t.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,W,hh);g.drawImage(cv,0,y,W,hh,0,0,W,hh);
        if(n>0) doc.addPage();n++;
        doc.addImage(t.toDataURL('image/jpeg',0.92),'JPEG',0,8,210,hh*mm,undefined,'FAST');
        y=end;
      }
      return doc.output('blob');
    },function(e){wrap.remove();throw e});
  });
}
function pdfFileName(){
  return ('Gebäudeerfassung'+(kdName?' '+kdName:'')+' '+((KD&&/^\d{4}-\d\d-\d\d$/.test(KD.get().datum||''))?KD.get().datum:new Date().toISOString().slice(0,10))).replace(/[^\wäöüÄÖÜß\- .]/g,'').replace(/\s+/g,' ').trim()+'.pdf';
}
function sharePdf(){
  var file=null;try{file=new File([pdfBlob],pdfName,{type:'application/pdf'})}catch(e){}
  function fallback(){
    var u=URL.createObjectURL(pdfBlob),a=document.createElement('a');a.href=u;a.download=pdfName;document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(u);a.remove()},4000);
  }
  if(file&&navigator.canShare&&navigator.canShare({files:[file]})){
    navigator.share({files:[file],title:pdfName}).catch(function(e){if(!(e&&e.name==='AbortError')) fallback()});
  }else fallback();
}
function sheetPdf(b){
  if(pdfBlob){sharePdf();return}
  if(pdfBusy) return;
  pdfBusy=true;b.disabled=true;b.textContent='Erstelle PDF …';
  sheetPdfBlob().then(function(bl){
    pdfBusy=false;pdfBlob=bl;pdfName=pdfFileName();
    var nb=document.querySelector('#erf-main [data-a="sheet-pdf"]');if(nb){nb.disabled=false;nb.textContent='PDF teilen, drucken oder sichern'}
  },function(e){
    pdfBusy=false;var nb=document.querySelector('#erf-main [data-a="sheet-pdf"]');if(nb){nb.disabled=false;nb.textContent='PDF fehlgeschlagen, erneut versuchen'}
    if(window.console) console.error(e);
  });
}
function viewBlatt(){
  var standalone=(typeof navigator!=='undefined'&&navigator.standalone===true);
  return '<div class="erf-row erf-noprint">'+btn('sheet-pdf',pdfBlob?'PDF teilen, drucken oder sichern':'PDF erstellen',{cls:''})+(standalone?'':btn('sheet-print','Drucken'))+btn('sheet-copy','Als Text kopieren')+'<span class="erf-hint" id="erf-cpmsg"></span></div>'+sheetHTML();
}

var MISSSTEPS=['stamm','geo','bt','fl','anl'];
function missBox(){
  var M=C.missing(E).filter(function(m){return m.step===step});
  if(!M.length) return '<span class="erf-okt">✓ In diesem Bereich ist alles Wichtige eingetragen.</span>';
  var h='<b>Noch offen in diesem Bereich ('+M.length+')</b><ul>'+M.slice(0,8).map(function(m){return '<li>'+esc(m.t)+'</li>'}).join('')+'</ul>';
  if(M.length>8) h+='<div>… und '+(M.length-8)+' weitere. Die vollständige Liste steht im Datenblatt.</div>';
  return h;
}
function applyMiss(){
  if(!main) return;
  Array.prototype.forEach.call(main.querySelectorAll('.miss'),function(el){el.classList.remove('miss')});
  var M=C.missing(E).filter(function(m){return m.step===step});
  M.forEach(function(m){
    (m.paths||[]).forEach(function(pt){
      var inp=main.querySelector('[data-p="'+pt+'"]'),lb=inp&&inp.closest('label');if(lb) lb.classList.add('miss');
    });
    if(m.ref){
      var hd=main.querySelector('#erf-w-'+m.ref+' > .erf-wh, #erf-k-'+m.ref+' > .erf-wh, #erf-s-'+m.ref+' > .erf-wh');if(hd) hd.classList.add('miss');
    }
  });
  if(step==='kunde'){var nm=main.querySelector('[data-k=name]');if(nm){var lb2=nm.closest('label');if(lb2) lb2.classList.toggle('miss',!has(nm.value))}}
}
function render(){
  if(!main) return;
  var st=main.scrollTop;
  var h;
  switch(step){
    case 'kunde':h=viewKunde();break;
    case 'stamm':h=viewStamm();break;
    case 'geo':h=viewGeo();break;
    case 'bt':h=viewBt();break;
    case 'fl':h=viewFl();break;
    case 'anl':h=viewAnl();break;
    case 'abs':h=viewAbs();break;
    case 'blatt':h=viewBlatt();break;
    default:h='';
  }
  if(MISSSTEPS.indexOf(step)>=0) h='<div class="erf-missbox" data-out="missbox"></div>'+h;
  main.innerHTML='<div class="erf-in">'+h+'</div>';
  main.scrollTop=st;
  drawNav();updateOuts();
}
function drawNav(){
  nav.innerHTML=C.STEPS.map(function(s,i){return '<button type="button" data-a="step" data-x="'+s.k+'" aria-current="'+(s.k===step)+'"><span class="erf-num" data-num="'+s.k+'">'+(i+1)+'</span>'+esc(s.n)+((s.k==='blatt'||s.k==='abs'||s.k==='kunde')?'':'<span class="erf-bd" data-bd="'+s.k+'"></span>')+'</button>'}).join('');
  updateBadges();
}
function go(s,keep){
  step=s;if(!keep) main.scrollTop=0;render();
}
function scrollToId(id){
  var el=document.getElementById(id);
  if(el){try{el.scrollIntoView({block:'start',behavior:'smooth'})}catch(e){el.scrollIntoView()}}
}

/* ---------- Aktionen ---------- */
function reId(o){
  if(Array.isArray(o)) return o.map(reId);
  if(o&&typeof o==='object'){var n={};for(var k in o) n[k]=(k==='id')?C.uid():reId(o[k]);return n}
  return o;
}
function actions(a,t){
  var x=t.getAttribute('data-x'),y=t.getAttribute('data-y');
  var fl,r,o;
  switch(a){
    case 'step':go(x);return;
    case 'floor-sel':curFloor=x;selWall=null;render();return;
    case 'floor-add':{
      var p=FLOOR_PRESETS[x]||{n:'Geschoss',art:'voll',heated:true,h:'2,50'};
      var f=C.newFloor(p.n,p.art,p.heated,p.h);E.gesch.push(f);curFloor=f.id;selWall=null;touch();render();return;
    }
    case 'floor-del':
      fl=floorObj();if(!fl) return;
      if(!window.confirm('Geschoss „'+fl.name+'“ mit allen Wänden und Fenstern löschen?')) return;
      dropPhotos('f:'+fl.id);fl.walls.forEach(function(w0){dropPhotos('w:'+w0.id)});
      E.gesch=E.gesch.filter(function(f2_){return f2_.id!==fl.id});curFloor=E.gesch.length?E.gesch[0].id:null;selWall=null;touch();render();return;
    case 'shape-make':{
      fl=floorObj();if(!fl) return;
      var res=C.shapeWalls(SH.key,SH.P);
      if(res.err){window.alert(res.err);return}
      if(fl.walls.length&&!window.confirm('Vorhandene Wände dieses Geschosses ersetzen?')) return;
      fl.walls.forEach(function(w0){dropPhotos('w:'+w0.id)});
      fl.walls=res.walls;selWall=fl.walls.length?fl.walls[0].id:null;touch();render();return;
    }
    case 'floor-copy':{
      fl=floorObj();if(!fl) return;
      var src=E.gesch.filter(function(f3){return f3.id===document.getElementById('erf-cp').value})[0];if(!src) return;
      if(fl.walls.length&&!window.confirm('Vorhandene Wände dieses Geschosses ersetzen?')) return;
      var withOw=document.getElementById('erf-cpo').checked;
      fl.walls.forEach(function(w0){dropPhotos('w:'+w0.id)});
      fl.walls=reId(clone(src.walls));
      fl.walls.forEach(function(w){if(!withOw) w.ow=[];else w.ow=w.ow||[]});
      selWall=fl.walls.length?fl.walls[0].id:null;touch();render();return;
    }
    case 'kat-walls-all':{
      var kk=C.findKat(E,x),okt=kk&&WALLKINDREV[kk.kind];if(!okt) return;
      E.gesch.forEach(function(f){f.walls.forEach(function(w){if(w.type===WALLPRIM[kk.kind]&&!w.bt) w.bt=kk.id})});
      touch();render();return;
    }
    case 'kat-walls-none':{
      E.gesch.forEach(function(f){f.walls.forEach(function(w){if(w.bt===x) w.bt=''})});
      touch();render();return;
    }
    case 'wall-add':{
      fl=floorObj();if(!fl) return;
      var w=C.newWall('',90);fl.walls.push(w);selWall=w.id;touch();render();setTimeout(function(){scrollToId('erf-w-'+w.id)},30);return;
    }
    case 'wall-ins':{
      r=findWall(x);if(!r) return;var nw=C.newWall('',90);r.fl.walls.splice(r.i+1,0,nw);selWall=nw.id;touch();render();return;
    }
    case 'wall-del':{
      r=findWall(x);if(!r) return;
      if(!window.confirm('Wand '+(r.i+1)+' löschen?')) return;
      dropPhotos('w:'+r.w.id);r.fl.walls.splice(r.i,1);selWall=null;touch();render();return;
    }
    case 'wall-sel':
      selWall=(selWall===x&&t.tagName!=='line')?null:x;render();if(selWall) setTimeout(function(){scrollToId('erf-w-'+x)},30);return;
    case 'wall-close':{
      fl=floorObj();if(!fl) return;var cf=C.closeFix(fl,E.g.h0);
      if(cf&&cf.ok){fl.walls[fl.walls.length-1].len=String(Math.round(cf.len*1000)/1000).replace('.',',');touch();render()}
      return;
    }
    case 'ow-add':{
      o=findOwner(x);if(!o) return;var op=C.newOpening(y);if(!o.o.ow) o.o.ow=[];o.o.ow.push(op);touch();render();return;
    }
    case 'ow-del':{
      o=findOwner(x);if(!o) return;o.o.ow=(o.o.ow||[]).filter(function(q){return q.id!==y});touch();render();return;
    }
    case 'kat-sel':selKat=(selKat===x)?null:x;render();if(selKat) setTimeout(function(){scrollToId('erf-k-'+x)},30);return;
    case 'kat-dup':{
      var k=C.findKat(E,x);if(!k) return;var c=reId(clone(k));c.name=(k.name||'Bauteil')+' (Kopie)';E.kat.push(c);selKat=c.id;touch();render();return;
    }
    case 'kat-del':{
      var kd=C.findKat(E,x);if(!kd) return;var n=usage(x);
      if(!window.confirm(n?'„'+(kd.name||'Bauteil')+'“ wird '+n+'× verwendet. Löschen entfernt die Zuordnung. Trotzdem löschen?':'Bauteil löschen?')) return;
      dropPhotos('kat:'+x);E.kat=E.kat.filter(function(q){return q.id!==x});
      E.gesch.forEach(function(f4){f4.walls.forEach(function(w2){if(w2.bt===x) w2.bt='';(w2.ow||[]).forEach(function(q){if(q.bt===x) q.bt=''})})});
      E.surf.forEach(function(s2){if(s2.bt===x) s2.bt='';(s2.ow||[]).forEach(function(q){if(q.bt===x) q.bt=''})});
      selKat=null;touch();render();return;
    }
    case 'layer-add':{var k1=C.findKat(E,x);if(!k1) return;k1.layers.push({id:C.uid(),m:'',d:'',l:''});touch();render();return}
    case 'layer-vent':{var k2=C.findKat(E,x);if(!k2) return;if(k2.layers.some(function(l){return l.vent})){window.alert('Es gibt schon eine Hinterlüftung.');return}k2.layers.push({id:C.uid(),m:'luft',vent:true,d:'',l:'',r:''});touch();render();return}
    case 'layer-del':{var k3=C.findKat(E,x);if(!k3) return;k3.layers=k3.layers.filter(function(l){return l.id!==y});touch();render();return}
    case 'layer-up':case 'layer-down':{
      var k4=C.findKat(E,x);if(!k4) return;var ix=-1;k4.layers.forEach(function(l,i){if(l.id===y) ix=i});
      var jx=a==='layer-up'?ix-1:ix+1;if(ix<0||jx<0||jx>=k4.layers.length) return;
      var tmp=k4.layers[ix];k4.layers[ix]=k4.layers[jx];k4.layers[jx]=tmp;touch();render();return;
    }
    case 'layer-w':{
      var k5=C.findKat(E,x);if(!k5) return;var ly=k5.layers.filter(function(l){return l.id===y})[0];if(!ly) return;
      if(ly.w) delete ly.w;else ly.w={m:'holz',l:'0,13',a:'12'};touch();render();return;
    }
    case 'surf-sel':selSurf=(selSurf===x)?null:x;render();return;
    case 'surf-del':{if(!window.confirm('Fläche löschen?')) return;dropPhotos('s:'+x);E.surf=E.surf.filter(function(s3){return s3.id!==x});selSurf=null;touch();render();return}
    case 'surf-sugg':{var s4=findSurf(x);if(!s4) return;var av=C.suggestArea(E,s4.art,s4.neig);if(av>0){s4.a=String(Math.round(av*100)/100).replace('.',',');touch();render()}return}
    case 'ph-del':{var arr=E.photos[x];if(arr){arr.splice(+y,1);if(!arr.length) delete E.photos[x]}touch();render();return}
    case 'jump':{locate(y);go(x,true);if(y) setTimeout(function(){scrollToId('erf-w-'+y);scrollToId('erf-k-'+y)},40);return}
    case 'sheet-print':window.print();return;
    case 'sheet-pdf':sheetPdf(t);return;
    case 'kd-new':{if(KD) KD.neu(function(){render()});return}
    case 'kd-save':{if(!KD) return;KD.save().then(function(tx){if(step==='kunde') render();var m=document.getElementById('erf-kdmsg');if(m) m.textContent=tx||''});return}
    case 'sheet-copy':{
      var sh=document.getElementById('erf-sheet'),txt=sh?sh.innerText:'';
      var m=document.getElementById('erf-cpmsg');
      try{navigator.clipboard.writeText(txt).then(function(){if(m) m.textContent='Kopiert.'},function(){if(m) m.textContent='Kopieren nicht möglich.'})}catch(e){if(m) m.textContent='Kopieren nicht möglich.'}
      return;
    }
  }
}
function locate(ref){
  if(!ref) return;
  var r=findWall(ref);if(r){curFloor=r.fl.id;selWall=ref;return}
  for(var i=0;i<E.gesch.length;i++) if(E.gesch[i].id===ref){curFloor=ref;selWall=null;return}
  if(C.findKat(E,ref)){selKat=ref;return}
  if(findSurf(ref)){selSurf=ref;return}
}

/* ---------- Ereignisse ---------- */
function bind(){
  function onClick(ev){
    var t=ev.target.closest?ev.target.closest('[data-a]'):null;if(!t||t.tagName==='SELECT'||t.tagName==='OPTION') return;
    ev.preventDefault();actions(t.getAttribute('data-a'),t);
  }
  main.addEventListener('click',onClick);
  nav.addEventListener('click',onClick);
  main.addEventListener('input',function(ev){
    var t=ev.target;if(!t||!t.getAttribute) return;
    var sk=t.getAttribute('data-sh');
    if(sk){if(sk!=='_key'){SH.P[sk]=t.value;var pv=main.querySelector('[data-out="shprev"]');if(pv) pv.innerHTML=shapeSvg()}return}
    var iw0=t.getAttribute('data-iw');
    if(iw0){
      var r0=/^gesch\/([^\/]+)\/walls\/([^\/]+)\/turn$/.exec(iw0),g0=r0&&E.gesch.filter(function(f){return f.id===r0[1]})[0],v0=N(t.value);
      if(g0&&v0>0&&v0<360){pset(iw0,String(Math.round(turnSgn(g0)*(180-v0)*10)/10).replace('.',','));touch()}
      return;
    }
    var kk=t.getAttribute('data-k');
    if(kk){if(kk!=='_sel'&&KD){KD.set(kk,t.value);kdName=KD.get().name||kdLine();var hd=root.querySelector('#erf-kd');if(hd) hd.textContent=kdName;if(kk==='rg'){render();return}updateBadges();applyMiss()}return}
    var p=t.getAttribute('data-p');if(!p||t.tagName==='SELECT'||t.type==='checkbox') return;
    if(pset(p,t.value)){syncH(p);touch()}
  });
  main.addEventListener('change',function(ev){
    var t=ev.target;if(!t||!t.getAttribute) return;
    var wbid=t.getAttribute('data-wb');
    if(wbid){
      var wr=findWall(wbid),wk=t.getAttribute('data-wbk');
      if(wr){if(t.checked) wr.w.bt=wk;else if(wr.w.bt===wk) wr.w.bt='';touch();render()}
      return;
    }
    var shk=t.getAttribute('data-sh');
    if(shk==='_key'){SH.key=t.value;render();return}
    var iw=t.getAttribute('data-iw');
    if(iw){
      var rw=/^gesch\/([^\/]+)\/walls\/([^\/]+)\/turn$/.exec(iw),gf=rw&&E.gesch.filter(function(f){return f.id===rw[1]})[0];
      var val=N(t.value);
      if(gf&&val>0&&val<360){pset(iw,String(Math.round(turnSgn(gf)*(180-val)*10)/10).replace('.',','));touch();render()}
      else if(t.value.trim()!==''){window.alert('Innenwinkel zwischen 0 und 360 Grad eintragen.');render()}
      return;
    }
    if(t.getAttribute('data-k')==='_sel'){if(KD) KD.select(t.value,function(){render()});return}
    if(t.type==='file'&&t.getAttribute('data-ph')){addPhotos(t);return}
    var a=t.getAttribute('data-a');
    if(a==='h0-pick'){if(t.value!==''){pset('g/h0',t.value);touch();render()}return}
    if(a==='kat-new'){newKat(t.value);return}
    if(a==='surf-new'){if(t.value){var s=C.newSurface(t.value);E.surf.push(s);selSurf=s.id;touch();render()}return}
    var p=t.getAttribute('data-p');if(!p||t.tagName==='TEXTAREA') return;
    var v=(t.type==='checkbox')?(t.checked?'1':''):t.value;
    if(!pset(p,v)) return;
    syncH(p);
    if(t.getAttribute('data-mat')) matChanged(p,v);
    touch();
    if(t.getAttribute('data-r')||t.getAttribute('data-mat')) render();
  });
}
function matChanged(p,v){
  var parts=p.split('/');parts.pop();
  var l=pget(parts.join('/'));if(!l) return;
  var m=C.mat(v);if(!m) return;
  if(m.fixed!=null){l.r=String(m.fixed).replace('.',',');l.l='';delete l.w}
  else if(m.id!=='eigen'){l.l=String(m.l).replace('.',',');l.r=''}
}
function newKat(v){
  if(!v) return;
  var k;
  if(v.indexOf('p:')===0){var p=C.PRESETS[+v.slice(2)];if(!p) return;k=C.newKat(p.kind,p.n);k.layers=p.layers()}
  else{var kind=v.slice(2);k=C.newKat(kind,'');}
  E.kat.push(k);selKat=k.id;touch();render();setTimeout(function(){scrollToId('erf-k-'+k.id)},40);
}
function addPhotos(inp){
  var key=inp.getAttribute('data-ph'),files=Array.prototype.slice.call(inp.files||[]);
  var room=Math.max(0,PH_MAX-photoCount()),use=files.slice(0,room),skipped=files.length-use.length;
  if(skipped>0) window.alert('Höchstens '+PH_MAX+' Fotos je Kunde in der Gebäudeerfassung. '+skipped+' Foto(s) nicht übernommen.');
  use.reduce(function(pr,f){return pr.then(function(){return shrink(f).then(function(d){if(!E.photos[key]) E.photos[key]=[];E.photos[key].push({d:d})},function(){})})},Promise.resolve()).then(function(){
    inp.value='';touch();render();
  });
}

/* ---------- Öffentliche Schnittstelle ---------- */
function build(){
  if(root) return;
  var st=document.createElement('style');st.id='erf-style';st.textContent=CSS;document.head.appendChild(st);
  root=document.createElement('div');root.id='erf-root';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Gebäudeerfassung Bedarfsausweis');
  root.innerHTML='<div class="erf-top"><div class="erf-t">Gebäudeerfassung Bedarfsausweis<small id="erf-kd"></small><small id="erf-count"></small></div><button type="button" id="erf-close">Schließen</button></div><nav class="erf-nav" id="erf-nav" aria-label="Schritte"></nav><main class="erf-main" id="erf-main"></main>';
  document.body.appendChild(root);
  main=root.querySelector('#erf-main');nav=root.querySelector('#erf-nav');
  root.querySelector('#erf-close').addEventListener('click',close);
  document.addEventListener('keydown',function(e){if(isOpen&&e.key==='Escape') close()});
  bind();
}
function open(name,startStep){
  build();kdName=name||'';
  if(startStep&&C.STEPS.some(function(x){return x.k===startStep})) step=startStep;
  root.querySelector('#erf-kd').textContent=kdName;
  root.hidden=false;isOpen=true;document.body.style.overflow='hidden';
  if(!curFloor&&E.gesch.length) curFloor=E.gesch[0].id;
  render();
}
function close(){
  if(!root) return;
  root.hidden=true;isOpen=false;document.body.style.overflow='';
  try{onClose()}catch(e){}
}
function hasData(){
  var g=E.g,d=C.newErf().g;
  for(var k in d) if(g[k]!==d[k]&&k!=='denk'&&k!=='h0') return true;
  if(E.gesch.length||E.kat.length||E.surf.length) return true;
  for(var s in E.anl) for(var f in E.anl[s]) if(has(E.anl[s][f])) return true;
  for(var u in E.unterl) if(E.unterl[u]==='1') return true;
  if(photoCount()) return true;
  for(var a in E.abs) if(has(E.abs[a])) return true;
  return false;
}
window.ERF={
  init:function(o){o=o||{};onChange=o.onChange||function(){};onClose=o.onClose||function(){};KD=o.kunden||null},
  open:open,close:close,
  getData:function(noPhotos){if(!hasData()) return null;var c=clone(E);if(noPhotos) c.photos={};return c},
  setData:function(d){E=C.normalize(d?clone(d):C.newErf());curFloor=null;selWall=null;selKat=null;selSurf=null;if(E.gesch.length) curFloor=E.gesch[0].id;if(isOpen) render()},
  pdf:function(){return sheetPdfBlob()},
  reset:function(){E=C.newErf();curFloor=null;selWall=null;selKat=null;selSurf=null;step='kunde';if(isOpen) render()},
  openCount:function(){return hasData()?C.missing(E).length:null},
  hasData:hasData,
  isOpen:function(){return isOpen}
};
})();
