'use strict';
const demoPins={'DEMO-001':[10.201,-61.447],'DEMO-002':[10.166,-61.453],'DEMO-003':[10.198,-61.449]};
const position=c=>c.pin||demoPins[c.id];
const fieldStaff=c=>officer()||(['Litter Prevention Warden','FSO','Checker'].includes(role())&&c.owner===role());
function normalizeRoad(s){return String(s||'').toLowerCase().replace(/\brd\b/g,'road').replace(/\btr\b/g,'trace').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()}
function similarity(a,b){
 if(a===b)return 1;
 const grams=s=>new Set(Array.from(' '+s,(_,i)=>(' '+s+' ').slice(i,i+2)));
 const x=grams(a),y=grams(b);return 2*[...x].filter(k=>y.has(k)).length/(x.size+y.size);
}
function contains(ring,[x,y]){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [a,b]=ring[i],[c,d]=ring[j];
  if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;
 }return inside;
}
const roadIndex=roads.features.filter(f=>f.properties.name).map(f=>{
 const line=f.geometry.coordinates[0],mid=line[Math.floor(line.length/2)];
 const district=districts.features.find(d=>d.geometry.coordinates.some(poly=>contains(poly[0],mid)&&!poly.slice(1).some(r=>contains(r,mid))))?.properties['Electoral District']||'';
 return {name:f.properties.name,key:normalizeRoad(f.properties.name),district,point:[mid[1],mid[0]]};
});
let activeMap;
function showMap(initial){
 const list=cases.filter(visible);let selected=list.find(c=>c.id===initial),placing=false,draft=null;
 if(activeMap)activeMap.remove();
 put('<button id="registerBack">Back to register</button><h1>Complaint map</h1><p>A blue ≈ marks an estimated location. An orange dot marks an unchecked site, and a green tick marks a completed field check.</p><div class="maplayout"><div><div class="basemap"><label for="baseChoice">Map view</label><select id="baseChoice"><option>OpenStreetMap</option><option>Satellite</option></select></div><div id="complaintMap" class="mapcanvas" aria-label="Complaint locations"></div><small>Districts and roads from the <a href="https://riteshbabooram.github.io/PDRC-Electoral-District-Locator-Web-App-2025/" target="_blank" rel="noopener">PDRC locator · Ritesh Babooram</a>. Sample case pins are illustrative.</small><section id="selection" class="panel" aria-live="polite"></section></div><section class="panel maplist"><h2>Complaints</h2><label class="field">Filter sites<select id="mapFilter">'+options(['All complaints','Unchecked','Checked','Needs a pin'])+'</select></label><div id="caseList"></div></section></div>');
 const map=L.map('complaintMap',{preferCanvas:true});activeMap=map;
 const boundary=L.geoJSON(districts,{style:{color:'#25735b',weight:2,fillOpacity:.04},interactive:false}).addTo(map);
 map.fitBounds(boundary.getBounds());const streets=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'});
 const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:18,maxZoom:19,attribution:'Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community'});
 let base=streets.addTo(map); $('#baseChoice').onchange=()=>{map.removeLayer(base);base=$('#baseChoice').value==='Satellite'?satellite:streets;base.addTo(map)};
 L.geoJSON(roads,{style:{color:'#648079',weight:1,opacity:.6},onEachFeature:(f,l)=>{if(f.properties.name)l.bindTooltip(safe(f.properties.name),{sticky:true})}}).addTo(map);
 const pins=L.layerGroup().addTo(map);let draftLayer;
 function clearDraft(){placing=false;draft=null;if(draftLayer){draftLayer.remove();draftLayer=null}}
 function leave(fn){clearDraft();map.remove();activeMap=null;document.querySelector("#role").onchange=home;fn()}
 $('#registerBack').onclick=()=>leave(home);
 $('#role').onchange=()=>{leave(home);$('#role').onchange=home};
 function choose(c){clearDraft();selected=c;if(position(c))map.setView(position(c),15);render()}
 function fits(c){switch($('#mapFilter').value){case 'Needs a pin':return !position(c);case 'Checked':return !!c.checked;case 'Unchecked':return !c.checked;default:return true}}
 function render(){
  pins.clearLayers();const shown=list.filter(fits);
  $('#caseList').innerHTML=shown.map(c=>'<button class="mapcase" aria-pressed="'+(selected===c)+'" data-case="'+safe(c.id)+'">'+safe(c.categories.join(', '))+'<small>'+safe(c.id)+' · '+safe(c.area)+' · '+(c.checked?'✓ Checked':position(c)?'Unchecked':'Needs a pin')+'</small></button>').join('')||'<p>No matching complaints.</p>';
  for(const c of shown){if(!position(c))continue;
   const label=c.id+' · '+c.categories.join(', ');
   L.marker(position(c),{title:label,alt:label,icon:L.divIcon({className:'',html:'<span class="pinGlyph '+(c.checked?'checked ':c.estimate?'estimated ':'')+(selected===c?'current':'')+'">'+(c.checked?'✓':c.estimate?'≈':'•')+'</span>',iconAnchor:[14,14],iconSize:[29,29]})}).bindTooltip(safe(label)).on('click',()=>choose(c)).addTo(pins);
  }
  const c=selected;if(!c){$('#selection').innerHTML='<p>Select a pin or a complaint to see its field-check status.</p>';return}
  const editable=c.status!=='Closed'&&(intake()||fieldStaff(c));
  $('#selection').innerHTML='<small>'+safe(c.id)+'</small><h2>'+safe(c.categories.join(', '))+'</h2><p>'+safe([c.location,c.area].filter(Boolean).join(', '))+'</p>'+(c.estimate?'<p class="estimateNote">'+safe(c.estimate)+' · Confirm or adjust this pin at the site.</p>':'')+'<p><b>'+(c.checked?'✓ Field check completed':position(c)?'Awaiting field check':'Needs a pin')+'</b></p><div class="mapnav"><button id="openCase">Open case</button>'+(editable?'<button id="place">'+(position(c)?'Adjust pin':'Place pin')+'</button>':'')+(position(c)&&fieldStaff(c)&&!c.checked&&c.status!=='Closed'?'<button class="primary" id="tick">Tick off field check</button>':'')+'</div><div id="pinEditor"></div>';
  $('#openCase').onclick=()=>leave(()=>detail(c.id));
  function commit(change,note){const updated={...c,...change,events:[...c.events,event(note)]};if(!save(cases.map(x=>x.id===c.id?updated:x)))return;list[list.indexOf(c)]=updated;selected=fits(updated)?updated:null;clearDraft();render()}
  if($('#tick'))$('#tick').onclick=()=>{if(confirm('Record a completed field check for '+c.id+'? The case keeps its current status.'))commit({checked:true},'Field check completed on map')};
  if($('#place'))$('#place').onclick=()=>{clearDraft();placing=true;$('#pinEditor').innerHTML='<h3>Locate the incident</h3><p>Search by road name or click the map. Adjust the point before saving.</p><label class="field">Road name<input id="roadQuery"></label><div id="roadChoices"></div><p id="coords" role="status"></p><button id="savePin" class="primary" disabled>Save pin</button> <button id="cancelPin">Cancel</button>';
   const search=()=>{const q=normalizeRoad($('#roadQuery').value);const district=normalizeRoad(c.district);
    const ranked=q.length<2?[]:roadIndex.map(r=>({r,score:similarity(r.key,q)+(r.key.includes(q)?.25:0)+(district&&normalizeRoad(r.district)===district?.1:0)})).filter(x=>x.score>.3).sort((a,b)=>b.score-a.score).slice(0,5);
    $('#roadChoices').innerHTML=ranked.map(({r},i)=>'<button data-road="'+i+'">'+safe(r.name)+' · '+safe(r.district||'District unconfirmed')+'</button>').join('');
    $('#roadChoices').onclick=e=>{const i=e.target.dataset.road;if(i!==undefined){const p=ranked[i].r.point;map.setView(p,16);pick(p)}};
   };$('#roadQuery').value=c.location||'';$('#roadQuery').oninput=search;search();
   $('#savePin').onclick=()=>{if(draft)commit({pin:draft,estimate:null,checked:false},'Incident pin confirmed on map'+(c.checked?' · field check reset for updated location':''))};
   if(c.estimate && position(c))pick(position(c));
   $('#cancelPin').onclick=()=>{clearDraft();render()};
  };
 }
 function pick(p){draft=p;if(draftLayer)draftLayer.remove();draftLayer=L.circleMarker(p,{radius:10,color:'#213a79',fillOpacity:.7}).addTo(map);$('#coords').textContent='Selected point '+p.map(v=>v.toFixed(5)).join(', ');$('#savePin').disabled=false}
 map.on('click',e=>{if(placing)pick([e.latlng.lat,e.latlng.lng])});
 $('#caseList').onclick=e=>{const id=e.target.closest('button')?.dataset.case;if(id)choose(list.find(c=>c.id===id))};
 $('#mapFilter').onchange=()=>{clearDraft();if(selected&&!fits(selected))selected=null;render()};
 if(selected)choose(selected);else render();
}
