/**
 * Boilerplate ChatGPT Widget
 *
 * This widget demonstrates all key features of the ChatGPT Apps SDK:
 * - Reading tool output (structuredContent from your MCP server)
 * - Persisting widget state across renders
 * - Calling other MCP tools from the widget
 * - Display mode switching (inline, fullscreen, pip)
 * - Theme support (light/dark)
 * - Using Apps SDK UI components
 */

import React, { useState } from "react";
import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Maximize2, RefreshCw, ExternalLink, MessageSquare } from "lucide-react";
import { useWidgetProps } from "../use-widget-props";
import { useWidgetState } from "../use-widget-state";
import { useMaxHeight } from "../use-max-height";
import { useDisplayMode } from "../use-display-mode";
import { useTheme } from "../use-theme";
import type { DisplayMode } from "../types";

// Define the shape of your tool's structuredContent
type ToolOutput = {
  title: string;
  message: string;
  items?: Array<{ id: string; name: string; description?: string }>;
  accentColor?: string;
};

// Define the shape of your widget's persisted state
type WidgetState = {
  selectedItemId: string | null;
  counter: number;
  lastUpdated: string;
};

// Default values when no tool output is provided
const defaultProps: ToolOutput = {
  title: "Boilerplate Widget",
  message: "This is a boilerplate ChatGPT widget. Call your MCP tool to see real data!",
  items: [
    { id: "1", name: "Sample Item 1", description: "This is a sample item" },
    { id: "2", name: "Sample Item 2", description: "Another sample item" },
    { id: "3", name: "Sample Item 3", description: "One more sample item" },
  ],
  accentColor: "#2563eb",
};

export default function App() {
  // Read structured content from your MCP tool
  const props = useWidgetProps<ToolOutput>(defaultProps);

  // Persist widget state on the ChatGPT host
  const [widgetState, setWidgetState] = useWidgetState<WidgetState>({
    selectedItemId: null,
    counter: 0,
    lastUpdated: new Date().toISOString(),
  });

  // Get layout and theme information
  const maxHeight = useMaxHeight();
  const displayMode = useDisplayMode() ?? "inline";
  const theme = useTheme() ?? "light";

  // Local state for UI interactions
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle item selection
  const handleSelectItem = (itemId: string) => {
    setWidgetState((prev) => ({
      ...prev,
      selectedItemId: prev?.selectedItemId === itemId ? null : itemId,
      lastUpdated: new Date().toISOString(),
    }));
  };

  // Handle counter increment
  const handleIncrement = () => {
    setWidgetState((prev) => ({
      ...prev,
      counter: (prev?.counter ?? 0) + 1,
      lastUpdated: new Date().toISOString(),
    }));
  };

  // Request fullscreen mode
  const handleRequestFullscreen = async () => {
    if (window.openai?.requestDisplayMode) {
      await window.openai?.requestDisplayMode({ mode: "fullscreen" });
    } else if (window.webplus?.requestDisplayMode) {
      // Legacy API fallback
      await window.webplus?.requestDisplayMode({ mode: "fullscreen" });
    }
  };

  // Call another MCP tool from the widget
  const handleCallTool = async () => {
    if (!window.openai?.callTool) {
      setError("callTool is not available in this context");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Replace "your-tool-name" with your actual tool name
      const result = await window.openai?.callTool("boilerplate_refresh", {
        message: "Refreshed from widget",
      });
      console.log("Tool result:", result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to call tool");
    } finally {
      setIsLoading(false);
    }
  };

  // Send a follow-up message in the chat
  const handleSendFollowUp = async () => {
    if (!window.openai?.sendFollowUpMessage) {
      setError("sendFollowUpMessage is not available");
      return;
    }

    await window.openai?.sendFollowUpMessage({
      prompt: "Tell me more about this widget",
    });
  };

  // Open an external link
  const handleOpenExternal = () => {
    window.openai?.openExternal?.({
      href: "https://developers.openai.com/apps-sdk",
    });
  };

  const selectedItem = props.items?.find((item) => item.id === widgetState?.selectedItemId);

  return (
    <div
      className="bg-surface border border-default rounded-2xl shadow-sm overflow-hidden"
      style={{ maxHeight: maxHeight ?? undefined }}
    >
      {/* Header */}
      <header
        className="p-4 border-b border-default"
        style={{ backgroundColor: props.accentColor ? `${props.accentColor}10` : undefined }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: props.accentColor ?? "#2563eb" }}
            />
            <h1 className="text-lg font-semibold text-primary">{props.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="soft" color="secondary" pill>
              {displayMode}
            </Badge>
            <Badge variant="soft" color={theme === "dark" ? "info" : "secondary"} pill>
              {theme}
            </Badge>
            {displayMode !== "fullscreen" && (
              <button
                onClick={handleRequestFullscreen}
                className="p-2 rounded-full hover:bg-subtle transition-colors"
                aria-label="Enter fullscreen"
              >
                <Maximize2 className="w-4 h-4 text-secondary" />
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-sm text-secondary">{props.message}</p>
      </header>

      {/* Main content */}
      <div className="p-4 flex flex-col gap-4">
        {/* Items list */}
        {props.items && props.items.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-secondary mb-2">Items</h2>
            <div className="flex flex-col gap-2">
              {props.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectItem(item.id)}
                  className={`
                    p-3 rounded-xl border text-left transition-all
                    ${
                      widgetState?.selectedItemId === item.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-default bg-surface hover:bg-subtle"
                    }
                  `}
                >
                  <div className="font-medium text-primary">{item.name}</div>
                  {item.description && (
                    <div className="text-sm text-secondary mt-1">{item.description}</div>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Selected item detail */}
        {selectedItem && (
          <section className="p-4 rounded-xl bg-subtle border border-default">
            <h3 className="text-sm font-medium text-secondary mb-1">Selected</h3>
            <div className="text-lg font-semibold text-primary">{selectedItem.name}</div>
            {selectedItem.description && (
              <p className="text-sm text-secondary mt-1">{selectedItem.description}</p>
            )}
          </section>
        )}

        {/* Widget state demo */}
        <section className="p-4 rounded-xl bg-subtle border border-default">
          <h3 className="text-sm font-medium text-secondary mb-3">Widget State (persisted)</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary">{widgetState?.counter ?? 0}</span>
              <Button variant="outline" color="secondary" onClick={handleIncrement}>
                +1
              </Button>
            </div>
            <div className="text-xs text-tertiary">
              Last updated: {widgetState?.lastUpdated ? new Date(widgetState.lastUpdated).toLocaleTimeString() : "Never"}
            </div>
          </div>
        </section>

        {/* Actions */}
        <section>
          <h3 className="text-sm font-medium text-secondary mb-3">Actions</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="solid"
              color="primary"
              onClick={handleCallTool}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "Calling..." : "Call Tool"}
            </Button>
            <Button variant="outline" color="secondary" onClick={handleSendFollowUp}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Follow Up
            </Button>
            <Button variant="outline" color="secondary" onClick={handleOpenExternal}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Docs
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </section>
      </div>

      {/* Footer */}
      <footer className="px-4 py-3 border-t border-default bg-subtle">
        <div className="flex items-center justify-between text-xs text-tertiary">
          <span>ChatGPT App Boilerplate</span>
          <span>maxHeight: {maxHeight ?? "auto"}</span>
        </div>
      </footer>
    </div>
  );
}
