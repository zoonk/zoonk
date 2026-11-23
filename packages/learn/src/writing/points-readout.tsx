"use client";

import { MeterPart, MeterParts } from "@zoonk/ui/components/meter";
import { useExtracted } from "next-intl";
import { useFormatScore } from "../essay/essay-labels";
import { useFormatPointsRange } from "./writing-labels";

const PERCENT = 100;

type Range = { high: number; low: number };

export function usePointsEstimate() {
  const t = useExtracted();
  const formatRange = useFormatPointsRange();
  const formatScore = useFormatScore();

  return ({ decimals, max, range }: { decimals?: number; max: number; range: Range }) => ({
    scale: t("of {max}", { max: formatScore(max) }),
    score: formatRange(range, { decimals, kind: "estimate" }),
  });
}

/**
 * A block's one number: the range large, its scale small beside it ("54–61 of 100"). A headline
 * never claims more than its parts, so its ends round outward.
 */
export function PointsReadout({
  decimals,
  max,
  range,
}: {
  decimals?: number;
  max: number;
  range: Range;
}) {
  const { scale, score } = usePointsEstimate()({ decimals, max, range });

  return (
    <span className="flex items-baseline gap-2">
      <span className="text-readout text-[2.5rem] leading-none tabular-nums">{score}</span>
      <span className="text-muted-foreground text-sm font-normal">{scale}</span>
    </span>
  );
}

/**
 * The range on its scale: the sure part solid, the uncertain part light, and the minimum's tick.
 * With no range yet, a dashed outline holds its place.
 */
export function PointsMeter({
  max,
  minimumShare,
  range,
}: {
  max: number;
  minimumShare: number | null;
  range: Range | null;
}) {
  if (!range) {
    return <div className="border-border rounded-meter h-1.5 border border-dashed" />;
  }

  const low = Math.min(1, range.low / max);
  const high = Math.min(1, range.high / max);

  return (
    <div className="relative">
      <MeterParts>
        {low > 0 && <MeterPart className="bg-success" weight={low} />}
        {high > low && <MeterPart className="bg-success/40" weight={high - low} />}
        {high < 1 && <MeterPart weight={1 - high} />}
      </MeterParts>
      {minimumShare !== null && (
        <span
          aria-hidden="true"
          className="bg-foreground absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full"
          style={{ left: `${minimumShare * PERCENT}%` }}
        />
      )}
    </div>
  );
}

/** The tick's legend under a meter, marked as the tick is. */
export function MinimumLegend({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground flex items-start gap-2 text-xs">
      <span aria-hidden="true" className="bg-foreground mt-px h-3.5 w-0.5 shrink-0 rounded-full" />
      {children}
    </p>
  );
}
