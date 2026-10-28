"use client";

import {
  type LanguageConversationView,
  type SpeakingMockExam,
  type SpeakingMockFeedback,
} from "@zoonk/core/language/conversations/contract";
import { SPEAKING_MOCK_CRITERIA } from "@zoonk/core/language/conversations/speaking-mock";
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
import { TASK_OPTION_CLASS } from "../../_components/task-layout";
import { StepWithDayMoment } from "../../session/day-moment";
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

function useBandLabel() {
  const t = useExtracted();

  const labels: Record<SpeakingMockExam, string> = {
    ielts: t("Estimated band, from 0 to 9"),
    toefl: t("Estimated band, from 1 to 6"),
  };

  return (exam: SpeakingMockExam) => labels[exam];
}

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

function CriteriaStep({ feedback }: { feedback: SpeakingMockFeedback }) {
  const t = useExtracted();
  const criterionName = useCriterionName();
  const range = useBandRange();

  const rows = SPEAKING_MOCK_CRITERIA[feedback.exam].map((key) => ({
    graded: feedback.criteria.find((criterion) => criterion.criterion === key),
    key,
  }));

  const typed = rows.some((row) => !row.graded);

  return (
    <StepCard>
      <StepHeader>
        <StepTitle>{t("By criterion")}</StepTitle>
        {typed && (
          <StepDetail>
            {t("You typed your replies, so this estimate leaves out how you sound.")}
          </StepDetail>
        )}
      </StepHeader>
      <ResultRows>
        {rows.map(({ graded, key }) => (
          <ResultRow key={key}>
            <span className="flex min-w-0 items-center gap-2 font-medium">
              {criterionName(key)}
              {key === feedback.focus && <span className={CHIP_CLASS}>{t("Focus")}</span>}
            </span>
            {graded ? (
              <span className="shrink-0 font-mono font-medium whitespace-nowrap tabular-nums">
                {range(graded)}
              </span>
            ) : (
              <span className="text-muted-foreground shrink-0 text-sm">{t("Not rated")}</span>
            )}
          </ResultRow>
        ))}
      </ResultRows>
    </StepCard>
  );
}

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
      className={TASK_OPTION_CLASS}
      disabled={isPending}
      onClick={() => startTransition(onTryAgain)}
      size="xl"
      variant="ghost"
    >
      {t("Try another mock")}
    </Button>
  );
}

export function SpeakingMockResult({
  ceremony,
  conversation,
  dayMoment,
  exitHref,
  feedback,
  nextHref,
  onTryAgain,
}: {
  ceremony?: StepsItem["moment"];
  conversation: LanguageConversationView;
  dayMoment: React.ReactNode;
  exitHref: string;
  feedback: SpeakingMockFeedback | null;
  nextHref: string;
  onTryAgain: (() => Promise<void>) | null;
}) {
  const t = useExtracted();
  const focus = feedback?.criteria.find((criterion) => criterion.criterion === feedback.focus);

  const items: StepsItem[] = feedback
    ? [
        {
          content: (
            <StepWithDayMoment dayMoment={dayMoment}>
              <BandStep conversation={conversation} feedback={feedback} />
            </StepWithDayMoment>
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
            <StepWithDayMoment dayMoment={dayMoment}>
              <NoScoreStep />
            </StepWithDayMoment>
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
