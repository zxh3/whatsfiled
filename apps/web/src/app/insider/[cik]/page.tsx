"use client";

import { FilingCard } from "@/components/filings/filing-card";
import { trpc } from "@/lib/trpc";

export default function InsiderPage({ params }: { params: { cik: string } }) {
  const { data, isLoading, isError } = trpc.insiders.getByCik.useQuery({
    cik: params.cik,
    limit: 50,
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-muted-foreground">Loading insider…</p>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-red-500 font-medium">Insider not found</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <header>
        <div className="text-xs text-muted-foreground">Insider</div>
        <h1 className="text-2xl font-semibold">{data.insider.name}</h1>
        <p className="text-sm text-muted-foreground">CIK {data.insider.cik}</p>
      </header>

      {data.filings.length === 0 ? (
        <p className="text-muted-foreground">No filings found.</p>
      ) : (
        <div>
          {data.filings.map((filing) => (
            <FilingCard key={filing.id} filing={filing} />
          ))}
        </div>
      )}
    </main>
  );
}
