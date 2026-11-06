/* Gebäudeerfassung Bedarfsausweis: Rechen- und Datenlogik (ohne Oberfläche, im Browser und in Node nutzbar)
   Aufgabe: Daten strukturiert aufnehmen, Flächen und U-Werte zur Plausibilisierung rechnen, Lücken finden.
   Die verbindliche Berechnung des Energieausweises bleibt in Hottgenroth Energieberater. */
(function(root){
'use strict';

function N(v){
  if(typeof v==='number') return isFinite(v)?v:0;
  var x=parseFloat(String(v==null?'':v).replace(/\s/g,'').replace(',','.'));
  return isNaN(x)?0:x;
}
function has(v){return String(v==null?'':v).trim()!==''}
function rad(d){return d*Math.PI/180}
var _n=0;
function uid(){_n++;return 'x'+Date.now().toString(36).slice(-4)+_n.toString(36)+Math.random().toString(36).slice(2,5)}
function f2(x){return (Math.round(x*100)/100).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})}
function f3(x){return (Math.round(x*1000)/1000).toLocaleString('de-DE',{minimumFractionDigits:3,maximumFractionDigits:3})}
function f1(x){return (Math.round(x*10)/10).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})}

/* ---------- Bauteilarten mit Standard-Übergangswiderständen (m²K/W), je Bauteil änderbar ---------- */
var KINDS={
  wand:    {n:'Außenwand',                         rsi:0.13,rse:0.04,grp:'wand'},
  wand_u:  {n:'Wand zu unbeheiztem Raum',          rsi:0.13,rse:0.13,grp:'wand'},
  wand_e:  {n:'Wand gegen Erdreich',               rsi:0.13,rse:0.00,grp:'wand'},
  dach:    {n:'Dach (Schräge, Flachdach)',         rsi:0.10,rse:0.04,grp:'dach'},
  decke_o: {n:'Oberste Geschossdecke',             rsi:0.10,rse:0.10,grp:'dach'},
  decke_u: {n:'Kellerdecke, Decke nach unten',     rsi:0.17,rse:0.17,grp:'boden'},
  boden:   {n:'Bodenplatte gegen Erdreich',        rsi:0.17,rse:0.00,grp:'boden'},
  fenster: {n:'Fenster',                           grp:'oeff'},
  tuer:    {n:'Außentür',                          grp:'oeff'}
};

/* ---------- Materialien: Richtwerte der Wärmeleitfähigkeit, Datenblatt und Norm gehen vor ---------- */
var MATS=[
  {id:'putz_gips',n:'Gipsputz innen',l:0.51,g:'Putz, Platten'},
  {id:'putz_kalk',n:'Kalkputz',l:0.70,g:'Putz, Platten'},
  {id:'putz_kz',n:'Kalkzement-/Zementputz außen',l:0.87,g:'Putz, Platten'},
  {id:'putz_kh',n:'Kunstharzputz',l:0.70,g:'Putz, Platten'},
  {id:'gk',n:'Gipskartonplatte',l:0.25,g:'Putz, Platten'},
  {id:'osb',n:'OSB, Holzwerkstoffplatte',l:0.13,g:'Putz, Platten'},
  {id:'vz18',n:'Vollziegel, Rohdichte 1800',l:0.81,g:'Mauerwerk'},
  {id:'vz16',n:'Vollziegel, Rohdichte 1600',l:0.68,g:'Mauerwerk'},
  {id:'hlz',n:'Hochlochziegel alt (ca. Rohdichte 1200)',l:0.50,g:'Mauerwerk'},
  {id:'ks18',n:'Kalksandstein, Rohdichte 1800',l:0.99,g:'Mauerwerk'},
  {id:'ks16',n:'Kalksandstein, Rohdichte 1600',l:0.79,g:'Mauerwerk'},
  {id:'pb40',n:'Porenbeton, Rohdichte 400',l:0.12,g:'Mauerwerk'},
  {id:'pb50',n:'Porenbeton, Rohdichte 500',l:0.16,g:'Mauerwerk'},
  {id:'lb',n:'Bims, Leichtbeton (Richtwert)',l:0.35,g:'Mauerwerk'},
  {id:'nstein',n:'Bruchstein, Naturstein (dicht)',l:2.30,g:'Mauerwerk'},
  {id:'lehm',n:'Lehm (Gefach, Richtwert)',l:0.80,g:'Mauerwerk'},
  {id:'beton',n:'Beton',l:2.10,g:'Beton'},
  {id:'stb',n:'Stahlbeton',l:2.50,g:'Beton'},
  {id:'holz',n:'Holz (Nadelholz, Sparren, Balken, Ständer)',l:0.13,g:'Holz'},
  {id:'eps040',n:'EPS WLG 040',l:0.040,g:'Dämmstoff'},
  {id:'eps035',n:'EPS WLG 035',l:0.035,g:'Dämmstoff'},
  {id:'eps032',n:'EPS grau WLG 032',l:0.032,g:'Dämmstoff'},
  {id:'mw045',n:'Mineralwolle WLG 045',l:0.045,g:'Dämmstoff'},
  {id:'mw040',n:'Mineralwolle WLG 040',l:0.040,g:'Dämmstoff'},
  {id:'mw035',n:'Mineralwolle WLG 035',l:0.035,g:'Dämmstoff'},
  {id:'holzf',n:'Holzfaserdämmplatte',l:0.040,g:'Dämmstoff'},
  {id:'zell',n:'Zellulose',l:0.040,g:'Dämmstoff'},
  {id:'pur',n:'PUR/PIR WLG 025',l:0.025,g:'Dämmstoff'},
  {id:'hwl',n:'Holzwolle-Leichtbauplatte',l:0.09,g:'Dämmstoff'},
  {id:'cs',n:'Calciumsilikat',l:0.06,g:'Dämmstoff'},
  {id:'estrich',n:'Zementestrich',l:1.40,g:'Boden, Dach'},
  {id:'fliese',n:'Fliesen, Keramik',l:1.30,g:'Boden, Dach'},
  {id:'parkett',n:'Holzdielen, Parkett',l:0.13,g:'Boden, Dach'},
  {id:'bitumen',n:'Bitumen, Dachbahn',l:0.17,g:'Boden, Dach'},
  {id:'sand',n:'Sand, Kies, Splitt (Schüttung)',l:0.70,g:'Boden, Dach'},
  {id:'luft',n:'Luftschicht ruhend (Wärmedurchlasswiderstand direkt)',fixed:0.17,g:'Luft'},
  {id:'eigen',n:'Eigenes Material (Name und λ selbst eintragen)',l:0,g:'Eigenes'}
];
function mat(id){for(var i=0;i<MATS.length;i++) if(MATS[i].id===id) return MATS[i];return null}

/* ---------- U-Wert aus Schichtaufbau nach DIN EN ISO 6946 (Schichten von innen nach außen) ----------
   Homogene Schichten: R = d / λ. Inhomogene Schichten (Sparren, Ständer): Kombinationsverfahren, Mittel aus oberem und unterem Grenzwert.
   Hinterlüftung: die markierte Schicht und alles außerhalb wird nicht angesetzt, der äußere Übergangswiderstand entspricht dem inneren. */
