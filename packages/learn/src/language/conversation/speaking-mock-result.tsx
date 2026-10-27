"use client";

import {
  type LanguageConversationView,
  type SpeakingMockExam,
  type SpeakingMockFeedback,
} from "@zoonk/core/language/conversations/contract";
import { Button } from "@zoonk/ui/components/button";
import { LightbulbIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useTransition } from "react";
import { CHIP_CLASS } from "../../_components/chip";
import { DetailsDrawer } from "../../_components/details-drawer";
import {
  StepCard,
  StepDetail,
  StepEyebrow,
  StepHeader,
  StepTitle,
  StepTitleLabel,
  StepTitleNumber,
} from "../../_components/step-card";
import { Steps, type StepsItem } from "../../_components/steps";
import { TaskMainLink } from "../../shell/task-frame";
import { CallNote } from "./call-note";
import { useConversationTitle, useCriterionName } from "./conversation-labels";
import { EstimateNote, ResultRow, ResultRows } from "./result-rows";

const BAND_DIGITS = 1;

type Criterion = SpeakingMockFeedback["criteria"][number];

function useBandRange() {
  const format = useFormatter();

  const band = (value: number) =>
    format.number(value, {
      maximumFractionDigits: BAND_DIGITS,
      minimumFractionDigits: BAND_DIGITS,
    });

  return ({ bandHigh, bandLow }: { bandHigh: number; bandLow: number }) =>
    bandHigh === bandLow ? band(bandLow) : `${band(bandLow)}–${band(bandHigh)}`;
}

/** Each exam's own scale, so a TOEFL 4.5 isn't read as an IELTS 4.5. */
function useBandLabel() {
  const t = useExtracted();

  const labels: Record<SpeakingMockExam, string> = {
    ielts: t("Estimated band, from 0 to 9"),
    toefl: t("Estimated band, from 1 to 6"),
  };

  return (exam: SpeakingMockExam) => labels[exam];
}

/** The band overall, big, on its exam's scale, and that it's an estimate. */
function BandStep({
  conversation,
  feedback,
}: {
  conversation: LanguageConversationView;
  feedback: SpeakingMockFeedback;
}) {
  const t = useExtracted();
  const title = useConversationTitle(conversation);
  const range = useBandRange();
  const bandLabel = useBandLabel();

  return (
    <>
      <StepCard>
        <StepHeader>
          <StepTitle className="flex flex-col items-start gap-1.5">
            <StepTitleLabel>{title}</StepTitleLabel>
            <StepTitleNumber>{range(feedback.overall)}</StepTitleNumber>
          </StepTitle>
          <StepDetail>{bandLabel(feedback.exam)}</StepDetail>
        </StepHeader>
      </StepCard>

      <EstimateNote>{t("An estimate from one short mock, not an official score.")}</EstimateNote>
    </>
  );
}

/** Each criterion with its band; the one to work on first is marked. */
function CriteriaStep({ feedback }: { feedback: SpeakingMockFeedback }) {
  const t = useExtracted();
  const criterionName = useCriterionName();
  const range = useBandRange();

  return (
    <StepCard>
      <StepTitle>{t("By criterion")}</StepTitle>
      <ResultRows>
        {feedback.criteria.map((criterion) => (
          <ResultRow key={criterion.criterion}>
            <span className="flex min-w-0 items-center gap-2 font-medium">
              {criterionName(criterion.criterion)}
              {criterion.criterion === feedback.focus && (
                <span className={CHIP_CLASS}>{t("Focus")}</span>
              )}
            </span>
            <span className="shrink-0 font-mono font-medium whitespace-nowrap tabular-nums">
              {range(criterion)}
            </span>
          </ResultRow>
        ))}
      </ResultRows>
    </StepCard>
  );
}

