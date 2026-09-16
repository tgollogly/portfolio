# Newry Fuel Watch

Live **heating oil** and **diesel** prices near Newry, Northern Ireland — with predictive buy signals, Slack alerts, and Web Push notifications (tap to call Safe Fuels Camlough).

## URLs

| URL | Purpose |
|-----|---------|
| https://newry.tgollogly.dev/ | Subdomain (add in Cloudflare → portfolio1 → Domains) |
| https://tgollogly.dev/newry-fuel/ | Path on main site |

## Data sources (free)

- **Heating oil (NI):** [CheapestOil.co.uk](https://www.cheapestoil.co.uk/) Home Assistant JSON for BT35
- **Diesel (live):** [Fuel Near You](https://fuelnearyou.com/) — UK Fuel Finder data (CC BY 4.0)
- **Diesel (history):** UK DESNZ weekly road fuel prices CSV (Open Government Licence)

## Alerts

Set Cloudflare Worker secrets on **portfolio1**:

| Secret | Purpose |
|--------|---------|
| `NEWRY_FUEL_SLACK_WEBHOOK` or `SLACK_WEBHOOK_URL` | Slack ‼️ buy alerts |
| `NEWRY_FUEL_VAPID_PUBLIC` / `NEWRY_FUEL_VAPID_PRIVATE` | Web Push (generate with `npx web-push generate-vapid-keys`) |
| `NEWRY_FUEL_ALERT_SECRET` | Bearer auth for `/api/newry-fuel/alert` and `/api/newry-fuel/debug` |

Cron on portfolio1 (06:00 & 18:00 UTC) runs buy checks alongside Pursuit refresh.

Manual trigger:

```bash
curl -X POST https://tgollogly.dev/api/newry-fuel/alert \
  -H "Authorization: Bearer YOUR_NEWRY_FUEL_ALERT_SECRET"
```

## Supplier

**S.A.F.E Fuels** — 8 Newry Road, Camlough · **028 3083 0691**

Push notifications open `tel:+442830830691` when tapped on iPhone.

## Tests

```bash
node tests/newry-fuel.test.mjs
node tests/run-all.mjs
```
