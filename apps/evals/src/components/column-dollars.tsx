import { formatDollars } from "@/lib/format";

/**
 * A cost column's cells. A cost from $1 up has two decimals and a smaller one four, so when a
 * column has both, the larger ones keep room for two more digits and every decimal point lines up.
 */
export function dollarsCells<Entry>(entries: Entry[], cost: (entry: Entry) => number | null) {
  const hasSmallCosts = entries.some((entry) => {
    const value = cost(entry);
    return value !== null && value < 1;
  });

  return function DollarsCell(entry: Entry) {
    const value = cost(entry);

    return (
      <>
        {formatDollars(value)}
        {hasSmallCosts && value !== null && value >= 1 && (
          <span aria-hidden="true" className="invisible">
            00
          </span>
        )}
      </>
    );
  };
}
