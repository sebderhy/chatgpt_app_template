/**
 * End-to-End Test for App Tester
 *
 * This test verifies that the apptester infrastructure works correctly.
 * It opens the actual apptester UI and tests the full integration path:
 * apptester → McpAppRenderer → widget rendering.
 *
 * WHY THIS TEST EXISTS:
 * --------------------
 * The apptester is CRITICAL INFRASTRUCTURE that should never be modified
 * during normal app development. This E2E test ensures:
 * - The apptester UI loads correctly
 * - Tool invocation works
 * - Widgets actually render in the iframe
 * - The event bridge between host and widget works
 *
 * If this test fails, the entire local testing workflow is broken.
 */

import { test, expect, chromium, Browser } from "@playwright/test";
import { spawn, ChildProcess } from "child_process";
import { setTimeout as delay } from "timers/promises";

const SERVER_URL = "http://localhost:8000";

let serverProcess: ChildProcess | null = null;

/**
 * Check if server is already running
 */
async function isServerRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${SERVER_URL}/tools`, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Start the MCP server for testing
 */
async function startServer(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = spawn("pnpm", ["run", "server"], {
      cwd: process.cwd(),
      detached: true,
      stdio: "pipe",
    });

    let started = false;
    const timeout = globalThis.setTimeout(() => {
      if (!started) {
        reject(new Error("Server failed to start within 10 seconds"));
      }
    }, 10000);

    proc.stdout?.on("data", (data) => {
      const output = data.toString();
      if (output.includes("Application startup complete") && !started) {
        started = true;
        globalThis.clearTimeout(timeout);
        resolve(proc);
      }
    });

    proc.stderr?.on("data", (data) => {
      const output = data.toString();
      if (output.includes("Application startup complete") && !started) {
        started = true;
        globalThis.clearTimeout(timeout);
        resolve(proc);
      }
    });

    proc.on("error", (err) => {
      globalThis.clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Check if we can launch a browser (Playwright installed)
 */
async function canLaunchBrowser(): Promise<boolean> {
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

// Setup and teardown
test.beforeAll(async () => {
  if (!(await canLaunchBrowser())) return;

  if (!(await isServerRunning())) {
    serverProcess = await startServer();
    // Give server extra time to fully initialize
    await delay(2000);
  }
});

test.afterAll(async () => {
  if (serverProcess) {
    process.kill(-serverProcess.pid!, "SIGTERM");
  }
});

/**
 * TEST: App Tester loads and displays widgets
 *
 * This is the CRITICAL integration test that verifies:
 * 1. Apptester UI loads
 * 2. Server provides tools list
 * 3. Tool invocation works
 * 4. Widget HTML is loaded into iframe
 * 5. Widget actually renders content (not blank)
 *
 * If this test fails, the entire development workflow is broken.
 */
test("apptester loads and renders widgets", async () => {
  if (!(await canLaunchBrowser())) {
    test.skip();
    return;
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    // Track failed resource loads (CSS/JS)
    const failedResources: string[] = [];
    page.on('requestfailed', (request) => {
      const url = request.url();
      if (url.includes('.js') || url.includes('.css')) {
        failedResources.push(`${request.failure()?.errorText}: ${url}`);
      }
    });

    // Track console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Load the apptester
    await page.goto(`${SERVER_URL}/assets/apptester.html`, { waitUntil: "load" });

    // 2. Wait for React app to mount
    await page.waitForFunction(() => {
      const root = document.getElementById('apptester-root');
      return root && root.children.length > 0;
    }, { timeout: 10000 });

    // 3. Switch to Direct mode
    const directButton = page.locator('button:has-text("Direct")');
    await directButton.waitFor({ state: 'visible', timeout: 5000 });
    await directButton.click();

    // 4. Wait for tools select
    await page.waitForSelector('select', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // 5. Select first real tool
    const options = await page.locator('select option').allTextContents();
    expect(options.length).toBeGreaterThan(1);
    const firstTool = options.find((opt) => opt && !opt.includes("--") && opt.trim().length > 0);
    expect(firstTool).toBeTruthy();
    await page.locator('select').selectOption({ label: firstTool! });
    await page.waitForTimeout(500);

    // 6. Click Invoke
    const invokeButton = page.locator('button:has-text("Invoke Tool")');
    await expect(invokeButton).toBeVisible();
    await invokeButton.click();

    // 7. Wait for widget to load
    await page.waitForTimeout(3000);

    // 8. STRICT CHECK: Fail if any widget resources failed to load
    expect(failedResources, `Widget resources failed to load: ${failedResources.join(', ')}`).toHaveLength(0);

    // 9. Navigate the double-iframe structure required by MCP Apps protocol:
    //    Page → outer iframe (sandbox-proxy on port 8001) → inner iframe (widget)
    const outerFrame = page.frameLocator('iframe[title*="MCP"]').first();
    const widgetFrame = outerFrame.frameLocator('iframe').first();

    // 10. Verify widget rendered something (not blank)
    // Look for common widget elements: text, images, buttons, divs with content
    const hasContent = await Promise.race([
      widgetFrame.locator('body').textContent().then((text) => (text?.trim().length || 0) > 10),
      widgetFrame.locator('img').count().then((count) => count > 0),
      widgetFrame.locator('button').count().then((count) => count > 0),
      widgetFrame.locator('[class*="card"], [class*="item"], article').count().then((count) => count > 0),
    ]);

    expect(hasContent).toBeTruthy();

    // 11. Fail on console errors (filters out noise like React DevTools)
    const realErrors = consoleErrors.filter(
      (e) => !e.includes("React DevTools") && !e.includes("Download the React DevTools")
    );
    expect(realErrors, `Console errors:\n${realErrors.join("\n")}`).toHaveLength(0);

    await context.close();
  } finally {
    await browser.close();
  }
});

/**
 * TEST: App Tester theme switching works
 *
 * Verifies the theme toggle button works and widgets respond to theme changes.
 */
test("apptester theme switching works", async () => {
  if (!(await canLaunchBrowser())) {
    test.skip();
    return;
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    await page.goto(`${SERVER_URL}/assets/apptester.html`, { waitUntil: "networkidle" });

    // Wait for apptester to load
    await page.waitForFunction(() => {
      const root = document.getElementById('apptester-root');
      return root && root.children.length > 0;
    }, { timeout: 10000 });

    // Find theme toggle button (has title attribute with "Switch to..." text)
    const themeButton = page.locator('button[title*="Switch to"]');
    await expect(themeButton).toBeVisible();

    // Get initial color scheme by checking header background
    const initialBg = await page.locator('header').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Click theme toggle
    await themeButton.click();
    await page.waitForTimeout(1000);

    // Verify theme changed by checking header background changed
    const newBg = await page.locator('header').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Theme toggle should change header background from light to dark or vice versa
    expect(newBg).not.toBe(initialBg);

    await context.close();
  } finally {
    await browser.close();
  }
});
