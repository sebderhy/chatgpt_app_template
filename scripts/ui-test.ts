#!/usr/bin/env tsx
/**
 * UI Test Tool for AI Agents
 *
 * Enables AI coding agents (like Claude Code) to autonomously test the
 * ChatGPT simulator by sending messages and capturing screenshots.
 *
 * Two modes:
 * 1. AI Mode (requires OPENAI_API_KEY): Full AI-in-the-loop testing
 *    pnpm run ui-test "Show me the carousel widget"
 *
 * 2. Direct Mode (no API key needed): Direct widget rendering
 *    pnpm run ui-test --widget carousel
 *
 * Output:
 *   - Screenshot saved to /tmp/ui-test/screenshot.png
 *   - DOM snapshot saved to /tmp/ui-test/dom.json
 *   - Console logs saved to /tmp/ui-test/console.log
 *
 * Requirements:
 *   - Run `pnpm run setup:test` first to install Playwright browsers
 *   - Server must be built (`pnpm run build`)
 */

import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Output directory for test artifacts
const OUTPUT_DIR = "/tmp/ui-test";
const SIMULATOR_URL = "http://localhost:8000/assets/simulator.html";
const SERVER_PORT = 8000;

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message: string) {
  console.error(`${colors.red}ERROR: ${message}${colors.reset}`);
}

// Check if Playwright is installed
async function checkPlaywright(): Promise<boolean> {
  try {
    await import("@playwright/test");
    return true;
  } catch {
    return false;
  }
}

// Check if Playwright browsers are installed
async function checkBrowsers(): Promise<boolean> {
  try {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("Executable doesn't exist") ||
      errorMessage.includes("browserType.launch")
    ) {
      return false;
    }
    return true;
  }
}

// Check if server is running
async function isServerRunning(): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${SERVER_PORT}/chat/status`);
    return response.ok;
  } catch {
    return false;
  }
}

// Check if API key is configured
async function hasApiKey(): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${SERVER_PORT}/chat/status`);
    const data = await response.json();
    return data.has_api_key === true;
  } catch {
    return false;
  }
}

// Get available tools (returns full tool names)
async function getAvailableTools(): Promise<string[]> {
  try {
    const response = await fetch(`http://localhost:${SERVER_PORT}/tools`);
    const data = await response.json();
    return (data.tools || []).map((t: { function: { name: string } }) => t.function.name);
  } catch {
    return [];
  }
}

// Get available widgets (for backwards compatibility, strips show_ prefix)
async function getAvailableWidgets(): Promise<string[]> {
  const tools = await getAvailableTools();
  return tools
    .filter((name) => name.startsWith("show_"))
    .map((name) => name.replace("show_", ""));
}

