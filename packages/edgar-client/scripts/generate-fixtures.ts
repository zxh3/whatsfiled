/**
 * Fixture generation script for edgar-client tests.
 *
 * Fetches real Form 4 documents from SEC EDGAR to use as test fixtures.
 * Target: 1 Form 4 + 1 Form 4/A per schema version (6 files minimum)
 *
 * Usage: pnpm --filter @whatsfiled/edgar-client fixtures:generate
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EdgarClient } from "../src/index";
import type { SchemaVersion } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "../test/fixtures");
const RAW_DIR = join(FIXTURES_DIR, "raw");
const MANIFEST_PATH = join(FIXTURES_DIR, "manifest.json");

const USER_AGENT = "WhatsFiled-FixtureGenerator whatsfiled@gmail.com";

interface FixtureMetadata {
  filename: string;
  schemaVersion: SchemaVersion;
  documentType: "4" | "4/A";
  issuerCik: string;
  issuerName: string;
  capturedAt: string;
  originalUrl: string;
}

interface Manifest {
  generatedAt: string;
  fixtures: FixtureMetadata[];
}

type FixtureKey = `${SchemaVersion}-${"4" | "4/A"}`;

const REQUIRED_FIXTURES: FixtureKey[] = [
  "X0306-4",
  "X0306-4/A",
  "X0407-4",
  "X0407-4/A",
  "X0508-4",
  "X0508-4/A",
];

function fixtureFilename(
  schemaVersion: SchemaVersion,
  docType: "4" | "4/A",
): string {
  const docSuffix = docType === "4/A" ? "form4a" : "form4";
  return `${schemaVersion.toLowerCase()}-${docSuffix}.txt`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("Fixture Generation Script");
  console.log("=========================\n");

  // Ensure directories exist
  if (!existsSync(RAW_DIR)) {
    mkdirSync(RAW_DIR, { recursive: true });
  }

  // Check what fixtures we already have
  const existingFixtures = new Set<FixtureKey>();
  if (existsSync(MANIFEST_PATH)) {
    try {
      const manifest: Manifest = JSON.parse(
        readFileSync(MANIFEST_PATH, "utf-8"),
      );
      for (const fixture of manifest.fixtures) {
        const key: FixtureKey = `${fixture.schemaVersion}-${fixture.documentType}`;
        if (existsSync(join(RAW_DIR, fixture.filename))) {
          existingFixtures.add(key);
        }
      }
      console.log(`Found ${existingFixtures.size} existing fixtures`);
    } catch {
      console.log("No valid manifest found, starting fresh");
    }
  }

  const neededFixtures = REQUIRED_FIXTURES.filter(
    (k) => !existingFixtures.has(k),
  );

  if (neededFixtures.length === 0) {
    console.log("\nAll required fixtures already exist!");
    console.log("Delete test/fixtures/manifest.json to regenerate.");
    return;
  }

  console.log(`\nNeed to find: ${neededFixtures.join(", ")}\n`);

  const client = new EdgarClient({ userAgent: USER_AGENT });
  const collectedFixtures: FixtureMetadata[] = [];
  const foundKeys = new Set<FixtureKey>();

  // Strategy: Start from recent years and work backwards
  // Older filings use older schema versions
  const years = [
    2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2010, 2008,
    2006,
  ];

  for (const year of years) {
    if (neededFixtures.every((k) => foundKeys.has(k))) {
      break;
    }

    console.log(`\nSearching in ${year}...`);

    let indexFileNames: string[];
    try {
      indexFileNames = await client.getDailyIndexFileNames(year);
    } catch (error) {
      console.log(`  Failed to get index files for ${year}: ${error}`);
      continue;
    }

    if (indexFileNames.length === 0) {
      console.log(`  No index files found for ${year}`);
      continue;
    }

    // Sample from various points throughout the year
    // More samples for years where we're still looking (X0407 was ~2022-2023)
    const sampleCount =
      neededFixtures.some((k) => k.startsWith("X0407")) &&
      year >= 2022 &&
      year <= 2023
        ? 10
        : 3;
    const sampleIndices: number[] = [];
    for (let i = 1; i <= sampleCount; i++) {
      sampleIndices.push(
        Math.floor(indexFileNames.length * (i / (sampleCount + 1))),
      );
    }

    for (const idx of sampleIndices) {
      if (neededFixtures.every((k) => foundKeys.has(k))) {
        break;
      }

      const indexFileName = indexFileNames[idx];
      if (!indexFileName) continue;

      console.log(`  Checking ${indexFileName}...`);

      try {
        const indexResult = await client.fetchDailyIndex(indexFileName);
        const rows = client.parseDailyIndex(indexResult.content, {
          formTypes: ["4", "4/A"],
        });

        // Shuffle rows to get variety - sample more for years with X0407 schema
        const sampleSize =
          neededFixtures.some((k) => k.startsWith("X0407")) &&
          year >= 2022 &&
          year <= 2023
            ? 100
            : 50;
        const shuffled = rows
          .sort(() => Math.random() - 0.5)
          .slice(0, sampleSize);

        for (const row of shuffled) {
          if (neededFixtures.every((k) => foundKeys.has(k))) {
            break;
          }

          const docType = row.formType === "4/A" ? "4/A" : "4";
          const neededForDocType = neededFixtures.filter(
            (k) => k.endsWith(`-${docType}`) && !foundKeys.has(k),
          );

          if (neededForDocType.length === 0) continue;

          await sleep(200); // Rate limiting

          try {
            const content = await client.fetchFiling(row.fileName);
            const schemaVersion = client.getForm4SchemaVersion(content);

            if (!schemaVersion) continue;

            const key: FixtureKey = `${schemaVersion as SchemaVersion}-${docType}`;

            if (!neededFixtures.includes(key) || foundKeys.has(key)) {
              continue;
            }

            // Verify we can parse it
            const doc = client.parseForm4(content);

            const filename = fixtureFilename(
              schemaVersion as SchemaVersion,
              docType,
            );
            const filepath = join(RAW_DIR, filename);
            writeFileSync(filepath, content, "utf-8");

            const metadata: FixtureMetadata = {
              filename,
              schemaVersion: schemaVersion as SchemaVersion,
              documentType: docType,
              issuerCik: doc.issuer.cik,
              issuerName: doc.issuer.name,
              capturedAt: new Date().toISOString(),
              originalUrl: `https://www.sec.gov/Archives/${row.fileName}`,
            };

            collectedFixtures.push(metadata);
            foundKeys.add(key);

            console.log(`    Found ${key}: ${doc.issuer.name}`);
          } catch (_error) {}
        }

        await sleep(300); // Rate limiting between index files
      } catch (error) {
        console.log(`    Failed to process ${indexFileName}: ${error}`);
      }
    }
  }

  // Merge with existing fixtures
  let existingManifest: Manifest = { generatedAt: "", fixtures: [] };
  if (existsSync(MANIFEST_PATH)) {
    try {
      existingManifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
    } catch {
      // Ignore
    }
  }

  // Filter out fixtures we're replacing
  const newFixtureFilenames = new Set(collectedFixtures.map((f) => f.filename));
  const keptFixtures = existingManifest.fixtures.filter(
    (f) => !newFixtureFilenames.has(f.filename),
  );

  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    fixtures: [...keptFixtures, ...collectedFixtures].sort((a, b) =>
      a.filename.localeCompare(b.filename),
    ),
  };

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");

  console.log("\n=========================");
  console.log("Fixture Generation Complete");
  console.log(`Total fixtures: ${manifest.fixtures.length}`);
  console.log(`New fixtures: ${collectedFixtures.length}`);

  const stillMissing = neededFixtures.filter((k) => !foundKeys.has(k));
  if (stillMissing.length > 0) {
    console.log(
      `\nWarning: Could not find fixtures for: ${stillMissing.join(", ")}`,
    );
    console.log(
      "You may need to run the script again or manually source these fixtures.",
    );
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
