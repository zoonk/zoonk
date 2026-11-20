import { Meter, MeterFill } from "@zoonk/ui/components/meter";
import { cn } from "@zoonk/ui/lib/utils";

export type BarListRow = {
  /** What the value reads as: "$1.25", "4 lessons". */
  display: string;
  key: string;
  name: React.ReactNode;
  /** One muted line under the name. */
  note?: React.ReactNode;
  value: number;
};

/**
 * A ranking: each row is a name, a bar and a figure, the bars on one edge so their lengths
 * compare. The longest bar is the largest value. Under `@md` the bar drops under the name.
 */
export function BarList({ className, rows }: { className?: string; rows: BarListRow[] }) {
  const largest = Math.max(0, ...rows.map((row) => row.value));

  return (
    <ul className={cn("@container divide-y", className)} data-slot="bar-list">
      {rows.map((row) => (
        <li
          className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-2.5 text-sm @md:grid-cols-[minmax(0,1fr)_40%_7.5rem]"
          key={row.key}
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{row.name}</span>
            {row.note ? (
              <span className="text-muted-foreground truncate text-xs">{row.note}</span>
            ) : null}
          </span>
          <Meter className="order-last col-span-2 @md:order-0 @md:col-span-1">
            <MeterFill share={largest > 0 ? row.value / largest : 0} />
          </Meter>
          <span className="text-compact text-right font-mono whitespace-nowrap tabular-nums">
            {row.display}
          </span>
        </li>
      ))}
    </ul>
  );
}
