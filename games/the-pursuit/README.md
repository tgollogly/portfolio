# The Pursuit

Original UK studio-style quiz game (Cash Builder → Head-to-Head → Final Chase). Fan-made demo — **not affiliated with any TV broadcast, trademark, or production company**.

## URLs

- **Subdomain:** https://pursuit.tgollogly.dev/ (also https://clover.tgollogly.dev/ redirects)
- **Path:** https://tgollogly.dev/games/the-pursuit/

## Cloudflare setup (one-time)

Workers & Pages → **portfolio1** → Settings → Domains → add `pursuit.tgollogly.dev`.

## Hidden from Google

- `noindex,nofollow` meta tags
- `X-Robots-Tag` from Worker
- `robots.txt` Disallow
- Not linked from homepage

## Difficulty

| Mode | Chaser strength | Question pool |
|------|-----------------|---------------|
| Rookie | 62% | Easy + Medium |
| Standard | 74% | Easy + Medium + Hard |
| Expert | 84% | Medium + Hard |
| Legend | 93% | Hard + Expert |

## iPhone Home Screen

1. Open https://tgollogly.dev/games/the-pursuit/ in **Safari**
2. Tap **Share** → **Add to Home Screen**
3. The gold crosshair **Pursuit** icon appears on your home screen

Regenerate icons: `python3 scripts/build-pursuit-icons.py`

## Test

```bash
node games/the-pursuit/test-questions.mjs
```
