#!/usr/bin/env python3
"""
novelty_engine.py — Score finding novelty and block obvious HackerOne duplicates.

Novel bugs come from fresh surface + logic flaws, not faster nuclei scans.
This module automates public dedup checks so you only invest time in findings
that are unlikely to be already disclosed on HackerOne Hacktivity.

Usage:
    python3 tools/novelty_engine.py check \\
        --program shopify --endpoint /api/v1/orders/123 \\
        --vuln-class idor --title "IDOR on order endpoint"

    python3 tools/novelty_engine.py score --program crypto --endpoint /v1/withdraw
"""

from __future__ import annotations

import argparse
import json
import re
import ssl
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

H1_GRAPHQL = "https://hackerone.com/graphql"
MIN_NOVELTY_TO_REPORT = 55  # 0-100; below this = likely waste of triage time

_SSL_CTX = ssl.create_default_context()
try:
    import certifi

    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL_CTX.check_hostname = False
    _SSL_CTX.verify_mode = ssl.CERT_NONE


@dataclass
class DedupMatch:
    source: str
    title: str
    url: str = ""
    severity: str = ""
    disclosed_at: str = ""
    similarity: float = 0.0
    reason: str = ""


@dataclass
class NoveltyResult:
    novelty_score: int
    recommendation: str
    safe_to_investigate: bool
    safe_to_report: bool
    matches: list[DedupMatch] = field(default_factory=list)
    signals: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["matches"] = [asdict(m) for m in self.matches]
        return data


def _graphql(query: str, timeout: int = 15) -> dict:
    payload = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(
        H1_GRAPHQL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "claude-bug-bounty/novelty-engine",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout, context=_SSL_CTX) as resp:
        data = json.loads(resp.read().decode("utf-8", errors="replace"))
    if "errors" in data:
        raise RuntimeError(f"HackerOne GraphQL error: {data['errors']}")
    return data


def _safe_handle(handle: str) -> str:
    return handle.replace('"', "").strip().lower()


def _tokenize(text: str) -> set[str]:
    text = text.lower()
    text = re.sub(r"https?://[^/\s]+", " ", text)
    text = re.sub(r"[^a-z0-9/_\-]+", " ", text)
    parts = {p for p in text.split() if len(p) >= 3}
    return parts


