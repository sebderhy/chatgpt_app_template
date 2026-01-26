"""
Output Quality Tests.

These tests verify the quality and consistency of tool outputs,
catching issues that would affect tool chaining and user experience.

Categories tested:
1. Response Size - Output isn't too large for context windows
2. Schema Stability - Consistent output structure across invocations
3. ID Field Consistency - Lists use consistent ID field naming
4. Null/Empty Handling - No null/undefined values in responses
5. Cross-Tool Consistency - Field naming is consistent across tools
6. Boundary Values - Tools handle edge case inputs gracefully

These tests are orthogonal to business logic - they verify infrastructure
quality regardless of what specific widgets/data the app provides.

References:
- OpenAI ChatGPT Apps guidance: docs/what-makes-a-great-chatgpt-app.md
- MCP server guidelines: docs/mcp-development-guidelines.md
"""

import pytest
import json
import sys
from pathlib import Path
from typing import List, Dict, Any, Set
from dataclasses import dataclass

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import mcp.types as types


# =============================================================================
# GRADING INFRASTRUCTURE
# =============================================================================

@dataclass
class GradeResult:
    """Result of a grading check."""
    category: str
    check_name: str
    passed: bool
    score: float  # 0.0 to 1.0
    details: str
    weight: float = 1.0
    fix_hint: str = ""


class OutputQualityReport:
    """Collects grading results and generates a report."""

    def __init__(self):
        self.results: List[GradeResult] = []

    def add_result(self, result: GradeResult):
        self.results.append(result)

    def get_category_score(self, category: str) -> float:
        """Get weighted score for a category (0-100%)."""
        category_results = [r for r in self.results if r.category == category]
        if not category_results:
            return 0.0

        total_weight = sum(r.weight for r in category_results)
        weighted_sum = sum(r.score * r.weight for r in category_results)
        return (weighted_sum / total_weight) * 100 if total_weight > 0 else 0.0

    def get_overall_score(self) -> float:
        """Get overall weighted score (0-100%)."""
        if not self.results:
            return 0.0

        total_weight = sum(r.weight for r in self.results)
        weighted_sum = sum(r.score * r.weight for r in self.results)
        return (weighted_sum / total_weight) * 100 if total_weight > 0 else 0.0

    def get_grade_letter(self) -> str:
        """Convert score to letter grade."""
        score = self.get_overall_score()
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"

    def generate_report(self) -> str:
        """Generate a human-readable report."""
        lines = [
            "=" * 60,
            "OUTPUT QUALITY GRADE REPORT",
            "=" * 60,
            "",
        ]

        # Group by category
        categories: Dict[str, List[GradeResult]] = {}
        for r in self.results:
            if r.category not in categories:
                categories[r.category] = []
            categories[r.category].append(r)

        # Report each category
        for category, results in sorted(categories.items()):
            score = self.get_category_score(category)
            lines.append(f"\n{category}: {score:.1f}%")
            lines.append("-" * 40)

            for r in results:
                status = "✓" if r.passed else "✗"
                lines.append(f"  {status} {r.check_name}: {r.score*100:.0f}%")
                if not r.passed:
                    if r.fix_hint:
                        lines.append(f"      FIX: {r.fix_hint}")
                    if r.details:
                        for detail_line in r.details.split("\n")[:5]:
                            lines.append(f"      {detail_line}")

        # Overall score
        lines.append("\n" + "=" * 60)
        overall = self.get_overall_score()
        grade = self.get_grade_letter()
        lines.append(f"OVERALL SCORE: {overall:.1f}% (Grade: {grade})")
        lines.append("=" * 60)

        return "\n".join(lines)


# Global report instance
_report = OutputQualityReport()


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_all_keys_recursive(obj: Any, prefix: str = "") -> Set[str]:
    """Extract all keys from a nested structure."""
    keys = set()
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f"{prefix}.{key}" if prefix else key
            keys.add(full_key)
            keys.update(get_all_keys_recursive(value, full_key))
    elif isinstance(obj, list) and obj:
        # For lists, check first item's structure
        keys.update(get_all_keys_recursive(obj[0], f"{prefix}[]"))
    return keys


