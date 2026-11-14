/**
 * The map page shown inside the app's web-view (client V2 — OpenStreetMap +
 * Leaflet, free, no API key, no extra native module). The app talks to it
 * with small JSON messages:
 *   → {type:'markers', markers:[{lat,lng,label,kind:'home'|'partner'}]}
 *   → {type:'pin', lat, lng, zoom?}      (pick mode: place/move the red pin)
 *   ← {type:'ready'} / {type:'pick', lat, lng}
 * OpenStreetMap's rules require the credit line — keep the attribution.
 */
const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export function mapHtml(pickable: boolean, tileUrl: string = TILE_URL) {
  return `<!doctype html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="${LEAFLET}/leaflet.css"/>
<style>html,body,#m{height:100%;margin:0;background:#eef2f7}.leaflet-control-attribution{font-size:10px}</style>
</head><body><div id="m"></div>
<script src="${LEAFLET}/leaflet.js"></script>
<script>(function(){
  var PICK=${pickable ? 'true' : 'false'};
  function send(m){var s=JSON.stringify(m);
    if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(s);}
    else if(window.parent&&window.parent!==window){window.parent.postMessage(s,'*');}}
  if(!window.L){send({type:'error',message:'Map could not load. Check your internet.'});return;}
  var map=L.map('m',{zoomControl:true}).setView([12.9716,77.5946],12);
  L.tileLayer(${JSON.stringify(tileUrl)},{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  function icon(c){return L.divIcon({className:'',iconSize:[28,28],iconAnchor:[14,28],
    html:'<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:'+c+';transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>'});}
  var layer=L.layerGroup().addTo(map),pin=null;
  function setPin(lat,lng,zoom){
    if(!pin){pin=L.marker([lat,lng],{icon:icon('#dc2626'),draggable:true}).addTo(map);
      pin.on('dragend',function(){var p=pin.getLatLng();send({type:'pick',lat:p.lat,lng:p.lng});});}
    else{pin.setLatLng([lat,lng]);}
    map.setView([lat,lng],zoom||Math.max(map.getZoom(),16));}
  if(PICK){map.on('click',function(e){setPin(e.latlng.lat,e.latlng.lng);send({type:'pick',lat:e.latlng.lat,lng:e.latlng.lng});});}
  function handle(m){
    if(typeof m==='string'){try{m=JSON.parse(m);}catch(e){return;}}
    if(!m||!m.type)return;
    if(m.type==='markers'){layer.clearLayers();var pts=[];
      (m.markers||[]).forEach(function(k){
        L.marker([k.lat,k.lng],{icon:icon(k.kind==='home'?'#dc2626':'#0050b3')})
          .bindTooltip(k.label,{permanent:true,direction:'top',offset:[0,-26]}).addTo(layer);
        pts.push([k.lat,k.lng]);});
      if(pts.length===1){map.setView(pts[0],15);}
      else if(pts.length>1){map.fitBounds(pts,{padding:[50,50],maxZoom:16});}}
    if(m.type==='pin'){setPin(m.lat,m.lng,m.zoom);}
    if(m.type==='center'){map.setView([m.lat,m.lng],m.zoom||15);}
  }
  window.__mv=handle;
  window.addEventListener('message',function(e){handle(e.data);});
  document.addEventListener('message',function(e){handle(e.data);});
  send({type:'ready'});
})();</script></body></html>`;
}
