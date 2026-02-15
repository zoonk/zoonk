"use client";

import {
  type SupportedVisualKind,
  type VisualContentByKind,
  tableVisualContentSchema,
} from "@zoonk/core/steps/visual-content-contract";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";

export function TableVisual({ content }: { content: VisualContentByKind[SupportedVisualKind] }) {
  const parsed = tableVisualContentSchema.parse(content);

  return (
    <figure aria-label={parsed.caption} className="w-full max-w-2xl">
      <Table>
        <TableHeader>
          <TableRow>
            {parsed.columns.map((column) => (
              <TableHead key={column} scope="col">
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {parsed.rows.map((row) => (
            <TableRow key={row.join("-")}>
              {parsed.columns.map((column, columnIndex) => (
                <TableCell className="whitespace-normal" key={column}>
                  {row[columnIndex]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {parsed.caption ? (
        <figcaption className="text-muted-foreground mt-3 px-1 text-center text-sm">
          {parsed.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
