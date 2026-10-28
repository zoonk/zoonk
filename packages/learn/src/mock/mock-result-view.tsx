"use client";

import { type MockResult } from "@zoonk/core/exams/mocks/contract";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
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
import { usePassMarksNote } from "../_utils/use-pass-marks-note";
import { DayMoment } from "../session/day-moment";
import { getCeremonyMoment } from "../session/moment-ceremony";
import { type TaskFrameAside } from "../shell/task-frame";
import { useMockScreen } from "./mock-context";
import { useMockTitle } from "./mock-labels";
import { MockLeftOutNote, MockScoreNote, useMockShortLine } from "./mock-notes";
import {
  MockNextRow,
  MockNextStep,
  MockResultActions,
  MockResultOptions,
  useMistakeCount,
} from "./mock-result-actions";
import { MockResultAnswers } from "./mock-result-answers";
import { MockResultBreakdown, hasBreakdown, useMockRange } from "./mock-result-breakdown";
import { useEssayItems } from "./mock-result-essays";
import { MockResultInsights, useHasInsights } from "./mock-result-insights";
import {
  MockPlanChange,
  MockPlanStep,
  type PlanChange,
  PreparationMeter,
  PreparationNumbers,
  hasPlanChange,
  usePlanChange,
} from "./mock-result-plan";
import { useSpeakingItems } from "./mock-result-speaking";
import { type MockResultPart, getResultAsideParts, getResultSteps } from "./mock-result-steps";
import { MockReviewDrawer, MockReviewSection } from "./mock-review";
import { MockSizeNote } from "./mock-size-note";

function useScore(result: MockResult): { label: string; value: string } {
  const t = useExtracted();
  const format = useFormatter();
  const range = useMockRange();

  if (result.irt) {
    return { label: t("Estimated score"), value: range(result.irt) };
  }

  if (result.net) {
    return {
      label: t("Net score out of {max}", { max: String(result.net.max) }),
      value: format.number(result.net.net, { maximumFractionDigits: 2 }),
    };
  }

  return {
    label: t("Right answers"),
    value: t("{correct} of {total}", {
      correct: format.number(result.correct, { maximumFractionDigits: 2 }),
      total: String(result.total),
    }),
  };
}

function DeltaLine({ result }: { result: MockResult }) {
  const t = useExtracted();
  const current = result.irt?.score ?? result.net?.net ?? null;

  if (current === null || result.previous === null || current === result.previous) {
    return null;
  }

  const change = Math.round(current - result.previous);

  return (
    <p className="text-muted-foreground flex items-center gap-1.5 font-mono text-xs tabular-nums [&>svg]:size-3.5 [&>svg]:shrink-0">
      {change > 0 ? <TrendingUpIcon aria-hidden="true" /> : <TrendingDownIcon aria-hidden="true" />}
      {change > 0
        ? t("+{change} since the last one", { change: String(change) })
        : t("{change} since the last one", { change: String(change) })}
    </p>
  );
}

function PassMarks() {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const { passMarks } = runner.view;
  const note = usePassMarksNote(passMarks);

  if (!passMarks) {
    return null;
  }

  return (
    <div className="border-border flex w-full flex-col gap-1 border-t pt-3 text-left text-sm">
      <p className="font-medium">
        {t(
          "{document, select, notice {To pass, the notice says} other {To pass, the official guide says}}",
          { document: runner.view.examDocument },
        )}
      </p>
      {passMarks.texts.map((text) => (
        <p className="text-muted-foreground" key={text} lang={passMarks.language}>
          {text}
        </p>
      ))}
      {note && <p className="text-muted-foreground">{note}</p>}
    </div>
  );
}

function MockDayMoment() {
  const { buddy, runner } = useMockScreen();
  const { ceremony, missionMoment, reached } = runner.view;

  return (
    <DayMoment buddy={buddy} ceremony={ceremony} missionMoment={missionMoment} reached={reached} />
  );
}

const MAX_NAMED_AREAS = 3;

