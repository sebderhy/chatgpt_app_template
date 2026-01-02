# CLAUDE.md

This file provides guidance to Claude Code when working with this ChatGPT App boilerplate.

## Overview

This is a boilerplate for building ChatGPT Apps using the Apps SDK. It includes:
- React widgets (TypeScript) that render inside ChatGPT
- Python MCP server (FastAPI) that handles tool calls
- Build tooling (Vite, Tailwind) for widget bundling

## Key Architecture Pattern

```
ChatGPT → MCP Tool Call → Python Server → structuredContent + widget HTML
                                                    ↓
                                          Widget reads window.openai.toolOutput
```

## Development Commands

```bash
# Build widgets (required before running server)
pnpm run build

# Run tests to verify server works correctly
pnpm run test

# Start Python MCP server (also serves widget assets)
pnpm run server

# Local development with hot reload
pnpm run dev
```

## File Structure

- `src/` - Widget source code (React + TypeScript)
- `src/boilerplate/` - Main boilerplate widget
- `src/*.ts` - Shared hooks for window.openai integration
- `server/main.py` - Python MCP server
- `assets/` - Built widget bundles (generated)

## Adding New Widgets

1. Create `src/my-widget/index.tsx` and `src/my-widget/App.tsx`
2. Add "my-widget" to `targets` array in `build-all.mts`
3. Add corresponding tools in `server/main.py`
4. Run `pnpm run build`
5. Run `pnpm run test` to verify everything works

## Key Files to Modify

- `src/boilerplate/App.tsx` - Main widget UI
- `server/main.py` - Tool definitions and handlers
- `build-all.mts` - Add new widget targets

## Testing

**IMPORTANT: Always run tests after modifying code (server or UI).**

```bash
# Run all tests (server + UI) - 272 tests total
pnpm run test

# Run only server tests
pnpm run test:server

# Run only UI tests
pnpm run test:ui

# Run tests with coverage
pnpm run test:cov
```

### Server Tests (Python - `server/tests/`)
- **Input validation** - All input models (discovered dynamically) work correctly
- **Widget loading** - HTML loads from assets directory
- **MCP protocol** - list_tools, list_resources, call_tool work
- **OpenAI compliance** - Responses match OpenAI Apps SDK format requirements

### UI Tests (Vitest - `tests/`)
- **Widget structure** - Entry points exist, target correct root element ID
- **React hooks** - Hooks read from and sync with `window.openai`
- **Build output** - Build produces correct files with proper asset references
- **OpenAI types** - TypeScript types cover all required globals and APIs

### When to Run Tests

Run `pnpm run test` after:
1. Modifying any handler in `server/main.py`
2. Adding or changing Pydantic input models
3. Adding new widgets or tools
4. Modifying shared React hooks in `src/*.ts`
5. Changing widget entry points or structure

The tests are infrastructure-focused and don't require modification when changing sample data or business logic.

## Important Notes

- Always run `pnpm run build` before starting the Python server
- Always run `pnpm run test` after modifying any code (server or UI)
- Restart Python server after rebuilding (LRU cache)
- Widget HTML must have `mimeType: "text/html+skybridge"`
- Use `window.openai.*` for ChatGPT host communication
- Test files are in `server/tests/` (Python) and `tests/` (TypeScript)
