#!/usr/bin/env python3
"""
Find developer jobs across UK, Ireland, remote and hybrid that match
Thomas Gollogly's CV and do not require commercial experience or a degree.

Sources:
  - RemoteOK (global remote, no key)
  - Arbeitnow (remote + hybrid, no key)
  - Adzuna UK + Ireland (set ADZUNA_APP_ID and ADZUNA_APP_KEY)

Web UI: https://tgollogly.dev/job-finder.html

Usage:
  python3 scripts/find-jobs.py
  python3 scripts/find-jobs.py --work-type remote --limit 30
  python3 scripts/find-jobs.py --work-type hybrid --min-score 25
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_PROFILE = SCRIPT_DIR / "cv-profile.json"
USER_AGENT = "tgollogly-job-finder/1.0 (+https://tgollogly.dev)"


@dataclass
class JobListing:
    title: str
    company: str
    location: str
    url: str
    source: str
    description: str
    salary: str = ""
    posted: str = ""
    country: str = ""
    work_type: str = "unknown"
    match_score: float = 0.0
    matched_skills: list[str] = field(default_factory=list)
    friendly_signals: list[str] = field(default_factory=list)
    rejection_reason: str = ""


def load_profile(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def normalise(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def is_developer_role(title: str, profile: dict[str, Any]) -> bool:
    haystack = normalise(title)
    return any(term in haystack for term in profile.get("developer_title_terms", []))


def detect_work_type(job: JobListing, profile: dict[str, Any]) -> str:
    if job.work_type and job.work_type != "unknown":
        return job.work_type
    blob = f" {normalise(' '.join([job.title, job.description, job.location]))} "
    if job.source == "RemoteOK":
        return "remote"
    remote_terms = profile.get("remote_terms", [])
    hybrid_terms = profile.get("hybrid_terms", [])
    if any(term in blob for term in remote_terms):
        return "remote"
    if any(term in blob for term in hybrid_terms):
        return "hybrid"
    local_terms = profile.get("local_location_terms", [])
    if any(term in blob for term in local_terms):
        return "on-site"
    return "unknown"


def is_local_uk_ie(job: JobListing, profile: dict[str, Any]) -> bool:
    blob = f" {normalise(' '.join([job.title, job.description, job.location, job.country]))} "
    return any(term in blob for term in profile.get("local_location_terms", []))


def matches_work_type(job: JobListing, profile: dict[str, Any], work_type: str) -> bool:
    if work_type == "all":
        return True
    detected = detect_work_type(job, profile)
    if work_type == "remote":
        return detected == "remote"
    if work_type == "hybrid":
        return detected == "hybrid"
    if work_type == "local":
        return detected == "on-site" or is_local_uk_ie(job, profile)
    return True


def rejection_reason(text: str, title: str, profile: dict[str, Any]) -> str:
    haystack = f" {normalise(text)} "
    for term in profile.get("exclude_terms", []):
        if term.lower() in haystack:
            return f"excluded: contains '{term.strip()}'"
    if not is_developer_role(title, profile):
        return "excluded: title is not a developer/engineer role"
    years = re.search(r"(\d+)\+?\s*years?(?:\s+of)?\s+(?:commercial\s+)?experience", haystack)
    if years and int(years.group(1)) >= 2:
        return f"excluded: asks for {years.group(1)}+ years experience"
    if re.search(r"\b(degree|bachelor|masters?|phd)\b.{0,40}\b(required|essential|must)\b", haystack):
        return "excluded: degree appears required"
    return ""


def friendly_signals(text: str, profile: dict[str, Any]) -> list[str]:
    haystack = f" {normalise(text)} "
    found = []
    for term in profile.get("preferred_terms", []):
        if term.lower() in haystack:
            found.append(term)
    return found[:6]


def skill_matches(text: str, profile: dict[str, Any]) -> list[str]:
    haystack = normalise(text)
    matched = []
    for skill in profile.get("skills", []):
        token = skill.lower()
        if token in {"node.js", "nodejs"}:
            if re.search(r"\bnode(?:\.js)?\b", haystack):
                matched.append("Node.js")
            continue
        if token in {"ci/cd"}:
            if "ci/cd" in haystack or "continuous integration" in haystack:
                matched.append("CI/CD")
            continue
        pattern = re.escape(token).replace(r"\ ", r"[\s/-]?")
        if re.search(rf"\b{pattern}\b", haystack):
            matched.append(skill if skill[0].isupper() else skill.title())
    seen: set[str] = set()
    unique = []
    for item in matched:
        key = item.lower()
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique


def score_job(job: JobListing, profile: dict[str, Any], work_type: str = "all") -> JobListing:
    blob = " ".join([job.title, job.description, job.location])
    reason = rejection_reason(blob, job.title, profile)
    job.work_type = detect_work_type(job, profile)
    if reason:
        job.rejection_reason = reason
        job.match_score = 0.0
        return job
    if not matches_work_type(job, profile, work_type):
        job.rejection_reason = f"excluded: does not match {work_type} filter"
        job.match_score = 0.0
        return job

    skills = skill_matches(blob, profile)
    signals = friendly_signals(blob, profile)
    title = normalise(job.title)
    score = min(len(skills) * 8, 56)
    score += min(len(signals) * 5, 25)
    if any(word in title for word in ("junior", "trainee", "apprentice", "graduate", "entry level", "entry-level")):
        score += 12
    if job.work_type == "remote":
        score += 5
    if job.work_type == "hybrid":
        score += 4
    if is_local_uk_ie(job, profile):
        score += 6

    job.matched_skills = skills
    job.friendly_signals = signals
    job.match_score = round(min(score, 100), 1)
    return job


def fetch_json(url: str, headers: dict[str, str] | None = None) -> Any:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def adzuna_jobs(profile: dict[str, Any], country: str, max_days: int, per_query: int) -> list[JobListing]:
    app_id = os.environ.get("ADZUNA_APP_ID", "").strip()
    app_key = os.environ.get("ADZUNA_APP_KEY", "").strip()
    if not app_id or not app_key:
        label = "UK" if country == "gb" else "Ireland"
        print(f"Adzuna {label}: skipped (set ADZUNA_APP_ID and ADZUNA_APP_KEY).", file=sys.stderr)
        return []

    listings: list[JobListing] = []
    seen_urls: set[str] = set()
    locations_map = profile.get("search_locations", {})
    locations = (locations_map.get(country) if isinstance(locations_map, dict) else profile.get("search_locations", []))[:6]
    currency = "£" if country == "gb" else "€"
    source = "Adzuna UK" if country == "gb" else "Adzuna Ireland"
    country_label = "UK" if country == "gb" else "Ireland"

    for keyword in profile.get("role_keywords", [])[:6]:
        for where in locations:
            params = {
                "app_id": app_id,
                "app_key": app_key,
                "results_per_page": str(per_query),
                "what": keyword,
                "where": where,
                "max_days_old": str(max_days),
                "category": "it-jobs",
                "content-type": "application/json",
            }
            url = f"https://api.adzuna.com/v1/api/jobs/{country}/search/1?" + urllib.parse.urlencode(params)
            try:
                payload = fetch_json(url)
            except urllib.error.HTTPError as exc:
                print(f"Adzuna {country} error for '{keyword}' in '{where}': HTTP {exc.code}", file=sys.stderr)
                continue
            except urllib.error.URLError as exc:
                print(f"Adzuna network error: {exc.reason}", file=sys.stderr)
                continue

            for item in payload.get("results", []):
                link = item.get("redirect_url") or item.get("url") or ""
                if not link or link in seen_urls:
                    continue
                seen_urls.add(link)
                salary = ""
                if item.get("salary_min") or item.get("salary_max"):
                    salary = f"{currency}{item.get('salary_min', '?')} – {currency}{item.get('salary_max', '?')}"
                title = item.get("title", "").strip()
                description = item.get("description", "")
                location = item.get("location", {}).get("display_name", where)
                job = JobListing(
                    title=title,
                    company=item.get("company", {}).get("display_name", "Unknown"),
                    location=location,
                    url=link,
                    source=source,
                    description=description,
                    salary=salary,
                    posted=item.get("created", ""),
                    country=country_label,
                )
                job.work_type = detect_work_type(job, profile)
                listings.append(job)
            time.sleep(0.25)
    return listings


def remoteok_jobs(profile: dict[str, Any]) -> list[JobListing]:
    listings: list[JobListing] = []
    try:
        payload = fetch_json("https://remoteok.com/api?tags=dev")
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as exc:
        print(f"RemoteOK error: {exc}", file=sys.stderr)
        return listings

    role_terms = [normalise(term) for term in profile.get("role_keywords", [])]
    skill_terms = [normalise(skill) for skill in profile.get("skills", [])]

    for item in payload:
        if not isinstance(item, dict) or "position" not in item:
            continue
        blob = normalise(" ".join([item.get("position", ""), item.get("description", ""), " ".join(item.get("tags") or [])]))
        if not any(term in blob for term in ("junior", "trainee", "apprentice", "entry", "graduate")):
            if not any(skill in blob for skill in skill_terms[:12]):
                continue
        if not any(term in blob for term in role_terms + ["developer", "engineer", "software"]):
            continue

        salary = ""
        if item.get("salary_min") or item.get("salary_max"):
            salary = f"${item.get('salary_min', '?')} – ${item.get('salary_max', '?')}"
        listings.append(
            JobListing(
                title=item.get("position", "").strip(),
                company=item.get("company", "Unknown"),
                location=item.get("location") or "Remote",
                url=item.get("url") or item.get("apply_url") or "",
                source="RemoteOK",
                description=item.get("description", ""),
                salary=salary,
                posted=item.get("date", ""),
                country="Global",
                work_type="remote",
            )
        )
    return listings


def strip_html(html: str) -> str:
    return re.sub(r"<[^>]+>", " ", html or "").strip()


def devitjobs_uk(profile: dict[str, Any]) -> list[JobListing]:
    listings: list[JobListing] = []
    try:
        request = urllib.request.Request(
            "https://devitjobs.uk/job_feed.xml",
            headers={"User-Agent": USER_AGENT},
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            root = ET.fromstring(response.read())
    except (urllib.error.URLError, urllib.error.HTTPError, ET.ParseError) as exc:
        print(f"DevITjobs UK error: {exc}", file=sys.stderr)
        return listings

    dev_terms = ["developer", "engineer", "software", "javascript", "typescript", "react", "node", "web", "python"]
    for job_el in root.findall("job"):
        title = (job_el.findtext("title") or job_el.findtext("name") or "").strip()
        description = strip_html(job_el.findtext("description") or "")
        blob = normalise(" ".join([title, description]))
        if not title or not any(term in blob for term in dev_terms):
            continue
        location = job_el.findtext("location") or job_el.findtext("city") or ""
        region = job_el.findtext("region") or ""
        full_location = ", ".join(part for part in [location, region] if part) or "UK"
        listing = JobListing(
            title=title,
            company=job_el.findtext("company") or job_el.findtext("company-name") or "Unknown",
            location=full_location,
            url=job_el.findtext("url") or job_el.findtext("link") or "",
            source="DevITjobs UK",
            description=description,
            salary=job_el.findtext("salary") or "",
            posted=job_el.findtext("pubdate") or "",
            country=job_el.findtext("country") or "UK",
        )
        listing.work_type = detect_work_type(listing, profile)
        listings.append(listing)
    return listings


def arbeitnow_jobs(profile: dict[str, Any]) -> list[JobListing]:
    listings: list[JobListing] = []
    try:
        payload = fetch_json("https://www.arbeitnow.com/api/job-board-api")
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as exc:
        print(f"Arbeitnow error: {exc}", file=sys.stderr)
        return listings

    dev_terms = ["developer", "engineer", "software", "frontend", "backend", "javascript", "typescript", "react", "node"]
    for item in payload.get("data", []):
        blob = normalise(" ".join([item.get("title", ""), item.get("description", ""), " ".join(item.get("tags") or [])]))
        if not any(term in blob for term in dev_terms):
            continue
        job = JobListing(
            title=str(item.get("title", "")).strip(),
            company=item.get("company_name", "Unknown"),
            location=item.get("location") or ("Remote" if item.get("remote") else "Europe"),
            url=item.get("url") or "",
            source="Arbeitnow",
            description=item.get("description", ""),
            posted="",
            country="Global" if item.get("remote") else "Europe",
            work_type="remote" if item.get("remote") else "unknown",
        )
        job.work_type = detect_work_type(job, profile)
        listings.append(job)
    return listings


def dedupe_jobs(jobs: list[JobListing]) -> list[JobListing]:
    seen: set[str] = set()
    unique: list[JobListing] = []
    for job in jobs:
        key = normalise(job.title) + "|" + normalise(job.company)
        if key in seen:
            continue
        seen.add(key)
        unique.append(job)
    return unique


def print_table(jobs: list[JobListing]) -> None:
    if not jobs:
        print("No matching jobs found. Try lowering --min-score or changing --work-type.")
        return

    print(f"\nFound {len(jobs)} matching jobs (no experience/degree required):\n")
    for index, job in enumerate(jobs, start=1):
        skills = ", ".join(job.matched_skills[:8]) or "—"
        signals = ", ".join(job.friendly_signals[:4]) or "—"
        print(f"{index}. [{job.match_score:>5.1f}] {job.title}")
        print(f"    {job.company} · {job.location} · {job.work_type} · {job.source}")
        if job.salary:
            print(f"    Salary: {job.salary}")
        print(f"    Skills: {skills}")
        print(f"    Signals: {signals}")
        print(f"    {job.url}\n")


def save_json(path: Path, jobs: list[JobListing]) -> None:
    path.write_text(json.dumps([asdict(job) for job in jobs], indent=2), encoding="utf-8")
    print(f"Saved {len(jobs)} jobs to {path}")


def save_csv(path: Path, jobs: list[JobListing]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "match_score", "title", "company", "location", "work_type", "country", "source",
                "salary", "posted", "matched_skills", "friendly_signals", "url",
            ],
        )
        writer.writeheader()
        for job in jobs:
            row = asdict(job)
            row["matched_skills"] = ", ".join(job.matched_skills)
            row["friendly_signals"] = ", ".join(job.friendly_signals)
            row.pop("description", None)
            row.pop("rejection_reason", None)
            writer.writerow(row)
    print(f"Saved {len(jobs)} jobs to {path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--profile", type=Path, default=DEFAULT_PROFILE, help="Path to cv-profile.json")
    parser.add_argument("--min-score", type=float, default=20.0, help="Minimum match score to include (0-100)")
    parser.add_argument("--max-days", type=int, default=30, help="Adzuna: only jobs posted within this many days")
    parser.add_argument("--per-query", type=int, default=15, help="Adzuna: results per keyword/location query")
    parser.add_argument("--limit", type=int, default=40, help="Maximum jobs to return")
    parser.add_argument("--work-type", choices=("all", "remote", "hybrid", "local"), default="all", help="Filter by work type")
    parser.add_argument("--format", choices=("table", "json", "csv"), default="table", help="Output format")
    parser.add_argument("--save", type=Path, help="Optional file path to save results (.json or .csv)")
    parser.add_argument("--include-rejected", action="store_true", help="Show filtered-out jobs for debugging")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    profile = load_profile(args.profile)

    raw_jobs = dedupe_jobs(
        remoteok_jobs(profile)
        + devitjobs_uk(profile)
        + arbeitnow_jobs(profile)
        + adzuna_jobs(profile, "gb", args.max_days, args.per_query)
        + adzuna_jobs(profile, "ie", args.max_days, args.per_query)
    )
    scored = [score_job(job, profile, work_type=args.work_type) for job in raw_jobs]

    if args.include_rejected:
        visible = sorted(scored, key=lambda job: job.match_score, reverse=True)
    else:
        visible = [job for job in scored if not job.rejection_reason and job.match_score >= args.min_score]
        visible.sort(key=lambda job: (job.match_score, job.title), reverse=True)

    visible = visible[: args.limit]

    if args.format == "json":
        print(json.dumps([asdict(job) for job in visible], indent=2))
    else:
        print_table(visible)

    if args.save:
        if args.save.suffix.lower() == ".csv":
            save_csv(args.save, visible)
        else:
            save_json(args.save, visible)

    rejected = sum(1 for job in scored if job.rejection_reason)
    print(
        f"Checked {len(scored)} listings · kept {len(visible)} · filtered {rejected}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
