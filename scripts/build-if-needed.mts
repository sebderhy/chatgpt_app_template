#!/usr/bin/env tsx
/**
 * Smart build script that only rebuilds if source files are newer than build output.
 * Compares modification times of src/ files vs assets/ files.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const srcDir = path.join(rootDir, "src");
const assetsDir = path.join(rootDir, "assets");

function getNewestMtime(dir: string, extensions: string[]): number {
  if (!fs.existsSync(dir)) return 0;

  let newest = 0;

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.length === 0 || extensions.includes(ext)) {
          const stat = fs.statSync(fullPath);
          if (stat.mtimeMs > newest) {
            newest = stat.mtimeMs;
          }
        }
      }
    }
  }

  walk(dir);
  return newest;
}

function countHtmlFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => f.endsWith(".html")).length;
}

// Check if build is needed
const srcExtensions = [".tsx", ".ts", ".css", ".js", ".jsx"];
const newestSrc = getNewestMtime(srcDir, srcExtensions);
const newestAsset = getNewestMtime(assetsDir, [".html", ".js", ".css"]);
const assetCount = countHtmlFiles(assetsDir);

const buildNeeded =
  assetCount === 0 || // No build output exists
  newestSrc > newestAsset; // Source is newer than build

if (buildNeeded) {
  const reason =
    assetCount === 0
      ? "No build output found"
      : "Source files changed since last build";
  console.log(`\x1b[33m⚡ ${reason}, rebuilding...\x1b[0m`);
  execSync("pnpm run build", { stdio: "inherit", cwd: rootDir });
} else {
  console.log("\x1b[32m✓ Build is up-to-date, skipping rebuild\x1b[0m");
}
