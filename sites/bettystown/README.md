# Mom's Bettystown Weather

Warm, low-rain beach-walk planner for **Mom & Max** at Bettystown, County Meath.

## URLs

| URL | Purpose |
|-----|---------|
| https://bettystown.tgollogly.dev/ | Subdomain (after DNS setup) |
| https://tgollogly.dev/bettystown/ | Path on main site |

## One-time Cloudflare setup

1. **Workers & Pages → portfolio1 → Settings → Domains** → add `bettystown.tgollogly.dev`
2. Deploy: `bash scripts/deploy-portfolio1.sh`

No API keys — forecast from [Open-Meteo](https://open-meteo.com/) (free, CC BY 4.0).

## APIs

| Endpoint | Purpose |
|----------|---------|
| `GET /api/bettystown-weather` | 14-day forecast + walk scores |
| `GET /api/bettystown-health` | Daily health / debug check |

## Walk score (0–100)

Ranks days for a **warm, dry, gentle-wind** beach walk with a dog:

- Ideal afternoon ~16–22°C
- Low rain probability & mm
- Wind under ~25 km/h
- Penalties for storms, heavy rain, fog

## Failsafes

- Worker retries Open-Meteo 3× with backoff
- KV cache (1h) if live fetch fails
- Browser `localStorage` backup on the page
- GitHub Action **Bettystown weather daily health check** at 08:00 UTC

## Test

```bash
node tests/bettystown-weather.test.mjs
```