def find_null_values(obj: Any, path: str = "") -> List[str]:
    """Find all null/None values in a nested structure."""
    nulls = []
    if obj is None:
        nulls.append(path or "root")
    elif isinstance(obj, dict):
        for key, value in obj.items():
            nulls.extend(find_null_values(value, f"{path}.{key}" if path else key))
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            nulls.extend(find_null_values(item, f"{path}[{i}]"))
    return nulls


def get_id_field_names(obj: Any) -> Set[str]:
    """Extract ID-like field names from list items."""
    id_fields = set()
    if isinstance(obj, dict):
        for key, value in obj.items():
            if isinstance(value, list) and value and isinstance(value[0], dict):
                # Check what ID-like fields are in list items
                for item in value:
                    if isinstance(item, dict):
                        for item_key in item.keys():
                            if 'id' in item_key.lower():
                                id_fields.add(item_key)
            id_fields.update(get_id_field_names(value))
    elif isinstance(obj, list):
        for item in obj:
            id_fields.update(get_id_field_names(item))
    return id_fields


# =============================================================================
# 1. RESPONSE SIZE TESTS
# =============================================================================

class TestResponseSize:
    """Tests for response size limits.

    WHY THIS MATTERS:
    -----------------
    Large responses cause multiple problems:
    1. They consume excessive tokens in the model's context window
    2. They slow down widget rendering in ChatGPT
    3. They can cause memory issues on mobile devices
    4. They make it harder for the model to extract relevant information

    REFERENCE:
    ----------
    - docs/what-makes-a-great-chatgpt-app.md: "Return lean, model-friendly outputs"
    - OpenAI recommends keeping tool outputs concise and paginated
    """

    @pytest.mark.asyncio
    async def test_structured_content_size_limit(self):
        """
        TEST: Tool output (structuredContent) should not exceed 100KB.

        WHY: Large outputs pollute the context window and slow rendering.
        ChatGPT has limited context, and oversized tool outputs reduce space
        for conversation history and reasoning.

        FIX: If your tool returns large data:
        1. Paginate: Return first N items with a 'hasMore' flag
        2. Summarize: Return counts/summaries instead of full data
        3. Filter: Only return fields the widget actually needs

        Example fix:
            # Before (bad): Returns all 1000 items
            return {"items": all_items}

            # After (good): Returns first 20 with pagination
            return {
                "items": all_items[:20],
                "total": len(all_items),
                "hasMore": len(all_items) > 20
            }
        """
        from main import handle_call_tool, WIDGETS

        MAX_SIZE_BYTES = 100 * 1024  # 100KB
        violations = []

        for widget in WIDGETS:
            request = types.CallToolRequest(
                method="tools/call",
                params=types.CallToolRequestParams(
                    name=widget.identifier,
                    arguments={},
                ),
            )
            result = await handle_call_tool(request)

            if result.root.structuredContent:
                size = len(json.dumps(result.root.structuredContent).encode('utf-8'))
                if size > MAX_SIZE_BYTES:
                    violations.append(
                        f"  - {widget.identifier}: {size / 1024:.1f}KB (limit: {MAX_SIZE_BYTES / 1024:.0f}KB)"
                    )

        score = 1.0 - (len(violations) / len(WIDGETS)) if WIDGETS else 0.0
        _report.add_result(GradeResult(
            category="1. Response Size",
            check_name="Output under 100KB",
            passed=len(violations) == 0,
            score=score,
            details="\n".join(violations) if violations else "",
            weight=1.5,
            fix_hint="Paginate large datasets. See docs/what-makes-a-great-chatgpt-app.md",
        ))

        assert len(violations) == 0, f"""
RESPONSE SIZE ERROR: Outputs exceed 100KB
{chr(10).join(violations)}

Why: Large outputs consume context tokens and slow rendering.
Fix: Paginate with {{items: items[:20], total: N, hasMore: true}}
Ref: docs/what-makes-a-great-chatgpt-app.md
"""

    @pytest.mark.asyncio
    async def test_list_item_count_reasonable(self):
        """
        TEST: Lists should contain at most 50 items.

        WHY: Long lists overwhelm users and consume excessive context.
        Users can't meaningfully browse 100+ items in a widget.
        The model struggles to reference specific items in very long lists.

        FIX: Implement pagination or filtering:
            return {
                "items": items[:20],
                "total": 150,
                "hasMore": True,
                "nextCursor": "page_2"
            }
        """
        from main import handle_call_tool, WIDGETS

        MAX_ITEMS = 50
        violations = []

        for widget in WIDGETS:
            request = types.CallToolRequest(
                method="tools/call",
                params=types.CallToolRequestParams(
                    name=widget.identifier,
                    arguments={},
                ),
            )
            result = await handle_call_tool(request)

            if result.root.structuredContent:
                content = result.root.structuredContent
                for key, value in content.items():
                    if isinstance(value, list) and len(value) > MAX_ITEMS:
                        violations.append(
                            f"  - {widget.identifier}.{key}: {len(value)} items (limit: {MAX_ITEMS})"
                        )

        score = 1.0 - (len(violations) / len(WIDGETS)) if WIDGETS else 0.0
        _report.add_result(GradeResult(
            category="1. Response Size",
            check_name="Reasonable list sizes",
            passed=len(violations) == 0,
            score=score,
            details="\n".join(violations) if violations else "",
            weight=1.0,
            fix_hint="Implement pagination: {items: [...], hasMore: true, total: N}",
        ))

        assert len(violations) == 0, f"""
LIST SIZE ERROR: Lists exceed 50 items
{chr(10).join(violations)}

Why: Users can't browse huge lists; model can't reference items reliably.
Fix: Return {{items: items[:20], total: N, hasMore: true}}
Ref: docs/what-makes-a-great-chatgpt-app.md
"""


