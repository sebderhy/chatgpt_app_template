"""
Tests for CSP external URL coverage.

These tests verify that all external URLs used in the application are
properly whitelisted in the CSP (Content Security Policy) configuration.

Without proper CSP configuration, MCP Apps hosts (like basic-host) will
block these resources in the sandboxed iframe, causing broken images,
missing fonts, and failed script loads.

Reference: https://modelcontextprotocol.io/docs/extensions/apps
"""

import pytest
import re
import json
import sys
from pathlib import Path
from urllib.parse import urlparse
from typing import Set, List

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# =============================================================================
# URL EXTRACTION HELPERS
# =============================================================================

# Domains that are always local (skip in external URL checks)
LOCAL_DOMAINS = ("localhost", "127.0.0.1", "0.0.0.0")


def extract_urls(text: str) -> Set[str]:
    """Extract all http/https URLs from text."""
    return set(re.findall(r'https?://[^\s\'"<>}\])]+', text))


def get_origin(url: str) -> str:
    """Extract origin (scheme://host) from URL."""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def is_local_url(url: str) -> bool:
    """Check if URL points to a local domain."""
    return any(domain in url for domain in LOCAL_DOMAINS)


def get_external_urls(urls: Set[str]) -> Set[str]:
    """Filter to only external (non-local) URLs."""
    return {url for url in urls if url.startswith("http") and not is_local_url(url)}


# =============================================================================
# CSP HELPERS
# =============================================================================

def get_csp_origins() -> Set[str]:
    """Get all origins whitelisted in CSP configuration."""
    from main import get_csp_domains
    csp = get_csp_domains()
    origins = set()
    origins.update(csp.get("resourceDomains", []))
    origins.update(csp.get("connectDomains", []))
    return origins


def is_whitelisted(url: str, origins: Set[str]) -> bool:
    """Check if URL's origin is whitelisted."""
    origin = get_origin(url)
    return origin in origins or any(origin.startswith(o.rstrip("/")) for o in origins)


def find_unwhitelisted_urls(urls: Set[str]) -> List[str]:
    """Return URLs whose origins are not in CSP whitelist."""
    origins = get_csp_origins()
    external = get_external_urls(urls)
    return [url for url in external if not is_whitelisted(url, origins)]


def format_missing_urls_error(context: str, missing: List[str]) -> str:
    """Format error message for missing URL whitelist."""
    origins = sorted(set(get_origin(url) for url in missing))
    samples = [f"  - {url[:80]}{'...' if len(url) > 80 else ''}" for url in missing[:5]]
    return (
        f"External URLs in {context} are not whitelisted in CSP.\n"
        f"Missing origins: {origins}\n"
        f"Add these to EXTERNAL_RESOURCE_DOMAINS in main.py.\n"
        f"Example URLs:\n" + "\n".join(samples)
    )


# =============================================================================
# URL EXTRACTION FROM SOURCES
# =============================================================================

def get_sample_data_urls() -> Set[str]:
    """Extract URLs from sample data constants."""
    from main import (
        SAMPLE_CAROUSEL_ITEMS,
        SAMPLE_LIST_ITEMS,
        SAMPLE_GALLERY_IMAGES,
        SAMPLE_CART_ITEMS,
        SAMPLE_MAP_PLACES,
    )
    urls = set()
    for data in [SAMPLE_CAROUSEL_ITEMS, SAMPLE_LIST_ITEMS, SAMPLE_GALLERY_IMAGES,
                 SAMPLE_CART_ITEMS, SAMPLE_MAP_PLACES]:
        urls.update(extract_urls(json.dumps(data)))
    return urls


def get_html_urls() -> Set[str]:
    """Extract URLs from built HTML files."""
    from main import ASSETS_DIR
    urls = set()
    if ASSETS_DIR.exists():
        for html_file in ASSETS_DIR.glob("*.html"):
            urls.update(extract_urls(html_file.read_text(encoding="utf-8", errors="ignore")))
    return urls


# =============================================================================
# CSP URL COVERAGE TESTS
# =============================================================================

class TestCspUrlCoverage:
    """Verify all external URLs are covered by CSP configuration."""

    def test_sample_data_urls_whitelisted(self):
        """External URLs in sample data must be in CSP whitelist."""
        missing = find_unwhitelisted_urls(get_sample_data_urls())
        if missing:
            pytest.fail(format_missing_urls_error("sample data", missing))

    def test_html_urls_whitelisted(self):
        """External URLs in built HTML must be in CSP whitelist."""
        from main import ASSETS_DIR
        if not ASSETS_DIR.exists():
            pytest.skip("Assets not built. Run 'pnpm run build' first.")

        missing = find_unwhitelisted_urls(get_html_urls())
        if missing:
            pytest.fail(format_missing_urls_error("built HTML", missing))


# =============================================================================
# CSP DOMAIN VALIDATION TESTS
# =============================================================================

class TestCspDomainValidation:
    """Verify CSP domain entries are valid and well-formed."""

    def test_domains_are_valid_urls(self):
        """CSP domains must be valid URLs with http(s) scheme."""
        from main import EXTERNAL_RESOURCE_DOMAINS
        for domain in EXTERNAL_RESOURCE_DOMAINS:
            parsed = urlparse(domain)
            assert parsed.scheme in ("http", "https"), (
                f"CSP domain '{domain}' must start with http:// or https://"
            )
            assert parsed.netloc, f"CSP domain '{domain}' must have a valid host"

    def test_domains_no_trailing_slash(self):
        """CSP domains should not have trailing slashes."""
        from main import EXTERNAL_RESOURCE_DOMAINS
        for domain in EXTERNAL_RESOURCE_DOMAINS:
            assert not domain.endswith("/"), (
                f"CSP domain '{domain}' should not have trailing slash"
            )

    def test_no_wildcards(self):
        """CSP should not use wildcard domains (security risk)."""
        from main import EXTERNAL_RESOURCE_DOMAINS
        for domain in EXTERNAL_RESOURCE_DOMAINS:
            assert "*" not in domain, f"CSP domain '{domain}' contains wildcard"

    def test_https_preferred(self):
        """CSP domains should prefer HTTPS (warning only)."""
        from main import EXTERNAL_RESOURCE_DOMAINS
        import warnings
        http_domains = [d for d in EXTERNAL_RESOURCE_DOMAINS if d.startswith("http://")]
        if http_domains:
            warnings.warn(f"CSP domains use HTTP (insecure): {http_domains}")

    def test_connect_domains_minimal(self):
        """connectDomains should be minimal for security."""
        from main import get_csp_domains
        connect = get_csp_domains().get("connectDomains", [])
        assert len(connect) >= 1, "connectDomains must include server origin"
        if len(connect) > 3:
            import warnings
            warnings.warn(f"connectDomains has {len(connect)} entries - review if necessary")
