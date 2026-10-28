"use client";

import { type MockResult } from "@zoonk/core/exams/mocks/contract";
import { ScaleIcon, TimerIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { StepRow, StepRows } from "../_components/step-card";
import { useMockScreen } from "./mock-context";
import { ResultSection } from "./mock-result-section";

type Area = MockResult["areas"][number];

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
        <h3 className="font-semibold">{title}</h3>
        <div className="text-muted-foreground flex flex-col gap-1">{children}</div>
      </div>
    </StepRow>
  );
}

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
          {t(
            "{seconds, plural, =0 {# seconds} one {# second} other {# seconds}} per {area} question. Aim for {target} or less.",
            {
              area: slowest.name,
              seconds: slowest.secondsPerQuestion,
              target: String(Math.round(slowest.targetSecondsPerQuestion ?? 0)),
            },
          )}
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
          "Sure: {sureRight, plural, =0 {# of {sureAnswered} right} one {# of {sureAnswered} right} other {# of {sureAnswered} right}}. Flagged as unsure: {unsureRight, plural, =0 {# of {unsureAnswered} right} one {# of {unsureAnswered} right} other {# of {unsureAnswered} right}}.",
          {
            sureAnswered: String(calibration.sure.answered),
            sureRight: calibration.sure.right,
            unsureAnswered: String(calibration.unsure.answered),
            unsureRight: calibration.unsure.right,
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

export function MockResultInsights() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const result = runner.view.result;

  if (!result) {
    return null;
  }

  return (
    <ResultSection title={t("What the mock exam showed")}>
      <StepRows>
        <TimingInsight result={result} />
        <ConsistencyInsight result={result} />
        <CalibrationInsight result={result} />
      </StepRows>
    </ResultSection>
  );
}
