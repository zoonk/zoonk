"use client";

import { type MockResult } from "@zoonk/core/exams/mocks/contract";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  StepCard,
  StepDetail,
  StepHeader,
  StepTitle,
  StepTitleLabel,
  StepTitleNumber,
} from "../_components/step-card";
import { Steps, type StepsItem } from "../_components/steps";
import { TaskAsideSection } from "../_components/task-layout";
import { hasShareMoved } from "../_utils/share-moved";
import { DayMoment } from "../session/day-moment";
import { getCeremonyMoment } from "../session/moment-ceremony";
import { type TaskFrameAside } from "../shell/task-frame";
import { useMockScreen } from "./mock-context";
import { useMockNumber, useMockTitle } from "./mock-labels";
import { MockResultActions, MockResultSkip } from "./mock-result-actions";
import { MockResultBreakdown, hasBreakdown, useMockRange } from "./mock-result-breakdown";
import { MockResultDetails } from "./mock-result-details";
import { useEssayItems } from "./mock-result-essays";
import {
  MockPlanChange,
  MockPlanStep,
  type PlanChange,
  PreparationMeter,
  PreparationReadout,
  hasPlanChange,
  usePlanChange,
} from "./mock-result-plan";
import { reachedEveryMinimum, useMissedMinimum } from "./mock-result-points";
import { useSpeakingItems } from "./mock-result-speaking";
import { type MockResultPart, getResultAsideParts, getResultSteps } from "./mock-result-steps";
import { MockReviewDrawer, MockReviewSection } from "./mock-review";

type Area = MockResult["areas"][number];

/** The number the result leads with, and the one line that names it. */
function useScore(result: MockResult): { caption: string; value: string } {
  const t = useExtracted();
  const number = useMockNumber();
  const range = useMockRange();
  const { runner } = useMockScreen();
  const { examName } = runner.view;

  if (result.points) {
    return {
      caption: t("Points"),
      value: t("{correct} of {total}", {
        correct: number(result.points.earned),
        total: number(result.points.asked),
      }),
    };
  }

  if (result.irt) {
    return {
      caption: examName ? t("Estimated {exam} score", { exam: examName }) : t("Estimated score"),
      value: range(result.irt),
    };
  }

  if (result.net) {
    return {
      caption: t("Score out of {max}", { max: String(result.net.max) }),
      value: number(result.net.net),
    };
  }

  return {
    caption: t("Right answers"),
    value: t("{correct} of {total}", {
      correct: number(result.correct),
      total: String(result.total),
    }),
  };
}

function getAreaMeasure(area: Area): number {
  return area.score?.score ?? (area.total > 0 ? area.correct / area.total : 0);
}

/** One sentence on what the number means for the learner's next days, or nothing. */
function useVerdict(result: MockResult): string | null {
  const t = useExtracted();
  const ranked = result.areas.toSorted((a, b) => getAreaMeasure(b) - getAreaMeasure(a));
  const best = ranked[0];
  const worst = ranked.at(-1);

  if (reachedEveryMinimum(result.points)) {
    return t("You reached every minimum in this mock exam.");
  }

  if (!best || !worst || getAreaMeasure(best) === getAreaMeasure(worst)) {
    return null;
  }

  return t("Strongest: {best}. Work on: {worst}.", { best: best.name, worst: worst.name });
}

function DeltaLine({ result }: { result: MockResult }) {
  const t = useExtracted();
  const number = useMockNumber();
  const current = result.irt?.score ?? result.net?.net ?? null;

  // `previous` measures net answers, never points, so a points headline can't take its delta.
  if (current === null || result.previous === null || result.points) {
    return null;
  }

  const change = Math.round(current - result.previous);

  if (change === 0) {
    return null;
  }

  return (
    <p className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs tabular-nums [&>svg]:size-3.5 [&>svg]:shrink-0">
      {change > 0 ? <TrendingUpIcon aria-hidden="true" /> : <TrendingDownIcon aria-hidden="true" />}
      {change > 0
        ? t("+{change} since the last one", { change: number(change) })
        : t("{change} since the last one", { change: number(change) })}
    </p>
  );
}

function MockDayMoment() {
  const { buddy, runner } = useMockScreen();
  const { ceremony, missionMoment, reached } = runner.view;

  return (
    <DayMoment buddy={buddy} ceremony={ceremony} missionMoment={missionMoment} reached={reached} />
  );
}

