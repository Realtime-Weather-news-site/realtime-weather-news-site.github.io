// --- 基本設定 ---
const map = L.map('map').setView([34.65, 134.98], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

const quakeListEl = document.getElementById('quake-list');
const lastUpdatedEl = document.getElementById('last-updated');
const notifyToggle = document.getElementById('notify-toggle');
const weatherLocation = document.getElementById('weather-location');
const weatherDesc = document.getElementById('weather-desc');
const weatherTemp = document.getElementById('weather-temp');

let markersLayer = L.layerGroup().addTo(map);
let notifyEnabled = false;
let owmKey = '';
let currentLat = parseFloat(document.getElementById('lat').value);
let currentLon = parseFloat(document.getElementById('lon').value);

// --- ユーティリティ ---
function formatTime(ts){
  const d = new Date(ts);
  return d.toLocaleString();
}
function setUpdated(){
  lastUpdatedEl.textContent = '更新: ' + new Date().toLocaleTimeString();
}

// --- 地震表示ヘルパー ---
function intensityColor(mag){
  if(mag >= 6) return '#e74c3c';
  if(mag >= 4) return '#f39c12';
  return '#2ecc71';
}
function addQuakeToMap(feature){
  const props = feature.properties || {};
  const coords = feature.geometry && feature.geometry.coordinates;
  if(!coords) return;
  const lon = coords[0], lat = coords[1];
  const mag = props.mag || 0;
  const title = props.title || `${mag} M`;
  const circle = L.circleMarker([lat, lon], {
    radius: Math.max(6, mag * 3),
    color: intensityColor(mag),
    fillOpacity: 0.6,
    weight: 1
  }).bindPopup(`<strong>${title}</strong><br>${props.place || ''}<br>${formatTime(props.time || Date.now())}`);
  circle.addTo(markersLayer);
}

// --- 地震リスト更新 ---
function prependQuakeListItem(feature){
  const props = feature.properties || {};
  const li = document.createElement('li');
  li.innerHTML = `<strong>${props.title || '地震'}</strong><br><small>${formatTime(props.time || Date.now())}</small>`;
  quakeListEl.prepend(li);
  // リストを50件に制限
  while(quakeListEl.children.length > 50) quakeListEl.removeChild(quakeListEl.lastChild);
}

// --- P2P地震情報 WebSocket ---
function startQuakeWS(){
  // P2P地震情報の公開 WebSocket エンドポイント（例）
  const ws = new WebSocket('wss://api.p2pquake.net/v2/ws');
  ws.onopen = ()=> {
    setUpdated();
    console.log('quake ws open');
  };
  ws.onmessage = (ev)=>{
    try{
      const msg = JSON.parse(ev.data);
      // GeoJSON Feature を受け取る想定
      if(msg.type === 'Feature' && msg.properties){
        addQuakeToMap(msg);
        prependQuakeListItem(msg);
        setUpdated();
        if(notifyEnabled && Notification.permission === 'granted'){
          const title = msg.properties.title || '地震';
          new Notification('地震検知', { body: title });
        }
      }
    }catch(e){ console.warn(e) }
  };
  ws.onerror = ()=> console.warn('quake ws error');
  ws.onclose = ()=> {
    console.log('quake ws closed, retry in 5s');
    setTimeout(startQuakeWS, 5000);
  };
}
startQuakeWS();

// --- 天気取得 ---
async function fetchWeather(lat = currentLat, lon = currentLon){
  if(!owmKey) {
    weatherLocation.textContent = 'APIキー未設定';
    weatherDesc.textContent = '';
    weatherTemp.textContent = '';
    return;
  }
  try{
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=ja&appid=${owmKey}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('weather fetch failed');
    const j = await res.json();
    weatherLocation.textContent = `${j.name || ''} (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
    weatherDesc.textContent = j.weather && j.weather[0] && j.weather[0].description || '';
    weatherTemp.textContent = `${Math.round(j.main.temp)} °C`;
    setUpdated();
  }catch(e){
    weatherLocation.textContent = '天気取得失敗';
    weatherDesc.textContent = '';
    weatherTemp.textContent = '';
    console.error(e);
  }
}

// 初回取得と定期更新
setInterval(()=> fetchWeather(currentLat, currentLon), 60_000);
fetchWeather(currentLat, currentLon);

// --- 通知トグル ---
notifyToggle.addEventListener('click', ()=>{
  notifyEnabled = !notifyEnabled;
  notifyToggle.textContent = `通知: ${notifyEnabled ? 'ON' : 'OFF'}`;
  if(notifyEnabled && Notification.permission !== 'granted'){
    Notification.requestPermission().then(p => {
      if(p !== 'granted') notifyEnabled = false;
      notifyToggle.textContent = `通知: ${notifyEnabled ? 'ON' : 'OFF'}`;
    });
  }
});

// --- 設定適用 ---
document.getElementById('apply-loc').addEventListener('click', ()=>{
  const lat = parseFloat(document.getElementById('lat').value);
  const lon = parseFloat(document.getElementById('lon').value);
  const key = document.getElementById('owm-key').value.trim();
  if(!isNaN(lat) && !isNaN(lon)){
    currentLat = lat; currentLon = lon;
    map.setView([lat, lon], 8);
  }
  if(key) owmKey = key;
  fetchWeather(currentLat, currentLon);
});

// --- 初期マーカーのクリア/更新（必要に応じて） ---
function clearQuakes(){ markersLayer.clearLayers(); quakeListEl.innerHTML = ''; }
