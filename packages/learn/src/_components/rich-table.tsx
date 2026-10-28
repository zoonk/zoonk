import { cn } from "@zoonk/ui/lib/utils";
import { type MarkdownTableAlign } from "@zoonk/utils/markdown-table";

function getCellClass(align: MarkdownTableAlign | undefined) {
  return cn(
    "p-2 align-top first:ps-3 last:pe-3",
    align === "right" && "text-right tabular-nums",
    align === "center" && "text-center tabular-nums",
    (align === "left" || !align) && "text-left",
  );
}

export function RichTable<TCell>({
  align,
  className,
  header,
  label,
  renderCell,
  rows,
}: {
  align: readonly MarkdownTableAlign[];
  className?: string;
  header: readonly TCell[];
  label: string;
  renderCell: (cell: TCell) => React.ReactNode;
  rows: readonly (readonly TCell[])[];
}) {
  return (
    <div
      aria-label={label}
      className={cn(
        "border-border focus-visible:ring-ring/50 max-w-full overflow-x-auto rounded-xl border outline-none focus-visible:ring-[3px]",
        className,
      )}
      data-slot="rich-table"
      role="region"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- A wide table scrolls sideways, which needs focus by keyboard.
      tabIndex={0}
    >
      <table className="text-foreground w-full border-collapse text-sm leading-snug">
        <thead className="bg-muted">
          <tr>
            {header.map((cell, index) => {
              const key = `head-${index}`;

              return (
                <th
                  className={cn(getCellClass(align[index]), "font-semibold hyphens-auto")}
                  key={key}
                  scope="col"
                >
                  {renderCell(cell)}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => {
            const rowKey = `row-${rowIndex}`;

            return (
              <tr className="border-border border-t" key={rowKey}>
                {row.map((cell, index) => {
                  const key = `cell-${index}`;

                  return (
                    <td className={getCellClass(align[index])} key={key}>
                      {renderCell(cell)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
