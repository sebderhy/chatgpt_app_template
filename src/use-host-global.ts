import { useSyncExternalStore } from "react";
import {
  SET_GLOBALS_EVENT_TYPE,
  SetGlobalsEvent,
  type HostGlobals,
} from "./types";

/**
 * React hook to subscribe to a specific property from window.openai.
 * Automatically re-renders when the value changes.
 *
 * Note: The window.openai interface is the standard MCP Apps protocol interface,
 * used by all MCP Apps hosts (Claude, ChatGPT, VS Code, Goose).
 *
 * @example
 * const theme = useHostGlobal("theme"); // "light" | "dark" | null
 * const displayMode = useHostGlobal("displayMode"); // "inline" | "fullscreen" | "pip" | null
 * const toolOutput = useHostGlobal("toolOutput"); // Your structured content
 */
export function useHostGlobal<K extends keyof HostGlobals>(
  key: K
): HostGlobals[K] | null {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") {
        return () => {};
      }

      const handleSetGlobal = (event: SetGlobalsEvent) => {
        const value = event.detail.globals[key];
        if (value === undefined) {
          return;
        }

        onChange();
      };

      window.addEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal, {
        passive: true,
      });

      return () => {
        window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal);
      };
    },
    () => window.openai?.[key] ?? null,
    () => window.openai?.[key] ?? null
  );
}
