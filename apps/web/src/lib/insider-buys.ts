import {
  and,
  asc,
  companies,
  companyTickers,
  desc,
  eq,
  filingOwners,
  filings,
  getDb,
  inArray,
  insiders,
  lte,
  transactions,
} from "@whatsfiled/db";

const TOP_BUYS_LIMIT = 25;
const MIN_ESTIMATED_VALUE_USD = 50_000;

export type TopInsiderBuy = {
  key: string;
  transactionDate: string;
  company: {
    id: string;
    name: string;
    cik: string;
    ticker: string | null;
  };
  insider: {
    id: string;
    name: string;
    title: string;
  };
  shares: number;
  averagePrice: number | null;
  estimatedValue: number;
  filing: {
    accessionNumber: string;
    filedAt: Date;
  };
  filingCount: number;
};

export type TopInsiderBuysResult = {
  date: string;
  rows: TopInsiderBuy[];
  totalEstimatedValue: number;
  rowCount: number;
};

type OwnerRoleInput = {
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
  officerTitle: string | null;
};

type AggregatedBuy = {
  key: string;
  transactionDate: string;
  company: {
    id: string;
    name: string;
    cik: string;
    ticker: string | null;
  };
  insider: {
    id: string;
    name: string;
    title: string;
  };
  shares: number;
  estimatedValue: number;
  priceNumerator: number;
  priceDenominator: number;
  filing: {
    accessionNumber: string;
    filedAt: Date;
  };
  filingAccessions: Set<string>;
};

