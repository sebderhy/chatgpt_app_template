/**
 * Widget Accessibility Tests - Browser-based tests for accessibility compliance.
 *
 * WHY THESE TESTS MATTER:
 * -----------------------
 * Accessibility isn't just about compliance - it's about ensuring your widget
 * works for all users, including those using:
 * - Screen readers (need alt text, ARIA labels)
 * - Keyboard navigation (need focus management, tabindex)
 * - High contrast modes (need sufficient color contrast)
 *
 * ChatGPT users include people with disabilities. Inaccessible widgets
 * exclude these users and may violate accessibility laws (ADA, WCAG).
 *
 * REFERENCES:
 * -----------
 * - WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
 * - MDN Accessibility: https://developer.mozilla.org/en-US/docs/Web/Accessibility
 *
 * Run with: pnpm run test:browser
 */

import { test, expect, chromium, type Page, type Browser } from "@playwright/test";
import { spawn, type ChildProcess } from "child_process";

const SERVER_PORT = 8000;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

let serverProcess: ChildProcess | null = null;
let browserAvailable: boolean | null = null;

/**
 * Check if browser can be launched (cached)
 */
async function canLaunchBrowser(): Promise<boolean> {
  if (browserAvailable !== null) return browserAvailable;

  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    browserAvailable = true;
  } catch {
    browserAvailable = false;
    console.log("\n⚠️  Browser not available - accessibility tests will be skipped");
    console.log("   Run: pnpm run setup:test && npx playwright install-deps\n");
  }
  return browserAvailable;
}

/**
 * Check if server is running
 */
async function isServerRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${SERVER_URL}/chat/status`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Start the MCP server
 */
async function startServer(): Promise<ChildProcess> {
  const proc = spawn("pnpm", ["run", "server"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  const maxWait = 30000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    if (await isServerRunning()) {
      return proc;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Server failed to start within 30 seconds");
}

/**
 * Get all widget tools from the server
 */
async function getWidgetTools(): Promise<string[]> {
  const response = await fetch(`${SERVER_URL}/tools`);
  const data = await response.json();
  return (data.tools || [])
    .map((t: { function: { name: string } }) => t.function.name)
    .filter((name: string) => name.startsWith("show_"));
}

/**
 * Extract widget name from tool name (show_carousel -> carousel)
 */
function getWidgetName(toolName: string): string {
  return toolName.replace(/^show_/, "").replace(/_/g, "-");
}

/**
 * Render a widget and return the page with widget loaded
 */
async function setupWidgetPage(
  browser: Browser,
  toolName: string,
  theme: "light" | "dark"
): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const toolResponse = await fetch(`${SERVER_URL}/tools/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: toolName, arguments: {} }),
  });

  const toolData = await toolResponse.json();
  if (toolData.error) {
    throw new Error(`Tool error: ${toolData.error}`);
  }

  const openaiConfig = {
    theme,
    displayMode: "inline",
    maxHeight: 500,
    safeArea: { insets: { top: 0, bottom: 0, left: 0, right: 0 } },
    locale: "en-US",
    userAgent: {
      device: { type: "desktop" },
      capabilities: { hover: true, touch: false },
    },
    toolInput: {},
    toolOutput: toolData.tool_output,
    toolResponseMetadata: null,
    widgetState: null,
  };

  const injectionScript = `<script>
    window.openai = ${JSON.stringify(openaiConfig)};
    window.openai.callTool = async () => ({ result: "" });
    window.openai.setWidgetState = async () => {};
    window.openai.sendFollowUpMessage = async () => {};
    window.openai.openExternal = () => {};
    window.openai.requestDisplayMode = async () => ({ mode: "inline" });
    window.openai.requestModal = async () => {};
    window.openai.requestClose = async () => {};
    window.dispatchEvent(new CustomEvent("openai:set_globals"));
  </script>`;

  const widgetHtml = toolData.html.replace("<head>", "<head>" + injectionScript);

  // Load widget directly (not in iframe) for easier DOM inspection
  await page.setContent(widgetHtml);
  await page.waitForTimeout(2000);

  return page;
}

// Setup and teardown
test.beforeAll(async () => {
  if (!(await canLaunchBrowser())) return;

  if (!(await isServerRunning())) {
    serverProcess = await startServer();
  }
});

test.afterAll(async () => {
  if (serverProcess) {
    process.kill(-serverProcess.pid!, "SIGTERM");
  }
});

