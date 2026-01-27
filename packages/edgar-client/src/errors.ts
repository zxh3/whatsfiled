import { FORM4_SCHEMA_VERSIONS } from "./constants";

/**
 * Base error class for SEC form parsing errors.
 * Extended by form-specific error classes (Form4ParseError, etc.).
 */
export class FormParseError extends Error {
  constructor(
    message: string,
    public readonly formType?: string,
    public readonly cause?: unknown,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "FormParseError";
  }
}

/**
 * Error thrown when parsing Form 4 XML fails.
 * Extends FormParseError for backward compatibility.
 */
export class Form4ParseError extends FormParseError {
  constructor(
    message: string,
    cause?: unknown,
    context?: Record<string, unknown>,
  ) {
    super(message, "4", cause, context);
    this.name = "Form4ParseError";
  }
}

/**
 * Error thrown when an unsupported schema version is encountered.
 * Generic across form types.
 */
export class UnsupportedSchemaVersionError extends FormParseError {
  constructor(
    public readonly version: string,
    formType?: string,
    public readonly supportedVersions?: readonly string[],
  ) {
    const versions = supportedVersions ?? FORM4_SCHEMA_VERSIONS;
    super(
      `Unsupported schema version: ${version}. Supported versions: ${versions.join(", ")}`,
      formType,
    );
    this.name = "UnsupportedSchemaVersionError";
  }
}

/**
 * Error thrown when document validation fails.
 */
export class ValidationError extends FormParseError {
  constructor(
    message: string,
    public readonly field?: string,
    formType?: string,
  ) {
    super(message, formType);
    this.name = "ValidationError";
  }
}

/**
 * Error thrown when fetching from SEC EDGAR fails.
 */
export class EdgarFetchError extends Error {
  constructor(
    message: string,
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "EdgarFetchError";
  }
}
