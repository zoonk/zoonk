"use client";

import { type MindMapOutline as Outline } from "@zoonk/core/mind-maps/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";

const POINTS_CLASS = "text-muted-foreground flex list-disc flex-col gap-1 pl-5 text-sm";

function Comparison({ comparison }: { comparison: NonNullable<Outline["comparison"]> }) {
  return (
    <section aria-label={comparison.title} className="flex flex-col gap-2">
      <p className="text-muted-foreground text-[0.8125rem] font-medium">{comparison.title}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {comparison.columns.map((column) => (
          <li className="flex flex-col gap-1" key={column.name}>
            <span className="text-sm font-medium">{column.name}</span>
            <ul className={POINTS_CLASS}>
              {column.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A mind map in words, for screen readers and as the map itself when its picture is missing: the
 * title and central idea, the numbered branches with their explanation and points, the comparison
 * and the summary line.
 */
export function MindMapOutline({ className, outline }: { className?: string; outline: Outline }) {
  const t = useExtracted();

  return (
    <div className={cn("flex flex-col gap-5", className)} data-slot="mind-map-outline">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-balance">{outline.title}</h3>
        <p className="text-muted-foreground text-sm text-pretty">{outline.centralIdea}</p>
      </div>

      <ol className="flex flex-col gap-4">
        {outline.branches.map((branch, index) => (
          <li className="flex gap-3" key={branch.title}>
            <span
              aria-hidden="true"
              className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
            >
              {index + 1}
            </span>

            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium">{branch.title}</span>
              <p className="text-sm text-pretty">{branch.explanation}</p>
              {branch.points.length > 0 && (
                <ul className={POINTS_CLASS}>
                  {branch.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>

      {outline.comparison && <Comparison comparison={outline.comparison} />}

      <p className="text-sm text-pretty">
        <span className="font-medium">{t("In short:")}</span> {outline.summary}
      </p>
    </div>
  );
}