function layerR(l,alt){
  if(l.fixed!=null&&l.fixed!=='') return N(l.fixed);
  var d=N(l.d)/100,lam=alt?N(alt.l):N(l.l);
  return (d>0&&lam>0)?d/lam:0;
}
function calcU(k){
  var kd=KINDS[k.kind]||KINDS.wand,out={ok:false,u:0,rt:0,rsi:0,rse:0,sumR:0,warn:[],layers:0};
  var rsi=has(k.rsi)?N(k.rsi):kd.rsi,rse=has(k.rse)?N(k.rse):kd.rse;
  var L=[],vent=false;
  (k.layers||[]).forEach(function(l){
    if(vent) return;
    if(l.vent){vent=true;return}
    var m=mat(l.m),fx=null;
    if(m&&m.fixed!=null) fx=has(l.r)?N(l.r):m.fixed;
    var main={d:l.d,l:l.l,fixed:fx};
    var inh=l.w&&N(l.w.a)>0&&N(l.w.a)<100&&N(l.w.l)>0&&fx==null;
    L.push({main:main,alt:inh?{l:l.w.l,a:N(l.w.a)/100}:null});
  });
  if(vent) rse=kd.rsi;
  out.rsi=rsi;out.rse=rse;out.vent=vent;
  var real=L.filter(function(x){return layerR(x.main)>0});
  out.layers=real.length;
  if(!real.length) return out;
  // oberer Grenzwert: parallele Pfade über alle Kombinationen der inhomogenen Schichten
  var secs=[{f:1,R:0}];
  real.forEach(function(x){
    var Rm=layerR(x.main);
    if(!x.alt){secs.forEach(function(s){s.R+=Rm});return}
    var Ra=layerR(x.main,x.alt),n=[];
    secs.forEach(function(s){n.push({f:s.f*(1-x.alt.a),R:s.R+Rm});n.push({f:s.f*x.alt.a,R:s.R+Ra})});
    secs=n;
  });
  var inv=0;secs.forEach(function(s){inv+=s.f/(rsi+s.R+rse)});
  var Rup=1/inv;
  // unterer Grenzwert: je Schicht gleichwertiger Widerstand, danach in Reihe
  var sum=0;
  real.forEach(function(x){
    var Rm=layerR(x.main);
    if(!x.alt){sum+=Rm;return}
    var Ra=layerR(x.main,x.alt);
    sum+=1/((1-x.alt.a)/Rm+x.alt.a/Ra);
  });
  var Rlow=rsi+sum+rse;
  var rt=(Rup+Rlow)/2;
  out.ok=true;out.rt=rt;out.sumR=sum;out.u=1/rt;out.rup=Rup;out.rlow=Rlow;
  if(Rlow>0&&Rup/Rlow>1.5) out.warn.push('Verhältnis oberer zu unterem Grenzwert über 1,5: Verfahren für diesen Aufbau nicht zulässig, Detailberechnung nötig.');
  return out;
}
/* U-Wert eines Katalogeintrags: aus Aufbau, sonst eingetragener Wert (Plan, Pauschale, Schätzung) */
function uOf(k){
  if(!k) return {u:null,ok:false,src:'',calc:null};
  if(k.kind==='fenster'||k.kind==='tuer'){var u=N(k.u);return {u:u>0?u:null,ok:u>0,src:k.src||'',calc:null}}
  if((k.src||'calc')==='calc'){var c=calcU(k);return {u:c.ok?c.u:null,ok:c.ok,src:'calc',calc:c}}
  var v=N(k.u);return {u:v>0?v:null,ok:v>0,src:k.src,calc:null};
}
var SRC={calc:'aus Schichtaufbau berechnet',plan:'aus Plan oder Nachweis',pausch:'Pauschalwert (amtliche Tabelle)',schaetz:'geschätzt'};

/* ---------- Vorlagen für typische Bestandsaufbauten (innen nach außen, vor Ort prüfen) ---------- */
function L(m,d,extra){var x=mat(m),o={id:uid(),m:m,d:String(d).replace('.',','),l:x&&x.l?String(x.l).replace('.',','):''};if(extra) for(var k in extra) o[k]=extra[k];return o}
var PRESETS=[
  {n:'Vollziegel 36,5 cm, Putz beidseitig',kind:'wand',layers:function(){return [L('putz_gips',1.5),L('vz18',36.5),L('putz_kz',2)]}},
  {n:'Vollziegel 24 cm, Putz beidseitig',kind:'wand',layers:function(){return [L('putz_gips',1.5),L('vz18',24),L('putz_kz',2)]}},
  {n:'Hochlochziegel 30 cm, Putz beidseitig',kind:'wand',layers:function(){return [L('putz_gips',1.5),L('hlz',30),L('putz_kz',2)]}},
  {n:'Kalksandstein 17,5 cm mit WDVS 12 cm EPS',kind:'wand',layers:function(){return [L('putz_gips',1.5),L('ks18',17.5),L('eps035',12),L('putz_kh',0.8)]}},
  {n:'Porenbeton 36,5 cm, Putz beidseitig',kind:'wand',layers:function(){return [L('putz_gips',1.5),L('pb40',36.5),L('putz_kz',2)]}},
  {n:'Holzrahmenwand 16 cm Gefach, OSB, GK, Vorsatz-Putz',kind:'wand',layers:function(){return [L('gk',1.25),L('osb',1.5),L('mw040',16,{w:{m:'holz',l:'0,13',a:'12'}}),L('holzf',6),L('putz_kh',0.8)]}},
  {n:'Dachschräge, Zwischensparrendämmung 16 cm, GK',kind:'dach',layers:function(){return [L('gk',1.25),L('mw040',16,{w:{m:'holz',l:'0,13',a:'14'}})]}},
  {n:'Oberste Geschossdecke Holzbalken, Dämmung 12 cm',kind:'decke_o',layers:function(){return [L('gk',1.25),L('holz',2.4),L('mw040',12,{w:{m:'holz',l:'0,13',a:'10'}})]}},
  {n:'Kellerdecke Stahlbeton 16 cm, Estrich',kind:'decke_u',layers:function(){return [L('stb',16),L('estrich',5),L('fliese',1)]}},
  {n:'Bodenplatte Beton 15 cm, Estrich',kind:'boden',layers:function(){return [L('beton',15),L('estrich',5)]}}
];

