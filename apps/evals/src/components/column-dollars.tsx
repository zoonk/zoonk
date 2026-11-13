import { formatDollars } from "@/lib/format";

/**
 * A cost from $1 up has two decimals and a smaller one four, so in a column the larger one keeps
 * room for two more digits and every decimal point lines up.
 */
export function ColumnDollars({ value }: { value: number | null }) {
  return (
    <>
      {formatDollars(value)}
      {value !== null && value >= 1 && (
        <span aria-hidden="true" className="invisible">
          00
        </span>
      )}
    </>
  );
}
