import { useHostGlobal } from "./use-host-global";

/**
 * React hook to read the structured content returned by your MCP tool.
 * This is the `structuredContent` from your tool's response.
 *
 * @example
 * // In your MCP server:
 * // return { structuredContent: { items: [...], title: "My Items" } }
 *
 * // In your widget:
 * const { items, title } = useWidgetProps({ items: [], title: "" });
 */
export function useWidgetProps<T extends Record<string, unknown>>(
  defaultState?: T | (() => T)
): T {
  const props = useHostGlobal("toolOutput") as T;

  const fallback =
    typeof defaultState === "function"
      ? (defaultState as () => T | null)()
      : defaultState ?? null;

  return props ?? fallback;
}
