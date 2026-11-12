import { AdminTableRow } from "@/components/admin-table-row";
// Review-pack mocks only: static pictures of proposed pages, built from the shared components.
// Remove this folder and every `mock` route before the redesign lands.
import { Table, TableBody, TableCell, TableHead, TableHeader } from "@zoonk/ui/components/table";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon } from "lucide-react";

export type MockOption = { reason?: string; right?: boolean; share?: string; text: string };

export function MockOptions({ options }: { options: MockOption[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {options.map((option) => (
        <li className="flex items-start gap-2.5" key={option.text}>
          {option.right ? (
            <CheckIcon
              aria-label="Right answer"
              className="text-success-text mt-1 size-4 shrink-0"
            />
          ) : (
            <span
              aria-hidden="true"
              className="border-input mt-1 size-4 shrink-0 rounded-full border"
            />
          )}
          <span className="flex min-w-0 flex-col">
            <span className={option.right ? "font-medium" : undefined}>{option.text}</span>
            {option.reason ? (
              <span className="text-muted-foreground text-[0.8125rem] leading-5">
                {option.reason}
              </span>
            ) : null}
          </span>
          {option.share ? (
            <span className="text-muted-foreground ml-auto shrink-0 pl-4 font-mono text-xs tabular-nums">
              {option.share}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export type MockColumn = { align?: "right"; label: string };

export function MockTable({
  columns,
  rows,
}: {
  columns: MockColumn[];
  rows: { cells: React.ReactNode[]; key: string }[];
}) {
  return (
    <Table>
      <TableHeader>
        <AdminTableRow>
          {columns.map((column) => (
            <TableHead className={column.align === "right" ? "text-right" : ""} key={column.label}>
              {column.label}
            </TableHead>
          ))}
        </AdminTableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <AdminTableRow key={row.key}>
            {row.cells.map((cell, index) => (
              <TableCell
                className={cn(
                  columns[index]?.align === "right" && "text-right tabular-nums",
                  index > 0 && "text-muted-foreground",
                )}
                // oxlint-disable-next-line react/no-array-index-key -- A static mock table.
                key={index}
              >
                {cell}
              </TableCell>
            ))}
          </AdminTableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function MockLink({ children }: { children: React.ReactNode }) {
  return (
    <a className="underline decoration-1 underline-offset-3" href="#">
      {children}
    </a>
  );
}

export function MockMore({ children }: { children: React.ReactNode }) {
  return (
    <a
      className="text-muted-foreground hover:text-foreground text-[0.8125rem] font-medium"
      href="#"
    >
      {children}
    </a>
  );
}
