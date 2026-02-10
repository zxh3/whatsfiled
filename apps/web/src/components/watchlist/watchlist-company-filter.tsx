"use client";

import { Button } from "@whatsfiled/ui/components/button";
import { Checkbox } from "@whatsfiled/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@whatsfiled/ui/components/dropdown-menu";
import { ChevronDown } from "lucide-react";

type WatchlistCompany = {
  id: string;
  cik: string;
  name: string;
  ticker: string | null;
};

interface WatchlistCompanyFilterProps {
  companies: WatchlistCompany[];
  selectedCiks: string[];
  onChange: (nextSelectedCiks: string[]) => void;
}

function getTriggerLabel(
  companies: WatchlistCompany[],
  selectedCiks: string[],
) {
  if (selectedCiks.length === companies.length) {
    return `Companies (${companies.length})`;
  }

  if (selectedCiks.length === 0) {
    return "Companies (0)";
  }

  if (selectedCiks.length === 1) {
    const selected = companies.find((c) => c.cik === selectedCiks[0]);
    return selected ? selected.ticker || selected.name : "Companies (1)";
  }

  return `Companies (${selectedCiks.length})`;
}

export function WatchlistCompanyFilter({
  companies,
  selectedCiks,
  onChange,
}: WatchlistCompanyFilterProps) {
  const allCiks = companies.map((c) => c.cik);
  const selectedSet = new Set(selectedCiks);

  const toggleCompany = (cik: string) => {
    if (selectedSet.has(cik)) {
      onChange(selectedCiks.filter((selected) => selected !== cik));
      return;
    }

    const next = [...selectedCiks, cik];
    const ordered = allCiks.filter((entry) => next.includes(entry));
    onChange(ordered);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="min-w-40 justify-between"
          >
            <span className="truncate">
              {getTriggerLabel(companies, selectedCiks)}
            </span>
            <ChevronDown />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuItem onClick={() => onChange(allCiks)}>
          All watched
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange([])}>Clear</DropdownMenuItem>
        <DropdownMenuSeparator />
        {companies.map((company) => {
          const checked = selectedSet.has(company.cik);
          return (
            <DropdownMenuItem
              key={company.id}
              closeOnClick={false}
              onClick={() => toggleCompany(company.cik)}
            >
              <Checkbox checked={checked} className="pointer-events-none" />
              <span className="truncate font-medium">
                {company.ticker || company.name}
              </span>
              {company.ticker && (
                <span className="truncate text-muted-foreground">
                  {company.name}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