# =============================================================================
# 2. SCHEMA STABILITY TESTS
# =============================================================================

class TestSchemaStability:
    """Tests for consistent output structure.

    WHY THIS MATTERS:
    -----------------
    When ChatGPT chains tool calls (uses output from one tool as input to another),
    it relies on predictable output structure. If a tool returns different keys
    on different calls, the model can't reliably parse the output.

    EXAMPLE PROBLEM:
    ----------------
    Call 1: {"items": [...], "count": 5}
    Call 2: {"results": [...], "total": 5}  # Different keys!

    The model expected "items" but got "results" - chain breaks.

    REFERENCE:
    ----------
    - docs/what-makes-a-great-chatgpt-app.md: "Provide stable, predictable outputs"
    """

    @pytest.mark.asyncio
    async def test_consistent_keys_across_invocations(self):
        """
        TEST: Tool output keys should be identical across multiple calls.

        WHY: ChatGPT learns output patterns and expects consistency.
        If keys change between calls, tool chaining becomes unreliable.

        FIX: Always return the same keys, using empty arrays/strings
        instead of omitting fields:

            # BAD: Sometimes has 'error', sometimes doesn't
            if error:
                return {"error": msg}
            return {"items": [...]}

            # GOOD: Always has both fields
            return {
                "items": items if not error else [],
                "error": msg if error else None
            }
        """
        from main import handle_call_tool, WIDGETS

        violations = []

        for widget in WIDGETS:
            key_sets = []
            for _ in range(3):
                request = types.CallToolRequest(
                    method="tools/call",
                    params=types.CallToolRequestParams(
                        name=widget.identifier,
                        arguments={},
                    ),
                )
                result = await handle_call_tool(request)

                if result.root.structuredContent:
                    keys = get_all_keys_recursive(result.root.structuredContent)
                    key_sets.append(keys)

            if len(key_sets) >= 2:
                first_keys = key_sets[0]
                for i, keys in enumerate(key_sets[1:], 2):
                    if keys != first_keys:
                        missing = first_keys - keys
                        extra = keys - first_keys
                        details = []
                        if missing:
                            details.append(f"missing in call {i}: {missing}")
                        if extra:
                            details.append(f"extra in call {i}: {extra}")
                        violations.append(f"  - {widget.identifier}: {', '.join(details)}")

        score = 1.0 - (len(violations) / len(WIDGETS)) if WIDGETS else 0.0
        _report.add_result(GradeResult(
            category="2. Schema Stability",
            check_name="Consistent keys across calls",
            passed=len(violations) == 0,
            score=score,
            details="\n".join(violations) if violations else "",
            weight=2.0,
            fix_hint="Always return same keys - use empty [] instead of omitting fields",
        ))

        assert len(violations) == 0, f"""
SCHEMA STABILITY ERROR: Output keys vary between calls
{chr(10).join(violations)}

Why: ChatGPT chains tools and expects consistent structure.
Fix: Always return same keys, use empty [] instead of omitting fields.
Ref: docs/what-makes-a-great-chatgpt-app.md
"""

    @pytest.mark.asyncio
    async def test_consistent_types_in_fields(self):
        """
        TEST: Fields should have consistent types across all list items.

        WHY: If 'price' is sometimes a number and sometimes a string,
        the model can't reliably format or compare values.

        BAD:  [{"price": 10.99}, {"price": "15.00"}]  # Mixed types!
        GOOD: [{"price": 10.99}, {"price": 15.00}]    # All numbers
        """
        from main import handle_call_tool, WIDGETS

        violations = []

        for widget in WIDGETS:
            request = types.CallToolRequest(
                method="tools/call",
                params=types.CallToolRequestParams(
                    name=widget.identifier,
                    arguments={},
                ),
            )
            result = await handle_call_tool(request)

            if result.root.structuredContent:
                content = result.root.structuredContent
                for key, value in content.items():
                    if isinstance(value, list) and len(value) > 1:
                        if all(isinstance(item, dict) for item in value):
                            all_keys = set()
                            for item in value:
                                all_keys.update(item.keys())

                            for field_key in all_keys:
                                types_seen = set()
                                for item in value:
                                    if field_key in item:
                                        types_seen.add(type(item[field_key]).__name__)

                                if len(types_seen) > 1:
                                    violations.append(
                                        f"  - {widget.identifier}.{key}[].{field_key}: mixed types {types_seen}"
                                    )

        score = 1.0 - (len(violations) / len(WIDGETS)) if WIDGETS else 0.0
        _report.add_result(GradeResult(
            category="2. Schema Stability",
            check_name="Consistent field types",
            passed=len(violations) == 0,
            score=score,
            details="\n".join(violations[:5]) if violations else "",
            weight=1.5,
            fix_hint="Ensure all items use same types (all prices as numbers, etc)",
        ))

        assert len(violations) == 0, f"""
TYPE CONSISTENCY ERROR: Fields have mixed types
{chr(10).join(violations[:5])}

Why: ChatGPT can't format/compare values if types vary (number vs string).
Fix: Ensure all list items use consistent types for each field.
Ref: docs/mcp-development-guidelines.md
"""