/* ---------- Anlagentechnik: Felder (Auswahltexte werden direkt gespeichert) ---------- */
var JN=['ja','nein','unbekannt'];
var DIR8=['Nord','Nordost','Ost','Südost','Süd','Südwest','West','Nordwest'];
var ANL=[
 {k:'hz',t:'Heizung, Erzeuger 1',photo:'Typenschild Erzeuger 1',f:[
  {k:'typ',l:'Erzeuger',t:'sel',req:1,o:['Standardkessel (Konstanttemperatur)','Niedertemperaturkessel','Brennwertkessel','Wärmepumpe Luft/Wasser','Wärmepumpe Sole/Wasser','Wärmepumpe Wasser/Wasser','Holzpelletkessel','Scheitholzkessel','Hackschnitzelkessel','Fernwärme-Übergabestation','Elektro-Direktheizung, Nachtspeicher','Einzelofen, Kaminofen','BHKW, Mikro-KWK','Sonstiges']},
  {k:'tr',l:'Energieträger',t:'sel',req:1,o:['Heizöl EL','Erdgas','Flüssiggas','Holzpellets','Scheitholz','Holzhackschnitzel','Strom','Fernwärme','Kohle, Koks','Sonstiges']},
  {k:'bj',l:'Baujahr Erzeuger',t:'num',req:1,ph:'z. B. 2004'},
  {k:'kw',l:'Nennleistung in kW',t:'num'},
  {k:'ort',l:'Aufstellort',t:'sel',req:1,o:['innerhalb der Hülle (beheizt)','außerhalb der Hülle (unbeheizt, z. B. Keller)']},
  {k:'tausch',l:'Brenner oder Erzeuger später getauscht (Jahr)',t:'num'}
 ]},
 {k:'hz2',t:'Heizung, Erzeuger 2 oder Zusatzheizung',f:[
  {k:'typ',l:'Erzeuger',t:'sel',o:['keiner','Standardkessel (Konstanttemperatur)','Niedertemperaturkessel','Brennwertkessel','Wärmepumpe Luft/Wasser','Wärmepumpe Sole/Wasser','Holzpelletkessel','Scheitholzkessel','Einzelofen, Kaminofen','Elektro-Direktheizung','Sonstiges']},
  {k:'tr',l:'Energieträger',t:'sel',c:'typ',o:['Heizöl EL','Erdgas','Flüssiggas','Holzpellets','Scheitholz','Strom','Fernwärme','Sonstiges']},
  {k:'bj',l:'Baujahr',t:'num',c:'typ'},
  {k:'anteil',l:'Anteil an der Beheizung in %, falls bekannt',t:'num',c:'typ'}
 ]},
 {k:'ver',t:'Verteilung',f:[
  {k:'lage',l:'Leitungsführung',t:'sel',req:1,o:['überwiegend innerhalb der thermischen Hülle','überwiegend außerhalb (unbeheizter Keller, Dachraum)','teils innerhalb, teils außerhalb']},
  {k:'daemm',l:'Dämmung der Leitungen',t:'sel',req:1,o:['gedämmt','teilweise gedämmt','ungedämmt','unbekannt']},
  {k:'pumpe',l:'Heizungspumpe',t:'sel',o:['ungeregelt','geregelt','Hocheffizienzpumpe','unbekannt']},
  {k:'temp',l:'Auslegungstemperatur Vorlauf/Rücklauf',t:'sel',o:['90/70','70/55','55/45','35/28 (Flächenheizung)','unbekannt']},
  {k:'abgl',l:'Hydraulischer Abgleich',t:'sel',o:JN}
 ]},
 {k:'ue',t:'Wärmeübergabe und Regelung',f:[
  {k:'art',l:'Übergabe',t:'sel',req:1,o:['Heizkörper','Fußbodenheizung','Wand- oder Deckenheizung','Heizkörper und Flächenheizung gemischt','Einzelöfen, Elektro-Direkt']},
  {k:'reg',l:'Raumregelung',t:'sel',o:['Thermostatventile','Thermostatventile elektronisch','Einzelraumregelung','keine, manuell']},
  {k:'wit',l:'Witterungsgeführte Vorlauftemperatur',t:'sel',o:JN},
  {k:'nische',l:'Heizkörper in Nischen an Außenwänden',t:'sel',o:['ja','nein','teilweise']}
 ]},
 {k:'ww',t:'Warmwasser',photo:'Speicher, Typenschild',f:[
  {k:'ber',l:'Bereitung',t:'sel',req:1,o:['zentral über die Heizung','zentral über Heizung mit Solarthermie','Wärmepumpen-Boiler','zentral elektrisch (Speicher)','dezentral elektrisch (Durchlauferhitzer)','dezentral Gas','Fernwärme']},
  {k:'sp',l:'Speicher',t:'sel',o:['kein Speicher','innerhalb der Hülle (beheizt)','außerhalb der Hülle (unbeheizt)']},
  {k:'vol',l:'Speichervolumen in Liter',t:'num',c:'sp',cx:'kein Speicher'},
  {k:'zirk',l:'Zirkulation',t:'sel',o:['keine','Zirkulation','Zirkulation mit Zeitschaltuhr']},
  {k:'ltg',l:'Warmwasserleitungen gedämmt',t:'sel',o:['ja','teilweise','nein','unbekannt']}
 ]},
 {k:'lue',t:'Lüftung',f:[
  {k:'art',l:'Art der Lüftung',t:'sel',req:1,o:['Fensterlüftung','Abluftanlage','Zu- und Abluftanlage mit Wärmerückgewinnung','dezentrale Lüftungsgeräte']},
  {k:'wrg',l:'Wärmerückgewinnung in %, falls bekannt',t:'num',c:'art',cx:'Fensterlüftung'},
  {k:'dicht',l:'Luftdichtheitsmessung',t:'sel',o:['nicht vorhanden','vorhanden']},
  {k:'n50',l:'n50-Wert in 1/h',t:'num',c:'dicht',cx:'nicht vorhanden'}
 ]},
 {k:'kue',t:'Kühlung',f:[
  {k:'art',l:'Kühlung',t:'sel',o:['keine','Split- oder Klimagerät','zentrale Kühlung','reversible Wärmepumpe']}
 ]},
 {k:'pv',t:'Photovoltaik',photo:'PV-Anlage',f:[
  {k:'da',l:'Photovoltaik',t:'sel',o:['keine','vorhanden']},
  {k:'kwp',l:'Leistung in kWp',t:'num',c:'da',cx:'keine'},
  {k:'ori',l:'Ausrichtung',t:'sel',c:'da',cx:'keine',o:DIR8.concat(['Flachdach aufgeständert'])},
  {k:'neig',l:'Neigung in Grad',t:'num',c:'da',cx:'keine'},
  {k:'bat',l:'Batteriespeicher in kWh',t:'num',c:'da',cx:'keine'}
 ]},
 {k:'st',t:'Solarthermie',f:[
  {k:'da',l:'Solarthermie',t:'sel',o:['keine','für Warmwasser','für Warmwasser und Heizung']},
  {k:'a',l:'Kollektorfläche (Apertur) in m²',t:'num',c:'da',cx:'keine'},
  {k:'art',l:'Kollektorart',t:'sel',c:'da',cx:'keine',o:['Flachkollektor','Vakuumröhre']},
  {k:'ori',l:'Ausrichtung',t:'sel',c:'da',cx:'keine',o:DIR8},
  {k:'neig',l:'Neigung in Grad',t:'num',c:'da',cx:'keine'}
 ]},
 {k:'ofen',t:'Kamin, Einzelfeuerstätten',f:[
  {k:'da',l:'Kamin oder Kaminofen',t:'sel',o:['keiner','vorhanden, gelegentlich genutzt','vorhanden, regelmäßig genutzt']}
 ]}
];

var UNTERL=[
  ['plaene','Baupläne, Grundrisse, Schnitte'],
  ['antrag','Bauantrag oder Baugenehmigung (Datum)'],
  ['sanier','Sanierungsnachweise, Rechnungen (Dämmung, Fenster, Heizung)'],
  ['typen','Datenblätter, Typenschilder der Heizung'],
  ['alt','früherer Energieausweis oder Wärmeschutznachweis'],
  ['schorn','Messprotokoll Schornsteinfeger (Abgasverlust)']
];

var SURF={
  boden:   {n:'Bodenplatte gegen Erdreich',kind:'boden',ori:0},
  decke_u: {n:'Kellerdecke, Decke über unbeheiztem Raum',kind:'decke_u',ori:0},
  decke_a: {n:'Decke gegen Außenluft (Erker, Überstand)',kind:'decke_u',ori:0},
  decke_o: {n:'Oberste Geschossdecke zu unbeheiztem Dachraum',kind:'decke_o',ori:0},
  dach_s:  {n:'Dachschräge, geneigtes Dach',kind:'dach',ori:1},
  dach_f:  {n:'Flachdach',kind:'dach',ori:0}
};
var WTYPE={aussen:'Außenluft',unbeh:'unbeheizter Raum',erd:'Erdreich',nachbar:'beheizter Nachbar'};

