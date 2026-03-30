import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EdgarClient } from "../src";
import type { SchemaVersion } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const MANIFEST_PATH = join(__dirname, "fixtures/manifest.json");
const RAW_DIR = join(__dirname, "fixtures/raw");

function loadManifest(): Manifest {
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
  } catch {
    return { generatedAt: "", fixtures: [] };
  }
}

function loadFixtureContent(filename: string): string {
  return readFileSync(join(RAW_DIR, filename), "utf-8");
}

const client = new EdgarClient({ userAgent: "test-suite test@example.com" });
const manifest = loadManifest();

describe("Form 4 Parser", () => {
  if (manifest.fixtures.length === 0) {
    it.skip("no fixtures available - run `pnpm fixtures:generate` first", () => {});
    return;
  }

  describe.each(manifest.fixtures)("$filename", (fixture) => {
    const content = loadFixtureContent(fixture.filename);

    it("parses without error", () => {
      const doc = client.parseForm4(content);
      expect(doc).toBeDefined();
    });

    it("extracts correct schema version", () => {
      const result = client.getSchemaVersion(content);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(fixture.schemaVersion);
      }
    });

    it("extracts correct document type", () => {
      const doc = client.parseForm4(content);
      expect(doc.documentType).toBe(fixture.documentType);
    });

    it("has valid issuer info", () => {
      const doc = client.parseForm4(content);
      expect(doc.issuer.cik).toBeTruthy();
      expect(doc.issuer.name).toBeTruthy();
    });

    it("has at least one reporting owner", () => {
      const doc = client.parseForm4(content);
      expect(doc.reportingOwners.length).toBeGreaterThan(0);
    });

    it("has at least one signature", () => {
      const doc = client.parseForm4(content);
      expect(doc.signatures.length).toBeGreaterThan(0);
    });

    it("has valid period of report", () => {
      const doc = client.parseForm4(content);
      expect(doc.periodOfReport).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("matches expected issuer CIK from manifest", () => {
      const doc = client.parseForm4(content);
      expect(doc.issuer.cik).toBe(fixture.issuerCik);
    });

    it("has valid reporting owner structure", () => {
      const doc = client.parseForm4(content);
      for (const owner of doc.reportingOwners) {
        expect(owner.id.cik).toBeTruthy();
        expect(owner.id.name).toBeTruthy();
        expect(owner.relationship).toBeDefined();
        // At least one relationship flag should be true
        const hasRelationship =
          owner.relationship.isDirector ||
          owner.relationship.isOfficer ||
          owner.relationship.isTenPercentOwner ||
          owner.relationship.isOther;
        expect(hasRelationship).toBe(true);
      }
    });

    it("has valid signature structure", () => {
      const doc = client.parseForm4(content);
      for (const sig of doc.signatures) {
        expect(sig.name).toBeTruthy();
        expect(sig.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });

  describe("schema version specific features", () => {
    const x0306Fixtures = manifest.fixtures.filter(
      (f) => f.schemaVersion === "X0306",
    );
    const x0407Fixtures = manifest.fixtures.filter(
      (f) => f.schemaVersion === "X0407",
    );
    const x0508Fixtures = manifest.fixtures.filter(
      (f) => f.schemaVersion === "X0508",
    );
    const x0609Fixtures = manifest.fixtures.filter(
      (f) => f.schemaVersion === "X0609",
    );

    if (x0306Fixtures.length > 0) {
      describe("X0306 schema", () => {
        const fixture = x0306Fixtures[0];
        const content = loadFixtureContent(fixture.filename);

        it("has is10b5OnePlan as null (not supported in X0306)", () => {
          const doc = client.parseForm4(content);
          expect(doc.is10b5OnePlan).toBeNull();
        });
      });
    }

    if (x0407Fixtures.length > 0) {
      describe("X0407 schema", () => {
        const fixture = x0407Fixtures[0];
        const content = loadFixtureContent(fixture.filename);

        it("may have is10b5OnePlan field", () => {
          const doc = client.parseForm4(content);
          // X0407 supports it but it may or may not be present
          expect(
            typeof doc.is10b5OnePlan === "boolean" ||
              doc.is10b5OnePlan === null,
          ).toBe(true);
        });
      });
    }

    if (x0508Fixtures.length > 0) {
      describe("X0508 schema", () => {
        const fixture = x0508Fixtures[0];
        const content = loadFixtureContent(fixture.filename);

        it("may have is10b5OnePlan field", () => {
          const doc = client.parseForm4(content);
          // X0508 supports it but it may or may not be present
          expect(
            typeof doc.is10b5OnePlan === "boolean" ||
              doc.is10b5OnePlan === null,
          ).toBe(true);
        });
      });
    }

    if (x0609Fixtures.length > 0) {
      describe("X0609 schema", () => {
        const fixture = x0609Fixtures[0];
        const content = loadFixtureContent(fixture.filename);

        it("parses new issuer and reporting owner fields", () => {
          const doc = client.parseForm4(content);
          expect(doc.issuer.foreignTradingSymbol).toBe("BLFYF");
          expect(doc.reportingOwners[0]?.address.nonUsAddressFlag).toBe(true);
          expect(doc.reportingOwners[0]?.address.nonUsStateTerritory).toBe(
            "BERLIN",
          );
          expect(doc.reportingOwners[0]?.address.country).toBe("D2");
        });

        it("uses X0508-compatible normalization rules", () => {
          const doc = client.parseForm4(content);
          expect(doc.is10b5OnePlan).toBe(false);
          expect(
            doc.nonDerivativeTable.transactions[0]?.transactionTimeliness,
          ).toBeNull();
        });
      });
    }
  });

  describe("Form 4/A amendments", () => {
    const amendedFixtures = manifest.fixtures.filter(
      (f) => f.documentType === "4/A",
    );

    if (amendedFixtures.length > 0) {
      describe.each(amendedFixtures)("$filename (amendment)", (fixture) => {
        const content = loadFixtureContent(fixture.filename);

        it("is identified as Form 4/A", () => {
          const result = client.getDocumentType(content);
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(result.value).toBe("4/A");
          }
        });

        it("may have dateOfOriginalSubmission", () => {
          const doc = client.parseForm4(content);
          // Amendments may or may not have this field populated
          if (doc.dateOfOriginalSubmission !== null) {
            expect(doc.dateOfOriginalSubmission).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          }
        });
      });
    }
  });

  describe("getDocumentType", () => {
    const form4Fixtures = manifest.fixtures.filter(
      (f) => f.documentType === "4",
    );
    const form4aFixtures = manifest.fixtures.filter(
      (f) => f.documentType === "4/A",
    );

    if (form4Fixtures.length > 0) {
      it("returns '4' for Form 4 filings", () => {
        const content = loadFixtureContent(form4Fixtures[0].filename);
        const result = client.getDocumentType(content);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe("4");
        }
      });
    }

    if (form4aFixtures.length > 0) {
      it("returns '4/A' for Form 4/A filings", () => {
        const content = loadFixtureContent(form4aFixtures[0].filename);
        const result = client.getDocumentType(content);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe("4/A");
        }
      });
    }
  });
});
