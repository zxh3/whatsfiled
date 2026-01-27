/**
 * Form 4 Parser Real-Data Testing Framework
 *
 * Tests the Form 4 parser against real SEC EDGAR filings from 2016 onwards.
 * Samples filings per year and form type, tracking success rates.
 *
 * Usage:
 *   npx tsx scripts/testForm4Parser.ts [options]
 *
 * Options:
 *   --start-year <year>    Start year (default: 2016)
 *   --end-year <year>      End year (default: current year)
 *   --samples <n>          Samples per form type per year (default: 20)
 *   --delay <ms>           Delay between requests in ms (default: 150)
 *   --output-samples       Save parsed data to scripts/tmp folder
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  type DailyIndexRow,
  EdgarClient,
  Form4ParseError,
  UnsupportedSchemaVersionError,
  ValidationError,
} from "@whatsfiled/edgar-client";

const edgarClient = new EdgarClient();

// ============================================================
// TYPES
// ============================================================

interface TestConfig {
  startYear: number;
  endYear: number;
  samplesPerFormTypePerYear: number;
  indexFilesPerYear: number;
  delayBetweenRequests: number;
  outputSamples: boolean;
}

interface TestResult {
  year: number;
  formType: "4" | "4/A";
  fileName: string;
  success: boolean;
  schemaVersion: string | null;
  errorType: string | null;
  errorMessage: string | null;
}

interface FormTypeStats {
  total: number;
  success: number;
  rate: number;
}

interface YearSummary {
  year: number;
  form4: FormTypeStats;
  form4A: FormTypeStats;
  schemaVersionCounts: Record<string, number>;
  errorCounts: Record<string, number>;
}

// ============================================================
// CONFIG
// ============================================================

function parseArgs(): TestConfig {
  const args = process.argv.slice(2);
  const config: TestConfig = {
    startYear: 2016,
    endYear: new Date().getFullYear(),
    samplesPerFormTypePerYear: 20,
    indexFilesPerYear: 10,
    delayBetweenRequests: 200,
    outputSamples: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--start-year":
        config.startYear = parseInt(args[++i], 10);
        break;
      case "--end-year":
        config.endYear = parseInt(args[++i], 10);
        break;
      case "--samples":
        config.samplesPerFormTypePerYear = parseInt(args[++i], 10);
        break;
      case "--delay":
        config.delayBetweenRequests = parseInt(args[++i], 10);
        break;
      case "--output-samples":
        config.outputSamples = true;
        break;
    }
  }

  return config;
}

// ============================================================
// HELPERS
// ============================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOutputDir(): string {
  const outputDir = path.join(__dirname, "tmp");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}

function saveParsedData(
  fileName: string,
  year: number,
  formType: string,
  parsedData: unknown,
): void {
  const outputDir = getOutputDir();
  // Convert fileName like "edgar/data/1234/0001234-24-000001.txt" to a safe filename
  const safeFileName = fileName.replace(/\//g, "_").replace(/\.txt$/, ".json");
  const outputPath = path.join(
    outputDir,
    `${year}_${formType.replace("/", "-")}_${safeFileName}`,
  );

  const output = {
    _meta: {
      year,
      formType,
    },
    data: parsedData,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
}

function sampleArray<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;

  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, n);
}

function sampleIndexFilesMonthly(fileNames: string[], count: number): string[] {
  // Group by month (form.YYYYMMDD.idx -> YYYYMM)
  const byMonth = new Map<string, string[]>();

  for (const fileName of fileNames) {
    const match = fileName.match(/form\.(\d{6})/);
    if (match) {
      const month = match[1];
      const existing = byMonth.get(month);
      if (existing) {
        existing.push(fileName);
      } else {
        byMonth.set(month, [fileName]);
      }
    }
  }

  // Pick one random file from each month
  const months = Array.from(byMonth.keys()).sort();
  const selected: string[] = [];

  for (const month of months) {
    const files = byMonth.get(month);
    if (files && files.length > 0) {
      const randomFile = files[Math.floor(Math.random() * files.length)];
      selected.push(randomFile);
      if (selected.length >= count) break;
    }
  }

  return selected;
}

function categorizeError(error: unknown): { type: string; message: string } {
  if (error instanceof UnsupportedSchemaVersionError) {
    return {
      type: "UnsupportedSchemaVersion",
      message: error.message,
    };
  }
  if (error instanceof ValidationError) {
    return {
      type: "ValidationError",
      message: error.message,
    };
  }
  if (error instanceof Form4ParseError) {
    return {
      type: "Form4ParseError",
      message: error.message,
    };
  }
  if (error instanceof Error) {
    if (
      error.message.includes("fetch") ||
      error.message.includes("network") ||
      error.message.includes("ECONNREFUSED")
    ) {
      return {
        type: "NetworkError",
        message: error.message,
      };
    }
    return {
      type: "UnknownError",
      message: error.message,
    };
  }
  return {
    type: "UnknownError",
    message: String(error),
  };
}

// ============================================================
// MAIN TEST LOGIC
// ============================================================

async function testFilingsForYear(
  year: number,
  config: TestConfig,
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  console.log(`\n📅 Processing year ${year}...`);

  // 1. Get all index file names for the year
  console.log(`  Fetching index file list...`);
  const allIndexFiles = await edgarClient.getDailyIndexFileNames(year);

  if (allIndexFiles.length === 0) {
    console.log(`  ⚠️  No index files found for ${year}`);
    return results;
  }

  console.log(`  Found ${allIndexFiles.length} index files`);

  // 2. Sample index files (monthly distribution)
  const sampledIndexFiles = sampleIndexFilesMonthly(
    allIndexFiles,
    config.indexFilesPerYear,
  );
  console.log(`  Sampling ${sampledIndexFiles.length} index files`);

  // 3. Collect all Form 4 and Form 4/A filings from sampled indices
  const form4Filings: DailyIndexRow[] = [];
  const form4AFilings: DailyIndexRow[] = [];

  for (const indexFileName of sampledIndexFiles) {
    await delay(config.delayBetweenRequests);

    try {
      const { content } = await edgarClient.fetchDailyIndex(indexFileName);
      const rows = edgarClient.parseDailyIndex(content, {
        formTypes: ["4", "4/A"],
      });

      for (const row of rows) {
        if (row.formType === "4") {
          form4Filings.push(row);
        } else if (row.formType === "4/A") {
          form4AFilings.push(row);
        }
      }
    } catch (error) {
      console.log(
        `  ⚠️  Failed to fetch/parse index ${indexFileName}: ${error}`,
      );
    }
  }

  console.log(
    `  Found ${form4Filings.length} Form 4, ${form4AFilings.length} Form 4/A`,
  );

  // 4. Sample filings for testing
  const sampledForm4 = sampleArray(
    form4Filings,
    config.samplesPerFormTypePerYear,
  );
  const sampledForm4A = sampleArray(
    form4AFilings,
    config.samplesPerFormTypePerYear,
  );

  console.log(
    `  Testing ${sampledForm4.length} Form 4, ${sampledForm4A.length} Form 4/A...`,
  );

  // 5. Test each sampled filing
  const allSampled = [
    ...sampledForm4.map((f) => ({ ...f, formType: "4" as const })),
    ...sampledForm4A.map((f) => ({ ...f, formType: "4/A" as const })),
  ];

  for (let i = 0; i < allSampled.length; i++) {
    const filing = allSampled[i];
    await delay(config.delayBetweenRequests);

    const result: TestResult = {
      year,
      formType: filing.formType,
      fileName: filing.fileName,
      success: false,
      schemaVersion: null,
      errorType: null,
      errorMessage: null,
    };

    try {
      const content = await edgarClient.fetchFiling(filing.fileName);

      // Quick schema version extraction
      result.schemaVersion = edgarClient.getForm4SchemaVersion(content);

      // Parse the form
      const parsedData = edgarClient.parseForm4(content);
      result.success = true;

      // Attach source info to the parsed document
      parsedData._source =
        edgarClient.getForm4SourceInfo(filing.fileName, content) ?? undefined;

      // Save parsed data if output option is enabled
      if (config.outputSamples) {
        saveParsedData(filing.fileName, year, filing.formType, parsedData);
      }
    } catch (error) {
      const { type, message } = categorizeError(error);
      result.errorType = type;
      result.errorMessage = message;
    }

    results.push(result);

    // Progress indicator
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`  Progress: ${i + 1}/${allSampled.length}\r`);
    }
  }

  console.log(`  ✓ Completed ${results.length} tests`);

  return results;
}

function summarizeResults(results: TestResult[]): YearSummary[] {
  const byYear = new Map<number, TestResult[]>();

  for (const result of results) {
    const existing = byYear.get(result.year);
    if (existing) {
      existing.push(result);
    } else {
      byYear.set(result.year, [result]);
    }
  }

  const summaries: YearSummary[] = [];

  for (const [year, yearResults] of byYear) {
    const form4Results = yearResults.filter((r) => r.formType === "4");
    const form4AResults = yearResults.filter((r) => r.formType === "4/A");

    const form4Success = form4Results.filter((r) => r.success).length;
    const form4ASuccess = form4AResults.filter((r) => r.success).length;

    const schemaVersionCounts: Record<string, number> = {};
    const errorCounts: Record<string, number> = {};

    for (const result of yearResults) {
      if (result.schemaVersion) {
        schemaVersionCounts[result.schemaVersion] =
          (schemaVersionCounts[result.schemaVersion] || 0) + 1;
      }
      if (result.errorType) {
        errorCounts[result.errorType] =
          (errorCounts[result.errorType] || 0) + 1;
      }
    }

    summaries.push({
      year,
      form4: {
        total: form4Results.length,
        success: form4Success,
        rate: form4Results.length > 0 ? form4Success / form4Results.length : 0,
      },
      form4A: {
        total: form4AResults.length,
        success: form4ASuccess,
        rate:
          form4AResults.length > 0 ? form4ASuccess / form4AResults.length : 0,
      },
      schemaVersionCounts,
      errorCounts,
    });
  }

  return summaries.sort((a, b) => a.year - b.year);
}

function printResults(summaries: YearSummary[], results: TestResult[]): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log("Form 4 Parser Real-Data Test Results");
  console.log("=".repeat(60));

  for (const summary of summaries) {
    console.log(`\n📊 Year: ${summary.year}`);
    console.log(
      `  Form 4:   ${summary.form4.success}/${summary.form4.total} (${(summary.form4.rate * 100).toFixed(1)}%)`,
    );
    console.log(
      `  Form 4/A: ${summary.form4A.success}/${summary.form4A.total} (${(summary.form4A.rate * 100).toFixed(1)}%)`,
    );

    const versions = Object.entries(summary.schemaVersionCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([v, c]) => `${v} (${c})`)
      .join(", ");
    if (versions) {
      console.log(`  Schema versions: ${versions}`);
    }

    const errors = Object.entries(summary.errorCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([t, c]) => `${t} (${c})`)
      .join(", ");
    if (errors) {
      console.log(`  Errors: ${errors}`);
    }
  }

  // Overall summary
  const totalTests = results.length;
  const totalSuccess = results.filter((r) => r.success).length;

  console.log(`\n${"=".repeat(60)}`);
  console.log("Overall Summary");
  console.log("=".repeat(60));
  console.log(`Total tested: ${totalTests}`);
  console.log(
    `Success rate: ${((totalSuccess / totalTests) * 100).toFixed(1)}%`,
  );

  // List unique error messages for failed tests
  const failedResults = results.filter((r) => !r.success);
  if (failedResults.length > 0) {
    console.log(`\n❌ Failed filings (${failedResults.length}):`);

    // Group by error type
    const byErrorType = new Map<string, TestResult[]>();
    for (const r of failedResults) {
      const key = r.errorType || "Unknown";
      const existing = byErrorType.get(key);
      if (existing) {
        existing.push(r);
      } else {
        byErrorType.set(key, [r]);
      }
    }

    for (const [errorType, typeResults] of byErrorType) {
      console.log(`\n  ${errorType}:`);
      // Show first 3 examples
      for (const r of typeResults.slice(0, 3)) {
        console.log(`    - ${r.fileName}`);
        console.log(`      ${r.errorMessage}`);
      }
      if (typeResults.length > 3) {
        console.log(`    ... and ${typeResults.length - 3} more`);
      }
    }
  }
}

// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {
  const config = parseArgs();

  console.log("Form 4 Parser Real-Data Testing Framework");
  console.log("=========================================");
  console.log(`Start year: ${config.startYear}`);
  console.log(`End year: ${config.endYear}`);
  console.log(
    `Samples per form type per year: ${config.samplesPerFormTypePerYear}`,
  );
  console.log(`Index files per year: ${config.indexFilesPerYear}`);
  console.log(`Delay between requests: ${config.delayBetweenRequests}ms`);
  console.log(`Output samples: ${config.outputSamples}`);
  if (config.outputSamples) {
    console.log(`Output directory: ${path.join(__dirname, "tmp")}`);
  }

  const allResults: TestResult[] = [];

  for (let year = config.startYear; year <= config.endYear; year++) {
    const yearResults = await testFilingsForYear(year, config);
    allResults.push(...yearResults);
  }

  const summaries = summarizeResults(allResults);
  printResults(summaries, allResults);

  // Exit with error code if success rate is below 90%
  const totalSuccess = allResults.filter((r) => r.success).length;
  const successRate = totalSuccess / allResults.length;
  if (successRate < 0.9) {
    console.log(`\n⚠️  Success rate below 90% threshold`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exitCode = 1;
});