# =============================================================================
# 3. ID FIELD CONSISTENCY TESTS
# =============================================================================

class TestIdFieldConsistency:
    """Tests for consistent ID field naming.

    WHY THIS MATTERS:
    -----------------
    ChatGPT uses IDs to reference specific items in follow-up requests.
    When you say "tell me more about item 3", the model needs to find
    which field contains the unique identifier.

    If different tools use different ID field names ('id' vs 'item_id' vs
    'identifier'), the model has to guess, leading to errors.

    REFERENCE:
    ----------
    - docs/what-makes-a-great-chatgpt-app.md: "Include stable IDs for chaining"
    """

    @pytest.mark.asyncio
    async def test_id_fields_use_consistent_naming(self):
        """
        TEST: All tools should use 'id' as the primary identifier field.

        WHY: Consistent naming enables reliable tool chaining.
        The model can confidently say "get details for id='abc'" without
        guessing whether it should be 'id', 'item_id', or 'identifier'.

        FIX: Standardize on 'id' for all list items:
            [{"id": "rest-1", "name": "..."}, {"id": "rest-2", "name": "..."}]
        """
        from main import handle_call_tool, WIDGETS

        all_id_fields: Dict[str, Set[str]] = {}

        for widget in WIDGETS:
            request = types.CallToolRequest(
                method="tools/call",
                params=types.CallToolRequestParams(
                    name=widget.identifier,
                    arguments={},
                ),
            )
            result = await handle_call_tool(request)

            if result.root.structuredContent:
                id_fields = get_id_field_names(result.root.structuredContent)
                if id_fields:
                    all_id_fields[widget.identifier] = id_fields

        all_names = set()
        for fields in all_id_fields.values():
            all_names.update(fields)

        primary_id_names = {name for name in all_names if name.lower() == 'id' or name.lower().endswith('_id')}
        violations = []

        if len(primary_id_names) > 1 and 'id' in primary_id_names:
            other_names = primary_id_names - {'id'}
            for tool, fields in all_id_fields.items():
                tool_non_standard = fields & other_names
                if tool_non_standard and 'id' not in fields:
                    violations.append(f"  - {tool}: uses {tool_non_standard} instead of 'id'")

        passed = len(violations) == 0
        score = 1.0 - (len(violations) / len(all_id_fields)) if all_id_fields else 1.0

        _report.add_result(GradeResult(
            category="3. ID Consistency",
            check_name="Consistent ID field naming",
            passed=passed,
            score=score,
            details="\n".join(violations) if violations else f"ID fields: {all_names or 'none'}",
            weight=1.5,
            fix_hint="Use 'id' as the primary identifier in all list items",
        ))

        # Soft check - contributes to grade but doesn't fail test
        # assert passed, f"ID naming inconsistencies:\n" + "\n".join(violations)

    @pytest.mark.asyncio
    async def test_list_items_have_ids(self):
        """
        TEST: Items in lists should have an 'id' field for referencing.

        WHY: Without IDs, users can't ask follow-up questions about
        specific items. "Tell me more about the second restaurant"
        is ambiguous - IDs make it precise: "Details for id='rest-2'"

        FIX: Add unique IDs to all list items:
            "items": [
                {"id": "item-1", "name": "First Item", ...},
                {"id": "item-2", "name": "Second Item", ...}
            ]
        """
        from main import handle_call_tool, WIDGETS

        violations = []
        lists_checked = 0

        for widget in WIDGETS:
            request = types.CallToolRequest(
                method="tools/call",
                params=types.CallToolRequestParams(
                    name=widget.identifier,
                    arguments={},
                ),
            )
            result = await handle_call_tool(request)

            if result.root.structuredContent:
                content = result.root.structuredContent
                for key, value in content.items():
                    if isinstance(value, list) and len(value) > 0:
                        if isinstance(value[0], dict):
                            lists_checked += 1
                            sample_item = value[0]
                            has_id = any('id' in k.lower() for k in sample_item.keys())
                            if not has_id:
                                violations.append(
                                    f"  - {widget.identifier}.{key}[]: items lack 'id' field"
                                )

        if lists_checked == 0:
            score = 1.0
        else:
            score = 1.0 - (len(violations) / lists_checked)

        _report.add_result(GradeResult(
            category="3. ID Consistency",
            check_name="List items have IDs",
            passed=len(violations) == 0,
            score=score,
            details="\n".join(violations) if violations else f"Checked {lists_checked} lists",
            weight=1.2,
            fix_hint="Add 'id' to each list item: [{\"id\": \"item-1\", ...}]",
        ))

        # Soft check
        # assert len(violations) == 0, f"Missing IDs:\n" + "\n".join(violations)


