"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import {
  type ExamSpeakingFeedbackView,
  type ExamTaskView,
  type SpeakingCriterionView,
} from "@zoonk/core/language/exam-speaking/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { LightbulbIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { CHIP_CLASS } from "../../_components/chip";
import { Eyebrow } from "../../_components/eyebrow";
import { StepCard, StepDetail, StepHeader, StepTitle } from "../../_components/step-card";
import { Steps, type StepsItem } from "../../_components/steps";
import { StepWithDayMoment } from "../../session/day-moment";
import { TaskMainLink } from "../../shell/task-frame";
import { CallNote } from "../conversation/call-note";
import { EstimateNote, ResultRow, ResultRows } from "../conversation/result-rows";
import { TryCallAgain } from "../conversation/try-call-again";
import { type CallStartOutcome } from "../conversation/use-call-start";
import { CriteriaDetails } from "./exam-speaking-criteria";
import { useCriterionGloss, useEstimateText, useStandingText } from "./exam-speaking-labels";
import { useExamTaskTitle } from "./exam-task-intro";

type Grade = ExamSpeakingFeedbackView["criteria"][number];
type GradedCriterion = { criterion: SpeakingCriterionView; grade: Grade };

function listCriteria({
  examTask,
  feedback,
}: {
  examTask: ExamTaskView;
  feedback: ExamSpeakingFeedbackView;
}): { criterion: SpeakingCriterionView; grade: Grade | null }[] {
  return examTask.criteria.map((criterion) => ({
    criterion,
    grade: feedback.criteria.find((item) => item.criterion === criterion.key) ?? null,
  }));
}

function isGraded(item: { grade: Grade | null }): item is GradedCriterion {
  return item.grade !== null;
}

function CriterionName({
  criterion,
  language,
}: {
  criterion: SpeakingCriterionView;
  language: string;
}) {
  const gloss = useCriterionGloss();

  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-medium">{gloss(criterion)}</span>
      {criterion.name.toLowerCase() !== gloss(criterion).toLowerCase() && (
        <span className="text-muted-foreground text-xs" lang={language}>
          {criterion.name}
        </span>
      )}
    </span>
  );
}

function useLevelLine({ examTask }: { examTask: ExamTaskView }): string | null {
  const t = useExtracted();
  const bands = new Set(examTask.criteria.map((criterion) => criterion.levelBand));
  const [band] = bands;
  const numbered = examTask.criteria.every((criterion) => criterion.display === "band");

  if (!numbered || bands.size !== 1 || band === null || band === undefined) {
    return null;
  }

  return t("On these scales, {band} is the {level} level.", {
    band: String(band),
    level: examTask.level,
  });
}

function useEvidenceNotes({ feedback }: { feedback: ExamSpeakingFeedbackView }): string[] {
  const t = useExtracted();

  return [
    !feedback.heard && t("You typed your replies, so this estimate leaves out how you sound."),
    feedback.brief && t("You said little, so this estimate is rough."),
  ].filter((note) => typeof note === "string");
}

function CriterionEstimate({
  focus,
  graded,
  level,
}: {
  focus: boolean;
  graded: GradedCriterion;
  level: string;
}) {
  const t = useExtracted();
  const estimateText = useEstimateText();
  const standingText = useStandingText();
  const { standing } = graded.grade;

  return (
    <span className="flex shrink-0 flex-col items-end">
      <span className="font-mono font-medium whitespace-nowrap tabular-nums">
        {estimateText(graded.grade.estimate)}
      </span>
      <span
        className={cn("text-xs", standing === "at" ? "text-success-text" : "text-muted-foreground")}
      >
        {standingText(standing, level)}
      </span>
      {focus && <span className={cn(CHIP_CLASS, "mt-1")}>{t("Focus")}</span>}
    </span>
  );
}

