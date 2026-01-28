import type { Metadata } from "next";
import { eq, getDb, insiders, or, sql } from "@whatsfiled/db";
import { InsiderPageClient } from "./insider-page-client";

type Props = {
  params: Promise<{ cik: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cik } = await params;
  const db = getDb();
  const normalizedCik = cik.replace(/^0+/, "");

  const insider = await db
    .select({
      id: insiders.id,
      name: insiders.name,
      cik: insiders.cik,
    })
    .from(insiders)
    .where(
      or(
        eq(insiders.cik, cik),
        sql`ltrim(${insiders.cik}, '0') = ${normalizedCik}`,
      ),
    )
    .limit(1);

  if (insider.length === 0) {
    return {
      title: "Insider Not Found",
      description: "The requested insider could not be found.",
    };
  }

  const insiderName = insider[0].name;
  const title = `${insiderName} - Insider Trading Activity`;
  const description = `View SEC Form 4 filings and insider trading activity for ${insiderName}. Track stock purchases, sales, and company affiliations.`;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://whatsfiled.com";
  const canonicalUrl = `${siteUrl}/insider/${insider[0].cik}`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} | WhatsFiled`,
      description,
      url: canonicalUrl,
      type: "profile",
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

export default function InsiderPage() {
  return <InsiderPageClient />;
}
