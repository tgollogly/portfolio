#!/usr/bin/env python3
"""
logic_hunter.py — Target logic/auth flaws on fresh or high-value endpoints.

Mass scanners find known CVEs. Life-changing payouts usually come from:
  - IDOR / BOLA on complex object IDs
  - Auth / role parameter tampering
  - HTTP method / content-type confusion
  - Race-prone state transitions (detect-only hints)

This module tests *candidate* logic flaws on a small, prioritized URL set.
Every hit still requires manual confirmation and /validate before report.

Usage:
    python3 tools/logic_hunter.py --target example.com
    python3 tools/logic_hunter.py --recon-dir recon/example.com --program shopify
"""

from __future__ import annotations

import argparse
import json
import re
import ssl
import subprocess
import sys
import time
import urllib.parse
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
FINDINGS = REPO / "findings"

ID_PATTERN = re.compile(r"/(\d{2,})($|/|\?)")
NUMERIC_PARAM = re.compile(r"(^|&)(id|user_id|account_id|order_id|invoice_id|uid)=([0-9]+)", re.I)

MASS_ASSIGNMENT_KEYS = (
    "role",
    "is_admin",
    "isAdmin",
    "admin",
    "privilege",
    "permissions",
    "type",
    "account_type",
)

_SSL_CTX = ssl.create_default_context()
try:
    import certifi

    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL_CTX.check_hostname = False
    _SSL_CTX.verify_mode = ssl.CERT_NONE


@dataclass
class LogicCandidate:
    url: str
    bug_class: str
    reason: str
    status_code: int = 0
    signal: str = ""
    novelty_hint: str = "manual_confirm_required"


@dataclass
class LogicHuntResult:
    target: str
    tested: int
    candidates: list[LogicCandidate] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "target": self.target,
            "tested": self.tested,
            "candidate_count": len(self.candidates),
            "candidates": [asdict(c) for c in self.candidates],
            "errors": self.errors,
        }