/* ---------- Datenmodell ---------- */
function newErf(){
  return {v:1,
    g:{typ:'',bj:'',antrag:'',we:'1',vg:'',keller:'',dachform:'',dg:'',anbau:'',bem:'',h0:'90',denk:'nein',wf:''},
    unterl:{},
    kat:[],gesch:[],surf:[],anl:{},photos:{},abs:{maengel:'',empf:'',offen:''}
  };
}
function normalize(e){
  var n=newErf();if(!e||typeof e!=='object') return n;
  for(var k in n) if(e[k]==null) e[k]=n[k];
  for(var k2 in n.g) if(e.g[k2]==null) e.g[k2]=n.g[k2];
  return e;
}
function newSan(){return {id:uid(),bt:'',was:'',jahr:'',std:'',beleg:''}}
function newFloor(name,art,heated,h){return {id:uid(),name:name,art:art||'voll',heated:heated===false?'nein':'ja',h:String(h||'2,50'),hm:'ok',hl:'',dd:'',walls:[]}}
function newWall(len,turn){return {id:uid(),len:len==null?'':String(len),turn:String(turn==null?90:turn),type:'aussen',bt:'',h:'',giebel:'',ow:[]}}
function newOpening(kind){return {id:uid(),kind:kind||'fenster',bt:'',b:'',h:'',n:'1',roll:'nein'}}
function newSurface(art){var s=SURF[art]||SURF.decke_o;return {id:uid(),art:art,bt:'',a:'',neig:s.ori?'35':'0',dir:'',ow:[]}}
function newKat(kind,name){
  var k={id:uid(),kind:kind,name:name||'',src:'calc',u:'',layers:[],note:''};
  if(kind==='fenster'||kind==='tuer'){k.src='plan';k.verg='';k.rahmen='';k.g='';k.fr='';k.bj=''}
  return k;
}
function findKat(e,id){for(var i=0;i<e.kat.length;i++) if(e.kat[i].id===id) return e.kat[i];return null}

/* ---------- Grundrissformen ----------
   Lokales Koordinatensystem: x nach rechts, y nach oben. Die erste Wand ist die obere Kante und läuft nach rechts,
   die Punkte folgen im Uhrzeigersinn. Die Wandrichtung im Gebäude kommt aus der Laufrichtung der ersten Wand. */
function polyWalls(pts){
  var q=[],n=pts.length,i;
  for(i=0;i<n;i++){
    var pr=pts[(i+n-1)%n],cu=pts[i],nx=pts[(i+1)%n];
    var ax=cu[0]-pr[0],ay=cu[1]-pr[1],bx=nx[0]-cu[0],by=nx[1]-cu[1];
    if(Math.sqrt(ax*ax+ay*ay)<1e-6) continue;
    if(Math.abs(ax*by-ay*bx)<1e-9&&(ax*bx+ay*by)>0) continue; // Punkt auf gerader Linie
    q.push(cu);
  }
  var m=q.length,hd=[],ln=[];
  for(i=0;i<m;i++){var nn=q[(i+1)%m],dx=nn[0]-q[i][0],dy=nn[1]-q[i][1];ln.push(Math.sqrt(dx*dx+dy*dy));hd.push(Math.atan2(dx,dy)*180/Math.PI)}
  var out=[];
  for(i=0;i<m;i++){
    var t=hd[(i+1)%m]-hd[i];while(t>180) t-=360;while(t<=-180) t+=360;
    out.push(newWall(String(Math.round(ln[i]*100)/100).replace('.',','),String(Math.round(t*10)/10).replace('.',',')));
  }
  return out;
}
var SHAPES={
  rechteck:{n:'Rechteck',params:[{k:'B',l:'Breite B in m'},{k:'T',l:'Tiefe T in m'}],demo:{B:12,T:8},
    hint:'Vier Wände mit rechten Winkeln.',
    chk:function(p){if(!(p.B>0&&p.T>0)) return 'Breite und Tiefe eintragen.'},
    pts:function(p){return [[0,0],[p.B,0],[p.B,-p.T],[0,-p.T]]}},
  l:{n:'L-Form',params:[{k:'B',l:'Gesamtbreite B in m'},{k:'T',l:'Gesamttiefe T in m'},{k:'a',l:'Breite des senkrechten Schenkels a in m'},{k:'b',l:'Tiefe des waagerechten Schenkels b in m'}],demo:{B:12,T:10,a:5,b:5},
    hint:'Der waagerechte Schenkel (Tiefe b) liegt oben über die ganze Breite B, der senkrechte Schenkel (Breite a) links bis zur Gesamttiefe T. Mit der Laufrichtung der ersten Wand drehst du die Form. Sechs Wände, eine Ecke nach innen.',
    chk:function(p){if(!(p.B>0&&p.T>0&&p.a>0&&p.b>0)) return 'Alle vier Maße eintragen.';if(!(p.a<p.B&&p.b<p.T)) return 'a muss kleiner als B und b kleiner als T sein.'},
    pts:function(p){return [[0,0],[p.B,0],[p.B,-p.b],[p.a,-p.b],[p.a,-p.T],[0,-p.T]]}},
  u:{n:'U-Form',params:[{k:'B',l:'Gesamtbreite B in m'},{k:'T',l:'Gesamttiefe T in m'},{k:'b',l:'Tiefe des Querbaus oben b in m'},{k:'a',l:'Breite linker Flügel a in m'},{k:'c',l:'Breite rechter Flügel c in m',ph:'wie a'}],demo:{B:14,T:11,b:5,a:4,c:4},
    hint:'Der Querbau (Tiefe b) liegt oben über die ganze Breite B, die beiden Flügel (Breite a und c) gehen nach unten bis zur Gesamttiefe T. Zwischen den Flügeln liegt der Innenhof, acht Wände.',
    chk:function(p){if(!(p.B>0&&p.T>0&&p.b>0&&p.a>0)) return 'B, T, b und a eintragen.';var c=p.c>0?p.c:p.a;if(!(p.a+c<p.B)) return 'a plus c muss kleiner als B sein.';if(!(p.b<p.T)) return 'b muss kleiner als T sein.'},
    pts:function(p){var c=p.c>0?p.c:p.a;return [[0,0],[p.B,0],[p.B,-p.T],[p.B-c,-p.T],[p.B-c,-p.b],[p.a,-p.b],[p.a,-p.T],[0,-p.T]]}},
  t:{n:'T-Form',params:[{k:'B',l:'Gesamtbreite B in m'},{k:'T',l:'Gesamttiefe T in m'},{k:'b',l:'Tiefe des Querbalkens oben b in m'},{k:'s',l:'Breite des Stegs s in m'},{k:'p',l:'Abstand des Stegs von links p in m',ph:'mittig'}],demo:{B:14,T:11,b:5,s:5,p:4.5},
    hint:'Der Querbalken (Tiefe b) liegt oben über die ganze Breite B, der Steg (Breite s) geht nach unten bis zur Gesamttiefe T. Ohne Abstand p sitzt der Steg mittig. Acht Wände.',
    chk:function(p){if(!(p.B>0&&p.T>0&&p.b>0&&p.s>0)) return 'B, T, b und s eintragen.';var q=(p.p>0)?p.p:(p.B-p.s)/2;if(!(p.s<=p.B&&q>=0&&q+p.s<=p.B+1e-9)) return 'Der Steg liegt nicht innerhalb der Breite B.';if(!(p.b<p.T)) return 'b muss kleiner als T sein.'},
    pts:function(p){var q=(p.p>0)?p.p:(p.B-p.s)/2;return [[0,0],[p.B,0],[p.B,-p.b],[q+p.s,-p.b],[q+p.s,-p.T],[q,-p.T],[q,-p.b],[0,-p.b]]}},
  kreuz:{n:'Kreuz',params:[{k:'B',l:'Gesamtbreite B in m'},{k:'T',l:'Gesamttiefe T in m'},{k:'w',l:'Breite des senkrechten Arms w in m'},{k:'h',l:'Tiefe des waagerechten Arms h in m'}],demo:{B:14,T:14,w:5,h:5},
    hint:'Zwei sich kreuzende Bauteile, mittig angeordnet: senkrechter Arm der Breite w über die Gesamttiefe T, waagerechter Arm der Tiefe h über die Gesamtbreite B. Zwölf Wände, vier Ecken nach innen.',
    chk:function(p){if(!(p.B>0&&p.T>0&&p.w>0&&p.h>0)) return 'Alle vier Maße eintragen.';if(!(p.w<p.B&&p.h<p.T)) return 'w muss kleiner als B und h kleiner als T sein.'},
    pts:function(p){var xa=(p.B-p.w)/2,ya=(p.T-p.h)/2;return [[xa,0],[xa+p.w,0],[xa+p.w,-ya],[p.B,-ya],[p.B,-ya-p.h],[xa+p.w,-ya-p.h],[xa+p.w,-p.T],[xa,-p.T],[xa,-ya-p.h],[0,-ya-p.h],[0,-ya],[xa,-ya]]}},
  sonder:{n:'Sonderform (Wände einzeln)',params:[{k:'n',l:'Anzahl der Wände'}],demo:null,
    hint:'Legt leere Wände an. Länge und Ecke trägst du je Wand ein. Den Winkel gibst du als Innenwinkel in Grad ein (90 = rechter Winkel, 135 = stumpf, 270 = einspringende Ecke) oder wählst eine Ecke aus der Liste.',
    chk:function(p){if(!(p.n>=3&&p.n<=30)) return 'Anzahl der Wände zwischen 3 und 30 eintragen.'},
    pts:null}
};
function shapeVals(P){var o={};for(var k in P) o[k]=N(P[k]);return o}
/* Ergebnis: {walls:[...]} oder {err:'...'} */
function shapeWalls(key,P){
  var sh=SHAPES[key];if(!sh) return {err:'Form unbekannt.'};
  var p=shapeVals(P||{}),e=sh.chk(p);if(e) return {err:e};
  if(key==='sonder'){var w=[];for(var i=0;i<Math.round(p.n);i++) w.push(newWall('',90));return {walls:w}}
  return {walls:polyWalls(sh.pts(p))};
}
function shapePoints(key,P){
  var sh=SHAPES[key];if(!sh||!sh.pts) return null;
  var p=shapeVals(P||{});
  if(sh.chk(p)) p=sh.demo;
  return sh.pts(p);
}

