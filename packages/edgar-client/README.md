# @whatsfiled/edgar-client

A TypeScript client library for fetching and parsing SEC EDGAR filings, with a focus on Form 4 (insider trading) documents.

## Quick Start

```typescript
import { EdgarClient } from "@whatsfiled/edgar-client";

const client = new EdgarClient();

// Get daily index files for 2026
const fileNames = await client.getDailyIndexFileNames(2026);

// Fetch and parse a daily index
const index = await client.fetchDailyIndex(fileNames[0]);
const rows = client.parseDailyIndex(index.content, { formTypes: ["4", "4/A"] });

// Fetch and parse a Form 4 with source info auto-populated
const content = await client.fetchFiling(rows[0].fileName);
const doc = client.parseForm4(content, { fileName: rows[0].fileName });

console.log(doc.issuer.name, doc.reportingOwners[0].id.name);
console.log(doc.source?.formattedXmlUrl);
```

## Installation

```bash
pnpm add @whatsfiled/edgar-client
```

## API Reference

### EdgarClient

The main class for interacting with SEC EDGAR.

#### Constructor Options

```typescript
interface EdgarClientOptions {
  /** User-Agent header for SEC requests (required by SEC) */
  userAgent?: string;
  /** Retry options for HTTP requests */
  retryOptions?: RetryOptions;
  /** Delay between rate-limited requests in ms (default: 300) */
  rateLimitDelayMs?: number;
  /** Logger for warnings and debug info */
  logger?: {
    warn: (message: string, context?: Record<string, unknown>) => void;
  };
}
```

#### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `getDailyIndexFileNames(year)` | Get index file names for a year | `Promise<string[]>` |
| `fetchDailyIndex(fileName)` | Fetch a daily index file | `Promise<DailyIndexResult>` |
| `parseDailyIndex(content, options?)` | Parse index content into rows | `DailyIndexRow[]` |
| `fetchFiling(fileName)` | Fetch filing content from EDGAR | `Promise<string>` |
| `parseForm4(content, options?)` | Parse Form 4/4A content | `Form4Document` |
| `getSchemaVersion(content)` | Get schema version without parsing | `Result<SchemaVersion, ...>` |
| `getDocumentType(content)` | Get document type without parsing | `Result<DocumentType, ...>` |
| `getSourceInfo(fileName, content)` | Get source URLs without parsing | `Result<Form4SourceInfo, ...>` |

All getter methods return `Result<T, E>` types providing error context:

| Method | Success Type | Error Types |
|--------|--------------|-------------|
| `getSchemaVersion(content)` | `SchemaVersion` | `"not_found" \| "unsupported_version"` |
| `getDocumentType(content)` | `DocumentType` | `"not_found" \| "invalid_type"` |
| `getSourceInfo(fileName, content)` | `Form4SourceInfo` | `"invalid_filename" \| "xml_not_found"` |

## Type Exports

### Core Types

```typescript
import type {
  // Daily index
  DailyIndexResult,
  DailyIndexRow,
  FormType,

  // Form 4 document
  Form4Document,
  Form4Issuer,
  Form4ReportingOwner,
  Form4ReportingOwnerId,
  Form4ReportingOwnerAddress,
  Form4ReportingOwnerRelationship,
  Form4Signature,
  Form4SourceInfo,
  Form4ParseOptions,

  // Transaction types
  Form4NonDerivativeTable,
  Form4NonDerivativeTransaction,
  Form4NonDerivativeHolding,
  Form4DerivativeTable,
  Form4DerivativeTransaction,
  Form4DerivativeHolding,
  Form4TransactionAmounts,
  Form4TransactionCoding,
  Form4PostTransactionAmounts,
  Form4OwnershipNature,
  Form4UnderlyingSecurity,

  // Utility types
  ValueWithFootnotes,
  SchemaVersion,
  DocumentType,
  RetryOptions,
  Result,
} from "@whatsfiled/edgar-client";
```

### Constants

```typescript
import {
  KNOWN_FORMS,           // Array of known form types
  SUPPORTED_SCHEMA_VERSIONS,  // ["X0306", "X0407", "X0508"]
} from "@whatsfiled/edgar-client";
```

## Error Handling

The library throws specific error types for different failure scenarios:

### Error Classes

```typescript
import {
  EdgarFetchError,
  Form4ParseError,
  UnsupportedSchemaVersionError,
  ValidationError,
} from "@whatsfiled/edgar-client";
```

#### EdgarFetchError

Thrown when HTTP requests to SEC EDGAR fail.

```typescript
try {
  await client.fetchFiling("invalid/path");
} catch (error) {
  if (error instanceof EdgarFetchError) {
    console.log(error.url);        // The URL that failed
    console.log(error.statusCode); // HTTP status code
  }
}
```

#### Form4ParseError

Thrown when Form 4 XML parsing fails.

