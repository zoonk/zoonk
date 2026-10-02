"use client";

import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { Progress } from "@zoonk/ui/components/progress";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheckIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { SectionLabel } from "../_components/section-label";
import { useFormatShare } from "../_utils/percent";
import { PracticeNowButton } from "./practice-now-button";
import { type ProgressAreaRow, useProgressAreas } from "./use-progress-areas";
import { useWeekGainText } from "./use-share-delta";

const PERCENT = 100;

/** What's left in an area, with a check once nothing is. */
export function AreaDetail({ row }: { row: ProgressAreaRow }) {
  const t = useExtracted();

  return (
    <span className="text-muted-foreground in-data-[mode=fun]:text-fun-fg2 flex min-w-0 items-start gap-1 text-xs">
      {row.isDone && (
        <LineMarker aria-hidden="true">
          <CircleCheckIcon className="text-success in-data-[mode=fun]:text-fun-accent-lime size-3.5" />
        </LineMarker>
      )}
      <span>
        {row.isDone && <span className="sr-only">{t("Done:")} </span>}
        {row.detail}
      </span>
    </span>
  );
}

/** "Show 9 more areas": the rest of a big goal's areas, one tap away. */
export function ShowMoreAreas({
  className,
  count,
  onClick,
}: {
  className?: string;
  count: number;
  onClick: () => void;
}) {
  const t = useExtracted();

  if (count === 0) {
    return null;
  }

  return (
    <Button className={cn("w-fit", className)} onClick={onClick} size="sm" variant="outline">
      {t("{count, plural, one {Show # more area} other {Show # more areas}}", { count })}
    </Button>
  );
}

function AreaRow({ row }: { row: ProgressAreaRow }) {
  const t = useExtracted();
  const locale = useLocale();
  const formatShare = useFormatShare();
  const weekGainText = useWeekGainText();
  const gain = weekGainText(row.weekGain);

  return (
    <li
      className="flex flex-col gap-2 p-4"
      data-done={row.isDone || undefined}
      data-weakest={row.isWeakest || undefined}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{row.title}</span>
        {row.preparation !== null && (
          <span className="text-sm font-semibold tabular-nums">{formatShare(row.preparation)}</span>
        )}
      </div>
      {row.preparation !== null && (
        <Progress
          locale={locale}
          aria-label={row.title}
          className="**:data-[slot=progress-track]:h-1.5"
          value={row.preparation * PERCENT}
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <AreaDetail row={row} />
        {gain && (
          <span
            className={cn(
              "shrink-0 text-xs font-medium",
              row.weekGain > 0 ? "text-success" : "text-muted-foreground",
            )}
          >
            {gain}
          </span>
        )}
      </div>
      {row.next && <p className="text-muted-foreground text-xs">{row.next}</p>}
      {row.isWeakest && (
        <div className="bg-muted mt-1 flex items-center justify-between gap-3 rounded-xl p-2 pl-3">
          <span className="text-muted-foreground text-sm">{t("Where you can gain the most")}</span>
          <PracticeNowButton areaId={row.areaId} />
        </div>
      )}
    </li>
  );
}

/**
 * Focus: each area once, with its preparation and what's still needed to reach the goal there,
 * under the whole goal's summary and the bar its skills must reach.
 */
export function ProgressAreas() {
  const t = useExtracted();
  const areas = useProgressAreas();

  if (!areas.visible) {
    return null;
  }

  return (
    <section aria-labelledby="progress-areas-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <SectionLabel id="progress-areas-title">{t("Your areas")}</SectionLabel>
        <p className="text-sm">{areas.summary}</p>
        <p className="text-muted-foreground text-xs">{areas.rule}</p>
      </div>
      <ul className="bg-card ring-foreground/10 flex flex-col divide-y rounded-2xl ring-1">
        {areas.rows.map((row) => (
          <AreaRow key={row.areaId} row={row} />
        ))}
      </ul>
      <ShowMoreAreas count={areas.hiddenCount} onClick={areas.showAll} />
    </section>
  );
}
