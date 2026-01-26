# ChatGPT App Template - Docs Index

A step-by-step walkthrough for building widgets with this template. For detailed reference, see the specialized docs listed below.

---

## Documentation Overview

| Document | What it covers |
|----------|----------------|
| [what-makes-a-great-chatgpt-app.md](./what-makes-a-great-chatgpt-app.md) | Know/Do/Show framework, capability design, conversation patterns |
| [mcp-development-guidelines.md](./mcp-development-guidelines.md) | Tool naming, descriptions, error handling, security |
| [widget-development.md](./widget-development.md) | Project-specific hooks (`useWidgetProps`, `useTheme`), patterns |
| [openai-apps-sdk-llms.txt](./openai-apps-sdk-llms.txt) | Official OpenAI Apps SDK documentation index |
| [openai-apps-sdk-llms-full.txt](./openai-apps-sdk-llms-full.txt) | Full OpenAI Apps SDK documentation |

---

## Adding a New Widget

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

See [widget-development.md](./widget-development.md) for detailed patterns.

### Step 2: Register in Build System

Edit `build-all.mts:18`:

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

See [mcp-development-guidelines.md](./mcp-development-guidelines.md) for tool design best practices.

### Step 4: Build and Test

```bash
pnpm run build
pnpm run test
pnpm run ui-test --widget my-widget
# Check /tmp/ui-test/screenshot.png to verify
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
- [ ] `pnpm run test` passes
- [ ] `pnpm run ui-test` shows correct rendering
- [ ] Tested in simulator with real prompts

---

## Finalizing Your App

After building your widgets, clean up the template examples so only your app code remains.

### Files to Remove

**Widget source folders** (`src/`):
- [ ] `boilerplate/`
- [ ] `carousel/`
- [ ] `list/`
- [ ] `gallery/`
- [ ] `dashboard/`
- [ ] `solar-system/`
- [ ] `todo/`
- [ ] `shop/`
- [ ] `travel-map/`

**Build targets** (`build-all.mts:18`):
- [ ] Remove example widget names from the `targets` array (keep only your widgets)

**Server code** (`server/main.py`):
- [ ] Remove example `*Input` classes (BoilerplateInput, CarouselInput, etc.)
- [ ] Remove example Widget definitions from `create_widgets()`
- [ ] Remove example entries from `WIDGET_INPUT_MODELS` dict
- [ ] Remove example `handle_*` functions
- [ ] Remove example routing in `handle_call_tool()`

**Dependencies** (`package.json`):
- [ ] Remove `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `@react-spring/three` if not using 3D
- [ ] Remove `@types/three` from devDependencies if not using 3D
- [ ] Remove any other unused dependencies

### Final Verification

After cleanup, run the full test suite to ensure nothing is broken:

```bash
pnpm install           # Update lockfile after dependency changes
pnpm run build         # Build your widgets
pnpm run test:all      # Run all tests (server, UI, browser)
```

All tests should still pass with only your widgets remaining.

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
