import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchPageClient } from "./search-page-client";

export const metadata: Metadata = {
  title: "Search Companies & Insiders",
  description:
    "Search for public companies by name or ticker symbol, and find insiders by name. Track SEC Form 4 filings and insider trading activity.",
  openGraph: {
    title: "Search Companies & Insiders | WhatsFiled",
    description:
      "Search for public companies by name or ticker symbol, and find insiders by name. Track SEC Form 4 filings and insider trading activity.",
  },
};

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageClient />
    </Suspense>
  );
}
