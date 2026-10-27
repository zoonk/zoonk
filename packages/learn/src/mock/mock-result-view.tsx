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
import { MissionMoment } from "../missions/mission-moment";
import { ReachedMoment } from "../session/reached-moment";
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

/** The score in the exam's own terms: estimated range (ENEM), net score (Cebraspe) or right answers. */
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
      // A fractional penalty leaves decimals: "10,75" in Portuguese.
      value: format.number(result.net.net, { maximumFractionDigits: 2 }),
    };
  }

  return {
    label: t("Right answers"),
    value: t("{correct} of {total}", {
      // Partial credit for several picks leaves decimals: "2,25" in Portuguese.
      correct: format.number(result.correct, { maximumFractionDigits: 2 }),
      total: String(result.total),
    }),
  };
}

/** "+16 since the last one", a mono line under the score; only when there was one and it moved. */
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

/**
 * What it takes to pass, in the notice's own words, beside the score of a mock of the whole exam,
 * saying its language when it isn't the learner's.
 */
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

/**
 * What the mock did to the learner's day, as every block's moment says it: the day's missions,
 * its own and its speaking paper's calls', with the bonus when one of them did the last; then the
 * belt level and the tenth of Energy it reached. Nothing when it did none of that.
 */
function MockDayMoment() {
  const { buddy, runner } = useMockScreen();
  const { ceremony, missionMoment: moment, reached } = runner.view;

  return (
    <>
      {moment && (
        <MissionMoment
          buddy={buddy}
          completed={moment.completed}
          fullMeal={moment.fullMeal}
          missions={moment.missions}
        />
      )}
      <ReachedMoment buddy={buddy} ceremony={ceremony} reached={reached} />
    </>
  );
}

/** Up to this many areas, the score's line names them; past it, it counts them. */
const MAX_NAMED_AREAS = 3;

/**
 * The mock done: its score big, with the exam and its areas under it, the tiles of the answers it
 * comes from, what it takes to pass and what it did to the day's missions; then how each area went
 * and what the mock showed, as rows; from `lg`, the questions to review too, where a phone has them
 * a tap away; and last, where the mock's size comes from and what it leaves out.
 */
function ScoreStep({ result }: { result: MockResult }) {
  const t = useExtracted();
  const title = useMockTitle();
  const { runner } = useMockScreen();
  const score = useScore(result);
  const short = useMockShortLine(runner.view);
  const hasInsights = useHasInsights();

  // A mock over every subject counts them: the rows under the score name each with its score.
  const areas =
    result.areas.length > MAX_NAMED_AREAS
      ? t("{count, plural, one {# subject} other {# subjects}}", { count: result.areas.length })
      : result.areas.map((area) => area.name).join(", ");

  const detail = [score.label, runner.view.examName, areas].filter(Boolean).join(" · ");

  return (
    <StepCard className="gap-8">
      <div className="flex w-full flex-col items-start gap-5">
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

/**
 * Beside a wide screen's result: how preparation moved, the change the mock offers for the plan
 * (applied or not right there) and what's next; null when the result has none of them.
 */
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
            <p className="font-mono text-3xl font-medium tracking-[-0.03em] tabular-nums">
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

/**
 * The result's steps, each only when it has something to say (`getResultSteps`): on a phone the
 * score (with the questions a tap away), the essays of a full mock's written part (graded right
 * after hand-in, so the score never waits for them), its speaking paper, the plan, and the
 * mistakes to review; from `lg`, where the aside holds the plan and what's next (`beside`), the
 * score's step is the whole page, the questions on it. CSS picks between the two, so the server
 * already draws the one for the screen's width. A placement mock's answers set where the plan
 * starts, so it offers no change and has no mistakes to review.
 */
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
    // A day that is all written or spoken has no questions to score: its essays or its speaking
    // paper are the result.
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
        // The questions are a tap away on a phone, under Continue as "Not now" is under the last
        // step's action; from `lg` they're on the score's page.
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

  // The score says what the mock did to the day under it; a day of only essays or speaking says it
  // last on its first step. A milestone it earned opens before that first step.
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
    moment:
      ceremony && renderCeremony
        ? (close: () => void) => renderCeremony(ceremony, close)
        : undefined,
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

/**
 * The result in the exam's own terms (a range where it's an estimate): on a phone, at most three
 * steps (the score with each area and what the mock showed, the plan, the mistakes to review),
 * plus the essays and the speaking paper when the mock had them; from `lg`, one page with the
 * questions on it and the plan and what's next beside it.
 */
export function MockResultView() {
  const { runner } = useMockScreen();
  const { result } = runner.view;

  return result ? <MockResultSteps result={result} /> : null;
}
