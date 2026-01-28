# Widget Development Patterns

This document covers the project-specific patterns and hooks for building widgets in this MCP App Template.

---

## Basic Widget Structure

Every widget follows this pattern:

```tsx
// src/my-widget/index.tsx
import { createRoot } from "react-dom/client";
import { useWidgetProps } from "../use-widget-props";
import { useTheme } from "../use-theme";

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

---

## Core Hooks

### `useWidgetProps<T>()`

Retrieves the structured content passed from the MCP server via the host's `window.openai.toolOutput`.

```tsx
// Widget receives data via the host interface
const props = useWidgetProps<MyDataType>();

// Props structure matches structuredContent from server
// server/main.py returns:
structuredContent = {
    "title": "My Title",
    "items": [...]
}
// Widget receives: { title: "My Title", items: [...] }
```

**Important:** Always handle the `null` case while props are loading:

```tsx
if (!props) return <div className="p-4">Loading...</div>;
```

### `useTheme()`

Returns the current theme: `"light"` or `"dark"`. Widgets MUST support both themes.

```tsx
const theme = useTheme();
```

---

## Theme Support (REQUIRED)

All widgets MUST support both light and dark themes. Two approaches:

### Option 1: Tailwind dark mode classes

```tsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
```

### Option 2: Conditional styling with `useTheme()`

```tsx
const theme = useTheme();

<div className={theme === "dark" ? "bg-gray-900 text-white" : "bg-white text-gray-900"}>
```

### Theme-aware color palette

| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| Background | `bg-white` | `bg-gray-900` |
| Text | `text-gray-900` | `text-white` |
| Secondary text | `text-gray-600` | `text-gray-400` |
| Borders | `border-gray-200` | `border-gray-700` |
| Cards | `bg-gray-50` | `bg-gray-800` |

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  MCP Server (server/main.py)                                    │
│                                                                 │
│  structuredContent = { "title": "...", "items": [...] }        │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  MCP Apps Host (Claude, ChatGPT, VS Code, Goose)                │
│                                                                 │
│  window.openai.toolOutput = structuredContent                   │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Widget (src/my-widget/index.tsx)                               │
│                                                                 │
│  const props = useWidgetProps<MyWidgetProps>();                 │
│  // props = { title: "...", items: [...] }                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Common Patterns

### Handling empty states

```tsx
function MyWidget() {
  const props = useWidgetProps<MyWidgetProps>();

  if (!props) return <div className="p-4">Loading...</div>;
  if (props.items.length === 0) return <div className="p-4">No items found</div>;

  return (/* render items */);
}
```

### Responsive layouts

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {props.items.map(item => (
    <Card key={item.id} item={item} />
  ))}
</div>
```

### Interactive elements with callbacks

```tsx
function handleClick(itemId: string) {
  // For now, widgets are read-only displays
  // Future: window.openai.callTool() for server actions
  console.log("Selected:", itemId);
}
```

---

## Project Structure

```
src/
├── my-widget/
│   └── index.tsx        # Widget entry point
├── use-widget-props.ts  # Shared hook for reading tool output
├── use-theme.ts         # Shared hook for theme detection
├── use-host-global.ts   # Low-level hook for host globals
└── index.css            # Shared Tailwind styles
```

Each widget:
1. Lives in its own directory under `src/`
2. Has a single `index.tsx` entry point
3. Imports shared hooks from parent directory
4. Gets built to `assets/{widget-name}.html` by `build-all.mts`
