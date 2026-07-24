"""Tests for novelty_engine.py."""

from pathlib import Path

from tools.novelty_engine import _path_from_endpoint, _similarity, assess_novelty, load_new_surface_paths


def test_similarity_overlap():
    assert _similarity("idor on /api/orders endpoint", "IDOR in /api/orders allows read") > 0.2


def test_path_from_endpoint():
    assert _path_from_endpoint("https://example.com/api/v1/user") == "/api/v1/user"
    assert _path_from_endpoint("/api/v1/user") == "/api/v1/user"


def test_load_new_surface_paths(tmp_path):
    recon = tmp_path / "recon"
    recon.mkdir()
    recon.joinpath("new-surface.json").write_text(
        '{"new_urls": ["https://x.com/api/billing"], "new_paths": ["/admin"]}',
        encoding="utf-8",
    )
    paths = load_new_surface_paths(recon)
    assert "/api/billing" in paths
    assert "/admin" in paths


def test_assess_novelty_without_network(monkeypatch):
    monkeypatch.setattr(
        "tools.novelty_engine.search_h1_hacktivity",
        lambda **kwargs: [
            {
                "title": "IDOR in /api/orders allows reading other user orders",
                "url": "https://hackerone.com/reports/1",
                "severity_rating": "high",
                "disclosed_at": "2026-01-01",
            }
        ],
    )
    result = assess_novelty(
        program_handle="shopify",
        endpoint="/api/orders/123",
        vuln_class="idor",
        title="IDOR on orders",
    )
    assert result.novelty_score < 80
    assert result.matches
    assert not result.safe_to_report