# =============================================================================
# 4. NULL/EMPTY HANDLING TESTS
# =============================================================================

class TestNullHandling:
    """Tests for proper null/empty value handling.

    WHY THIS MATTERS:
    -----------------
    Null values in responses cause problems:
    1. Widget JavaScript may crash on null.property access
    2. The model can't distinguish "no data" from "missing field"
    3. JSON serialization may behave unexpectedly

    REFERENCE:
    ----------
    - docs/mcp-development-guidelines.md: "Never return null for optional fields"
    """

    @pytest.mark.asyncio
    async def test_no_null_values_in_output(self):
        """
        TEST: Output should not contain null/None values.

        WHY: Null values cause widget rendering failures and confuse
        the model. Use empty strings, empty arrays, or omit the field.

        FIX:
            # BAD: Returns null
            return {"name": user.name, "email": user.email}  # email might be None

            # GOOD: Convert null to empty string
            return {"name": user.name, "email": user.email or ""}

            # ALSO GOOD: Omit optional fields when empty
            result = {"name": user.name}
            if user.email:
                result["email"] = user.email
            return result
        """
        from main import handle_call_tool, WIDGETS

        violations = []

        for widget in WIDGETS:
            request = types.CallToolRequest(
                method="tools/call",
                params=types.CallToolRequestParams(
                    name=widget.identifier,
                    arguments={},
                ),
            )
            result = await handle_call_tool(request)

            if result.root.structuredContent:
                null_paths = find_null_values(result.root.structuredContent)
                if null_paths:
                    violations.append(
                        f"  - {widget.identifier}: null at {', '.join(null_paths[:3])}"
                    )

        score = 1.0 - (len(violations) / len(WIDGETS)) if WIDGETS else 0.0
        _report.add_result(GradeResult(
            category="4. Null Handling",
            check_name="No null values",
            passed=len(violations) == 0,
            score=score,
            details="\n".join(violations) if violations else "",
            weight=1.5,
            fix_hint="Replace null with empty string '' or empty array [], or omit field",
        ))

        assert len(violations) == 0, f"""
NULL VALUE ERROR: Outputs contain null values
{chr(10).join(violations)}

Why: Widget JavaScript crashes on null.property access.
Fix: Use empty string '' or empty array [] instead of null.
Ref: docs/mcp-development-guidelines.md
"""

    @pytest.mark.asyncio
    async def test_empty_results_have_structure(self):
        """
        TEST: Even empty results should have proper structure.

        WHY: Returning just {} gives no indication of what fields exist.
        The widget and model need to know the expected structure.

        FIX:
            # BAD: Empty object
            return {}

            # GOOD: Shows expected structure with empty values
            return {"items": [], "message": "No results found"}
        """
        from main import handle_call_tool, WIDGETS

        violations = []

        for widget in WIDGETS:
            request = types.CallToolRequest(
                method="tools/call",
                params=types.CallToolRequestParams(
                    name=widget.identifier,
                    arguments={},
                ),
            )
            result = await handle_call_tool(request)

            if result.root.structuredContent is not None:
                content = result.root.structuredContent
                if content == {}:
                    violations.append(f"  - {widget.identifier}: returns empty object {{}}")

        score = 1.0 - (len(violations) / len(WIDGETS)) if WIDGETS else 0.0
        _report.add_result(GradeResult(
            category="4. Null Handling",
            check_name="Structured empty responses",
            passed=len(violations) == 0,
            score=score,
            details="\n".join(violations) if violations else "",
            weight=0.8,
            fix_hint="Return meaningful structure: {\"items\": [], \"message\": \"No results\"}",
        ))


