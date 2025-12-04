const AKAMAI_BASE = "https://todtv-live-spo-prod.akamaized.net/Content/Channel";
const ORIGIN_ID = "svc-spo-hd-38-dt";
const TOKEN_TEMPLATE = "hdntl=exp=1764872905~acl=*%2fContent%2fChannel%2fsvc-spo-hd-38-dt%2fDASH%2f*~id=3fbe8de3-8ef6-46ca-b4f6-9cedf8802c74~data=hdntl,aXA9MTk3LjE0NS4yMzMuMjksYXVkPW1lbmE~hmac=8aff00148e956ce0b9d0b2062a3ca280e32d1ddcb12fb94deb6931dd9dcda143/playlist_ha.mpd?start=1764855007000&end=1764876600000";

const CLEAR_KEYS = {
  "dece176768f639bcbaf97ebca9c74164": "dd5f1f0bfe87b23eb94160af51671670"
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS Pre-flight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // --- ROUTE 1: Serve the HTML Player ---
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(HTML_CONTENT, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // --- ROUTE 2: Config API ---
    if (url.pathname === "/proxy/config") {
      return new Response(JSON.stringify({ clearKeys: CLEAR_KEYS }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // --- ROUTE 3: Stream Proxy ---
    // Matches /stream/:channelId/...
    if (url.pathname.startsWith("/stream/")) {
      const parts = url.pathname.split("/");
      // parts[0] = empty, parts[1] = "stream", parts[2] = channelId, parts[3...] = rest
      const channelId = parts[2];
      const resourcePath = parts.slice(3).join("/");

      if (!channelId) {
        return new Response("Missing Channel ID", { status: 400 });
      }

      // Dynamic Token Logic
      const dynamicToken = TOKEN_TEMPLATE.replace(new RegExp(ORIGIN_ID, "g"), channelId);

      let targetUrl;
      // If requesting manifest
      if (resourcePath.includes("manifest") || resourcePath.endsWith(".mpd")) {
        targetUrl = `${AKAMAI_BASE}/${channelId}/DASH/${dynamicToken}`;
      } else {
        // If requesting segments (.m4s, .mp4, etc), we need the base of the token path
        const tokenBase = dynamicToken.split("/playlist_ha.mpd")[0];
        targetUrl = `${AKAMAI_BASE}/${channelId}/DASH/${tokenBase}/${resourcePath}`;
      }

      // Fetch from Akamai
      const originalResponse = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://tod.tv/",
          "Origin": "https://tod.tv"
        }
      });

      // Recreate response to add CORS
      const newResponse = new Response(originalResponse.body, originalResponse);
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      return newResponse;
    }

    return new Response("Not Found", { status: 404 });
  },
};

