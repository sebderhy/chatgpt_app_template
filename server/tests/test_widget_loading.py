"""
Tests for widget HTML loading functionality.

These tests verify that:
1. Widget HTML is loaded correctly from the assets directory
2. Fallback to hashed filenames works
3. FileNotFoundError is raised for missing widgets
4. LRU caching works correctly
"""

import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
import tempfile
import os

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


class TestLoadWidgetHtml:
    """Tests for load_widget_html function."""

    def test_loads_exact_filename(self, tmp_path):
        """load_widget_html finds exact filename match."""
        # Create a temporary HTML file
        html_content = "<html><body>Test Widget</body></html>"
        html_file = tmp_path / "test-widget.html"
        html_file.write_text(html_content)

        # Import and patch ASSETS_DIR
        from main import load_widget_html

        # Clear the LRU cache to ensure fresh state
        load_widget_html.cache_clear()

        with patch("main.ASSETS_DIR", tmp_path):
            result = load_widget_html("test-widget")
            assert result == html_content

    def test_fallback_to_hashed_filename(self, tmp_path):
        """load_widget_html falls back to hashed filename when exact not found."""
        html_content = "<html><body>Hashed Widget</body></html>"
        # Create only the hashed version
        hashed_file = tmp_path / "test-widget-abc123.html"
        hashed_file.write_text(html_content)

        from main import load_widget_html
        load_widget_html.cache_clear()

        with patch("main.ASSETS_DIR", tmp_path):
            result = load_widget_html("test-widget")
            assert result == html_content

    def test_uses_latest_hashed_file(self, tmp_path):
        """load_widget_html uses latest hashed file when multiple exist."""
        old_content = "<html>Old</html>"
        new_content = "<html>New</html>"

        # Create multiple hashed versions (sorted alphabetically)
        (tmp_path / "widget-aaa111.html").write_text(old_content)
        (tmp_path / "widget-zzz999.html").write_text(new_content)

        from main import load_widget_html
        load_widget_html.cache_clear()

        with patch("main.ASSETS_DIR", tmp_path):
            result = load_widget_html("widget")
            # Should use the last one when sorted (zzz999)
            assert result == new_content

    def test_raises_file_not_found(self, tmp_path):
        """load_widget_html raises FileNotFoundError for missing widget."""
        from main import load_widget_html
        load_widget_html.cache_clear()

        with patch("main.ASSETS_DIR", tmp_path):
            with pytest.raises(FileNotFoundError) as exc_info:
                load_widget_html("nonexistent-widget")

            assert "nonexistent-widget" in str(exc_info.value)
            assert "pnpm run build" in str(exc_info.value)

    def test_caching_works(self, tmp_path):
        """load_widget_html caches results."""
        html_content = "<html>Cached</html>"
        html_file = tmp_path / "cached-widget.html"
        html_file.write_text(html_content)

        from main import load_widget_html
        load_widget_html.cache_clear()

        with patch("main.ASSETS_DIR", tmp_path):
            # First call
            result1 = load_widget_html("cached-widget")

            # Modify the file
            html_file.write_text("<html>Modified</html>")

            # Second call should return cached value
            result2 = load_widget_html("cached-widget")

            assert result1 == result2 == html_content


class TestWidgetConfiguration:
    """Tests for Widget dataclass and configuration."""

    def test_widget_dataclass_frozen(self):
        """Widget dataclass is immutable (frozen)."""
        from main import Widget

        widget = Widget(
            identifier="test",
            title="Test",
            description="Test widget",
            template_uri="ui://widget/test.html",
            invoking="Loading...",
            invoked="Ready",
            html="<html></html>",
        )

        with pytest.raises(Exception):  # FrozenInstanceError
            widget.title = "Modified"

    def test_widget_fields(self):
        """Widget dataclass has all required fields."""
        from main import Widget

        widget = Widget(
            identifier="my_widget",
            title="My Widget",
            description="A test widget",
            template_uri="ui://widget/my.html",
            invoking="Loading widget...",
            invoked="Widget ready",
            html="<html><body>Widget</body></html>",
        )

        assert widget.identifier == "my_widget"
        assert widget.title == "My Widget"
        assert widget.description == "A test widget"
        assert widget.template_uri == "ui://widget/my.html"
        assert widget.invoking == "Loading widget..."
        assert widget.invoked == "Widget ready"
        assert widget.html == "<html><body>Widget</body></html>"


class TestAssetsDirectory:
    """Tests for ASSETS_DIR configuration."""

    def test_assets_dir_is_path(self):
        """ASSETS_DIR is a Path object."""
        from main import ASSETS_DIR

        assert isinstance(ASSETS_DIR, Path)

    def test_assets_dir_points_to_assets(self):
        """ASSETS_DIR points to assets directory."""
        from main import ASSETS_DIR

        assert ASSETS_DIR.name == "assets"

    def test_mime_type_correct(self):
        """MIME_TYPE is correct for MCP Apps."""
        from main import MIME_TYPE

        # MCP Apps require the profile parameter to signal this is an MCP App resource
        assert MIME_TYPE == "text/html;profile=mcp-app"
