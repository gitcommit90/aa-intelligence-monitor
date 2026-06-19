# AA Intelligence Monitor

A beautiful, real-time terminal-style dashboard for [Artificial Analysis](https://artificialanalysis.ai/) model rankings.

Built as a FOSS tool to explore Intelligence, Coding, and Agentic indices with live movement tracking, provider coloring, pricing, and more.

## Demo

![AA Intelligence Monitor demo](docs/img/demo.gif)

## Screenshots

**Intelligence index**

![Intelligence index view](docs/img/intelligence.png)

**Coding index**

![Coding index view](docs/img/coding.png)

## Features

- **Live auto-refresh** every 30 minutes
- **Three metric tabs**: Intelligence, Coding, Agentic
- **Per-provider colors** (deterministic palette hashed from creator name)
- **All three scores shown on every card** with current tab highlighted
- **Movement indicators** (▲/▼ rank change vs. the previous refresh, per metric)
- **Pricing information** where available
- **Responsive** (works great on mobile)
- **CRT/phosphor terminal aesthetic** with boot sequence
- **Search** that preserves original global rankings
- **Disk-backed cache** so data survives restarts

## How it works

The server fetches the official Artificial Analysis language models API
(`https://artificialanalysis.ai/api/v2/language/models/free`) with `AA_API_KEY`,
uses the published `evaluations.artificial_analysis_*_index` fields for
Intelligence, Coding, and Agentic tabs, and normalizes pricing. The latest snapshot
is written to `models-cache.json` and reloaded on startup.

## Setup

1. Clone this repo
2. Export `AA_API_KEY` and optionally override the port:
   ```env
   AA_API_KEY=...
   PORT=1149
   ```
3. Run it (no dependencies to install — uses only Node built-ins):
   ```bash
   node server.js
   ```

Or use the systemd service file included.

## Tech

- Node.js core `http` server (no Express, no third-party deps, no build step)
- Pure HTML/CSS/JS frontend
- Data source: official AA API (`/api/v2/language/models/free`) index fields

## Endpoints

- `GET /` — the dashboard UI
- `GET /api/models` — current enriched snapshot (scores, rank deltas, provider colors)

## License

MIT - do whatever you want with it.

Made with love for the AI community. Feedback welcome.
