"use client";

import { type WrittenProjection } from "@zoonk/core/exams/scoring/written-points-contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useFormatter } from "next-intl";
import { useState } from "react";
import { useFormatScore } from "../../essay/essay-labels";
import { useWriteNow } from "../../learn-context";
import { getMinimumPoints, getMinimumShare } from "../../writing/minimum-points";
import { PointsMeter, PointsReadout, usePointsEstimate } from "../../writing/points-readout";
import { useWritingTaskName } from "../../writing/writing-header";
import { useFormatPointsRange } from "../../writing/writing-labels";
import { WrittenStandingLine } from "../../writing/written-standing";
import { getProjectionWriteTask } from "./projection-write-task";

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
  written = false,
}: {
  children?: React.ReactNode;
  decimals?: number;
  /** Graded by level: no points to wait for, so no meter holds their place. */
  levels?: boolean;
  max: number | null;
  minimumShare?: number | null;
  name: string;
  range: Range | null;
  written?: boolean;
}) {
  const t = useExtracted();
  const estimate = usePointsEstimate();
  const formatRange = useFormatPointsRange();
  const formatScore = useFormatScore();

  const value = () => {
    if (range && max !== null) {
      if (written) {
        const { scale, score } = estimate({ decimals, max, range });
        return `${score} ${scale}`;
      }

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

/** Each question's share of a part with several, so one measured question shows before the rest. */
function TaskRows({ part }: { part: Part }) {
  const t = useExtracted();
  const formatRange = useFormatPointsRange();
  const formatScore = useFormatScore();
  const taskName = useWritingTaskName();

  if (part.tasks.length < 2) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-1">
      {part.tasks.map((task) => (
        <li className="flex items-baseline justify-between gap-4 text-xs" key={task.key}>
          <span className="text-muted-foreground min-w-0">
            {taskName({ task: task.writingTask, title: task.name })}
          </span>
          <span
            className={cn(
              "font-mono tabular-nums",
              !task.range && "text-muted-foreground font-sans",
            )}
          >
            {task.range && task.max !== null
              ? t("{range} of {max}", {
                  max: formatScore(task.max),
                  range: formatRange(task.range, { decimals: part.decimals ?? 0 }),
                })
              : t("Not measured yet")}
          </span>
        </li>
      ))}
    </ul>
  );
}

function useHeadline(projection: WrittenProjection) {
  const t = useExtracted();
  const format = useFormatter();
  const formatScore = useFormatScore();

  const minimumDetail = ({
    max,
    minimum,
    name,
  }: Pick<Part, "max" | "name"> & { minimum: NonNullable<Part["minimum"]> }) => {
    const points = getMinimumPoints({ max, minimum });

    return points === null
      ? t("{part} needs {share} of its points, whatever your other scores.", {
          part: name,
          share: format.number(minimum.value / PERCENT, {
            maximumFractionDigits: 0,
            style: "percent",
          }),
        })
      : t("{part} needs {minimum} points, whatever your other scores.", {
          minimum: formatScore(points),
          part: name,
        });
  };

  const below = projection.parts.find(({ standing }) => standing === "below");

  // A part graded by level has no points to wait for, and one with an estimate says on its own row
  // whether it reaches its minimum, so the headline names only a part with no estimate yet.
  const unmeasured = projection.parts.find(
    (part) => getPartScale(part) === "points" && !part.range,
  );

  // A part's name comes from the notice, so it opens a sentence rather than sitting inside one.
  if (below) {
    return {
      detail: below.minimum && minimumDetail({ ...below, minimum: below.minimum }),
      title: t("Likely below the minimum to pass"),
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

function WriteAction({ goalId, taskKey }: { goalId: string; taskKey?: string }) {
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
        const opened = await writeNow({ goalId, taskKey });

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
  const write = getProjectionWriteTask(projection);
  // The headline already says this part is likely below its minimum.
  const below = projection.parts.find(({ standing }) => standing === "below");

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
            written
          >
            {getPartScale(part) === "points" && <TaskRows part={part} />}
            {part !== below && <WrittenStandingLine part={part} />}
          </ScoreRow>
        ))}
      </div>

      {write && <WriteAction goalId={goalId} taskKey={write.taskKey} />}
    </section>
  );
}
