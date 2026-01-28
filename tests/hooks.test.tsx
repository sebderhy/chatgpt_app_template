/**
 * React Hooks Tests - Infrastructure tests for shared MCP Apps integration hooks.
 *
 * These tests verify that the hooks correctly read from window.openai
 * and respond to changes, without assuming anything about widget business logic.
 *
 * Key behaviors verified:
 * 1. Hooks read initial values from window.openai
 * 2. Hooks return defaults when window.openai is missing/null
 * 3. Hooks respond to openai:set_globals events
 * 4. useWidgetState syncs state to host
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useWidgetProps } from "../src/use-widget-props";
import { useWidgetState } from "../src/use-widget-state";
import { useTheme } from "../src/use-theme";
import { useDisplayMode } from "../src/use-display-mode";
import { useMaxHeight } from "../src/use-max-height";
import { useHostGlobal } from "../src/use-host-global";
import { createMockOpenAi, dispatchSetGlobals, updateMockOpenAi } from "./setup";

describe("useHostGlobal", () => {
  describe("reading values", () => {
    it("reads theme from window.openai", () => {
      const { result } = renderHook(() => useHostGlobal("theme"));
      expect(result.current).toBe("light");
    });

    it("reads displayMode from window.openai", () => {
      const { result } = renderHook(() => useHostGlobal("displayMode"));
      expect(result.current).toBe("inline");
    });

    it("reads maxHeight from window.openai", () => {
      const { result } = renderHook(() => useHostGlobal("maxHeight"));
      expect(result.current).toBe(600);
    });

    it("returns null for toolOutput when not set", () => {
      const { result } = renderHook(() => useHostGlobal("toolOutput"));
      expect(result.current).toBeNull();
    });
  });

  describe("responding to changes", () => {
    it("updates when globals change", async () => {
      const { result } = renderHook(() => useHostGlobal("theme"));
      expect(result.current).toBe("light");

      act(() => {
        updateMockOpenAi({ theme: "dark" });
      });

      await waitFor(() => {
        expect(result.current).toBe("dark");
      });
    });
  });

  describe("missing window.openai", () => {
    it("returns null when property is missing", () => {
      // Set toolOutput to undefined
      (window.openai as Record<string, unknown>).toolOutput = undefined;

      const { result } = renderHook(() => useHostGlobal("toolOutput"));
      expect(result.current).toBeNull();
    });
  });
});

describe("useTheme", () => {
  it("returns current theme", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe("light");
  });

  it("returns dark when theme is dark", () => {
    window.openai = createMockOpenAi({ theme: "dark" });

    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe("dark");
  });

  it("returns valid Theme type values", () => {
    const { result } = renderHook(() => useTheme());
    expect(["light", "dark", null]).toContain(result.current);
  });
});

describe("useDisplayMode", () => {
  it("returns current display mode", () => {
    const { result } = renderHook(() => useDisplayMode());
    expect(result.current).toBe("inline");
  });

  it("returns fullscreen when set", () => {
    window.openai = createMockOpenAi({ displayMode: "fullscreen" });

    const { result } = renderHook(() => useDisplayMode());
    expect(result.current).toBe("fullscreen");
  });

  it("returns pip when set", () => {
    window.openai = createMockOpenAi({ displayMode: "pip" });

    const { result } = renderHook(() => useDisplayMode());
    expect(result.current).toBe("pip");
  });

  it("returns valid DisplayMode type values", () => {
    const { result } = renderHook(() => useDisplayMode());
    expect(["inline", "fullscreen", "pip", null]).toContain(result.current);
  });
});

describe("useMaxHeight", () => {
  it("returns current max height", () => {
    const { result } = renderHook(() => useMaxHeight());
    expect(result.current).toBe(600);
  });

  it("returns custom max height when set", () => {
    window.openai = createMockOpenAi({ maxHeight: 800 });

    const { result } = renderHook(() => useMaxHeight());
    expect(result.current).toBe(800);
  });

  it("returns a number or null", () => {
    const { result } = renderHook(() => useMaxHeight());
    expect(
      typeof result.current === "number" || result.current === null
    ).toBe(true);
  });
});

describe("useWidgetProps", () => {
  describe("with defaults", () => {
    it("returns defaults when toolOutput is null", () => {
      const defaults = { title: "Default Title", items: [] };
      const { result } = renderHook(() => useWidgetProps(defaults));

      expect(result.current).toEqual(defaults);
    });

    it("returns defaults via function", () => {
      const defaults = () => ({ count: 42 });
      const { result } = renderHook(() => useWidgetProps(defaults));

      expect(result.current).toEqual({ count: 42 });
    });
  });

  describe("with toolOutput", () => {
    it("returns toolOutput when available", () => {
      const toolOutput = { title: "From Server", items: [1, 2, 3] };
      window.openai = createMockOpenAi({ toolOutput });

      const defaults = { title: "Default", items: [] };
      const { result } = renderHook(() => useWidgetProps(defaults));

      expect(result.current).toEqual(toolOutput);
    });

    it("prefers toolOutput over defaults", () => {
      const toolOutput = { value: "server" };
      window.openai = createMockOpenAi({ toolOutput });

      const { result } = renderHook(() =>
        useWidgetProps({ value: "default" })
      );

      expect(result.current.value).toBe("server");
    });
  });

  describe("type safety", () => {
    it("returns object type", () => {
      const { result } = renderHook(() => useWidgetProps({ key: "value" }));
      expect(typeof result.current).toBe("object");
    });
  });
});

describe("useWidgetState", () => {
  describe("initialization", () => {
    it("preserves default state when window.openai.widgetState is null", () => {
      // When widgetState is not set on window, hook should preserve the default state
      // This allows widgets to function correctly in the simulator and tests
      const defaultState = { count: 0, selected: null };
      const { result } = renderHook(() => useWidgetState(defaultState));

      const [state] = result.current;
      // Default state is preserved when window state is null
      expect(state).toEqual(defaultState);
    });

    it("uses widgetState from window when available", () => {
      const existingState = { restored: true, value: 42 };
      // Explicitly set widgetState to simulate restored state from host
      window.openai = createMockOpenAi();
      (window.openai as Record<string, unknown>).widgetState = existingState;

      const { result } = renderHook(() =>
        useWidgetState({ restored: false, value: 0 })
      );

      const [state] = result.current;
      expect(state).toEqual(existingState);
    });

    it("prefers window state over default state", () => {
      const windowState = { fromWindow: true };
      window.openai = createMockOpenAi();
      (window.openai as Record<string, unknown>).widgetState = windowState;

      const { result } = renderHook(() =>
        useWidgetState({ fromWindow: false })
      );

      const [state] = result.current;
      expect(state?.fromWindow).toBe(true);
    });
  });

  describe("state updates", () => {
    it("updates state with new value", () => {
      const { result } = renderHook(() => useWidgetState({ count: 0 }));

      act(() => {
        const [, setState] = result.current;
        setState({ count: 1 });
      });

      const [state] = result.current;
      expect(state).toEqual({ count: 1 });
    });

    it("updates state with functional update", () => {
      const { result } = renderHook(() => useWidgetState({ count: 0 }));

      act(() => {
        const [, setState] = result.current;
        setState((prev) => ({ count: (prev?.count ?? 0) + 1 }));
      });

      const [state] = result.current;
      expect(state?.count).toBe(1);
    });

    it("calls setWidgetState on host when updating", () => {
      const mockSetWidgetState = vi.fn().mockResolvedValue(undefined);
      window.openai = createMockOpenAi({});
      window.openai.setWidgetState = mockSetWidgetState;

      const { result } = renderHook(() => useWidgetState({ value: "a" }));

      act(() => {
        const [, setState] = result.current;
        setState({ value: "b" });
      });

      expect(mockSetWidgetState).toHaveBeenCalledWith({ value: "b" });
    });
  });

  describe("return type", () => {
    it("returns tuple of [state, setState]", () => {
      const { result } = renderHook(() => useWidgetState({ x: 1 }));

      expect(Array.isArray(result.current)).toBe(true);
      expect(result.current.length).toBe(2);
      expect(typeof result.current[0]).toBe("object");
      expect(typeof result.current[1]).toBe("function");
    });
  });
});

describe("Hook Integration", () => {
  it("multiple hooks can be used together", () => {
    const { result } = renderHook(() => ({
      theme: useTheme(),
      displayMode: useDisplayMode(),
      maxHeight: useMaxHeight(),
      props: useWidgetProps({ defaultProp: true }),
    }));

    expect(result.current.theme).toBe("light");
    expect(result.current.displayMode).toBe("inline");
    expect(result.current.maxHeight).toBe(600);
    expect(result.current.props).toEqual({ defaultProp: true });
  });

  it("all hooks respond to global updates", async () => {
    const { result } = renderHook(() => ({
      theme: useTheme(),
      displayMode: useDisplayMode(),
    }));

    expect(result.current.theme).toBe("light");
    expect(result.current.displayMode).toBe("inline");

    act(() => {
      updateMockOpenAi({
        theme: "dark",
        displayMode: "fullscreen",
      });
    });

    await waitFor(() => {
      expect(result.current.theme).toBe("dark");
      expect(result.current.displayMode).toBe("fullscreen");
    });
  });
});
