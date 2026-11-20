"use client";

import { type MindMapOutline as Outline } from "@zoonk/core/mind-maps/contract";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zoonk/ui/components/table";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

const POINTS_CLASS = "text-muted-foreground text-reading flex list-disc flex-col gap-1 pl-5";

/** The things the map sets side by side, a column each, their points row by row. */
function Comparison({ comparison }: { comparison: NonNullable<Outline["comparison"]> }) {
  const t = useExtracted();
  const rows = Math.max(...comparison.columns.map((column) => column.points.length));

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-balance">{comparison.title}</h3>
      <Table
        scrollLabels={{ box: comparison.title, left: t("Scroll left"), right: t("Scroll right") }}
      >
        <TableHeader>
          <TableRow>
            {comparison.columns.map((column) => (
              <TableHead key={column.name}>{column.name}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, row) => (
            <TableRow key={row}>
              {comparison.columns.map((column) => (
                <TableCell className="align-top whitespace-normal" key={column.name}>
                  {column.points[row]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

/**
 * The map as text, a section per branch: its number and title, its line and its points, then the
 * comparison and the summary.
 */
export function MindMapOutline({
  className,
  outline,
  titled = false,
}: {
  className?: string;
  outline: Outline;
  /** Starts with the map's title, where nothing above the outline shows it whole. */
  titled?: boolean;
}) {
  const t = useExtracted();

  return (
    <div className={cn("flex flex-col gap-8", className)} data-slot="mind-map-outline">
      <div className="flex flex-col gap-1">
        {titled && <h2 className="text-lg font-semibold text-balance">{outline.title}</h2>}
        <p className="text-reading text-pretty">{outline.centralIdea}</p>
      </div>

      <ol className="flex flex-col gap-8">
        {outline.branches.map((branch, index) => (
          <li className="flex flex-col gap-2" key={branch.title}>
            <h3 className="flex items-baseline gap-2.5 text-base font-semibold text-balance">
              <span
                aria-hidden="true"
                className="text-muted-foreground font-mono text-sm font-medium tabular-nums"
              >
                {index + 1}
              </span>
              {branch.title}
            </h3>
            <p className="text-reading text-pretty">{branch.explanation}</p>
            {branch.points.length > 0 && (
              <ul className={POINTS_CLASS}>
                {branch.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>

      {outline.comparison && <Comparison comparison={outline.comparison} />}

      <p className="text-reading border-t pt-6 text-pretty">
        <span className="font-semibold">{t("In short:")}</span> {outline.summary}
      </p>
    </div>
  );
}
