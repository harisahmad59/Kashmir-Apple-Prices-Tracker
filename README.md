# Kashmir Apple Prices Dashboard

A lightweight web dashboard showing current (scraped + fallback) retail / wholesale indicative prices for key Kashmiri apple mandis along with a live news feed. Includes a Node.js/Express backend that scrapes public commodity sources and a static frontend (HTML/CSS/JS) consuming those APIs with graceful fallbacks.

## Features

- Four mandi sections: Shopian, Sopore, Delhi (Azadpur), Mumbai.
- Variety cards with box price (derived from scraped per‑kg/quintal ranges).
- Mock-first hydration for instant UI; replaced by live data when available.
- Robust scraper with layered fallbacks (variety table → summary averages → mock dataset) guaranteeing non-null prices.
- Exponential retry/backoff in the frontend fetch logic.
- Live Kashmir apple news via GNews API (simple client call).
- In‑memory caching (TTL) to reduce repeated scraping load.
- Clean modular scraper: parsing, normalization, and conversion (kg ↔ quintal ↔ box).
- Structured logging with Pino; optional debug via `SCRAPE_DEBUG=1`.

## Repo Structure

```
root/
  index.html          # Main dashboard UI
  submit.html         # Secondary form page (static placeholder)
  style.css           # Core styling + skeleton loaders
  script.js           # Frontend logic (prices + news + retries)
  Assets/             # Images / logos
  server/
    package.json
    src/
      index.js        # Express app + endpoints
      scraper.js      # Scraping & fallback logic
      cache.js        # Simple TTL cache
      logger.js       # Pino logger wrapper
```

## Data Flow Overview

1. Browser loads with static cards (seed/dummy prices).
2. Frontend immediately calls backend with `mock=1` for guaranteed fast data.
3. Then it requests live (`/api/prices/:mandi`) with retries.
4. Backend attempts real scrape; if all real prices fail → fills via summary → if still null → injects mock dataset so UI always shows numbers.
5. Frontend updates cards; on failure restores original static values (no permanent warning icons).

## Running Locally

### Prerequisites

- Node.js 18+ (for native fetch & modern syntax)

### Install & Run Backend

```bash
cd server
npm install
node src/index.js
```

Backend defaults to: `http://localhost:4000`.

### Open Frontend

Just open `index.html` in your browser (double click or serve via any static server). If served from a different origin, ensure CORS is allowed (current backend sets permissive headers).

## Environment Variables

| Variable       | Purpose                              | Default |
| -------------- | ------------------------------------ | ------- |
| `PORT`         | Express server port                  | 4000    |
| `SCRAPE_DEBUG` | Extra verbose scrape logs            | off     |
| `AUTO_MOCK`    | Force mock dataset (bypass scraping) | off     |

Usage example:

```bash
SCRAPE_DEBUG=1 node src/index.js
```

(Windows PowerShell: `$env:SCRAPE_DEBUG=1; node src/index.js`)

## API Endpoints

`GET /api/prices/:mandi`
Query params:

- `fresh=1` bypass cache.
- `mock=1` force mock dataset path.

Response shape:

```json
{
  "mandi": "shopian",
  "fresh": true,
  "mock": false,
  "rows": [
    { "variety": "Delicious", "avgPerQuintal": 2100, "pricePerBox": 315 },
    { "variety": "Kullu", "avgPerQuintal": 1900, "pricePerBox": 285 }
  ],
  "updated": "2025-09-24T09:35:10.123Z"
}
```

`pricePerBox` is derived via: `avgPerQuintal * 0.15` (assuming ~15kg per box).

## Scraping Notes

- Primary source: public commodity listing pages (CommodityOnline) per mandi.
- Attempts to parse detailed variety table; if missing, parses summary average and expands to core varieties.
- Sanitizes text, averages ranges (e.g. `₹160 – ₹180` → 170) and converts units.
- If all parsing yields nulls, mock dataset ensures UI continuity.

## Frontend Resilience

- Exponential backoff (4 attempts) with jitter and per-attempt timeout.
- Restores initial static text if first real fetch fails (no permanent "⚠").
- Future improvement: surface a badge when mock data is displayed (backend can expose a `fallback` flag).

## Development Tips

```bash
# Kill anything on the default port (Linux/macOS WSL)
fuser -k 4000/tcp 2>/dev/null || echo ""

# Force fresh scrape bypassing cache
curl "http://localhost:4000/api/prices/shopian?fresh=1"

# Force mock path
curl "http://localhost:4000/api/prices/shopian?mock=1"
```
