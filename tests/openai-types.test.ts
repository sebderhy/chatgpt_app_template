/**
 * OpenAI Types and API Tests - Infrastructure tests for ChatGPT Apps SDK compliance.
 *
 * These tests verify that the TypeScript types and patterns follow
 * OpenAI's Apps SDK requirements without assuming business logic.
 *
 * Key requirements verified:
 * 1. Type definitions cover all required OpenAI globals
 * 2. API methods have correct signatures
 * 3. Event types are properly defined
 * 4. Display modes and themes match OpenAI spec
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const typesPath = path.resolve("src/types.ts");
const typesContent = fs.readFileSync(typesPath, "utf-8");

describe("OpenAI Types Definition", () => {
  describe("OpenAiGlobals type", () => {
    it("exports OpenAiGlobals type", () => {
      expect(typesContent).toMatch(/export\s+type\s+OpenAiGlobals/);
    });

    it("includes theme property", () => {
      expect(typesContent).toMatch(/theme:\s*Theme/);
    });

    it("includes displayMode property", () => {
      expect(typesContent).toMatch(/displayMode:\s*DisplayMode/);
    });

    it("includes maxHeight property", () => {
      expect(typesContent).toMatch(/maxHeight:\s*number/);
    });

    it("includes toolOutput property", () => {
      expect(typesContent).toMatch(/toolOutput:\s*ToolOutput/);
    });

    it("includes widgetState property", () => {
      expect(typesContent).toMatch(/widgetState:\s*WidgetState/);
    });

    it("includes setWidgetState method", () => {
      expect(typesContent).toMatch(/setWidgetState:\s*\(/);
    });

    it("includes toolInput property", () => {
      expect(typesContent).toMatch(/toolInput:\s*ToolInput/);
    });

    it("includes userAgent property", () => {
      expect(typesContent).toMatch(/userAgent:\s*UserAgent/);
    });

    it("includes locale property", () => {
      expect(typesContent).toMatch(/locale:\s*string/);
    });

    it("includes safeArea property", () => {
      expect(typesContent).toMatch(/safeArea:\s*SafeArea/);
    });
  });

  describe("Theme type", () => {
    it("exports Theme type", () => {
      expect(typesContent).toMatch(/export\s+type\s+Theme\s*=/);
    });

    it("includes light value", () => {
      expect(typesContent).toMatch(/["']light["']/);
    });

    it("includes dark value", () => {
      expect(typesContent).toMatch(/["']dark["']/);
    });
  });

  describe("DisplayMode type", () => {
    it("exports DisplayMode type", () => {
      expect(typesContent).toMatch(/export\s+type\s+DisplayMode\s*=/);
    });

    it("includes inline value", () => {
      expect(typesContent).toMatch(/["']inline["']/);
    });

    it("includes fullscreen value", () => {
      expect(typesContent).toMatch(/["']fullscreen["']/);
    });

    it("includes pip value", () => {
      expect(typesContent).toMatch(/["']pip["']/);
    });
  });

  describe("API type", () => {
    it("includes callTool method", () => {
      expect(typesContent).toMatch(/callTool:\s*CallTool/);
    });

    it("includes sendFollowUpMessage method", () => {
      expect(typesContent).toMatch(/sendFollowUpMessage:\s*\(/);
    });

    it("includes openExternal method", () => {
      expect(typesContent).toMatch(/openExternal\s*\(/);
    });

    it("includes requestDisplayMode method", () => {
      expect(typesContent).toMatch(/requestDisplayMode:\s*RequestDisplayMode/);
    });

    it("includes requestModal method", () => {
      expect(typesContent).toMatch(/requestModal:\s*\(/);
    });

    it("includes requestClose method", () => {
      expect(typesContent).toMatch(/requestClose:\s*\(/);
    });
  });

  describe("CallTool type", () => {
    it("exports CallTool type", () => {
      expect(typesContent).toMatch(/export\s+type\s+CallTool\s*=/);
    });

    it("takes name and args parameters", () => {
      // Should have (name: string, args: Record<string, unknown>)
      expect(typesContent).toMatch(/name:\s*string/);
      expect(typesContent).toMatch(/args:\s*Record<string,\s*unknown>/);
    });

    it("returns Promise<CallToolResponse>", () => {
      expect(typesContent).toMatch(/Promise<CallToolResponse>/);
    });
  });

  describe("CallToolResponse type", () => {
    it("exports CallToolResponse type", () => {
      expect(typesContent).toMatch(/export\s+type\s+CallToolResponse\s*=/);
    });

    it("has result property", () => {
      expect(typesContent).toMatch(/result:\s*string/);
    });
  });

  describe("RequestDisplayMode type", () => {
    it("exports RequestDisplayMode type", () => {
      expect(typesContent).toMatch(/export\s+type\s+RequestDisplayMode\s*=/);
    });

    it("takes mode argument", () => {
      expect(typesContent).toMatch(/mode:\s*DisplayMode/);
    });

    it("returns Promise with mode", () => {
      expect(typesContent).toMatch(/Promise<\s*\{[\s\S]*?mode:\s*DisplayMode/);
    });
  });

  describe("Event types", () => {
    it("exports SET_GLOBALS_EVENT_TYPE constant", () => {
      expect(typesContent).toMatch(/export\s+const\s+SET_GLOBALS_EVENT_TYPE\s*=/);
    });

    it("event type is openai:set_globals", () => {
      expect(typesContent).toMatch(/["']openai:set_globals["']/);
    });

    it("exports SetGlobalsEvent class", () => {
      expect(typesContent).toMatch(/export\s+class\s+SetGlobalsEvent/);
    });

    it("SetGlobalsEvent extends CustomEvent", () => {
      expect(typesContent).toMatch(/SetGlobalsEvent\s+extends\s+CustomEvent/);
    });
  });

  describe("Window declaration", () => {
    it("declares global Window interface", () => {
      expect(typesContent).toMatch(/declare\s+global/);
      expect(typesContent).toMatch(/interface\s+Window/);
    });

    it("adds openai to Window", () => {
      expect(typesContent).toMatch(/openai:\s*API\s*&\s*OpenAiGlobals/);
    });

    it("includes legacy webplus API", () => {
      expect(typesContent).toMatch(/webplus\?:/);
    });

    it("includes legacy oai API", () => {
      expect(typesContent).toMatch(/oai\?:/);
    });

    it("declares WindowEventMap for events", () => {
      expect(typesContent).toMatch(/interface\s+WindowEventMap/);
    });
  });

  describe("Supporting types", () => {
    it("exports UnknownObject type", () => {
      expect(typesContent).toMatch(/export\s+type\s+UnknownObject\s*=/);
    });

    it("UnknownObject is Record<string, unknown>", () => {
      expect(typesContent).toMatch(/UnknownObject\s*=\s*Record<string,\s*unknown>/);
    });

    it("exports SafeArea type", () => {
      expect(typesContent).toMatch(/export\s+type\s+SafeArea\s*=/);
    });

    it("SafeArea has insets", () => {
      expect(typesContent).toMatch(/insets:\s*SafeAreaInsets/);
    });

    it("exports SafeAreaInsets type", () => {
      expect(typesContent).toMatch(/export\s+type\s+SafeAreaInsets\s*=/);
    });

    it("SafeAreaInsets has top, bottom, left, right", () => {
      expect(typesContent).toMatch(/top:\s*number/);
      expect(typesContent).toMatch(/bottom:\s*number/);
      expect(typesContent).toMatch(/left:\s*number/);
      expect(typesContent).toMatch(/right:\s*number/);
    });

    it("exports UserAgent type", () => {
      expect(typesContent).toMatch(/export\s+type\s+UserAgent\s*=/);
    });

    it("exports DeviceType type", () => {
      expect(typesContent).toMatch(/export\s+type\s+DeviceType\s*=/);
    });

    it("DeviceType includes mobile, tablet, desktop", () => {
      expect(typesContent).toMatch(/["']mobile["']/);
      expect(typesContent).toMatch(/["']tablet["']/);
      expect(typesContent).toMatch(/["']desktop["']/);
    });
  });
});

describe("Hook Exports", () => {
  const hookFiles = [
    "use-openai-global.ts",
    "use-widget-props.ts",
    "use-widget-state.ts",
    "use-theme.ts",
    "use-display-mode.ts",
    "use-max-height.ts",
  ];

  it.each(hookFiles)("hook file '%s' exists", (file) => {
    const hookPath = path.resolve("src", file);
    expect(fs.existsSync(hookPath)).toBe(true);
  });

  it.each(hookFiles)("hook file '%s' has default or named export", (file) => {
    const hookPath = path.resolve("src", file);
    const content = fs.readFileSync(hookPath, "utf-8");

    // Should have export statement
    expect(content).toMatch(/export\s+(default\s+)?(function|const)/);
  });

  describe("useOpenAiGlobal", () => {
    it("uses useSyncExternalStore for reactivity", () => {
      const content = fs.readFileSync(
        path.resolve("src/use-openai-global.ts"),
        "utf-8"
      );
      expect(content).toMatch(/useSyncExternalStore/);
    });

    it("subscribes to SET_GLOBALS_EVENT_TYPE", () => {
      const content = fs.readFileSync(
        path.resolve("src/use-openai-global.ts"),
        "utf-8"
      );
      expect(content).toMatch(/SET_GLOBALS_EVENT_TYPE/);
    });

    it("handles SSR (typeof window check)", () => {
      const content = fs.readFileSync(
        path.resolve("src/use-openai-global.ts"),
        "utf-8"
      );
      expect(content).toMatch(/typeof\s+window/);
    });
  });

  describe("useWidgetState", () => {
    it("calls setWidgetState with optional chaining for MCP Apps compatibility", () => {
      const content = fs.readFileSync(
        path.resolve("src/use-widget-state.ts"),
        "utf-8"
      );
      // Must use optional chaining because window.openai doesn't exist in MCP Apps hosts
      // (only in ChatGPT/OpenAI environment). Without optional chaining, the hook
      // crashes with "Cannot read properties of undefined (reading 'setWidgetState')"
      // Pattern: window.openai?.setWidgetState?.(...) for full safety
      expect(content).toMatch(/window\.openai\?\.\s*setWidgetState\?\.\(/);
    });

    it("supports functional updates", () => {
      const content = fs.readFileSync(
        path.resolve("src/use-widget-state.ts"),
        "utf-8"
      );
      // Should check if state is a function
      expect(content).toMatch(/typeof\s+state\s*===\s*["']function["']/);
    });
  });
});
