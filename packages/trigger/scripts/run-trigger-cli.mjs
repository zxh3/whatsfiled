#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(__dirname, "..", "package.json");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const versions = [
  packageJson.dependencies?.["@trigger.dev/core"],
  packageJson.dependencies?.["@trigger.dev/sdk"],
  packageJson.devDependencies?.["@trigger.dev/build"],
].filter(Boolean);

const uniqueVersions = [...new Set(versions)];

if (uniqueVersions.length !== 1) {
  console.error(
    `Mismatched @trigger.dev package versions in ${packageJsonPath}: ${uniqueVersions.join(", ")}`,
  );
  process.exit(1);
}

const [triggerVersion] = uniqueVersions;
if (!triggerVersion) {
  console.error(`No @trigger.dev version found in ${packageJsonPath}`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/run-trigger-cli.mjs <trigger-subcommand> [args...]");
  process.exit(1);
}

const result = spawnSync(
  "npx",
  [`trigger.dev@${triggerVersion}`, ...args],
  {
    stdio: "inherit",
    cwd: resolve(__dirname, ".."),
    env: process.env,
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
