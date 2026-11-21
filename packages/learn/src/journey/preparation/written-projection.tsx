"use client";

import { type WrittenProjection } from "@zoonk/core/exams/scoring/written-points-contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useState } from "react";
import { useFormatScore } from "../../essay/essay-labels";
import { useWriteNow } from "../../learn-context";
import { PointsMeter, PointsReadout, getMinimumShare } from "../../writing/points-readout";
import { useFormatPointsRange } from "../../writing/writing-labels";

type Range = { high: number; low: number };

type Part = WrittenProjection["parts"][number];

const PERCENT = 100;
const HALF = 0.5;

/** A server from before `scale` says a part is in points by having measured it in points. */
function getPartScale(part: Part): "levels" | "points" {
  return part.scale ?? (part.range ? "points" : "levels");
}

function ScoreRow({
  children,
  decimals,
  levels = false,
  max,
  minimumShare = null,
  name,
  range,
}: {
  children?: React.ReactNode;
  decimals?: number;
  /** Graded by level: no points to wait for, so no meter holds their place. */
  levels?: boolean;
  max: number | null;
  minimumShare?: number | null;
  name: string;
  range: Range | null;
}) {
  const t = useExtracted();
  const formatRange = useFormatPointsRange();
  const formatScore = useFormatScore();

  const value = () => {
    if (range && max !== null) {
      return t("{range} of {max}", {
        max: formatScore(max),
        range: formatRange(range, { decimals }),
      });
    }

    return levels ? t("Graded by level") : t("Not measured yet");
  };

  return (
    <div className="flex flex-col gap-2 py-3" data-slot="score-row">
      <p className="flex items-baseline justify-between gap-4 text-sm">
        <span className="font-medium">{name}</span>
        <span
          className={cn(
            "font-mono text-xs tabular-nums",
            !range && "text-muted-foreground font-sans",
          )}
        >
          {value()}
        </span>
      </p>
      {max !== null && !(levels && !range) && (
        <PointsMeter max={max} minimumShare={minimumShare} range={range} />
      )}
      {children}
    </div>
  );
}

/** Said against the part's own minimum, never the objective's: 50 of 100 on the sum of its answers. */
function Standing({ part }: { part: Part }) {
  const t = useExtracted();
  const formatScore = useFormatScore();
  const formatRange = useFormatPointsRange();
  const minimum = part.minimum?.value;

  if (minimum === undefined || !part.range || part.standing === "unmeasured" || !part.standing) {
    return null;
  }

  if (part.standing === "met") {
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <CheckIcon aria-hidden="true" className="text-success-text size-3.5" />
        {t("Above the {minimum} points needed", { minimum: formatScore(minimum) })}
      </p>
    );
  }

  if (part.standing === "below") {
    const short = { high: minimum - part.range.low, low: minimum - part.range.high };

    return (
      <p className="text-destructive-text flex items-center gap-1.5 text-xs">
        <XIcon aria-hidden="true" className="size-3.5" />
        {t("{points} points short of the {minimum} needed", {
          minimum: formatScore(minimum),
          points: formatRange(short, { decimals: part.decimals }),
        })}
      </p>
    );
  }

  return (
    <p className="text-warning-text flex items-center gap-1.5 text-xs">
      <TriangleAlertIcon aria-hidden="true" className="size-3.5" />
      {t("Close to the {minimum} points needed", { minimum: formatScore(minimum) })}
    </p>
  );
}

function useHeadline(projection: WrittenProjection) {
  const t = useExtracted();
  const format = useFormatter();
  const formatScore = useFormatScore();

  const minimumDetail = ({
    minimum,
    part,
  }: {
    minimum: NonNullable<WrittenProjection["parts"][number]["minimum"]>;
    part: string;
  }) =>
    minimum.unit === "percent"
      ? t("{part} asks for {share} of its points, whatever your other scores.", {
          part,
          share: format.number(minimum.value / PERCENT, {
            maximumFractionDigits: 0,
            style: "percent",
          }),
        })
      : t("{part} asks for {minimum} points, whatever your other scores.", {
          minimum: formatScore(minimum.value),
          part,
        });

  const below = projection.parts.find(({ standing }) => standing === "below");

  // A part graded by level has no points to wait for, so the headline doesn't say it's waiting.
  const unmeasured = projection.parts.find(
    (part) => getPartScale(part) === "points" && (part.standing === "unmeasured" || !part.range),
  );

  // A part's name comes from the notice, so it opens a sentence rather than sitting inside one.
  if (below) {
    return {
      detail: below.minimum && minimumDetail({ minimum: below.minimum, part: below.name }),
      title: t("Below the minimum to pass"),
    };
  }

  if (!unmeasured) {
    return null;
  }

  const share = unmeasured.max && projection.max ? unmeasured.max / projection.max : null;

  if (share === HALF) {
    return {
      detail: t("{part}, half your final score, isn't measured yet.", { part: unmeasured.name }),
      title: null,
    };
  }

  return {
    detail: share
      ? t("{part}, {share} of your final score, isn't measured yet.", {
          part: unmeasured.name,
          share: format.number(share, { maximumFractionDigits: 0, style: "percent" }),
        })
      : t("{part} isn't measured yet.", { part: unmeasured.name }),
    title: null,
  };
}

function WriteAction({ goalId }: { goalId: string }) {
  const t = useExtracted();
  const writeNow = useWriteNow();
  const [busy, setBusy] = useState(false);

  if (!writeNow) {
    return null;
  }

  return (
    <Button
      busy={busy}
      className="w-full"
      onClick={async () => {
        setBusy(true);
        const opened = await writeNow({ goalId });

        if (!opened) {
          setBusy(false);
        }
      }}
      size="lg"
    >
      {t("Write")}
    </Button>
  );
}

/**
 * The exam's projected score with its written part: a total once every part is measured, the part
 * still missing or below its own minimum otherwise. Never 0, never the objective's percent copied.
 */
export function WrittenProjectionScore({
  goalId,
  projection,
  source,
}: {
  goalId: string;
  projection: WrittenProjection;
  source: string | null;
}) {
  const t = useExtracted();
  const headline = useHeadline(projection);
  const needsWriting = projection.parts.some((part) => !part.range || part.standing === "below");

  return (
    <section className="flex flex-col gap-3" data-slot="written-projection">
      <div className="flex flex-col gap-1">
        <span className="text-label">{t("Estimated score")}</span>
        {projection.combined && projection.max !== null && !headline?.title && (
          <PointsReadout decimals={0} max={projection.max} range={projection.combined} />
        )}
        {headline?.title && <p className="text-lg font-semibold text-balance">{headline.title}</p>}
        {headline?.detail && (
          <p className="text-muted-foreground text-sm text-pretty">{headline.detail}</p>
        )}
      </div>

      <div className="flex flex-col [&>div+div]:border-t">
        <ScoreRow
          max={projection.objectiveMax}
          name={t("Objective test")}
          range={projection.objective}
        >
          {projection.objective && source && (
            <p className="text-muted-foreground text-xs">{source}</p>
          )}
        </ScoreRow>
        {projection.parts.map((part) => (
          <ScoreRow
            decimals={part.decimals}
            key={part.name}
            levels={getPartScale(part) === "levels"}
            max={part.max}
            minimumShare={part.minimum && getMinimumShare({ max: part.max, minimum: part.minimum })}
            name={part.name}
            range={part.range}
          >
            <Standing part={part} />
          </ScoreRow>
        ))}
      </div>

      {needsWriting && <WriteAction goalId={goalId} />}
    </section>
  );
}