function CriteriaStep({
  conversation,
  examTask,
  feedback,
}: {
  conversation: LanguageConversationView;
  examTask: ExamTaskView;
  feedback: ExamSpeakingFeedbackView;
}) {
  const t = useExtracted();
  const title = useExamTaskTitle();
  const levelLine = useLevelLine({ examTask });
  const notes = useEvidenceNotes({ feedback });

  return (
    <>
      <StepCard>
        <StepHeader>
          <Eyebrow>{title(examTask)}</Eyebrow>
          <StepTitle lang={conversation.targetLanguage}>{examTask.task.name}</StepTitle>
          {levelLine && <StepDetail>{levelLine}</StepDetail>}
          {notes.map((note) => (
            <StepDetail key={note}>{note}</StepDetail>
          ))}
        </StepHeader>
        <ResultRows>
          {listCriteria({ examTask, feedback }).map((item) => (
            <ResultRow className="items-start" key={item.criterion.key}>
              <CriterionName criterion={item.criterion} language={conversation.targetLanguage} />
              {isGraded(item) ? (
                <CriterionEstimate
                  focus={item.criterion.key === feedback.focus}
                  graded={item}
                  level={examTask.level}
                />
              ) : (
                <span className="text-muted-foreground shrink-0 text-sm">{t("Not rated")}</span>
              )}
            </ResultRow>
          ))}
        </ResultRows>
      </StepCard>

      <EstimateNote>{t("An estimate, not an official score.")}</EstimateNote>
    </>
  );
}

function FocusStep({ focus, language }: { focus: GradedCriterion; language: string }) {
  const t = useExtracted();
  const gloss = useCriterionGloss();

  return (
    <>
      <StepCard>
        <StepHeader>
          <Eyebrow>{t("Work on this first")}</Eyebrow>
          <StepTitle>{gloss(focus.criterion)}</StepTitle>
          <StepDetail lang={language}>{focus.criterion.name}</StepDetail>
          <StepDetail>{focus.grade.evidence}</StepDetail>
        </StepHeader>
      </StepCard>

      <CallNote>
        <LightbulbIcon aria-hidden="true" />
        <span>{focus.grade.tip}</span>
      </CallNote>
    </>
  );
}

function NoGradeStep() {
  const t = useExtracted();

  return (
    <StepCard>
      <StepTitle>{t("This task has no estimate")}</StepTitle>
    </StepCard>
  );
}

export function ExamSpeakingResult({
  ceremony,
  conversation,
  dayMoment,
  examTask,
  exitHref,
  feedback,
  nextHref,
  nextTaskHref,
  onTryAgain,
}: {
  ceremony?: StepsItem["moment"];
  conversation: LanguageConversationView;
  dayMoment: React.ReactNode;
  examTask: ExamTaskView;
  exitHref: string;
  feedback: ExamSpeakingFeedbackView | null;
  nextHref: string;
  nextTaskHref: string | null;
  onTryAgain: (() => Promise<CallStartOutcome>) | null;
}) {
  const t = useExtracted();
  const language = conversation.targetLanguage;
  const criteria = feedback ? listCriteria({ examTask, feedback }) : [];
  const graded = criteria.filter((item) => isGraded(item));
  const focus = graded.find(({ criterion }) => criterion.key === feedback?.focus);

  const items: StepsItem[] =
    feedback && graded.length > 0
      ? [
          {
            content: (
              <StepWithDayMoment dayMoment={dayMoment}>
                <CriteriaStep conversation={conversation} examTask={examTask} feedback={feedback} />
              </StepWithDayMoment>
            ),
            id: "criteria",
            moment: ceremony,
          },
          focus && { content: <FocusStep focus={focus} language={language} />, id: "focus" },
        ].filter((item) => item !== undefined)
      : [
          {
            content: (
              <StepWithDayMoment dayMoment={dayMoment}>
                <NoGradeStep />
              </StepWithDayMoment>
            ),
            id: "noGrade",
            moment: ceremony,
          },
        ];

  return (
    <Steps
      exitHref={exitHref}
      finalAction={
        nextTaskHref ? (
          <TaskMainLink href={nextTaskHref}>{t("Next task")}</TaskMainLink>
        ) : (
          <TaskMainLink href={nextHref}>{t("Continue")}</TaskMainLink>
        )
      }
      finalOptions={
        <>
          {onTryAgain && (
            <TryCallAgain
              hint={t("Your task opens as soon as its card is ready.")}
              kind="examSpeaking"
              onTryAgain={onTryAgain}
            >
              {t("Try again")}
            </TryCallAgain>
          )}
          {graded.length > 0 && (
            <CriteriaDetails graded={graded} language={language} level={examTask.level} />
          )}
        </>
      }
      items={items}
    />
  );
}
