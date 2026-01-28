import { companies, companyTickers, eq, getDb, or, sql } from "@whatsfiled/db";
import type { Metadata } from "next";
import { CompanyPageClient } from "./company-page-client";

type Props = {
  params: Promise<{ cik: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cik } = await params;
  const db = getDb();
  const normalizedCik = cik.replace(/^0+/, "");

  const company = await db
    .select({
      id: companies.id,
      name: companies.name,
      cik: companies.cik,
    })
    .from(companies)
    .where(
      or(
        eq(companies.cik, cik),
        sql`ltrim(${companies.cik}, '0') = ${normalizedCik}`,
      ),
    )
    .limit(1);

  if (company.length === 0) {
    return {
      title: "Company Not Found",
      description: "The requested company could not be found.",
    };
  }

  const ticker = await db
    .select({ ticker: companyTickers.ticker })
    .from(companyTickers)
    .where(eq(companyTickers.companyId, company[0].id))
    .limit(1);

  const companyName = company[0].name;
  const tickerSymbol = ticker[0]?.ticker;
  const displayName = tickerSymbol
    ? `${companyName} (${tickerSymbol})`
    : companyName;

  const title = `${displayName} Insider Trading`;
  const description = `Track insider trading activity for ${displayName}. View SEC Form 4 filings, stock purchases, sales, and ownership changes by company executives and directors.`;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://whatsfiled.com";
  const canonicalUrl = `${siteUrl}/company/${company[0].cik}`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | WhatsFiled`,
      description,
      url: canonicalUrl,
      type: "website",
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

export default function CompanyPage() {
  return <CompanyPageClient />;
}