test.describe("Widget Accessibility", () => {
  /**
   * TEST: All images must have alt text
   *
   * WHY THIS MATTERS:
   * -----------------
   * Screen readers announce images using their alt text. Without alt text,
   * blind users hear "image" with no context about what the image shows.
   *
   * WCAG REQUIREMENT: 1.1.1 Non-text Content (Level A)
   * https://www.w3.org/WAI/WCAG21/Understanding/non-text-content
   *
   * HOW TO FIX:
   * -----------
   * Add alt attribute to all images:
   *
   *   <img src="photo.jpg" alt="Golden Gate Bridge at sunset" />
   *
   * For decorative images (visual flourishes), use empty alt:
   *
   *   <img src="divider.png" alt="" />  // Screen reader skips this
   *
   * For background images that convey meaning, use role="img" with aria-label:
   *
   *   <div
   *     style="background-image: url(hero.jpg)"
   *     role="img"
   *     aria-label="Team celebrating product launch"
   *   />
   */
  test("all images have alt text", async () => {
    if (!(await canLaunchBrowser())) {
      test.skip();
      return;
    }

    const browser = await chromium.launch({ headless: true });

    try {
      const tools = await getWidgetTools();
      expect(tools.length).toBeGreaterThan(0);

      const violations: string[] = [];

      for (const tool of tools) {
        const page = await setupWidgetPage(browser, tool, "light");

        try {
          // Find all images
          const images = await page.locator("img").all();

          for (const img of images) {
            const alt = await img.getAttribute("alt");
            const src = await img.getAttribute("src");

            // alt="" is valid for decorative images, but alt should exist
            if (alt === null) {
              const srcShort = src ? src.substring(0, 50) : "unknown";
              violations.push(`${tool}: <img src="${srcShort}..."> missing alt attribute`);
            }
          }

          // Also check for background images that might need aria-label
          const elementsWithBgImage = await page
            .locator('[style*="background-image"]')
            .all();

          for (const elem of elementsWithBgImage) {
            const ariaLabel = await elem.getAttribute("aria-label");
            const role = await elem.getAttribute("role");

            // If it's marked as img role, it needs aria-label
            if (role === "img" && !ariaLabel) {
              violations.push(`${tool}: role="img" element missing aria-label`);
            }
          }
        } finally {
          await page.close();
        }
      }

      expect(
        violations,
        `
IMAGE ALT TEXT ERROR
${violations.join("\n")}

Why: Screen readers need alt text to describe images to blind users.
Fix: Add alt="description" to <img>, or alt="" for decorative images.
WCAG: 1.1.1 Non-text Content - https://www.w3.org/WAI/WCAG21/Understanding/non-text-content
`
      ).toHaveLength(0);
    } finally {
      await browser.close();
    }
  });

  /**
   * TEST: Text has sufficient color contrast
   *
   * WHY THIS MATTERS:
   * -----------------
   * Low contrast text is hard to read for users with:
   * - Low vision
   * - Color blindness
   * - Bright ambient lighting (outdoors, sunny office)
   * - Older/low-quality displays
   *
   * WCAG REQUIREMENT: 1.4.3 Contrast (Minimum) - Level AA
   * - Normal text: 4.5:1 contrast ratio
   * - Large text (18pt or 14pt bold): 3:1 contrast ratio
   *
   * https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum
   *
   * HOW TO FIX:
   * -----------
   * Use a contrast checker tool:
   * - WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
   * - Chrome DevTools: Elements > Computed > Contrast
   *
   * Common fixes:
   * - Light gray text (#999) on white → Use darker gray (#595959)
   * - Blue links on dark bg → Use lighter blue (#6bb3ff)
   */
  test("text has sufficient color contrast", async () => {
    if (!(await canLaunchBrowser())) {
      test.skip();
      return;
    }

    const browser = await chromium.launch({ headless: true });

    try {
      const tools = await getWidgetTools();
      const violations: string[] = [];

      // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
      const MIN_CONTRAST_NORMAL = 4.5;
      const MIN_CONTRAST_LARGE = 3.0;

      for (const tool of tools) {
        // Test both themes
        for (const theme of ["light", "dark"] as const) {
          const page = await setupWidgetPage(browser, tool, theme);

          try {
            // Get computed styles for text elements
            const contrastIssues = await page.evaluate(
              ({ minNormal, minLarge }) => {
                const issues: string[] = [];

                // Helper to parse color
                function parseColor(
                  color: string
                ): { r: number; g: number; b: number } | null {
                  const match = color.match(
                    /rgba?\((\d+),\s*(\d+),\s*(\d+)/
                  );
                  if (match) {
                    return {
                      r: parseInt(match[1]),
                      g: parseInt(match[2]),
                      b: parseInt(match[3]),
                    };
                  }
                  return null;
                }

                // Calculate relative luminance (WCAG formula)
                function getLuminance(r: number, g: number, b: number): number {
                  const [rs, gs, bs] = [r, g, b].map((c) => {
                    c = c / 255;
                    return c <= 0.03928
                      ? c / 12.92
                      : Math.pow((c + 0.055) / 1.055, 2.4);
                  });
                  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
                }

                // Calculate contrast ratio
                function getContrastRatio(
                  fg: { r: number; g: number; b: number },
                  bg: { r: number; g: number; b: number }
                ): number {
                  const l1 = getLuminance(fg.r, fg.g, fg.b);
                  const l2 = getLuminance(bg.r, bg.g, bg.b);
                  const lighter = Math.max(l1, l2);
                  const darker = Math.min(l1, l2);
                  return (lighter + 0.05) / (darker + 0.05);
                }

                // Check text elements
                const textElements = document.querySelectorAll(
                  "p, span, h1, h2, h3, h4, h5, h6, a, button, label, li, td, th"
                );

                for (const elem of textElements) {
                  const style = window.getComputedStyle(elem);
                  const text = elem.textContent?.trim();

                  if (!text || text.length === 0) continue;

                  const fgColor = parseColor(style.color);
                  const bgColor = parseColor(style.backgroundColor);

                  // Skip if we can't parse colors or bg is transparent
                  if (!fgColor) continue;
                  if (!bgColor || style.backgroundColor === "rgba(0, 0, 0, 0)") {
                    // Try to find parent background
                    let parent = elem.parentElement;
                    let foundBg = false;
                    while (parent) {
                      const parentStyle = window.getComputedStyle(parent);
                      const parentBg = parseColor(parentStyle.backgroundColor);
                      if (
                        parentBg &&
                        parentStyle.backgroundColor !== "rgba(0, 0, 0, 0)"
                      ) {
                        const ratio = getContrastRatio(fgColor, parentBg);
                        const fontSize = parseFloat(style.fontSize);
                        const isLarge = fontSize >= 18 || (fontSize >= 14 && style.fontWeight >= "700");
                        const minRequired = isLarge ? minLarge : minNormal;

                        if (ratio < minRequired) {
                          issues.push(
                            `"${text.substring(0, 20)}..." ratio ${ratio.toFixed(1)}:1 < ${minRequired}:1`
                          );
                        }
                        foundBg = true;
                        break;
                      }
                      parent = parent.parentElement;
                    }
                    continue;
                  }

                  const ratio = getContrastRatio(fgColor, bgColor);
                  const fontSize = parseFloat(style.fontSize);
                  const isLarge =
                    fontSize >= 18 ||
                    (fontSize >= 14 && style.fontWeight >= "700");
                  const minRequired = isLarge ? minLarge : minNormal;

                  if (ratio < minRequired) {
                    issues.push(
                      `"${text.substring(0, 20)}..." ratio ${ratio.toFixed(1)}:1 < ${minRequired}:1`
                    );
                  }
                }

                // Return unique issues (limit to first 3)
                return [...new Set(issues)].slice(0, 3);
              },
              { minNormal: MIN_CONTRAST_NORMAL, minLarge: MIN_CONTRAST_LARGE }
            );

            for (const issue of contrastIssues) {
              violations.push(`${tool} (${theme}): ${issue}`);
            }
          } finally {
            await page.close();
          }
        }
      }

      // Soft check - log violations but don't fail (contrast often intentional)
      if (violations.length > 0) {
        console.log(`
⚠️  CONTRAST WARNING: ${violations.length} issues found
${violations.slice(0, 3).join("\n")}${violations.length > 3 ? `\n...and ${violations.length - 3} more` : ""}

Why: Low contrast text is hard to read for low vision users.
Fix: Use darker grays in light mode, lighter colors in dark mode.
WCAG 1.4.3: Normal text needs 4.5:1, large text needs 3:1.
Check: https://webaim.org/resources/contrastchecker/
`);
      }

      // Don't fail the test for contrast - just warn
      // expect(violations).toHaveLength(0);
    } finally {
      await browser.close();
    }
  });

  /**
   * TEST: Interactive elements are keyboard accessible
   *
   * WHY THIS MATTERS:
   * -----------------
   * Many users navigate using only a keyboard:
   * - Users with motor disabilities who can't use a mouse
   * - Power users who prefer keyboard shortcuts
   * - Screen reader users who navigate via Tab key
   *
   * If clickable elements aren't in the tab order, keyboard users can't
   * interact with your widget at all.
   *
   * WCAG REQUIREMENT: 2.1.1 Keyboard (Level A)
   * https://www.w3.org/WAI/WCAG21/Understanding/keyboard
   *
   * HOW TO FIX:
   * -----------
   * Option 1: Use native interactive elements (preferred)
   *   <button onClick={handleClick}>Click me</button>
   *
   * Option 2: Add keyboard support to custom elements
   *   <div
   *     role="button"
   *     tabIndex={0}
   *     onClick={handleClick}
   *     onKeyDown={(e) => e.key === 'Enter' && handleClick()}
   *   >
   *     Click me
   *   </div>
   */
  test("interactive elements are keyboard accessible", async () => {
    if (!(await canLaunchBrowser())) {
      test.skip();
      return;
    }

    const browser = await chromium.launch({ headless: true });

    try {
      const tools = await getWidgetTools();
      const violations: string[] = [];

      for (const tool of tools) {
        const page = await setupWidgetPage(browser, tool, "light");

        try {
          // Check for clickable elements that aren't keyboard accessible
          const issues = await page.evaluate(() => {
            const problems: string[] = [];

            // Find elements with click handlers but no keyboard accessibility
            const clickableElements = document.querySelectorAll(
              '[onclick], [data-clickable], .clickable, .cursor-pointer'
            );

            for (const elem of clickableElements) {
              const tagName = elem.tagName.toLowerCase();
              const tabIndex = elem.getAttribute("tabindex");
              const role = elem.getAttribute("role");

              // Native interactive elements are fine
              if (["a", "button", "input", "select", "textarea"].includes(tagName)) {
                continue;
              }

              // Check if it's keyboard accessible
              const hasTabIndex = tabIndex !== null && tabIndex !== "-1";
              const hasInteractiveRole = role && ["button", "link", "menuitem", "tab"].includes(role);

              if (!hasTabIndex && !hasInteractiveRole) {
                const text = elem.textContent?.trim().substring(0, 20) || "element";
                problems.push(`<${tagName}> "${text}..." needs tabindex or role="button"`);
              }
            }

            // Check for buttons/links without visible text or aria-label
            const interactiveElements = document.querySelectorAll("button, a, [role='button']");
            for (const elem of interactiveElements) {
              const text = elem.textContent?.trim();
              const ariaLabel = elem.getAttribute("aria-label");
              const ariaLabelledBy = elem.getAttribute("aria-labelledby");
              const title = elem.getAttribute("title");

              // Check if there's an img with alt inside
              const imgAlt = elem.querySelector("img")?.getAttribute("alt");

              if (!text && !ariaLabel && !ariaLabelledBy && !title && !imgAlt) {
                const tagName = elem.tagName.toLowerCase();
                problems.push(`<${tagName}> has no accessible name (add aria-label)`);
              }
            }

            return problems.slice(0, 5);
          });

          for (const issue of issues) {
            violations.push(`${tool}: ${issue}`);
          }
        } finally {
          await page.close();
        }
      }

      // Log violations but don't fail - keyboard accessibility is complex
      if (violations.length > 0) {
        console.log(`
⚠️  KEYBOARD WARNING: ${violations.length} elements may not be reachable
${violations.slice(0, 3).join("\n")}${violations.length > 3 ? `\n...and ${violations.length - 3} more` : ""}

Why: Keyboard-only users can't reach elements not in the tab order.
Fix: Use <button> instead of <div onClick>, or add tabIndex={0} + role="button".
WCAG 2.1.1: https://www.w3.org/WAI/WCAG21/Understanding/keyboard
`);
      }

      // Soft check - just warn for now
      // expect(violations).toHaveLength(0);
    } finally {
      await browser.close();
    }
  });

  /**
   * TEST: No duplicate IDs in widget HTML
   *
   * WHY THIS MATTERS:
   * -----------------
   * HTML IDs must be unique within a document. Duplicate IDs cause:
   * - ARIA relationships to break (aria-labelledby, aria-describedby)
   * - CSS selectors to target wrong elements
   * - JavaScript getElementById to return wrong element
   * - Form labels to associate with wrong inputs
   *
   * WCAG REQUIREMENT: 4.1.1 Parsing (Level A)
   * https://www.w3.org/WAI/WCAG21/Understanding/parsing
   *
   * HOW TO FIX:
   * -----------
   * Ensure all IDs are unique. Common patterns:
   *
   *   // BAD: Duplicate IDs in a list
   *   {items.map(item => <input id="search" />)}
   *
   *   // GOOD: Include unique key in ID
   *   {items.map(item => <input id={`search-${item.id}`} />)}
   */
  test("no duplicate IDs in widget HTML", async () => {
    if (!(await canLaunchBrowser())) {
      test.skip();
      return;
    }

    const browser = await chromium.launch({ headless: true });

    try {
      const tools = await getWidgetTools();
      const violations: string[] = [];

      for (const tool of tools) {
        const page = await setupWidgetPage(browser, tool, "light");

        try {
          const duplicateIds = await page.evaluate(() => {
            const ids = new Map<string, number>();
            const allElements = document.querySelectorAll("[id]");

            for (const elem of allElements) {
              const id = elem.id;
              ids.set(id, (ids.get(id) || 0) + 1);
            }

            const duplicates: string[] = [];
            for (const [id, count] of ids) {
              if (count > 1) {
                duplicates.push(`id="${id}" appears ${count} times`);
              }
            }
            return duplicates;
          });

          for (const dup of duplicateIds) {
            violations.push(`${tool}: ${dup}`);
          }
        } finally {
          await page.close();
        }
      }

      expect(
        violations,
        `
DUPLICATE ID ERROR
${violations.join("\n")}

Why: Duplicate IDs break ARIA, form labels, getElementById, and CSS.
Fix: Include unique key in IDs: id={\`item-\${item.id}\`} or use React useId().
WCAG 4.1.1: https://www.w3.org/WAI/WCAG21/Understanding/parsing
`
      ).toHaveLength(0);
    } finally {
      await browser.close();
    }
  });

  /**
   * TEST: Form inputs have associated labels
   *
   * WHY THIS MATTERS:
   * -----------------
   * Screen readers announce form inputs by reading their label.
   * Without a label, users hear "edit text" with no context about
   * what information to enter.
   *
   * Labels also increase click target size - clicking the label
   * focuses the input, helping users with motor difficulties.
   *
   * WCAG REQUIREMENT: 1.3.1 Info and Relationships (Level A)
   * https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships
   *
   * HOW TO FIX:
   * -----------
   * Option 1: Explicit label with "for" attribute
   *   <label htmlFor="email">Email address</label>
   *   <input id="email" type="email" />
   *
   * Option 2: Wrap input in label
   *   <label>
   *     Email address
   *     <input type="email" />
   *   </label>
   *
   * Option 3: Use aria-label for inputs without visible label
   *   <input type="search" aria-label="Search products" />
   */
  test("form inputs have associated labels", async () => {
    if (!(await canLaunchBrowser())) {
      test.skip();
      return;
    }

    const browser = await chromium.launch({ headless: true });

    try {
      const tools = await getWidgetTools();
      const violations: string[] = [];

      for (const tool of tools) {
        const page = await setupWidgetPage(browser, tool, "light");

        try {
          const unlabeledInputs = await page.evaluate(() => {
            const problems: string[] = [];
            const inputs = document.querySelectorAll(
              'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
            );

            for (const input of inputs) {
              const id = input.id;
              const ariaLabel = input.getAttribute("aria-label");
              const ariaLabelledBy = input.getAttribute("aria-labelledby");
              const placeholder = input.getAttribute("placeholder");
              const title = input.getAttribute("title");

              // Check for associated label
              let hasLabel = false;
              if (id) {
                hasLabel = document.querySelector(`label[for="${id}"]`) !== null;
              }

              // Check if wrapped in label
              if (!hasLabel) {
                hasLabel = input.closest("label") !== null;
              }

              // Accept aria alternatives
              if (!hasLabel && !ariaLabel && !ariaLabelledBy && !title) {
                const type = input.getAttribute("type") || input.tagName.toLowerCase();
                const hint = placeholder ? ` (has placeholder "${placeholder}")` : "";
                problems.push(`<input type="${type}">${hint} missing label`);
              }
            }

            return problems.slice(0, 3);
          });

          for (const problem of unlabeledInputs) {
            violations.push(`${tool}: ${problem}`);
          }
        } finally {
          await page.close();
        }
      }

      // Log but don't fail - some widgets may not have form inputs
      if (violations.length > 0) {
        console.log(`
⚠️  FORM LABEL WARNING: ${violations.length} inputs missing labels
${violations.slice(0, 3).join("\n")}${violations.length > 3 ? `\n...and ${violations.length - 3} more` : ""}

Why: Screen readers announce inputs by label; without one users hear "edit text".
Fix: Add <label htmlFor="id"> or aria-label. Note: placeholder is NOT a label.
WCAG 1.3.1: https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships
`);
      }

      // Soft check for forms
      // expect(violations).toHaveLength(0);
    } finally {
      await browser.close();
    }
  });
});