function parseDecimal(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getOwnerRole(owner: OwnerRoleInput): string {
  if (owner.officerTitle) {
    return owner.officerTitle;
  }

  const roles: string[] = [];
  if (owner.isDirector) roles.push("Director");
  if (owner.isOfficer) roles.push("Officer");
  if (owner.isTenPercentOwner) roles.push("10% Owner");

  return roles.length > 0 ? roles.join(", ") : "Insider";
}

export function getEasternDateString(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.toISOString().startsWith(value);
}

export async function getTopInsiderBuysByDate(
  date: string,
): Promise<TopInsiderBuysResult> {
  const db = getDb();

  const buys = await db
    .select({
      filingId: transactions.filingId,
      transactionDate: transactions.transactionDate,
      shares: transactions.shares,
      pricePerShare: transactions.pricePerShare,
      totalValue: transactions.totalValue,
      accessionNumber: filings.accessionNumber,
      filedAt: filings.filedAt,
      companyId: companies.id,
      companyName: companies.name,
      companyCik: companies.cik,
    })
    .from(transactions)
    .innerJoin(filings, eq(transactions.filingId, filings.id))
    .innerJoin(companies, eq(filings.companyId, companies.id))
    .where(
      and(
        eq(transactions.transactionCode, "P"),
        eq(transactions.acquiredDisposed, "A"),
        eq(transactions.transactionDate, date),
        lte(transactions.transactionDate, getEasternDateString()),
      ),
    )
    .orderBy(desc(filings.filedAt), desc(filings.createdAt), desc(filings.id));

  if (buys.length === 0) {
    return {
      date,
      rows: [],
      rowCount: 0,
      totalEstimatedValue: 0,
    };
  }

  const filingIds = [...new Set(buys.map((buy) => buy.filingId))];
  const companyIds = [...new Set(buys.map((buy) => buy.companyId))];

  const [owners, tickers] = await Promise.all([
    db
      .select({
        filingId: filingOwners.filingId,
        insiderId: insiders.id,
        insiderName: insiders.name,
        officerTitle: filingOwners.officerTitle,
        isDirector: filingOwners.isDirector,
        isOfficer: filingOwners.isOfficer,
        isTenPercentOwner: filingOwners.isTenPercentOwner,
      })
      .from(filingOwners)
      .innerJoin(insiders, eq(filingOwners.insiderId, insiders.id))
      .where(inArray(filingOwners.filingId, filingIds))
      .orderBy(filingOwners.filingId, asc(insiders.name)),

    db
      .select({
        companyId: companyTickers.companyId,
        ticker: companyTickers.ticker,
        isPrimary: companyTickers.isPrimary,
      })
      .from(companyTickers)
      .where(inArray(companyTickers.companyId, companyIds))
      .orderBy(desc(companyTickers.isPrimary), asc(companyTickers.ticker)),
  ]);

  const ownerByFilingId = new Map<string, (typeof owners)[number]>();
  for (const owner of owners) {
    if (!ownerByFilingId.has(owner.filingId)) {
      ownerByFilingId.set(owner.filingId, owner);
    }
  }

  const tickerByCompanyId = new Map<string, string>();
  for (const ticker of tickers) {
    if (!tickerByCompanyId.has(ticker.companyId)) {
      tickerByCompanyId.set(ticker.companyId, ticker.ticker);
    }
  }

  const aggregateMap = new Map<string, AggregatedBuy>();

  for (const buy of buys) {
    const owner = ownerByFilingId.get(buy.filingId);
    if (!owner || !buy.transactionDate) {
      continue;
    }

    const shares = parseDecimal(buy.shares);
    const pricePerShare = parseDecimal(buy.pricePerShare);
    const totalValue = parseDecimal(buy.totalValue);

    const estimatedValue =
      shares !== null && pricePerShare !== null
        ? shares * pricePerShare
        : (totalValue ?? 0);

    if (estimatedValue <= 0) {
      continue;
    }

    const key = `${owner.insiderId}:${buy.companyId}:${buy.transactionDate}`;
    const existing = aggregateMap.get(key);

    const priceNumerator =
      shares !== null && pricePerShare !== null ? shares * pricePerShare : 0;
    const priceDenominator =
      shares !== null && pricePerShare !== null ? shares : 0;

    if (!existing) {
      aggregateMap.set(key, {
        key,
        transactionDate: buy.transactionDate,
        company: {
          id: buy.companyId,
          name: buy.companyName,
          cik: buy.companyCik,
          ticker: tickerByCompanyId.get(buy.companyId) ?? null,
        },
        insider: {
          id: owner.insiderId,
          name: owner.insiderName,
          title: getOwnerRole(owner),
        },
        shares: shares ?? 0,
        estimatedValue,
        priceNumerator,
        priceDenominator,
        filing: {
          accessionNumber: buy.accessionNumber,
          filedAt: buy.filedAt,
        },
        filingAccessions: new Set([buy.accessionNumber]),
      });
      continue;
    }

    existing.shares += shares ?? 0;
    existing.estimatedValue += estimatedValue;
    existing.priceNumerator += priceNumerator;
    existing.priceDenominator += priceDenominator;
    existing.filingAccessions.add(buy.accessionNumber);

    if (buy.filedAt > existing.filing.filedAt) {
      existing.filing = {
        accessionNumber: buy.accessionNumber,
        filedAt: buy.filedAt,
      };
    }
  }

  const rows = [...aggregateMap.values()]
    .filter((row) => row.estimatedValue >= MIN_ESTIMATED_VALUE_USD)
    .sort((a, b) => b.estimatedValue - a.estimatedValue)
    .slice(0, TOP_BUYS_LIMIT)
    .map((row) => ({
      key: row.key,
      transactionDate: row.transactionDate,
      company: row.company,
      insider: row.insider,
      shares: row.shares,
      averagePrice:
        row.priceDenominator > 0
          ? row.priceNumerator / row.priceDenominator
          : null,
      estimatedValue: row.estimatedValue,
      filing: row.filing,
      filingCount: row.filingAccessions.size,
    }));

  return {
    date,
    rows,
    rowCount: rows.length,
    totalEstimatedValue: rows.reduce((sum, row) => sum + row.estimatedValue, 0),
  };
}
