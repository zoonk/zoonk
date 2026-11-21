"use client";

import { type MockResult } from "@zoonk/core/exams/mocks/contract";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  LabeledStepTitle,
  StepCard,
  StepDetail,
  StepHeader,
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
import { MockResultActions, MockResultContinue } from "./mock-result-actions";
import { MockResultAnswers, hasAnswerCounts } from "./mock-result-answers";
import { MockResultBreakdown, hasBreakdown, useMockRange } from "./mock-result-breakdown";
import { MockResultDetails } from "./mock-result-details";
import { useEssayItems } from "./mock-result-essays";
import {
  MockPlanAccept,
  MockPlanChange,
  MockPlanDecline,
  MockPlanStep,
  type PlanChange,
  PreparationMeter,
  PreparationReadout,
  hasPlanChange,
  usePlanChange,
} from "./mock-result-plan";
import { useMissedMinimum } from "./mock-result-points";
import { ResultSection } from "./mock-result-section";
import { useSpeakingItems } from "./mock-result-speaking";
import { type MockResultPart, getResultAsideParts, getResultSteps } from "./mock-result-steps";
import { MockReview } from "./mock-review";
import { useMockVerdict } from "./use-mock-verdict";

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
      caption: examName
        ? t({
            description:
              "Over a score range on a mock exam's result. The exam's name goes last, after the separator, with no article before it.",
            id: "estimatedScoreNamedExam",
            message: "Estimated score · {exam}",
            values: { exam: examName },
          })
        : t("Estimated score"),
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

function hasSummary(result: MockResult): boolean {
  return hasAnswerCounts(result) || hasBreakdown(result);
}

/**
 * What supports the number: how the answers went and each subject's share of it. Beside the page
 * on a wide screen, and before the questions under it.
 */
function MockResultSummary({ result }: { result: MockResult }) {
  const t = useExtracted();

  return (
    <>
      {hasAnswerCounts(result) && (
        <ResultSection title={t("Answers")}>
          <MockResultAnswers result={result} />
        </ResultSection>
      )}
      {hasBreakdown(result) && <MockResultBreakdown result={result} />}
    </>
  );
}

function ScoreStep({ result }: { result: MockResult }) {
  const title = useMockTitle();
  const { runner } = useMockScreen();
  const score = useScore(result);
  const missed = useMissedMinimum(result.points);
  const verdict = useMockVerdict({ result, verdict: runner.view.verdict });

  return (
    <StepCard className="gap-8">
      <div className="flex w-full flex-col items-start gap-6">
        <StepHeader>
          <LabeledStepTitle label={title(runner.view)}>
            {missed ? (
              <span className="text-destructive-text text-balance">{missed.title}</span>
            ) : (
              <StepTitleNumber>{score.value}</StepTitleNumber>
            )}
          </LabeledStepTitle>
          <StepDetail className="text-sm">{missed ? missed.line : score.caption}</StepDetail>
          {!missed && <DeltaLine result={result} />}
        </StepHeader>

        {!missed && verdict && (
          <p className="text-reading font-medium" data-slot="mock-verdict">
            {verdict}
          </p>
        )}

        {/* A miss's headline isn't followed by a celebration; the day's summary still shows the belt. */}
        {!missed && <MockDayMoment />}
      </div>

      {hasSummary(result) && (
        <div className="with-aside:hidden flex w-full flex-col gap-8" data-slot="mock-summary">
          <MockResultSummary result={result} />
        </div>
      )}

      <MockReview
        review={runner.view.review}
        sections={runner.view.sections}
        trueFalseLabels={runner.view.trueFalseLabels}
      />
    </StepCard>
  );
}

function useResultAside({
  change,
  has,
  preparation,
  result,
}: {
  change: PlanChange;
  has: Record<MockResultPart, boolean>;
  preparation: MockResult["preparation"];
  result: MockResult;
}): TaskFrameAside | null {
  const t = useExtracted();
  const title = useMockTitle();
  const { runner } = useMockScreen();
  const summary = has.score && hasSummary(result);
  const after = getResultAsideParts(has).length > 0;

  if (!summary && !after) {
    return null;
  }

  return {
    children: (
      <>
        {summary && <MockResultSummary result={result} />}

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
    // Its blocks name themselves once the answers lead it, so the rail's own line would repeat them.
    label: summary ? title(runner.view) : t("After this mock exam"),
    title: summary ? undefined : t("After this mock exam"),
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

  const aside = useResultAside({ change, has, preparation, result });

  const parts: Record<MockResultPart, StepsItem[]> = {
    essays,
    plan: [
      {
        content: <MockPlanStep change={change} preparation={preparation} />,
        finalAction: hasPlanChange(change) && change.open && <MockPlanAccept change={change} />,
        finalSecondAction: hasPlanChange(change) && change.open && (
          <MockPlanDecline change={change} />
        ),
        id: "plan",
      },
    ],
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
      exitHref={hrefs.exit}
      finalAction={<MockResultActions />}
      finalSecondAction={<MockResultContinue />}
      headerEnd={<MockResultDetails result={result} />}
      items={items.map((item) => ({
        ...item,
        action: (
          <>
            {item.action}
            {ask}
          </>
        ),
      }))}
    />
  );
}

export function MockResultView() {
  const { runner } = useMockScreen();
  const { result } = runner.view;

  return result ? <MockResultSteps result={result} /> : null;
}