def _similarity(a: str, b: str) -> float:
    ta, tb = _tokenize(a), _tokenize(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def _path_from_endpoint(endpoint: str) -> str:
    if "://" in endpoint:
        return urlparse(endpoint).path or "/"
    return endpoint if endpoint.startswith("/") else f"/{endpoint}"


def search_h1_hacktivity(
    program_handle: str = "",
    keyword: str = "",
    limit: int = 15,
) -> list[dict]:
    """Search public HackerOne Hacktivity."""
    limit = max(1, min(25, limit))
    safe_kw = keyword.replace('"', '\\"')
    where_parts = []
    if program_handle:
        where_parts.append(f'team: {{ handle: {{ _eq: "{_safe_handle(program_handle)}" }} }}')
    if keyword:
        where_parts.append(f'report: {{ title: {{ _icontains: "{safe_kw}" }} }}')
    where_clause = ", ".join(where_parts) if where_parts else ""

    query = f"""{{
      hacktivity_items(
        first: {limit},
        order_by: {{ field: popular, direction: DESC }},
        where: {{ {where_clause} }}
      ) {{
        nodes {{
          ... on HacktivityDocument {{
            report {{
              title
              severity_rating
              disclosed_at
              url
              substate
            }}
          }}
        }}
      }}
    }}"""

    data = _graphql(query)
    nodes = (data.get("data") or {}).get("hacktivity_items", {}).get("nodes", [])
    out: list[dict] = []
    for node in nodes:
        report = node.get("report")
        if report:
            out.append(report)
    return out


def load_new_surface_paths(recon_dir: Path | None) -> set[str]:
    """Paths flagged as new by surface_diff.py."""
    if not recon_dir:
        return set()
    diff_file = recon_dir / "new-surface.json"
    if not diff_file.exists():
        return set()
    try:
        data = json.loads(diff_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return set()
    paths: set[str] = set()
    for item in data.get("new_urls", []):
        paths.add(_path_from_endpoint(str(item)))
    for item in data.get("new_paths", []):
        paths.add(_path_from_endpoint(str(item)))
    return paths


def assess_novelty(
    *,
    program_handle: str = "",
    endpoint: str = "",
    vuln_class: str = "",
    title: str = "",
    recon_dir: Path | None = None,
    min_score: int = MIN_NOVELTY_TO_REPORT,
) -> NoveltyResult:
    """
    Score how likely a finding is to be novel on public evidence.

    This cannot detect private duplicate reports — nothing can.
    """
    matches: list[DedupMatch] = []
    signals: list[str] = []
    warnings: list[str] = []
    score = 50

    path = _path_from_endpoint(endpoint)
    search_terms = []
    if vuln_class:
        search_terms.append(vuln_class)
    if path and path != "/":
        search_terms.append(path.strip("/").split("/")[-1])
    if title:
        search_terms.append(title)

    seen_titles: set[str] = set()
    for term in search_terms[:4]:
        try:
            reports = search_h1_hacktivity(program_handle=program_handle, keyword=term, limit=10)
        except Exception as exc:
            warnings.append(f"HackerOne search failed for '{term}': {exc}")
            score -= 5
            continue

        for report in reports:
            rtitle = report.get("title") or ""
            if rtitle in seen_titles:
                continue
            seen_titles.add(rtitle)

            blob = f"{rtitle} {report.get('url', '')}"
            sim = max(
                _similarity(title or f"{vuln_class} {endpoint}", blob),
                _similarity(f"{vuln_class} {path}", blob),
            )
            if sim >= 0.35:
                matches.append(
                    DedupMatch(
                        source="HackerOne Hacktivity",
                        title=rtitle,
                        url=report.get("url", ""),
                        severity=report.get("severity_rating", ""),
                        disclosed_at=(report.get("disclosed_at") or "")[:10],
                        similarity=round(sim, 2),
                        reason=f"Similar to your finding ({sim:.0%} token overlap)",
                    )
                )

    if matches:
        best = max(m.similarity for m in matches)
        score -= int(min(45, best * 60))
        warnings.append(
            f"{len(matches)} similar disclosed report(s) on HackerOne — verify before investing time."
        )
    else:
        score += 15
        signals.append("No similar titles in public HackerOne Hacktivity for searched terms.")

    new_paths = load_new_surface_paths(recon_dir)
    if path in new_paths:
        score += 20
        signals.append("Endpoint appears on fresh surface (surface_diff new-surface.json).")
    elif recon_dir and (recon_dir / "new-surface.json").exists():
        score += 5
        signals.append("Fresh surface scan exists; this path was not flagged as new.")

    logic_classes = {
        "business logic",
        "logic",
        "race",
        "idor",
        "bola",
        "auth bypass",
        "oauth",
        "account takeover",
        "privilege escalation",
    }
    if any(c in vuln_class.lower() for c in logic_classes):
        score += 10
        signals.append("Logic/auth class — less likely to be found by mass scanners alone.")

    score = max(0, min(100, score))

    if score >= min_score and not any(m.similarity >= 0.55 for m in matches):
        recommendation = "INVESTIGATE — public dedup looks clean; manual PoC still required."
        safe_to_investigate = True
        safe_to_report = score >= 70 and not matches
    elif matches and any(m.similarity >= 0.55 for m in matches):
        recommendation = "STOP — very likely duplicate of disclosed public report."
        safe_to_investigate = False
        safe_to_report = False
    elif matches:
        recommendation = "CAUTION — possible overlap; read linked Hacktivity reports before hunting."
        safe_to_investigate = True
        safe_to_report = False
    else:
        recommendation = "WEAK SIGNAL — dedup clean but novelty not proven; need deep manual testing."
        safe_to_investigate = score >= 45
        safe_to_report = False

    warnings.append(
        "Private submissions are invisible — first valid reporter wins even if dedup passes."
    )

    return NoveltyResult(
        novelty_score=score,
        recommendation=recommendation,
        safe_to_investigate=safe_to_investigate,
        safe_to_report=safe_to_report,
        matches=matches,
        signals=signals,
        warnings=warnings,
    )


def format_result(result: NoveltyResult) -> str:
    lines = [
        f"Novelty score: {result.novelty_score}/100",
        f"Recommendation: {result.recommendation}",
        f"Safe to investigate: {'yes' if result.safe_to_investigate else 'no'}",
        f"Safe to report (public dedup only): {'yes' if result.safe_to_report else 'no'}",
        "",
    ]
    if result.signals:
        lines.append("Signals:")
        for s in result.signals:
            lines.append(f"  + {s}")
        lines.append("")
    if result.matches:
        lines.append("Possible duplicates:")
        for m in sorted(result.matches, key=lambda x: x.similarity, reverse=True)[:8]:
            lines.append(
                f"  - [{m.similarity:.0%}] {m.title} ({m.disclosed_at}) {m.url}".rstrip()
            )
        lines.append("")
    if result.warnings:
        lines.append("Warnings:")
        for w in result.warnings:
            lines.append(f"  ! {w}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Novelty scoring and HackerOne dedup engine")
    sub = parser.add_subparsers(dest="cmd", required=True)

    check = sub.add_parser("check", help="Assess a finding before investing/reporting")
    check.add_argument("--program", required=True, help="HackerOne program handle")
    check.add_argument("--endpoint", required=True, help="Vulnerable URL or path")
    check.add_argument("--vuln-class", default="", help="Bug class (idor, ssrf, ...)")
    check.add_argument("--title", default="", help="Draft report title")
    check.add_argument("--recon-dir", default="", help="recon/<target>/ directory")
    check.add_argument("--min-score", type=int, default=MIN_NOVELTY_TO_REPORT)
    check.add_argument("--json", action="store_true")

    score_cmd = sub.add_parser("score", help="Alias for check")
    score_cmd.add_argument("--program", required=True)
    score_cmd.add_argument("--endpoint", required=True)
    score_cmd.add_argument("--vuln-class", default="")
    score_cmd.add_argument("--title", default="")
    score_cmd.add_argument("--recon-dir", default="")
    score_cmd.add_argument("--min-score", type=int, default=MIN_NOVELTY_TO_REPORT)
    score_cmd.add_argument("--json", action="store_true")

    args = parser.parse_args()
    recon_dir = Path(args.recon_dir) if args.recon_dir else None

    result = assess_novelty(
        program_handle=args.program,
        endpoint=args.endpoint,
        vuln_class=args.vuln_class,
        title=args.title,
        recon_dir=recon_dir,
        min_score=args.min_score,
    )

    if args.json:
        print(json.dumps(result.to_dict(), indent=2))
    else:
        print(format_result(result))

    if result.safe_to_report:
        return 0
    if result.safe_to_investigate:
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
