"use client";

import { type MockResult } from "@zoonk/core/exams/mocks/contract";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { FactChip, FactChips } from "../_components/fact-chips";
import { KindTile } from "../_components/kind-tile";
import { Meter, MeterFill } from "../_components/meter";
import {
  StepCard,
  StepDetail,
  StepEyebrow,
  StepHeader,
  StepTitle,
  StepTitleLabel,
  StepTitleNumber,
} from "../_components/step-card";
import { Steps, type StepsItem } from "../_components/steps";
import { useFormatShare } from "../_utils/percent";
import { hasShareMoved } from "../_utils/share-moved";
import { usePassMarksNote } from "../_utils/use-pass-marks-note";
import { useMockScreen } from "./mock-context";
import { useMockTitle } from "./mock-labels";
import { MockLeftOutNote, MockScoreNote, useMockShortLine } from "./mock-notes";
import {
  MockNextStep,
  MockResultActions,
  MockResultOptions,
  useMistakeCount,
} from "./mock-result-actions";
import { MockResultBreakdown, hasBreakdown } from "./mock-result-breakdown";
import { useEssayItems } from "./mock-result-essays";
import { MockResultInsights, useHasInsights } from "./mock-result-insights";
import { MockFocusStep, MockSkipStep } from "./mock-result-plan";
import { useSpeakingItems } from "./mock-result-speaking";
import { MockSizeNote } from "./mock-size-note";

/** "300–470": a range, since one mock can't pin a score down. */
function useRange() {
  const t = useExtracted();

  return ({ high, low }: { high: number; low: number }) =>
    t("{low}–{high}", { high: String(high), low: String(low) });
}

