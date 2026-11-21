"use client";

import { useExtracted, useFormatter } from "next-intl";
import { PageSection } from "../_components/page";
import { StepRow, StepRows } from "../_components/step-card";
import { useFormatScore } from "../essay/essay-labels";
import {
  MinimumLegend,
  PointsMeter,
  PointsReadout,
  getMinimumShare,
} from "../writing/points-readout";
import { useFormatPointsRange } from "../writing/writing-labels";
import { type WrittenSubject } from "./subject-written-score";

const PERCENT = 100;

/** What the written-practice contract will carry: the part's scale, and a levels answer's criteria. */
export type ScaledSubject = WrittenSubject & { decimals?: number; scale?: "levels" | "points" };

/**
 * Whether the part can be estimated in points. Until the server says (`scale`), an answer or a part
 * already measured in points says so; otherwise answers are graded by level, as every rubric is
 * until its evaluation passes.
 */
export function getWrittenScale(written: WrittenSubject): "levels" | "points" {
  const { scale } = written as ScaledSubject;

  if (scale) {
    return scale;
  }

  return written.points.range || written.answers.some(({ range }) => range) ? "points" : "levels";
}

function useMinimumLine() {
  const t = useExtracted();
  const formatScore = useFormatScore();
  const format = useFormatter();

  return function minimumLine({
    max,
    minimum,
  }: Pick<WrittenSubject["points"], "max" | "minimum">): string | null {
    if (!minimum) {
      return null;
    }

    if (minimum.unit === "percent") {
      return t("Minimum to pass: {share} of the points", {
        share: format.number(minimum.value / PERCENT, {
          maximumFractionDigits: 0,
          style: "percent",
        }),
      });
    }

    return max === null
      ? t("Minimum to pass: {minimum}", { minimum: formatScore(minimum.value) })
      : t("Minimum to pass: {minimum} of {max}", {
          max: formatScore(max),
          minimum: formatScore(minimum.value),
        });
  };
}

/** No points estimate for this test yet: say how answers are graded instead of "not measured". */
function LevelsScale({ written }: { written: WrittenSubject }) {
  const t = useExtracted();
  const minimumLine = useMinimumLine()(written.points);

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-muted-foreground text-pretty">
        {t(
          "Your answers are graded by level. A points estimate isn't available for this test yet.",
        )}
      </p>
      {minimumLine && <p className="text-muted-foreground">{minimumLine}</p>}
    </div>
  );
}

/** The part's estimated points, its own minimum, and each question's share of them. */
function PointsScale({ written }: { written: WrittenSubject }) {
  const t = useExtracted();
  const formatScore = useFormatScore();
  const formatRange = useFormatPointsRange();
  const minimumLine = useMinimumLine();
  const { max, minimum, range, tasks } = written.points;
  const { decimals } = written as ScaledSubject;

  return (
    <>
      <div className="flex flex-col gap-3">
        {range && max !== null ? (
          <PointsReadout decimals={decimals} max={max} range={range} />
        ) : (
          <p className="text-lg font-semibold">{t("Not measured yet")}</p>
        )}
        {max !== null && (
          <PointsMeter
            max={max}
            minimumShare={minimum && getMinimumShare({ max, minimum })}
            range={range}
          />
        )}
        {minimum && <MinimumLegend>{minimumLine(written.points)}</MinimumLegend>}
      </div>
      <StepRows>
        {tasks.map((task) => (
          <StepRow key={task.key}>
            <span className="min-w-0 flex-1">{task.name}</span>
            <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
              {task.range && task.max !== null
                ? t("{range} of {max}", {
                    max: formatScore(task.max),
                    range: formatRange(task.range, { decimals }),
                  })
                : t("Not measured yet")}
            </span>
          </StepRow>
        ))}
      </StepRows>
    </>
  );
}

/**
 * Where the learner stands on the written part: its points when it can be estimated in points,
 * else how it's graded. The aside on a computer gives it its own title, as it does Preparation.
 */
export function WrittenStanding({ titled, written }: { titled: boolean; written: WrittenSubject }) {
  const t = useExtracted();
  const levels = getWrittenScale(written) === "levels";
  const title = levels ? t("Grading") : t("Estimated score");

  return (
    <PageSection aria-label={title}>
      {titled && !levels && <span className="text-muted-foreground text-sm">{title}</span>}
      {levels ? <LevelsScale written={written} /> : <PointsScale written={written} />}
    </PageSection>
  );
}
