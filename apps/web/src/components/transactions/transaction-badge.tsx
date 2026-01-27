import { cn } from "@whatsfiled/ui/lib/utils";

const TRANSACTION_LABELS: Record<string, string> = {
  P: "Purchase",
  S: "Sale",
  M: "Exercise",
  A: "Award",
  F: "Tax",
  G: "Gift",
  C: "Conversion",
};

type TransactionType = "buy" | "sell" | "other";

function getTransactionType(code: string | null): TransactionType {
  if (!code) return "other";
  if (code === "P" || code === "M" || code === "A") return "buy";
  if (code === "S" || code === "F") return "sell";
  return "other";
}

interface TransactionBadgeProps {
  code: string | null;
  isDerivative?: boolean;
  className?: string;
}

function TransactionBadge({
  code,
  isDerivative,
  className,
}: TransactionBadgeProps) {
  const type = getTransactionType(code);
  const label = code ? TRANSACTION_LABELS[code] || code : "Unknown";

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
          type === "buy" &&
            "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
          type === "sell" &&
            "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
          type === "other" &&
            "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
        )}
      >
        {label}
      </span>
      {isDerivative && (
        <span className="rounded bg-purple-100 px-1 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
          Opt
        </span>
      )}
    </span>
  );
}

export { TransactionBadge, getTransactionType, TRANSACTION_LABELS };