/** The criterion to work on first: what was heard, and one concrete tip. */
function FocusStep({ criterion }: { criterion: Criterion }) {
  const t = useExtracted();
  const criterionName = useCriterionName();

  return (
    <>
      <StepCard>
        <StepHeader>
          <StepEyebrow>{t("Work on this first")}</StepEyebrow>
          <StepTitle>{criterionName(criterion.criterion)}</StepTitle>
          <StepDetail>{criterion.evidence}</StepDetail>
        </StepHeader>
      </StepCard>

      <CallNote>
        <LightbulbIcon aria-hidden="true" />
        <span>{criterion.tip}</span>
      </CallNote>
    </>
  );
}

/** Every criterion's evidence and tip, one text link away. */
function CriteriaDetails({ feedback }: { feedback: SpeakingMockFeedback }) {
  const t = useExtracted();
  const criterionName = useCriterionName();

  return (
    <DetailsDrawer label={t("See every criterion")} title={t("By criterion")}>
      <ul className="flex flex-col gap-4">
        {feedback.criteria.map((criterion) => (
          <li className="flex flex-col gap-1 text-sm" key={criterion.criterion}>
            <p className="font-semibold">{criterionName(criterion.criterion)}</p>
            <p className="text-muted-foreground">{criterion.evidence}</p>
            <p>{criterion.tip}</p>
          </li>
        ))}
      </ul>
    </DetailsDrawer>
  );
}

/** Nothing to grade, never the learner's fault. */
function NoScoreStep() {
  const t = useExtracted();

  return (
    <StepCard>
      <StepTitle>{t("This mock has no score")}</StepTitle>
      <StepDetail>{t("Try another one when you're ready.")}</StepDetail>
    </StepCard>
  );
}

function TryAgainButton({ onTryAgain }: { onTryAgain: () => Promise<void> }) {
  const t = useExtracted();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      className="w-full"
      disabled={isPending}
      onClick={() => startTransition(onTryAgain)}
      size="lg"
      variant="ghost"
    >
      {t("Try another mock")}
    </Button>
  );
}

/**
 * After a speaking mock, one thing at a time: the estimated band on its exam's scale (IELTS 0 to
 * 9, TOEFL 1 to 6) with what the call did to the day, each criterion's band, then the one to work
 * on first with what was heard and a concrete tip. A milestone the call earned opens before the
 * band. Every criterion's comments wait behind a link, and another try is one tap away. It's an
 * estimate from a short mock, never an official score, and says so.
 */
export function SpeakingMockResult({
  ceremony,
  conversation,
  dayMoment,
  exitHref,
  feedback,
  nextHref,
  onTryAgain,
}: {
  /** The full-screen moment for a milestone the call earned, before the band. */
  ceremony?: StepsItem["moment"];
  conversation: LanguageConversationView;
  /** What the call just did to the day (`DayMoment`), last on the first step. */
  dayMoment: React.ReactNode;
  exitHref: string;
  feedback: SpeakingMockFeedback | null;
  nextHref: string;
  onTryAgain: (() => Promise<void>) | null;
}) {
  const t = useExtracted();
  const focus = feedback?.criteria.find((criterion) => criterion.criterion === feedback.focus);

  // Last on the first step, as a call's result has it under its stars.
  const items: StepsItem[] = feedback
    ? [
        {
          content: (
            <>
              <BandStep conversation={conversation} feedback={feedback} />
              {dayMoment}
            </>
          ),
          id: "band",
          moment: ceremony,
        },
        feedback.criteria.length > 0 && {
          content: <CriteriaStep feedback={feedback} />,
          id: "criteria",
        },
        focus && { content: <FocusStep criterion={focus} />, id: "focus" },
      ].filter((item) => item !== false && item !== undefined)
    : [
        {
          content: (
            <>
              <NoScoreStep />
              {dayMoment}
            </>
          ),
          id: "noScore",
          moment: ceremony,
        },
      ];

  return (
    <Steps
      exitHref={exitHref}
      finalAction={<TaskMainLink href={nextHref}>{t("Continue")}</TaskMainLink>}
      finalOptions={
        <>
          {onTryAgain && <TryAgainButton onTryAgain={onTryAgain} />}
          {feedback && feedback.criteria.length > 0 && <CriteriaDetails feedback={feedback} />}
        </>
      }
      items={items}
    />
  );
}
