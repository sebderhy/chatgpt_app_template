# AGENTS.md

ChatGPT App template: React widgets + Python MCP server. Widgets render inside ChatGPT via the Apps SDK.

## Commands

```bash
./setup.sh           # First-time setup (installs deps, builds, tests)
pnpm run build       # Build widgets (REQUIRED before server)
pnpm run test        # Server + UI tests (run after every change)
pnpm run test:all    # All tests including browser (requires Playwright)
pnpm run server      # Start MCP server at localhost:8000
pnpm run ui-test --widget <name>  # Visual test a widget
```

**Workflow:** `pnpm run build && pnpm run test && pnpm run ui-test --widget <name>`

**Thorough check:** `pnpm run build && pnpm run test:all`

## File Structure

| Path | Purpose |
|------|---------|
| `src/{widget}/index.tsx` | Widget entry point |
| `src/*.ts` | Shared hooks (useWidgetProps, useTheme) |
| `server/main.py` | MCP server - tools and handlers |
| `build-all.mts:18` | Widget targets (add new widgets here) |
| `tests/*.test.ts` | UI unit tests (Vitest) |
| `tests/browser/*.spec.ts` | Browser compliance tests (Playwright) |
| `server/tests/test_*.py` | Server tests and grading (pytest) |

## Critical Rules

- **Build before server:** `pnpm run build` must complete before `pnpm run server`
- **Restart after rebuild:** Server caches HTML; restart after rebuilding
- **Input models:** All Pydantic `*Input` models MUST have `extra='forbid'` and defaults
- **Theme support:** Widgets MUST work in both light and dark modes
- **Test after changes:** ALWAYS run `pnpm run test` after any code change
- **MCP best practices:** Tests grade the server against MCP guidelines (run `pnpm run test` to generate `server/tests/mcp_best_practices_report.txt`)
- **ChatGPT app guidelines:** Tests grade against OpenAI's app design guidance (generates `server/tests/chatgpt_app_guidelines_report.txt`)
- **Output quality:** Tests grade tool output quality - schema stability, null handling, response size (generates `server/tests/output_quality_report.txt`)

## Documentation

Read these before building:

- `docs/README.md` - Step-by-step walkthrough for adding widgets (start here)
- `docs/what-makes-a-great-chatgpt-app.md` - Know/Do/Show framework, capability design, conversation patterns
- `docs/widget-development.md` - Project-specific hooks (`useWidgetProps`, `useTheme`), patterns
- `docs/mcp-development-guidelines.md` - MCP best practices (tool naming, descriptions, error handling)
- `docs/openai-apps-sdk-llms.txt` - OpenAI Apps SDK index (lightweight map of all docs)
- `docs/openai-apps-sdk-llms-full.txt` - Full OpenAI Apps SDK documentation

## Adding a Widget

1. Create `src/my-widget/index.tsx` with React component
2. Add `"my-widget"` to `build-all.mts:18`
3. Add Input model, Widget config, and handler in `server/main.py`
4. Run `pnpm run build && pnpm run test && pnpm run ui-test --widget my-widget`

## Finalizing Your App

After building your widgets, remove the template examples:

1. Delete example widget folders from `src/` (boilerplate, carousel, list, gallery, dashboard, solar-system, todo, shop, travel-map)
2. Remove example entries from `build-all.mts:18` targets array
3. Remove example Input models, Widget configs, and handlers from `server/main.py`
4. Remove unused dependencies from `package.json` (e.g., `three`, `@react-three/*` if not using 3D)
5. Run `pnpm install && pnpm run build && pnpm run test:all` to verify everything works

See `docs/README.md` for the detailed cleanup checklist.

## Local Simulator

```bash
pnpm run build && pnpm run server
# Open http://localhost:8000/assets/simulator.html
```

No API key required - uses Puter.js fallback for testing.

## Browser Compliance Tests

Browser tests (`tests/browser/*.spec.ts`) run each widget in a real Chromium browser:

| Test | What it catches |
|------|-----------------|
| No JS errors | Syntax errors, missing imports, runtime exceptions |
| Renders content | Empty widgets, failed hydration |
| Dark theme works | Theme-specific bugs, hardcoded colors |
| No unhandled rejections | Async errors, failed API calls |
| Images have alt text | Accessibility issues for screen readers |
| No duplicate IDs | HTML validity issues |
| Text contrast (warning) | WCAG AA contrast ratio violations |
| Keyboard accessible (warning) | Missing tabindex or ARIA roles |

Setup (one-time):
```bash
pnpm run setup:test              # Install Playwright browsers
npx playwright install-deps      # Install system deps (may need sudo)
```

Run: `pnpm run test:browser`

Tests auto-discover widgets from `/tools` endpoint and skip gracefully if browser dependencies aren't installed.

## VPS / Remote Deployment

When running on a VPS or accessing via public IP, set `BASE_URL`:

```bash
BASE_URL=http://YOUR_IP:8000/assets pnpm run server
```

Or use a `.env` file at the repo root (see `.env.example`).
