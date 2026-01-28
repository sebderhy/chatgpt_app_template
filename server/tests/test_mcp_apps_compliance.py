"""
Tests for MCP Apps protocol compliance.

These tests verify that tool responses and resources comply with the MCP Apps
extension specification as documented at:
- https://modelcontextprotocol.io/docs/extensions/apps
- https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/

Key requirements tested:
1. MIME type matches spec exactly (text/html;profile=mcp-app)
2. Tool responses include structuredContent and TextContent
3. Tools have required _meta.ui fields (resourceUri, csp)
4. Template URIs use ui:// scheme
5. Resources referenced by tools exist and are valid
6. CSP metadata is properly structured
7. HTML content is valid

These tests help catch issues that would cause apps to fail in MCP hosts
(Claude, VS Code, Goose, basic-host) before deployment.
"""

import pytest
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import mcp.types as types

# =============================================================================
# SPEC CONSTANTS - Do NOT change these, they come from the MCP Apps specification
# =============================================================================

# From @modelcontextprotocol/ext-apps RESOURCE_MIME_TYPE constant
MCP_APPS_MIME_TYPE = "text/html;profile=mcp-app"

# Required URI scheme for UI resources
UI_SCHEME = "ui://"


# =============================================================================
# TEST HELPERS
# =============================================================================

def get_widgets():
    """Import and return WIDGETS list."""
    from main import WIDGETS
    return WIDGETS


def get_widget_ids():
    """Return list of widget identifiers for parametrized tests."""
    return [w.identifier for w in get_widgets()]


async def call_tool(widget_id: str, arguments: dict = None):
    """Call a tool and return the result."""
    from main import handle_call_tool
    request = types.CallToolRequest(
        method="tools/call",
        params=types.CallToolRequestParams(
            name=widget_id,
            arguments=arguments or {},
        ),
    )
    return await handle_call_tool(request)


async def read_resource(uri: str):
    """Read a resource and return the result."""
    from main import handle_read_resource
    request = types.ReadResourceRequest(
        method="resources/read",
        params=types.ReadResourceRequestParams(uri=uri),
    )
    return await handle_read_resource(request)


# =============================================================================
# MIME TYPE COMPLIANCE
# =============================================================================

class TestMimeTypeCompliance:
    """Verify MIME type matches MCP Apps specification exactly."""

    def test_mime_type_matches_spec(self):
        """MIME_TYPE must be exactly 'text/html;profile=mcp-app'.

        This is the RESOURCE_MIME_TYPE from @modelcontextprotocol/ext-apps.
        Hosts like basic-host reject resources with any other MIME type.
        """
        from main import MIME_TYPE
        assert MIME_TYPE == MCP_APPS_MIME_TYPE, (
            f"MIME_TYPE is '{MIME_TYPE}' but spec requires '{MCP_APPS_MIME_TYPE}'"
        )

    @pytest.mark.asyncio
    async def test_resources_use_correct_mime_type(self):
        """All resources must use the spec MIME type."""
        from main import list_resources
        for resource in await list_resources():
            assert resource.mimeType == MCP_APPS_MIME_TYPE, (
                f"Resource '{resource.name}' uses '{resource.mimeType}', "
                f"must use '{MCP_APPS_MIME_TYPE}'"
            )

    @pytest.mark.asyncio
    async def test_resource_content_uses_correct_mime_type(self):
        """Resource content returned by read must use correct MIME type."""
        for widget in get_widgets():
            result = await read_resource(widget.template_uri)
            assert len(result.root.contents) == 1
            assert result.root.contents[0].mimeType == MCP_APPS_MIME_TYPE


# =============================================================================
# URI SCHEME COMPLIANCE
# =============================================================================

class TestUriSchemeCompliance:
    """Verify URIs follow MCP Apps conventions."""

    def test_template_uris_use_ui_scheme(self):
        """Template URIs must start with 'ui://'."""
        for widget in get_widgets():
            assert widget.template_uri.startswith(UI_SCHEME), (
                f"Widget '{widget.identifier}' URI '{widget.template_uri}' "
                f"must start with '{UI_SCHEME}'"
            )

    def test_template_uris_end_with_html(self):
        """Template URIs should end with .html for HTML resources."""
        for widget in get_widgets():
            assert widget.template_uri.endswith(".html"), (
                f"Widget '{widget.identifier}' URI should end with '.html'"
            )

    def test_template_uris_are_unique(self):
        """Each widget must have a unique template URI."""
        uris = [w.template_uri for w in get_widgets()]
        assert len(uris) == len(set(uris)), "Duplicate template URIs found"

    def test_identifiers_are_unique(self):
        """Each widget must have a unique identifier."""
        ids = [w.identifier for w in get_widgets()]
        assert len(ids) == len(set(ids)), "Duplicate widget identifiers found"


