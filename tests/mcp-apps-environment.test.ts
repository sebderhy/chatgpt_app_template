/**
 * MCP Apps Environment Compatibility Tests
 *
 * These tests verify that the codebase works correctly in MCP Apps hosts
 * (Claude, VS Code, Goose, basic-host) where window.openai does NOT exist.
 *
 * Reference: https://modelcontextprotocol.io/docs/extensions/apps
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Find lines with unsafe window.openai access (without optional chaining).
 * Returns array of "filename:line: content" strings.
 */
function findUnsafeOpenAiAccess(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const unsafe: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;
    // Match window.openai. NOT followed by optional chaining
    if (/window\.openai(?!\?)\./.test(line)) {
      unsafe.push(`${path.basename(filePath)}:${i + 1}: ${line.trim()}`);
    }
  }
  return unsafe;
}

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8");
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const HOOK_FILES = [
  "use-host-global.ts",
  "use-widget-props.ts",
  "use-widget-state.ts",
  "use-theme.ts",
  "use-display-mode.ts",
  "use-max-height.ts",
];

// Infrastructure that simulates OpenAI environment (skip checks)
const INFRASTRUCTURE_DIRS = ["apptester"];

// Example widgets that ship with template (warn but don't fail)
const EXAMPLE_WIDGETS = [
  "boilerplate",
  "carousel",
  "list",
  "gallery",
  "dashboard",
  "solar-system",
  "todo",
  "shop",
  "travel-map",
];

// =============================================================================
// TESTS: HOOKS
// =============================================================================

describe("MCP Apps Environment Compatibility", () => {
  describe("Hooks use optional chaining for window.openai", () => {
    it.each(HOOK_FILES)("hook '%s' has no unsafe window.openai access", (file) => {
      const unsafe = findUnsafeOpenAiAccess(path.resolve("src", file));
      if (unsafe.length > 0) {
        expect.fail(
          `Hook '${file}' has unsafe window.openai access.\n` +
            `Use window.openai?.property instead.\n` +
            `Lines:\n${unsafe.map((l) => `  - ${l}`).join("\n")}`
        );
      }
    });
  });

  describe("useHostGlobal hook specifics", () => {
    it("uses optional chaining in getSnapshot", () => {
      expect(readFile("src/use-host-global.ts")).toMatch(/window\.openai\?\.\[key\]/);
    });

    it("handles SSR with typeof window check", () => {
      expect(readFile("src/use-host-global.ts")).toMatch(
        /typeof\s+window\s*===\s*["']undefined["']/
      );
    });
  });

  describe("useWidgetState hook specifics", () => {
    it("uses optional chaining when calling setWidgetState", () => {
      expect(readFile("src/use-widget-state.ts")).toMatch(/window\.openai\?\.\s*setWidgetState/);
    });
  });

  describe("Types", () => {
    it("declares Window interface with openai", () => {
      const content = readFile("src/types.ts");
      expect(content).toMatch(/declare\s+global/);
      expect(content).toMatch(/interface\s+Window/);
    });
  });
});

// =============================================================================
// TESTS: WIDGETS
// =============================================================================

describe("MCP Apps Widget Compatibility", () => {
  const widgetDirs = fs
    .readdirSync(path.resolve("src"))
    .filter(
      (name) =>
        fs.statSync(path.resolve("src", name)).isDirectory() &&
        fs.existsSync(path.resolve("src", name, "index.tsx")) &&
        !INFRASTRUCTURE_DIRS.includes(name)
    );

  it.each(widgetDirs)("widget '%s' is MCP Apps compatible", (widget) => {
    const widgetDir = path.resolve("src", widget);
    const files = fs
      .readdirSync(widgetDir)
      .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

    const allUnsafe: string[] = [];
    for (const file of files) {
      allUnsafe.push(...findUnsafeOpenAiAccess(path.join(widgetDir, file)));
    }

    if (allUnsafe.length > 0) {
      if (EXAMPLE_WIDGETS.includes(widget)) {
        // Warn for example widgets (they'll be deleted)
        console.warn(
          `[WARN] Example widget '${widget}' uses window.openai without optional chaining.\n` +
            `Issues:\n${allUnsafe.map((l) => `  - ${l}`).join("\n")}`
        );
      } else {
        // Fail for user-created widgets
        expect.fail(
          `Widget '${widget}' has unsafe window.openai access.\n` +
            `Use hooks (useWidgetProps, useTheme) or add optional chaining.\n` +
            `Issues:\n${allUnsafe.map((l) => `  - ${l}`).join("\n")}`
        );
      }
    }
  });
});