```typescript
try {
  client.parseForm4(invalidContent);
} catch (error) {
  if (error instanceof Form4ParseError) {
    console.log(error.message); // Description of the parse error
    console.log(error.cause);   // Underlying error if any
  }
}
```

#### UnsupportedSchemaVersionError

Thrown when an unknown schema version is encountered (extends Form4ParseError).

```typescript
try {
  client.parseForm4(content);
} catch (error) {
  if (error instanceof UnsupportedSchemaVersionError) {
    console.log(error.version); // The unsupported version string
  }
}
```

#### ValidationError

Thrown when parsed document fails validation (extends Form4ParseError).

```typescript
try {
  client.parseForm4(content);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.field); // The field that failed validation
  }
}
```

### Parse Options

```typescript
// Skip validation (useful for incomplete documents)
const doc = client.parseForm4(content, { validate: false });

// Allow unknown schema versions (risky, may produce incorrect output)
const doc = client.parseForm4(content, { strictSchemaVersion: false });

// Auto-populate source info with URLs to the original filing
const doc = client.parseForm4(content, { fileName: "edgar/data/..." });
```

## Schema Versions

The library supports three SEC Form 4 XML schema versions:

| Version | Period | Key Differences |
|---------|--------|-----------------|
| **X0306** | Pre-2023 | Has `deemedExecutionDate`, `transactionTimeliness`; no `is10b5OnePlan` |
| **X0407** | 2023-2025 | Added `is10b5OnePlan` field; has `transactionTimeliness` |
| **X0508** | 2025+ | Latest schema; removed `transactionTimeliness` |

### Schema-specific Fields

```typescript
const doc = client.parseForm4(content);

// is10b5OnePlan: 10b5-1 trading plan affiliation
// - null for X0306 (field doesn't exist)
// - boolean for X0407 and X0508
if (doc.is10b5OnePlan !== null) {
  console.log("Has 10b5-1 plan:", doc.is10b5OnePlan);
}

// deemedExecutionDate on non-derivative transactions
// - Present in X0306
// - null for X0407 and X0508
for (const tx of doc.nonDerivativeTable.transactions) {
  if (tx.deemedExecutionDate !== null) {
    console.log("Deemed execution:", tx.deemedExecutionDate.value);
  }
}

// transactionTimeliness
// - Present in X0306 and X0407
// - null for X0508
```

## Rate Limiting

The SEC requires a User-Agent header and recommends limiting requests to 10 per second. The client includes built-in rate limiting:

```typescript
// Default: 300ms delay between requests to same quarter catalog
const client = new EdgarClient();

// Custom rate limiting
const client = new EdgarClient({
  rateLimitDelayMs: 500, // 500ms between requests
});
```

### Retry Behavior

The client automatically retries failed requests with exponential backoff:

```typescript
const client = new EdgarClient({
  retryOptions: {
    maxRetries: 10,       // Maximum retry attempts (default: 10)
    baseDelayMs: 1000,    // Initial delay (default: 1000)
    maxDelayMs: 60000,    // Maximum delay cap (default: 60000)
    retryStatusCodes: [429, 500, 502, 503, 504], // Status codes to retry
  },
});
```

## Examples

### Fetch All Form 4s for a Date

```typescript
const client = new EdgarClient();

// Fetch the daily index
const index = await client.fetchDailyIndex("form.20260115.idx");
const rows = client.parseDailyIndex(index.content, { formTypes: ["4", "4/A"] });

// Parse each filing with source info
for (const row of rows) {
  const content = await client.fetchFiling(row.fileName);
  const doc = client.parseForm4(content, { fileName: row.fileName });

  console.log("View formatted:", doc.source?.formattedXmlUrl);
}
```

### Extract Insider Purchases

```typescript
function getInsiderPurchases(doc: Form4Document) {
  const purchases = [];

  for (const tx of doc.nonDerivativeTable.transactions) {
    if (tx.amounts.acquiredDisposedCode.value === "A" && tx.transactionCoding.code === "P") {
      purchases.push({
        security: tx.securityTitle.value,
        shares: tx.amounts.shares.value,
        pricePerShare: tx.amounts.pricePerShare.value,
        date: tx.transactionDate.value,
        isDirect: tx.ownershipNature.isDirect.value,
      });
    }
  }

  return purchases;
}
```

### Handle Multiple Schema Versions

```typescript
const doc = client.parseForm4(content);

console.log(`Schema: ${doc.schemaVersion}`);
console.log(`Period: ${doc.periodOfReport}`);
console.log(`Issuer: ${doc.issuer.name} (${doc.issuer.tradingSymbol})`);

for (const owner of doc.reportingOwners) {
  const roles = [];
  if (owner.relationship.isDirector) roles.push("Director");
  if (owner.relationship.isOfficer) roles.push(owner.relationship.officerTitle || "Officer");
  if (owner.relationship.isTenPercentOwner) roles.push("10% Owner");

  console.log(`${owner.id.name}: ${roles.join(", ")}`);
}
```

## License

MIT
