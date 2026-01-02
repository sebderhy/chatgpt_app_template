# ChatGPT App Template

A comprehensive template for building ChatGPT Apps using the Apps SDK with MCP (Model Context Protocol) servers.

## Acknowledgments

This template is based on examples from OpenAI's official Apps SDK Examples repository:
**https://github.com/openai/openai-apps-sdk-examples**

The widget examples (carousel, gallery, dashboard, todo, shop, etc.) and React hooks for `window.openai` integration are adapted from that repository. Thank you to the OpenAI team for providing these excellent examples.

## Demo

https://github.com/user-attachments/assets/f5877544-0dce-4c31-979e-50b5533f9a16

## Using This Template

Click the **"Use this template"** button on GitHub, or clone and remove the git history:

```bash
git clone https://github.com/YOUR_USERNAME/chatgpt-app-template.git my-chatgpt-app
cd my-chatgpt-app
rm -rf .git
git init
```

## Overview

This repository provides everything you need to build ChatGPT Apps:

- **React Widget** - TypeScript/React UI that renders inside ChatGPT
- **Python MCP Server** - FastAPI-based server that handles tool calls
- **Apps SDK UI Components** - Pre-styled components that match ChatGPT's design system
- **React Hooks** - Utilities for interacting with the ChatGPT host

## Architecture

```
User Prompt → ChatGPT Model → MCP Tool Call → Your Server → Tool Response
                                                              ↓
                                               structuredContent + _meta
                                                              ↓
                                               Widget renders in ChatGPT
                                               (reads window.openai.toolOutput)
```

## Quick Start

### 1. Install Dependencies

```bash
# Install Node.js dependencies
pnpm install

# Create Python virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r server/requirements.txt
```

### 2. Build the Widget

```bash
pnpm run build
```

This creates hashed assets in the `assets/` directory.

### 3. Start the MCP Server

```bash
pnpm run server
```

This starts the server on http://localhost:8000 and serves both the MCP endpoint and widget assets.

### 4. Test in ChatGPT

