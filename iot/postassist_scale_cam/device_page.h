// The device's own web page (http://<device-ip>/). Kept out of the .ino because the Arduino
// prototype generator misreads JavaScript inside a raw string literal.
#pragma once
#include <pgmspace.h>

const char INDEX_HTML[] PROGMEM = R"HTML(<!doctype html><html><head><meta name=viewport content="width=device-width,initial-scale=1">
<title>PostAssist scale + camera</title><style>
body{font-family:system-ui,sans-serif;margin:0;background:#f3f6fb;color:#16263a}header{background:#033160;color:#fff;padding:12px 16px;font-weight:700}
main{max-width:760px;margin:auto;padding:12px 16px}section{background:#fff;border:1px solid #d5dfeb;border-radius:10px;padding:12px 14px;margin:12px 0}
h2{font-size:15px;margin:0 0 8px;color:#033160}#g{font-size:48px;font-weight:700}button{background:#063c77;color:#fff;border:0;border-radius:6px;padding:9px 14px;margin:4px 4px 4px 0;font-size:15px}
input{padding:8px;border:1px solid #d5dfeb;border-radius:6px;font-size:15px;margin:3px 0}label{display:block;font-size:13px;margin-top:6px}
#bar{height:14px;background:#e3ecf6;border-radius:7px;overflow:hidden}#fill{height:100%;width:0;background:#1d5fa8}img{width:100%;border-radius:6px;margin-top:8px}
small{color:#5b6b7d}pre{white-space:pre-wrap;font-size:12px;background:#f1f5fa;padding:8px;border-radius:6px}
</style></head><body><header>PostAssist scale + camera <small style="color:#c6d6ea" id=fw></small></header><main>
<section><h2>Weight</h2><div id=g>-</div><div id=st></div>
<button onclick="post('/tare')">Tare (platform empty)</button>
<input id=k type=number value=100 style="width:90px"> g <button onclick="post('/calibrate?g='+k.value)">Calibrate</button>
<br><small>Never settles? Reset the calibration, tare now with the platform empty, then calibrate again.</small><br>
<button onclick="if(confirm('Clear the calibration?'))post('/calibrate/reset')">Reset calibration</button>
<button onclick="post('/tare?force=1')">Tare now (not stable)</button>
<pre id=out></pre></section>
<section><h2>Camera</h2><button onclick="photo()">Take test photo</button><button onclick="focusRun=!focusRun;if(focusRun)focusTick()">Focus helper on/off</button>
<div id=fh style="display:none"><p><small>Put an addressed envelope on the platform under the usual light. Turn the lens slowly (a few degrees at a time)
and stop where the detail score is highest. The best score so far is marked.</small></p><div id=bar><div id=fill></div></div><p id=fs></p></div>
<img id=ph alt=""></section>
<section><h2>Network</h2><small>Saved on the device; it restarts to apply them.</small>
<form method=post action="/settings"><label>Wi-Fi name (2.4 GHz)<input name=ssid id=ssid></label>
<label>Wi-Fi password (empty = keep the current one)<input name=pass type=password></label>
<label>Backend address<input name=api id=api placeholder="http://192.168.1.10:8000" size=34></label><button>Save and restart</button></form></section>
</main><script>
let focusRun=false,best=0;
async function post(u){const r=await fetch(u,{method:'POST'});const j=await r.json();out.textContent=j.message||JSON.stringify(j)}
function photo(){ph.src='/capture.jpg?t='+Date.now()}
async function focusTick(){fh.style.display=focusRun?'block':'none';if(!focusRun)return;try{const j=await(await fetch('/focus')).json();
best=Math.max(best,j.bytes);fill.style.width=Math.round(100*j.bytes/best)+'%';fs.textContent='detail '+j.bytes+' (best '+best+')'}catch(e){}setTimeout(focusTick,300)}
async function tick(){try{const j=await(await fetch('/status')).json();g.textContent=(j.sensor_ok?j.net_g.toFixed(1):'-')+' g';
st.innerHTML='<small>'+(j.sensor_ok?(j.stable?'stable':'settling')+' · placement #'+j.placement_id:'HX711 not answering')+' · '+(j.calibration_id||'not calibrated')
+' · backend '+(j.backend_ok?'ok':'not reached')+' · Wi-Fi '+j.wifi+'</small>';fw.textContent=j.fw;if(!ssid.value)ssid.value=j.ssid;if(!api.value)api.value=j.api}catch(e){}setTimeout(tick,700)}
tick()</script></body></html>)HTML";
