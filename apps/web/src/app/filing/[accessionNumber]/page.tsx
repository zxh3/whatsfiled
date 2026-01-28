import { companies, companyTickers, eq, filings, getDb } from "@whatsfiled/db";
import type { Metadata } from "next";
import { FilingPageClient } from "./filing-page-client";

type Props = {
  params: Promise<{ accessionNumber: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { accessionNumber } = await params;
  const db = getDb();

  const filing = await db
    .select({
      accessionNumber: filings.accessionNumber,
      formType: filings.formType,
      filedAt: filings.filedAt,
      companyId: filings.companyId,
      companyName: companies.name,
      companyCik: companies.cik,
    })
    .from(filings)
    .innerJoin(companies, eq(filings.companyId, companies.id))
    .where(eq(filings.accessionNumber, accessionNumber))
    .limit(1);

  if (filing.length === 0) {
    return {
      title: "Filing Not Found",
      description: "The requested SEC filing could not be found.",
    };
  }

  const ticker = await db
    .select({ ticker: companyTickers.ticker })
    .from(companyTickers)
    .where(eq(companyTickers.companyId, filing[0].companyId))
    .limit(1);

  const companyName = filing[0].companyName;
  const tickerSymbol = ticker[0]?.ticker;
  const displayName = tickerSymbol
    ? `${companyName} (${tickerSymbol})`
    : companyName;

  const filedDate = new Date(filing[0].filedAt).toISOString().split("T")[0];

  const title = `Form ${filing[0].formType} - ${displayName}`;
  const description = `SEC Form ${filing[0].formType} insider trading filing for ${displayName}, filed ${filedDate}. View transaction details, ownership changes, and footnotes.`;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://whatsfiled.com";
  const canonicalUrl = `${siteUrl}/filing/${filing[0].accessionNumber}`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | WhatsFiled`,
      description,
      url: canonicalUrl,
      type: "article",
      publishedTime: filing[0].filedAt.toISOString(),
    },
    twitter: {
      card: "summary",
      title: `${title} | WhatsFiled`,
      description,
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default function FilingPage() {
  return <FilingPageClient />;
}
