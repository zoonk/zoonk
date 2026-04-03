"use client";

import { type TableVisualContent } from "@zoonk/core/steps/contract/visual";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";

export function TableVisual({ content }: { content: TableVisualContent }) {
  return (
    <figure aria-label={content.caption} className="w-full max-w-2xl">
      <Table>
        <TableHeader>
          <TableRow>
            {content.columns.map((column) => (
              <TableHead key={column} scope="col">
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {content.rows.map((row) => (
            <TableRow key={row.join("-")}>
              {content.columns.map((column, columnIndex) => (
                <TableCell className="whitespace-normal" key={column}>
                  {row[columnIndex]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {content.caption && (
        <figcaption className="text-muted-foreground mt-3 px-1 text-center text-sm">
          {content.caption}
        </figcaption>
      )}
    </figure>
  );
}
