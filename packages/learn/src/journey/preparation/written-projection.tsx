"use client";

import { type WrittenProjection } from "@zoonk/core/exams/scoring/written-points-contract";
import { Button } from "@zoonk/ui/components/button";
import { MeterPart, MeterParts } from "@zoonk/ui/components/meter";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useFormatScore } from "../../essay/essay-labels";
import { useWriteNow } from "../../learn-context";
import { PointsReadout } from "../../writing/points-readout";
import { useFormatPointsRange } from "../../writing/writing-labels";

type Range = { high: number; low: number };

type Part = WrittenProjection["parts"][number];

const PERCENT = 100;

/** The range on the part's own scale, its minimum as a tick, and nothing drawn while unmeasured. */
function RangeMeter({
  max,
  minimum,
  range,
}: {
  max: number;
  minimum: number | null;
  range: Range | null;
}) {
  if (!range) {
    return <div className="border-border rounded-meter h-1.5 border border-dashed" />;
  }

  const low = range.low / max;
  const high = range.high / max;

  return (
    <div className="relative">
      <MeterParts>
        {low > 0 && <MeterPart className="bg-success" weight={low} />}
        {high > low && <MeterPart className="bg-success/40" weight={high - low} />}
        {high < 1 && <MeterPart weight={1 - high} />}
      </MeterParts>
      {minimum !== null && (
        <span
          aria-hidden="true"
          className="bg-foreground absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full"
          style={{ left: `${(minimum / max) * PERCENT}%` }}
        />
      )}
    </div>
  );
}

function ScoreRow({
  children,
  max,
  minimum = null,
  name,
  range,
}: {
  children?: React.ReactNode;
  max: number | null;
  minimum?: number | null;
  name: string;
  range: Range | null;
}) {
  const t = useExtracted();
  const formatRange = useFormatPointsRange();
  const formatScore = useFormatScore();

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
          {range && max !== null
            ? t("{range} of {max}", { max: formatScore(max), range: formatRange(range) })
            : t("Not measured yet")}
        </span>
      </p>
      {max !== null && <RangeMeter max={max} minimum={minimum} range={range} />}
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
        {t("Above the {minimum} points it asks for", { minimum: formatScore(minimum) })}
      </p>
    );
  }

  if (part.standing === "below") {
    const short = { high: minimum - part.range.low, low: minimum - part.range.high };

    return (
      <p className="text-destructive-text flex items-center gap-1.5 text-xs">
        <XIcon aria-hidden="true" className="size-3.5" />
        {t("{points} points below the {minimum} it asks for", {
          minimum: formatScore(minimum),
          points: formatRange(short),
        })}
      </p>
    );
  }

  return (
    <p className="text-warning-text text-xs">
      {t("Close to the {minimum} points it asks for", { minimum: formatScore(minimum) })}
    </p>
  );
}

function useHeadline(projection: WrittenProjection) {
  const t = useExtracted();
  const below = projection.parts.find(({ standing }) => standing === "below");

  const unmeasured = projection.parts.find(
    ({ standing, range }) => standing === "unmeasured" || !range,
  );

  if (below) {
    return {
      detail: below.minimum
        ? t("It asks for {minimum} points, whatever your other scores.", {
            minimum: String(below.minimum.value),
          })
        : null,
      title: t("Below the minimum: {part}", { part: below.name }),
    };
  }

  if (unmeasured) {
    return { detail: t("{part} isn't measured yet.", { part: unmeasured.name }), title: null };
  }

  return null;
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
  const needsWriting = headline !== null;

  return (
    <section className="flex flex-col gap-3" data-slot="written-projection">
      <div className="flex flex-col gap-1">
        <span className="text-label">{t("Estimated score")}</span>
        {projection.combined && projection.max !== null && !headline?.title && (
          <PointsReadout max={projection.max} range={projection.combined} />
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
            key={part.name}
            max={part.max}
            minimum={part.minimum?.value ?? null}
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
