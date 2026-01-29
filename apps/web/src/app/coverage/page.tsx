import type { Metadata } from "next";
import { CoverageContent } from "./coverage-content";

export const metadata: Metadata = {
  title: "Data Coverage",
  description:
    "View WhatsFiled's SEC Form 4 data coverage. See which years have complete data and backfill progress.",
  openGraph: {
    title: "Data Coverage | WhatsFiled",
    description:
      "View WhatsFiled's SEC Form 4 data coverage. See which years have complete data and backfill progress.",
  },
};

export default function CoveragePage() {
  return <CoverageContent />;
}