# =============================================================================
# TOOL METADATA COMPLIANCE
# =============================================================================

class TestToolMetadataCompliance:
    """Verify tools have required MCP Apps metadata in _meta."""

    def test_tools_have_ui_section(self):
        """Tool metadata must include 'ui' section."""
        from main import get_tool_meta
        for widget in get_widgets():
            meta = get_tool_meta(widget)
            assert "ui" in meta, f"Widget '{widget.identifier}' missing 'ui' in _meta"

    def test_tools_have_resource_uri(self):
        """Tool metadata must include ui.resourceUri linking to the resource."""
        from main import get_tool_meta
        for widget in get_widgets():
            meta = get_tool_meta(widget)
            assert "resourceUri" in meta["ui"], (
                f"Widget '{widget.identifier}' missing 'ui.resourceUri'"
            )
            assert meta["ui"]["resourceUri"] == widget.template_uri, (
                f"Widget '{widget.identifier}' resourceUri mismatch"
            )

    def test_tools_have_csp(self):
        """Tool metadata must include ui.csp for sandbox security."""
        from main import get_tool_meta
        for widget in get_widgets():
            meta = get_tool_meta(widget)
            assert "csp" in meta["ui"], (
                f"Widget '{widget.identifier}' missing 'ui.csp' - "
                "required for loading external resources in sandbox"
            )

    def test_csp_structure_is_valid(self):
        """CSP must have resourceDomains and connectDomains arrays."""
        from main import get_tool_meta
        for widget in get_widgets():
            csp = get_tool_meta(widget)["ui"]["csp"]
            for field in ("resourceDomains", "connectDomains"):
                assert field in csp, f"Widget '{widget.identifier}' CSP missing '{field}'"
                assert isinstance(csp[field], list), f"CSP '{field}' must be a list"

    def test_csp_includes_server_origin(self):
        """CSP resourceDomains must include server origin for asset loading."""
        from main import get_tool_meta, get_base_url
        from urllib.parse import urlparse

        base_url = get_base_url()
        origin = f"{urlparse(base_url).scheme}://{urlparse(base_url).netloc}"

        for widget in get_widgets():
            domains = get_tool_meta(widget)["ui"]["csp"]["resourceDomains"]
            assert origin in domains, (
                f"Widget '{widget.identifier}' CSP must include server origin '{origin}'"
            )

    @pytest.mark.asyncio
    async def test_listed_tools_have_metadata(self):
        """Tools returned by list_tools must have _meta with ui section."""
        from main import list_tools
        for tool in await list_tools():
            # Python SDK exposes _meta as either _meta or meta depending on version
            meta = getattr(tool, '_meta', None) or getattr(tool, 'meta', None)
            assert meta is not None, f"Tool '{tool.name}' missing _meta"
            assert "ui" in meta, f"Tool '{tool.name}' missing _meta.ui"
            assert "resourceUri" in meta["ui"]


# =============================================================================
# TOOL RESPONSE FORMAT COMPLIANCE
# =============================================================================

class TestToolResponseCompliance:
    """Verify tool responses follow MCP Apps format requirements."""

    @pytest.mark.asyncio
    async def test_tools_return_structured_content(self):
        """Tools must return structuredContent for the UI to consume."""
        for widget in get_widgets():
            result = await call_tool(widget.identifier)
            assert result.root.structuredContent is not None, (
                f"Tool '{widget.identifier}' must return structuredContent"
            )

    @pytest.mark.asyncio
    async def test_tools_return_text_content(self):
        """Tools must return content with TextContent for model narration."""
        for widget in get_widgets():
            result = await call_tool(widget.identifier)
            assert result.root.content, f"Tool '{widget.identifier}' must return content"
            assert len(result.root.content) > 0
            assert result.root.content[0].type == "text"

    @pytest.mark.asyncio
    async def test_structured_content_is_serializable(self):
        """structuredContent must be JSON-serializable."""
        for widget in get_widgets():
            result = await call_tool(widget.identifier)
            try:
                json.dumps(result.root.structuredContent)
            except (TypeError, ValueError) as e:
                pytest.fail(f"Tool '{widget.identifier}' structuredContent not serializable: {e}")

    @pytest.mark.asyncio
    async def test_tool_results_have_invocation_meta(self):
        """Tool results should include _meta for UI rendering."""
        for widget in get_widgets():
            result = await call_tool(widget.identifier)
            # Python SDK exposes _meta as either _meta or meta depending on version
            meta = getattr(result.root, '_meta', None) or getattr(result.root, 'meta', None)
            assert meta is not None, (
                f"Tool '{widget.identifier}' result missing _meta"
            )


