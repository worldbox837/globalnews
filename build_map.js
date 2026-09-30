const fs = require('fs');
const path = require('path');
const https = require('https');

function downloadGeoJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadGeoJSON(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function project(lng, lat) {
  const lambda = (lng * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const x = 500 + (lambda * 500) / Math.PI;
  const millerY = 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * phi));
  const y = 250 - (millerY * 250) / 2.3034;
  return [x, y];
}

function ringToPath(ring) {
  return ring.map((pt, i) => {
    const [x, y] = project(pt[0], pt[1]);
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
  }).join('') + 'Z';
}

async function main() {
  console.log('1. Fetching GeoJSON for World Map...');
  const geojsonUrl = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson';
  const geojson = await downloadGeoJSON(geojsonUrl);

  console.log('2. Projecting countries using Miller projection...');
  let svgPaths = [];
  for (const f of geojson.features) {
    if (f.properties.name === 'Antarctica') continue;
    let dStr = '';
    if (f.geometry.type === 'Polygon') {
      dStr = f.geometry.coordinates.map(ringToPath).join(' ');
    } else if (f.geometry.type === 'MultiPolygon') {
      dStr = f.geometry.coordinates.map(poly => poly.map(ringToPath).join(' ')).join(' ');
    }
    const name = f.properties.name || '';
    const code = f.properties.iso_a2 || '';
    svgPaths.push('<path class="country" data-name="' + name + '" data-code="' + code + '" d="' + dStr + '" stroke-width="0.75" />');
  }
  const countriesSvg = svgPaths.join('\n');

  console.log('3. Loading Integrated Global Intelligence Dataset...');
  const jsonPath = path.join(__dirname, 'integrated_issues.json');
  const integratedIssues = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  let lastUpdatedStr = '';
  const metaPath = path.join(__dirname, 'last_updated.json');
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      lastUpdatedStr = meta.lastUpdatedKst;
    } catch(e) {}
  }
  if (!lastUpdatedStr) {
    const now = new Date();
    lastUpdatedStr = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 16);
  }

  const viewMinX = 0;
  const viewWidth = 1000;
  const viewMinY = -80;
  const viewHeight = 660;

  integratedIssues.forEach(item => {
    const pt = project(item.lng, item.lat);
    item.anchorX = pt[0];
    item.anchorY = pt[1];
    
    const dx = item.dx !== undefined ? item.dx : 35;
    const dy = item.dy !== undefined ? item.dy : -22;
    item.bubbleX = parseFloat((pt[0] + dx).toFixed(1));
    item.bubbleY = parseFloat((pt[1] + dy).toFixed(1));

    item.leftPercent = (((item.bubbleX - viewMinX) / viewWidth) * 100).toFixed(2);
    item.topPercent = (((item.bubbleY - viewMinY) / viewHeight) * 100).toFixed(2);
  });

  console.log('4. Calculated leader line coordinates for all items.');

  // Load realistic satellite imagery (Miller reprojected)
  const satImagePath = path.join(__dirname, 'satellite_miller.jpg');
  let satelliteBase64Uri = '';
  if (fs.existsSync(satImagePath)) {
    const base64Data = fs.readFileSync(satImagePath).toString('base64');
    satelliteBase64Uri = 'data:image/jpeg;base64,' + base64Data;
    console.log('Loaded satellite image data URI:', base64Data.length, 'chars');
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="ko" data-theme="satellite" class="h-full">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>지도로 보는 세계 현황 · Daily Global Briefing</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root, [data-theme="light"] {
      --bg-app: #f8fafc;
      --bg-header: rgba(255, 255, 255, 0.97);
      --bg-subbar: rgba(248, 250, 252, 0.95);
      --bg-surface: #ffffff;
      --bg-surface-subtle: #f1f5f9;
      --bg-card: #ffffff;
      --bg-card-hover: #f8fafc;
      --bg-card-active: #eff6ff;
      --bg-inner-box: #f8fafc;
      --border-subtle: #e2e8f0;
      --border-card: #e2e8f0;
      --text-main: #0f172a;
      --text-muted: #475569;
      --text-light: #64748b;
      --ocean-stop1: #e0f2fe;
      --ocean-stop2: #f1f5f9;
      --country-fill: #cbd5e1;
      --country-stroke: #94a3b8;
      --country-hover-fill: #94a3b8;
      --country-hover-stroke: #2563eb;
      --country-sel-fill: #93c5fd;
      --country-sel-stroke: #2563eb;
      --graticule-stroke: #e2e8f0;
      
      --bubble-econ-bg: #fff1f2;
      --bubble-econ-border: #f43f5e;
      --bubble-econ-text: #9f1239;
      
      --bubble-pol-bg: #eff6ff;
      --bubble-pol-border: #3b82f6;
      --bubble-pol-text: #1e40af;
      
      --bubble-env-bg: #f0fdf4;
      --bubble-env-border: #10b981;
      --bubble-env-text: #065f46;
      
      --shadow-bubble: 0 3px 10px rgba(0, 0, 0, 0.12);
      --map-ctrl-bg: rgba(255, 255, 255, 0.95);
      --map-ctrl-border: #cbd5e1;
      --map-ctrl-text: #1e293b;
      --banner-bg: rgba(255, 255, 255, 0.92);
      --banner-border: #cbd5e1;
      --banner-text: #0f172a;
    }

    [data-theme="dark"] {
      --bg-app: #090d16;
      --bg-header: rgba(12, 18, 32, 0.96);
      --bg-subbar: rgba(14, 22, 38, 0.92);
      --bg-surface: #0c1220;
      --bg-surface-subtle: #0f172a;
      --bg-card: rgba(15, 23, 42, 0.92);
      --bg-card-hover: #1e293b;
      --bg-card-active: #172554;
      --bg-inner-box: rgba(8, 12, 20, 0.65);
      --border-subtle: #1e293b;
      --border-card: #334155;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-light: #64748b;
      --ocean-stop1: #111c33;
      --ocean-stop2: #080c14;
      --country-fill: #1e293b;
      --country-stroke: #334155;
      --country-hover-fill: #334155;
      --country-hover-stroke: #60a5fa;
      --country-sel-fill: #1e3a8a;
      --country-sel-stroke: #3b82f6;
      --graticule-stroke: #1e293b;
      
      --bubble-econ-bg: rgba(28, 10, 14, 0.94);
      --bubble-econ-border: #ef4444;
      --bubble-econ-text: #fecaca;
      
      --bubble-pol-bg: rgba(10, 22, 42, 0.94);
      --bubble-pol-border: #3b82f6;
      --bubble-pol-text: #bfdbfe;
      
      --bubble-env-bg: rgba(6, 32, 22, 0.94);
      --bubble-env-border: #10b981;
      --bubble-env-text: #a7f3d0;
      
      --shadow-bubble: 0 3px 10px rgba(0, 0, 0, 0.7);
      --map-ctrl-bg: rgba(15, 23, 42, 0.95);
      --map-ctrl-border: #334155;
      --map-ctrl-text: #cbd5e1;
      --banner-bg: rgba(15, 23, 42, 0.9);
      --banner-border: #334155;
      --banner-text: #ffffff;
    }

    [data-theme="satellite"] {
      --bg-app: #060b18;
      --bg-header: rgba(10, 18, 36, 0.96);
      --bg-subbar: rgba(12, 22, 44, 0.94);
      --bg-surface: #0a1224;
      --bg-surface-subtle: #0f1c38;
      --bg-card: rgba(14, 25, 52, 0.92);
      --bg-card-hover: #15274d;
      --bg-card-active: #1e3a8a;
      --bg-inner-box: rgba(6, 11, 24, 0.75);
      --border-subtle: #1e3a8a;
      --border-card: #2563eb;
      --text-main: #f8fafc;
      --text-muted: #93c5fd;
      --text-light: #60a5fa;
      
      --country-fill: transparent;
      --country-stroke: rgba(255, 255, 255, 0.4);
      --country-hover-fill: rgba(59, 130, 246, 0.32);
      --country-hover-stroke: #60a5fa;
      --country-sel-fill: rgba(37, 99, 235, 0.45);
      --country-sel-stroke: #38bdf8;
      --graticule-stroke: rgba(255, 255, 255, 0.18);
      
      --bubble-econ-bg: rgba(28, 10, 14, 0.94);
      --bubble-econ-border: #f43f5e;
      --bubble-econ-text: #ffe4e6;
      
      --bubble-pol-bg: rgba(10, 25, 55, 0.94);
      --bubble-pol-border: #38bdf8;
      --bubble-pol-text: #e0f2fe;
      
      --bubble-env-bg: rgba(6, 32, 22, 0.94);
      --bubble-env-border: #34d399;
      --bubble-env-text: #d1fae5;
      
      --shadow-bubble: 0 4px 14px rgba(0, 0, 0, 0.85);
      --map-ctrl-bg: rgba(10, 18, 36, 0.95);
      --map-ctrl-border: #1e3a8a;
      --map-ctrl-text: #e0f2fe;
      --banner-bg: rgba(10, 18, 36, 0.92);
      --banner-border: #2563eb;
      --banner-text: #ffffff;
    }

    * { 
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif;
      box-sizing: border-box;
      outline: none !important;
      -webkit-tap-highlight-color: transparent;
    }
    
    html, body {
      height: 100%;
      height: 100vh;
      overflow: hidden;
      margin: 0;
      padding: 0;
      background: var(--bg-app);
      color: var(--text-main);
      transition: background-color 0.25s ease, color 0.25s ease;
    }

    /* SVG Country hover & selection */
    .country {
      fill: var(--country-fill) !important;
      stroke: var(--country-stroke) !important;
      transition: fill 0.2s ease, stroke 0.2s ease, filter 0.2s ease;
      cursor: pointer;
    }
    .country:hover {
      fill: var(--country-hover-fill) !important;
      stroke: var(--country-hover-stroke) !important;
      stroke-width: 1.2px !important;
    }
    .country.selected-country {
      fill: var(--country-sel-fill) !important;
      stroke: var(--country-sel-stroke) !important;
      stroke-width: 2px !important;
      filter: drop-shadow(0 0 10px rgba(37, 99, 235, 0.75));
    }

    /* Satellite mode country overrides for authentic photographic look */
    [data-theme="satellite"] .country {
      fill: transparent !important;
      stroke: rgba(255, 255, 255, 0.42) !important;
      stroke-width: 0.65px;
    }
    [data-theme="satellite"] .country:hover {
      fill: rgba(59, 130, 246, 0.3) !important;
      stroke: #60a5fa !important;
      stroke-width: 1.3px !important;
    }
    [data-theme="satellite"] .country.selected-country {
      fill: rgba(37, 99, 235, 0.45) !important;
      stroke: #38bdf8 !important;
      stroke-width: 1.8px !important;
      filter: drop-shadow(0 0 10px rgba(56, 189, 248, 0.9));
    }

    /* Leader line aesthetics */
    .leader-line {
      transition: stroke-width 0.2s ease, opacity 0.2s ease;
      pointer-events: none;
    }
    .leader-line.active {
      stroke-width: 2.4px !important;
      opacity: 1 !important;
      stroke-dasharray: none !important;
    }

    /* Speech Bubble Overlay Elements */
    .marker-wrap {
      position: absolute;
      transform: translate(-50%, -50%);
      cursor: pointer;
      user-select: none;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), z-index 0.2s;
      z-index: 20;
      outline: none !important;
    }
    .marker-wrap:hover, .marker-wrap.active {
      transform: translate(-50%, -50%) scale(1.1);
      z-index: 35;
    }

    /* Hide map bubbles and leader lines when Detail Modal is open */
    body.modal-open .marker-wrap,
    body.modal-open #leader-lines-group {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
      transition: opacity 0.2s ease, visibility 0.2s ease;
    }

    /* Bubble Box: Compact & Refined */
    .speech-bubble {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: var(--shadow-bubble);
      border-width: 1.5px;
      backdrop-filter: blur(8px);
      transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      line-height: 1.25;
      outline: none !important;
    }

    .bubble-economy {
      background: var(--bubble-econ-bg);
      border-color: var(--bubble-econ-border);
      color: var(--bubble-econ-text);
    }
    .bubble-economy:hover, .marker-wrap.active .bubble-economy {
      background: #dc2626 !important;
      color: #ffffff !important;
      box-shadow: 0 0 16px rgba(220, 38, 38, 0.85);
    }

    .bubble-politics {
      background: var(--bubble-pol-bg);
      border-color: var(--bubble-pol-border);
      color: var(--bubble-pol-text);
    }
    .bubble-politics:hover, .marker-wrap.active .bubble-politics {
      background: #2563eb !important;
      color: #ffffff !important;
      box-shadow: 0 0 16px rgba(37, 99, 235, 0.85);
    }

    .bubble-environment {
      background: var(--bubble-env-bg);
      border-color: var(--bubble-env-border);
      color: var(--bubble-env-text);
    }
    .bubble-environment:hover, .marker-wrap.active .bubble-environment {
      background: #059669 !important;
      color: #ffffff !important;
      box-shadow: 0 0 16px rgba(5, 150, 105, 0.85);
    }

    /* Graticule Lines */
    .graticule {
      stroke: var(--graticule-stroke);
      stroke-width: 0.5;
      stroke-dasharray: 2 4;
      pointer-events: none;
    }

    /* Map Navigation Controls */
    .map-ctrl-btn {
      background: var(--map-ctrl-bg);
      border: 1px solid var(--map-ctrl-border);
      color: var(--map-ctrl-text);
    }
    .map-ctrl-btn:hover {
      background: var(--bg-surface-subtle);
    }

    /* Modal Animation */
    .modal-enter {
      animation: modalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes modalFadeIn {
      from { opacity: 0; transform: translateY(12px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Custom Scrollbar */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: var(--bg-surface-subtle);
    }
    ::-webkit-scrollbar-thumb {
      background: var(--border-subtle);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: var(--text-light);
    }
  </style>
</head>
<body class="h-screen w-screen overflow-hidden flex flex-col selection:bg-blue-600 selection:text-white">

  <!-- TOP HEADER -->
  <header style="background: var(--bg-header); border-color: var(--border-subtle);" class="border-b backdrop-blur shrink-0 px-4 lg:px-6 py-2.5 z-40 transition-colors">
    <div class="max-w-[1920px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2.5">
      
      <!-- Brand & Title -->
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-500 to-emerald-400 flex items-center justify-center shadow-md text-lg cursor-pointer" onclick="clearCountryFilter()" title="전체 보기 초기화">
          🌐
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-base lg:text-lg font-extrabold tracking-tight leading-tight cursor-pointer" onclick="clearCountryFilter()">
              지도로 보는 세계 현황
            </h1>
            <span class="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 border border-blue-500/30">
              <span>🗺️</span> 국가 클릭 시 종합 뉴스
            </span>
            <span class="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold hidden sm:flex items-center gap-1 border border-emerald-500/30" title="3시간마다 실시간 주요 외신 뉴스 자동 업데이트">
              <span>🕒</span> 3시간 주기 자동 갱신 (${lastUpdatedStr} KST)
            </span>
          </div>
          <p style="color: var(--text-muted);" class="text-xs leading-tight mt-0.5">지도의 국가나 말풍선을 클릭하면 해당 국가의 종합 뉴스가 오른쪽에 표시됩니다</p>
        </div>
      </div>

      <!-- Right Controls: Theme Selector & Mobile Switcher -->
      <div class="flex flex-wrap items-center gap-2.5">
        
        <!-- Theme Selector (White / Dark / Satellite - Realistic Earth Imagery!) -->
        <div style="background: var(--bg-surface-subtle); border-color: var(--border-subtle);" class="flex items-center rounded-xl border p-0.5 shadow-sm text-xs font-semibold">
          <span style="color: var(--text-muted);" class="px-2 font-bold text-[11px] hidden sm:inline">테마:</span>
          <button id="btn-theme-light" onclick="setTheme('light')" class="px-2.5 py-1 rounded-lg transition font-medium text-xs flex items-center gap-1">
            ☀️ <span>화이트</span>
          </button>
          <button id="btn-theme-dark" onclick="setTheme('dark')" class="px-2.5 py-1 rounded-lg transition font-medium text-xs flex items-center gap-1">
            🌙 <span>다크</span>
          </button>
          <button id="btn-theme-satellite" onclick="setTheme('satellite')" class="px-2.5 py-1 rounded-lg transition font-medium text-xs flex items-center gap-1">
            🛰️ <span>위성사진</span>
          </button>
        </div>

        <!-- Mobile View Switch -->
        <div style="background: var(--bg-surface-subtle); border-color: var(--border-subtle);" class="flex lg:hidden rounded-xl border p-0.5 text-xs font-semibold">
          <button id="btn-view-map" onclick="switchView('map')" class="px-2.5 py-1 rounded-lg bg-blue-600 text-white shadow-sm flex items-center gap-1 transition">
            🗺️ <span>지도</span>
          </button>
          <button id="btn-view-list" onclick="switchView('list')" style="color: var(--text-muted);" class="px-2.5 py-1 rounded-lg hover:text-blue-500 flex items-center gap-1 transition">
            📑 <span>피드</span>
          </button>
        </div>
      </div>
    </div>
  </header>

  <!-- CATEGORY FILTER & SEARCH BAR -->
  <section style="background: var(--bg-subbar); border-color: var(--border-subtle);" class="border-b shrink-0 px-4 lg:px-6 py-2 z-30 transition-colors">
    <div class="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-2.5">
      
      <!-- Category Filter Tabs (Exclusively Category Only!) -->
      <div class="flex items-center flex-wrap gap-2 text-xs font-medium">
        <span style="color: var(--text-muted);" class="font-extrabold hidden sm:inline text-xs flex items-center gap-1">
          <span>📂</span> 범주:
        </span>
        <button onclick="setCategoryFilter('all')" data-cat="all" class="filter-cat-btn px-3 py-1.5 rounded-lg bg-blue-600 text-white transition font-bold text-xs shadow-sm flex items-center gap-1">
          전체 (<span id="filter-count-all">0</span>)
        </button>
        <button onclick="setCategoryFilter('economy')" data-cat="economy" class="filter-cat-btn px-3 py-1.5 rounded-lg transition font-bold text-xs border flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
          <span>경제·테크 (<span id="filter-count-economy">0</span>)</span>
        </button>
        <button onclick="setCategoryFilter('politics')" data-cat="politics" class="filter-cat-btn px-3 py-1.5 rounded-lg transition font-bold text-xs border flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
          <span>정치·외교 (<span id="filter-count-politics">0</span>)</span>
        </button>
        <button onclick="setCategoryFilter('environment')" data-cat="environment" class="filter-cat-btn px-3 py-1.5 rounded-lg transition font-bold text-xs border flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
          <span>환경·재난 (<span id="filter-count-environment">0</span>)</span>
        </button>
      </div>

      <!-- Search Input -->
      <div class="relative w-52 sm:w-64">
        <input 
          id="search-input"
          type="text" 
          placeholder="국가, 키워드 검색..."
          oninput="handleSearch(this.value)"
          style="background: var(--bg-surface); border-color: var(--border-subtle); color: var(--text-main);"
          class="w-full border rounded-lg pl-8 pr-3 py-1.5 text-xs placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-sm"
        />
        <svg style="color: var(--text-muted);" class="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
      </div>
    </div>
  </section>

  <!-- MAIN VIEWPORT CONTAINER: Full height flex layout -->
  <main class="flex-1 min-h-0 w-full max-w-[1920px] mx-auto p-2 sm:p-2.5 flex flex-col lg:flex-row items-stretch gap-2.5 overflow-hidden">

    <!-- MAP VIEW SECTION: Full 100% height, zero top/bottom empty space -->
    <div id="view-map" style="background: var(--bg-surface); border-color: var(--border-subtle);" class="w-full lg:w-[64%] xl:w-[66%] 2xl:w-[68%] h-full shrink-0 relative rounded-xl overflow-hidden border shadow-xl flex items-center justify-center transition-all">
      
      <!-- Interactive World Map Canvas (p-0 edge-to-edge fill) -->
      <div id="map-canvas" class="w-full h-full relative overflow-hidden flex items-center justify-center p-0">
        
        <!-- MAP STAGE (Fills 100% of canvas, transform target for pan/zoom) -->
        <div id="map-stage" class="relative w-full h-full flex items-center justify-center pointer-events-auto">
          
          <!-- SVG MAP: viewBox strictly 0 -80 1000 660, fills 100% edge-to-edge -->
          <svg id="world-svg" viewBox="0 -80 1000 660" class="w-full h-full pointer-events-auto block" preserveAspectRatio="none">
            <defs>
              <radialGradient id="ocean-glow" cx="50%" cy="50%" r="60%">
                <stop id="ocean-stop-1" offset="0%" stop-color="#e0f2fe" stop-opacity="0.85"/>
                <stop id="ocean-stop-2" offset="100%" stop-color="#f1f5f9" stop-opacity="1.0"/>
              </radialGradient>
            </defs>

            <!-- 1. Real Satellite Imagery Layer (Photorealistic NASA Earth, exact viewBox match) -->
            <image id="satellite-bg-img" href="${satelliteBase64Uri}" x="0" y="-80" width="1000" height="660" preserveAspectRatio="none" style="display: block; pointer-events: none;" />

            <!-- 2. Ocean Gradient Background Layer (For Light & Dark modes) -->
            <rect id="ocean-bg-rect" x="0" y="-80" width="1000" height="660" fill="url(#ocean-glow)" style="display: none;" />

            <!-- Graticules -->
            <line x1="0" y1="250" x2="1000" y2="250" class="graticule" />
            <line x1="0" y1="177" x2="1000" y2="177" class="graticule" />
            <line x1="0" y1="323" x2="1000" y2="323" class="graticule" />
            <line x1="500" y1="-80" x2="500" y2="580" class="graticule" />
            <line x1="250" y1="-80" x2="250" y2="580" class="graticule" />
            <line x1="750" y1="-80" x2="750" y2="580" class="graticule" />

            <!-- Countries Group -->
            <g id="countries-group">
              ${countriesSvg}
            </g>

            <!-- SVG LEADER LINES GROUP -->
            <g id="leader-lines-group">
              <!-- Dynamically populated by JS -->
            </g>
          </svg>

          <!-- SPEECH BUBBLE MARKERS OVERLAY -->
          <div id="markers-layer" class="absolute inset-0 pointer-events-none w-full h-full">
            <!-- Dynamically inserted by JS -->
          </div>
        </div>

        <!-- Map Navigation Controls -->
        <div class="absolute top-3 right-3 flex flex-col gap-1.5 z-30">
          <button onclick="resetZoom()" title="원래 크기로 리셋" class="map-ctrl-btn w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-md transition font-bold">
            🧭
          </button>
          <button onclick="zoomMap(1.2)" title="확대" class="map-ctrl-btn w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold shadow-md transition">
            +
          </button>
          <button id="btn-zoom-out" onclick="zoomMap(0.8)" title="축소 (첫 화면 크기 고정)" class="map-ctrl-btn w-8 h-8 rounded-lg flex items-center justify-center text-base font-bold shadow-md transition opacity-40 cursor-not-allowed">
            −
          </button>
        </div>

        <!-- Active Category Banner -->
        <div class="absolute top-3 left-3 z-30 pointer-events-none">
          <div id="map-mode-indicator" style="background: var(--banner-bg); border-color: var(--banner-border); color: var(--banner-text);" class="px-3 py-1.5 rounded-lg backdrop-blur border text-xs font-bold shadow-md flex items-center gap-1.5 transition-colors">
            <span>🌐 전체 글로벌 뉴스 (23개국)</span>
          </div>
        </div>

        <!-- Instruction Tip -->
        <div class="absolute bottom-2.5 right-3 px-3 py-1 rounded-lg backdrop-blur border text-[11px] font-medium pointer-events-none hidden sm:block" style="background: var(--banner-bg); border-color: var(--banner-border); color: var(--text-muted);">
          💡 지도의 국가 영토나 말풍선을 클릭하면 해당 국가의 종합 뉴스 리스트가 열립니다
        </div>
      </div>
    </div>

    <!-- RIGHT PANEL: INTERACTIVE BRIEFING FEED (Full 100% height, flex-1 remaining width) -->
    <aside id="view-list" style="background: var(--bg-surface); border-color: var(--border-subtle);" class="flex-1 min-w-0 h-full flex-col rounded-xl overflow-hidden border shadow-xl hidden lg:flex transition-all">
      
      <!-- Feed Header -->
      <div style="background: var(--bg-surface-subtle); border-color: var(--border-subtle);" class="px-4 py-3 border-b flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-base shrink-0">📋</span>
          <h2 id="list-feed-title" style="color: var(--text-main);" class="text-sm font-extrabold tracking-wide whitespace-nowrap truncate">글로벌 뉴스 피드</h2>
          <span id="list-total-count" class="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/30 shrink-0">23건</span>
        </div>
        <div id="feed-header-action" class="flex items-center gap-1 shrink-0">
          <span style="color: var(--text-muted);" class="text-xs font-medium hidden 2xl:inline">국가별 주요 뉴스 리스트</span>
        </div>
      </div>

      <!-- Feed Scrollable List -->
      <div id="issues-grid" class="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        <!-- Rendered by JS -->
      </div>
    </aside>
  </main>

  <!-- DETAIL MODAL / DRAWER (Unified, Clean, Large Typography) -->
  <div id="detail-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm hidden" onclick="handleBackdropClick(event)">
    <div id="modal-card" style="background: var(--bg-surface); border-color: var(--border-card);" class="border rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl modal-enter overflow-hidden" onclick="event.stopPropagation()">
      
      <!-- Modal Header -->
      <div style="background: var(--bg-surface-subtle); border-color: var(--border-subtle);" class="px-6 py-4 border-b flex items-start justify-between">
        <div>
          <div class="flex items-center gap-2 mb-1.5">
            <span id="modal-badge" class="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider"></span>
            <span id="modal-country" style="color: var(--text-muted);" class="text-xs sm:text-sm font-bold flex items-center gap-1"></span>
          </div>
          <h3 id="modal-title" style="color: var(--text-main);" class="text-base sm:text-lg lg:text-xl font-extrabold leading-snug"></h3>
        </div>
        <button onclick="closeModal()" style="background: var(--bg-surface-subtle); border-color: var(--border-subtle); color: var(--text-muted);" class="w-8 h-8 rounded-lg border hover:text-blue-500 flex items-center justify-center text-sm font-bold transition ml-2 shrink-0">
          ✕
        </button>
      </div>

      <!-- Modal Body -->
      <div id="modal-body-container" class="p-6 space-y-5 overflow-y-auto">
        
        <!-- SECTION 1: 핵심 요약 브리핑 -->
        <div class="space-y-2.5">
          <div class="flex items-center justify-between">
            <h4 style="color: var(--text-main);" class="text-xs sm:text-sm font-extrabold uppercase tracking-wider flex items-center gap-1.5">
              <span>📌</span> 핵심 쟁점 및 상황 요약
            </h4>
            <span style="color: var(--text-muted);" class="text-xs">글로벌 데스크 브리핑</span>
          </div>
          <div style="background: var(--bg-inner-box); border-color: var(--border-subtle);" class="border rounded-xl p-4">
            <h5 id="modal-live-headline" class="text-sm sm:text-base font-bold text-blue-500 mb-2.5 leading-snug"></h5>
            <ul id="modal-live-summary" class="space-y-2 text-xs sm:text-sm leading-relaxed" style="color: var(--text-muted);"></ul>
          </div>
        </div>

        <!-- SECTION 2: 심층 배경 및 구조적 분석 -->
        <div style="border-color: var(--border-subtle);" class="space-y-2.5 pt-3 border-t">
          <div class="flex items-center justify-between">
            <h4 style="color: var(--text-main);" class="text-xs sm:text-sm font-extrabold uppercase tracking-wider flex items-center gap-1.5">
              <span>🔍</span> 심층 배경 & 거시적 영향 분석
            </h4>
            <span style="color: var(--text-muted);" class="text-xs font-medium">인사이트 리포트</span>
          </div>
          <div style="background: var(--bg-inner-box); border-color: var(--border-subtle);" class="border rounded-xl p-4">
            <h5 id="modal-deep-headline" class="text-sm sm:text-base font-bold text-indigo-400 mb-2 leading-snug"></h5>
            <ul id="modal-deep-summary" class="space-y-2 text-xs sm:text-sm leading-relaxed mb-3" style="color: var(--text-muted);"></ul>
            <p id="modal-deep-detail" style="color: var(--text-main);" class="text-xs sm:text-sm leading-relaxed pt-2.5 border-t border-slate-200 dark:border-slate-800"></p>
          </div>
        </div>

        <!-- SECTION 3: 기사 원문 및 언론사 출처 -->
        <div style="border-color: var(--border-subtle);" class="pt-3 border-t">
          <h4 style="color: var(--text-muted);" class="text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <span>🔗</span> 보도 출처 및 기사 원문
          </h4>
          <div id="modal-sources" class="space-y-2"></div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div style="background: var(--bg-surface-subtle); border-color: var(--border-subtle);" class="px-6 py-3.5 border-t flex items-center justify-between text-xs sm:text-sm">
        <button onclick="prevIssue()" style="background: var(--bg-surface); border-color: var(--border-subtle); color: var(--text-main);" class="px-3.5 py-1.5 rounded-lg border hover:bg-blue-600 hover:text-white flex items-center gap-1 font-bold transition shadow-sm">
          ◀ 이전
        </button>
        <span id="modal-pagination" style="color: var(--text-muted);" class="font-bold"></span>
        <button onclick="nextIssue()" style="background: var(--bg-surface); border-color: var(--border-subtle); color: var(--text-main);" class="px-3.5 py-1.5 rounded-lg border hover:bg-blue-600 hover:text-white flex items-center gap-1 font-bold transition shadow-sm">
          다음 ▶
        </button>
      </div>
    </div>
  </div>

  <!-- SCRIPT -->
  <script>
    const issuesData = ${JSON.stringify(integratedIssues)};

    let currentTheme = 'satellite';
    let activeFilter = 'all';
    let searchQuery = '';
    let currentIssueIndex = 0;
    let currentVisibleIssues = [];
    let selectedCountryId = null;

    // Map Pan/Zoom state
    let mapScale = 1;
    let mapTranslateX = 0;
    let mapTranslateY = 0;
    let isDragging = false;
    let startX, startY;
    let updateTransform;

    // Adaptive ViewBox state for full-height rendering
    let currentMinY = -80;
    let currentHeightY = 660;

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      // 1. Initialize Theme from localStorage (Default to Satellite '위성사진')
      const savedTheme = localStorage.getItem('world_map_theme') || 'satellite';
      setTheme(savedTheme);

      adjustLayout();
      setupMapInteractions();
      refreshDataView();
      setupCountryClicks();
      setupKeyboardNav();

      // 3-hour client refresh check
      const PAGE_LOAD_TIME = Date.now();
      setInterval(() => {
        if (Date.now() - PAGE_LOAD_TIME >= 3 * 60 * 60 * 1000) {
          console.log('[Auto-Refresh] 3시간 경과: 최신 뉴스 브리핑으로 새로고침합니다.');
          window.location.reload();
        }
      }, 5 * 60 * 1000);
    });

    // Theme Switcher Function (White / Dark / Satellite)
    function setTheme(theme) {
      currentTheme = theme;
      document.documentElement.setAttribute('data-theme', theme);
      try {
        localStorage.setItem('world_map_theme', theme);
      } catch(e) {}

      const satImg = document.getElementById('satellite-bg-img');
      const oceanRect = document.getElementById('ocean-bg-rect');

      if (theme === 'satellite') {
        if (satImg) satImg.style.display = 'block';
        if (oceanRect) oceanRect.style.display = 'none';
      } else {
        if (satImg) satImg.style.display = 'none';
        if (oceanRect) oceanRect.style.display = 'block';

        // Update SVG Ocean Gradient Colors for non-satellite modes
        const stop1 = document.getElementById('ocean-stop-1');
        const stop2 = document.getElementById('ocean-stop-2');
        if (stop1 && stop2) {
          if (theme === 'light') {
            stop1.setAttribute('stop-color', '#e0f2fe');
            stop1.setAttribute('stop-opacity', '0.85');
            stop2.setAttribute('stop-color', '#f1f5f9');
            stop2.setAttribute('stop-opacity', '1.0');
          } else { // Dark
            stop1.setAttribute('stop-color', '#111c33');
            stop1.setAttribute('stop-opacity', '0.6');
            stop2.setAttribute('stop-color', '#080c14');
            stop2.setAttribute('stop-opacity', '0.9');
          }
        }
      }

      // Update Theme Button Active States
      ['light', 'dark', 'satellite'].forEach(t => {
        const btn = document.getElementById('btn-theme-' + t);
        if (!btn) return;
        if (t === theme) {
          btn.className = 'px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs shadow transition flex items-center gap-1';
        } else {
          btn.className = 'px-2.5 py-1 rounded-lg text-slate-400 hover:text-blue-500 font-medium text-xs transition flex items-center gap-1';
        }
      });

      // Update category button styling according to theme
      updateCategoryButtonStyles();
    }

    function updateCategoryButtonStyles() {
      document.querySelectorAll('.filter-cat-btn').forEach(btn => {
        const cat = btn.getAttribute('data-cat');
        if (cat === activeFilter) {
          btn.classList.add('bg-blue-600', 'text-white', 'shadow-sm');
          btn.style.color = '#ffffff';
          btn.style.borderColor = 'transparent';
          btn.style.background = '#2563eb';
        } else {
          btn.classList.remove('bg-blue-600', 'text-white', 'shadow-sm');
          btn.style.background = 'transparent';
          btn.style.color = 'var(--text-main)';
          btn.style.borderColor = 'var(--border-subtle)';
        }
      });
    }

    function refreshDataView() {
      const countAll = issuesData.length;
      const countEcon = issuesData.filter(x => x.category === 'economy').length;
      const countPol = issuesData.filter(x => x.category === 'politics').length;
      const countEnv = issuesData.filter(x => x.category === 'environment').length;

      document.getElementById('filter-count-all').textContent = countAll;
      document.getElementById('filter-count-economy').textContent = countEcon;
      document.getElementById('filter-count-politics').textContent = countPol;
      document.getElementById('filter-count-environment').textContent = countEnv;

      renderMarkersAndLeaderLines();
      renderListView();
      updateMapModeIndicator();
    }

    function updateMapModeIndicator() {
      const indicator = document.getElementById('map-mode-indicator');
      if (!indicator) return;
      if (activeFilter === 'economy') {
        indicator.innerHTML = '<span>🔴 경제·테크 주요 동향 (' + issuesData.filter(x => x.category === 'economy').length + '개국)</span>';
      } else if (activeFilter === 'politics') {
        indicator.innerHTML = '<span>🔵 정치·외교 주요 동향 (' + issuesData.filter(x => x.category === 'politics').length + '개국)</span>';
      } else if (activeFilter === 'environment') {
        indicator.innerHTML = '<span>🟢 환경·재난 주요 동향 (' + issuesData.filter(x => x.category === 'environment').length + '개국)</span>';
      } else {
        indicator.innerHTML = '<span>🌐 전체 글로벌 주요 뉴스 (' + issuesData.length + '개국)</span>';
      }
    }

    // Select Country to filter feed and show comprehensive news pack
    function selectCountry(id) {
      selectedCountryId = id;

      // Highlight country SVG polygon
      const item = issuesData.find(x => x.id === id);
      document.querySelectorAll('.country').forEach(el => el.classList.remove('selected-country'));

      if (item && item.countryAliases) {
        document.querySelectorAll('.country').forEach(el => {
          const name = el.getAttribute('data-name');
          const code = el.getAttribute('data-code');
          if (item.countryAliases.includes(name) || item.countryAliases.includes(code)) {
            el.classList.add('selected-country');
          }
        });
      }

      focusItemOnMap(id);
      renderListView();

      // Mobile UX: auto switch to feed view if clicked on mobile
      if (window.innerWidth < 1024) {
        switchView('list');
      }
    }

    function clearCountryFilter() {
      selectedCountryId = null;
      document.querySelectorAll('.country').forEach(el => el.classList.remove('selected-country'));
      document.querySelectorAll('.marker-wrap').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.leader-line').forEach(el => el.classList.remove('active'));
      renderListView();
    }

    // Country Clicks on Map SVG
    function setupCountryClicks() {
      document.querySelectorAll('.country').forEach(pathEl => {
        pathEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const name = pathEl.getAttribute('data-name');
          const code = pathEl.getAttribute('data-code');

          // Find matching issue
          const matched = issuesData.find(item => {
            if (!item.countryAliases) return false;
            return item.countryAliases.includes(name) || item.countryAliases.includes(code);
          });

          if (matched) {
            selectCountry(matched.id);
          } else {
            clearCountryFilter();
          }
        });
      });

      // Clicking on ocean or background clears country filter
      const oceanBg = document.getElementById('ocean-bg-rect');
      if (oceanBg) {
        oceanBg.addEventListener('click', () => {
          if (selectedCountryId) clearCountryFilter();
        });
      }
      const satImg = document.getElementById('satellite-bg-img');
      if (satImg) {
        satImg.addEventListener('click', () => {
          if (selectedCountryId) clearCountryFilter();
        });
      }
    }

    // Render Markers & Leader Lines
    function renderMarkersAndLeaderLines() {
      const container = document.getElementById('markers-layer');
      const leaderLinesGroup = document.getElementById('leader-lines-group');
      
      container.innerHTML = '';
      leaderLinesGroup.innerHTML = '';

      currentVisibleIssues = issuesData.filter(item => {
        const matchesCategory = (activeFilter === 'all') || (item.category === activeFilter);
        const matchesSearch = !searchQuery || 
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
          item.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.live.detail.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.deepDive.detail.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      });

      currentVisibleIssues.forEach((item) => {
        const ax = item.anchorX;
        const ay = item.anchorY;
        const bx = item.bubbleX;
        const by = item.bubbleY;
        const color = item.color;

        const dx = bx - ax;
        const dy = by - ay;
        let pathD = '';
        if (Math.abs(dx) < 4 || Math.abs(dy) < 4) {
          pathD = 'M ' + ax.toFixed(1) + ' ' + ay.toFixed(1) + ' L ' + bx.toFixed(1) + ' ' + by.toFixed(1);
        } else {
          const cornerX = ax;
          const cornerY = by;
          pathD = 'M ' + ax.toFixed(1) + ' ' + ay.toFixed(1) + ' L ' + cornerX.toFixed(1) + ' ' + cornerY.toFixed(1) + ' L ' + bx.toFixed(1) + ' ' + by.toFixed(1);
        }

        const leaderGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        leaderGroup.id = 'leader-group-' + item.id;
        leaderGroup.innerHTML = 
          '<circle cx="' + ax + '" cy="' + ay + '" r="4" fill="none" stroke="' + color + '" stroke-width="1" vector-effect="non-scaling-stroke" opacity="0.75" />' +
          '<circle cx="' + ax + '" cy="' + ay + '" r="2" fill="' + color + '" stroke="#ffffff" stroke-width="0.8" vector-effect="non-scaling-stroke" />' +
          '<path id="line-' + item.id + '" class="leader-line" vector-effect="non-scaling-stroke" d="' + pathD + '" stroke="' + color + '" stroke-width="1.3" stroke-dasharray="2.5 1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.9" />';
        leaderLinesGroup.appendChild(leaderGroup);

        const marker = document.createElement('div');
        marker.className = 'marker-wrap pointer-events-auto';
        marker.id = 'marker-' + item.id;
        marker.style.left = (((item.bubbleX - 0) / 1000) * 100).toFixed(2) + '%';
        marker.style.top = (((item.bubbleY - currentMinY) / currentHeightY) * 100).toFixed(2) + '%';
        
        marker.onclick = (e) => {
          e.stopPropagation();
          selectCountry(item.id);
        };

        const bubbleClass = 'bubble-' + item.category;

        marker.innerHTML = 
          '<div class="speech-bubble ' + bubbleClass + '">' +
            '<span class="text-xs shrink-0">' + item.flag + '</span>' +
            '<span>' + item.shortTitle + '</span>' +
          '</div>';

        marker.addEventListener('mouseenter', () => {
          const pathEl = document.getElementById('line-' + item.id);
          if (pathEl) pathEl.classList.add('active');
        });
        marker.addEventListener('mouseleave', () => {
          const pathEl = document.getElementById('line-' + item.id);
          if (pathEl) pathEl.classList.remove('active');
        });

        container.appendChild(marker);
      });

      if (typeof updateTransform === 'function') {
        updateTransform();
      }
    }

    // Render List View: Comprehensive Country News Pack vs Global Feed (Larger, Readable Fonts)
    function renderListView() {
      const grid = document.getElementById('issues-grid');
      grid.innerHTML = '';

      const countEl = document.getElementById('list-total-count');
      const feedTitle = document.getElementById('list-feed-title');
      const feedAction = document.getElementById('feed-header-action');

      // CASE 1: SPECIFIC COUNTRY SELECTED (MULTI-ARTICLE NEWS PACK!)
      if (selectedCountryId) {
        const item = issuesData.find(x => x.id === selectedCountryId);
        if (!item) {
          selectedCountryId = null;
          renderListView();
          return;
        }

        const relatedCount = item.relatedNews ? item.relatedNews.length : 0;
        const totalCountryArticles = relatedCount + 1;

        feedTitle.innerHTML = '<span class="text-base">' + item.flag + '</span> <span class="font-extrabold">' + item.country + '</span> 종합 뉴스';
        countEl.textContent = '총 ' + totalCountryArticles + '건';

        feedAction.innerHTML = 
          '<button onclick="clearCountryFilter()" class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm">' +
            '<span>✕ 전체 국가 보기</span>' +
          '</button>';

        // 1. Primary Highlight Issue Card (Large, Clear Typography)
        const primaryCard = document.createElement('div');
        primaryCard.style.background = 'var(--bg-card)';
        primaryCard.style.borderColor = '#3b82f6';
        primaryCard.className = 'border-2 rounded-xl p-4 shadow-md mb-3 flex flex-col justify-between transition';
        
        let badgeStyle = 'background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);';
        if (item.category === 'politics') badgeStyle = 'background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3);';
        if (item.category === 'environment') badgeStyle = 'background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);';

        const liveBullets = item.live.summary.map(s => 
          '<li class="flex items-start gap-1.5 text-xs sm:text-sm leading-relaxed" style="color: var(--text-muted);">' +
            '<span class="text-blue-500 font-bold shrink-0">•</span>' +
            '<span>' + s + '</span>' +
          '</li>'
        ).join('');

        const mainArticleUrl = (item.live.sources && item.live.sources.length > 0 && item.live.sources[0].url)
          ? item.live.sources[0].url
          : '#';

        const articleBtn = (mainArticleUrl && mainArticleUrl !== '#')
          ? '<a href="' + mainArticleUrl + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="background: var(--bg-surface-subtle); border-color: var(--border-subtle); color: var(--text-main);" class="px-2.5 py-1.5 rounded-lg border hover:border-blue-500 hover:text-blue-500 text-xs font-bold transition inline-flex items-center gap-1.5 shadow-sm">' +
              '<span>🔗 기사 원문</span>' +
              '<span class="text-[10px] text-blue-500 font-extrabold">↗</span>' +
            '</a>'
          : '';

        primaryCard.innerHTML = 
          '<div>' +
            '<div class="flex items-center justify-between gap-1 mb-2">' +
              '<div class="flex items-center gap-1.5">' +
                '<span class="px-2 py-0.5 rounded bg-blue-600 text-white font-extrabold text-[10px] uppercase tracking-wider">' +
                  '⭐ 대표 이슈' +
                '</span>' +
                '<span style="' + badgeStyle + '" class="px-2 py-0.5 rounded-full text-xs font-bold">' +
                  item.categoryName +
                '</span>' +
              '</div>' +
              '<span style="color: var(--text-muted);" class="text-xs font-semibold">' + item.country + '</span>' +
            '</div>' +
            
            '<h3 style="color: var(--text-main);" class="text-sm sm:text-base font-extrabold leading-snug mb-2.5">' +
              '<a href="' + mainArticleUrl + '" target="_blank" rel="noopener noreferrer" class="hover:text-blue-500 hover:underline transition">' + item.title + '</a>' +
            '</h3>' +

            '<div style="background: var(--bg-inner-box); border-color: var(--border-subtle);" class="space-y-2 mb-3 p-3 rounded-xl border">' +
              '<ul class="space-y-1.5">' + liveBullets + '</ul>' +
              '<p style="color: var(--text-main);" class="text-xs sm:text-sm leading-relaxed pt-2 border-t border-slate-200 dark:border-slate-800 font-medium">' +
                '🔍 ' + item.deepDive.headline +
              '</p>' +
            '</div>' +
          '</div>' +

          '<div style="border-color: var(--border-subtle);" class="pt-2.5 border-t flex items-center justify-between">' +
            articleBtn +
            '<button onclick="openModalById(\\'' + item.id + '\\')" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm flex items-center gap-1">' +
              '<span>상세 보기</span>' +
              '<span>→</span>' +
            '</button>' +
          '</div>';
        grid.appendChild(primaryCard);

        // 2. Related News Section Header
        if (item.relatedNews && item.relatedNews.length > 0) {
          const sectionHeader = document.createElement('div');
          sectionHeader.style.borderColor = 'var(--border-subtle)';
          sectionHeader.className = 'pt-2 pb-1.5 flex items-center justify-between text-xs sm:text-sm font-bold border-b mb-2';
          sectionHeader.innerHTML = 
            '<span style="color: var(--text-main);" class="flex items-center gap-1.5 font-extrabold">' +
              '<span>📰</span> ' + item.country.split(' ')[0] + ' 관련 주요 기사 (' + item.relatedNews.length + '건)' +
            '</span>' +
            '<span style="color: var(--text-muted);" class="text-xs">현지 언론사 제공</span>';
          grid.appendChild(sectionHeader);

          // 3. Render Each Related News Card (Larger, Crisp Typography)
          item.relatedNews.forEach((news, idx) => {
            const relCard = document.createElement('div');
            relCard.style.background = 'var(--bg-card)';
            relCard.style.borderColor = 'var(--border-card)';
            relCard.className = 'border hover:border-blue-400 rounded-xl p-3.5 transition shadow-sm flex flex-col justify-between';
            relCard.innerHTML = 
              '<div>' +
                '<div class="flex items-center justify-between gap-1 mb-1.5">' +
                  '<div class="flex items-center gap-1.5">' +
                    '<span style="background: var(--bg-surface-subtle); color: var(--text-muted);" class="text-[11px] px-2 py-0.5 rounded font-bold">' +
                      '#' + (idx + 1) + ' ' + news.category +
                    '</span>' +
                    '<span class="text-xs font-bold text-blue-500 flex items-center gap-0.5">' +
                      '<span>📰</span> ' + news.media +
                    '</span>' +
                  '</div>' +
                  '<span style="color: var(--text-muted);" class="text-xs">' + news.time + '</span>' +
                '</div>' +
                
                '<h4 style="color: var(--text-main);" class="text-sm font-bold hover:text-blue-500 transition leading-snug mb-2">' +
                  '<a href="' + news.url + '" target="_blank" class="hover:underline">' + news.title + '</a>' +
                '</h4>' +

                '<p style="color: var(--text-muted);" class="text-xs sm:text-sm leading-relaxed mb-2.5">' +
                  news.summary +
                '</p>' +
              '</div>' +

              '<div style="border-color: var(--border-subtle);" class="pt-2 border-t flex items-center justify-end">' +
                '<a href="' + news.url + '" target="_blank" rel="noopener noreferrer" style="background: var(--bg-surface-subtle); border-color: var(--border-subtle); color: var(--text-main);" class="px-2.5 py-1 rounded-lg border hover:border-blue-500 hover:text-blue-500 text-xs font-bold transition inline-flex items-center gap-1 shadow-sm">' +
                  '<span>🔗 기사 원문</span>' +
                  '<span class="text-[10px] text-blue-500 font-extrabold">↗</span>' +
                '</a>' +
              '</div>';
            grid.appendChild(relCard);
          });
        }
        return;
      }

      // CASE 2: GLOBAL 23-COUNTRY FEED (Clean, Categorized, Large Typography)
      feedTitle.textContent = activeFilter === 'economy' ? '경제·테크 뉴스 피드' : (activeFilter === 'politics' ? '정치·외교 뉴스 피드' : (activeFilter === 'environment' ? '환경·재난 뉴스 피드' : '글로벌 주요 뉴스 피드'));
      countEl.textContent = currentVisibleIssues.length + '건';
      feedAction.innerHTML = '<span style="color: var(--text-muted);" class="text-xs font-medium hidden 2xl:inline">💡 지도 클릭 시 국가별 모음</span>';

      if (currentVisibleIssues.length === 0) {
        grid.innerHTML = '<div style="color: var(--text-muted);" class="py-16 text-center text-sm">해당 범주의 검색 결과가 없습니다.</div>';
        return;
      }

      currentVisibleIssues.forEach(item => {
        const card = document.createElement('div');
        card.id = 'card-' + item.id;
        card.style.background = 'var(--bg-card)';
        card.style.borderColor = 'var(--border-card)';
        card.className = 'border hover:border-blue-500 rounded-xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between';

        let badgeStyle = 'background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3);';
        if (item.category === 'politics') badgeStyle = 'background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3);';
        if (item.category === 'environment') badgeStyle = 'background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);';

        const liveBullets = item.live.summary.map(s => 
          '<li class="flex items-start gap-1.5 text-xs sm:text-sm leading-relaxed" style="color: var(--text-muted);">' +
            '<span class="text-blue-500 font-bold shrink-0">•</span>' +
            '<span>' + s + '</span>' +
          '</li>'
        ).join('');

        const deepInsight = item.deepDive.summary[0] || '';

        const mainArticleUrl = (item.live.sources && item.live.sources.length > 0 && item.live.sources[0].url)
          ? item.live.sources[0].url
          : '#';

        const articleBtn = (mainArticleUrl && mainArticleUrl !== '#')
          ? '<a href="' + mainArticleUrl + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="background: var(--bg-surface-subtle); border-color: var(--border-subtle); color: var(--text-main);" class="px-2.5 py-1.5 rounded-lg border hover:border-blue-500 hover:text-blue-500 text-xs font-bold transition inline-flex items-center gap-1.5 shadow-sm">' +
              '<span>🔗 기사 원문</span>' +
              '<span class="text-[10px] text-blue-500 font-extrabold">↗</span>' +
            '</a>'
          : '';

        card.innerHTML = 
          '<div>' +
            '<div class="flex items-center justify-between gap-1 mb-2">' +
              '<div class="flex items-center gap-1.5">' +
                '<span class="text-sm">' + item.flag + '</span>' +
                '<span style="color: var(--text-main);" class="font-extrabold text-xs sm:text-sm">' + item.country + '</span>' +
                '<span style="' + badgeStyle + '" class="text-[11px] px-2 py-0.5 rounded-full font-bold ml-1">' +
                  item.categoryName +
                '</span>' +
              '</div>' +
              '<span style="color: var(--text-muted);" class="text-xs font-semibold">' + (item.relatedNews ? (item.relatedNews.length + 1) + '개 기사' : '1건') + '</span>' +
            '</div>' +

            '<h3 style="color: var(--text-main);" class="text-sm sm:text-base font-extrabold group-hover:text-blue-500 transition leading-snug mb-2.5">' +
              item.title +
            '</h3>' +

            '<div style="background: var(--bg-inner-box); border-color: var(--border-subtle);" class="space-y-2 mb-3 p-3 rounded-xl border">' +
              '<ul class="space-y-1.5">' + liveBullets + '</ul>' +
              (deepInsight ? '<p style="color: var(--text-main);" class="text-xs sm:text-sm leading-relaxed pt-2 border-t border-slate-200 dark:border-slate-800 font-medium">🔍 ' + deepInsight + '</p>' : '') +
            '</div>' +
          '</div>' +

          '<div style="border-color: var(--border-subtle);" class="pt-2.5 border-t flex items-center justify-between">' +
            articleBtn +
            '<button onclick="event.stopPropagation(); selectCountry(\\'' + item.id + '\\')" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm flex items-center gap-1">' +
              '<span>상세 보기</span>' +
              '<span>→</span>' +
            '</button>' +
          '</div>';

        card.onclick = () => selectCountry(item.id);
        card.onmouseenter = () => highlightItemOnMap(item.id, true);
        card.onmouseleave = () => highlightItemOnMap(item.id, false);

        grid.appendChild(card);
      });
    }

    // Highlight item on map hover
    function highlightItemOnMap(id, active) {
      const marker = document.getElementById('marker-' + id);
      const line = document.getElementById('line-' + id);
      if (marker) {
        if (active) marker.classList.add('active');
        else marker.classList.remove('active');
      }
      if (line) {
        if (active) line.classList.add('active');
        else line.classList.remove('active');
      }
    }

    // Focus Item on map: NO yellow box!
    function focusItemOnMap(id) {
      highlightItemOnMap(id, true);
    }

    // Detail Modal Functions
    function openModalById(id) {
      const item = issuesData.find(x => x.id === id);
      if (item) {
        currentIssueIndex = currentVisibleIssues.findIndex(x => x.id === id);
        if (currentIssueIndex === -1) currentIssueIndex = 0;
        openModal(item);
      }
    }

    function openModal(item) {
      document.getElementById('modal-title').textContent = item.title;
      document.getElementById('modal-country').innerHTML = item.flag + ' ' + item.country;
      
      const badge = document.getElementById('modal-badge');
      badge.textContent = item.categoryName;
      if (item.category === 'economy') {
        badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/15 text-rose-500 border border-rose-500/30';
      } else if (item.category === 'politics') {
        badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/15 text-blue-500 border border-blue-500/30';
      } else {
        badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-500 border border-emerald-500/30';
      }

      // Highlights Section Population
      document.getElementById('modal-live-headline').textContent = item.live.headline;
      const liveSummaryList = document.getElementById('modal-live-summary');
      liveSummaryList.innerHTML = item.live.summary.map(s => 
        '<li class="flex items-start gap-2">' +
          '<span class="text-blue-500 font-bold shrink-0">•</span>' +
          '<span>' + s + '</span>' +
        '</li>'
      ).join('');

      // In-depth Analysis Section Population
      document.getElementById('modal-deep-headline').textContent = item.deepDive.headline;
      const deepSummaryList = document.getElementById('modal-deep-summary');
      deepSummaryList.innerHTML = item.deepDive.summary.map(s => 
        '<li class="flex items-start gap-2">' +
          '<span class="text-indigo-400 font-bold shrink-0">•</span>' +
          '<span>' + s + '</span>' +
        '</li>'
      ).join('');
      document.getElementById('modal-deep-detail').textContent = item.deepDive.detail;

      // Combined Sources: 기사 원문 및 관련 보도 출처
      const sourcesDiv = document.getElementById('modal-sources');
      let sourcesHtml = '';
      
      if (item.live.sources && item.live.sources.length > 0) {
        sourcesHtml += item.live.sources.map(src => 
          '<a href="' + src.url + '" target="_blank" rel="noopener noreferrer" style="background: var(--bg-inner-box); border-color: var(--border-subtle); color: var(--text-main);" class="flex items-center justify-between p-2.5 rounded-xl border hover:border-blue-500 text-xs sm:text-sm transition group">' +
            '<span class="flex items-center gap-2">' +
              '<span>🔗</span>' +
              '<span class="font-bold group-hover:underline">기사 원문: ' + src.title + '</span>' +
              '<span style="color: var(--text-muted);" class="text-xs">(' + src.media + ')</span>' +
            '</span>' +
            '<span class="text-blue-500 font-bold">↗</span>' +
          '</a>'
        ).join('');
      }

      if (item.relatedNews && item.relatedNews.length > 0) {
        sourcesHtml += item.relatedNews.map(rel => 
          '<a href="' + rel.url + '" target="_blank" rel="noopener noreferrer" style="background: var(--bg-inner-box); border-color: var(--border-subtle); color: var(--text-main);" class="flex items-center justify-between p-2.5 rounded-xl border hover:border-blue-500 text-xs sm:text-sm transition group">' +
            '<span class="flex items-center gap-2">' +
              '<span>📰</span>' +
              '<span class="font-bold group-hover:underline">' + rel.title + '</span>' +
              '<span style="color: var(--text-muted);" class="text-xs">(' + rel.media + ')</span>' +
            '</span>' +
            '<span class="text-blue-500 font-bold">↗</span>' +
          '</a>'
        ).join('');
      }

      sourcesDiv.innerHTML = sourcesHtml || '<div style="color: var(--text-muted);" class="text-xs">등록된 관련 출처가 없습니다.</div>';

      document.getElementById('modal-pagination').textContent = (currentIssueIndex + 1) + ' / ' + currentVisibleIssues.length;

      document.body.classList.add('modal-open');
      document.getElementById('detail-modal').classList.remove('hidden');
    }

    function closeModal() {
      document.body.classList.remove('modal-open');
      document.getElementById('detail-modal').classList.add('hidden');
    }

    function handleBackdropClick(event) {
      if (event.target.id === 'detail-modal') {
        closeModal();
      }
    }

    function prevIssue() {
      if (currentVisibleIssues.length === 0) return;
      currentIssueIndex = (currentIssueIndex - 1 + currentVisibleIssues.length) % currentVisibleIssues.length;
      openModal(currentVisibleIssues[currentIssueIndex]);
      focusItemOnMap(currentVisibleIssues[currentIssueIndex].id);
    }

    function nextIssue() {
      if (currentVisibleIssues.length === 0) return;
      currentIssueIndex = (currentIssueIndex + 1) % currentVisibleIssues.length;
      openModal(currentVisibleIssues[currentIssueIndex]);
      focusItemOnMap(currentVisibleIssues[currentIssueIndex].id);
    }

    // Category Filter Function
    function setCategoryFilter(cat) {
      activeFilter = cat;
      updateCategoryButtonStyles();
      refreshDataView();
    }

    // Search Input
    function handleSearch(val) {
      searchQuery = val.trim();
      renderMarkersAndLeaderLines();
      renderListView();
    }

    // View Switcher (Mobile)
    function switchView(view) {
      const mapView = document.getElementById('view-map');
      const listView = document.getElementById('view-list');
      const btnMap = document.getElementById('btn-view-map');
      const btnList = document.getElementById('btn-view-list');

      if (view === 'map') {
        mapView.classList.remove('hidden');
        mapView.classList.add('flex');
        listView.classList.add('hidden');
        listView.classList.remove('flex');

        btnMap.className = 'px-2.5 py-1 rounded-lg bg-blue-600 text-white shadow-sm flex items-center gap-1 transition';
        btnList.className = 'px-2.5 py-1 rounded-lg text-slate-400 hover:text-blue-500 flex items-center gap-1 transition';
      } else {
        mapView.classList.add('hidden');
        mapView.classList.remove('flex');
        listView.classList.remove('hidden');
        listView.classList.add('flex');

        btnList.className = 'px-2.5 py-1 rounded-lg bg-blue-600 text-white shadow-sm flex items-center gap-1 transition';
        btnMap.className = 'px-2.5 py-1 rounded-lg text-slate-400 hover:text-blue-500 flex items-center gap-1 transition';
      }
    }

    // Keyboard Navigation
    function setupKeyboardNav() {
      document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('detail-modal');
        const isOpen = !modal.classList.contains('hidden');

        if (e.key === 'Escape') {
          if (isOpen) closeModal();
          else if (selectedCountryId) clearCountryFilter();
        } else if (isOpen && (e.key === 'ArrowLeft' || e.key === 'Left')) {
          prevIssue();
        } else if (isOpen && (e.key === 'ArrowRight' || e.key === 'Right')) {
          nextIssue();
        }
      });
    }

    // Dynamic Layout Synchronization: Option A - Map & Feed fill 100% vertical height, zero empty space
    function adjustLayout() {
      const main = document.querySelector('main');
      const map = document.getElementById('view-map');
      const list = document.getElementById('view-list');
      const svg = document.getElementById('world-svg');
      const ocean = document.getElementById('ocean-bg-rect');
      const sat = document.getElementById('satellite-bg-img');
      if (!main || !map) return;

      const isDesktop = window.innerWidth >= 1024;
      if (!isDesktop) {
        map.style.width = '100%';
        map.style.height = '';
        map.style.aspectRatio = '1000 / 660';
        if (list) {
          list.style.width = '100%';
          list.style.height = '';
        }
        return;
      }

      // Ensure both map and list are visible on desktop
      map.classList.remove('hidden');
      if (list) {
        list.classList.remove('hidden');
        list.classList.add('lg:flex');
      }

      // Option A: 100% vertical height fill for both cards
      map.style.width = '';
      map.style.height = '100%';
      map.style.aspectRatio = '';
      if (list) {
        list.style.width = '';
        list.style.height = '100%';
      }

      // Adaptive ViewBox calculation to guarantee 0 letterboxing
      const cw = map.clientWidth;
      const ch = map.clientHeight;
      if (cw > 0 && ch > 0 && svg) {
        const R = cw / ch;
        currentHeightY = 1000 / R;
        currentMinY = 250 - currentHeightY / 2;

        svg.setAttribute('viewBox', '0 ' + currentMinY.toFixed(1) + ' 1000 ' + currentHeightY.toFixed(1));
        if (ocean) {
          ocean.setAttribute('y', currentMinY.toFixed(1));
          ocean.setAttribute('height', currentHeightY.toFixed(1));
        }
        if (sat) {
          sat.setAttribute('y', currentMinY.toFixed(1));
          sat.setAttribute('height', currentHeightY.toFixed(1));
        }

        // Keep markers locked to geographic coordinates
        document.querySelectorAll('.marker-wrap').forEach(el => {
          const id = el.id.replace('marker-', '');
          const item = issuesData.find(x => x.id === id);
          if (item) {
            const topPct = (((item.bubbleY - currentMinY) / currentHeightY) * 100).toFixed(2);
            el.style.top = topPct + '%';
          }
        });
      }
    }

    // Map Pan / Zoom Interactions (Min scale locked at 1.0, natural zoom scaling)
    function setupMapInteractions() {
      const container = document.getElementById('map-canvas');
      const stage = document.getElementById('map-stage');
      const svg = document.getElementById('world-svg');
      const markersLayer = document.getElementById('markers-layer');

      adjustLayout();
      window.addEventListener('resize', adjustLayout);

      updateTransform = function() {
        if (mapScale <= 1.0) {
          mapScale = 1.0;
          mapTranslateX = 0;
          mapTranslateY = 0;
        }
        const transformStr = 'translate(' + mapTranslateX + 'px, ' + mapTranslateY + 'px) scale(' + mapScale + ')';
        if (stage) {
          stage.style.transform = transformStr;
          stage.style.transformOrigin = 'center center';
        }

        // Maintain crisp, constant stroke width for leader lines
        document.querySelectorAll('.leader-line').forEach(el => {
          el.setAttribute('stroke-width', (1.2 / mapScale).toFixed(2));
        });

        // Map cursor feedback
        if (container) {
          container.style.cursor = mapScale > 1.0 ? (isDragging ? 'grabbing' : 'grab') : 'default';
        }

        // Zoom out button state: disabled at minimum zoom (1.0)
        const btnMinus = document.getElementById('btn-zoom-out');
        if (btnMinus) {
          if (mapScale <= 1.0) {
            btnMinus.classList.add('opacity-40', 'cursor-not-allowed');
            btnMinus.classList.remove('hover:bg-slate-200', 'hover:text-blue-600');
          } else {
            btnMinus.classList.remove('opacity-40', 'cursor-not-allowed');
            btnMinus.classList.add('hover:bg-slate-200', 'hover:text-blue-600');
          }
        }
      };

      window.zoomMap = function(factor) {
        const newScale = mapScale * factor;
        if (newScale <= 1.01) {
          mapScale = 1.0;
          mapTranslateX = 0;
          mapTranslateY = 0;
        } else {
          mapScale = Math.min(newScale, 4.0);
        }
        updateTransform();
      };

      window.resetZoom = function() {
        mapScale = 1.0;
        mapTranslateX = 0;
        mapTranslateY = 0;
        updateTransform();
      };

      // Mouse drag pan (locked at mapScale = 1.0)
      container.addEventListener('mousedown', (e) => {
        if (e.target.closest('.marker-wrap') || e.target.closest('button')) return;
        if (mapScale <= 1.0) return;
        isDragging = true;
        startX = e.clientX - mapTranslateX;
        startY = e.clientY - mapTranslateY;
        container.style.cursor = 'grabbing';
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging || mapScale <= 1.0) return;
        const maxPanX = (container.clientWidth * (mapScale - 1)) / 1.8 + 60;
        const maxPanY = (container.clientHeight * (mapScale - 1)) / 1.8 + 60;
        let nextX = e.clientX - startX;
        let nextY = e.clientY - startY;
        mapTranslateX = Math.max(-maxPanX, Math.min(maxPanX, nextX));
        mapTranslateY = Math.max(-maxPanY, Math.min(maxPanY, nextY));
        updateTransform();
      });

      window.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          if (container) container.style.cursor = mapScale > 1.0 ? 'grab' : 'default';
        }
      });

      // Mouse wheel zoom
      container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1.15 : 0.85;
        window.zoomMap(delta);
      }, { passive: false });

      // Mobile Touch pan & pinch zoom
      let initialDistance = null;
      let initialScale = 1;
      let touchStartX = 0, touchStartY = 0;

      container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          if (mapScale <= 1.0) return;
          isDragging = true;
          touchStartX = e.touches[0].clientX - mapTranslateX;
          touchStartY = e.touches[0].clientY - mapTranslateY;
        } else if (e.touches.length === 2) {
          isDragging = false;
          initialDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          initialScale = mapScale;
        }
      }, { passive: true });

      container.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && isDragging && mapScale > 1.0) {
          const maxPanX = (container.clientWidth * (mapScale - 1)) / 1.8 + 60;
          const maxPanY = (container.clientHeight * (mapScale - 1)) / 1.8 + 60;
          let nextX = e.touches[0].clientX - touchStartX;
          let nextY = e.touches[0].clientY - touchStartY;
          mapTranslateX = Math.max(-maxPanX, Math.min(maxPanX, nextX));
          mapTranslateY = Math.max(-maxPanY, Math.min(maxPanY, nextY));
          updateTransform();
        } else if (e.touches.length === 2 && initialDistance) {
          const currentDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          const factor = currentDistance / initialDistance;
          const targetScale = initialScale * factor;
          if (targetScale <= 1.01) {
            mapScale = 1.0;
            mapTranslateX = 0;
            mapTranslateY = 0;
          } else {
            mapScale = Math.min(targetScale, 4.0);
          }
          updateTransform();
        }
      }, { passive: true });

      container.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) initialDistance = null;
        if (e.touches.length === 0) {
          isDragging = false;
          if (container) container.style.cursor = mapScale > 1.0 ? 'grab' : 'default';
        }
      }, { passive: true });

      updateTransform();
    }
  </script>
</body>
</html>`;

  const outputPath = path.join(__dirname, 'index.html');
  fs.writeFileSync(outputPath, htmlContent);
  console.log('5. Successfully regenerated index.html at: ' + outputPath);

  const artifactPath = 'C:\\Users\\NON\\.gemini\\antigravity\\brain\\956543a9-9f62-40e4-bc9b-6a64f68f0acf\\world_issue_map.html';
  if (fs.existsSync(path.dirname(artifactPath))) {
    fs.writeFileSync(artifactPath, htmlContent);
    console.log('6. Also updated artifact at: ' + artifactPath);
  }
}

main().catch(console.error);
