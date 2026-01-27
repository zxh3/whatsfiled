import { KNOWN_FORMS, type DailyIndexRow, type FormType } from "../types";

type ParseOptions = {
  formTypes?: readonly string[];
};

export function parseDailyIndex(
  text: string,
  opts: ParseOptions = {},
): DailyIndexRow[] {
  const formTypes = opts.formTypes ?? KNOWN_FORMS;
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
  const known = [...formTypes]
    .map((s) => s.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const rows: DailyIndexRow[] = [];

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
): DailyIndexRow | null {
  // 1) Anchor fileName
  const fileIdx = line.indexOf("edgar/data/");
  if (fileIdx === -1) {
    return null;
  }

  const fileName = line.slice(fileIdx).trim();
  const left = line.slice(0, fileIdx).trimEnd();

  // 2) Parse tail as "<cik> <yyyymmdd>"
  const tail = left.match(/(\d+)\s+(\d{8})\s*$/);
  if (!tail || tail.index == null) {
    return null;
  }

  const cik = tail[1];
  const dateFiled = tail[2];

  const beforeCik = left.slice(0, tail.index).trimEnd();
  if (!beforeCik) {
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
    return null;
  }

  const companyName = normalized.slice(matchedForm.length).trim();
  if (!companyName) {
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
 * Extract form index fileNames from the daily index catalog HTML
 */
export function extractDailyIndexFileNames(html: string): string[] {
  const regex = /form\.\d{8}\.idx/g;
  const matches = html.match(regex);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Parse daily index fileName to extract date info
 */
export function parseDailyIndexFileName(fileName: string): {
  dateStr: string;
  year: string;
  month: string;
  day: string;
  quarter: number;
  dateTimestamp: number;
} {
  const dateStr = fileName.split(".")[1];
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  const quarter = Math.ceil(Number.parseInt(month, 10) / 3);
  const dateTimestamp = new Date(`${year}-${month}-${day}`).getTime();
  return { dateStr, year, month, day, quarter, dateTimestamp };
}

/**
 * Build the URL for a daily index file
 */
export function buildDailyIndexUrl(fileName: string): string {
  const { year, quarter, dateStr } = parseDailyIndexFileName(fileName);
  return `https://www.sec.gov/Archives/edgar/daily-index/${year}/QTR${quarter}/form.${dateStr}.idx`;
}

/**
 * Build the URL for a quarter's index catalog
 */
export function buildQuarterCatalogUrl(year: number, quarter: number): string {
  return `https://www.sec.gov/Archives/edgar/daily-index/${year}/QTR${quarter}/`;
}

/**
 * Build the URL for an EDGAR archive file
 */
export function buildArchiveFileUrl(fileName: string): string {
  return `https://www.sec.gov/Archives/${fileName}`;
}
