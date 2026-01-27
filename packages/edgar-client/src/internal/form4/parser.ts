import { FORM4_SCHEMA_VERSIONS } from "../../constants";
import {
  Form4ParseError,
  UnsupportedSchemaVersionError,
  ValidationError,
} from "../../errors";
import type { Logger } from "../../types/common";
import type {
  Form4Document,
  Form4ParseOptions,
  SchemaVersion,
} from "../../types/form4";
import { createXmlParser, extractXmlFromSecDocument } from "../shared/xml";
import { normalizeForm4Document } from "./normalizers/index";
import type { RawOwnershipDocument } from "./raw-types";
import { FORM4_PARSER_OPTIONS } from "./xml-config";

const DEFAULT_LOGGER: Logger = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

interface RequiredParseOptions {
  validate: boolean;
  strictSchemaVersion: boolean;
  logger: Logger;
}

const DEFAULT_OPTIONS: RequiredParseOptions = {
  validate: true,
  strictSchemaVersion: true,
  logger: DEFAULT_LOGGER,
};

/**
 * Extract schema version from raw parsed XML
 */
function extractSchemaVersion(
  raw: RawOwnershipDocument,
  options: RequiredParseOptions,
): SchemaVersion {
  const version = raw.ownershipDocument?.schemaVersion;

  if (!version) {
    throw new Form4ParseError("Missing schemaVersion in XML");
  }

  const versionStr = String(version).trim();

  if (!FORM4_SCHEMA_VERSIONS.includes(versionStr as SchemaVersion)) {
    if (options.strictSchemaVersion) {
      throw new UnsupportedSchemaVersionError(versionStr);
    }
    // Attempt to use latest known version
    (options.logger.warn ?? console.warn)(
      `Unknown schema version "${versionStr}", attempting parse with X0508 rules`,
      { schemaVersion: versionStr, fallbackVersion: "X0508" },
    );
    return "X0508";
  }

  return versionStr as SchemaVersion;
}

/**
 * Validate a parsed Form4Document for data integrity
 */
function validateForm4Document(doc: Form4Document): void {
  // Must have issuer CIK
  if (!doc.issuer.cik) {
    throw new ValidationError("Missing issuer CIK", "issuer.cik");
  }

  // Must have at least one reporting owner
  if (doc.reportingOwners.length === 0) {
    throw new ValidationError(
      "Must have at least one reporting owner",
      "reportingOwners",
    );
  }

  // Each reporting owner must have CIK
  for (let i = 0; i < doc.reportingOwners.length; i++) {
    const owner = doc.reportingOwners[i];
    if (!owner.id.cik) {
      throw new ValidationError(
        `Reporting owner ${i} missing CIK`,
        `reportingOwners[${i}].id.cik`,
      );
    }
  }

  // Must have period of report
  if (!doc.periodOfReport) {
    throw new ValidationError("Missing periodOfReport", "periodOfReport");
  }

  // Must have at least one signature
  if (doc.signatures.length === 0) {
    throw new ValidationError("Must have at least one signature", "signatures");
  }
}

/**
 * Parse SEC Form 4 or Form 4/A XML into a normalized TypeScript object
 */
export function parseForm4(
  content: string,
  options: Form4ParseOptions = {},
): Form4Document {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Extract XML from SEC document wrapper
  let xml: string;
  try {
    xml = extractXmlFromSecDocument(content);
  } catch (error) {
    throw new Form4ParseError(
      "Could not extract XML from SEC document. Expected <XML>...</XML> tags or raw XML content.",
      error,
    );
  }

  // Parse XML
  let raw: RawOwnershipDocument;
  try {
    const parser = createXmlParser(FORM4_PARSER_OPTIONS);
    raw = parser.parse(xml) as RawOwnershipDocument;
  } catch (error) {
    throw new Form4ParseError("Failed to parse XML", error);
  }

  // Validate root element exists
  if (!raw.ownershipDocument) {
    throw new Form4ParseError(
      "Invalid Form 4 XML: missing ownershipDocument root element",
    );
  }

  // Extract and validate schema version
  const schemaVersion = extractSchemaVersion(raw, opts);

  // Normalize to unified type
  let doc: Form4Document;
  try {
    doc = normalizeForm4Document(raw, schemaVersion);
  } catch (error) {
    throw new Form4ParseError("Failed to normalize Form 4 document", error);
  }

  // Validate if requested
  if (opts.validate) {
    validateForm4Document(doc);
  }

  return doc;
}

/**
 * Check if a schema version is supported
 */
export function isSchemaVersionSupported(
  version: string,
): version is SchemaVersion {
  return FORM4_SCHEMA_VERSIONS.includes(version as SchemaVersion);
}

/**
 * Get document type from content without full parsing
 */
export function getDocumentType(content: string): "4" | "4/A" | null {
  const match = content.match(/<documentType>([^<]+)<\/documentType>/);
  if (!match) return null;

  const docType = match[1].trim();
  return docType === "4" || docType === "4/A" ? docType : null;
}

/**
 * Get schema version from content without full parsing
 */
export function getSchemaVersion(content: string): string | null {
  const match = content.match(/<schemaVersion>([^<]+)<\/schemaVersion>/);
  return match ? match[1].trim() : null;
}
