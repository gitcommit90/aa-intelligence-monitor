# AA Intelligence Monitor

A real-time dashboard for [Artificial Analysis](https://artificialanalysis.ai/) model rankings — Intelligence, Coding, and Agentic indices with movement tracking, provider coloring, and pricing.

**Live:** [https://aa.rerouted.dev](https://aa.rerouted.dev)

## Demo

![AA Intelligence Monitor demo](docs/img/demo.gif)

Open the [live dashboard](https://aa.rerouted.dev) for the current rankings.

## Screenshots

**Intelligence index**

![Intelligence index view](docs/img/intelligence.png)

**Coding index**

![Coding index view](docs/img/coding.png)

## Features

- **Live auto-refresh** — server syncs every 30 minutes; the UI polls `/api/models` every 2 minutes
- **Three metric tabs** — Intelligence, Coding, Agentic (keyboard `1` / `2` / `3`)
- **Mission-control layout** — telemetry rail, top-3 podium, score distribution, and biggest movers
- **Grid and list views** — toggle with toolbar buttons or `g` / `l`
- **Sort options** — rank, name, price, speed, latency, release date, movement
- **Per-provider colors** — deterministic palette hashed from creator name; filter via legend, chips, or sidebar
- **All three scores on every card** — current tab highlighted; circular gauge for active metric
- **Movement indicators** — ▲/▼ rank change vs. the previous server refresh, per metric
- **Pricing and throughput** — input/output $/M tokens, tokens/s, latency where available
- **Search** — filter models and providers (`/` to focus); preserves original global rankings
- **Boot sequence** — skippable typed startup overlay (any key or click)
- **CRT polish** — scanlines, vignette flicker, animated grid background (JetBrains Mono UI + VT323 display type)
- **Status chrome** — UTC mission clock, LIVE/SYNC badge, tier badge, refresh countdown ring, system ticker
- **Infinite scroll** — batched card rendering with intersection observer
- **Responsive** — three-column deck collapses on tablet/mobile; right rail hides on narrower viewports
- **Disk-backed cache** — `models-cache.json` survives restarts

## How it works

The server fetches the official Artificial Analysis language models API:

```http
GET https://artificialanalysis.ai/api/v2/language/models/free?page=N
x-api-key: $AA_API_KEY
```

`AA_API_KEY` is read from `process.env.AA_API_KEY`; do not hardcode API keys in
source. The endpoint is paginated, so the server requests pages until the API
reports no more results.

Tab scores come directly from the official API response fields:

- **Intelligence**: `evaluations.artificial_analysis_intelligence_index`
- **Coding**: `evaluations.artificial_analysis_coding_index`
- **Agentic**: `evaluations.artificial_analysis_agentic_index`

The API currently returns `intelligence_index_version` (for example, `4.1`).
Coding and Agentic are Artificial Analysis subsets and are not separately
versioned by this app. The dashboard does not scrape the AA web UI for model or
tab data, and it does not synthesize local/proxy fallback scores such as
`livecodebench` for Coding or `ifbench`/`lcr`/`terminalbench`/`tau` for Agentic.

Pricing and creator metadata are normalized for display. The latest snapshot is
written to `models-cache.json` and reloaded on startup.

## Setup

1. Clone this repo.
2. Export `AA_API_KEY` and optionally override the port:
   ```env
   AA_API_KEY=...
   PORT=1149
   ```
3. Run it (no dependencies to install — uses only Node built-ins):
   ```bash
   node server.js
   ```

The server listens on `process.env.PORT || 1149`. It refreshes immediately on
startup, then every 30 minutes, and serves the most recent cached snapshot while
new refreshes are in progress.

## Validation

Run local checks before committing changes:

```bash
npm test
node -c aa-source.js
node -c server.js
graphify update .
```

## Tech

- Node.js core `http` server (no Express, no third-party deps, no build step)
- Single-file HTML/CSS/JS frontend (`index.html`) — JetBrains Mono for UI, VT323 for headings and numeric display
- Data source: official paginated AA API (`/api/v2/language/models/free`) index fields

## Endpoints

- `GET /` — the dashboard UI
- `GET /api/models` — current enriched snapshot (scores, rank deltas, provider colors)

## License

MIT - do whatever you want with it.

Made with love for the AI community. Feedback welcome.