/* ---------- Geometrie des Wandzugs ---------- */
function norm360(a){a=a%360;return a<0?a+360:a}
function trace(floor,h0){
  var x=0,y=0,hd=N(h0),pts=[{x:0,y:0}],hds=[],turnSum=0,ws=floor.walls||[];
  ws.forEach(function(w){
    hds.push(hd);
    var len=N(w.len);
    x+=len*Math.sin(rad(hd));y+=len*Math.cos(rad(hd));
    pts.push({x:x,y:y});
    var t=N(w.turn);turnSum+=t;hd+=t;
  });
  var gap=Math.sqrt(x*x+y*y);
  // vorzeichenbehaftete Fläche; x Ost, y Nord, positiv gegen den Uhrzeigersinn
  var A=0,n=ws.length;
  for(var i=0;i<n;i++){var p=pts[i],q=(i===n-1)?pts[0]:pts[i+1];A+=p.x*q.y-q.x*p.y}
  A=A/2;
  var per=0;ws.forEach(function(w){per+=N(w.len)});
  var turnOk=n>=3&&Math.abs(Math.abs(turnSum)-360)<0.5;
  return {pts:pts,hds:hds,gap:gap,area:Math.abs(A),signed:A,perim:per,turnSum:turnSum,turnOk:turnOk,closed:n>=3&&gap<=0.02&&turnOk,n:n};
}
/* Außennormale (Himmelsrichtung in Grad) je Wand */
function wallBearing(tr,i){
  var side=tr.signed>0?90:-90;
  return norm360(tr.hds[i]+side);
}
function sector(b){return Math.round(norm360(b)/45)%8}
function dirName(b){return DIR8[sector(b)]}
/* Länge der letzten Wand, die den Zug schließt, wenn der Rest in Richtung der letzten Wand liegt */
function closeFix(floor,h0){
  var ws=floor.walls;if(!ws.length) return null;
  var tr=trace(floor,h0),n=ws.length;
  var last=ws[n-1],lastEnd=tr.pts[n],lastStart=tr.pts[n-1],hd=tr.hds[n-1];
  var dx=-lastEnd.x,dy=-lastEnd.y; // Vektor vom Endpunkt zum Start
  var ux=Math.sin(rad(hd)),uy=Math.cos(rad(hd));
  var along=dx*ux+dy*uy,cross=dx*uy-dy*ux;
  var newLen=N(last.len)+along;
  return {len:newLen,cross:Math.abs(cross),ok:Math.abs(cross)<0.02&&newLen>0.05};
}

/* ---------- Flächen je Wand, Öffnungen ---------- */
function oArea(o){return Math.max(0,N(o.b))*Math.max(0,N(o.h))*Math.max(1,Math.round(N(o.n)||1))}
function wallGeom(floor,w,e){
  var H=has(w.h)?N(w.h):N(floor.h);
  var gross=N(w.len)*H+N(w.giebel);
  var op=0;(w.ow||[]).forEach(function(o){op+=oArea(o)});
  return {H:H,gross:gross,open:op,net:Math.max(0,gross-op)};
}

/* ---------- Auswertung der Hülle ---------- */
function summary(e){
  var S={floors:[],walls:[],byBt:{},win:{},doors:{},sumN:0,Ae:0,V:0,Awin:0,Awall:0,Abr:0,surf:[],unheated:0};
  function add(map,key,v){map[key]=(map[key]||0)+v}
  (e.gesch||[]).forEach(function(fl){
    var tr=trace(fl,e.g.h0),heated=fl.heated!=='nein';
    var fs={id:fl.id,name:fl.name,heated:heated,tr:tr,h:N(fl.h),area:tr.area,vol:heated?tr.area*N(fl.h):0,walls:[]};
    if(heated) S.V+=fs.vol;
    fl.walls.forEach(function(w,i){
      var g=wallGeom(fl,w,e),b=tr.n?wallBearing(tr,i):0,sec=sector(b);
      var ws={id:w.id,floor:fl.id,i:i,type:w.type,bt:w.bt,ori:sec,bearing:b,g:g,heated:heated};
      fs.walls.push(ws);S.walls.push(ws);
      if(!heated||w.type==='nachbar') return;
      var key=w.bt+'|'+w.type+'|'+sec;
      add(S.byBt,key,g.net);
      S.Awall+=g.net;
      (w.ow||[]).forEach(function(o){
        var a=oArea(o),m=(o.kind==='tuer')?S.doors:S.win;add(m,o.bt+'|'+sec,a);S.Awin+=a;
      });
    });
    S.floors.push(fs);
  });
  (e.surf||[]).forEach(function(s){
    var a=has(s.a)?N(s.a):0,ow=0;(s.ow||[]).forEach(function(o){ow+=oArea(o)});
    S.surf.push({id:s.id,art:s.art,a:a,open:ow,net:Math.max(0,a-ow)});
    S.Abr+=Math.max(0,a-ow);S.Awin+=ow;
    (s.ow||[]).forEach(function(o){var m=(o.kind==='tuer')?S.doors:S.win;add(m,o.bt+'|'+s.id,oArea(o))});
  });
  S.Ae=S.Awall+S.Awin+S.Abr;
  S.AV=S.V>0?S.Ae/S.V:0;
  S.fensterAnteil=(S.Awall+S.Awin)>0?S.Awin/(S.Awall+S.Awin):0;
  return S;
}
/* Vorschlag für die Fläche eines Gebäudeabschlusses aus dem Grundriss */
function suggestArea(e,art,neig){
  var heated=(e.gesch||[]).filter(function(f){return f.heated!=='nein'});
  if(!heated.length) return 0;
  var tr;
  if(art==='boden'||art==='decke_u'||art==='decke_a') tr=trace(heated[0],e.g.h0);
  else tr=trace(heated[heated.length-1],e.g.h0);
  var a=tr.area;
  if(art==='dach_s'){var c=Math.cos(rad(N(neig)));if(c>0.1) a=a/c}
  return a;
}

