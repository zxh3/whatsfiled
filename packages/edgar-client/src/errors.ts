import { SUPPORTED_SCHEMA_VERSIONS } from "./types";

export class Form4ParseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "Form4ParseError";
  }
}

export class UnsupportedSchemaVersionError extends Form4ParseError {
  constructor(public readonly version: string) {
    super(
      `Unsupported schema version: ${version}. Supported versions: ${SUPPORTED_SCHEMA_VERSIONS.join(", ")}`,
    );
    this.name = "UnsupportedSchemaVersionError";
  }
}

export class ValidationError extends Form4ParseError {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

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