// --- HTML PLAYER CONTENT ---
const HTML_CONTENT = `
<!DOCTYPE html>
<html dir='rtl' lang='ar'>
<head>
<meta charset='UTF-8'/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>TOD - Cloudflare Player</title>
<link href="//ko.best-goal.live/app/logo.png" rel="icon" type="image/png">
<meta name="referrer" content="no-referrer" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/feather-icons/dist/feather.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.13/shaka-player.compiled.js"></script>
<style>
    :root { --primary-color: #ffc107; --live-color: #e62e2e; --not-live-color: rgba(128, 128, 128, 0.8); --menu-bg: rgba(25, 25, 25, 0.95); }
    body, html { margin: 0; padding: 0; overflow: hidden; background-color: #000; font-family: 'Tajawal', sans-serif !important; -webkit-tap-highlight-color: transparent; }
    #player-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: #000; display: flex; justify-content: center; align-items: center; }
    #video-wrapper { position: relative; width: 100%; height: 100%; z-index: 1; }
    #video { width: 100%; height: 100%; object-fit: contain; }
    #loading-spinner, #error-overlay { position: absolute; z-index: 100; display: flex; align-items: center; justify-content: center; }
    #loading-spinner { width: 50px; height: 50px; border: 5px solid rgba(255, 255, 255, 0.2); border-top-color: var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite; display: none; }
    @keyframes spin { to { transform: rotate(360deg); } }
    #error-overlay { inset: 0; background-color: rgba(0,0,0,0.9); color: #fff; flex-direction: column; text-align: center; padding: 20px; display: none; }
    #error-overlay i { width: 48px; height: 48px; margin-bottom: 20px; }
    .controls-overlay { transition: opacity 0.3s, visibility 0.3s; opacity: 0; visibility: hidden; pointer-events: none; position: absolute; z-index: 10; }
    .controls-overlay.visible { opacity: 1; visibility: visible; pointer-events: auto; }
    #bottom-controls-container { bottom: 0; left: 0; right: 0; padding: 5px 15px; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); }
    #center-controls { top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 30px; }
    .control-button, .center-control-button { background: none; border: none; color: #fff; cursor: pointer; padding: 0; outline: none; -webkit-tap-highlight-color: transparent; }
    .control-button:hover { color: var(--primary-color); }
    .control-button i, .control-button svg { width: 22px; height: 22px; }
    .center-control-button { width: 70px; height: 70px; display: flex; justify-content: center; align-items: center; }
    .center-control-button i { width: 48px; height: 48px; filter: drop-shadow(0px 0px 8px rgba(0, 0, 0, 0.8)); }
    #seek-backward-center-btn i, #seek-forward-center-btn i { transform: scaleX(-1); }
    .progress-bar-container { width: 100%; padding: 10px 0; cursor: pointer; }
    .progress-bar { width: 100%; height: 4px; background-color: rgba(255, 255, 255, 0.3); border-radius: 2px; }
    .progress-played { width: 0; height: 100%; background-color: var(--primary-color); border-radius: 2px; }
    .bottom-controls { display: flex; justify-content: space-between; align-items: center; padding: 0 5px; }
    .controls-left, .controls-right { display: flex; align-items: center; gap: 15px; }
    #live-indicator { font-weight: 700; font-size: 0.9rem; padding: 4px 10px; border-radius: 50px; color: #fff; white-space: nowrap; }
    #live-indicator.is-live { background-color: var(--live-color); }
    #live-indicator.is-not-live { background-color: var(--not-live-color); cursor: pointer; }
    .popup-menu { position: absolute; bottom: 60px; width: 200px; background-color: var(--menu-bg); backdrop-filter: blur(8px); border-radius: 8px; z-index: 20; max-height: 200px; overflow-y: auto; display: none; }
    .popup-menu-list { list-style:none; padding: 5px; margin:0; }
    .menu-item { display: flex; justify-content: space-between; padding: 8px 10px; border-radius: 5px; cursor: pointer; font-weight: 500; color: #fff; }
    .menu-item:hover { background-color: rgba(255, 255, 255, 0.1); }
    .menu-item.active { color: var(--primary-color); font-weight: 700; }
    #player-logo { position: absolute; bottom: 75px; left: 15px; z-index: 9; opacity: 0.7; transition: opacity 0.3s ease; height: 28px; display: inline-block; }
    #player-logo img { height: 100%; width: auto; }
</style>
</head>
<body>
<div id="player-container">
    <div id="loading-spinner"></div>
    <div id="error-overlay">
        <i data-feather="alert-triangle"></i>
        <h3 id="error-title">فشل تحميل البث</h3>
        <p id="error-message">قد يكون البث متوقف حالي&#1611;ا.</p>
    </div>
    <div id="video-wrapper">
          <video autoplay muted data-shaka-player poster="https://up6.cc/2025/03/174328431874221.png" id='video' style='width:100%;height:100%;object-fit: fill !important;'></video>
    </div>
    <a id="player-logo" target="_blank"><img alt="Logo" src="https://ko.best-goal.live/appnewversion/logo.png"></a>
    <div id="quality-popup" class="popup-menu"><ul id="quality-list" class="popup-menu-list"></ul></div>
    <div id="audio-popup" class="popup-menu"><ul id="audio-list" class="popup-menu-list"></ul></div>
    <div id="center-controls" class="controls-overlay visible">
        <button class="center-control-button" id="seek-backward-center-btn"><i data-feather="fast-forward"></i></button>
        <button class="center-control-button" id="play-pause-center-btn"><i data-feather="play"></i></button>
        <button class="center-control-button" id="seek-forward-center-btn"><i data-feather="rewind"></i></button>
    </div>
    <div id="bottom-controls-container" class="controls-overlay">
        <div class="progress-bar-container"><div class="progress-bar"><div class="progress-played"></div></div></div>
        <div class="bottom-controls">
            <div class="controls-left">
                <button class="control-button" id="play-pause-btn"><i data-feather="play"></i></button>
                <button class="control-button" id="mute-btn"><i data-feather="volume-2"></i></button>
                <button id="quality-btn" class="control-button"><i data-feather="settings"></i></button>
                <button id="audio-btn" class="control-button"><i data-feather="headphones"></i></button>
                <div id="live-indicator"></div>
            </div>
            <div class="controls-right">
                <button class="control-button" id="pip-btn"><i data-feather="airplay"></i></button>
                <button class="control-button" id="expand-btn"></button>
                <button class="control-button" id="fullscreen-btn"><i data-feather="maximize"></i></button>
            </div>
        </div>
    </div>
</div>
<script>
document.addEventListener('DOMContentLoaded', () => {
    const expandSvg = '<svg fill="currentColor" version="1.1" xmlns="http://www.w3.org/2000/svg" width="22px" height="22px" viewBox="0 0 100 100"><g><path d="M22.661,20.5H36c1.104,0,2-0.896,2-2s-0.896-2-2-2H19c-1.104,0-2.5,1.276-2.5,2.381v17c0,1.104,0.896,2,2,2s2-0.896,2-2V24.876l16.042,15.791c0.391,0.391,1.027,0.586,1.539,0.586s1.086-0.195,1.477-0.586c0.781-0.781,0.812-2.237,0.031-3.019L22.661,20.5z"/><path d="M83,16.5H66c-1.104,0-2,0.896,2,2s0.896,2,2,2h12.605L61.647,37.648c-0.781,0.781-0.781,2.142,0,2.923c0.39,0.391,0.902,0.633,1.414,0.633s0.774-0.171,1.164-0.562l16.274-16.5v11.738c0,1.104,0.896,2,2,2s2-0.896,2-2v-17C84.5,17.776,84.104,16.5,83,16.5z"/><path d="M36.542,60.962L20.5,76.754V65.881c0-1.104-0.896-2-2-2s-2,0.896,2,2v17c0,1.104,1.396,1.619,2.5,1.619h17c1.104,0,2-0.896,2-2s-0.896-2-2-2H22.529L39.62,63.6c0.781-0.781,0.656-1.951-0.125-2.732C38.715,60.086,37.322,60.181,36.542,60.962z"/><path d="M82.5,63.881c-1.104,0-2,0.896-2,2v11.606L64.226,60.962c-0.78-0.781-1.923-0.781-2.703,0c-0.781,0.781-0.719,1.856,0.062,2.638l17.152,16.9H66c-1.104,0-2,0.896-2,2s0.896,2,2,2h17c1.104,0,1.5-0.515,1.5-1.619v-17C84.5,64.776,83.604,63.881,82.5,63.881z"/></g></svg>';
    const urlParams = new URLSearchParams(window.location.search);
    const channelId = urlParams.get('id') || 'svc-spo-hd-38-dt'; 
    const PROXY_BASE_URL = window.location.origin;
    const MANIFEST_PROXY_URL = \`\${PROXY_BASE_URL}/stream/\${channelId}/manifest.mpd\`;
    const CONFIG_PROXY_URL = \`\${PROXY_BASE_URL}/proxy/config\`;
    const elements = { video: document.getElementById('video'), playerContainer: document.getElementById('player-container'), videoWrapper: document.getElementById('video-wrapper'), centerControls: document.getElementById('center-controls'), bottomControls: document.getElementById('bottom-controls-container'), playPauseBtn: document.getElementById('play-pause-btn'), playPauseCenterBtn: document.getElementById('play-pause-center-btn'), muteBtn: document.getElementById('mute-btn'), pipBtn: document.getElementById('pip-btn'), expandBtn: document.getElementById('expand-btn'), fullscreenBtn: document.getElementById('fullscreen-btn'), liveIndicator: document.getElementById('live-indicator'), progressPlayed: document.querySelector('.progress-played'), progressBarContainer: document.querySelector('.progress-bar-container'), qualityBtn: document.getElementById('quality-btn'), audioBtn: document.getElementById('audio-btn'), qualityPopup: document.getElementById('quality-popup'), audioPopup: document.getElementById('audio-popup'), loadingSpinner: document.getElementById('loading-spinner'), errorOverlay: document.getElementById('error-overlay'), errorTitle: document.getElementById('error-title'), errorMessage: document.getElementById('error-message'), playerLogoLink: document.getElementById('player-logo') };
    elements.expandBtn.innerHTML = expandSvg; elements.playerLogoLink.href = 'https://t.me/bestvapp'; feather.replace();
    const player = new shaka.Player(elements.video);
    player.configure({ manifest: { dash: { ignoreMinBufferTime: true } }, streaming: { rebufferingGoal: 2, bufferingGoal: 10, alwaysStreamText: true }, abr: { defaultBandwidthEstimate: 3000000, enabled: true } });
    async function initializeApp() {
        elements.loadingSpinner.style.display = 'flex';
        try {
            const configResponse = await fetch(CONFIG_PROXY_URL); const config = await configResponse.json();
            player.configure({ drm: { clearKeys: config.clearKeys } });
            await player.load(MANIFEST_PROXY_URL);
            elements.loadingSpinner.style.display = 'none'; showControls();
        } catch (error) { elements.loadingSpinner.style.display = 'none'; elements.errorTitle.textContent = 'فشل التحميل'; elements.errorMessage.textContent = error.message; elements.errorOverlay.style.display = 'flex'; feather.replace(); }
    }
    let controlsTimeout, clickTimer, expandModeIndex = 0; const expandModes = ['contain', 'cover', 'fill'];
    const showControls = () => { [elements.bottomControls, elements.centerControls].forEach(el => el.classList.add('visible')); clearTimeout(controlsTimeout); if (!elements.video.paused) controlsTimeout = setTimeout(hideControls, 3000); };
    const hideControls = () => { if (document.fullscreenElement && elements.video.paused) return; [elements.bottomControls, elements.centerControls].forEach(el => el.classList.remove('visible')); [elements.qualityPopup, elements.audioPopup].forEach(p => p.style.display = 'none'); };
    const togglePlay = () => elements.video.paused ? elements.video.play() : elements.video.pause();
    const updatePlayButton = () => { const icon = elements.video.paused ? 'play' : 'pause'; elements.playPauseBtn.innerHTML = \`<i data-feather="\${icon}"></i>\`; elements.playPauseCenterBtn.innerHTML = \`<i data-feather="\${icon}"></i>\`; feather.replace(); };
    async function toggleFullscreen() { !document.fullscreenElement ? await elements.playerContainer.requestFullscreen() : await document.exitFullscreen(); }
    function updateFullscreenIcon() { elements.fullscreenBtn.innerHTML = \`<i data-feather="\${document.fullscreenElement ? 'minimize' : 'maximize'}"></i>\`; feather.replace(); }
    const togglePopup = (button, popup, populator) => { [elements.qualityPopup, elements.audioPopup].filter(p => p !== popup).forEach(p => p.style.display = 'none'); if (popup.style.display === 'block') { popup.style.display = 'none'; } else { if(populator) populator(); const containerRect = elements.playerContainer.getBoundingClientRect(); const buttonRect = button.getBoundingClientRect(); let popupLeft = (buttonRect.left - containerRect.left) + (buttonRect.width / 2) - 100; if (popupLeft < 10) popupLeft = 10; popup.style.left = \`\${popupLeft}px\`; popup.style.display = 'block'; } };
    const formatTime = (s) => { if (isNaN(s) || s < 0) return '00:00'; const d = new Date(null); d.setSeconds(s); return s >= 3600 ? d.toISOString().substr(11, 8) : d.toISOString().substr(14, 5); };
    const populateQualityMenu = () => { const list = document.getElementById('quality-list'); list.innerHTML = ''; const tracks = player.getVariantTracks(); const auto = document.createElement('li'); auto.className = \`menu-item \${player.getConfiguration().abr.enabled ? 'active' : ''}\`; auto.textContent = 'تلقائي'; auto.onclick = () => { player.configure('abr.enabled', true); togglePopup(elements.qualityBtn, elements.qualityPopup); }; list.appendChild(auto); [...new Set(tracks.map(t => t.height))].sort((a,b)=>b-a).forEach(h => { const item = document.createElement('li'); item.className = 'menu-item'; item.textContent = \`\${h}p\`; item.onclick = () => { player.configure('abr.enabled', false); player.selectVariantTrack(tracks.find(t => t.height === h), true); togglePopup(elements.qualityBtn, elements.qualityPopup); }; list.appendChild(item); }); };
    const populateAudioMenu = () => { const list = document.getElementById('audio-list'); list.innerHTML = ''; player.getAudioLanguagesAndRoles().forEach(track => { const item = document.createElement('li'); item.className = 'menu-item'; item.textContent = track.language; item.onclick = () => { player.selectAudioLanguage(track.language); togglePopup(elements.audioBtn, elements.audioPopup); }; list.appendChild(item); }); };
    elements.videoWrapper.addEventListener('click', (e) => { if(e.target===elements.videoWrapper){ clearTimeout(clickTimer); clickTimer = setTimeout(() => elements.bottomControls.classList.contains('visible') ? hideControls() : showControls(), 200); }});
    elements.videoWrapper.addEventListener('dblclick', (e) => { if(e.target===elements.videoWrapper) toggleFullscreen(); }); elements.playerContainer.addEventListener('mousemove', showControls); elements.playPauseBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); }); elements.playPauseCenterBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); }); document.getElementById('seek-forward-center-btn').addEventListener('click', (e) => { e.stopPropagation(); elements.video.currentTime -= 10; }); document.getElementById('seek-backward-center-btn').addEventListener('click', (e) => { e.stopPropagation(); elements.video.currentTime += 10; }); elements.muteBtn.addEventListener('click', (e) => { e.stopPropagation(); elements.video.muted = !elements.video.muted; }); elements.pipBtn.addEventListener('click', (e) => { e.stopPropagation(); document.pictureInPictureElement ? document.exitPictureInPicture() : elements.video.requestPictureInPicture(); }); elements.expandBtn.addEventListener('click', (e) => { e.stopPropagation(); expandModeIndex = (expandModeIndex + 1) % expandModes.length; elements.video.style.objectFit = expandModes[expandModeIndex]; }); elements.fullscreenBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); }); document.addEventListener('fullscreenchange', updateFullscreenIcon); elements.video.addEventListener('play', () => { updatePlayButton(); showControls(); }); elements.video.addEventListener('pause', () => { updatePlayButton(); showControls(); }); elements.video.addEventListener('volumechange', () => { elements.muteBtn.innerHTML = \`<i data-feather="\${elements.video.muted || elements.video.volume === 0 ? 'volume-x' : 'volume-2'}"></i>\`; feather.replace(); }); elements.video.addEventListener('timeupdate', () => { const range = player.seekRange(); if(player.isLive()) { elements.liveIndicator.style.display = 'inline-block'; const isBehind = elements.video.paused || (range.end - elements.video.currentTime) > 15; elements.liveIndicator.className = isBehind ? 'is-not-live' : 'is-live'; elements.liveIndicator.innerHTML = isBehind ? '&#9679; متأخر' : '&#9679; مباشر'; } else { elements.liveIndicator.innerHTML = \`\${formatTime(elements.video.currentTime)} / \${formatTime(range.end)}\`; elements.progressPlayed.style.width = \`\${((elements.video.currentTime - range.start) / (range.end - range.start)) * 100}%\`; } }); elements.qualityBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePopup(e.currentTarget, elements.qualityPopup, populateQualityMenu); }); elements.audioBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePopup(e.currentTarget, elements.audioPopup, populateAudioMenu); }); player.addEventListener('error', e => { console.error(e); }); player.addEventListener('buffering', e => { elements.loadingSpinner.style.display = e.buffering ? 'flex' : 'none'; }); initializeApp();
});
</script>
</body>
</html>
`;