function ScoreStep({ result }: { result: MockResult }) {
  const t = useExtracted();
  const title = useMockTitle();
  const { runner } = useMockScreen();
  const score = useScore(result);
  const short = useMockShortLine(runner.view);
  const hasInsights = useHasInsights();

  const areas =
    result.areas.length > MAX_NAMED_AREAS
      ? t("{count, plural, one {# subject} other {# subjects}}", { count: result.areas.length })
      : result.areas.map((area) => area.name).join(", ");

  const detail = [score.label, runner.view.examName, areas].filter(Boolean).join(" · ");

  return (
    <StepCard className="gap-8">
      <div className="flex w-full flex-col items-start gap-6">
        <StepHeader>
          <StepTitle className="flex flex-col items-start gap-1.5">
            <StepTitleLabel>{t("{mock} done", { mock: title(runner.view) })}</StepTitleLabel>
            <StepTitleNumber>{score.value}</StepTitleNumber>
          </StepTitle>
          <StepDetail className="text-sm">{detail}</StepDetail>
          <DeltaLine result={result} />
        </StepHeader>

        <MockResultAnswers result={result} />
        <PassMarks />
        <MockScoreNote notes={runner.view.scoreNotes} />
        <MockDayMoment />
      </div>

      {hasBreakdown(result) && <MockResultBreakdown result={result} />}
      {hasInsights && <MockResultInsights />}
      <div className="contents max-lg:hidden">
        <MockReviewSection />
      </div>

      <div className="flex flex-col gap-1">
        <MockSizeNote
          document={runner.view.examDocument}
          size={{ minutes: runner.view.minutes, questions: runner.view.questions }}
          source={runner.view.sizeSource}
        />
        {short && <p className="text-muted-foreground text-xs">{short}</p>}
        <MockLeftOutNote leftOut={runner.view.leftOut} />
      </div>
    </StepCard>
  );
}

function useResultAside({
  change,
  has,
  mistakes,
  preparation,
}: {
  change: PlanChange;
  has: Record<MockResultPart, boolean>;
  mistakes: number;
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
            <p className="text-readout text-3xl">
              <PreparationNumbers change={preparation} />
            </p>
            <PreparationMeter change={preparation} />
          </TaskAsideSection>
        )}

        {hasPlanChange(change) && (
          <TaskAsideSection title={t("Your plan")}>
            <MockPlanChange change={change} />
          </TaskAsideSection>
        )}

        {has.next && (
          <TaskAsideSection title={t("Now")}>
            <MockNextRow count={mistakes} />
          </TaskAsideSection>
        )}
      </>
    ),
    label: t("After this mock exam"),
    title: t("After this mock exam"),
  };
}

/** CSS picks between the phone's steps and the wide page, so the server already draws the one for the screen's width. */
function useResultSteps(result: MockResult) {
  const { renderCeremony, runner } = useMockScreen();
  const { ceremony } = runner.view;
  const mistakes = useMistakeCount();
  const essays = useEssayItems();
  const speaking = useSpeakingItems();
  const change = usePlanChange(runner.view.adapt);

  const preparation =
    result.preparation && hasShareMoved(result.preparation) ? result.preparation : null;

  const has: Record<MockResultPart, boolean> = {
    essays: essays.length > 0,
    next: runner.view.purpose !== "placement" && mistakes > 0,
    plan: preparation !== null || hasPlanChange(change),
    score: result.total > 0 || (essays.length === 0 && speaking.length === 0),
    speaking: speaking.length > 0,
  };

  const aside = useResultAside({ change, has, mistakes, preparation });

  const parts: Record<MockResultPart, StepsItem[]> = {
    essays,
    next: [{ content: <MockNextStep count={mistakes} />, id: "next" }],
    plan: [{ content: <MockPlanStep change={change} preparation={preparation} />, id: "plan" }],
    score: [
      {
        content: <ScoreStep result={result} />,
        id: "score",
        option: (
          <div className="contents lg:hidden">
            <MockReviewDrawer />
          </div>
        ),
      },
    ],
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
    moment: getCeremonyMoment({ milestone: ceremony, render: renderCeremony }),
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
          <MockResultOptions placement="row" />
          <MockResultActions />
        </>
      }
      finalOptions={<MockResultOptions placement="under" />}
      items={items}
    />
  );
}

export function MockResultView() {
  const { runner } = useMockScreen();
  const { result } = runner.view;

  return result ? <MockResultSteps result={result} /> : null;
}
