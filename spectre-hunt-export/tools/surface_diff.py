#!/usr/bin/env python3
"""
surface_diff.py — Find URLs/paths that appear new vs Wayback historical crawl.

Novel bugs cluster on fresh code paths other hunters have not mapped yet.
This compares current recon output against Internet Archive CDX snapshots.

Usage:
    python3 tools/surface_diff.py --target example.com
    python3 tools/surface_diff.py --target example.com --recon-dir recon/example.com
"""

from __future__ import annotations

import argparse
import json
import ssl
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

CDX_API = "https://web.archive.org/cdx/search/cdx"

_SSL_CTX = ssl.create_default_context()
try:
    import certifi

    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL_CTX.check_hostname = False
    _SSL_CTX.verify_mode = ssl.CERT_NONE


def _normalize_url(url: str) -> str:
    url = url.strip()
    if not url:
        return ""
    if not url.startswith("http"):
        url = f"https://{url}"
    parsed = urllib.parse.urlparse(url)
    path = parsed.path or "/"
    if path != "/" and path.endswith("/"):
        path = path[:-1]
    return f"{parsed.scheme}://{parsed.netloc.lower()}{path}"


def _path_only(url: str) -> str:
    parsed = urllib.parse.urlparse(_normalize_url(url))
    return parsed.path or "/"


def fetch_wayback_paths(domain: str, limit: int = 5000) -> set[str]:
    """Return historical paths seen in Wayback for a host."""
    params = urllib.parse.urlencode(
        {
            "url": f"{domain}/*",
            "output": "json",
            "fl": "original",
            "filter": "statuscode:200",
            "collapse": "urlkey",
            "limit": str(limit),
        }
    )
    req = urllib.request.Request(f"{CDX_API}?{params}", headers={"User-Agent": "claude-bug-bounty/surface-diff"})
    try:
        with urllib.request.urlopen(req, timeout=45, context=_SSL_CTX) as resp:
            rows = json.loads(resp.read().decode("utf-8", errors="replace"))
    except Exception:
        return set()

    if not rows or len(rows) < 2:
        return set()

    paths: set[str] = set()
    for row in rows[1:]:
        if not row:
            continue
        original = row[0]
        parsed = urllib.parse.urlparse(original)
        if parsed.netloc.lower().endswith(domain.lower()) or domain.lower() in parsed.netloc.lower():
            paths.add(parsed.path or "/")
    return paths


def load_current_urls(recon_dir: Path, target: str) -> list[str]:
    urls: list[str] = []
    candidates = [
        recon_dir / "urls.txt",
        recon_dir / "api-endpoints.txt",
        recon_dir / "idor-candidates.txt",
        recon_dir / "live-hosts.txt",
    ]
    for path in candidates:
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                urls.append(line)
    if not urls:
        urls.append(f"https://{target}/")
    return urls


def diff_surface(target: str, recon_dir: Path) -> dict:
    domain = target.replace("https://", "").replace("http://", "").split("/")[0]
    current_urls = load_current_urls(recon_dir, domain)
    current_paths = {_path_only(u) for u in current_urls}
    historical_paths = fetch_wayback_paths(domain)

    new_paths = sorted(p for p in current_paths if p not in historical_paths and p not in {"/"})
    new_urls = sorted(
        _normalize_url(u)
        for u in current_urls
        if _path_only(u) in new_paths or (_path_only(u) not in historical_paths and _path_only(u) != "/")
    )

    # De-dupe while preserving order
    seen: set[str] = set()
    deduped_urls: list[str] = []
    for u in new_urls:
        if u not in seen:
            seen.add(u)
            deduped_urls.append(u)

    priority_paths = [
        p
        for p in new_paths
        if any(x in p.lower() for x in ("api", "admin", "graphql", "v1", "v2", "v3", "internal", "oauth", "billing"))
    ]

    return {
        "target": domain,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "current_path_count": len(current_paths),
        "historical_path_count": len(historical_paths),
        "new_path_count": len(new_paths),
        "new_paths": new_paths[:500],
        "new_urls": deduped_urls[:500],
        "priority_new_paths": priority_paths[:100],
        "note": "New = in current recon but not seen in Wayback CDX sample. Manual review required.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Diff current recon against Wayback historical surface")
    parser.add_argument("--target", required=True, help="Target domain")
    parser.add_argument("--recon-dir", default="", help="Recon output directory")
    parser.add_argument("--json", action="store_true", help="Print JSON to stdout only")
    args = parser.parse_args()

    repo = Path(__file__).resolve().parents[1]
    recon_dir = Path(args.recon_dir) if args.recon_dir else repo / "recon" / args.target
    recon_dir.mkdir(parents=True, exist_ok=True)

    result = diff_surface(args.target, recon_dir)
    out_file = recon_dir / "new-surface.json"
    out_file.write_text(json.dumps(result, indent=2), encoding="utf-8")

    if args.json:
        print(json.dumps(result, indent=2))
        return 0

    print(f"Surface diff: {result['target']}")
    print(f"  Current paths:     {result['current_path_count']}")
    print(f"  Historical paths:  {result['historical_path_count']} (Wayback sample)")
    print(f"  New paths:         {result['new_path_count']}")
    print(f"  Priority new:      {len(result['priority_new_paths'])}")
    print(f"  Saved:             {out_file}")
    if result["priority_new_paths"][:10]:
        print("\n  Top priority new paths:")
        for p in result["priority_new_paths"][:10]:
            print(f"    {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
