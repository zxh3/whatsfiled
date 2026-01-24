import edgarFetchClient from "./edgarFetchClient";

export type EdgarDailyIndexFormRow = {
  formType: string;
  companyName: string;
  cik: string; // as shown in idx
  dateFiled: string; // YYYYMMDD
  fileName: string; // edgar/data/.../*.txt
};

type ParseOptions = {
  // Provide your canonical form types, e.g. ["4", "4/A", "SCHEDULE 13D", "SCHEDULE 13D/A", ...]
  knownFormTypes: readonly string[];
};

export const KNOWN_FORMS = [
  // Insider ownership
  "3",
  "3/A",
  "4",
  "4/A",
  "5",
  "5/A",

  // Schedules
  "SCHEDULE 13D",
  "SCHEDULE 13D/A",
  "SCHEDULE 13G",
  "SCHEDULE 13G/A",
  "SC 13D",
  "SC 13D/A",
  "SC 13G",
  "SC 13G/A",

  // Common filings (optional)
  "10-K",
  "10-Q",
  "8-K",
  "13F-HR",
  "13F-HR/A",
  "DEF 14A",
  "DEFA14A",
] as const;

export function parseRawEdgarDailyIndexFormContent(
  text: string,
  opts: ParseOptions = { knownFormTypes: KNOWN_FORMS },
): EdgarDailyIndexFormRow[] {
  const lines = text.split(/\r?\n/);

  // Start parsing after dashed separator
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^-{10,}\s*$/.test(lines[i])) {
      start = i + 1;
      break;
    }
  }

  // Longest-first is crucial (e.g. "SCHEDULE 13D/A" should match before "SCHEDULE 13D")
  const known = [...opts.knownFormTypes]
    .map((s) => s.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const rows: EdgarDailyIndexFormRow[] = [];

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    const row = parseIdxLineWithKnownForms(line, known);
    if (row) rows.push(row);
  }

  return rows;
}

function parseIdxLineWithKnownForms(
  line: string,
  knownFormsLongestFirst: readonly string[],
): EdgarDailyIndexFormRow | null {
  // 1) Anchor fileName
  const fileIdx = line.indexOf("edgar/data/");
  if (fileIdx === -1) {
    console.error(`No edgar/data/ in line: ${line}`);
    return null;
  }

  const fileName = line.slice(fileIdx).trim();
  const left = line.slice(0, fileIdx).trimEnd();

  // 2) Parse tail as "<cik> <yyyymmdd>"
  const tail = left.match(/(\d+)\s+(\d{8})\s*$/);
  if (!tail || tail.index == null) {
    console.error(`No cik/dateFiled in line: ${line}`);
    return null;
  }

  const cik = tail[1];
  const dateFiled = tail[2];

  const beforeCik = left.slice(0, tail.index).trimEnd();
  if (!beforeCik) {
    console.error(`No beforeCik in line: ${line}`);
    return null;
  }

  // 3) Find formType by matching known prefixes
  // Normalize spacing for matching: collapse runs of whitespace to a single space
  const normalized = beforeCik.replace(/\s+/g, " ").trim();

  let matchedForm: string | null = null;
  for (const f of knownFormsLongestFirst) {
    if (normalized === f) {
      matchedForm = f;
      break;
    }
    if (normalized.startsWith(f + " ")) {
      matchedForm = f;
      break;
    }
  }

  if (!matchedForm) {
    // If you prefer: return null to skip unknown forms
    // Or fallback: treat first token as formType (less safe)
    console.error(`Unknown form type: ${normalized}`);
    return null;
  }

  const companyName = normalized.slice(matchedForm.length).trim();
  if (!companyName) {
    console.error(`No companyName in line: ${line}`);
    return null;
  }

  return {
    formType: matchedForm,
    companyName,
    cik,
    dateFiled,
    fileName,
  };
}

/**
 * Get the URL of the form file for the given fileName
 * @param fileName - The fileName to fetch (e.g. "form.20260102.idx")
 * @returns The URL of the form file
 */
export async function fetchRawEdgarDailyIndexFormContent(
  fileName: string,
): Promise<{ url: string; content: string; dateTimestamp: number }> {
  const dateStr = fileName.split(".")[1];
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  const quarter = Math.ceil(parseInt(month, 10) / 3);
  const dateTimestamp = new Date(`${year}-${month}-${day}`).getTime();
  const url = `https://www.sec.gov/Archives/edgar/daily-index/${year}/QTR${quarter}/form.${dateStr}.idx`;
  const content = await edgarFetchClient.fetch(url);
  return { url, content, dateTimestamp };
}

/**
 * Get the index catalog form files for the given year
 * @param year - The year to get the index catalog form files for
 * @returns An array of form index fileNames (e.g., ["form.20260102.idx", "form.20260105.idx"])
 */
export async function fetchEdgarDailyIndexFormFileNamesByYear(
  year: number,
): Promise<string[]> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.ceil(now.getMonth() / 3) + 1;

  if (year > currentYear) {
    return [];
  }

  // https://www.sec.gov/Archives/edgar/daily-index/2026/QTR1/form.20260102.idx

  const fileNames: string[] = [];
  const maxQuarter = year === currentYear ? currentQuarter : 4;
  for (let quarter = 1; quarter <= maxQuarter; quarter++) {
    const _fileNames = await _fetchEdgarDailyIndexFormFileNamesByQuarter({
      year,
      quarter,
    });
    fileNames.push(..._fileNames);
  }
  return fileNames;
}

/**
 * Fetch the daily index catalog files for the given year and quarter
 * @param year - The year to fetch the daily index catalog files for
 * @param quarter - The quarter to fetch the daily index catalog files for
 * @returns An array of form index fileNames (e.g., ["form.20260102.idx", "form.20260105.idx"])
 */
async function _fetchEdgarDailyIndexFormFileNamesByQuarter({
  year,
  quarter,
}: {
  year: number;
  quarter: number;
}): Promise<string[]> {
  const dailyIndexCatalogUrl = `https://www.sec.gov/Archives/edgar/daily-index/${year}/QTR${quarter}/`;
  const dailyIndexCatalog = await edgarFetchClient.fetch(dailyIndexCatalogUrl);
  const fileNames = _extractEdgarDailyIndexFormFileNames(dailyIndexCatalog);
  return fileNames;
}

/**
 * Extract form index fileNames from the daily index catalog HTML
 * @param html - The HTML content from the daily index catalog page
 * @returns An array of form index fileNames (e.g., ["form.20260102.idx", "form.20260105.idx"])
 */
function _extractEdgarDailyIndexFormFileNames(html: string): string[] {
  const regex = /form\.\d{8}\.idx/g;
  const matches = html.match(regex);
  return matches ? [...new Set(matches)] : [];
}