function ScoreStep({ result }: { result: MockResult }) {
  const title = useMockTitle();
  const { runner } = useMockScreen();
  const score = useScore(result);
  const missed = useMissedMinimum(result.points);
  const verdict = useVerdict(result);

  return (
    <StepCard className="gap-8">
      <div className="flex w-full flex-col items-start gap-6">
        <StepHeader>
          <StepTitle className="flex flex-col items-start gap-1.5">
            <StepTitleLabel>{title(runner.view)}</StepTitleLabel>
            {missed ? (
              <span className="text-destructive-text text-balance">{missed.title}</span>
            ) : (
              <StepTitleNumber>{score.value}</StepTitleNumber>
            )}
          </StepTitle>
          <StepDetail className="text-sm">{missed ? missed.line : score.caption}</StepDetail>
          {!missed && <DeltaLine result={result} />}
        </StepHeader>

        {!missed && verdict && (
          <p className="text-reading font-medium text-pretty" data-slot="mock-verdict">
            {verdict}
          </p>
        )}

        <MockDayMoment />
      </div>

      {hasBreakdown(result) && <MockResultBreakdown result={result} />}

      <div className="flex flex-wrap items-center gap-2 empty:hidden">
        <MockResultDetails result={result} />
        <div className="contents lg:hidden">
          <MockReviewDrawer />
        </div>
      </div>

      <div className="contents max-lg:hidden">
        <MockReviewSection />
      </div>
    </StepCard>
  );
}

function useResultAside({
  change,
  has,
  preparation,
}: {
  change: PlanChange;
  has: Record<MockResultPart, boolean>;
  preparation: MockResult["preparation"];
}): TaskFrameAside | null {
  const t = useExtracted();

  if (getResultAsideParts(has).length === 0) {
    return null;
  }

  return {
    children: (
      <>
        {preparation && (
          <TaskAsideSection title={t("Your preparation")}>
            <p className="flex flex-col items-start gap-1.5 [&>span:first-child]:text-3xl">
              <PreparationReadout change={preparation} />
            </p>
            <PreparationMeter change={preparation} />
          </TaskAsideSection>
        )}

        {hasPlanChange(change) && (
          <TaskAsideSection title={t("Your plan")}>
            <MockPlanChange change={change} />
          </TaskAsideSection>
        )}
      </>
    ),
    label: t("After this mock exam"),
    title: t("After this mock exam"),
  };
}

/**
 * CSS picks between the phone's steps and the wide page, so the server already draws the one for
 * the screen's width.
 */
function useResultSteps(result: MockResult) {
  const { renderCeremony, runner } = useMockScreen();
  const essays = useEssayItems();
  const speaking = useSpeakingItems();
  const change = usePlanChange(runner.view.adapt);

  const preparation =
    result.preparation && hasShareMoved(result.preparation) ? result.preparation : null;

  const has: Record<MockResultPart, boolean> = {
    essays: essays.length > 0,
    plan: preparation !== null || hasPlanChange(change),
    score: result.total > 0 || (essays.length === 0 && speaking.length === 0),
    speaking: speaking.length > 0,
  };

  const aside = useResultAside({ change, has, preparation });

  const parts: Record<MockResultPart, StepsItem[]> = {
    essays,
    plan: [{ content: <MockPlanStep change={change} preparation={preparation} />, id: "plan" }],
    score: [{ content: <ScoreStep result={result} />, id: "score" }],
    speaking,
  };

  const [first, ...rest] = getResultSteps(has).flatMap((step) =>
    parts[step.part].map((item) => ({ ...item, beside: step.beside })),
  );

  const opening = first && {
    ...first,
    content: has.score ? (
      first.content
    ) : (
      <>
        {first.content}
        <MockDayMoment />
      </>
    ),
    moment: getCeremonyMoment({ moments: runner.view, render: renderCeremony }),
  };

  return { aside, items: opening ? [opening, ...rest] : [] };
}

function MockResultSteps({ result }: { result: MockResult }) {
  const { ask, hrefs } = useMockScreen();
  const { aside, items } = useResultSteps(result);

  return (
    <Steps
      aside={aside}
      ask={ask}
      exitHref={hrefs.exit}
      finalAction={
        <>
          <MockResultSkip />
          <MockResultActions />
        </>
      }
      items={items}
    />
  );
}

export function MockResultView() {
  const { runner } = useMockScreen();
  const { result } = runner.view;

  return result ? <MockResultSteps result={result} /> : null;
}