# =============================================================================
# 5. CROSS-TOOL CONSISTENCY TESTS
# =============================================================================

class TestCrossToolConsistency:
    """Tests for naming consistency across different tools.

    WHY THIS MATTERS:
    -----------------
    When different tools use different names for the same concept,
    the model struggles to chain them together.

    EXAMPLE PROBLEM:
    - Tool A returns {"title": "..."}
    - Tool B returns {"name": "..."}
    - Tool C returns {"label": "..."}

    All mean the same thing, but the model must track 3 different names.
    Standardizing on one name makes chaining reliable.

    REFERENCE:
    ----------
    - docs/what-makes-a-great-chatgpt-app.md: "Use consistent naming"
    """

    @pytest.mark.asyncio
    async def test_common_fields_use_same_names(self):
        """
        TEST: Common concepts should use standardized field names.

        RECOMMENDED NAMES:
        - 'title' (not name, label, heading)
        - 'description' (not desc, summary, details)
        - 'image' (not img, photo, thumbnail, picture)
        - 'url' (not link, href)
        - 'price' (not cost, amount)

        WHY: Consistent naming enables the model to reliably chain tools
        and format outputs without field-mapping logic.
        """
        from main import handle_call_tool, WIDGETS

        equivalent_fields = [
            {'title', 'name', 'label', 'heading'},
            {'description', 'desc', 'summary', 'details', 'body'},
            {'image', 'img', 'photo', 'picture', 'thumbnail', 'image_url', 'imageUrl'},
            {'url', 'link', 'href'},
            {'price', 'cost', 'amount'},
        ]

        field_usage: Dict[str, Dict[str, int]] = {
            str(eq_set): {} for eq_set in equivalent_fields
        }

        for widget in WIDGETS:
            request = types.CallToolRequest(
                method="tools/call",
                params=types.CallToolRequestParams(
                    name=widget.identifier,
                    arguments={},
                ),
            )
            result = await handle_call_tool(request)

            if result.root.structuredContent:
                all_keys = get_all_keys_recursive(result.root.structuredContent)
                base_keys = {k.split('.')[-1].split('[')[0].lower() for k in all_keys}

                for eq_set in equivalent_fields:
                    used = base_keys & eq_set
                    for field in used:
                        key = str(eq_set)
                        field_usage[key][field] = field_usage[key].get(field, 0) + 1

        violations = []
        for eq_set in equivalent_fields:
            key = str(eq_set)
            used_fields = field_usage[key]
            if len(used_fields) > 1:
                sorted_usage = sorted(used_fields.items(), key=lambda x: -x[1])
                preferred = sorted_usage[0][0]
                others = [f for f, _ in sorted_usage[1:]]
                violations.append(f"  - Use '{preferred}' instead of {others}")

        score = 1.0 - (len(violations) / len(equivalent_fields)) if equivalent_fields else 1.0
        _report.add_result(GradeResult(
            category="5. Cross-Tool Consistency",
            check_name="Consistent field naming",
            passed=len(violations) == 0,
            score=score,
            details="\n".join(violations) if violations else "",
            weight=1.0,
            fix_hint="Standardize: 'title' (not name), 'description' (not desc), 'image' (not img)",
        ))


