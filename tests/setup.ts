/**
 * Test setup file for Vitest.
 *
 * Provides mock implementations of window.openai and related globals
 * required for testing widgets outside of MCP Apps hosts.
 */

import { beforeEach, vi } from "vitest";
import type { HostGlobals, DisplayMode, Theme } from "../src/types";

/**
 * Creates a mock window.openai object with sensible defaults.
 * Tests can override specific properties as needed.
 */
export function createMockOpenAi(
  overrides: Partial<HostGlobals> = {}
): HostGlobals & {
  callTool: ReturnType<typeof vi.fn>;
  sendFollowUpMessage: ReturnType<typeof vi.fn>;
  openExternal: ReturnType<typeof vi.fn>;
  requestDisplayMode: ReturnType<typeof vi.fn>;
  requestModal: ReturnType<typeof vi.fn>;
  requestClose: ReturnType<typeof vi.fn>;
} {
  return {
    // Default globals
    theme: "light" as Theme,
    userAgent: {
      device: { type: "desktop" },
      capabilities: { hover: true, touch: false },
    },
    locale: "en-US",
    maxHeight: 600,
    displayMode: "inline" as DisplayMode,
    safeArea: { insets: { top: 0, bottom: 0, left: 0, right: 0 } },
    toolInput: {},
    toolOutput: null,
    toolResponseMetadata: null,
    // Note: widgetState is intentionally NOT set by default
    // to allow useWidgetState to use its defaultState parameter.
    // Set it explicitly when testing restored state scenarios.
    setWidgetState: vi.fn().mockResolvedValue(undefined),

    // Mock API methods
    callTool: vi.fn().mockResolvedValue({ result: "" }),
    sendFollowUpMessage: vi.fn().mockResolvedValue(undefined),
    openExternal: vi.fn(),
    requestDisplayMode: vi.fn().mockResolvedValue({ mode: "inline" }),
    requestModal: vi.fn().mockResolvedValue(undefined),
    requestClose: vi.fn().mockResolvedValue(undefined),

    // Apply overrides
    ...overrides,
  };
}

/**
 * Sets up the global window.openai mock before each test.
 * This is the default mock - tests can replace it as needed.
 */
beforeEach(() => {
  // Reset the mock before each test
  (window as Window & { openai?: unknown }).openai = createMockOpenAi();
});

/**
 * Helper to dispatch the openai:set_globals event.
 * Use this to simulate the MCP Apps host updating globals.
 */
export function dispatchSetGlobals(globals: Partial<HostGlobals>): void {
  const event = new CustomEvent("openai:set_globals", {
    detail: { globals },
  });
  window.dispatchEvent(event);
}

/**
 * Helper to update specific window.openai properties.
 */
export function updateMockOpenAi(updates: Partial<HostGlobals>): void {
  Object.assign(window.openai, updates);
  dispatchSetGlobals(updates);
}
