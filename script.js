/* ========= 地域データ ========= */
const areas = {
  東京: [35.6895,139.6917],
  大阪: [34.6937,135.5023],
  札幌: [43.0618,141.3545],
  福岡: [33.5902,130.4017],
  那覇: [26.2124,127.6809]
};

const areaSelect = document.getElementById("area");
const weatherDiv = document.getElementById("weather");
const eqLatest = document.getElementById("eq-latest");
const eqHistory = document.getElementById("eq-history");
const alertSound = document.getElementById("alertSound");

/* ========= 地域選択 ========= */
for (const a in areas) {
  const o = document.createElement("option");
  o.value = a;
  o.textContent = a;
  areaSelect.appendChild(o);
}
areaSelect.onchange = loadWeather;

/* ========= 天気 ========= */
function loadWeather() {
  const [lat, lon] = areas[areaSelect.value];
  fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
    .then(r=>r.json())
    .then(d=>{
      const w = d.current_weather;
      weatherDiv.innerHTML = `
        気温: ${w.temperature}℃<br>
        風速: ${w.windspeed}m/s<br>
        天気コード: ${w.weathercode}
      `;
    });
}
loadWeather();

/* ========= 地震 ========= */
const ws = new WebSocket("wss://api.p2pquake.net/v2/ws");

ws.onmessage = e => {
  const d = JSON.parse(e.data);
  if (d.code !== 551) return;

  const eq = d.earthquake;
  const shindo = eq.maxScale;
  const cls = shindo >= 60 ? "shindo-6" :
              shindo >= 50 ? "shindo-5" :
              shindo >= 30 ? "shindo-3" : "shindo-1";

  eqLatest.className = cls;
  eqLatest.innerHTML = `
    <b>${eq.time}</b><br>
    震源: ${eq.hypocenter.name}<br>
    M${eq.hypocenter.magnitude} / 最大震度 ${shindo}
  `;

  const li = document.createElement("li");
  li.className = cls;
  li.textContent = `${eq.time} | ${eq.hypocenter.name} | 震度${shindo}`;
  eqHistory.prepend(li);
  if (eqHistory.children.length > 20) eqHistory.lastChild.remove();

  if (shindo >= 50) alertSound.play();
};

/* ========= 警報 ========= */
fetch("https://www.jma.go.jp/bosai/warning/data/warning.json")
  .then(r=>r.json())
  .then(d=>{
    const list = d.areaTypes[0].areas;
    const active = [];
    list.forEach(a=>{
      a.warnings.forEach(w=>{
        if (w.status === "発表") active.push(`${a.name}: ${w.name}`);
      });
    });
    document.getElementById("warning").innerHTML =
      active.length ? `<div class="warning">${active.join("<br>")}</div>` : "警報なし";
  });
