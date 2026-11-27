"use client";

import { type WrittenProjection } from "@zoonk/core/exams/scoring/written-points-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useFormatScore } from "../essay/essay-labels";
import { getMinimumPoints } from "./minimum-points";

type Part = Pick<WrittenProjection["parts"][number], "max" | "minimum" | "range" | "standing">;

/**
 * A written part's estimate against its own minimum. Each verdict is "likely": it comes from how
 * closely graders' marks match the board's, never a promise, so it never says by how much; the
 * estimate beside it shows the gap. Without one, an estimate beside a minimum would read as a
 * pass, so the line says it can't tell.
 */
export function WrittenStandingLine({ className, part }: { className?: string; part: Part }) {
  const t = useExtracted();
  const formatScore = useFormatScore();
  const minimum = part.minimum && getMinimumPoints({ max: part.max, minimum: part.minimum });
  const { range, standing } = part;

  if (minimum === null || !range || !standing) {
    return null;
  }

  const line = cn("flex items-center gap-1 text-xs", className);
  const points = formatScore(minimum);

  if (standing === "met") {
    return (
      <p className={cn(line, "text-muted-foreground")}>
        <CheckIcon aria-hidden="true" className="size-3.5 shrink-0" />
        {t("Likely above the {minimum} points needed", { minimum: points })}
      </p>
    );
  }

  if (standing === "below") {
    return (
      <p className={cn(line, "text-destructive-text")}>
        <XIcon aria-hidden="true" className="size-3.5 shrink-0" />
        {t("Likely below the {minimum} points needed", { minimum: points })}
      </p>
    );
  }

  if (standing === "overlaps") {
    return (
      <p className={cn(line, "text-warning-text")}>
        <TriangleAlertIcon aria-hidden="true" className="size-3.5 shrink-0" />
        {t("Could be either side of the {minimum} points needed", { minimum: points })}
      </p>
    );
  }

  return (
    <p className={cn(line, "text-muted-foreground")}>
      {t("Can't say yet whether this reaches the {minimum} points needed", { minimum: points })}
    </p>
  );
}
