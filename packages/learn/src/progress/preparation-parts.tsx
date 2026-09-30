"use client";

import { Progress } from "@zoonk/ui/components/progress";
import { useExtracted, useLocale } from "next-intl";
import { useFormatShare } from "../_utils/percent";
import { usePreparationParts } from "./use-preparation-parts";

const PERCENT = 100;

/** Focus: each part of Preparation as a bar with the evidence behind it. */
export function PreparationParts() {
  const t = useExtracted();
  const locale = useLocale();
  const parts = usePreparationParts();
  const formatShare = useFormatShare();

  return (
    <ul className="bg-card ring-foreground/10 flex flex-col divide-y rounded-2xl ring-1">
      {parts.map((part) => (
        <li className="flex flex-col gap-2 p-4" data-part={part.key} key={part.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium">{part.label}</span>
            <span className="text-sm font-semibold tabular-nums">
              {part.value === null ? t("Not yet") : formatShare(part.value)}
            </span>
          </div>
          {part.value !== null && (
            <Progress
              locale={locale}
              aria-label={part.label}
              className="**:data-[slot=progress-track]:h-1.5"
              value={part.value * PERCENT}
            />
          )}
          <p className="text-muted-foreground text-xs">{part.evidence}</p>
        </li>
      ))}
    </ul>
  );
}