// Start the server
async function startServer(): Promise<ChildProcess> {
  log("Starting server...", "yellow");

  const serverProcess = spawn("pnpm", ["run", "server"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  const maxWait = 30000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    if (await isServerRunning()) {
      log("Server is ready!", "green");
      return serverProcess;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Server failed to start within 30 seconds");
}

// Ensure output directory exists
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

interface TestResult {
  success: boolean;
  hasWidget: boolean;
  isLoading: boolean;
  userMessages: string[];
  assistantMessages: string[];
  widgetCount: number;
  screenshotPath: string;
  domPath: string;
  logsPath: string;
}

// Main test function - AI mode (with API key)
async function runAITest(prompt: string, interactive: boolean): Promise<TestResult> {
  const { chromium } = await import("@playwright/test");

  log(`\nLaunching browser (headless: ${!interactive})...`, "blue");
  const browser = await chromium.launch({ headless: !interactive });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const consoleLogs: string[] = [];
  page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (error) => consoleLogs.push(`[error] ${error.message}`));

  try {
    log(`Navigating to ${SIMULATOR_URL}...`, "blue");
    await page.goto(SIMULATOR_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Take initial screenshot
    const initialScreenshot = path.join(OUTPUT_DIR, "initial.png");
    await page.screenshot({ path: initialScreenshot, fullPage: true });
    log(`Initial screenshot saved: ${initialScreenshot}`, "green");

    if (!interactive) {
      log(`\nSending message: "${prompt}"`, "blue");

      // Wait for input and type message
      const inputSelector = 'input[type="text"], textarea';
      await page.waitForSelector(inputSelector, { timeout: 5000 });
      await page.fill(inputSelector, prompt);

      // Send message
      const sendButton = page.locator('button[type="submit"], button:has-text("Send")');
      if (await sendButton.isVisible()) {
        await sendButton.click();
      } else {
        await page.keyboard.press("Enter");
      }

      log("Waiting for response (~30s for AI)...", "yellow");

      // Wait for response - look for iframe (widget) or loading to stop
      try {
        await page.waitForFunction(
          () => {
            const iframes = document.querySelectorAll("iframe");
            if (iframes.length > 0) return true;

            const loadingDots = document.querySelectorAll(".animate-bounce");
            if (loadingDots.length > 0) return false;

            // Check for assistant message
            const bubbles = document.querySelectorAll(".rounded-2xl.px-4.py-3");
            return bubbles.length >= 2; // User + assistant
          },
          { timeout: 90000 } // 90 second timeout for AI response
        );
      } catch {
        log("Response timeout - taking screenshot anyway", "yellow");
      }

      await page.waitForTimeout(2000); // Extra wait for rendering
    }

    // Take final screenshot
    const screenshotPath = path.join(OUTPUT_DIR, "screenshot.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    log(`Screenshot saved: ${screenshotPath}`, "green");

    // Capture DOM snapshot
    const domSnapshot = await page.evaluate(() => {
      const userMessages = Array.from(document.querySelectorAll('[class*="bg-blue-600"]'))
        .map((el) => el.textContent?.trim())
        .filter(Boolean) as string[];

      const assistantBubbles = Array.from(
        document.querySelectorAll('.rounded-2xl.px-4.py-3:not([class*="bg-blue-600"])')
      )
        .map((el) => el.textContent?.trim())
        .filter(Boolean) as string[];

      const widgets = document.querySelectorAll("iframe");
      const isLoading = document.querySelectorAll(".animate-bounce").length > 0;

      return {
        userMessages,
        assistantMessages: assistantBubbles,
        widgetCount: widgets.length,
        hasWidget: widgets.length > 0,
        isLoading,
        timestamp: new Date().toISOString(),
      };
    });

    const domPath = path.join(OUTPUT_DIR, "dom.json");
    fs.writeFileSync(domPath, JSON.stringify(domSnapshot, null, 2));

    const logsPath = path.join(OUTPUT_DIR, "console.log");
    fs.writeFileSync(logsPath, consoleLogs.join("\n"));

    if (interactive) {
      log("\n🖥️  Interactive mode - browser is open", "cyan");
      log("   Press Ctrl+C to close and exit", "reset");
      await new Promise(() => {});
    }

    await browser.close();

    return {
      success: !domSnapshot.isLoading && (domSnapshot.hasWidget || domSnapshot.assistantMessages.length > 0),
      ...domSnapshot,
      screenshotPath,
      domPath,
      logsPath,
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

// Direct widget/tool test - no API key needed
// toolName can be either a widget name (will add show_ prefix) or an exact tool name
async function runDirectWidgetTest(toolName: string, isExactToolName: boolean = false): Promise<TestResult> {
  const { chromium } = await import("@playwright/test");

  const actualToolName = isExactToolName ? toolName : `show_${toolName}`;
  log(`\nDirect tool test: ${actualToolName}`, "blue");

  // First, call the tool directly to get widget HTML
  log("Calling tool endpoint...", "blue");
  const toolResponse = await fetch(`http://localhost:${SERVER_PORT}/tools/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: actualToolName, arguments: {} }),
  });

  const toolData = await toolResponse.json();
  if (toolData.error) {
    throw new Error(`Tool error: ${toolData.error}`);
  }

  log("Widget data received, launching browser...", "blue");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const consoleLogs: string[] = [];
  page.on("console", (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (error) => consoleLogs.push(`[error] ${error.message}`));

  try {
    // Create injection script for window.openai
    const openaiConfig = {
      theme: "light",
      displayMode: "inline",
      maxHeight: 500,
      safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
      locale: "en-US",
      toolInput: {},
      toolOutput: toolData.tool_output,
      toolResponseMetadata: null,
      widgetState: null,
    };

    const injectionScript =
      "<script>" +
      "window.openai = " + JSON.stringify(openaiConfig) + ";" +
      "window.openai.callTool = async () => ({});" +
      "window.openai.setWidgetState = async () => {};" +
      "window.openai.sendFollowUpMessage = async () => {};" +
      "window.openai.openExternal = () => {};" +
      "window.openai.requestDisplayMode = async () => ({});" +
      "window.openai.requestModal = async () => ({});" +
      "window.openai.requestClose = async () => {};" +
      "window.dispatchEvent(new CustomEvent('openai:set_globals'));" +
      "</script>";

    // Inject into widget HTML
    const modifiedWidgetHtml = toolData.html.replace("<head>", "<head>" + injectionScript);

    // Create simple test page (without inline widget script)
    const testHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Widget Test: ${actualToolName}</title>
  <style>
    body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; background: #f5f5f5; }
    h1 { margin: 0 0 20px 0; font-size: 18px; color: #333; }
    .widget-container { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); height: 500px; }
    iframe { width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>
  <h1>Tool: ${actualToolName}</h1>
  <div class="widget-container">
    <iframe id="widget-frame" title="Widget"></iframe>
  </div>
</body>
</html>`;

    await page.setContent(testHtml);

    // Now set the iframe srcdoc via Playwright (avoids HTML escaping issues)
    await page.evaluate((html) => {
      const iframe = document.getElementById("widget-frame") as HTMLIFrameElement;
      if (iframe) {
        iframe.srcdoc = html;
      }
    }, modifiedWidgetHtml);
    await page.waitForTimeout(2000); // Wait for widget to render

    // Take screenshot
    const screenshotPath = path.join(OUTPUT_DIR, "screenshot.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    log(`Screenshot saved: ${screenshotPath}`, "green");

    // Check if widget rendered
    const hasWidget = await page.evaluate(() => {
      const iframe = document.querySelector("iframe");
      return iframe !== null;
    });

    const domSnapshot = {
      userMessages: [],
      assistantMessages: [`Direct tool test: ${actualToolName}`],
      widgetCount: hasWidget ? 1 : 0,
      hasWidget,
      isLoading: false,
      toolName: actualToolName,
      toolOutput: toolData.tool_output,
      timestamp: new Date().toISOString(),
    };

    const domPath = path.join(OUTPUT_DIR, "dom.json");
    fs.writeFileSync(domPath, JSON.stringify(domSnapshot, null, 2));

    const logsPath = path.join(OUTPUT_DIR, "console.log");
    fs.writeFileSync(logsPath, consoleLogs.join("\n"));

    await browser.close();

    return {
      success: hasWidget,
      hasWidget,
      isLoading: false,
      userMessages: [],
      assistantMessages: [`Direct tool test: ${actualToolName}`],
      widgetCount: hasWidget ? 1 : 0,
      screenshotPath,
      domPath,
      logsPath,
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

// Print test results
function printResults(result: TestResult, mode: string, prompt: string) {
  log("\n📊 Test Summary:", "cyan");
  log(`   Mode: ${mode}`, "reset");
  log(`   Prompt/Widget: "${prompt}"`, "reset");
  log(`   User messages: ${result.userMessages.length}`, "reset");
  log(`   Assistant responses: ${result.assistantMessages.length}`, "reset");
  log(`   Widgets rendered: ${result.widgetCount}`, "reset");
  log(
    `   Has widget: ${result.hasWidget ? "Yes ✓" : "No"}`,
    result.hasWidget ? "green" : "yellow"
  );
  log(
    `   Still loading: ${result.isLoading ? "Yes (timeout)" : "No"}`,
    result.isLoading ? "yellow" : "green"
  );
  log(
    `   Test result: ${result.success ? "PASSED ✓" : "NEEDS REVIEW"}`,
    result.success ? "green" : "yellow"
  );

  log("\n📁 Artifacts:", "cyan");
  log(`   Screenshot: ${result.screenshotPath}`, "reset");
  log(`   DOM snapshot: ${result.domPath}`, "reset");
  log(`   Console logs: ${result.logsPath}`, "reset");

  log("\n💡 Tip for AI agents:", "cyan");
  log(`   Read the screenshot with: Read tool → ${result.screenshotPath}`, "reset");
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);
  const interactive = args.includes("--interactive") || args.includes("-i");

  // Parse --widget flag (adds show_ prefix)
  const widgetArg = args.find((a) => a.startsWith("--widget=") || a.startsWith("-w="));
  const widgetFlag = args.includes("--widget") || args.includes("-w");
  const widgetIndex = args.findIndex((a) => a === "--widget" || a === "-w");

  // Parse --tool flag (exact tool name, no prefix added)
  const toolArg = args.find((a) => a.startsWith("--tool=") || a.startsWith("-t="));
  const toolFlag = args.includes("--tool") || args.includes("-t");
  const toolIndex = args.findIndex((a) => a === "--tool" || a === "-t");

  let widgetName: string | null = null;
  let exactToolName: string | null = null;

  if (widgetArg) {
    widgetName = widgetArg.split("=")[1];
  } else if (widgetFlag && widgetIndex !== -1 && args[widgetIndex + 1] && !args[widgetIndex + 1].startsWith("-")) {
    widgetName = args[widgetIndex + 1];
  }

  if (toolArg) {
    exactToolName = toolArg.split("=")[1];
  } else if (toolFlag && toolIndex !== -1 && args[toolIndex + 1] && !args[toolIndex + 1].startsWith("-")) {
    exactToolName = args[toolIndex + 1];
  }

  const prompt = args
    .filter((arg) => !arg.startsWith("-") && arg !== widgetName && arg !== exactToolName)
    .join(" ");

  // Show help if no arguments
  if (!prompt && !widgetName && !exactToolName && !interactive) {
    log("🧪 UI Test Tool for AI Agents", "cyan");
    log("\nUsage:", "reset");
    log('  pnpm run ui-test "Your prompt here"     # AI mode (needs API key)', "green");
    log("  pnpm run ui-test --widget carousel      # Widget test (adds show_ prefix)", "green");
    log("  pnpm run ui-test --tool my_custom_tool  # Exact tool name (no prefix)", "green");
    log("  pnpm run ui-test --interactive          # Open browser for manual testing", "green");
    log("\nExamples:", "reset");
    log('  pnpm run ui-test "Show me the carousel widget"', "reset");
    log("  pnpm run ui-test --widget dashboard     # Calls show_dashboard", "reset");
    log("  pnpm run ui-test --tool my_custom_tool  # Calls my_custom_tool exactly", "reset");
    log("  pnpm run ui-test -t another_tool        # Short form for --tool", "reset");
    log("\nAvailable tools:", "reset");

    // Try to list tools
    if (await isServerRunning()) {
      const tools = await getAvailableTools();
      tools.forEach((t) => log(`  - ${t}`, "reset"));
    } else {
      log("  (start server to see available tools)", "yellow");
    }

    log("\nRequirements:", "reset");
    log("  1. Run `pnpm run setup:test` to install Playwright browsers", "reset");
    log("  2. Run `pnpm run build` to build widgets", "reset");
    log("  3. For AI mode: set OPENAI_API_KEY in .env", "reset");
    process.exit(0);
  }

  log("\n🧪 UI Test Tool for AI Agents\n", "cyan");

  // Check Playwright
  if (!(await checkPlaywright())) {
    logError("Playwright is not installed. Run: pnpm install");
    process.exit(1);
  }

  if (!(await checkBrowsers())) {
    logError("Playwright browsers not installed.");
    log("\nRun: pnpm run setup:test\n", "yellow");
    process.exit(1);
  }

  // Check/start server
  let serverProcess: ChildProcess | null = null;
  if (!(await isServerRunning())) {
    serverProcess = await startServer();
  } else {
    log("Server already running", "green");
  }

  ensureOutputDir();

  try {
    let result: TestResult;

    if (exactToolName) {
      // Direct tool test mode (exact tool name)
      result = await runDirectWidgetTest(exactToolName, true);
      printResults(result, "Direct Tool Test", exactToolName);
    } else if (widgetName) {
      // Direct widget test mode (adds show_ prefix)
      result = await runDirectWidgetTest(widgetName, false);
      printResults(result, "Direct Widget Test", `show_${widgetName}`);
    } else if (interactive) {
      // Interactive mode
      result = await runAITest("", true);
      printResults(result, "Interactive", "manual");
    } else {
      // AI mode - check for API key
      const apiKeyAvailable = await hasApiKey();
      if (!apiKeyAvailable) {
        log("⚠️  No OPENAI_API_KEY found. Using direct tool test instead.", "yellow");
        log("   For AI-powered testing, set OPENAI_API_KEY in .env\n", "yellow");

        // Try to extract tool name from prompt
        const tools = await getAvailableTools();
        const matchedTool = tools.find(
          (t) => prompt.toLowerCase().includes(t.toLowerCase())
        );

        if (matchedTool) {
          result = await runDirectWidgetTest(matchedTool, true);
          printResults(result, "Direct Tool Test (fallback)", matchedTool);
        } else {
          logError(`Could not determine tool from prompt: "${prompt}"`);
          log("\nAvailable tools:", "yellow");
          tools.forEach((t) => log(`  - ${t}`, "reset"));
          log("\nUse: pnpm run ui-test --tool <name>", "yellow");
          process.exit(1);
        }
      } else {
        log("Using OpenAI API for AI-powered testing", "green");
        result = await runAITest(prompt, false);
        printResults(result, "AI (OpenAI API)", prompt);
      }
    }
  } finally {
    if (serverProcess) {
      log("\nStopping server...", "yellow");
      process.kill(-serverProcess.pid!, "SIGTERM");
    }
  }
}

main().catch((error) => {
  logError(error.message);
  process.exit(1);
});
