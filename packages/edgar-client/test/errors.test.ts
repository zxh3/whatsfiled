import { describe, expect, it } from "vitest";
import {
  EdgarClient,
  Form4ParseError,
  UnsupportedSchemaVersionError,
  ValidationError,
} from "../src";

const client = new EdgarClient();

describe("Error handling", () => {
  describe("Form4ParseError", () => {
    it("throws when XML cannot be extracted from content", () => {
      const invalidContent = "This is not a valid SEC filing";

      expect(() => client.parseForm4(invalidContent)).toThrow(Form4ParseError);
      expect(() => client.parseForm4(invalidContent)).toThrow(
        "Failed to extract XML from content",
      );
    });

    it("throws when content has no <XML> tags and is not raw XML", () => {
      const htmlContent = "<html><body>Not a filing</body></html>";

      expect(() => client.parseForm4(htmlContent)).toThrow(Form4ParseError);
    });

    it("throws when ownershipDocument root element is missing", () => {
      const xmlWithoutRoot = `
        <XML>
          <someOtherElement>
            <value>test</value>
          </someOtherElement>
        </XML>
      `;

      expect(() => client.parseForm4(xmlWithoutRoot)).toThrow(Form4ParseError);
      expect(() => client.parseForm4(xmlWithoutRoot)).toThrow(
        "missing ownershipDocument root element",
      );
    });

    it("throws when schemaVersion is missing", () => {
      const xmlMissingVersion = `
        <XML>
          <ownershipDocument>
            <documentType>4</documentType>
          </ownershipDocument>
        </XML>
      `;

      expect(() => client.parseForm4(xmlMissingVersion)).toThrow(Form4ParseError);
      expect(() => client.parseForm4(xmlMissingVersion)).toThrow(
        "Missing schemaVersion",
      );
    });

    it("includes cause when parsing fails", () => {
      try {
        client.parseForm4("invalid content");
      } catch (error) {
        expect(error).toBeInstanceOf(Form4ParseError);
        // The error should chain properly
        expect((error as Form4ParseError).message).toContain("extract XML");
      }
    });
  });

  describe("UnsupportedSchemaVersionError", () => {
    it("throws for unknown schema version with strictSchemaVersion: true (default)", () => {
      const xmlWithUnknownVersion = `
        <XML>
          <ownershipDocument>
            <schemaVersion>X9999</schemaVersion>
            <documentType>4</documentType>
          </ownershipDocument>
        </XML>
      `;

      expect(() => client.parseForm4(xmlWithUnknownVersion)).toThrow(
        UnsupportedSchemaVersionError,
      );
      expect(() => client.parseForm4(xmlWithUnknownVersion)).toThrow("X9999");
    });

    it("includes the unsupported version in error", () => {
      const xmlWithUnknownVersion = `
        <XML>
          <ownershipDocument>
            <schemaVersion>XFUTURE</schemaVersion>
            <documentType>4</documentType>
          </ownershipDocument>
        </XML>
      `;

      try {
        client.parseForm4(xmlWithUnknownVersion);
      } catch (error) {
        expect(error).toBeInstanceOf(UnsupportedSchemaVersionError);
        expect((error as UnsupportedSchemaVersionError).version).toBe("XFUTURE");
      }
    });

    it("lists supported versions in error message", () => {
      const xmlWithUnknownVersion = `
        <XML>
          <ownershipDocument>
            <schemaVersion>X0000</schemaVersion>
            <documentType>4</documentType>
          </ownershipDocument>
        </XML>
      `;

      try {
        client.parseForm4(xmlWithUnknownVersion);
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain("X0306");
        expect(message).toContain("X0407");
        expect(message).toContain("X0508");
      }
    });
  });

  describe("strictSchemaVersion: false", () => {
    it("attempts to parse unknown schema version with X0508 rules", () => {
      // This XML has an unknown version but otherwise valid structure
      const xmlWithUnknownVersion = `
        <XML>
          <ownershipDocument>
            <schemaVersion>X9999</schemaVersion>
            <documentType>4</documentType>
            <periodOfReport>2026-01-15</periodOfReport>
            <issuer>
              <issuerCik>123456</issuerCik>
              <issuerName>Test Corp</issuerName>
              <issuerTradingSymbol>TEST</issuerTradingSymbol>
            </issuer>
            <reportingOwner>
              <reportingOwnerId>
                <rptOwnerCik>789012</rptOwnerCik>
                <rptOwnerName>John Doe</rptOwnerName>
              </reportingOwnerId>
              <reportingOwnerRelationship>
                <isDirector>1</isDirector>
              </reportingOwnerRelationship>
            </reportingOwner>
            <ownerSignature>
              <signatureName>John Doe</signatureName>
              <signatureDate>2026-01-15</signatureDate>
            </ownerSignature>
          </ownershipDocument>
        </XML>
      `;

      // Should not throw with strictSchemaVersion: false
      const doc = client.parseForm4(xmlWithUnknownVersion, {
        strictSchemaVersion: false,
      });

      expect(doc.schemaVersion).toBe("X0508"); // Falls back to X0508
      expect(doc.issuer.name).toBe("Test Corp");
    });
  });

  describe("ValidationError", () => {
    it("throws when issuer CIK is missing", () => {
      const xmlMissingIssuerCik = `
        <XML>
          <ownershipDocument>
            <schemaVersion>X0508</schemaVersion>
            <documentType>4</documentType>
            <periodOfReport>2026-01-15</periodOfReport>
            <issuer>
              <issuerName>Test Corp</issuerName>
              <issuerTradingSymbol>TEST</issuerTradingSymbol>
            </issuer>
            <reportingOwner>
              <reportingOwnerId>
                <rptOwnerCik>789012</rptOwnerCik>
                <rptOwnerName>John Doe</rptOwnerName>
              </reportingOwnerId>
              <reportingOwnerRelationship>
                <isDirector>1</isDirector>
              </reportingOwnerRelationship>
            </reportingOwner>
            <ownerSignature>
              <signatureName>John Doe</signatureName>
              <signatureDate>2026-01-15</signatureDate>
            </ownerSignature>
          </ownershipDocument>
        </XML>
      `;

      expect(() => client.parseForm4(xmlMissingIssuerCik)).toThrow(ValidationError);
      expect(() => client.parseForm4(xmlMissingIssuerCik)).toThrow("issuer CIK");
    });

    it("throws when no reporting owners exist", () => {
      const xmlNoOwners = `
        <XML>
          <ownershipDocument>
            <schemaVersion>X0508</schemaVersion>
            <documentType>4</documentType>
            <periodOfReport>2026-01-15</periodOfReport>
            <issuer>
              <issuerCik>123456</issuerCik>
              <issuerName>Test Corp</issuerName>
              <issuerTradingSymbol>TEST</issuerTradingSymbol>
            </issuer>
            <ownerSignature>
              <signatureName>John Doe</signatureName>
              <signatureDate>2026-01-15</signatureDate>
            </ownerSignature>
          </ownershipDocument>
        </XML>
      `;

      expect(() => client.parseForm4(xmlNoOwners)).toThrow(ValidationError);
      expect(() => client.parseForm4(xmlNoOwners)).toThrow("reporting owner");
    });

    it("throws when reporting owner CIK is missing", () => {
      const xmlOwnerNoCik = `
        <XML>
          <ownershipDocument>
            <schemaVersion>X0508</schemaVersion>
            <documentType>4</documentType>
            <periodOfReport>2026-01-15</periodOfReport>
            <issuer>
              <issuerCik>123456</issuerCik>
              <issuerName>Test Corp</issuerName>
              <issuerTradingSymbol>TEST</issuerTradingSymbol>
            </issuer>
            <reportingOwner>
              <reportingOwnerId>
                <rptOwnerName>John Doe</rptOwnerName>
              </reportingOwnerId>
              <reportingOwnerRelationship>
                <isDirector>1</isDirector>
              </reportingOwnerRelationship>
            </reportingOwner>
            <ownerSignature>
              <signatureName>John Doe</signatureName>
              <signatureDate>2026-01-15</signatureDate>
            </ownerSignature>
          </ownershipDocument>
        </XML>
      `;

      expect(() => client.parseForm4(xmlOwnerNoCik)).toThrow(ValidationError);
      expect(() => client.parseForm4(xmlOwnerNoCik)).toThrow("CIK");
    });

    it("throws when periodOfReport is missing", () => {
      const xmlNoPeriod = `
        <XML>
          <ownershipDocument>
            <schemaVersion>X0508</schemaVersion>
            <documentType>4</documentType>
            <issuer>
              <issuerCik>123456</issuerCik>
              <issuerName>Test Corp</issuerName>
              <issuerTradingSymbol>TEST</issuerTradingSymbol>
            </issuer>
            <reportingOwner>
              <reportingOwnerId>
                <rptOwnerCik>789012</rptOwnerCik>
                <rptOwnerName>John Doe</rptOwnerName>
              </reportingOwnerId>
              <reportingOwnerRelationship>
                <isDirector>1</isDirector>
              </reportingOwnerRelationship>
            </reportingOwner>
            <ownerSignature>
              <signatureName>John Doe</signatureName>
              <signatureDate>2026-01-15</signatureDate>
            </ownerSignature>
          </ownershipDocument>
        </XML>
      `;

      expect(() => client.parseForm4(xmlNoPeriod)).toThrow(ValidationError);
      expect(() => client.parseForm4(xmlNoPeriod)).toThrow("periodOfReport");
    });

    it("throws when no signatures exist", () => {
      const xmlNoSignatures = `
        <XML>
          <ownershipDocument>
            <schemaVersion>X0508</schemaVersion>
            <documentType>4</documentType>
            <periodOfReport>2026-01-15</periodOfReport>
            <issuer>
              <issuerCik>123456</issuerCik>
              <issuerName>Test Corp</issuerName>
              <issuerTradingSymbol>TEST</issuerTradingSymbol>
            </issuer>
            <reportingOwner>
              <reportingOwnerId>
                <rptOwnerCik>789012</rptOwnerCik>
                <rptOwnerName>John Doe</rptOwnerName>
              </reportingOwnerId>
              <reportingOwnerRelationship>
                <isDirector>1</isDirector>
              </reportingOwnerRelationship>
            </reportingOwner>
          </ownershipDocument>
        </XML>
      `;

      expect(() => client.parseForm4(xmlNoSignatures)).toThrow(ValidationError);
      expect(() => client.parseForm4(xmlNoSignatures)).toThrow("signature");
    });

    it("includes field path in error", () => {
      const xmlMissingIssuerCik = `
        <XML>
          <ownershipDocument>
            <schemaVersion>X0508</schemaVersion>
            <documentType>4</documentType>
            <periodOfReport>2026-01-15</periodOfReport>
            <issuer>
              <issuerName>Test Corp</issuerName>
            </issuer>
            <reportingOwner>
              <reportingOwnerId>
                <rptOwnerCik>789012</rptOwnerCik>
                <rptOwnerName>John Doe</rptOwnerName>
              </reportingOwnerId>
              <reportingOwnerRelationship>
                <isDirector>1</isDirector>
              </reportingOwnerRelationship>
            </reportingOwner>
            <ownerSignature>
              <signatureName>John Doe</signatureName>
              <signatureDate>2026-01-15</signatureDate>
            </ownerSignature>
          </ownershipDocument>
        </XML>
      `;

      try {
        client.parseForm4(xmlMissingIssuerCik);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).field).toBe("issuer.cik");
      }
    });
  });

  describe("validate: false", () => {
    it("skips validation when validate option is false", () => {
      const xmlMissingIssuerCik = `
        <XML>
          <ownershipDocument>
            <schemaVersion>X0508</schemaVersion>
            <documentType>4</documentType>
            <periodOfReport>2026-01-15</periodOfReport>
            <issuer>
              <issuerName>Test Corp</issuerName>
              <issuerTradingSymbol>TEST</issuerTradingSymbol>
            </issuer>
            <reportingOwner>
              <reportingOwnerId>
                <rptOwnerCik>789012</rptOwnerCik>
                <rptOwnerName>John Doe</rptOwnerName>
              </reportingOwnerId>
              <reportingOwnerRelationship>
                <isDirector>1</isDirector>
              </reportingOwnerRelationship>
            </reportingOwner>
            <ownerSignature>
              <signatureName>John Doe</signatureName>
              <signatureDate>2026-01-15</signatureDate>
            </ownerSignature>
          </ownershipDocument>
        </XML>
      `;

      // Should not throw with validate: false
      const doc = client.parseForm4(xmlMissingIssuerCik, { validate: false });

      expect(doc.issuer.cik).toBe(""); // Empty string instead of throwing
      expect(doc.issuer.name).toBe("Test Corp");
    });

    it("allows parsing documents with no signatures when validate: false", () => {
      const xmlNoSignatures = `
        <XML>
          <ownershipDocument>
            <schemaVersion>X0508</schemaVersion>
            <documentType>4</documentType>
            <periodOfReport>2026-01-15</periodOfReport>
            <issuer>
              <issuerCik>123456</issuerCik>
              <issuerName>Test Corp</issuerName>
              <issuerTradingSymbol>TEST</issuerTradingSymbol>
            </issuer>
            <reportingOwner>
              <reportingOwnerId>
                <rptOwnerCik>789012</rptOwnerCik>
                <rptOwnerName>John Doe</rptOwnerName>
              </reportingOwnerId>
              <reportingOwnerRelationship>
                <isDirector>1</isDirector>
              </reportingOwnerRelationship>
            </reportingOwner>
          </ownershipDocument>
        </XML>
      `;

      const doc = client.parseForm4(xmlNoSignatures, { validate: false });

      expect(doc.signatures).toHaveLength(0);
      expect(doc.issuer.name).toBe("Test Corp");
    });
  });

  describe("Result-returning methods", () => {
    describe("getSchemaVersion", () => {
      it("returns ok: true with schema version for valid content", () => {
        const content = "<schemaVersion>X0508</schemaVersion>";
        const result = client.getSchemaVersion(content);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe("X0508");
        }
      });

      it("returns not_found error when no schema version tag", () => {
        const content = "<documentType>4</documentType>";
        const result = client.getSchemaVersion(content);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBe("not_found");
        }
      });

      it("returns unsupported_version error for unknown schema", () => {
        const content = "<schemaVersion>X9999</schemaVersion>";
        const result = client.getSchemaVersion(content);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBe("unsupported_version");
        }
      });
    });

    describe("getDocumentType", () => {
      it("returns ok: true with document type for valid content", () => {
        const content = "<documentType>4</documentType>";
        const result = client.getDocumentType(content);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe("4");
        }
      });

      it("returns ok: true for Form 4/A", () => {
        const content = "<documentType>4/A</documentType>";
        const result = client.getDocumentType(content);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe("4/A");
        }
      });

      it("returns not_found error when no document type tag", () => {
        const content = "<schemaVersion>X0508</schemaVersion>";
        const result = client.getDocumentType(content);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBe("not_found");
        }
      });
    });

    describe("getSourceInfo", () => {
      it("returns ok: true with source info for valid input", () => {
        const fileName = "edgar/data/1234567/0001234567-24-000001.txt";
        const content = "<FILENAME>form4.xml\n<XML>";
        const result = client.getSourceInfo(fileName, content);

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.fileName).toBe(fileName);
          expect(result.value.xmlFileName).toBe("form4.xml");
          expect(result.value.rawXmlUrl).toContain("form4.xml");
          expect(result.value.formattedXmlUrl).toContain("xslF345X03");
        }
      });

      it("returns invalid_filename error for malformed fileName", () => {
        const fileName = "invalid";
        const content = "<FILENAME>form4.xml\n";
        const result = client.getSourceInfo(fileName, content);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBe("invalid_filename");
        }
      });

      it("returns xml_not_found error when no XML filename in content", () => {
        const fileName = "edgar/data/1234567/0001234567-24-000001.txt";
        const content = "No filename";
        const result = client.getSourceInfo(fileName, content);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBe("xml_not_found");
        }
      });
    });
  });
});
