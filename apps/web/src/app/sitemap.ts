import { companies, desc, filings, getDb, insiders, sql } from "@whatsfiled/db";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://whatsfiled.com";
  const db = getDb();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${siteUrl}/search`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/resources/sec-filings`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  // Company pages - get all companies with their last update time
  const companyRows = await db
    .select({
      cik: companies.cik,
      updatedAt: companies.updatedAt,
    })
    .from(companies)
    .orderBy(desc(companies.updatedAt))
    .limit(10000);

  const companyPages: MetadataRoute.Sitemap = companyRows.map((company) => ({
    url: `${siteUrl}/company/${company.cik}`,
    lastModified: company.updatedAt,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  // Insider pages - get all insiders with CIK
  const insiderRows = await db
    .select({
      cik: insiders.cik,
      updatedAt: insiders.updatedAt,
    })
    .from(insiders)
    .where(sql`${insiders.cik} IS NOT NULL`)
    .orderBy(desc(insiders.updatedAt))
    .limit(10000);

  const insiderPages: MetadataRoute.Sitemap = insiderRows
    .filter((insider) => insider.cik)
    .map((insider) => ({
      url: `${siteUrl}/insider/${insider.cik}`,
      lastModified: insider.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.6,
    }));

  // Filing pages - get recent filings (limit to last 5000 for performance)
  const filingRows = await db
    .select({
      accessionNumber: filings.accessionNumber,
      filedAt: filings.filedAt,
    })
    .from(filings)
    .orderBy(desc(filings.filedAt))
    .limit(5000);

  const filingPages: MetadataRoute.Sitemap = filingRows.map((filing) => ({
    url: `${siteUrl}/filing/${filing.accessionNumber}`,
    lastModified: filing.filedAt,
    changeFrequency: "never" as const,
    priority: 0.5,
  }));

  return [...staticPages, ...companyPages, ...insiderPages, ...filingPages];
}
