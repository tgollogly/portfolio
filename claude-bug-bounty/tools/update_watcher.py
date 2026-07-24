#!/usr/bin/env python3
"""
update_watcher.py — Detect fresh HackerOne program/scope changes worth hunting.

Life-changing bugs often appear right after scope expansions or major releases.
This tool snapshots public program metadata and highlights what changed.

Usage:
    python3 tools/update_watcher.py scan --min-bounty 50000
    python3 tools/update_watcher.py watch --program shopify
    python3 tools/update_watcher.py diff --program shopify
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

WATCH_DIR = Path.home() / ".bughunter" / "watch"


def _fetch_h1_programs(limit: int = 100) -> list[dict]:
    url = (
        "https://hackerone.com/opportunities/all/search"
        f"?ordering=started_accepting_at&limit={limit}"
        "&asset_types=URL&asset_types=WILDCARD&asset_types=DOMAIN"
    )
    proc = subprocess.run(
        ["curl", "-s", "-H", "Accept: application/json", url],
        capture_output=True,
        text=True,
        timeout=45,
    )
    if proc.returncode != 0 or not proc.stdout.strip():
        return []
    data = json.loads(proc.stdout)
    programs = []
    for prog in data.get("data", []):
        programs.append(
            {
                "name": prog.get("name", ""),
                "handle": prog.get("handle", ""),
                "bounty_min": prog.get("minimum_bounty_table_value", 0) or 0,
                "bounty_max": prog.get("maximum_bounty_table_value", 0) or 0,
                "response_efficiency": prog.get("response_efficiency_percentage", 0) or 0,
                "started_accepting_at": prog.get("started_accepting_at", ""),
                "scopes": prog.get("scopes", []),
                "url": f"https://hackerone.com/{prog.get('handle', '')}",
            }
        )
    return programs


def _scope_fingerprint(scopes: list) -> set[str]:
    out: set[str] = set()
    for scope in scopes or []:
        if isinstance(scope, dict):
            ident = scope.get("asset_identifier", "")
        else:
            ident = str(scope)
        ident = ident.strip().lower()
        if ident:
            out.add(ident)
    return out


def _snapshot_path(handle: str) -> Path:
    return WATCH_DIR / f"{handle.lower()}.json"


def save_snapshot(program: dict) -> Path:
    WATCH_DIR.mkdir(parents=True, exist_ok=True)
    handle = program["handle"]
    payload = {
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "program": program,
        "scope_fingerprint": sorted(_scope_fingerprint(program.get("scopes", []))),
    }
    path = _snapshot_path(handle)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path


def diff_program(handle: str, program: dict) -> dict:
    path = _snapshot_path(handle)
    old_scope: set[str] = set()
    old_bounty_max = 0
    if path.exists():
        try:
            prev = json.loads(path.read_text(encoding="utf-8"))
            old_scope = set(prev.get("scope_fingerprint", []))
            old_bounty_max = (prev.get("program") or {}).get("bounty_max", 0) or 0
        except (OSError, json.JSONDecodeError):
            pass

    new_scope = _scope_fingerprint(program.get("scopes", []))
    added = sorted(new_scope - old_scope)
    removed = sorted(old_scope - new_scope)
    bounty_max = program.get("bounty_max", 0) or 0

    signals = []
    score = 0
    if added:
        score += min(40, len(added) * 5)
        signals.append(f"{len(added)} new in-scope asset(s) since last snapshot")
    if bounty_max > old_bounty_max:
        score += 15
        signals.append(f"Max bounty increased (${old_bounty_max:,.0f} -> ${bounty_max:,.0f})")
    started = program.get("started_accepting_at", "")
    if started:
        signals.append(f"Program started accepting: {started[:10]}")

    return {
        "handle": handle,
        "name": program.get("name", ""),
        "url": program.get("url", ""),
        "bounty_max": bounty_max,
        "added_scope": added,
        "removed_scope": removed,
        "freshness_score": score,
        "signals": signals,
        "worth_hunting_now": score >= 15 or not path.exists(),
    }


def cmd_scan(args) -> int:
    programs = _fetch_h1_programs(limit=args.limit)
    if not programs:
        print("Could not fetch HackerOne programs.")
        return 1

    filtered = [
        p
        for p in programs
        if (p.get("bounty_max") or 0) >= args.min_bounty
    ]
    filtered.sort(key=lambda p: (p.get("bounty_max", 0), p.get("response_efficiency", 0)), reverse=True)

    results = []
    for prog in filtered[: args.top]:
        diff = diff_program(prog["handle"], prog)
        save_snapshot(prog)
        results.append(diff)

    results.sort(key=lambda x: x["freshness_score"], reverse=True)

    print(f"H1 update scan — min bounty ${args.min_bounty:,.0f}\n")
    for item in results:
        flag = "HUNT" if item["worth_hunting_now"] else "watch"
        print(
            f"[{flag}] {item['name']} ({item['handle']}) "
            f"max=${item['bounty_max']:,.0f} freshness={item['freshness_score']}"
        )
        for sig in item["signals"]:
            print(f"       - {sig}")
        if item["added_scope"][:5]:
            print(f"       + scope: {', '.join(item['added_scope'][:5])}")
        print()

    out = WATCH_DIR / "latest-scan.json"
    WATCH_DIR.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"generated_at": datetime.now(timezone.utc).isoformat(), "results": results}, indent=2))
    print(f"Saved scan: {out}")
    return 0


def cmd_watch(args) -> int:
    programs = _fetch_h1_programs(limit=200)
    match = next((p for p in programs if p["handle"].lower() == args.program.lower()), None)
    if not match:
        print(f"Program not found: {args.program}")
        return 1
    path = save_snapshot(match)
    print(f"Snapshot saved: {path}")
    return 0


def cmd_diff(args) -> int:
    programs = _fetch_h1_programs(limit=200)
    match = next((p for p in programs if p["handle"].lower() == args.program.lower()), None)
    if not match:
        print(f"Program not found: {args.program}")
        return 1
    result = diff_program(args.program, match)
    print(json.dumps(result, indent=2))
    save_snapshot(match)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Watch HackerOne programs for fresh hunting opportunities")
    sub = parser.add_subparsers(dest="cmd", required=True)

    scan = sub.add_parser("scan", help="Scan high-bounty programs for fresh scope/changes")
    scan.add_argument("--min-bounty", type=int, default=50000)
    scan.add_argument("--top", type=int, default=20)
    scan.add_argument("--limit", type=int, default=100)

    watch = sub.add_parser("watch", help="Save baseline snapshot for one program")
    watch.add_argument("--program", required=True)

    diff = sub.add_parser("diff", help="Show changes since last snapshot")
    diff.add_argument("--program", required=True)

    args = parser.parse_args()
    if args.cmd == "scan":
        return cmd_scan(args)
    if args.cmd == "watch":
        return cmd_watch(args)
    if args.cmd == "diff":
        return cmd_diff(args)
    return 1


if __name__ == "__main__":
    sys.exit(main())
