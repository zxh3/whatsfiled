import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EdgarClient } from "../src";
import { getQuarterFromDate } from "../src/internal/daily-index";

const client = new EdgarClient({ userAgent: "test-suite test@example.com" });

// Sample daily index content (anonymized from real SEC data)
const SAMPLE_INDEX_CONTENT = `Description:           Daily Index of EDGAR Dissemination Feed
Last Data Received:    January 15, 2024
Comments:              webmaster@sec.gov
Anonymous FTP:         ftp://ftp.sec.gov/edgar/
Cloud HTTP:            https://www.sec.gov/Archives/




Form Type   Company Name                                     CIK         Date Filed  File Name
-----------------------------------------------------------------------------------------------
4           ACME CORP                                        1234567     20240115    edgar/data/1234567/0001234567-24-000001.txt
4           BETA INDUSTRIES INC                              2345678     20240115    edgar/data/2345678/0002345678-24-000002.txt
4/A         GAMMA HOLDINGS LLC                               3456789     20240115    edgar/data/3456789/0003456789-24-000003.txt
10-K        DELTA SYSTEMS INC                                4567890     20240115    edgar/data/4567890/0004567890-24-000004.txt
8-K         EPSILON TECHNOLOGIES                             5678901     20240115    edgar/data/5678901/0005678901-24-000005.txt
4           ZETA PHARMACEUTICAL CO                           6789012     20240115    edgar/data/6789012/0006789012-24-000006.txt
SCHEDULE 13D THETA PARTNERS LP                               7890123     20240115    edgar/data/7890123/0007890123-24-000007.txt
SC 13G      IOTA MANAGEMENT LLC                              8901234     20240115    edgar/data/8901234/0008901234-24-000008.txt
`;

