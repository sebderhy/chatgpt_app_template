import { useHostGlobal } from "./use-host-global";

/**
 * React hook to get the maximum height constraint from the MCP Apps host.
 * Use this to prevent your widget from overflowing.
 *
 * @example
 * const maxHeight = useMaxHeight();
 * return <div style={{ maxHeight: maxHeight ?? undefined }}>...</div>;
 */
export const useMaxHeight = (): number | null => {
  return useHostGlobal("maxHeight");
};
