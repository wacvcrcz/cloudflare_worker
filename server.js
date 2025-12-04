const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static('public'));

// --- CONFIG ---
const AKAMAI_BASE = "https://todtv-live-spo-prod.akamaized.net/Content/Channel";
const ORIGIN_ID = "svc-spo-hd-38-dt"; // The ID inside the original token

// The long token string. We will dynamically replace the channel ID inside the ACL part.
const TOKEN_TEMPLATE = "hdntl=exp=1764872905~acl=*%2fContent%2fChannel%2fsvc-spo-hd-38-dt%2fDASH%2f*~id=3fbe8de3-8ef6-46ca-b4f6-9cedf8802c74~data=hdntl,aXA9MTk3LjE0NS4yMzMuMjksYXVkPW1lbmE~hmac=8aff00148e956ce0b9d0b2062a3ca280e32d1ddcb12fb94deb6931dd9dcda143/playlist_ha.mpd?start=1764855007000&end=1764876600000";

const CLEAR_KEYS = {
  "dece176768f639bcbaf97ebca9c74164": "dd5f1f0bfe87b23eb94160af51671670"
};

// --- ROUTES ---

// 1. Config Endpoint (Player fetches ClearKeys here)
app.get('/proxy/config', (req, res) => {
    res.json({
        clearKeys: CLEAR_KEYS
    });
});

// 2. Stream Proxy Logic
// We map /stream/:channelId/manifest.mpd -> Akamai
// We also map /stream/:channelId/segment.m4s -> Akamai
const proxyOptions = {
    target: AKAMAI_BASE,
    changeOrigin: true,
    selfHandleResponse: false,
    pathRewrite: (path, req) => {
        // Incoming path: /stream/svc-spo-hd-08-dt/manifest.mpd
        // Or: /stream/svc-spo-hd-08-dt/video_0.m4s
        
        // Extract ID
        const parts = path.split('/'); 
        // parts[0] is empty, parts[1] is 'stream', parts[2] is ID
        const channelId = parts[2];
        const resource = parts.slice(3).join('/'); // manifest.mpd or segment file

        // Dynamic Token Generation
        // Replace the original ID in the token string with the requested channel ID
        // Note: This modifies the ACL. If Akamai enforces HMAC strictness on the ACL, 
        // you will get 403 for channels other than 38.
        const dynamicToken = TOKEN_TEMPLATE.replace(new RegExp(ORIGIN_ID, 'g'), channelId);

        // Final URL construction
        // Target is .../Content/Channel
        // Result: /svc-spo-hd-08-dt/DASH/hdntl=.../playlist_ha.mpd
        
        // If resource contains 'manifest', use the token URL
        if (resource.includes('manifest')) {
            return `/${channelId}/DASH/${dynamicToken}`;
        } 
        
        // If it is a segment, we need to keep the folder structure consistent with the DASH manifest
        // The token path actually includes "playlist_ha.mpd", so for segments we need the folder *before* the mpd.
        const tokenBase = dynamicToken.split('/playlist_ha.mpd')[0];
        return `/${channelId}/DASH/${tokenBase}/${resource}`;
    },
    onProxyRes: (proxyRes) => {
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    }
};

app.use('/stream/:channelId', createProxyMiddleware(proxyOptions));

app.listen(PORT, () => {
    console.log(`\nTOD Player running at http://localhost:${PORT}`);
    console.log(`Usage: http://localhost:${PORT}/?id=svc-spo-hd-38-dt\n`);
});
