/**
 * Local ChatGPT Simulator
 *
 * A development tool that simulates ChatGPT's widget rendering environment.
 * Uses OpenAI's API with MCP tools when OPENAI_API_KEY is set,
 * or falls back to Puter.js (free, no API key needed) otherwise.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Plus, Sun, Moon, Maximize2, X, Zap, Play, MessageSquare, Wrench } from "lucide-react";
import WidgetRenderer from "./WidgetRenderer";

// Puter.js types
declare global {
  interface Window {
    puter?: {
      ai: {
        chat: (
          input: string | Array<{ role: string; content?: string; tool_call_id?: string }>,
          options?: { tools?: Tool[]; model?: string }
        ) => Promise<PuterResponse | string>;
      };
    };
  }
}

interface Tool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

interface PuterResponse {
  message?: {
    content?: string;
    tool_calls?: ToolCall[];
  };
  toString(): string;
}

interface WidgetData {
  html: string;
  toolOutput: Record<string, unknown>;
  toolName: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  widget?: WidgetData;
  timestamp: Date;
}

type AgentMode = "checking" | "backend" | "puter";
type InteractionMode = "chat" | "direct";

const EXAMPLE_PROMPTS = [
  "Show me a carousel of restaurants",
  "Display a dashboard with stats",
  "Show me a photo gallery",
  "Create a todo list",
  "Show me the solar system",
  "Display a shopping cart",
];

const PUTER_MODEL = "gpt-4o-mini"; // Free model via Puter.js

// UUID generator with fallback for non-secure contexts (HTTP on public IP)
function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return uid();
  }
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).toUpperCase();
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [expandedWidget, setExpandedWidget] = useState<WidgetData | null>(null);
  const [agentMode, setAgentMode] = useState<AgentMode>("checking");
  const [tools, setTools] = useState<Tool[]>([]);

  // Direct tool mode state
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("chat");
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [toolArgs, setToolArgs] = useState<Record<string, string>>({});
  const [directWidget, setDirectWidget] = useState<WidgetData | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check API key status and load tools on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Always load tool definitions (needed for direct mode)
        const toolsRes = await fetch("/tools");
        const toolsData = await toolsRes.json();
        setTools(toolsData.tools || []);

        // Check if backend has API key
        const statusRes = await fetch("/chat/status");
        const status = await statusRes.json();

        if (status.has_api_key) {
          setAgentMode("backend");
        } else {
          // Load Puter.js for fallback
          await loadPuterJS();
          setAgentMode("puter");
        }
      } catch (error) {
        console.error("Init error:", error);
        // Default to backend mode, let it fail with a helpful error
        setAgentMode("backend");
      }
    };

    init();
  }, []);

  // Load Puter.js script dynamically
  const loadPuterJS = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.puter) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://js.puter.com/v2/";
      script.async = true;
      script.onload = () => {
        // Wait a bit for puter to initialize
        setTimeout(resolve, 500);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    if (agentMode !== "checking") {
      inputRef.current?.focus();
    }
  }, [agentMode]);

  // Send message using Puter.js (free fallback)
  const sendMessagePuter = useCallback(async (text: string) => {
    if (!window.puter) {
      throw new Error("Puter.js not loaded");
    }

    // Build system instructions
    const systemPrompt = `You are a helpful assistant that can display interactive widgets.

When the user asks to see something visual, use the appropriate tool:
- show_card: For simple interactive card displays
- show_carousel: For horizontal scrolling cards (places, products, recommendations)
- show_list: For vertical lists with thumbnails (rankings, search results)
- show_gallery: For image galleries with lightbox
- show_dashboard: For stats and metrics displays
- show_solar_system: For interactive 3D solar system
- show_todo: For task/todo list management
- show_shop: For shopping cart and e-commerce

Always use a tool when the user asks to see, show, or display something visual.
After calling a tool, provide a brief helpful response about what you're showing.`;

    // First call with tools
    const response = await window.puter.ai.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
      { tools, model: PUTER_MODEL }
    );

    // Check if it's a string response (no tool call)
    if (typeof response === "string") {
      return { message: response, widget: undefined };
    }

    // Check for tool calls
    if (response.message?.tool_calls?.length) {
      const toolCall = response.message.tool_calls[0];
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments || "{}");

      // Execute the tool via our backend
      const toolResult = await fetch("/tools/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: toolName, arguments: toolArgs }),
      });

      const toolData = await toolResult.json();

      if (toolData.error) {
        throw new Error(toolData.error);
      }

      // Send tool result back to get final response
      const finalResponse = await window.puter.ai.chat(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
          { role: "assistant", content: "", tool_calls: response.message.tool_calls } as any,
          { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(toolData.tool_output) }
        ],
        { model: PUTER_MODEL }
      );

      const finalMessage = typeof finalResponse === "string"
        ? finalResponse
        : finalResponse.message?.content || "Here's what I found:";

      return {
        message: finalMessage,
        widget: {
          html: toolData.html,
          toolOutput: toolData.tool_output,
          toolName: toolData.tool_name,
        },
      };
    }

    // No tool call, just return the message
    return {
      message: response.message?.content || response.toString(),
      widget: undefined,
    };
  }, [tools]);

  // Send message using backend (OpenAI API)
  const sendMessageBackend = async (text: string) => {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || "Request failed");
    }

    return {
      message: data.message || "Here's what I found:",
      widget: data.widget
        ? {
            html: data.widget.html,
            toolOutput: data.widget.tool_output,
            toolName: data.widget.tool_name,
          }
        : undefined,
    };
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input;
    if (!text.trim() || loading || agentMode === "checking") return;

    const userMessage: Message = {
      id: uid(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const result = agentMode === "puter"
        ? await sendMessagePuter(text)
        : await sendMessageBackend(text);

      const assistantMessage: Message = {
        id: uid(),
        role: "assistant",
        content: result.message,
        widget: result.widget,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: uid(),
        role: "error",
        content: error instanceof Error ? error.message : "An error occurred",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const newConversation = async () => {
    if (agentMode === "backend") {
      try {
        await fetch("/chat/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      } catch {
        // Ignore reset errors
      }
    }
    setMessages([]);
    setExpandedWidget(null);
    inputRef.current?.focus();
  };

  const handleWidgetMessage = (message: { type: string; [key: string]: unknown }) => {
    console.log("Widget message:", message);

    if (message.type === "sendFollowUp" && typeof message.prompt === "string") {
      sendMessage(message.prompt);
    }

    if (message.type === "requestDisplayMode" && message.mode === "fullscreen") {
      const lastWidgetMsg = [...messages].reverse().find((m) => m.widget);
      if (lastWidgetMsg?.widget) {
        setExpandedWidget(lastWidgetMsg.widget);
      }
    }
  };

  // Direct tool invocation
  const invokeToolDirectly = async () => {
    if (!selectedTool || loading) return;

    setLoading(true);
    setDirectWidget(null);

    try {
      // Parse tool arguments (convert empty strings to undefined so defaults are used)
      const parsedArgs: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(toolArgs)) {
        if (value.trim()) {
          // Try to parse as JSON for complex types, otherwise use string
          try {
            parsedArgs[key] = JSON.parse(value);
          } catch {
            parsedArgs[key] = value;
          }
        }
      }

      const response = await fetch("/tools/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedTool, arguments: parsedArgs }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setDirectWidget({
        html: data.html,
        toolOutput: data.tool_output,
        toolName: data.tool_name,
      });
    } catch (error) {
      console.error("Tool invocation error:", error);
      alert(error instanceof Error ? error.message : "Failed to invoke tool");
    } finally {
      setLoading(false);
    }
  };

  // Get the selected tool's schema
  const selectedToolSchema = tools.find((t) => t.function.name === selectedTool);

  // Update tool args when selected tool changes
  useEffect(() => {
    setToolArgs({});
    setDirectWidget(null);
  }, [selectedTool]);

  const isDark = theme === "dark";

  // Show loading while checking status
  if (agentMode === "checking") {
    return (
      <div className={`h-screen flex items-center justify-center ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-4">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <p className={isDark ? "text-gray-400" : "text-gray-500"}>Initializing simulator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
      {/* Header */}
      <header
        className={`px-3 sm:px-4 py-2 sm:py-3 border-b flex items-center justify-between gap-2 ${
          isDark ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-white"
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={newConversation}
            className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
              isDark
                ? "hover:bg-gray-800 text-gray-400 hover:text-white"
                : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
            }`}
            title="New conversation"
          >
            <Plus size={20} />
          </button>
          <div className="min-w-0">
            <h1 className={`text-base sm:text-lg font-semibold truncate ${isDark ? "text-white" : "text-gray-900"}`}>
              <span className="hidden sm:inline">ChatGPT </span>Simulator
            </h1>
            {/* Mode indicator - hidden on very small screens */}
            <div className="hidden xs:flex items-center gap-1.5">
              <span
                className={`text-xs ${
                  agentMode === "puter"
                    ? "text-green-500"
                    : isDark
                    ? "text-gray-500"
                    : "text-gray-400"
                }`}
              >
                {interactionMode === "direct" ? (
                  "Direct Tool Mode"
                ) : agentMode === "puter" ? (
                  <span className="flex items-center gap-1">
                    <Zap size={12} />
                    <span className="hidden sm:inline">Puter.js (free, no API key)</span>
                    <span className="sm:hidden">Puter.js</span>
                  </span>
                ) : (
                  "OpenAI API"
                )}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Mode toggle */}
          <div
            className={`flex rounded-lg border p-0.5 ${
              isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-100"
            }`}
          >
            <button
              onClick={() => setInteractionMode("chat")}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-sm transition-colors ${
                interactionMode === "chat"
                  ? isDark
                    ? "bg-gray-700 text-white"
                    : "bg-white text-gray-900 shadow-sm"
                  : isDark
                  ? "text-gray-400 hover:text-white"
                  : "text-gray-500 hover:text-gray-900"
              }`}
              title="Chat with AI"
            >
              <MessageSquare size={16} />
              <span className="hidden sm:inline">Chat</span>
            </button>
            <button
              onClick={() => setInteractionMode("direct")}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-sm transition-colors ${
                interactionMode === "direct"
                  ? isDark
                    ? "bg-gray-700 text-white"
                    : "bg-white text-gray-900 shadow-sm"
                  : isDark
                  ? "text-gray-400 hover:text-white"
                  : "text-gray-500 hover:text-gray-900"
              }`}
              title="Invoke tools directly"
            >
              <Wrench size={16} />
              <span className="hidden sm:inline">Direct</span>
            </button>
          </div>
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-600"
            }`}
            title={`Switch to ${isDark ? "light" : "dark"} mode`}
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        {interactionMode === "direct" ? (
          /* Direct Tool Mode */
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Tool Selection Panel */}
              <div
                className={`lg:col-span-1 rounded-2xl border p-4 ${
                  isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
                }`}
              >
                <h3 className={`font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
                  Select Tool
                </h3>

                {/* Tool Dropdown */}
                <select
                  value={selectedTool}
                  onChange={(e) => setSelectedTool(e.target.value)}
                  className={`w-full p-2 rounded-lg border mb-4 ${
                    isDark
                      ? "bg-gray-700 border-gray-600 text-white"
                      : "bg-gray-50 border-gray-200 text-gray-900"
                  }`}
                >
                  <option value="">-- Select a tool --</option>
                  {tools.map((tool) => (
                    <option key={tool.function.name} value={tool.function.name}>
                      {tool.function.name}
                    </option>
                  ))}
                </select>

                {/* Tool Description */}
                {selectedToolSchema && (
                  <p className={`text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    {selectedToolSchema.function.description.split("\n")[0]}
                  </p>
                )}

                {/* Parameter Inputs */}
                {selectedToolSchema && (
                  <div className="space-y-3">
                    <h4 className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                      Parameters
                    </h4>
                    {Object.entries(selectedToolSchema.function.parameters.properties || {}).map(
                      ([key, schema]) => {
                        const prop = schema as { type?: string; description?: string; default?: unknown };
                        return (
                          <div key={key}>
                            <label
                              className={`block text-xs mb-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}
                            >
                              {key}
                              {prop.default !== undefined && (
                                <span className="ml-1 opacity-60">
                                  (default: {JSON.stringify(prop.default)})
                                </span>
                              )}
                            </label>
                            <input
                              type="text"
                              value={toolArgs[key] || ""}
                              onChange={(e) =>
                                setToolArgs((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              placeholder={prop.description || key}
                              className={`w-full p-2 rounded-lg border text-sm ${
                                isDark
                                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-500"
                                  : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
                              }`}
                            />
                          </div>
                        );
                      }
                    )}
                  </div>
                )}

                {/* Invoke Button */}
                <button
                  onClick={invokeToolDirectly}
                  disabled={!selectedTool || loading}
                  className={`w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedTool && !loading
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : isDark
                      ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <Play size={18} />
                  {loading ? "Invoking..." : "Invoke Tool"}
                </button>
              </div>

              {/* Widget Display Panel */}
              <div
                className={`lg:col-span-2 rounded-2xl border overflow-hidden ${
                  isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
                }`}
              >
                {directWidget ? (
                  <>
                    <div
                      className={`px-4 py-2 flex items-center justify-between border-b ${
                        isDark ? "border-gray-700" : "border-gray-100"
                      }`}
                    >
                      <span className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                        {directWidget.toolName.replace("show_", "").replace(/_/g, " ")}
                      </span>
                      <button
                        onClick={() => setExpandedWidget(directWidget)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isDark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"
                        }`}
                        title="Expand"
                      >
                        <Maximize2 size={16} />
                      </button>
                    </div>
                    <div className="h-[300px] sm:h-[500px]">
                      <WidgetRenderer
                        html={directWidget.html}
                        toolOutput={directWidget.toolOutput}
                        theme={theme}
                        onMessage={handleWidgetMessage}
                      />
                    </div>
                  </>
                ) : (
                  <div className="h-[300px] sm:h-[500px] flex items-center justify-center">
                    <div className="text-center">
                      <Wrench
                        size={48}
                        className={isDark ? "text-gray-600 mx-auto mb-3" : "text-gray-300 mx-auto mb-3"}
                      />
                      <p className={isDark ? "text-gray-500" : "text-gray-400"}>
                        Select a tool and click "Invoke" to see the widget
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Chat Mode */
          <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
            {messages.length === 0 && (
              <div className="text-center py-8 sm:py-12 px-2">
                <h2 className={`text-xl sm:text-2xl font-semibold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                  <span className="hidden sm:inline">ChatGPT </span>Widget Simulator
                </h2>
                <p className={`text-sm mb-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  Test your widgets locally before deploying
                </p>
                {agentMode === "puter" && (
                  <p className={`text-xs mb-4 sm:mb-6 ${isDark ? "text-green-400" : "text-green-600"}`}>
                    Using Puter.js - no API key required!
                  </p>
                )}
                <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-full transition-colors ${
                        isDark
                          ? "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                          : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
                      }`}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

          {messages.map((msg) => (
            <div key={msg.id} className="space-y-3">
              {/* Message */}
              <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : msg.role === "error"
                      ? isDark
                        ? "bg-red-900/50 text-red-300 border border-red-800"
                        : "bg-red-50 text-red-700 border border-red-200"
                      : isDark
                      ? "bg-gray-800 text-gray-100"
                      : "bg-white text-gray-900 border border-gray-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>

              {/* Inline Widget */}
              {msg.widget && (
                <div
                  className={`rounded-2xl overflow-hidden border ${
                    isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
                  }`}
                >
                  {/* Widget Header */}
                  <div
                    className={`px-4 py-2 flex items-center justify-between border-b ${
                      isDark ? "border-gray-700" : "border-gray-100"
                    }`}
                  >
                    <span className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-600"}`}>
                      {msg.widget.toolName.replace("show_", "").replace(/_/g, " ")}
                    </span>
                    <button
                      onClick={() => setExpandedWidget(msg.widget!)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isDark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"
                      }`}
                      title="Expand"
                    >
                      <Maximize2 size={16} />
                    </button>
                  </div>
                  {/* Widget Content */}
                  <div className="h-[400px]">
                    <WidgetRenderer
                      html={msg.widget.html}
                      toolOutput={msg.widget.toolOutput}
                      theme={theme}
                      onMessage={handleWidgetMessage}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div
                className={`rounded-2xl px-4 py-3 ${
                  isDark ? "bg-gray-800" : "bg-white border border-gray-200"
                }`}
              >
                <div className="flex items-center gap-1">
                  <div
                    className={`w-2 h-2 rounded-full animate-bounce ${isDark ? "bg-gray-500" : "bg-gray-400"}`}
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className={`w-2 h-2 rounded-full animate-bounce ${isDark ? "bg-gray-500" : "bg-gray-400"}`}
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className={`w-2 h-2 rounded-full animate-bounce ${isDark ? "bg-gray-500" : "bg-gray-400"}`}
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area - only show in chat mode */}
      {interactionMode === "chat" && (
      <div className={`border-t ${isDark ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-white"}`}>
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div
            className={`flex items-center gap-2 sm:gap-3 rounded-2xl border px-3 sm:px-4 py-2 ${
              isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            }`}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Message ChatGPT..."
              disabled={loading}
              className={`flex-1 bg-transparent outline-none ${
                isDark ? "text-white placeholder-gray-500" : "text-gray-900 placeholder-gray-400"
              }`}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className={`p-2 rounded-lg transition-colors ${
                input.trim()
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : isDark
                  ? "text-gray-600"
                  : "text-gray-300"
              }`}
            >
              <Send size={18} />
            </button>
          </div>
          <p className={`text-xs text-center mt-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            {agentMode === "puter"
              ? "Powered by Puter.js - free, no API key needed"
              : "Local simulator for ChatGPT widget development"}
          </p>
        </div>
      </div>
      )}

      {/* Fullscreen Widget Modal */}
      {expandedWidget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div
            className={`w-full h-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] rounded-xl sm:rounded-2xl overflow-hidden flex flex-col ${
              isDark ? "bg-gray-900" : "bg-white"
            }`}
          >
            {/* Modal Header */}
            <div
              className={`px-4 py-3 flex items-center justify-between border-b ${
                isDark ? "border-gray-700" : "border-gray-200"
              }`}
            >
              <span className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                {expandedWidget.toolName.replace("show_", "").replace(/_/g, " ")}
              </span>
              <button
                onClick={() => setExpandedWidget(null)}
                className={`p-2 rounded-lg transition-colors ${
                  isDark ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-500"
                }`}
              >
                <X size={20} />
              </button>
            </div>
            {/* Modal Content */}
            <div className="flex-1 overflow-hidden">
              <WidgetRenderer
                html={expandedWidget.html}
                toolOutput={expandedWidget.toolOutput}
                theme={theme}
                displayMode="fullscreen"
                onMessage={handleWidgetMessage}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
