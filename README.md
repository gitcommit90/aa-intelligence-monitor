# AA Intelligence Monitor

A beautiful, real-time terminal-style dashboard for [Artificial Analysis](https://artificialanalysis.ai/) model rankings.

Built as a FOSS tool to explore Intelligence, Coding, and Agentic indices with live movement tracking, provider coloring, pricing, and more.

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

No API key required. The server fetches the public Artificial Analysis models page
(`https://artificialanalysis.ai/models`), extracts the embedded `defaultData` model
array from the HTML, and normalizes it into intelligence/coding/agentic scores plus
pricing. The latest snapshot is written to `models-cache.json` and reloaded on startup.

## Setup

1. Clone this repo
2. (Optional) Create a `.env` file to override the port:
   ```env
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
- Data source: scraped from the public AA models page (`/models`), not the API

## Endpoints

- `GET /` — the dashboard UI
- `GET /api/models` — current enriched snapshot (scores, rank deltas, provider colors)

## License

MIT - do whatever you want with it.

Made with love for the AI community. Feedback welcome.
