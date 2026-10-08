"use client";

import { type MockResult } from "@zoonk/core/exams/mocks/contract";
import { ScaleIcon, TimerIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { StepCard, StepRow, StepRows, StepTitle } from "../_components/step-card";
import { useMockScreen } from "./mock-context";

type Area = MockResult["areas"][number];

/** The area furthest over the exam's pace per question, if any went over. */
function findSlowestArea(areas: Area[]): (Area & { over: number }) | null {
  const slowest = areas
    .filter((area) => area.targetSecondsPerQuestion !== null)
    .map((area) => ({
      ...area,
      over: area.secondsPerQuestion - (area.targetSecondsPerQuestion ?? 0),
    }))
    .toSorted((first, second) => second.over - first.over)[0];

  return slowest && slowest.over > 0 ? slowest : null;
}

function Insight({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: typeof TimerIcon;
  title: string;
}) {
  return (
    <StepRow className="items-start">
      <Icon aria-hidden="true" className="text-muted-foreground mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="font-semibold">{title}</h2>
        <div className="text-muted-foreground flex flex-col gap-1">{children}</div>
      </div>
    </StepRow>
  );
}

/** The slowest area against the exam's pace, and the questions time ran out on. */
function TimingInsight({ result }: { result: MockResult }) {
  const t = useExtracted();
  const slowest = findSlowestArea(result.areas);

  if (!slowest && result.unansweredAtTimeout === 0) {
    return null;
  }

  return (
    <Insight icon={TimerIcon} title={t("Timing")}>
      {slowest && (
        <p>
          {t("{seconds} seconds per {area} question. Aim for {target} or less.", {
            area: slowest.name,
            seconds: String(slowest.secondsPerQuestion),
            target: String(Math.round(slowest.targetSecondsPerQuestion ?? 0)),
          })}
        </p>
      )}
      {result.unansweredAtTimeout > 0 && (
        <p>
          {t(
            "{count, plural, one {# question was} other {# questions were}} left when time ran out.",
            { count: result.unansweredAtTimeout },
          )}
        </p>
      )}
    </Insight>
  );
}

/** ENEM: easy questions missed next to hard ones right, which its scoring weighs against you. */
function ConsistencyInsight({ result }: { result: MockResult }) {
  const t = useExtracted();
  const { coherence } = result;

  if (!coherence || coherence.isCoherent) {
    return null;
  }

  return (
    <Insight icon={ScaleIcon} title={t("Consistency")}>
      <p>
        {t(
          "{easy, plural, one {# easy one} other {# easy ones}} wrong, {hard, plural, one {# hard one} other {# hard ones}} right. The score counts that against you: review the easy ones first.",
          { easy: coherence.easyWrong, hard: coherence.hardRight },
        )}
      </p>
    </Insight>
  );
}

/** Cebraspe: how often the learner is right when sure versus when they flagged a statement. */
function CalibrationInsight({ result }: { result: MockResult }) {
  const t = useExtracted();
  const { calibration } = result;

  if (!calibration || calibration.unsure.answered === 0) {
    return null;
  }

  return (
    <Insight icon={ScaleIcon} title={t("When to leave it blank")}>
      <p>
        {t(
          "Sure: {sureRight} of {sureAnswered} right. Flagged as unsure: {unsureRight} of {unsureAnswered} right.",
          {
            sureAnswered: String(calibration.sure.answered),
            sureRight: String(calibration.sure.right),
            unsureAnswered: String(calibration.unsure.answered),
            unsureRight: String(calibration.unsure.right),
          },
        )}
      </p>
      {calibration.advice === "blankUnsure" && (
        <p>
          {t(
            "Leaving the unsure ones blank would have added {points, plural, one {# point} other {# points}}.",
            { points: calibration.blankingGain },
          )}
        </p>
      )}
      {calibration.advice === "keepAnswering" && (
        <p>{t("Your unsure answers still earned points, so keep answering them.")}</p>
      )}
    </Insight>
  );
}

/** Whether the mock showed something to change: a slow area, an inconsistency, unsure answers. */
export function useHasInsights(): boolean {
  const { runner } = useMockScreen();
  const result = runner.view.result;

  if (!result) {
    return false;
  }

  return (
    findSlowestArea(result.areas) !== null ||
    result.unansweredAtTimeout > 0 ||
    (result.coherence !== null && !result.coherence.isCoherent) ||
    (result.calibration !== null && result.calibration.unsure.answered > 0)
  );
}

/** What the mock showed beyond the score, only what's worth changing: pace, consistency, blanks. */
export function MockResultInsights() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const result = runner.view.result;

  if (!result) {
    return null;
  }

  return (
    <StepCard>
      <StepTitle>{t("What the mock exam showed")}</StepTitle>
      <StepRows>
        <TimingInsight result={result} />
        <ConsistencyInsight result={result} />
        <CalibrationInsight result={result} />
      </StepRows>
    </StepCard>
  );
}
