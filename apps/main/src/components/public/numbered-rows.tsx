import { cn } from "@zoonk/ui/lib/utils";

type NumberedRow = {
  /** A line under the title, such as the first chapters of a level. */
  description?: string;
  id: string;
  /** The row's name: text, or a component that writes it (a plan phase's name). */
  title: React.ReactNode;
  /** A count or a length at the row's end. */
  trailing?: string;
};

/**
 * The highlight is drawn behind the row, a little past the list's edges, so the hairlines keep its
 * width; the ones touching it turn transparent (`divided-rows`). Rows touch each other, so each is
 * 44px tall to press, even with one line.
 */
const ROW_CLASS =
  "relative isolate flex items-start gap-3 py-3 before:pointer-events-none before:absolute before:-inset-x-2.5 before:inset-y-0.5 before:-z-10 before:rounded-[0.625rem] before:transition-colors";

const HIGHLIGHTED_ROW_CLASS = "before:bg-muted hover:before:bg-muted";

function NumberedRowContent({ number, row }: { number: number; row: NumberedRow }) {
  return (
    <>
      <span className="text-faint w-5 shrink-0 font-mono text-xs leading-5 tabular-nums">
        {number}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm leading-5 font-medium text-pretty">{row.title}</span>
        {row.description && (
          <span className="text-muted-foreground text-xs leading-snug text-pretty">
            {row.description}
          </span>
        )}
      </span>

      {row.trailing && (
        <span className="text-muted-foreground shrink-0 font-mono text-xs leading-5 whitespace-nowrap tabular-nums">
          {row.trailing}
        </span>
      )}
    </>
  );
}

/**
 * An outline as flat rows: a quiet mono number, the title and a count or a length at the end, with
 * a hairline between rows. Where the outline starts (`startId`) stands out on a soft fill.
 */
export function NumberedRows({ rows, startId }: { rows: NumberedRow[]; startId: string }) {
  return (
    <ol className="divided-rows flex flex-col">
      {rows.map((row, index) => {
        const highlighted = row.id === startId;

        return (
          <li data-highlighted={highlighted || undefined} key={row.id}>
            <div className={cn(ROW_CLASS, highlighted && HIGHLIGHTED_ROW_CLASS)}>
              <NumberedRowContent number={index + 1} row={row} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
