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
            {content.columns.map((column, columnIndex) => (
              // oxlint-disable-next-line react/no-array-index-key -- AI-generated columns can have duplicate names
              <TableHead key={columnIndex} scope="col">
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {content.rows.map((row, rowIndex) => (
            // oxlint-disable-next-line react/no-array-index-key -- AI-generated tables can intentionally repeat the same row values
            <TableRow key={rowIndex}>
              {content.columns.map((column, columnIndex) => (
                // oxlint-disable-next-line react/no-array-index-key -- AI-generated columns can have duplicate names
                <TableCell className="whitespace-normal" key={columnIndex}>
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
