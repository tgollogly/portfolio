# Clover Match

Original Irish-themed match-three puzzle (not affiliated with Candy Crush or King).

## URLs after deploy

- **Subdomain (recommended):** https://clover.tgollogly.dev/
- **Path fallback:** https://tgollogly.dev/games/clover-match/

## Subdomain setup (one-time, Cloudflare dashboard)

1. **Workers & Pages** → **portfolio1** → **Settings** → **Domains & routes**
2. **Add** → **Custom domain** → `clover.tgollogly.dev`
3. Cloudflare creates the DNS record automatically.

The Worker already routes `clover.tgollogly.dev` to this folder and sends `X-Robots-Tag: noindex`.

## SEO

- `noindex,nofollow` in page meta
- `X-Robots-Tag` header from Worker
- `/games/clover-match/` disallowed in `robots.txt`
- Not linked from the main portfolio homepage (unlisted demo)
