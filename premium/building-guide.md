# ChatGPT App Builder - Premium Guide

This guide provides detailed patterns, examples, and workflows for building high-quality ChatGPT apps.

---

## MCP Server Best Practices

### Tool Naming Convention

Use `verb_noun` format, lowercase with underscores:

```python
# GOOD
def show_carousel(...), def create_order(...), def search_products(...)

# BAD
def Carousel(...), def getOrder(...), def productSearch(...)
```

### Tool Count Guidelines

| Server Type | Recommended | Rationale |
|-------------|-------------|-----------|
| Focused utility | 3-7 tools | Single responsibility |
| Platform integration | 10-20 tools | Organized into toolsets |

### Rich Tool Descriptions (REQUIRED)

Every tool MUST have this structure:

```python
"""
Brief description of what the tool does.

Use this tool when:
- User asks for X
- User wants to Y

Args:
    param1: Description with type and default
    param2: Description with constraints

Returns:
    Description of output structure with field details

Example:
    tool_name(param1="value", param2=10)
"""
```

### Error Handling

Return actionable error messages that suggest next steps:

```python
# GOOD: Suggests what to do next
return f"Error: File not found: {path}. Use list_files() to see available files."

# BAD: Unhelpful
return "Error"
```

### Server Instructions

Always provide instructions in FastMCP initialization:

```python
mcp = FastMCP(
    name="my-server",
    instructions="""
    ## Tool Selection Guide
    - For X, use tool_a
    - For Y, use tool_b

    ## Common Workflows
    1. First call A to get context
    2. Then call B to perform action
    """,
    stateless_http=True
)
```

### Input Model Requirements

All Pydantic input models MUST have:

```python
class MyInput(BaseModel):
    """Docstring describing the input."""
    field: str = Field(default="value", description="What this field does")
    model_config = ConfigDict(populate_by_name=True, extra="forbid")
```

---

## Widget Development Patterns

### Basic Widget Structure

```tsx
// src/my-widget/index.tsx
import { createRoot } from "react-dom/client";
import { useWidgetProps } from "../useWidgetProps";
import { useTheme } from "../useTheme";

interface MyWidgetProps {
  title: string;
  items: Item[];
}

function MyWidget() {
  const props = useWidgetProps<MyWidgetProps>();
  const theme = useTheme(); // "light" | "dark"

  if (!props) return <div className="p-4">Loading...</div>;

  return (
    <div className={`p-4 ${theme === "dark" ? "bg-gray-900 text-white" : "bg-white text-gray-900"}`}>
      <h1 className="text-xl font-bold">{props.title}</h1>
      {/* Widget content */}
    </div>
  );
}

createRoot(document.getElementById("my-widget-root")!).render(<MyWidget />);
```

### Theme Support (REQUIRED)

All widgets MUST support both light and dark themes:

```tsx
const theme = useTheme();

// Option 1: Tailwind dark mode classes
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">

// Option 2: Conditional styling
<div className={theme === "dark" ? "bg-gray-900" : "bg-white"}>
```

### Reading Tool Output

```tsx
// Widget receives data via window.openai.toolOutput
const props = useWidgetProps<MyDataType>();

// Props structure matches structuredContent from server
// server/main.py returns:
structuredContent = {
    "title": "My Title",
    "items": [...]
}
// Widget receives: { title: "My Title", items: [...] }
```

---

## OpenAI UX Guidelines

### Display Modes

| Mode | Use Case | Max Height |
|------|----------|------------|
| **Inline Card** | Single action, quick info, self-contained widgets | Auto-fit content |
| **Inline Carousel** | 3-8 similar items to browse (restaurants, products) | Fixed card height |
| **Fullscreen** | Rich tasks, multi-step workflows, detailed browsing | Full viewport |
| **Picture-in-Picture** | Persistent live sessions (games, videos) | Fixed floating size |

### Card Rules (MUST FOLLOW)

1. **Max 2 primary actions** per card
2. **No nested scrolling** - cards must auto-fit content
3. **No deep navigation** - no tabs, multiple drill-ins within cards
4. **No duplicative inputs** - don't replicate ChatGPT features

### Carousel Rules

1. **3-8 items** per carousel for scannability
2. **Always include image** for carousel items
3. **Max 3 lines** of metadata text
4. **Single CTA** per item (e.g., "Book", "Play")

### Visual Guidelines

1. **Use system colors** - don't override text/background colors
2. **Use system fonts** - inherit platform font stack
3. **Respect spacing** - use consistent margins and padding
4. **Support themes** - light AND dark mode required

