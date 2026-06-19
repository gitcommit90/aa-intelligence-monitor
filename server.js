const http = require('http');
const fs = require('fs');
const path = require('path');

const { fetchMonitorSnapshot } = require('./aa-source');

const port = Number(process.env.PORT || 1149);
const cacheFile = path.join(__dirname, 'models-cache.json');

let currentSnapshot = null;
let previousSnapshot = null;
let lastRefresh = null;
let isRefreshing = false;
let apiTier = 'unknown';
let intelligenceVersion = null;

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function fetchFromAA() {
  const fresh = await fetchMonitorSnapshot();
  apiTier = fresh.tier || 'unknown';
  intelligenceVersion = fresh.intelligence_index_version || null;
  return fresh;
}

function computeDeltas(current, previous, metricField) {
  if (!previous || !previous.models) return new Map();

  const prevRank = new Map();
  const currRank = new Map();

  const getScore = (model, field) => {
    const evals = model.evaluations || {};
    const value = evals[field];
    if (value !== undefined && value !== null) return value;
    return null;
  };

  previous.models
    .filter((m) => getScore(m, metricField) !== null)
    .sort((a, b) => (getScore(b, metricField) || 0) - (getScore(a, metricField) || 0))
    .forEach((m, i) => prevRank.set(m.id, i + 1));

  current.models
    .filter((m) => getScore(m, metricField) !== null)
    .sort((a, b) => (getScore(b, metricField) || 0) - (getScore(a, metricField) || 0))
    .forEach((m, i) => currRank.set(m.id, i + 1));

  const deltas = new Map();
  for (const [id, rank] of currRank) {
    if (prevRank.has(id)) {
      const delta = prevRank.get(id) - rank;
      if (delta !== 0) deltas.set(id, delta);
    }
  }
  return deltas;
}

async function refresh() {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    log('Refreshing from Artificial Analysis language models API...');
    const fresh = await fetchFromAA();

    previousSnapshot = currentSnapshot;
    currentSnapshot = fresh;
    lastRefresh = fresh.updatedAt;

    fs.writeFileSync(
      cacheFile,
      JSON.stringify({
        snapshot: currentSnapshot,
        previousSnapshot,
        lastRefresh,
        tier: apiTier,
        intelligence_index_version: intelligenceVersion,
      }),
    );

    log(`Refresh complete. ${fresh.models.length} models | Tier: ${apiTier} | Index v${intelligenceVersion}`);
  } catch (err) {
    log(`Refresh failed: ${err.message}`);
  } finally {
    isRefreshing = false;
  }
}

function getPublicSnapshot() {
  if (!currentSnapshot || !currentSnapshot.models || currentSnapshot.models.length === 0) {
    return { error: 'No data yet' };
  }

  const intelligenceDeltas = computeDeltas(currentSnapshot, previousSnapshot, 'artificial_analysis_intelligence_index');
  const codingDeltas = computeDeltas(currentSnapshot, previousSnapshot, 'artificial_analysis_coding_index');
  const agenticDeltas = computeDeltas(currentSnapshot, previousSnapshot, 'artificial_analysis_agentic_index');

  const enrichedModels = currentSnapshot.models.map((model) => {
    const providerColor = getProviderColor(model.creator || model.model_creator?.name || '');
    return {
      ...model,
      rankDeltaIntelligence: intelligenceDeltas.get(model.id) ?? null,
      rankDeltaCoding: codingDeltas.get(model.id) ?? null,
      rankDeltaAgentic: agenticDeltas.get(model.id) ?? null,
      providerColor,
    };
  });

  return {
    models: enrichedModels,
    lastRefresh,
    tier: currentSnapshot.tier || apiTier,
    intelligence_index_version: currentSnapshot.intelligence_index_version || intelligenceVersion,
    modelCount: enrichedModels.length,
  };
}

function getProviderColor(name) {
  if (!name) return '#888';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#2f5a5e', '#b45f2e', '#5c3d7a', '#3d6b4f', '#8b4d3f', '#4a5d8a', '#6b5d3d', '#5d4a7a'];
  return colors[Math.abs(hash) % colors.length];
}

// Load cache
try {
  const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  if (cached.snapshot) {
    currentSnapshot = cached.snapshot;
    previousSnapshot = cached.previousSnapshot || null;
    lastRefresh = cached.lastRefresh;
    apiTier = cached.tier || 'unknown';
    intelligenceVersion = cached.intelligence_index_version || null;
    log(`Loaded cache | Tier: ${apiTier} | Index v${intelligenceVersion}${previousSnapshot ? ' | prev snapshot present' : ''}`);
  }
} catch (e) {}

// Initial fetch
refresh();
setInterval(refresh, 30 * 60 * 1000);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/models') {
    return sendJson(res, 200, getPublicSnapshot());
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
  }

  if (url.pathname === '/favicon.svg') {
    res.writeHead(200, { 'content-type': 'image/svg+xml' });
    return res.end(fs.readFileSync(path.join(__dirname, 'favicon.svg')));
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(port, () => {
  log(`AA Rich Intelligence Index running on port ${port}`);
  log('Using official AA API source • Auto-refresh every 30 minutes');
});