describe("Daily Index Parser", () => {
  describe("parseDailyIndex", () => {
    it("parses index rows correctly", () => {
      const rows = client.parseDailyIndex(SAMPLE_INDEX_CONTENT);
      expect(rows.length).toBeGreaterThan(0);
    });

    it("extracts all fields from rows", () => {
      const rows = client.parseDailyIndex(SAMPLE_INDEX_CONTENT);
      const firstRow = rows[0];

      expect(firstRow).toBeDefined();
      expect(firstRow.formType).toBe("4");
      expect(firstRow.companyName).toBe("ACME CORP");
      expect(firstRow.cik).toBe("1234567");
      expect(firstRow.dateFiled).toBe("20240115");
      expect(firstRow.fileName).toBe(
        "edgar/data/1234567/0001234567-24-000001.txt",
      );
    });

    it("filters by form type", () => {
      const rows = client.parseDailyIndex(SAMPLE_INDEX_CONTENT, {
        formTypes: ["4"],
      });
      expect(rows.every((r) => r.formType === "4")).toBe(true);
      expect(rows.length).toBe(3); // ACME, BETA, ZETA
    });

    it("filters by multiple form types", () => {
      const rows = client.parseDailyIndex(SAMPLE_INDEX_CONTENT, {
        formTypes: ["4", "4/A"],
      });
      expect(
        rows.every((r) => r.formType === "4" || r.formType === "4/A"),
      ).toBe(true);
      expect(rows.length).toBe(4); // ACME, BETA, GAMMA, ZETA
    });

    it("handles Form 4/A amendments", () => {
      const rows = client.parseDailyIndex(SAMPLE_INDEX_CONTENT, {
        formTypes: ["4/A"],
      });
      expect(rows.length).toBe(1);
      expect(rows[0].companyName).toBe("GAMMA HOLDINGS LLC");
    });

    it("handles SCHEDULE 13D form type", () => {
      const rows = client.parseDailyIndex(SAMPLE_INDEX_CONTENT, {
        formTypes: ["SCHEDULE 13D"],
      });
      expect(rows.length).toBe(1);
      expect(rows[0].companyName).toBe("THETA PARTNERS LP");
    });

    it("handles SC 13G form type", () => {
      const rows = client.parseDailyIndex(SAMPLE_INDEX_CONTENT, {
        formTypes: ["SC 13G"],
      });
      expect(rows.length).toBe(1);
      expect(rows[0].companyName).toBe("IOTA MANAGEMENT LLC");
    });

    it("returns empty array for non-matching form types", () => {
      const rows = client.parseDailyIndex(SAMPLE_INDEX_CONTENT, {
        formTypes: ["13F-HR"],
      });
      expect(rows.length).toBe(0);
    });

    it("handles empty content", () => {
      const rows = client.parseDailyIndex("");
      expect(rows).toEqual([]);
    });

    it("handles content with only header (no data rows)", () => {
      const headerOnly = `Description: Daily Index
-----------------------------------------------------------------------------------------------
`;
      const rows = client.parseDailyIndex(headerOnly);
      expect(rows).toEqual([]);
    });
  });

  describe("getDailyIndexFileNames", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it("calculates quarter correctly for zero-based Date#getMonth", () => {
      expect(getQuarterFromDate(new Date("2026-01-15T00:00:00.000Z"))).toBe(1);
      expect(getQuarterFromDate(new Date("2026-02-15T00:00:00.000Z"))).toBe(1);
      expect(getQuarterFromDate(new Date("2026-03-15T00:00:00.000Z"))).toBe(1);
      expect(getQuarterFromDate(new Date("2026-04-15T00:00:00.000Z"))).toBe(2);
      expect(getQuarterFromDate(new Date("2026-12-15T00:00:00.000Z"))).toBe(4);
    });

    it("skips unavailable quarter catalogs with 403", async () => {
      const fetchMock = vi.mocked(globalThis.fetch);

      fetchMock.mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes("/2025/QTR1/")) {
          return new Response('<a href="form.20260102.idx">form.20260102.idx</a>', {
            status: 200,
            statusText: "OK",
          });
        }
        if (url.includes("/2025/QTR2/")) {
          return new Response("forbidden", {
            status: 403,
            statusText: "Forbidden",
          });
        }
        return new Response("not found", { status: 404, statusText: "Not Found" });
      });

      const fileNames = await new EdgarClient({
        userAgent: "test-suite test@example.com",
        rateLimitDelayMs: 0,
      }).getDailyIndexFileNames(2025);

      expect(fileNames).toEqual(["form.20260102.idx"]);
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });
  });

  describe("edge cases", () => {
    it("handles company names with special characters", () => {
      const content = `-----------------------------------------------------------------------------------------------
4           COMPANY (USA) INC.                               1111111     20240115    edgar/data/1111111/0001111111-24-000001.txt
4           O'BRIEN & SONS LLC                               2222222     20240115    edgar/data/2222222/0002222222-24-000002.txt
`;
      const rows = client.parseDailyIndex(content, { formTypes: ["4"] });
      expect(rows.length).toBe(2);
      expect(rows[0].companyName).toBe("COMPANY (USA) INC.");
      expect(rows[1].companyName).toBe("O'BRIEN & SONS LLC");
    });

    it("handles varying whitespace", () => {
      const content = `-----------------------------------------------------------------------------------------------
4          TIGHT COMPANY                                     1111111     20240115    edgar/data/1111111/0001111111-24-000001.txt
4              WIDE  COMPANY                                 2222222     20240115    edgar/data/2222222/0002222222-24-000002.txt
`;
      const rows = client.parseDailyIndex(content, { formTypes: ["4"] });
      expect(rows.length).toBe(2);
      expect(rows[0].companyName).toBe("TIGHT COMPANY");
      expect(rows[1].companyName).toBe("WIDE COMPANY");
    });

    it("ignores lines without edgar/data/ path", () => {
      const content = `-----------------------------------------------------------------------------------------------
4           VALID COMPANY                                    1111111     20240115    edgar/data/1111111/0001111111-24-000001.txt
4           INVALID COMPANY                                  2222222     20240115    some/other/path.txt
`;
      const rows = client.parseDailyIndex(content, { formTypes: ["4"] });
      expect(rows.length).toBe(1);
      expect(rows[0].companyName).toBe("VALID COMPANY");
    });
  });
});
