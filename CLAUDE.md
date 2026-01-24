# CLAUDE.md

ChatGPT App template: React widgets + Python MCP server. Widgets render inside ChatGPT via the Apps SDK.

## Commands

```bash
./setup.sh           # First-time setup (installs deps, builds, tests)
pnpm run build       # Build widgets (REQUIRED before server)
pnpm run test        # Run all tests (ALWAYS run after changes)
pnpm run server      # Start MCP server at localhost:8000
pnpm run ui-test --widget <name>  # Visual test a widget
```

**Workflow:** `pnpm run build && pnpm run test && pnpm run ui-test --widget <name>`

## File Structure

| Path | Purpose |
|------|---------|
| `src/{widget}/index.tsx` | Widget entry point |
| `src/*.ts` | Shared hooks (useWidgetProps, useTheme) |
| `server/main.py` | MCP server - tools and handlers |
| `build-all.mts:6` | Widget targets (add new widgets here) |

## Critical Rules

- **Build before server:** `pnpm run build` must complete before `pnpm run server`
- **Restart after rebuild:** Server caches HTML; restart after rebuilding
- **Input models:** All Pydantic `*Input` models MUST have `extra='forbid'` and defaults
- **Theme support:** Widgets MUST work in both light and dark modes
- **Test after changes:** ALWAYS run `pnpm run test` after any code change
- **MCP best practices:** Tests grade the server against MCP guidelines (see `server/tests/mcp_best_practices_report.txt`)

## Documentation

Read these before building:

- `docs/building-guide.md` - Detailed patterns, examples, and advanced workflows
- `docs/mcp-server-guidelines-for-ai-agents.md` - MCP best practices (tool naming, descriptions, error handling)
- `docs/openai_apps_sdk_docs.md` - OpenAI Apps SDK (display modes, UX guidelines)

## Adding a Widget

1. Create `src/my-widget/index.tsx` with React component
2. Add `"my-widget"` to `build-all.mts:6`
3. Add Input model, Widget config, and handler in `server/main.py`
4. Run `pnpm run build && pnpm run test && pnpm run ui-test --widget my-widget`

## Local Simulator

```bash
pnpm run build && pnpm run server
# Open http://localhost:8000/assets/simulator.html
```

No API key required - uses Puter.js fallback for testing.

## VPS / Remote Deployment

When running on a VPS or accessing via public IP, set `BASE_URL`:

```bash
BASE_URL=http://YOUR_IP:8000/assets pnpm run server
```

Or use a `.env` file at the repo root (see `.env.example`).