/* ---------- Prüfungen ---------- */
var STEPS=[
  {k:'kunde',n:'Kundenerfassung'},
  {k:'stamm',n:'Gebäude'},
  {k:'geo',n:'Grundriss und Wände'},
  {k:'bt',n:'Bauteile'},
  {k:'fl',n:'Dach, Decke, Boden'},
  {k:'anl',n:'Anlagentechnik'},
  {k:'abs',n:'Abschluss'},
  {k:'blatt',n:'Datenblatt'}
];
function year(v){var m=/(\d{4})/.exec(String(v||''));return m?+m[1]:0}
function bauantragVor1977(g){
  var s=String(g.antrag||'').trim();if(!s) return null;
  var m=/(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s);
  if(m) return (+m[3])*10000+(+m[2])*100+(+m[1])<19771101;
  var y=year(s);return y?(y===1977?null:y<1977):null;
}
var SAN_GES='Gesamte Gebäudehülle (alle Bauteile)';
var SAN_HUELLE=['Außenwand','Dach oder oberste Geschossdecke','Kellerdecke oder Bodenplatte','Fenster und Außentüren'];
var SAN_STD=['ja','nein / unbekannt'];
var SAN_BT=[SAN_GES,'Außenwand','Dach oder oberste Geschossdecke','Kellerdecke oder Bodenplatte','Fenster und Außentüren','Heizung, Wärmeerzeuger','Lüftung','Sonstiges'];
var SAN_BELEG=['Befund vor Ort (gemessen, gesehen)','Unterlage (Rechnung, Datenblatt, Nachweis)','Angabe des Eigentümers','kein Beleg'];
/* Welche Hüllbauteile gelten als nach 1977 auf damals gültigem Standard saniert? Zählt nur: Jahr ab 1978, "nach Vorschrift" = ja, Beleg Befund oder Unterlage. */
function sanHuelle(san){
  var ok={},schwach=[],ges=null;
  (san||[]).forEach(function(x){
    var y=year(x.jahr),good=y&&y>=1978&&x.std==='ja'&&(x.beleg===SAN_BELEG[0]||x.beleg===SAN_BELEG[1]);
    var huelle=x.bt===SAN_GES||SAN_HUELLE.indexOf(x.bt)>=0;
    if(!huelle) return;
    if(good){if(x.bt===SAN_GES){SAN_HUELLE.forEach(function(b){ok[b]=y});ges=y}else if(!ok[x.bt]||y>ok[x.bt]) ok[x.bt]=y}
    else schwach.push(x);
  });
  var fehlt=SAN_HUELLE.filter(function(b){return !ok[b]});
  return {ok:ok,fehlt:fehlt,voll:fehlt.length===0,ges:ges,schwach:schwach};
}
/* Ausweisart für Wohngebäude im Bestand. Orientierung nach § 80 GEG, nicht verbindlich; bitte am aktuellen Gesetzestext prüfen. */
function ausweisart(e){
  var g=e.g,aw=e.aw||{},san=e.san||[],we=N(g.we),by=year(g.bj),L=[],o={art:'offen',head:'',lines:L,quelle:''};
  var jetzt=new Date().getFullYear();
  if(aw.neu==='ja'){o.art='bedarf';o.head='Bedarfsausweis ist Pflicht';L.push('Neubau, oder Änderung am Bestand mit Berechnung für das gesamte Gebäude (§ 80 Abs. 1 und 2 GEG): Hier ist ein Bedarfsausweis vorgeschrieben.');return o}
  if(!(we>0)){o.head='Anzahl der Wohnungen fehlt';L.push('Ohne die Anzahl der Wohnungen lässt sich die Ausweisart nicht bestimmen. Gezählt wird jede Wohnung im Gebäude.');return o}
  var vor=bauantragVor1977(g),q='';
  if(vor!=null) q='nach dem eingetragenen Bauantrag';
  else if(by){if(by<=1975){vor=true;q='abgeleitet aus dem Baujahr '+by}else if(by>=1980){vor=false;q='abgeleitet aus dem Baujahr '+by}}
  o.quelle=q;
  var art;
  if(we>=5){art='wahl';L.push('Fünf oder mehr Wohnungen: Verbrauchs- oder Bedarfsausweis darf frei gewählt werden, unabhängig vom Baujahr.')}
  else if(vor===null){o.head=by?'Bauantragsdatum fehlt':'Baujahr oder Bauantragsdatum fehlt';L.push('Das Baujahr liegt um 1977 oder fehlt. Ob der Bauantrag vor dem 01.11.1977 gestellt wurde, bestimmt die Ausweisart. Das Datum steht in den Bauunterlagen oder der Baugenehmigung.');return o}
  else if(vor){
    var sh=sanHuelle(san);
    if(aw.nw==='ja'){art='wahl';L.push('Bauantrag vor dem 01.11.1977 ('+q+'), weniger als fünf Wohnungen (§ 80 Abs. 3 Satz 2 GEG). Ein Nachweis, dass das Gebäude das Niveau der Wärmeschutzverordnung 1977 bei Fertigstellung erfüllte oder später erreichte, wurde angegeben (Satz 3). Dann ist die Wahl möglich.')}
    else if(sh.voll){art='wahl';o.abgeleitet=true;
      var teile=sh.ges?'Gesamtsanierung der Hülle '+sh.ges:SAN_HUELLE.map(function(b){return b+' '+sh.ok[b]}).join(', ');
      L.push('Bauantrag vor dem 01.11.1977 ('+q+'), weniger als fünf Wohnungen (§ 80 Abs. 3 Satz 2 GEG). Aus der Sanierungsliste abgeleitet: Die gesamte Hülle wurde nach 1977 nach der damals gültigen Vorschrift saniert und ist belegt ('+teile+'). Das spricht dafür, dass das Niveau der Wärmeschutzverordnung 1977 erreicht ist (Satz 3). Ob das im Einzelfall stimmt und ausreichend nachweisbar ist, beurteilst du; hier wird nichts berechnet.')}
    else{art='bedarf';o.head='Bedarfsausweis ist Pflicht';L.push('Bauantrag vor dem 01.11.1977 ('+q+'), weniger als fünf Wohnungen und kein Nachweis, dass das Gebäude das Niveau der Wärmeschutzverordnung 1977 erfüllt (§ 80 Abs. 3 Satz 2 und 3 GEG).');
      if(san.length){
        var got=SAN_HUELLE.filter(function(b){return sh.ok[b]});
        if(got.length) L.push('Teilsanierung: belegt nach 1977 nach damaliger Vorschrift sind nur '+got.join(', ')+'. Es fehlen: '+sh.fehlt.join(', ')+'. Das Niveau gilt für das ganze Gebäude, nicht für einzelne Bauteile. Waren die fehlenden Bauteile schon ursprünglich ausreichend oder rechnest du das Gebäude insgesamt nach, setze oben „Nachweis liegt vor“.');
        else L.push('In der Sanierungsliste ist keine Hüllsanierung erfasst, die zählt. Angerechnet wird nur: Jahr ab 1978, „nach damals gültiger Vorschrift“ = ja, Beleg als Befund oder Unterlage. Eine Gesamtsanierung der Hülle oder alle vier Bauteile (Außenwand, Dach, Kellerdecke, Fenster) zusammen genügen.');
        if(sh.schwach.length) L.push(sh.schwach.length+' Sanierung(en) der Hülle zählen nicht mit: Jahr unbekannt oder vor 1978, nicht nach Vorschrift, oder nur Angabe des Eigentümers.');
      }}
  }else{art='wahl';L.push('Bauantrag ab dem 01.11.1977 ('+q+'): Verbrauchs- oder Bedarfsausweis darf gewählt werden.')}
  if(art==='wahl'&&!o.abgeleitet&&san.length) L.push('Sanierungen ändern an der Wahlfreiheit nichts. Sie sind nur für die Aussagekraft der Verbrauchswerte wichtig.');
  if(art==='wahl'){
    if(aw.leer==='lang'){art='bedarf_vd';o.head='Praktisch nur Bedarfsausweis (Leerstand)';L.push('Das Gebäude stand in den letzten Jahren überwiegend leer. Die Verbrauchswerte zeigen dann nicht den Zustand des Gebäudes, aussagekräftige Verbrauchsdaten für 36 Monate fehlen in der Regel. Fachlich bleibt nur der Bedarfsausweis.')}
    else if(aw.vd==='nein'){art='bedarf_vd';o.head='Nur Bedarfsausweis möglich';L.push('Es liegen keine Verbrauchsdaten für mindestens 36 Monate vor. Ohne diese Daten bleibt nur der Bedarfsausweis.')}
    else{
      if(aw.leer==='teil') L.push('Leerstand in der Verbrauchsperiode verfälscht die Werte. Wie er bei der Verbrauchsermittlung zu berücksichtigen ist, regeln die Vorgaben zum Verbrauchsausweis (hier nicht geprüft).');
      o.head='Verbrauchs- oder Bedarfsausweis möglich';
      if(aw.vd==='ja') L.push('Verbrauchsdaten für mindestens 36 Monate liegen vor.');
      else L.push('Offen: Liegen Verbrauchsdaten für mindestens 36 Monate vor? Ohne sie bleibt nur der Bedarfsausweis.');
      var jung=san.some(function(x){var y=year(x.jahr);return y&&y>=jetzt-3});
      if(jung) L.push('Sanierung in den letzten drei Jahren: Die Verbrauchswerte sind dann womöglich nicht repräsentativ. Ein Bedarfsausweis ist dann aussagekräftiger.');
    }
  }
  L.push('Ein Energieausweis ist nur bei Verkauf, Vermietung, Verpachtung, Leasing oder Erbbaurecht vorgeschrieben, wenn kein gültiger vorliegt (§ 80 Abs. 3 Satz 1 GEG).');
  o.art=art;
  if(art!=='wahl'&&!o.head) o.head='Bedarfsausweis';
  if(art!=='wahl'&&san.length) L.push('Beim Bedarfsausweis zählt der Aufbau der Bauteile, den du vor Ort feststellst, nicht das Sanierungsjahr. Angaben des Eigentümers sind nur Hinweise.');
  return o;
}
function missing(e){
  var M=[],g=e.g;
  function m(step,t,ref,paths){M.push({step:step,t:t,ref:ref||null,paths:paths||[]})}
  if(!has(g.typ)) m('stamm','Gebäudetyp wählen',null,['g/typ']);
  if(!year(g.bj)) m('stamm','Baujahr des Gebäudes (vierstellig) eintragen',null,['g/bj']);
  if(!has(g.we)||N(g.we)<1) m('stamm','Anzahl Wohneinheiten eintragen',null,['g/we']);
  if(!has(g.keller)) m('stamm','Keller angeben',null,['g/keller']);
  if(!has(g.dg)) m('stamm','Dachgeschoss angeben',null,['g/dg']);
  var by0=year(g.bj);
  if(!has(g.antrag)&&by0>=1976&&by0<=1979&&!(N(g.we)>=5)) m('stamm','Datum des Bauantrags eintragen (Baujahr liegt um 1977, davon hängt die Ausweisart ab)',null,['g/antrag']);
  var heated=(e.gesch||[]).filter(function(f){return f.heated!=='nein'});
  if(!e.gesch.length) m('geo','Mindestens ein Geschoss anlegen');
  else if(!heated.length) m('geo','Mindestens ein Geschoss als beheizt markieren');
  e.gesch.forEach(function(f){
    var tr=trace(f,g.h0);
    if(!f.walls.length){m('geo',f.name+': Wandzug fehlt',f.id);return}
    if(!tr.closed) m('geo',f.name+': Wandzug nicht geschlossen'+(tr.gap>0.02?' (Lücke '+f2(tr.gap)+' m)':' (Eckwinkel ergeben keine geschlossene Figur)'),f.id);
    if(!(N(f.h)>0)&&f.hm!=='licht') m('geo',f.name+': Geschosshöhe fehlt',f.id,['gesch/'+f.id+'/h']);
    if(f.hm==='licht'){if(!(N(f.hl)>0)) m('geo',f.name+': lichte Raumhöhe fehlt',f.id,['gesch/'+f.id+'/hl']);if(!(N(f.dd)>0)) m('geo',f.name+': Deckenstärke fehlt',f.id,['gesch/'+f.id+'/dd'])}
    if(f.heated==='nein') return;
    f.walls.forEach(function(w,i){
      var tag=f.name+', Wand '+(i+1)+': ';
      var wp='gesch/'+f.id+'/walls/'+w.id+'/';
      if(!(N(w.len)>0)) m('geo',tag+'Länge fehlt',w.id,[wp+'len']);
      if(w.type!=='nachbar'&&!w.bt) m('geo',tag+'Bauteil zuordnen',w.id,[wp+'bt']);
      (w.ow||[]).forEach(function(o,j){
        var t2=tag+(o.kind==='tuer'?'Tür ':'Fenster ')+(j+1)+': ';
        var op=wp+'ow/'+o.id+'/';
        if(!o.bt) m('geo',t2+'Bauteil zuordnen',w.id,[op+'bt']);
        if(!(N(o.b)>0&&N(o.h)>0)) m('geo',t2+'Breite und Höhe fehlen',w.id,[op+'b',op+'h']);
      });
    });
  });
  if(!e.kat.length) m('bt','Bauteile anlegen (Aufbau und U-Wert), danach den Wänden zuordnen');
  var hasTop=e.surf.some(function(s){return s.art==='decke_o'||s.art==='dach_s'||s.art==='dach_f'});
  var hasBot=e.surf.some(function(s){return s.art==='boden'||s.art==='decke_u'});
  if(heated.length&&!hasTop) m('fl','Oberen Gebäudeabschluss anlegen (Dach oder oberste Geschossdecke)');
  if(heated.length&&!hasBot) m('fl','Unteren Gebäudeabschluss anlegen (Bodenplatte oder Kellerdecke)');
  e.surf.forEach(function(s){
    var nm=SURF[s.art]?SURF[s.art].n:'Fläche';
    if(!s.bt) m('fl',nm+': Bauteil zuordnen',s.id,['surf/'+s.id+'/bt']);
    if(!(N(s.a)>0)) m('fl',nm+': Fläche fehlt',s.id,['surf/'+s.id+'/a']);
    (s.ow||[]).forEach(function(o,j){
      var sp='surf/'+s.id+'/ow/'+o.id+'/';
      if(!o.bt) m('fl',nm+', Fenster '+(j+1)+': Bauteil zuordnen',s.id,[sp+'bt']);
      if(!(N(o.b)>0&&N(o.h)>0)) m('fl',nm+', Fenster '+(j+1)+': Maße fehlen',s.id,[sp+'b',sp+'h']);
    });
  });
  // Bauteile, die verwendet werden, aber keinen U-Wert haben
  var used={};
  e.gesch.forEach(function(f){f.walls.forEach(function(w){if(w.bt) used[w.bt]=1;(w.ow||[]).forEach(function(o){if(o.bt) used[o.bt]=1})})});
  e.surf.forEach(function(s){if(s.bt) used[s.bt]=1;(s.ow||[]).forEach(function(o){if(o.bt) used[o.bt]=1})});
  e.kat.forEach(function(k){
    if(!used[k.id]) return;
    if(!has(k.name)) m('bt','Bauteil ohne Namen (verwendet)',k.id,['kat/'+k.id+'/name']);
    if(!uOf(k).ok) m('bt',(k.name||'Bauteil')+': U-Wert fehlt',k.id,['kat/'+k.id+'/u']);
    if((k.kind==='fenster')&&!has(k.g)) m('bt',(k.name||'Fenster')+': g-Wert fehlt',k.id,['kat/'+k.id+'/g']);
  });
  ANL.forEach(function(sec){
    sec.f.forEach(function(f){
      if(!f.req) return;
      var v=(e.anl[sec.k]||{})[f.k];
      if(!has(v)) m('anl',sec.t+': '+f.l+' angeben',null,['anl/'+sec.k+'/'+f.k]);
    });
  });
  return M;
}
function warnings(e){
  var W=[],g=e.g,by=year(g.bj);
  function w(step,t,ref){W.push({step:step,t:t,ref:ref||null})}
  var S=summary(e);
  e.gesch.forEach(function(f){
    if(N(f.h)>0&&(N(f.h)<2.0||N(f.h)>4.5)) w('geo',f.name+': Geschosshöhe '+f2(N(f.h))+' m ungewöhnlich',f.id);
    f.walls.forEach(function(wl,i){
      var gm=wallGeom(f,wl,e),tag=f.name+', Wand '+(i+1)+': ';
      if(gm.gross>0&&gm.open>gm.gross) w('geo',tag+'Öffnungen ('+f2(gm.open)+' m²) größer als die Wandfläche ('+f2(gm.gross)+' m²)',wl.id);
      else if(gm.gross>0&&gm.open/gm.gross>0.6) w('geo',tag+'Öffnungsanteil über 60 %, bitte Maße prüfen',wl.id);
      (wl.ow||[]).forEach(function(o,j){
        if(N(o.h)>0&&N(o.h)>gm.H) w('geo',tag+'Öffnung '+(j+1)+' ist höher als die Wand',wl.id);
        if(N(o.b)>0&&N(o.b)>N(wl.len)&&N(wl.len)>0&&(N(o.n)||1)<=1) w('geo',tag+'Öffnung '+(j+1)+' ist breiter als die Wand',wl.id);
      });
    });
  });
  if(S.fensterAnteil>0.4) w('geo','Fensterflächenanteil '+Math.round(S.fensterAnteil*100)+' % an Wand und Fenster: ungewöhnlich hoch');
  var seen={};
  function chkKat(id,where){
    if(!id||seen[id]) return;seen[id]=1;
    var k=findKat(e,id);if(!k) return;
    var u=uOf(k);if(!u.ok) return;
    if(k.src==='schaetz') w('bt',(k.name||'Bauteil')+': U-Wert nur geschätzt, vor der Abgabe belegen',k.id);
    if(by>0&&by<1978&&k.src==='calc'){
      if(k.kind==='wand'&&u.u<0.40) w('bt',(k.name||'Wand')+': U '+f2(u.u)+' bei Baujahr '+by+'. Nachträgliche Dämmung belegt?',k.id);
      if((k.kind==='dach'||k.kind==='decke_o')&&u.u<0.30) w('bt',(k.name||'Dach')+': U '+f2(u.u)+' bei Baujahr '+by+'. Nachträgliche Dämmung belegt?',k.id);
    }
    if(by>=2002&&k.kind==='wand'&&u.u>0.60) w('bt',(k.name||'Wand')+': U '+f2(u.u)+' bei Baujahr '+by+' ungewöhnlich hoch',k.id);
    if(k.kind==='fenster'&&by>0&&by<1995&&u.u<1.3&&k.src!=='plan') w('bt',(k.name||'Fenster')+': Uw '+f2(u.u)+' bei Baujahr '+by+'. Fenster später erneuert?',k.id);
    if(k.kind==='fenster'&&N(k.g)>0&&(N(k.g)<0.2||N(k.g)>0.9)) w('bt',(k.name||'Fenster')+': g-Wert '+f2(N(k.g))+' ungewöhnlich',k.id);
    if(u.calc&&u.calc.warn) u.calc.warn.forEach(function(t){w('bt',(k.name||'Bauteil')+': '+t,k.id)});
  }
  e.gesch.forEach(function(f){f.walls.forEach(function(wl){chkKat(wl.bt);(wl.ow||[]).forEach(function(o){chkKat(o.bt)})})});
  e.surf.forEach(function(s){chkKat(s.bt);(s.ow||[]).forEach(function(o){chkKat(o.bt)})});
  // Art des Bauteils passt zur Zuordnung
  e.gesch.forEach(function(f){f.walls.forEach(function(wl,i){
    var k=findKat(e,wl.bt);if(!k) return;
    var want={aussen:'wand',unbeh:'wand_u',erd:'wand_e'}[wl.type];
    if(want&&k.kind!==want) w('geo',f.name+', Wand '+(i+1)+': Zuordnung "'+WTYPE[wl.type]+'", Bauteil ist "'+KINDS[k.kind].n+'"',wl.id);
  })});
  // Anlage
  var hz=(e.anl.hz||{});
  if(has(hz.bj)&&(N(hz.bj)<1950||N(hz.bj)>year(new Date().toISOString())+1)) w('anl','Baujahr des Erzeugers '+hz.bj+' unplausibel');
  var ue=(e.anl.ue||{}),ver=(e.anl.ver||{});
  if(ue.art==='Fußbodenheizung'&&ver.temp&&(ver.temp==='90/70'||ver.temp==='70/55')) w('anl','Fußbodenheizung mit Auslegung '+ver.temp+' ist ungewöhnlich');
  return W;
}
function openCount(e){return missing(e).length}