# =============================================================================
# 6. BOUNDARY VALUE TESTS
# =============================================================================

class TestBoundaryValues:
    """Tests for graceful handling of edge case inputs.

    WHY THIS MATTERS:
    -----------------
    Users (and the model) may provide unexpected inputs:
    - Empty strings when text is expected
    - Zero or negative numbers
    - Special characters (emoji, HTML, SQL injection attempts)

    Tools should handle these gracefully without crashing.
    A crash returns no useful information and breaks the conversation.

    REFERENCE:
    ----------
    - docs/mcp-development-guidelines.md: "Validate inputs gracefully"
    """

    @pytest.mark.asyncio
    async def test_handles_empty_string_inputs(self):
        """
        TEST: Tools should handle empty string inputs gracefully.

        WHY: Users may submit forms with empty fields, or the model
        may pass "" when it means "no preference". Tools should not crash.

        FIX: Use default values or validate with helpful messages:
            title = payload.title or "Untitled"
        """
        from main import handle_call_tool, WIDGETS, WIDGET_INPUT_MODELS

        violations = []

        for widget in WIDGETS:
            input_model = WIDGET_INPUT_MODELS.get(widget.identifier)
            if not input_model:
                continue

            empty_args = {}
            for field_name, field_info in input_model.model_fields.items():
                if field_info.annotation == str or str(field_info.annotation) == "<class 'str'>":
                    empty_args[field_name] = ""

            if not empty_args:
                continue

            request = types.CallToolRequest(
                method="tools/call",
                params=types.CallToolRequestParams(
                    name=widget.identifier,
                    arguments=empty_args,
                ),
            )

            try:
                result = await handle_call_tool(request)
                if result.root.isError:
                    error_text = result.root.content[0].text.lower()
                    if 'empty' not in error_text and 'required' not in error_text:
                        violations.append(
                            f"  - {widget.identifier}: unhelpful error for empty strings"
                        )
            except Exception as e:
                violations.append(
                    f"  - {widget.identifier}: CRASHED on empty strings ({type(e).__name__})"
                )

        tested = len([w for w in WIDGETS if WIDGET_INPUT_MODELS.get(w.identifier)])
        score = 1.0 - (len(violations) / tested) if tested > 0 else 1.0
        _report.add_result(GradeResult(
            category="6. Boundary Values",
            check_name="Handles empty strings",
            passed=len(violations) == 0,
            score=score,
            details="\n".join(violations) if violations else "",
            weight=1.0,
            fix_hint="Use defaults: title = payload.title or 'Untitled'",
        ))

        assert len(violations) == 0, f"""
EMPTY STRING ERROR: Tools crash on empty input
{chr(10).join(violations)}

Why: Users/model may pass "" for optional params; crashes break the flow.
Fix: Use defaults (title = payload.title or "Untitled") or validate gracefully.
Ref: docs/mcp-development-guidelines.md
"""

    @pytest.mark.asyncio
    async def test_handles_zero_and_negative_numbers(self):
        """
        TEST: Tools should handle zero and negative numbers gracefully.

        WHY: Zero and negative values are valid in many contexts (price=0
        for free items, offset=-1 for "from end"). Tools should either
        accept them or return helpful validation errors.
        """
        from main import handle_call_tool, WIDGETS, WIDGET_INPUT_MODELS

        violations = []

        for widget in WIDGETS:
            input_model = WIDGET_INPUT_MODELS.get(widget.identifier)
            if not input_model:
                continue

            for field_name, field_info in input_model.model_fields.items():
                annotation = field_info.annotation
                is_numeric = annotation in (int, float) or str(annotation) in ('<class \'int\'>', '<class \'float\'>')

                if not is_numeric:
                    continue

                for test_value in [0, -1]:
                    request = types.CallToolRequest(
                        method="tools/call",
                        params=types.CallToolRequestParams(
                            name=widget.identifier,
                            arguments={field_name: test_value},
                        ),
                    )

                    try:
                        await handle_call_tool(request)
                    except Exception as e:
                        violations.append(
                            f"  - {widget.identifier}.{field_name}={test_value}: CRASHED ({type(e).__name__})"
                        )

        score = 1.0 if len(violations) == 0 else 0.5
        _report.add_result(GradeResult(
            category="6. Boundary Values",
            check_name="Handles zero/negative numbers",
            passed=len(violations) == 0,
            score=score,
            details="\n".join(violations) if violations else "",
            weight=1.0,
            fix_hint="Validate numeric ranges with helpful errors, don't crash",
        ))

        assert len(violations) == 0, f"""
NUMERIC BOUNDARY ERROR: Tools crash on 0 or negative numbers
{chr(10).join(violations)}

Why: Zero/negative are valid in many contexts (price=0, count=0).
Fix: Validate with helpful errors or clamp to valid range.
Ref: docs/mcp-development-guidelines.md
"""

    @pytest.mark.asyncio
    async def test_handles_special_characters(self):
        """
        TEST: Tools should handle special characters without crashing.

        WHY: User input may contain:
        - Emoji (unicode)
        - HTML tags (potential XSS)
        - SQL-like syntax (injection attempts)
        - Newlines and tabs

        Tools must handle these safely - either sanitize or process correctly.
        """
        from main import handle_call_tool, WIDGETS, WIDGET_INPUT_MODELS

        special_inputs = [
            '<script>alert("xss")</script>',  # XSS attempt
            "'; DROP TABLE users; --",  # SQL injection attempt
            "emoji: \U0001F389\U0001F680",  # Unicode emoji
            "line1\nline2\ttab",  # Control characters
        ]

        violations = []

        for widget in WIDGETS:
            input_model = WIDGET_INPUT_MODELS.get(widget.identifier)
            if not input_model:
                continue

            string_field = None
            for field_name, field_info in input_model.model_fields.items():
                if field_info.annotation == str or str(field_info.annotation) == "<class 'str'>":
                    string_field = field_name
                    break

            if not string_field:
                continue

            for special in special_inputs:
                request = types.CallToolRequest(
                    method="tools/call",
                    params=types.CallToolRequestParams(
                        name=widget.identifier,
                        arguments={string_field: special},
                    ),
                )

                try:
                    await handle_call_tool(request)
                except Exception as e:
                    violations.append(
                        f"  - {widget.identifier}: CRASHED on special chars ({type(e).__name__})"
                    )
                    break

        tested = len([w for w in WIDGETS if WIDGET_INPUT_MODELS.get(w.identifier)])
        score = 1.0 - (len(violations) / tested) if tested > 0 else 1.0
        _report.add_result(GradeResult(
            category="6. Boundary Values",
            check_name="Handles special characters",
            passed=len(violations) == 0,
            score=score,
            details="\n".join(violations) if violations else "",
            weight=1.2,
            fix_hint="Sanitize inputs or handle encoding errors gracefully",
        ))

        assert len(violations) == 0, f"""
SPECIAL CHARACTER ERROR: Tools crash on special characters
{chr(10).join(violations)}

Why: User input may contain emoji, HTML, SQL-like syntax, or control chars.
Fix: Sanitize HTML (html.escape), use parameterized queries, handle encoding.
Ref: docs/mcp-development-guidelines.md
"""


# =============================================================================
# REPORT GENERATION
# =============================================================================

class TestGenerateReport:
    """Final test to generate and display the grade report."""

    def test_zzz_generate_output_quality_report(self, capsys):
        """Generate final grade report (zzz_ prefix ensures it runs last)."""
        report = _report.generate_report()
        print("\n" + report)

        # Write to file
        report_path = Path(__file__).parent / "output_quality_report.txt"
        report_path.write_text(report)

        # Check overall grade
        overall = _report.get_overall_score()
        grade = _report.get_grade_letter()

        # Pass if grade is C or better
        assert overall >= 70, f"""
OUTPUT QUALITY: {grade} ({overall:.1f}%) - Below 70% threshold
Report: server/tests/output_quality_report.txt
Ref: docs/what-makes-a-great-chatgpt-app.md
"""