# =============================================================================
# TOOL-RESOURCE LINKAGE COMPLIANCE
# =============================================================================

class TestToolResourceLinkage:
    """Verify tools are properly linked to existing resources."""

    @pytest.mark.asyncio
    async def test_tool_resource_uri_exists(self):
        """Resource referenced by tool's ui.resourceUri must exist."""
        from main import WIDGETS_BY_URI
        for widget in get_widgets():
            assert widget.template_uri in WIDGETS_BY_URI, (
                f"Widget '{widget.identifier}' references non-existent resource "
                f"'{widget.template_uri}'"
            )

    @pytest.mark.asyncio
    async def test_tool_resource_is_readable(self):
        """Resource referenced by tool must be readable."""
        for widget in get_widgets():
            result = await read_resource(widget.template_uri)
            assert result.root.contents, (
                f"Resource '{widget.template_uri}' returned no content"
            )


# =============================================================================
# HTML CONTENT COMPLIANCE
# =============================================================================

class TestHtmlContentCompliance:
    """Verify HTML content meets requirements."""

    def test_html_is_non_empty(self):
        """Widget HTML must be non-empty."""
        for widget in get_widgets():
            assert widget.html and widget.html.strip(), (
                f"Widget '{widget.identifier}' has empty HTML. Run 'pnpm run build'."
            )

    def test_html_has_doctype(self):
        """Widget HTML should have DOCTYPE declaration."""
        for widget in get_widgets():
            html_lower = widget.html.lower().strip()
            assert html_lower.startswith("<!doctype html"), (
                f"Widget '{widget.identifier}' HTML should start with <!DOCTYPE html>"
            )

    def test_html_has_script_tag(self):
        """Widget HTML must include script tag for the widget code."""
        for widget in get_widgets():
            assert "<script" in widget.html.lower(), (
                f"Widget '{widget.identifier}' HTML missing script tag"
            )


# =============================================================================
# TOOL ANNOTATIONS COMPLIANCE
# =============================================================================

class TestToolAnnotations:
    """Verify tools have proper safety annotations."""

    @pytest.mark.asyncio
    async def test_display_tools_are_read_only(self):
        """Display-only tools should have readOnlyHint=True."""
        from main import list_tools
        for tool in await list_tools():
            assert tool.annotations.readOnlyHint is True, (
                f"Tool '{tool.name}' should have readOnlyHint=True"
            )

    @pytest.mark.asyncio
    async def test_display_tools_are_non_destructive(self):
        """Display-only tools should have destructiveHint=False."""
        from main import list_tools
        for tool in await list_tools():
            assert tool.annotations.destructiveHint is False, (
                f"Tool '{tool.name}' should have destructiveHint=False"
            )


# =============================================================================
# WIDGET IDENTIFIER CONVENTIONS
# =============================================================================

class TestWidgetIdentifierConventions:
    """Verify widget identifiers follow MCP naming conventions."""

    def test_identifiers_are_valid_tool_names(self):
        """Identifiers must be lowercase letters, numbers, and underscores."""
        import re
        for widget in get_widgets():
            assert re.match(r'^[a-z][a-z0-9_]*$', widget.identifier), (
                f"Widget identifier '{widget.identifier}' must be lowercase "
                "with underscores, starting with a letter"
            )

    def test_invocation_messages_are_non_empty(self):
        """Invocation messages must be non-empty for UX."""
        for widget in get_widgets():
            assert widget.invoking and widget.invoking.strip(), (
                f"Widget '{widget.identifier}' has empty 'invoking' message"
            )
            assert widget.invoked and widget.invoked.strip(), (
                f"Widget '{widget.identifier}' has empty 'invoked' message"
            )