---

## Complete Widget Addition Walkthrough

### Step 1: Create Widget Source

```bash
mkdir -p src/my-widget
```

```tsx
// src/my-widget/index.tsx
import { createRoot } from "react-dom/client";
import { useWidgetProps } from "../useWidgetProps";
import { useTheme } from "../useTheme";

interface MyWidgetProps {
  title: string;
  // ... other fields
}

function MyWidget() {
  const props = useWidgetProps<MyWidgetProps>();
  const theme = useTheme();

  if (!props) return <div className="p-4">Loading...</div>;

  return (
    <div className={`p-4 ${theme === "dark" ? "bg-gray-900 text-white" : "bg-white text-gray-900"}`}>
      <h1 className="text-xl font-bold">{props.title}</h1>
      {/* Your widget content */}
    </div>
  );
}

createRoot(document.getElementById("my-widget-root")!).render(<MyWidget />);
```

### Step 2: Register in Build System

Edit `build-all.mts:6`:

```typescript
const targets = [
  "boilerplate",
  "carousel",
  // ... existing widgets
  "my-widget",  // Add here
];
```

### Step 3: Add Server Handler

Edit `server/main.py`:

```python
# 1. Add Input model (near other Input classes)
class MyWidgetInput(BaseModel):
    """Input for my widget."""
    title: str = Field(default="My Widget", description="Widget title")
    # Add other fields with defaults
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

# 2. Add Widget definition in create_widgets()
Widget(
    identifier="show_my_widget",
    title="Show My Widget",
    description="""Brief description of what this widget does.

Use this tool when:
- User wants to X
- User needs to Y

Args:
    title: Widget header text (default: "My Widget")

Returns:
    Interactive widget with:
    - Feature A
    - Feature B

Example:
    show_my_widget(title="Custom Title")""",
    template_uri="ui://widget/my-widget.html",
    invoking="Loading my widget...",
    invoked="My widget ready",
    html=load_widget_html("my-widget"),
),

# 3. Add to WIDGET_INPUT_MODELS dict
WIDGET_INPUT_MODELS: Dict[str, type] = {
    # ... existing entries
    "show_my_widget": MyWidgetInput,
}

# 4. Add handler function
async def handle_my_widget(widget: Widget, arguments: Dict[str, Any]) -> types.ServerResult:
    try:
        payload = MyWidgetInput.model_validate(arguments)
    except ValidationError as e:
        error_msg = format_validation_error(e, MyWidgetInput)
        return types.ServerResult(types.CallToolResult(
            content=[types.TextContent(type="text", text=error_msg)],
            isError=True,
        ))

    structured_content = {
        "title": payload.title,
        # ... other data
    }

    return types.ServerResult(types.CallToolResult(
        content=[types.TextContent(type="text", text=f"My Widget: {payload.title}")],
        structuredContent=structured_content,
        _meta=get_invocation_meta(widget),
    ))

# 5. Add routing in handle_call_tool()
elif tool_name == "show_my_widget":
    return await handle_my_widget(widget, arguments)
```

### Step 4: Build and Test

```bash
pnpm run build
pnpm run test
pnpm run ui-test --widget my-widget
# Read /tmp/ui-test/screenshot.png to verify
```

---

## Pre-Submission Checklist

Before deploying to ChatGPT, verify:

### MCP Server
- [ ] Tool names use `verb_noun` format
- [ ] All tools have rich descriptions with Args, Returns, Example
- [ ] Error messages suggest next steps
- [ ] Server instructions explain tool selection
- [ ] Input models have `extra='forbid'` and defaults

### Widget UX
- [ ] Supports both light and dark themes
- [ ] No nested scrolling in cards
- [ ] Max 2 primary actions per card
- [ ] Carousel has 3-8 items with images
- [ ] Uses system colors and fonts

### Testing
- [ ] `pnpm run test` passes (all 282 tests)
- [ ] `pnpm run ui-test` shows correct rendering
- [ ] Tested in simulator with real prompts

---

## Troubleshooting

### Widget not rendering
1. Check `pnpm run build` completed successfully
2. Restart server after build (`pnpm run server`)
3. Check browser console for errors
4. Verify widget is in `build-all.mts` targets

### Tool not appearing
1. Check widget is in `WIDGETS` list in `server/main.py`
2. Verify tool handler is added to `handle_call_tool()`
3. Check for Python syntax errors in server

### Tests failing
1. Ensure `extra='forbid'` on all Input models
2. Check all Input fields have defaults
3. Verify widget HTML exists in `assets/`
