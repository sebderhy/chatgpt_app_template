import { useHostGlobal } from "./use-host-global";
import { type Theme } from "./types";

/**
 * React hook to get the current theme (light or dark).
 * Use this to adapt your widget's styling to match the MCP Apps host.
 *
 * @example
 * const theme = useTheme();
 * const bgColor = theme === "dark" ? "#1a1a1a" : "#ffffff";
 */
export const useTheme = (): Theme | null => {
  return useHostGlobal("theme");
};