var api={ausweisart:ausweisart,sanHuelle:sanHuelle,newSan:newSan,SAN_BT:SAN_BT,SAN_STD:SAN_STD,SAN_GES:SAN_GES,SAN_HUELLE:SAN_HUELLE,SAN_BELEG:SAN_BELEG,SHAPES:SHAPES,shapeWalls:shapeWalls,shapePoints:shapePoints,polyWalls:polyWalls,N:N,has:has,uid:uid,f1:f1,f2:f2,f3:f3,KINDS:KINDS,MATS:MATS,mat:mat,calcU:calcU,uOf:uOf,SRC:SRC,PRESETS:PRESETS,ANL:ANL,UNTERL:UNTERL,SURF:SURF,WTYPE:WTYPE,DIR8:DIR8,STEPS:STEPS,
  newErf:newErf,normalize:normalize,newFloor:newFloor,newWall:newWall,newOpening:newOpening,newSurface:newSurface,newKat:newKat,findKat:findKat,
  trace:trace,wallBearing:wallBearing,sector:sector,dirName:dirName,closeFix:closeFix,oArea:oArea,wallGeom:wallGeom,summary:summary,suggestArea:suggestArea,
  missing:missing,warnings:warnings,openCount:openCount,bauantragVor1977:bauantragVor1977,year:year};
if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.ERFCALC=api;
})(typeof window!=='undefined'?window:this);
