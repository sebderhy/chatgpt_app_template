/**
 * TypeScript types for the MCP Apps protocol window.openai interface.
 * These types define the contract between your widget and the MCP Apps host
 * (Claude, ChatGPT, VS Code, Goose, or any MCP-compatible host).
 *
 * Reference: https://modelcontextprotocol.io/docs/extensions/apps
 */

export type HostGlobals<
  ToolInput = UnknownObject,
  ToolOutput = UnknownObject,
  ToolResponseMetadata = UnknownObject,
  WidgetState = UnknownObject
> = {
  // Visual theme (light or dark mode)
  theme: Theme;

  // User agent information
  userAgent: UserAgent;
  locale: string;

  // Layout constraints
  maxHeight: number;
  displayMode: DisplayMode;
  safeArea: SafeArea;

  // State and data from MCP tool calls
  toolInput: ToolInput;
  toolOutput: ToolOutput | null;
  toolResponseMetadata: ToolResponseMetadata | null;
  widgetState: WidgetState | null;
  setWidgetState: (state: WidgetState) => Promise<void>;
};

/**
 * API methods available on window.openai for interacting with the MCP Apps host.
 */
type API = {
  /** Call another MCP tool from within the widget */
  callTool: CallTool;

  /** Send a follow-up message in the chat */
  sendFollowUpMessage: (args: { prompt: string }) => Promise<void>;

  /** Open an external link in the user's browser */
  openExternal(payload: { href: string }): void;

  /** Request a different display mode (inline, fullscreen, pip) */
  requestDisplayMode: RequestDisplayMode;

  /** Open a modal dialog */
  requestModal: (args: { title?: string; params?: UnknownObject }) => Promise<unknown>;

  /** Close the widget */
  requestClose: () => Promise<void>;
};

export type UnknownObject = Record<string, unknown>;

/** Theme can be "light" or "dark" */
export type Theme = "light" | "dark";

export type SafeAreaInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type SafeArea = {
  insets: SafeAreaInsets;
};

export type DeviceType = "mobile" | "tablet" | "desktop" | "unknown";

export type UserAgent = {
  device: { type: DeviceType };
  capabilities: {
    hover: boolean;
    touch: boolean;
  };
};

/** Display mode: inline (default), fullscreen, or picture-in-picture */
export type DisplayMode = "pip" | "inline" | "fullscreen";

export type RequestDisplayMode = (args: { mode: DisplayMode }) => Promise<{
  /**
   * The granted display mode. The host may reject the request.
   * For mobile, PiP is always coerced to fullscreen.
   */
  mode: DisplayMode;
}>;

export type CallToolResponse = {
  result: string;
};

/** Call an MCP tool by name with arguments */
export type CallTool = (
  name: string,
  args: Record<string, unknown>
) => Promise<CallToolResponse>;

/** Event type for when globals are updated */
export const SET_GLOBALS_EVENT_TYPE = "openai:set_globals";

export class SetGlobalsEvent extends CustomEvent<{
  globals: Partial<HostGlobals>;
}> {
  readonly type = SET_GLOBALS_EVENT_TYPE;
}

/**
 * Global window.openai object injected by the MCP Apps host for widget communication.
 * Despite the "openai" name, this interface is used by all MCP Apps hosts.
 */
declare global {
  interface Window {
    openai: API & HostGlobals;
    /** Legacy API (deprecated, use window.openai) */
    webplus?: {
      requestDisplayMode?: RequestDisplayMode;
    };
    oai?: {
      widget: {
        setState: (state: UnknownObject) => void;
      };
    };
  }

  interface WindowEventMap {
    [SET_GLOBALS_EVENT_TYPE]: SetGlobalsEvent;
  }
}