def _load_urls(recon_dir: Path, limit: int) -> list[str]:
    urls: list[str] = []
    diff_file = recon_dir / "new-surface.json"
    if diff_file.exists():
        try:
            diff = json.loads(diff_file.read_text(encoding="utf-8"))
            urls.extend(diff.get("priority_new_paths", [])[: limit // 2])
            urls.extend(diff.get("new_urls", [])[: limit // 2])
        except (OSError, json.JSONDecodeError):
            pass

    for name in ("idor-candidates.txt", "api-endpoints.txt", "urls.txt"):
        path = recon_dir / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                urls.append(line)

    deduped: list[str] = []
    seen: set[str] = set()
    for u in urls:
        if not u.startswith("http"):
            u = f"https://{u}" if "." in u else u
        if u not in seen:
            seen.add(u)
            deduped.append(u)
        if len(deduped) >= limit:
            break
    return deduped


def _curl(
    url: str,
    method: str = "GET",
    headers: dict | None = None,
    data: str = "",
    timeout: int = 12,
) -> tuple[int, str, str]:
    cmd = ["curl", "-s", "-o", "/tmp/logic_hunter_body.txt", "-w", "%{http_code}", "--max-time", str(timeout)]
    if method != "GET":
        cmd.extend(["-X", method])
    for k, v in (headers or {}).items():
        cmd.extend(["-H", f"{k}: {v}"])
    if data:
        cmd.extend(["-d", data])
    cmd.append(url)
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 5)
        code = int(proc.stdout.strip() or "0")
        try:
            body = Path("/tmp/logic_hunter_body.txt").read_text(encoding="utf-8", errors="replace")[:4000]
        except OSError:
            body = ""
        return code, body, proc.stderr.strip()
    except Exception as exc:
        return 0, "", str(exc)


def _swap_id_in_url(url: str) -> str | None:
    parsed = urllib.parse.urlparse(url)
    path = parsed.path
    m = ID_PATTERN.search(path)
    if m:
        old = m.group(1)
        new = str(int(old) + 1) if old.isdigit() else "1"
        new_path = path.replace(f"/{old}", f"/{new}", 1)
        return urllib.parse.urlunparse(parsed._replace(path=new_path))
    qs = parsed.query
    pm = NUMERIC_PARAM.search(qs)
    if pm:
        old = pm.group(3)
        new = str(int(old) + 1)
        new_qs = qs.replace(f"{pm.group(2)}={old}", f"{pm.group(2)}={new}", 1)
        return urllib.parse.urlunparse(parsed._replace(query=new_qs))
    return None


def _response_delta(base_body: str, test_body: str) -> bool:
    if not base_body or not test_body:
        return False
    if base_body == test_body:
        return False
    # Ignore trivial timestamp-only diffs
    if abs(len(base_body) - len(test_body)) < 20:
        return False
    return True


def hunt_logic(recon_dir: Path, target: str, delay: float = 0.35, limit: int = 40) -> LogicHuntResult:
    urls = _load_urls(recon_dir, limit=limit)
    result = LogicHuntResult(target=target, tested=0)

    for url in urls:
        if not url.startswith("http"):
            continue
        result.tested += 1
        base_code, base_body, err = _curl(url)
        if err:
            result.errors.append(f"{url}: {err}")
            time.sleep(delay)
            continue

        # IDOR / BOLA candidate: swap numeric id, compare response
        swapped = _swap_id_in_url(url)
        if swapped:
            test_code, test_body, _ = _curl(swapped)
            if test_code in (200, 201, 202) and _response_delta(base_body, test_body):
                result.candidates.append(
                    LogicCandidate(
                        url=swapped,
                        bug_class="idor",
                        reason="Numeric identifier swap returned different 2xx body",
                        status_code=test_code,
                        signal=test_body[:180].replace("\n", " "),
                    )
                )

        # Method confusion
        for method in ("PUT", "PATCH", "DELETE"):
            code, body, _ = _curl(url, method=method)
            if code in (200, 201, 202, 204) and method != "GET":
                result.candidates.append(
                    LogicCandidate(
                        url=url,
                        bug_class="auth_bypass",
                        reason=f"{method} accepted on endpoint that responded {base_code} to GET",
                        status_code=code,
                        signal=body[:180].replace("\n", " "),
                    )
                )

        # Mass assignment probe (POST JSON) on API-like paths
        if "/api" in url.lower() or "graphql" not in url.lower():
            payload = {k: True for k in MASS_ASSIGNMENT_KEYS[:3]}
            code, body, _ = _curl(
                url,
                method="POST",
                headers={"Content-Type": "application/json"},
                data=json.dumps(payload),
            )
            if code in (200, 201) and any(k in body.lower() for k in ("admin", "role", "privilege")):
                result.candidates.append(
                    LogicCandidate(
                        url=url,
                        bug_class="mass_assignment",
                        reason="POST with privileged JSON keys returned 2xx referencing role/admin fields",
                        status_code=code,
                        signal=body[:180].replace("\n", " "),
                    )
                )

        time.sleep(delay)

    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Logic flaw hunter for fresh/high-value endpoints")
    parser.add_argument("--target", required=True)
    parser.add_argument("--recon-dir", default="")
    parser.add_argument("--program", default="", help="HackerOne handle for optional novelty scoring")
    parser.add_argument("--limit", type=int, default=40)
    parser.add_argument("--delay", type=float, default=0.35, help="Seconds between requests (stay polite)")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    recon_dir = Path(args.recon_dir) if args.recon_dir else REPO / "recon" / args.target
    if not recon_dir.exists():
        print(f"Recon dir missing: {recon_dir}. Run recon first.")
        return 1

    result = hunt_logic(recon_dir, args.target, delay=args.delay, limit=args.limit)

    out_dir = FINDINGS / args.target
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "logic-hunt.json"
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        **result.to_dict(),
    }

    if args.program and result.candidates:
        sys.path.insert(0, str(REPO))
        try:
            from tools.novelty_engine import assess_novelty

            for cand in result.candidates[:10]:
                nov = assess_novelty(
                    program_handle=args.program,
                    endpoint=cand.url,
                    vuln_class=cand.bug_class,
                )
                cand.novelty_hint = f"score={nov.novelty_score} {nov.recommendation}"
            payload = result.to_dict()
            payload["generated_at"] = datetime.now(timezone.utc).isoformat()
        except Exception as exc:
            payload["novelty_error"] = str(exc)

    out_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(f"Logic hunt: {args.target}")
        print(f"  URLs tested:   {result.tested}")
        print(f"  Candidates:    {len(result.candidates)} (ALL need manual PoC)")
        print(f"  Saved:         {out_file}")
        for cand in result.candidates[:8]:
            print(f"  [{cand.bug_class}] {cand.url}")
            print(f"       {cand.reason}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
