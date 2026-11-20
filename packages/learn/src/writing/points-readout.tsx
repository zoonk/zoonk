"use client";

import { useExtracted } from "next-intl";
import { useFormatScore } from "../essay/essay-labels";
import { useFormatPointsRange } from "./writing-labels";

/** A block's one number: the range large, its scale small beside it ("54–61 of 100"). */
export function PointsReadout({
  max,
  range,
}: {
  max: number;
  range: { high: number; low: number };
}) {
  const t = useExtracted();
  const formatRange = useFormatPointsRange();
  const formatScore = useFormatScore();

  return (
    <p className="flex items-baseline gap-2">
      <span className="text-readout text-[2.5rem] leading-none tabular-nums">
        {formatRange(range)}
      </span>
      <span className="text-muted-foreground text-sm">
        {t("of {max}", { max: formatScore(max) })}
      </span>
    </p>
  );
}