/** The score in the exam's own terms: estimated range (ENEM), net score (Cebraspe) or right answers. */
function useScore(result: MockResult): { label: string; value: string } {
  const t = useExtracted();
  const format = useFormatter();
  const range = useRange();

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

/** "+16 since the last one", as a chip; only when there was a last one and it moved. */
function DeltaChip({ result }: { result: MockResult }) {
  const t = useExtracted();
  const current = result.irt?.score ?? result.net?.net ?? null;

  if (current === null || result.previous === null || current === result.previous) {
    return null;
  }

  const change = Math.round(current - result.previous);

  return (
    <FactChip>
      {change > 0 ? <TrendingUpIcon aria-hidden="true" /> : <TrendingDownIcon aria-hidden="true" />}
      {change > 0
        ? t("+{change} since the last one", { change: String(change) })
        : t("{change} since the last one", { change: String(change) })}
    </FactChip>
  );
}

/**
 * A net score comes from right, wrong and blank answers (and partly right ones, where the notice
 * gives partial credit): each as a chip.
 */
function NetChips({ result }: { result: MockResult }) {
  const t = useExtracted();

  if (!result.net) {
    return null;
  }

  return (
    <>
      <FactChip>
        {t("{count, plural, =0 {# right} one {# right} other {# right}}", {
          count: result.net.right,
        })}
      </FactChip>
      {result.net.partial > 0 && (
        <FactChip>
          {t("{count, plural, one {# partly right} other {# partly right}}", {
            count: result.net.partial,
          })}
        </FactChip>
      )}
      <FactChip>
        {t("{count, plural, =0 {# wrong} one {# wrong} other {# wrong}}", {
          count: result.net.wrong,
        })}
      </FactChip>
      <FactChip>
        {t("{count, plural, =0 {# blank} one {# blank} other {# blank}}", {
          count: result.net.blank,
        })}
      </FactChip>
    </>
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
    <div className="bg-muted/50 flex w-full flex-col gap-1 rounded-2xl px-4 py-3 text-left text-sm">
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

/** Up to this many areas, the score's line names them; past it, it counts them. */
const MAX_NAMED_AREAS = 3;

/** The mock done, its score big, with the exam and its areas under it. */
function ScoreStep({ result }: { result: MockResult }) {
  const t = useExtracted();
  const title = useMockTitle();
  const { runner } = useMockScreen();
  const score = useScore(result);
  const short = useMockShortLine(runner.view);

  // A mock over every subject counts them: the next step names each with its score.
  const areas =
    result.areas.length > MAX_NAMED_AREAS
      ? t("{count, plural, one {# subject} other {# subjects}}", { count: result.areas.length })
      : result.areas.map((area) => area.name).join(", ");

  const detail = [score.label, runner.view.examName, areas].filter(Boolean).join(" · ");

  return (
    <StepCard>
      <KindTile kind="mock" size="lg" />
      <StepHeader>
        <StepTitle className="flex flex-col items-center gap-1.5">
          <StepTitleLabel>{t("{mock} done", { mock: title(runner.view) })}</StepTitleLabel>
          <StepTitleNumber>{score.value}</StepTitleNumber>
        </StepTitle>
        <StepDetail>{detail}</StepDetail>
      </StepHeader>

      <FactChips className="justify-center empty:hidden">
        <NetChips result={result} />
        <DeltaChip result={result} />
      </FactChips>

      <PassMarks />
      <div className="flex flex-col gap-1">
        <MockScoreNote notes={runner.view.scoreNotes} />
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

/** Preparation before and after the mock: the answers it gave count, never more than that. */
function PreparationStep({ change }: { change: NonNullable<MockResult["preparation"]> }) {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const fell = change.after < change.before;

  return (
    <StepCard>
      <StepHeader>
        {/* The exam is the screen's subject already; naming it here would need its article. */}
        <StepEyebrow>{t("Your preparation")}</StepEyebrow>
        <StepTitle className="text-5xl tabular-nums sm:text-5xl">
          <span className="text-muted-foreground">{`${formatShare(change.before)} → `}</span>
          {formatShare(change.after)}
        </StepTitle>
      </StepHeader>
      <Meter className="h-2.5 w-full max-w-xs">
        <MeterFill share={change.after} />
      </Meter>
      <StepDetail>
        {fell
          ? t("The mock exam showed what's still missing.")
          : t("What you showed in this mock exam counts toward it.")}
      </StepDetail>
    </StepCard>
  );
}

/**
 * The result's steps, each only when it has something to say: the score, the essays of a full
 * mock's written part (graded right after hand-in, so the score never waits for them), its
 * speaking paper's estimate with each task's feedback, how each
 * area and topic went, what the mock showed, preparation, what it offers to change in the plan (asked, one offer
 * at a time) and the mistakes to review. A placement mock's answers set where the plan starts, so
 * it offers no change and has no mistakes to review.
 */
function useResultItems(result: MockResult): StepsItem[] {
  const { runner } = useMockScreen();
  const mistakes = useMistakeCount();
  const hasInsights = useHasInsights();
  const essays = useEssayItems();
  const speaking = useSpeakingItems();
  const { adapt, purpose } = runner.view;

  // A day that is all written or spoken has no questions to score: its essays or its speaking
  // paper are the result.
  const hasQuestions = result.total > 0 || (essays.length === 0 && speaking.length === 0);

  return [
    hasQuestions && { content: <ScoreStep result={result} />, id: "score" },
    ...essays,
    ...speaking,
    hasBreakdown(result) && { content: <MockResultBreakdown result={result} />, id: "breakdown" },
    hasInsights && { content: <MockResultInsights />, id: "insights" },
    result.preparation &&
      hasShareMoved(result.preparation) && {
        content: <PreparationStep change={result.preparation} />,
        id: "preparation",
      },
    adapt?.skip && { content: <MockSkipStep skip={adapt.skip} />, id: "skip" },
    adapt?.focus && { content: <MockFocusStep focus={adapt.focus} />, id: "focus" },
    purpose !== "placement" &&
      mistakes > 0 && { content: <MockNextStep count={mistakes} />, id: "next" },
  ].filter((item) => item !== null && item !== false && item !== undefined);
}

function MockResultSteps({ result }: { result: MockResult }) {
  const { ask, hrefs } = useMockScreen();
  const items = useResultItems(result);

  return (
    <Steps
      exitHref={hrefs.exit}
      finalAction={<MockResultActions />}
      finalOptions={<MockResultOptions />}
      headerEnd={ask}
      items={items}
    />
  );
}

/**
 * The result one thing at a time: the score in the exam's own terms (a range where it's an
 * estimate), each area and topic, what the mock showed about pace and blanks, how preparation
 * moved, what it offers to change in the plan, and the one thing to do now: review the mistakes.
 */
export function MockResultView() {
  const { runner } = useMockScreen();
  const { result } = runner.view;

  return result ? <MockResultSteps result={result} /> : null;
}