1. Enable [Developer Mode](https://platform.openai.com/docs/guides/developer-mode) in ChatGPT
2. Expose your MCP server with ngrok:
   ```bash
   ngrok http 8000 --host-header=rewrite
   ```
3. In ChatGPT Settings → Connectors, add a new connector with your ngrok URL + `/mcp`
4. In a chat, add the connector and try: "Show me the boilerplate widget"

## Included Widget Examples

This template includes several widget examples to help you get started:

| Widget | Description |
|--------|-------------|
| `boilerplate` | Basic interactive card with state management |
| `carousel` | Horizontal scrolling cards (restaurants, products) |
| `list` | Vertical list with thumbnails and rankings |
| `gallery` | Image grid with lightbox viewer |
| `dashboard` | Stats, metrics, and activity feed |
| `solar-system` | Interactive 3D visualization (Three.js) |
| `todo` | Multi-list task manager with drag-and-drop |
| `shop` | E-commerce cart with checkout flow |

Try them by asking ChatGPT: *"Show me the carousel"*, *"Show me the dashboard"*, etc.

## Project Structure

```
├── src/                          # Widget source code
│   ├── boilerplate/              # Example widget
│   │   ├── index.tsx             # Entry point (mounts React app)
│   │   └── App.tsx               # Main component
│   ├── types.ts                  # TypeScript types for window.openai
│   ├── use-openai-global.ts      # Hook to read window.openai properties
│   ├── use-widget-state.ts       # Hook for persisted widget state
│   ├── use-widget-props.ts       # Hook to read tool output
│   ├── use-display-mode.ts       # Hook for display mode
│   ├── use-max-height.ts         # Hook for height constraints
│   ├── use-theme.ts              # Hook for light/dark theme
│   └── index.css                 # Global styles + Tailwind
│
├── server/                       # Python MCP server
│   ├── main.py                   # Server implementation
│   ├── requirements.txt          # Python dependencies
│   ├── requirements-dev.txt      # Test dependencies
│   └── tests/                    # Server test suite
│       ├── test_input_validation.py
│       ├── test_tool_handlers.py
│       ├── test_widget_loading.py
│       ├── test_mcp_endpoints.py
│       └── test_openai_compliance.py
│
├── assets/                       # Built widget bundles (generated)
│
├── package.json                  # Node.js dependencies
├── vite.config.mts               # Vite dev server config
├── build-all.mts                 # Production build script
├── tailwind.config.ts            # Tailwind configuration
└── tsconfig.json                 # TypeScript configuration
```

## Testing

This template includes a comprehensive test suite (297 tests) to verify your app works correctly **before** testing in ChatGPT. This saves time by catching issues locally instead of going through the tedious connect-to-ChatGPT cycle.

### Quick Start

```bash
# Install all dependencies
pnpm install
pip install -r server/requirements-dev.txt

# Run all tests (server + UI)
pnpm run test

# Run tests with coverage
pnpm run test:cov

# Run only server tests
pnpm run test:server

# Run only UI tests
pnpm run test:ui
pnpm run test:ui:watch  # Watch mode for development
```

### Server Tests (Python)

| Test File | What It Checks |
|-----------|----------------|
| `test_input_validation.py` | Pydantic models accept valid inputs, use defaults, reject unknown fields |
| `test_tool_handlers.py` | Handlers return correct `structuredContent` structure, custom inputs pass through |
| `test_widget_loading.py` | Widget HTML loads from assets, fallback to hashed filenames works |
| `test_mcp_endpoints.py` | MCP protocol (list_tools, list_resources, call_tool) works correctly |
| `test_openai_compliance.py` | Responses comply with OpenAI Apps SDK format requirements |

### UI Tests (Vitest)

| Test File | What It Checks |
|-----------|----------------|
| `widget-structure.test.ts` | Entry points exist and target correct root element ID (required by build system) |
| `hooks.test.tsx` | React hooks correctly read from and sync with `window.openai` |
| `build-output.test.ts` | Build produces expected files with correct asset references and URLs |
| `openai-types.test.ts` | TypeScript types cover all required OpenAI globals and APIs |

### Why This Matters

The tests are **infrastructure-focused**, not business-logic-focused. This means:

- **You don't need to modify tests** when customizing widgets or changing sample data
- Tests verify the *shape* of responses (e.g., `structuredContent` has `title` and `items`)
- Tests verify OpenAI format compliance (correct MIME types, required metadata fields)
- Tests verify widget structure patterns (entry points, hooks, build output)

### Recommended Workflow

1. Modify your widgets in `src/` and handlers in `server/main.py`
2. Run `pnpm run build` to build widget assets
3. Run `pnpm run test` to verify everything works
4. If tests pass → connect to ChatGPT for final manual testing

This catches most issues before the slow manual testing phase.

## Development

### Local Development (Hot Reload)

```bash
pnpm run dev
```

This starts a Vite dev server on http://localhost:4444 with hot module replacement.

### Adding a New Widget

1. Create a new directory in `src/`:
   ```
   src/my-widget/
   ├── index.tsx
   └── App.tsx
   ```

2. Add the widget name to `build-all.mts`:
   ```typescript
   const targets: string[] = [
     "boilerplate",
     "my-widget",  // Add your widget here
   ];
   ```

3. Add corresponding tools in `server/main.py`

4. Build and test:
   ```bash
   pnpm run build
   ```

## Key Concepts

### Tool Output (structuredContent)

Your MCP server returns `structuredContent` which becomes `window.openai.toolOutput` in the widget:

```python
# Server (Python)
return types.CallToolResult(
    content=[types.TextContent(type="text", text="Widget ready")],
    structuredContent={
        "title": "My Widget",
        "items": [...]
    },
    _meta=get_invocation_meta(widget),
)
```

```tsx
// Widget (React)
const { title, items } = useWidgetProps({ title: "", items: [] });
```

### Widget State

Persist state on the ChatGPT host (survives tool calls):

```tsx
const [state, setState] = useWidgetState({ count: 0 });

// Update state (automatically syncs to host)
setState(prev => ({ ...prev, count: prev.count + 1 }));
```

### Display Modes

Request different display modes:

```tsx
const displayMode = useDisplayMode(); // "inline" | "fullscreen" | "pip"

// Request fullscreen
await window.openai.requestDisplayMode({ mode: "fullscreen" });
```

### Calling Tools from Widget

Call other MCP tools from your widget:

```tsx
const result = await window.openai.callTool("my_tool", { arg: "value" });
```

### Theme Support

Adapt to ChatGPT's theme:

```tsx
const theme = useTheme(); // "light" | "dark"
```

## Tool Metadata

Key `_meta` fields for tools:

| Field | Purpose |
|-------|---------|
| `openai/outputTemplate` | Links tool to widget HTML |
| `openai/toolInvocation/invoking` | Loading message |
| `openai/toolInvocation/invoked` | Completion message |
| `openai/widgetAccessible` | Allow widget to call other tools |
| `openai/resultCanProduceWidget` | Tool can render a widget |
| `openai/visibility` | Set to "private" to hide from model |

## Deployment

### Production Build

```bash
BASE_URL=https://your-cdn.com pnpm run build
```

### Deploy MCP Server

Deploy to any platform that supports Python/FastAPI:
- Fly.io
- Render
- Railway
- Google Cloud Run
- AWS Lambda + API Gateway

Ensure your server:
- Serves on HTTPS
- Has `/mcp` endpoint accessible
- Supports SSE streaming

## Troubleshooting

### Widget doesn't render

1. Check that `pnpm run build` completed successfully
2. Verify `pnpm run serve` is running
3. Check browser console for errors
4. Ensure `mimeType: "text/html+skybridge"` in resource registration

### Python server caching

The server uses `@lru_cache` for widget HTML. Restart the server after rebuilding widgets:

```bash
# Kill and restart the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### CORS errors

Ensure both the asset server and MCP server have CORS enabled. The boilerplate includes CORS middleware by default.

### ngrok issues

Use the `--host-header=rewrite` flag:

```bash
ngrok http 8000 --host-header=rewrite
```

## Resources

- [Apps SDK Documentation](https://developers.openai.com/apps-sdk)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Apps SDK UI Components](https://openai.github.io/apps-sdk-ui/)

## License

MIT
